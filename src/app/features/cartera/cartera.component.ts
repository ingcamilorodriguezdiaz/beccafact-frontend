import { Component, HostListener, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ReceivableInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  total: number;
  balance: number;
  paidAmount: number;
  status: string;
  carteraStatus: 'AL_DIA' | 'POR_VENCER' | 'VENCIDA' | 'EN_MORA';
  daysOverdue?: number;
  customer: {
    id: string;
    name: string;
    documentNumber: string;
    documentType: string;
    email?: string;
    phone?: string;
    city?: string;
  };
}

interface PaymentForm {
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

interface AgingRow {
  customer: { id: string; name: string; documentNumber: string };
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-cartera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    <div class="ct">

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Cartera</h1>
          <p class="page-header__sub">Gestión de cuentas por cobrar y seguimiento de pagos</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary btn--sm" (click)="loadDashboard(); load()">
            <span class="material-symbols-outlined">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      <!-- ── Tabs ────────────────────────────────────────────────────── -->
      <div class="ct__tabs">
        <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'cartera'" (click)="activeTab.set('cartera')">
          <span class="material-symbols-outlined">receipt_long</span> Cartera
        </button>
        <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'aging'" (click)="setTab('aging')">
          <span class="material-symbols-outlined">bar_chart</span> Aging
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════
           TAB: CARTERA
           ══════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'cartera') {

        <!-- ── KPI Cards ──────────────────────────────────────────── -->
        @if (dashboard()) {
          <div class="ct__kpis">
            <div class="ct__kpi ct__kpi--neutral">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">account_balance_wallet</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ dashboard()!.summary.totalCartera | currency:'COP':'symbol':'1.0-0' }}</div>
                <div class="ct__kpi-label">Total cartera</div>
                <div class="ct__kpi-sub">{{ dashboard()!.summary.totalInvoices }} facturas activas</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--danger">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">warning</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ dashboard()!.summary.totalOverdue | currency:'COP':'symbol':'1.0-0' }}</div>
                <div class="ct__kpi-label">Vencido</div>
                <div class="ct__kpi-sub">{{ dashboard()!.summary.clientesEnMora }} clientes en mora</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--warn">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">schedule</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ dashboard()!.summary.totalDueSoon | currency:'COP':'symbol':'1.0-0' }}</div>
                <div class="ct__kpi-label">Por vencer (30 días)</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--success">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">check_circle</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ dashboard()!.summary.totalCurrent | currency:'COP':'symbol':'1.0-0' }}</div>
                <div class="ct__kpi-label">Al día</div>
              </div>
            </div>
          </div>
        }

        <!-- ── Filtros ─────────────────────────────────────────────── -->
        <div class="ct__filters card card--sm card--flat">
          <div class="search-box" style="flex:1;max-width:320px">
            <span class="search-box__icon material-symbols-outlined">search</span>
            <input type="text" class="search-box__input" placeholder="Buscar por factura o cliente…"
                   [(ngModel)]="search" (ngModelChange)="onSearch()" />
          </div>
          <div class="ct__filter-chips">
            @for (f of statusFilters; track f.value) {
              <button class="chip" [class.chip--active]="statusFilter() === f.value"
                      (click)="setFilter(f.value)">
                {{ f.label }}
              </button>
            }
          </div>
        </div>

        <!-- ── Tabla ───────────────────────────────────────────────── -->
        <div class="table-wrapper">
          <div class="table-scroll">
            @if (loading()) {
              <div class="ct__loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="sk-row">
                    <div class="sk" style="width:110px"></div>
                    <div class="sk" style="width:180px"></div>
                    <div class="sk" style="width:90px"></div>
                    <div class="sk" style="width:130px"></div>
                    <div class="sk" style="width:80px"></div>
                  </div>
                }
              </div>
            } @else if (invoices().length === 0) {
              <div class="ct__empty">
                <span class="material-symbols-outlined">inbox</span>
                <p>No hay facturas en cartera con los filtros seleccionados</p>
              </div>
            } @else {
              <table class="bf-table">
                <thead>
                  <tr>
                    <th>N° Factura</th>
                    <th>Cliente</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of invoices(); track f.id) {
                    <tr [class.ct__row--mora]="f.carteraStatus === 'EN_MORA'">
                      <td><code class="inv-num">{{ f.invoiceNumber }}</code></td>
                      <td>
                        <div class="ct__cliente">
                          <span class="ct__cliente-name">{{ f.customer.name }}</span>
                          <span class="ct__cliente-doc">{{ f.customer.documentNumber }}</span>
                        </div>
                      </td>
                      <td class="td-date">{{ f.issueDate | date:'dd/MM/yy' }}</td>
                      <td class="td-date">
                        @if (f.dueDate) {
                          <span [class.text-danger]="(f.daysOverdue ?? 0) > 0">
                            {{ f.dueDate | date:'dd/MM/yy' }}
                            @if ((f.daysOverdue ?? 0) > 0) {
                              <small class="ct__dias-badge">+{{ f.daysOverdue }}d</small>
                            }
                          </span>
                        } @else {
                          <span class="text-muted">—</span>
                        }
                      </td>
                      <td class="td-currency td-muted">{{ f.total | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-currency">
                        {{ f.balance | currency:'COP':'symbol':'1.0-0' }}
                        @if (f.paidAmount > 0 && f.status !== 'PAID') {
                          <div class="ct__partial-badge">Parcial</div>
                        }
                      </td>
                      <td>
                        <span class="badge" [ngClass]="statusClass(f.carteraStatus)">
                          {{ statusLabel(f.carteraStatus) }}
                        </span>
                      </td>
                      <td>
                        <div class="ct__row-actions">
                          <button class="btn-icon" title="Ver cliente" (click)="verCliente(f.customer.id)">
                            <span class="material-symbols-outlined">person</span>
                          </button>
                          <button class="btn-icon" title="Ver historial de pagos" (click)="verPagos(f)">
                            <span class="material-symbols-outlined">history</span>
                          </button>
                          @if (canRegisterPayment() && f.status !== 'PAID') {
                            <button class="btn-icon btn-icon--success" title="Registrar pago" (click)="openPago(f)">
                              <span class="material-symbols-outlined">payments</span>
                            </button>
                          }
                          @if (canSendReminder() && f.status !== 'PAID') {
                            <button class="btn-icon btn-icon--warn" title="Enviar recordatorio" (click)="sendReminder(f)">
                              <span class="material-symbols-outlined">mail</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>

        <!-- Paginación -->
        @if (total() > 0) {
          <div class="ct__pagination">
            <span class="ct__pag-info">{{ (page()-1)*20+1 }}–{{ min(page()*20, total()) }} de {{ total() }}</span>
            <button class="btn-pag" [disabled]="page()===1" (click)="backPage()">
              <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button class="btn-pag" [disabled]="page()*20>=total()" (click)="nextPage()">
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        }

      }<!-- /tab cartera -->

      <!-- ══════════════════════════════════════════════════════════════
           TAB: AGING
           ══════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'aging') {
        @if (agingLoading()) {
          <div class="ct__aging-loading">
            <div class="spinner"></div>
            <span>Calculando aging…</span>
          </div>
        } @else if (aging()) {
          <div class="ct__aging-header">
            <p class="ct__aging-desc">Distribución de saldos por antigüedad al día de hoy</p>
          </div>

          <!-- Totales aging -->
          <div class="ct__aging-summary">
            <div class="ct__as ct__as--current">
              <div class="ct__as-label">Al día / Vigente</div>
              <div class="ct__as-val">{{ aging()!.totals.current | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
            <div class="ct__as ct__as--warn">
              <div class="ct__as-label">1–30 días</div>
              <div class="ct__as-val">{{ aging()!.totals.days30 | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
            <div class="ct__as ct__as--orange">
              <div class="ct__as-label">31–60 días</div>
              <div class="ct__as-val">{{ aging()!.totals.days60 | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
            <div class="ct__as ct__as--danger">
              <div class="ct__as-label">61–90 días</div>
              <div class="ct__as-val">{{ aging()!.totals.days90 | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
            <div class="ct__as ct__as--mora">
              <div class="ct__as-label">&gt; 90 días</div>
              <div class="ct__as-val">{{ aging()!.totals.over90 | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
            <div class="ct__as ct__as--total">
              <div class="ct__as-label">Total</div>
              <div class="ct__as-val">{{ aging()!.totals.total | currency:'COP':'symbol':'1.0-0' }}</div>
            </div>
          </div>

          <!-- Tabla aging por cliente -->
          <div class="table-wrapper">
            <div class="table-scroll">
              @if (aging()!.rows.length === 0) {
                <div class="ct__empty">
                  <span class="material-symbols-outlined">check_circle</span>
                  <p>No hay saldos pendientes en cartera</p>
                </div>
              } @else {
                <table class="bf-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th class="td-currency">Al día</th>
                      <th class="td-currency">1–30 días</th>
                      <th class="td-currency">31–60 días</th>
                      <th class="td-currency">61–90 días</th>
                      <th class="td-currency">&gt; 90 días</th>
                      <th class="td-currency">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of aging()!.rows; track row.customer.id) {
                      <tr>
                        <td>
                          <div class="ct__cliente">
                            <span class="ct__cliente-name">{{ row.customer.name }}</span>
                            <span class="ct__cliente-doc">{{ row.customer.documentNumber }}</span>
                          </div>
                        </td>
                        <td class="td-currency">{{ row.current > 0 ? (row.current | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                        <td class="td-currency" [class.text-warn]="row.days30 > 0">{{ row.days30 > 0 ? (row.days30 | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                        <td class="td-currency" [class.text-orange]="row.days60 > 0">{{ row.days60 > 0 ? (row.days60 | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                        <td class="td-currency" [class.text-danger]="row.days90 > 0">{{ row.days90 > 0 ? (row.days90 | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                        <td class="td-currency" [class.text-mora]="row.over90 > 0">{{ row.over90 > 0 ? (row.over90 | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                        <td class="td-currency td-bold">{{ row.total | currency:'COP':'symbol':'1.0-0' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>
        }
      }<!-- /tab aging -->

    </div><!-- /ct -->

    <!-- ══════════════════════════════════════════════════════════════
         MODAL: DETALLE CLIENTE
         ══════════════════════════════════════════════════════════════ -->
    @if (showCustomerModal()) {
      <div class="modal-overlay" (click)="showCustomerModal.set(false)">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cartera del cliente</h3>
            <button class="modal-close" (click)="showCustomerModal.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            @if (!customerReceivables()) {
              <div class="modal-loading"><div class="spinner"></div></div>
            } @else {
              <div class="ct__cliente-header">
                <div class="ct__cliente-avatar">{{ customerReceivables()!.customer.name[0] }}</div>
                <div>
                  <div class="ct__cliente-title">{{ customerReceivables()!.customer.name }}</div>
                  <div class="ct__cliente-meta">
                    {{ customerReceivables()!.customer.documentType }} {{ customerReceivables()!.customer.documentNumber }}
                    @if (customerReceivables()!.customer.email) { · {{ customerReceivables()!.customer.email }} }
                    @if (customerReceivables()!.customer.phone) { · {{ customerReceivables()!.customer.phone }} }
                  </div>
                </div>
              </div>
              <div class="ct__cliente-kpis">
                <div class="ct__ck">
                  <div class="ct__ck-val">{{ customerReceivables()!.summary.balancePending | currency:'COP':'symbol':'1.0-0' }}</div>
                  <div class="ct__ck-label">Saldo pendiente</div>
                </div>
                <div class="ct__ck ct__ck--danger">
                  <div class="ct__ck-val">{{ customerReceivables()!.summary.balanceOverdue | currency:'COP':'symbol':'1.0-0' }}</div>
                  <div class="ct__ck-label">Saldo vencido</div>
                </div>
                <div class="ct__ck">
                  <div class="ct__ck-val">{{ customerReceivables()!.summary.invoicesPending }}</div>
                  <div class="ct__ck-label">Facturas pendientes</div>
                </div>
                <div class="ct__ck">
                  <div class="ct__ck-val">{{ customerReceivables()!.summary.invoicesPaid }}</div>
                  <div class="ct__ck-label">Facturas pagadas</div>
                </div>
              </div>
              <table class="bf-table bf-table--sm">
                <thead>
                  <tr><th>Factura</th><th>Emisión</th><th>Vencimiento</th><th>Total</th><th>Saldo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  @for (inv of customerReceivables()!.invoices; track inv.id) {
                    <tr>
                      <td><code>{{ inv.invoiceNumber }}</code></td>
                      <td>{{ inv.issueDate | date:'dd/MM/yy' }}</td>
                      <td>{{ inv.dueDate ? (inv.dueDate | date:'dd/MM/yy') : '—' }}</td>
                      <td class="td-currency td-muted">{{ inv.total | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-currency">{{ inv.balance | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(inv.carteraStatus)">{{ statusLabel(inv.carteraStatus) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════
         MODAL: HISTORIAL DE PAGOS
         ══════════════════════════════════════════════════════════════ -->
    @if (showPaymentHistoryModal()) {
      <div class="modal-overlay" (click)="showPaymentHistoryModal.set(false)">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Historial de pagos — {{ paymentHistory()?.invoice?.invoiceNumber }}</h3>
            <button class="modal-close" (click)="showPaymentHistoryModal.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            @if (!paymentHistory()) {
              <div class="modal-loading"><div class="spinner"></div></div>
            } @else {
              <!-- Resumen de la factura -->
              <div class="ct__ph-summary">
                <div class="ct__ph-item">
                  <span class="ct__ph-lbl">Total factura</span>
                  <span class="ct__ph-val">{{ paymentHistory()!.invoice.total | currency:'COP':'symbol':'1.0-0' }}</span>
                </div>
                <div class="ct__ph-item">
                  <span class="ct__ph-lbl">Total pagado</span>
                  <span class="ct__ph-val ct__ph-val--success">{{ paymentHistory()!.invoice.paidAmount | currency:'COP':'symbol':'1.0-0' }}</span>
                </div>
                <div class="ct__ph-item">
                  <span class="ct__ph-lbl">Saldo pendiente</span>
                  <span class="ct__ph-val" [class.ct__ph-val--danger]="paymentHistory()!.invoice.balance > 0">
                    {{ paymentHistory()!.invoice.balance | currency:'COP':'symbol':'1.0-0' }}
                  </span>
                </div>
              </div>

              <!-- Barra de progreso de pago -->
              @if (paymentHistory()!.invoice.total > 0) {
                <div class="ct__ph-progress-wrap">
                  <div class="ct__ph-progress">
                    <div class="ct__ph-progress-bar"
                         [style.width.%]="(paymentHistory()!.invoice.paidAmount / paymentHistory()!.invoice.total) * 100">
                    </div>
                  </div>
                  <span class="ct__ph-pct">{{ ((paymentHistory()!.invoice.paidAmount / paymentHistory()!.invoice.total) * 100) | number:'1.0-0' }}% pagado</span>
                </div>
              }

              <!-- Registros de pago -->
              @if (paymentHistory()!.payments.length === 0) {
                <div class="ct__empty" style="padding:24px">
                  <span class="material-symbols-outlined">payments</span>
                  <p>Esta factura aún no tiene pagos registrados</p>
                </div>
              } @else {
                <table class="bf-table bf-table--sm" style="margin-top:12px">
                  <thead>
                    <tr><th>Fecha</th><th>Monto</th><th>Medio</th><th>Referencia</th><th>Registrado por</th></tr>
                  </thead>
                  <tbody>
                    @for (p of paymentHistory()!.payments; track p.id) {
                      <tr>
                        <td class="td-date">{{ p.paymentDate | date:'dd/MM/yy' }}</td>
                        <td class="td-currency">{{ p.amount | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td>{{ p.paymentMethod }}</td>
                        <td>{{ p.reference || '—' }}</td>
                        <td>{{ p.user.firstName }} {{ p.user.lastName }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            }
          </div>
          @if (canRegisterPayment() && paymentHistory()?.invoice && paymentHistory()!.invoice.balance > 0) {
            <div class="modal-footer">
              <button class="btn btn--primary" (click)="openPagoFromHistory()">
                <span class="material-symbols-outlined">add</span>
                Registrar pago
              </button>
            </div>
          }
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════
         MODAL: REGISTRAR PAGO
         ══════════════════════════════════════════════════════════════ -->
    @if (showPaymentModal()) {
      <div class="modal-overlay" (click)="closePago()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Registrar pago — {{ paymentInvoice()?.invoiceNumber }}</h3>
            <button class="modal-close" (click)="closePago()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <!-- Info saldo -->
            @if (paymentInvoice()) {
              <div class="ct__pay-info">
                <div class="ct__pay-info-row">
                  <span>Total factura</span>
                  <strong>{{ paymentInvoice()!.total | currency:'COP':'symbol':'1.0-0' }}</strong>
                </div>
                @if (paymentInvoice()!.paidAmount > 0) {
                  <div class="ct__pay-info-row">
                    <span>Ya pagado</span>
                    <strong class="text-success">{{ paymentInvoice()!.paidAmount | currency:'COP':'symbol':'1.0-0' }}</strong>
                  </div>
                }
                <div class="ct__pay-info-row ct__pay-info-row--highlight">
                  <span>Saldo pendiente</span>
                  <strong>{{ paymentInvoice()!.balance | currency:'COP':'symbol':'1.0-0' }}</strong>
                </div>
              </div>
            }

            <div class="form-group">
              <label class="form-label">Monto a registrar *</label>
              <input type="number" class="form-control" [(ngModel)]="paymentForm.amount"
                     [placeholder]="paymentInvoice()?.balance ?? 0" min="0.01"
                     [max]="paymentInvoice()?.balance ?? 999999999" />
              @if (paymentInvoice() && paymentForm.amount > 0 && paymentForm.amount < paymentInvoice()!.balance) {
                <small class="form-hint form-hint--warn">
                  Pago parcial — quedará un saldo de {{ (paymentInvoice()!.balance - paymentForm.amount) | currency:'COP':'symbol':'1.0-0' }}
                </small>
              }
              @if (paymentInvoice() && paymentForm.amount >= paymentInvoice()!.balance && paymentForm.amount > 0) {
                <small class="form-hint form-hint--success">Pago completo — la factura quedará marcada como pagada</small>
              }
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Fecha de pago *</label>
                <input type="date" class="form-control" [(ngModel)]="paymentForm.paymentDate"
                       [max]="today" />
              </div>
              <div class="form-group">
                <label class="form-label">Medio de pago *</label>
                <select class="form-control" [(ngModel)]="paymentForm.paymentMethod">
                  <option value="">Seleccionar…</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="CONSIGNACION">Consignación</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">N° Referencia / Comprobante</label>
              <input type="text" class="form-control" [(ngModel)]="paymentForm.reference"
                     placeholder="Nro. transferencia, cheque, consignación…" />
            </div>
            <div class="form-group">
              <label class="form-label">Notas</label>
              <textarea class="form-control" [(ngModel)]="paymentForm.notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closePago()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitPago()" [disabled]="saving()">
              <span class="material-symbols-outlined">{{ saving() ? 'hourglass_empty' : 'payments' }}</span>
              {{ saving() ? 'Guardando…' : 'Registrar pago' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .ct { max-width: 1280px; }

    /* Tabs */
    .ct__tabs { display:flex; gap:4px; margin-bottom:20px; border-bottom:2px solid #f0f4f8; }
    .ct__tab { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; font-size:13.5px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:2px solid transparent; margin-bottom:-2px; cursor:pointer; transition:all .15s; border-radius:6px 6px 0 0; }
    .ct__tab .material-symbols-outlined { font-size:17px; }
    .ct__tab:hover { color:#1a407e; background:#f0f4f9; }
    .ct__tab--active { color:#1a407e; border-bottom-color:#1a407e; background:#f0f4f9; }

    /* KPIs */
    .ct__kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
    .ct__kpi { display:flex; align-items:center; gap:14px; background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:16px 18px; }
    .ct__kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ct__kpi-icon .material-symbols-outlined { font-size:20px; }
    .ct__kpi--neutral .ct__kpi-icon { background:#e8eef8; color:#1a407e; }
    .ct__kpi--danger .ct__kpi-icon  { background:#fee2e2; color:#ef4444; }
    .ct__kpi--warn .ct__kpi-icon    { background:#fef3c7; color:#f59e0b; }
    .ct__kpi--success .ct__kpi-icon { background:#dcfce7; color:#22c55e; }
    .ct__kpi-val   { font-family:'Sora',sans-serif; font-size:18px; font-weight:800; color:#0c1c35; }
    .ct__kpi-label { font-size:12px; color:#64748b; margin-top:1px; }
    .ct__kpi-sub   { font-size:11px; color:#94a3b8; }

    /* Filters */
    .ct__filters { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
    .ct__filter-chips { display:flex; gap:6px; flex-wrap:wrap; }
    .chip { padding:5px 12px; border-radius:99px; border:1px solid #dce6f0; background:#f8fafc; font-size:12.5px; font-weight:500; color:#64748b; cursor:pointer; transition:all .15s; }
    .chip:hover { border-color:#1a407e; color:#1a407e; }
    .chip--active { background:#1a407e; border-color:#1a407e; color:#fff; }

    /* Table */
    .table-wrapper { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-bottom:12px; }
    .table-scroll { overflow-x:auto; }
    .bf-table { width:100%; border-collapse:collapse; font-size:13px; }
    .bf-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; background:#f8fafc; border-bottom:1px solid #f0f4f8; white-space:nowrap; }
    .bf-table td { padding:11px 14px; border-bottom:1px solid #f8fafc; color:#374151; vertical-align:middle; }
    .bf-table tr:last-child td { border-bottom:none; }
    .bf-table--sm th, .bf-table--sm td { padding:8px 12px; font-size:12.5px; }
    .bf-table tbody tr:hover td { background:#fafcff; }
    .ct__row--mora td { background:#fff8f8; }

    .inv-num { background:#f0f4f9; padding:2px 6px; border-radius:4px; font-size:12px; color:#1a407e; }
    .ct__cliente { display:flex; flex-direction:column; gap:1px; }
    .ct__cliente-name { font-weight:600; color:#0c1c35; font-size:13px; }
    .ct__cliente-doc  { font-size:11px; color:#94a3b8; }
    .td-date     { white-space:nowrap; font-size:12.5px; color:#64748b; }
    .td-currency { font-weight:700; font-family:'Sora',sans-serif; font-size:13px; color:#0c1c35; white-space:nowrap; }
    .td-muted    { color:#94a3b8 !important; font-weight:400 !important; }
    .td-bold     { font-weight:800 !important; }
    .ct__dias-badge { background:#fee2e2; color:#ef4444; font-size:10px; font-weight:700; padding:1px 4px; border-radius:4px; margin-left:4px; }
    .ct__partial-badge { font-size:10px; font-weight:600; color:#f59e0b; background:#fef3c7; border-radius:4px; padding:1px 5px; display:inline-block; margin-top:2px; }
    .text-danger  { color:#ef4444; }
    .text-warn    { color:#f59e0b; }
    .text-orange  { color:#f97316; }
    .text-mora    { color:#be185d; }
    .text-success { color:#16a34a; }
    .text-muted   { color:#94a3b8; }

    /* Badges */
    .badge { font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:6px; white-space:nowrap; }
    .badge--success { background:#dcfce7; color:#16a34a; }
    .badge--warn    { background:#fef9c3; color:#ca8a04; }
    .badge--danger  { background:#fee2e2; color:#dc2626; }
    .badge--mora    { background:#fce7f3; color:#be185d; }
    .badge--muted   { background:#f0f4f9; color:#64748b; }

    /* Row actions */
    .ct__row-actions { display:flex; gap:4px; }
    .btn-icon { width:28px; height:28px; border-radius:7px; border:1px solid #dce6f0; background:#f8fafc; color:#475569; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .15s; }
    .btn-icon .material-symbols-outlined { font-size:15px; }
    .btn-icon:hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-icon--success:hover { background:#16a34a; border-color:#16a34a; color:#fff; }
    .btn-icon--warn:hover    { background:#f59e0b; border-color:#f59e0b; color:#fff; }

    /* Pagination */
    .ct__pagination { display:flex; align-items:center; gap:8px; justify-content:flex-end; }
    .ct__pag-info   { font-size:12.5px; color:#64748b; }
    .btn-pag { width:30px; height:30px; border-radius:7px; border:1px solid #dce6f0; background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .btn-pag:disabled { opacity:.4; cursor:default; }
    .btn-pag:not(:disabled):hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-pag .material-symbols-outlined { font-size:16px; }

    /* Empty / Loading */
    .ct__empty { display:flex; flex-direction:column; align-items:center; padding:48px 24px; gap:10px; color:#94a3b8; }
    .ct__empty .material-symbols-outlined { font-size:40px; }
    .ct__loading { padding:16px; display:flex; flex-direction:column; gap:10px; }
    .sk-row { display:flex; gap:12px; align-items:center; }
    .sk { height:14px; border-radius:6px; background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    /* Aging */
    .ct__aging-loading { display:flex; align-items:center; justify-content:center; gap:12px; padding:48px; color:#64748b; }
    .ct__aging-desc { font-size:13px; color:#64748b; margin:0 0 16px; }
    .ct__aging-summary { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; margin-bottom:16px; }
    .ct__as { background:#fff; border:1px solid #dce6f0; border-radius:10px; padding:12px 14px; }
    .ct__as-label { font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:.05em; }
    .ct__as-val   { font-family:'Sora',sans-serif; font-size:15px; font-weight:800; color:#0c1c35; margin-top:4px; }
    .ct__as--current { border-color:#dcfce7; } .ct__as--current .ct__as-val { color:#16a34a; }
    .ct__as--warn   { border-color:#fef9c3; } .ct__as--warn .ct__as-val { color:#ca8a04; }
    .ct__as--orange { border-color:#ffedd5; } .ct__as--orange .ct__as-val { color:#f97316; }
    .ct__as--danger { border-color:#fee2e2; } .ct__as--danger .ct__as-val { color:#dc2626; }
    .ct__as--mora   { border-color:#fce7f3; } .ct__as--mora .ct__as-val { color:#be185d; }
    .ct__as--total  { background:#1a407e; border-color:#1a407e; } .ct__as--total .ct__as-label,.ct__as--total .ct__as-val { color:#fff; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(12,28,53,.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; backdrop-filter:blur(2px); }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(12,28,53,.25); }
    .modal--lg { max-width:820px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; display:flex; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 22px; }
    .modal-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; justify-content:flex-end; gap:10px; }
    .modal-loading { display:flex; justify-content:center; padding:32px; }
    .spinner { width:32px; height:32px; border:3px solid #f0f4f8; border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* Cliente modal */
    .ct__cliente-header { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
    .ct__cliente-avatar { width:46px; height:46px; border-radius:12px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:18px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .ct__cliente-title { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; }
    .ct__cliente-meta { font-size:12px; color:#94a3b8; margin-top:2px; }
    .ct__cliente-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
    .ct__ck { background:#f8fafc; border-radius:10px; padding:12px 14px; }
    .ct__ck--danger { background:#fff5f5; }
    .ct__ck-val { font-family:'Sora',sans-serif; font-size:15px; font-weight:800; color:#0c1c35; }
    .ct__ck-label { font-size:11px; color:#94a3b8; margin-top:2px; }

    /* Payment history modal */
    .ct__ph-summary { display:flex; gap:0; border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; margin-bottom:14px; }
    .ct__ph-item { flex:1; padding:12px 16px; background:#f8fafc; border-right:1px solid #f0f4f8; }
    .ct__ph-item:last-child { border-right:none; }
    .ct__ph-lbl { font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:.05em; display:block; }
    .ct__ph-val { font-family:'Sora',sans-serif; font-size:16px; font-weight:800; color:#0c1c35; display:block; margin-top:3px; }
    .ct__ph-val--success { color:#16a34a; }
    .ct__ph-val--danger  { color:#dc2626; }
    .ct__ph-progress-wrap { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .ct__ph-progress { flex:1; height:8px; background:#f0f4f8; border-radius:99px; overflow:hidden; }
    .ct__ph-progress-bar { height:100%; background:linear-gradient(90deg,#16a34a,#4ade80); border-radius:99px; transition:width .4s ease; }
    .ct__ph-pct { font-size:12px; font-weight:700; color:#16a34a; white-space:nowrap; }

    /* Payment modal info */
    .ct__pay-info { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; flex-direction:column; gap:6px; }
    .ct__pay-info-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#64748b; }
    .ct__pay-info-row--highlight { border-top:1px solid #f0f4f8; padding-top:6px; margin-top:2px; color:#0c1c35; font-weight:600; }

    /* Form */
    .form-group { margin-bottom:14px; }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    textarea.form-control { resize:vertical; min-height:56px; }
    .form-hint { font-size:11.5px; margin-top:4px; display:block; }
    .form-hint--warn    { color:#f59e0b; }
    .form-hint--success { color:#16a34a; }

    /* Buttons */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn .material-symbols-outlined { font-size:16px; }
    .btn--primary { background:#1a407e; color:#fff; }
    .btn--primary:hover:not(:disabled) { background:#133265; }
    .btn--primary:disabled { opacity:.6; cursor:default; }
    .btn--secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn--secondary:hover { background:#e8eef8; }
    .btn--sm { padding:7px 14px; font-size:12.5px; }

    /* Page header */
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-header__title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-header__sub { font-size:13px; color:#64748b; margin:0; }
    .page-header__actions { display:flex; gap:8px; }
    .card { background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .card--sm { padding:12px 16px; }
    .card--flat { box-shadow:none; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid #dce6f0; border-radius:8px; padding:7px 11px; background:#fff; }
    .search-box__icon { font-size:16px; color:#94a3b8; }
    .search-box__input { border:none; outline:none; font-size:13.5px; color:#0c1c35; width:100%; background:transparent; }

    @media (max-width:1100px) { .ct__aging-summary { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:900px) { .ct__kpis { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:640px) {
      .ct__kpis { grid-template-columns:1fr; }
      .ct__filters { flex-direction:column; align-items:stretch; }
      .ct__cliente-kpis { grid-template-columns:repeat(2,1fr); }
      .ct__aging-summary { grid-template-columns:repeat(2,1fr); }
      .ct__ph-summary { flex-direction:column; }
      .ct__ph-item { border-right:none; border-bottom:1px solid #f0f4f8; }
      .form-row-2 { grid-template-columns:1fr; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; }
    }
  `],
})
export class CarteraComponent implements OnInit {
  private http   = inject(HttpClient);
  private notify = inject(NotificationService);
  private auth   = inject(AuthService);

  private readonly api = `${environment.apiUrl}/cartera`;
  readonly today = new Date().toISOString().split('T')[0];

  // ── State ────────────────────────────────────────────────────────────────

  invoices      = signal<ReceivableInvoice[]>([]);
  dashboard     = signal<any | null>(null);
  aging         = signal<{ rows: AgingRow[]; totals: any } | null>(null);
  loading       = signal(true);
  agingLoading  = signal(false);
  saving        = signal(false);
  total         = signal(0);
  page          = signal(1);
  search        = '';
  statusFilter  = signal('');
  activeTab     = signal<'cartera' | 'aging'>('cartera');

  showCustomerModal      = signal(false);
  customerReceivables    = signal<any>(null);

  showPaymentHistoryModal = signal(false);
  paymentHistory          = signal<any>(null);

  showPaymentModal  = signal(false);
  paymentInvoice    = signal<ReceivableInvoice | null>(null);

  paymentForm: PaymentForm = {
    amount: 0,
    paymentDate: this.today,
    paymentMethod: '',
    reference: '',
    notes: '',
  };

  // ── Permissions ──────────────────────────────────────────────────────────

  canRegisterPayment = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  });
  canSendReminder = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  });

  readonly statusFilters = [
    { value: '',         label: 'Todos'       },
    { value: 'VENCIDA',  label: 'Vencida'     },
    { value: 'EN_MORA',  label: 'En mora'     },
    { value: 'POR_VENCER', label: 'Por vencer' },
    { value: 'AL_DIA',   label: 'Al día'      },
    { value: 'PAGADA',   label: 'Pagada'      },
  ];

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadDashboard();
    this.load();
  }

  // ── Tab switching ────────────────────────────────────────────────────────

  setTab(tab: 'cartera' | 'aging') {
    this.activeTab.set(tab);
    if (tab === 'aging' && !this.aging()) this.loadAging();
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  loadDashboard() {
    this.http.get<any>(`${this.api}/dashboard`).subscribe({
      next: d => this.dashboard.set(d.data ?? d),
      error: () => {},
    });
  }

  loadAging() {
    this.agingLoading.set(true);
    this.http.get<any>(`${this.api}/aging`).subscribe({
      next: d => { this.aging.set(d.data ?? d); this.agingLoading.set(false); },
      error: () => { this.agingLoading.set(false); this.notify.error('Error al cargar aging'); },
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search) params.search = this.search;
    if (this.statusFilter()) params.status = this.statusFilter();

    this.http.get<any>(this.api, { params }).subscribe({
      next: r => {
        const res = r.data ?? r;
        this.invoices.set(res.data ?? res);
        this.total.set(res.total ?? 0);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar cartera'); },
    });
  }

  private searchTimer: any;
  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setFilter(v: string) { this.statusFilter.set(v); this.page.set(1); this.load(); }

  // ── Customer modal ────────────────────────────────────────────────────────

  verCliente(customerId: string) {
    this.customerReceivables.set(null);
    this.showCustomerModal.set(true);
    this.http.get<any>(`${this.api}/cliente/${customerId}`).subscribe({
      next: d => this.customerReceivables.set(d.data ?? d),
      error: () => { this.notify.error('Error al cargar cartera del cliente'); this.showCustomerModal.set(false); },
    });
  }

  // ── Payment history modal ─────────────────────────────────────────────────

  verPagos(f: ReceivableInvoice) {
    this.paymentHistory.set(null);
    this.showPaymentHistoryModal.set(true);
    this.http.get<any>(`${this.api}/${f.id}/pagos`).subscribe({
      next: d => this.paymentHistory.set(d.data ?? d),
      error: () => { this.notify.error('Error al cargar historial de pagos'); this.showPaymentHistoryModal.set(false); },
    });
  }

  openPagoFromHistory() {
    const hist = this.paymentHistory();
    if (!hist) return;
    // Build a minimal ReceivableInvoice from payment history data
    const inv: ReceivableInvoice = {
      id:            hist.invoice.id,
      invoiceNumber: hist.invoice.invoiceNumber,
      issueDate:     hist.invoice.issueDate ?? '',
      total:         hist.invoice.total,
      balance:       hist.invoice.balance,
      paidAmount:    hist.invoice.paidAmount,
      status:        hist.invoice.status,
      carteraStatus: 'AL_DIA',
      customer:      hist.invoice.customer,
    };
    this.showPaymentHistoryModal.set(false);
    this.openPago(inv);
  }

  // ── Payment modal ─────────────────────────────────────────────────────────

  openPago(f: ReceivableInvoice) {
    this.paymentInvoice.set(f);
    this.paymentForm = {
      amount:        f.balance,
      paymentDate:   this.today,
      paymentMethod: '',
      reference:     '',
      notes:         '',
    };
    this.showPaymentModal.set(true);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.showPaymentModal()) { this.closePago(); return; }
    if (this.showPaymentHistoryModal()) { this.showPaymentHistoryModal.set(false); return; }
    if (this.showCustomerModal()) { this.showCustomerModal.set(false); }
  }

  closePago() { this.showPaymentModal.set(false); this.paymentInvoice.set(null); }

  submitPago() {
    if (!this.paymentForm.paymentMethod) { this.notify.error('Selecciona el medio de pago'); return; }
    if (!this.paymentForm.amount || this.paymentForm.amount <= 0) { this.notify.error('Ingresa un monto válido'); return; }
    if (!this.paymentForm.paymentDate) { this.notify.error('Ingresa la fecha de pago'); return; }

    const inv = this.paymentInvoice()!;
    if (this.paymentForm.amount > inv.balance + 0.01) {
      this.notify.error(`El monto no puede superar el saldo pendiente (${inv.balance.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })})`);
      return;
    }

    this.saving.set(true);
    this.http.post<any>(`${this.api}/${inv.id}/pago`, this.paymentForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePago();
        this.notify.success('Pago registrado correctamente');
        this.loadDashboard();
        this.load();
        if (this.aging()) this.loadAging(); // refresh aging if already loaded
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al registrar pago'); },
    });
  }

  // ── Reminder ──────────────────────────────────────────────────────────────

  sendReminder(f: ReceivableInvoice) {
    this.http.post<any>(`${this.api}/${f.id}/recordatorio`, {}).subscribe({
      next: r => this.notify.success((r.data ?? r).message ?? 'Recordatorio enviado'),
      error: e => this.notify.error(e?.error?.message ?? 'Error al enviar recordatorio'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  statusClass(s: string) {
    return {
      'badge--success': s === 'AL_DIA',
      'badge--warn':    s === 'POR_VENCER',
      'badge--danger':  s === 'VENCIDA',
      'badge--mora':    s === 'EN_MORA',
      'badge--muted':   s === 'PAID' || s === 'PAGADA',
    };
  }

  statusLabel(s: string) {
    const map: Record<string, string> = {
      AL_DIA: 'Al día', POR_VENCER: 'Por vencer', VENCIDA: 'Vencida', EN_MORA: 'En mora',
      PAID: 'Pagada', PAGADA: 'Pagada',
    };
    return map[s] ?? s;
  }

  min(a: number, b: number) { return Math.min(a, b); }

  nextPage() { this.page.update(p => p + 1); this.load(); }
  backPage() { this.page.update(p => p - 1); this.load(); }
}
