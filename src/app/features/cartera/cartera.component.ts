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

interface ReceiptRecord {
  id: string;
  number: string;
  customerId: string;
  paymentDate: string;
  paymentMethod: string;
  status: 'OPEN' | 'PARTIALLY_APPLIED' | 'APPLIED' | 'VOID';
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  reference?: string;
  notes?: string;
  customer?: {
    id: string;
    name: string;
    documentNumber: string;
    email?: string;
  };
}

interface ReceiptApplicationModalState {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  unappliedAmount: number;
}

interface CustomerLite {
  id: string;
  name: string;
  documentNumber: string;
}

interface ReceiptApplicationForm {
  invoiceId: string;
  amount: number;
}

interface ReceiptForm {
  customerId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

interface PromiseRecord {
  id: string;
  customerId: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  amount: number;
  promisedDate: string;
  status: 'OPEN' | 'FULFILLED' | 'BROKEN' | 'CANCELLED';
  notes?: string | null;
  customer?: { id: string; name: string; documentNumber?: string };
}

interface FollowUpRecord {
  id: string;
  customerId: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  activityType: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'VISIT' | 'NOTE';
  outcome: string;
  nextActionDate?: string | null;
  nextAction?: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
}

interface CollectionWorkbench {
  summary: {
    openPromises: number;
    brokenPromises: number;
    dueTodayPromises: number;
    pendingFollowUps: number;
    priorityInvoices: number;
  };
  promises: PromiseRecord[];
  followUps: FollowUpRecord[];
  priorityInvoices: ReceivableInvoice[];
}

interface PromiseForm {
  customerId: string;
  invoiceId: string;
  amount: number;
  promisedDate: string;
  notes: string;
}

interface FollowUpForm {
  customerId: string;
  invoiceId: string;
  activityType: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'VISIT' | 'NOTE' | '';
  outcome: string;
  nextActionDate: string;
  nextAction: string;
}

interface AdjustmentRecord {
  id: string;
  customerId: string;
  invoiceId?: string | null;
  receiptId?: string | null;
  sourceInvoiceId?: string | null;
  type: 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'WRITE_OFF' | 'PROVISION' | 'RECOVERY' | 'RECEIPT_REVERSAL';
  status: 'PENDING_APPROVAL' | 'APPLIED' | 'REJECTED';
  amount: number;
  reason: string;
  notes?: string | null;
  approvedAt?: string | null;
  appliedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; documentNumber?: string };
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  sourceInvoiceNumber?: string | null;
  requestedByName?: string | null;
  approvedByName?: string | null;
}

interface AdjustmentForm {
  type: '' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'WRITE_OFF' | 'PROVISION' | 'RECOVERY' | 'RECEIPT_REVERSAL';
  customerId: string;
  invoiceId: string;
  receiptId: string;
  sourceInvoiceId: string;
  amount: number;
  reason: string;
  notes: string;
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
      <section class="hero-shell">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Seguimiento financiero</p>
            <h1 class="page-header__title">Cartera</h1>
            <p class="page-header__sub">Supervisa cuentas por cobrar, vencimientos y recaudos desde una vista más clara y ejecutiva.</p>
          </div>
          <div class="page-header__actions">
            <button class="btn btn--secondary btn--sm" (click)="loadDashboard(); load()">
              <span class="material-symbols-outlined">refresh</span>
              Actualizar
            </button>
          </div>
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Cartera visible</span>
            <strong>{{ total() }}</strong>
            <small>{{ activeTab() === 'cartera' ? 'Facturas y saldos en seguimiento' : 'Clientes agrupados por antigüedad' }}</small>
          </div>
          @if (dashboard()) {
            <div class="hero-mini-grid">
              <div class="hero-mini-card">
                <span class="hero-mini-card__label">Vencidas</span>
                <strong>{{ dashboard()!.summary.clientesEnMora }}</strong>
              </div>
              <div class="hero-mini-card">
                <span class="hero-mini-card__label">Activas</span>
                <strong>{{ dashboard()!.summary.totalInvoices }}</strong>
              </div>
              <div class="hero-mini-card">
                <span class="hero-mini-card__label">Por vencer</span>
                <strong>{{ dashboard()!.summary.totalDueSoon | currency:'COP':'symbol':'1.0-0' }}</strong>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ── Tabs ────────────────────────────────────────────────────── -->
      <div class="tab-shell">
        <div class="ct__tabs">
          <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'cartera'" (click)="activeTab.set('cartera')">
            <span class="material-symbols-outlined">receipt_long</span> Cartera
          </button>
          <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'aging'" (click)="setTab('aging')">
            <span class="material-symbols-outlined">bar_chart</span> Aging
          </button>
          <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'receipts'" (click)="setTab('receipts')">
            <span class="material-symbols-outlined">payments</span> Recaudos
          </button>
          <button class="ct__tab" [class.ct__tab--active]="activeTab() === 'collections'" (click)="setTab('collections')">
            <span class="material-symbols-outlined">support_agent</span> Cobranza
          </button>
        </div>
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
        <div class="ct__filters-shell">
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
          <div class="view-toggle">
            <button [class.active]="viewMode() === 'table'" (click)="viewMode.set('table')" title="Vista tabla">
              <span class="material-symbols-outlined">table_rows</span>
            </button>
            <button [class.active]="viewMode() === 'grid'" (click)="viewMode.set('grid')" title="Vista cuadrícula">
              <span class="material-symbols-outlined">grid_view</span>
            </button>
          </div>
        </div>
        </div>

        <!-- ── Tabla / Grid ────────────────────────────────────────── -->
        @if (viewMode() === 'table') {
        <div class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Seguimiento</p>
              <h3>Facturas en gestión de cobro</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ total() }} registros</span>
              <span class="content-chip content-chip--soft">{{ statusFilter() || 'Todos' }}</span>
            </div>
          </div>
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
        </div>
        } @else {
        <div class="grid-shell-head">
          <div>
            <p class="content-shell__kicker">Seguimiento</p>
            <h3>Facturas en tarjetas de cobro</h3>
          </div>
          <div class="content-shell__meta">
            <span class="content-chip">{{ total() }} registros</span>
            <span class="content-chip content-chip--soft">{{ statusFilter() || 'Todos' }}</span>
          </div>
        </div>
          @if (loading()) {
            <div class="ct__loading ct__loading--grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="ct-card ct-card--skeleton">
                  <div class="sk" style="width:110px;height:18px"></div>
                  <div class="sk" style="width:75%;margin-top:10px"></div>
                  <div class="sk" style="width:55%;margin-top:8px"></div>
                  <div class="sk" style="width:100%;margin-top:14px"></div>
                  <div class="sk" style="width:85%;margin-top:8px"></div>
                </div>
              }
            </div>
          } @else if (invoices().length === 0) {
            <div class="ct__empty ct__empty--grid">
              <span class="material-symbols-outlined">inbox</span>
              <p>No hay facturas en cartera con los filtros seleccionados</p>
            </div>
          } @else {
            <div class="ct-card-grid">
              @for (f of invoices(); track f.id) {
                <article class="ct-card" [class.ct-card--mora]="f.carteraStatus === 'EN_MORA'">
                  <span class="ct-card__status badge" [ngClass]="statusClass(f.carteraStatus)">
                    {{ statusLabel(f.carteraStatus) }}
                  </span>
                  <div class="ct-card__top">
                    <div class="ct-card__avatar">{{ initials(f.customer.name) }}</div>
                    <div class="ct-card__customer">{{ f.customer.name }}</div>
                    <div class="ct-card__doc">
                      <code class="inv-num">{{ f.invoiceNumber }}</code>
                      {{ f.customer.documentNumber }}
                    </div>
                  </div>
                  <div class="ct-card__info">
                    <div class="ct-card__info-row ct-card__info-row--balance">
                      <span class="material-symbols-outlined">account_balance_wallet</span>
                      <span>Saldo {{ f.balance | currency:'COP':'symbol':'1.0-0' }}</span>
                    </div>
                    <div class="ct-card__info-row">
                      <span class="material-symbols-outlined">request_quote</span>
                      <span>Total {{ f.total | currency:'COP':'symbol':'1.0-0' }}</span>
                    </div>
                    <div class="ct-card__info-row">
                      <span class="material-symbols-outlined">calendar_today</span>
                      <span>Emisión {{ f.issueDate | date:'dd/MM/yy' }}</span>
                    </div>
                    <div class="ct-card__info-row" [class.ct-card__info-row--danger]="(f.daysOverdue ?? 0) > 0">
                      <span class="material-symbols-outlined">event_busy</span>
                      <span>Vence {{ f.dueDate ? (f.dueDate | date:'dd/MM/yy') : '—' }}</span>
                    </div>
                  </div>
                  <div class="ct-card__meta">
                    @if (f.paidAmount > 0 && f.status !== 'PAID') {
                      <span class="ct__partial-badge">Parcial</span>
                    } @else {
                      <span class="ct-card__meta-spacer"></span>
                    }
                  </div>
                  @if ((f.daysOverdue ?? 0) > 0) {
                    <div class="ct-card__overdue">+{{ f.daysOverdue }} días de atraso</div>
                  }
                  <div class="ct-card__actions">
                    <button class="btn btn--secondary btn--sm" (click)="verCliente(f.customer.id)">
                      <span class="material-symbols-outlined">person</span>
                      Cliente
                    </button>
                    <button class="btn btn--secondary btn--sm" (click)="verPagos(f)">
                      <span class="material-symbols-outlined">history</span>
                      Pagos
                    </button>
                    @if (canRegisterPayment() && f.status !== 'PAID') {
                      <button class="btn btn--primary btn--sm" (click)="openPago(f)">
                        <span class="material-symbols-outlined">payments</span>
                        Cobrar
                      </button>
                    }
                  </div>
                </article>
              }
            </div>
          }
        }

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
          <div class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Antigüedad</p>
              <h3>Aging por cliente</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">Aging</span>
              <span class="content-chip content-chip--soft">{{ aging()!.rows.length }} clientes</span>
            </div>
          </div>
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
          </div>
        }
      }<!-- /tab aging -->

      @if (activeTab() === 'receipts') {
        <div class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Recaudo</p>
              <h3>Recibos de caja y aplicaciones</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ receiptsTotal() }} recaudos</span>
              @if (canRegisterPayment()) {
                <button class="btn btn--primary btn--sm" (click)="openReceiptModal()">
                  <span class="material-symbols-outlined">add</span>
                  Nuevo recaudo
                </button>
              }
            </div>
          </div>
          <div class="table-wrapper">
            <div class="table-scroll">
              @if (receiptsLoading()) {
                <div class="ct__loading">
                  @for (i of [1,2,3,4]; track i) {
                    <div class="sk-row">
                      <div class="sk" style="width:120px"></div>
                      <div class="sk" style="width:180px"></div>
                      <div class="sk" style="width:90px"></div>
                      <div class="sk" style="width:110px"></div>
                    </div>
                  }
                </div>
              } @else if (receipts().length === 0) {
                <div class="ct__empty">
                  <span class="material-symbols-outlined">payments</span>
                  <p>Aún no hay recaudos registrados</p>
                </div>
              } @else {
                <table class="bf-table">
                  <thead>
                    <tr>
                      <th>Recibo</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Método</th>
                      <th>Total</th>
                      <th>Aplicado</th>
                      <th>Disponible</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (receipt of receipts(); track receipt.id) {
                      <tr>
                        <td>
                          <div class="ct__cliente">
                            <span class="ct__cliente-name">{{ receipt.number }}</span>
                            <span class="ct__cliente-doc">{{ receipt.reference || 'Sin referencia' }}</span>
                          </div>
                        </td>
                        <td>
                          <div class="ct__cliente">
                            <span class="ct__cliente-name">{{ receipt.customer?.name || 'Cliente' }}</span>
                            <span class="ct__cliente-doc">{{ receipt.customer?.documentNumber || '—' }}</span>
                          </div>
                        </td>
                        <td class="td-date">{{ receipt.paymentDate | date:'dd/MM/yy' }}</td>
                        <td>{{ receipt.paymentMethod }}</td>
                        <td class="td-currency td-muted">{{ receipt.amount | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td class="td-currency">{{ receipt.appliedAmount | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td class="td-currency" [class.text-success]="receipt.unappliedAmount > 0">
                          {{ receipt.unappliedAmount | currency:'COP':'symbol':'1.0-0' }}
                        </td>
                        <td>
                          <span class="badge" [ngClass]="receiptStatusClass(receipt.status)">
                            {{ receiptStatusLabel(receipt.status) }}
                          </span>
                        </td>
                        <td>
                          <div class="ct__row-actions">
                            @if (canRegisterPayment() && receipt.unappliedAmount > 0.01) {
                              <button class="btn-icon btn-icon--success" title="Aplicar recaudo" (click)="openApplyReceiptModal(receipt)">
                                <span class="material-symbols-outlined">playlist_add_check</span>
                              </button>
                            }
                            @if (canRegisterPayment() && receipt.status !== 'VOID') {
                              <button class="btn-icon btn-icon--warn" title="Solicitar reversión" (click)="openReceiptReversal(receipt)">
                                <span class="material-symbols-outlined">undo</span>
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
        </div>
      }

      @if (activeTab() === 'collections') {
        @if (collectionWorkbench()) {
          <div class="ct__kpis">
            <div class="ct__kpi ct__kpi--neutral">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">event_upcoming</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ collectionWorkbench()!.summary.openPromises }}</div>
                <div class="ct__kpi-label">Promesas abiertas</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--warn">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">today</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ collectionWorkbench()!.summary.dueTodayPromises }}</div>
                <div class="ct__kpi-label">Promesas vencen hoy</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--danger">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">warning</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ collectionWorkbench()!.summary.brokenPromises }}</div>
                <div class="ct__kpi-label">Promesas incumplidas</div>
              </div>
            </div>
            <div class="ct__kpi ct__kpi--success">
              <div class="ct__kpi-icon"><span class="material-symbols-outlined">task</span></div>
              <div class="ct__kpi-body">
                <div class="ct__kpi-val">{{ collectionWorkbench()!.summary.pendingFollowUps }}</div>
                <div class="ct__kpi-label">Gestiones pendientes</div>
              </div>
            </div>
          </div>

          <div class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Cobranza</p>
                <h3>Bandeja de seguimiento</h3>
              </div>
              <div class="content-shell__meta">
                @if (canRegisterPayment()) {
                  <button class="btn btn--secondary btn--sm" (click)="openAdjustmentModal()">
                    <span class="material-symbols-outlined">rule</span>
                    Nuevo ajuste
                  </button>
                  <button class="btn btn--secondary btn--sm" (click)="openPromiseModal()">
                    <span class="material-symbols-outlined">event_available</span>
                    Nueva promesa
                  </button>
                }
                <button class="btn btn--primary btn--sm" (click)="openFollowUpModal()">
                  <span class="material-symbols-outlined">note_add</span>
                  Nueva gestión
                </button>
              </div>
            </div>
            <div class="table-wrapper">
              <div class="table-scroll">
                <table class="bf-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Factura</th>
                      <th>Monto</th>
                      <th>Fecha promesa</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (promise of collectionWorkbench()!.promises; track promise.id) {
                      <tr>
                        <td>{{ promise.customer?.name || 'Cliente' }}</td>
                        <td>{{ promise.invoiceNumber || 'Global' }}</td>
                        <td class="td-currency">{{ promise.amount | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td class="td-date">{{ promise.promisedDate | date:'dd/MM/yy' }}</td>
                        <td><span class="badge" [ngClass]="promiseStatusClass(promise.status)">{{ promiseStatusLabel(promise.status) }}</span></td>
                        <td>
                          <div class="ct__row-actions">
                            @if (canRegisterPayment() && promise.status === 'OPEN') {
                              <button class="btn-icon btn-icon--success" title="Marcar cumplida" (click)="updatePromiseStatus(promise, 'FULFILLED')">
                                <span class="material-symbols-outlined">check_circle</span>
                              </button>
                              <button class="btn-icon btn-icon--warn" title="Marcar incumplida" (click)="updatePromiseStatus(promise, 'BROKEN')">
                                <span class="material-symbols-outlined">report</span>
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6" class="text-center text-muted">Sin promesas registradas</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Prioridades</p>
                <h3>Facturas y gestiones por atender</h3>
              </div>
            </div>
            <div class="table-wrapper">
              <div class="table-scroll">
                <table class="bf-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Factura</th>
                      <th>Saldo</th>
                      <th>Días vencido</th>
                      <th>Próxima gestión</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (invoice of collectionWorkbench()!.priorityInvoices; track invoice.id) {
                      <tr>
                        <td>{{ invoice.customer.name }}</td>
                        <td><code>{{ invoice.invoiceNumber }}</code></td>
                        <td class="td-currency">{{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td class="td-currency">{{ invoice.daysOverdue && invoice.daysOverdue > 0 ? invoice.daysOverdue : '—' }}</td>
                        <td>{{ nextFollowUpForInvoice(invoice.id) }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="text-center text-muted">Sin facturas priorizadas</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Control financiero</p>
                <h3>Ajustes y aprobaciones</h3>
              </div>
              <div class="content-shell__meta">
                <span class="content-chip">{{ adjustments().length }} ajustes</span>
                <span class="content-chip content-chip--soft">{{ pendingAdjustmentCount() }} pendientes</span>
              </div>
            </div>
            <div class="table-wrapper">
              <div class="table-scroll">
                @if (adjustmentsLoading()) {
                  <div class="ct__loading"><div class="spinner"></div></div>
                } @else {
                  <table class="bf-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Cliente</th>
                        <th>Documento</th>
                        <th>Monto</th>
                        <th>Motivo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (adjustment of adjustments(); track adjustment.id) {
                        <tr>
                          <td>{{ adjustmentTypeLabel(adjustment.type) }}</td>
                          <td>{{ adjustment.customer?.name || 'Cliente' }}</td>
                          <td>{{ adjustment.invoiceNumber || adjustment.receiptNumber || 'Global' }}</td>
                          <td class="td-currency">{{ adjustment.amount | currency:'COP':'symbol':'1.0-0' }}</td>
                          <td>{{ adjustment.reason }}</td>
                          <td><span class="badge" [ngClass]="adjustmentStatusClass(adjustment.status)">{{ adjustmentStatusLabel(adjustment.status) }}</span></td>
                          <td>
                            <div class="ct__row-actions">
                              @if (canApproveAdjustments() && adjustment.status === 'PENDING_APPROVAL') {
                                <button class="btn-icon btn-icon--success" title="Aprobar" (click)="approveAdjustment(adjustment)">
                                  <span class="material-symbols-outlined">approval</span>
                                </button>
                                <button class="btn-icon btn-icon--danger" title="Rechazar" (click)="rejectAdjustment(adjustment)">
                                  <span class="material-symbols-outlined">close</span>
                                </button>
                              }
                            </div>
                          </td>
                        </tr>
                      } @empty {
                        <tr><td colspan="7" class="text-center text-muted">Sin ajustes registrados</td></tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </div>
          </div>

          <div class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Gestiones</p>
                <h3>Seguimiento reciente</h3>
              </div>
            </div>
            <div class="table-wrapper">
              <div class="table-scroll">
                <table class="bf-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Tipo</th>
                      <th>Resultado</th>
                      <th>Próxima acción</th>
                      <th>Fecha próxima</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (followUp of collectionWorkbench()!.followUps; track followUp.id) {
                      <tr>
                        <td>{{ followUp.customer?.name || 'Cliente' }}</td>
                        <td>{{ followUp.activityType }}</td>
                        <td>{{ followUp.outcome }}</td>
                        <td>{{ followUp.nextAction || '—' }}</td>
                        <td class="td-date">{{ followUp.nextActionDate ? (followUp.nextActionDate | date:'dd/MM/yy') : '—' }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="text-center text-muted">Sin gestiones registradas</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        } @else {
          <div class="ct__loading"><div class="spinner"></div></div>
        }
      }

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
              @if (customerReceivables()!.statement) {
                <div class="ct__statement-card">
                  <div class="ct__statement-head">
                    <div>
                      <p class="content-shell__kicker">Estado de cuenta</p>
                      <h4>Movimientos del cliente</h4>
                    </div>
                    <div class="content-shell__meta">
                      <span class="content-chip">Saldo {{ customerReceivables()!.statement.summary.balance | currency:'COP':'symbol':'1.0-0' }}</span>
                      <span class="content-chip content-chip--soft">No aplicado {{ customerReceivables()!.statement.summary.unappliedBalance | currency:'COP':'symbol':'1.0-0' }}</span>
                      @if (customerReceivables()!.statement.summary.creditBalance > 0) {
                        <span class="content-chip content-chip--soft">Saldo a favor {{ customerReceivables()!.statement.summary.creditBalance | currency:'COP':'symbol':'1.0-0' }}</span>
                      }
                    </div>
                  </div>
                  <table class="bf-table bf-table--sm">
                    <thead>
                      <tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Débito</th><th>Crédito</th><th>Saldo</th></tr>
                    </thead>
                    <tbody>
                      @for (movement of customerReceivables()!.statement.movements; track movement.id) {
                        <tr>
                          <td class="td-date">{{ movement.date | date:'dd/MM/yy' }}</td>
                          <td>{{ movement.type }}</td>
                          <td>{{ movement.reference || movement.number }}</td>
                          <td class="td-currency">{{ movement.debit > 0 ? (movement.debit | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                          <td class="td-currency">{{ movement.credit > 0 ? (movement.credit | currency:'COP':'symbol':'1.0-0') : '—' }}</td>
                          <td class="td-currency td-bold">{{ movement.runningBalance | currency:'COP':'symbol':'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
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

    @if (showReceiptModal()) {
      <div class="modal-overlay" (click)="closeReceiptModal()">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo recaudo</h3>
            <button class="modal-close" (click)="closeReceiptModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Cliente *</label>
                <select class="form-control" [(ngModel)]="receiptForm.customerId" (ngModelChange)="onReceiptCustomerChange($event)">
                  <option value="">Seleccionar…</option>
                  @for (customer of receiptCustomers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} · {{ customer.documentNumber }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Fecha *</label>
                <input type="date" class="form-control" [(ngModel)]="receiptForm.paymentDate" [max]="today" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Monto recibido *</label>
                <input type="number" class="form-control" [(ngModel)]="receiptForm.amount" min="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Medio de pago *</label>
                <select class="form-control" [(ngModel)]="receiptForm.paymentMethod">
                  <option value="">Seleccionar…</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="CONSIGNACION">Consignación</option>
                </select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Referencia</label>
                <input type="text" class="form-control" [(ngModel)]="receiptForm.reference" />
              </div>
              <div class="form-group">
                <label class="form-label">Notas</label>
                <input type="text" class="form-control" [(ngModel)]="receiptForm.notes" />
              </div>
            </div>

            @if (receiptPendingInvoices().length > 0) {
              <div class="ct__statement-card" style="margin-top:12px">
                <div class="ct__statement-head">
                  <div>
                    <p class="content-shell__kicker">Aplicación inicial</p>
                    <h4>Facturas pendientes</h4>
                  </div>
                  <div class="content-shell__meta">
                    <span class="content-chip content-chip--soft">Disponible {{ remainingReceiptAmount() | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
                <table class="bf-table bf-table--sm">
                  <thead>
                    <tr><th>Factura</th><th>Vence</th><th>Saldo</th><th>Aplicar</th></tr>
                  </thead>
                  <tbody>
                    @for (invoice of receiptPendingInvoices(); track invoice.id) {
                      <tr>
                        <td><code>{{ invoice.invoiceNumber }}</code></td>
                        <td>{{ invoice.dueDate ? (invoice.dueDate | date:'dd/MM/yy') : '—' }}</td>
                        <td class="td-currency">{{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td style="width:180px">
                          <input
                            type="number"
                            class="form-control"
                            [ngModel]="receiptApplicationAmount(invoice.id)"
                            (ngModelChange)="setReceiptApplication(invoice.id, $event)"
                            min="0"
                            [max]="invoice.balance"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeReceiptModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitReceipt()" [disabled]="saving()">
              <span class="material-symbols-outlined">{{ saving() ? 'hourglass_empty' : 'save' }}</span>
              {{ saving() ? 'Guardando…' : 'Crear recaudo' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showApplyReceiptModal() && selectedReceipt()) {
      <div class="modal-overlay" (click)="closeApplyReceiptModal()">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Aplicar recaudo — {{ selectedReceipt()!.number }}</h3>
            <button class="modal-close" (click)="closeApplyReceiptModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="ct__pay-info">
              <div class="ct__pay-info-row">
                <span>Cliente</span>
                <strong>{{ selectedReceipt()!.customerName }}</strong>
              </div>
              <div class="ct__pay-info-row ct__pay-info-row--highlight">
                <span>Saldo disponible</span>
                <strong>{{ selectedReceipt()!.unappliedAmount | currency:'COP':'symbol':'1.0-0' }}</strong>
              </div>
            </div>

            @if (receiptPendingInvoices().length === 0) {
              <div class="ct__empty" style="padding:24px 0">
                <span class="material-symbols-outlined">task_alt</span>
                <p>No hay facturas pendientes para aplicar este recaudo</p>
              </div>
            } @else {
              <div class="ct__statement-card">
                <div class="ct__statement-head">
                  <div>
                    <p class="content-shell__kicker">Aplicación</p>
                    <h4>Selecciona facturas y montos</h4>
                  </div>
                  <div class="content-shell__meta">
                    <span class="content-chip content-chip--soft">Disponible {{ remainingApplyReceiptAmount() | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
                <table class="bf-table bf-table--sm">
                  <thead>
                    <tr><th>Factura</th><th>Vence</th><th>Saldo</th><th>Aplicar</th></tr>
                  </thead>
                  <tbody>
                    @for (invoice of receiptPendingInvoices(); track invoice.id) {
                      <tr>
                        <td><code>{{ invoice.invoiceNumber }}</code></td>
                        <td>{{ invoice.dueDate ? (invoice.dueDate | date:'dd/MM/yy') : '—' }}</td>
                        <td class="td-currency">{{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</td>
                        <td style="width:180px">
                          <input
                            type="number"
                            class="form-control"
                            [ngModel]="receiptApplicationAmount(invoice.id)"
                            (ngModelChange)="setReceiptApplication(invoice.id, $event)"
                            min="0"
                            [max]="invoice.balance"
                          />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeApplyReceiptModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitApplyReceipt()" [disabled]="saving() || receiptPendingInvoices().length === 0">
              <span class="material-symbols-outlined">{{ saving() ? 'hourglass_empty' : 'playlist_add_check' }}</span>
              {{ saving() ? 'Aplicando…' : 'Aplicar recaudo' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPromiseModal()) {
      <div class="modal-overlay" (click)="closePromiseModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva promesa de pago</h3>
            <button class="modal-close" (click)="closePromiseModal()"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Cliente *</label>
                <select class="form-control" [(ngModel)]="promiseForm.customerId" (ngModelChange)="onCollectionCustomerChange($event)">
                  <option value="">Seleccionar…</option>
                  @for (customer of receiptCustomers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} · {{ customer.documentNumber }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Factura</label>
                <select class="form-control" [(ngModel)]="promiseForm.invoiceId">
                  <option value="">Global del cliente</option>
                  @for (invoice of collectionInvoices(); track invoice.id) {
                    <option [value]="invoice.id">{{ invoice.invoiceNumber }} · {{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Monto *</label>
                <input type="number" class="form-control" [(ngModel)]="promiseForm.amount" min="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha prometida *</label>
                <input type="date" class="form-control" [(ngModel)]="promiseForm.promisedDate" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notas</label>
              <textarea class="form-control" [(ngModel)]="promiseForm.notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closePromiseModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitPromise()" [disabled]="saving()">Guardar promesa</button>
          </div>
        </div>
      </div>
    }

    @if (showFollowUpModal()) {
      <div class="modal-overlay" (click)="closeFollowUpModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva gestión de cobranza</h3>
            <button class="modal-close" (click)="closeFollowUpModal()"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Cliente *</label>
                <select class="form-control" [(ngModel)]="followUpForm.customerId" (ngModelChange)="onCollectionCustomerChange($event)">
                  <option value="">Seleccionar…</option>
                  @for (customer of receiptCustomers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} · {{ customer.documentNumber }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Factura</label>
                <select class="form-control" [(ngModel)]="followUpForm.invoiceId">
                  <option value="">Global del cliente</option>
                  @for (invoice of collectionInvoices(); track invoice.id) {
                    <option [value]="invoice.id">{{ invoice.invoiceNumber }} · {{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Tipo *</label>
                <select class="form-control" [(ngModel)]="followUpForm.activityType">
                  <option value="">Seleccionar…</option>
                  <option value="CALL">Llamada</option>
                  <option value="EMAIL">Correo</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="VISIT">Visita</option>
                  <option value="NOTE">Nota interna</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Próxima fecha</label>
                <input type="date" class="form-control" [(ngModel)]="followUpForm.nextActionDate" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Resultado *</label>
              <textarea class="form-control" [(ngModel)]="followUpForm.outcome" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Próxima acción</label>
              <input type="text" class="form-control" [(ngModel)]="followUpForm.nextAction" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeFollowUpModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitFollowUp()" [disabled]="saving()">Guardar gestión</button>
          </div>
        </div>
      </div>
    }

    @if (showAdjustmentModal()) {
      <div class="modal-overlay" (click)="closeAdjustmentModal()">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo ajuste de cartera</h3>
            <button class="modal-close" (click)="closeAdjustmentModal()"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Tipo *</label>
                <select class="form-control" [(ngModel)]="adjustmentForm.type" (ngModelChange)="onAdjustmentTypeChange($event)">
                  <option value="">Seleccionar…</option>
                  <option value="CREDIT_NOTE">Nota crédito</option>
                  <option value="DEBIT_NOTE">Nota débito</option>
                  <option value="WRITE_OFF">Castigo</option>
                  <option value="PROVISION">Provisión</option>
                  <option value="RECOVERY">Recuperación</option>
                  <option value="RECEIPT_REVERSAL">Reversión de recaudo</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Cliente *</label>
                <select class="form-control" [(ngModel)]="adjustmentForm.customerId" (ngModelChange)="onAdjustmentCustomerChange($event)">
                  <option value="">Seleccionar…</option>
                  @for (customer of receiptCustomers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} · {{ customer.documentNumber }}</option>
                  }
                </select>
              </div>
            </div>

            @if (adjustmentForm.type && adjustmentForm.type !== 'RECEIPT_REVERSAL') {
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Factura *</label>
                  <select class="form-control" [(ngModel)]="adjustmentForm.invoiceId">
                    <option value="">Seleccionar…</option>
                    @for (invoice of collectionInvoices(); track invoice.id) {
                      <option [value]="invoice.id">{{ invoice.invoiceNumber }} · {{ invoice.balance | currency:'COP':'symbol':'1.0-0' }}</option>
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Documento origen</label>
                  <select class="form-control" [(ngModel)]="adjustmentForm.sourceInvoiceId">
                    <option value="">Sin documento origen</option>
                    @for (invoice of collectionInvoices(); track invoice.id) {
                      <option [value]="invoice.id">{{ invoice.invoiceNumber }}</option>
                    }
                  </select>
                </div>
              </div>
            }

            @if (adjustmentForm.type === 'RECEIPT_REVERSAL') {
              <div class="form-group">
                <label class="form-label">Recaudo a reversar *</label>
                <select class="form-control" [(ngModel)]="adjustmentForm.receiptId" (ngModelChange)="syncAdjustmentReceipt($event)">
                  <option value="">Seleccionar…</option>
                  @for (receipt of adjustmentReceipts(); track receipt.id) {
                    <option [value]="receipt.id">{{ receipt.number }} · {{ receipt.amount | currency:'COP':'symbol':'1.0-0' }}</option>
                  }
                </select>
              </div>
            }

            @if (selectedAdjustmentReceipt()) {
              <div class="ct__pay-info" style="margin-bottom:12px">
                <div class="ct__pay-info-row">
                  <span>Recaudo</span>
                  <strong>{{ selectedAdjustmentReceipt()!.number }}</strong>
                </div>
                <div class="ct__pay-info-row">
                  <span>Cliente</span>
                  <strong>{{ selectedAdjustmentReceipt()!.customer?.name || 'Cliente' }}</strong>
                </div>
                <div class="ct__pay-info-row ct__pay-info-row--highlight">
                  <span>Monto</span>
                  <strong>{{ selectedAdjustmentReceipt()!.amount | currency:'COP':'symbol':'1.0-0' }}</strong>
                </div>
              </div>
            }

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Monto *</label>
                <input type="number" class="form-control" [(ngModel)]="adjustmentForm.amount" min="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Motivo *</label>
                <input type="text" class="form-control" [(ngModel)]="adjustmentForm.reason" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notas</label>
              <textarea class="form-control" [(ngModel)]="adjustmentForm.notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeAdjustmentModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitAdjustment()" [disabled]="saving()">Enviar a aprobación</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .ct { max-width: 1280px; padding-bottom:24px; }

    /* Hero */
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .65fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.16), transparent 26%),
        radial-gradient(circle at bottom right, rgba(59,130,246,.16), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0f7a72 100%);
      box-shadow:0 24px 48px rgba(12,28,53,.16);
      color:#fff;
    }
    .hero-copy { max-width:620px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#89f3d1;
    }
    .hero-aside { display:grid; gap:12px; align-content:start; }
    .hero-highlight {
      padding:18px;
      border-radius:20px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.16);
      backdrop-filter:blur(10px);
    }
    .hero-highlight-label {
      display:block;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#a7f3d0;
      margin-bottom:8px;
    }
    .hero-highlight strong {
      display:block;
      font-family:'Sora',sans-serif;
      font-size:40px;
      line-height:1;
      letter-spacing:-.06em;
      margin-bottom:8px;
    }
    .hero-highlight small {
      display:block;
      font-size:12px;
      line-height:1.5;
      color:rgba(236,244,255,.72);
    }
    .hero-mini-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:10px;
    }
    .hero-mini-card {
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.12);
    }
    .hero-mini-card__label {
      display:block;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:rgba(236,244,255,.72);
      margin-bottom:5px;
    }
    .hero-mini-card strong {
      font-family:'Sora',sans-serif;
      font-size:18px;
      color:#fff;
      letter-spacing:-.04em;
    }

    /* Tabs */
    .tab-shell {
      margin-bottom:18px;
      padding:8px;
      border-radius:20px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 12px 26px rgba(12,28,53,.05);
    }
    .ct__tabs { display:flex; gap:6px; }
    .ct__tab { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; font-size:13.5px; font-weight:600; color:#64748b; background:none; border:none; border-bottom:2px solid transparent; margin-bottom:-2px; cursor:pointer; transition:all .15s; border-radius:6px 6px 0 0; }
    .ct__tab .material-symbols-outlined { font-size:17px; }
    .ct__tab:hover { color:#1a407e; background:#f0f4f9; }
    .ct__tab--active { color:#1a407e; border-bottom-color:#1a407e; background:#eff6ff; box-shadow:inset 0 0 0 1px #bfdbfe; }

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
    .ct__filters-shell {
      margin-bottom:16px;
      padding:16px;
      border-radius:22px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 12px 28px rgba(12,28,53,.05);
    }
    .ct__filters { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:0; }
    .ct__filter-chips { display:flex; gap:6px; flex-wrap:wrap; }
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-left:auto; flex-shrink:0; background:#fff; box-shadow:0 8px 18px rgba(12,28,53,.03); }
    .view-toggle button { padding:9px 11px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; display:flex; align-items:center; justify-content:center; }
    .view-toggle button:hover { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }
    .view-toggle .material-symbols-outlined { font-size:18px; }
    .chip { padding:5px 12px; border-radius:99px; border:1px solid #dce6f0; background:#f8fafc; font-size:12.5px; font-weight:500; color:#64748b; cursor:pointer; transition:all .15s; }
    .chip:hover { border-color:#1a407e; color:#1a407e; }
    .chip--active { background:#1a407e; border-color:#1a407e; color:#fff; }

    /* Content shell */
    .content-shell {
      border-radius:24px;
      background:rgba(255,255,255,.78);
      border:1px solid #dce6f0;
      box-shadow:0 16px 32px rgba(12,28,53,.05);
      overflow:hidden;
      margin-bottom:12px;
    }
    .content-shell__head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      padding:18px 20px 16px;
      border-bottom:1px solid #e9eef5;
      background:
        radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 24%),
        linear-gradient(180deg, #fbfdff 0%, #f6faff 100%);
    }
    .content-shell__kicker {
      margin:0 0 5px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .content-shell__head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .content-shell__meta {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      align-items:center;
    }
    .ct__statement-card {
      margin: 14px 0 16px;
      border: 1px solid #dce6f0;
      border-radius: 18px;
      overflow: hidden;
      background: #f8fbff;
    }
    .ct__statement-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      padding:14px 16px;
      border-bottom:1px solid #e2e8f0;
      background:linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(242,247,255,.96) 100%);
    }
    .ct__statement-head h4 {
      margin:0;
      font-size:15px;
      color:#0c1c35;
      font-family:'Sora',sans-serif;
      letter-spacing:-.03em;
    }
    .grid-shell-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      margin-bottom:14px;
      padding:0 4px;
    }
    .grid-shell-head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .content-chip {
      padding:7px 11px;
      border-radius:999px;
      background:#0f274b;
      color:#fff;
      font-size:11px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .content-chip--soft {
      background:#edf5ff;
      color:#1a407e;
      border:1px solid #bfdbfe;
    }

    /* Table */
    .table-wrapper { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; margin-bottom:12px; box-shadow:0 16px 28px rgba(12,28,53,.05); }
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
    .ct__loading--grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));
      gap:16px;
      padding:18px;
    }
    .sk-row { display:flex; gap:12px; align-items:center; }
    .sk { height:14px; border-radius:6px; background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
    .ct-card-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));
      gap:16px;
      padding:18px;
    }
    .ct-card {
      display:flex;
      flex-direction:column;
      gap:0;
      padding:18px 16px 14px;
      position:relative;
      border-radius:20px;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 12px 26px rgba(12,28,53,.04);
      transition:box-shadow .16s, border-color .16s, transform .16s;
    }
    .ct-card:hover {
      border-color:#93c5fd;
      box-shadow:0 18px 32px rgba(26,64,126,.1);
      transform:translateY(-3px);
    }
    .ct-card--mora { border-color:#fecaca; background:linear-gradient(180deg, #ffffff 0%, #fff8f8 100%); }
    .ct-card--skeleton { pointer-events:none; }
    .ct-card__status { position:absolute; top:12px; right:12px; }
    .ct-card__top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 0 12px; }
    .ct-card__avatar {
      width:52px;
      height:52px;
      border-radius:12px;
      background:linear-gradient(135deg,#1a407e,#00c6a0);
      color:#fff;
      font-size:16px;
      font-weight:700;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:'Sora',sans-serif;
      margin-bottom:10px;
    }
    .ct-card__customer { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:4px; }
    .ct-card__doc { font-size:11.5px; color:#9ca3af; display:flex; align-items:center; gap:5px; justify-content:center; flex-wrap:wrap; }
    .ct-card__info { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px; display:flex; flex-direction:column; gap:5px; flex:1; }
    .ct-card__info-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; }
    .ct-card__info-row .material-symbols-outlined { font-size:14px; color:#94a3b8; flex-shrink:0; }
    .ct-card__info-row span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ct-card__info-row--balance { color:#0c1c35; font-weight:700; }
    .ct-card__info-row--balance .material-symbols-outlined { color:#1a407e; }
    .ct-card__info-row--danger { color:#dc2626; }
    .ct-card__info-row--danger .material-symbols-outlined { color:#ef4444; }
    .ct-card__meta { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; color:#64748b; margin-bottom:10px; }
    .ct-card__meta-spacer { display:block; min-height:18px; }
    .ct-card__overdue {
      padding:8px 10px;
      border-radius:10px;
      background:#fff1f2;
      border:1px solid #fecdd3;
      font-size:12px;
      font-weight:700;
      color:#be123c;
      margin-bottom:10px;
    }
    .ct-card__actions {
      display:flex;
      gap:6px;
      align-items:center;
      padding-top:10px;
      border-top:1px solid #f0f4f8;
    }
    .ct-card__actions .btn { flex:1; justify-content:center; }
    .ct__empty--grid { padding:48px 24px; }

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
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .page-header__title { font-family:'Sora',sans-serif; font-size:32px; line-height:1.02; font-weight:800; color:#fff; margin:0 0 10px; letter-spacing:-.05em; }
    .page-header__sub { font-size:14px; color:rgba(236,244,255,.8); margin:0; line-height:1.6; }
    .page-header__actions { display:flex; gap:8px; }
    .card { background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .card--sm { padding:12px 16px; }
    .card--flat { box-shadow:none; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid #dce6f0; border-radius:8px; padding:7px 11px; background:#fff; }
    .search-box__icon { font-size:16px; color:#94a3b8; }
    .search-box__input { border:none; outline:none; font-size:13.5px; color:#0c1c35; width:100%; background:transparent; }

    @media (max-width:1100px) { .ct__aging-summary { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:900px) {
      .hero-shell { grid-template-columns:1fr; }
      .hero-mini-grid,
      .ct__kpis { grid-template-columns:repeat(2,1fr); }
    }
    @media (max-width:640px) {
      .hero-shell { padding:16px; gap:14px; }
      .page-header__title { font-size:26px; }
      .hero-mini-grid,
      .ct__kpis { grid-template-columns:1fr; }
      .content-shell__head { flex-direction:column; align-items:flex-start; }
      .grid-shell-head { flex-direction:column; align-items:flex-start; padding:0; }
      .ct__kpis { grid-template-columns:1fr; }
      .ct__filters { flex-direction:column; align-items:stretch; }
      .view-toggle { margin-left:0; }
      .ct__cliente-kpis { grid-template-columns:repeat(2,1fr); }
      .ct__aging-summary { grid-template-columns:repeat(2,1fr); }
      .ct__ph-summary { flex-direction:column; }
      .ct__ph-item { border-right:none; border-bottom:1px solid #f0f4f8; }
      .ct-card-grid,
      .ct__loading--grid { grid-template-columns:1fr; padding:14px; }
      .ct-card__dates { grid-template-columns:1fr; }
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
  private readonly customersApi = `${environment.apiUrl}/customers`;
  readonly today = new Date().toISOString().split('T')[0];

  // ── State ────────────────────────────────────────────────────────────────

  invoices      = signal<ReceivableInvoice[]>([]);
  dashboard     = signal<any | null>(null);
  aging         = signal<{ rows: AgingRow[]; totals: any } | null>(null);
  receipts      = signal<ReceiptRecord[]>([]);
  collectionWorkbench = signal<CollectionWorkbench | null>(null);
  adjustments   = signal<AdjustmentRecord[]>([]);
  loading       = signal(true);
  agingLoading  = signal(false);
  receiptsLoading = signal(false);
  adjustmentsLoading = signal(false);
  saving        = signal(false);
  total         = signal(0);
  receiptsTotal = signal(0);
  page          = signal(1);
  search        = '';
  statusFilter  = signal('');
  activeTab     = signal<'cartera' | 'aging' | 'receipts' | 'collections'>('cartera');
  viewMode      = signal<'table' | 'grid'>('table');

  showCustomerModal      = signal(false);
  customerReceivables    = signal<any>(null);

  showPaymentHistoryModal = signal(false);
  paymentHistory          = signal<any>(null);

  showPaymentModal  = signal(false);
  paymentInvoice    = signal<ReceivableInvoice | null>(null);
  showReceiptModal  = signal(false);
  showApplyReceiptModal = signal(false);
  showPromiseModal = signal(false);
  showFollowUpModal = signal(false);
  showAdjustmentModal = signal(false);
  selectedReceipt = signal<ReceiptApplicationModalState | null>(null);
  receiptCustomers  = signal<CustomerLite[]>([]);
  receiptPendingInvoices = signal<ReceivableInvoice[]>([]);
  receiptApplications = signal<ReceiptApplicationForm[]>([]);
  collectionInvoices = signal<ReceivableInvoice[]>([]);
  selectedAdjustmentReceipt = signal<ReceiptRecord | null>(null);

  paymentForm: PaymentForm = {
    amount: 0,
    paymentDate: this.today,
    paymentMethod: '',
    reference: '',
    notes: '',
  };

  receiptForm: ReceiptForm = {
    customerId: '',
    amount: 0,
    paymentDate: this.today,
    paymentMethod: '',
    reference: '',
    notes: '',
  };

  promiseForm: PromiseForm = {
    customerId: '',
    invoiceId: '',
    amount: 0,
    promisedDate: this.today,
    notes: '',
  };

  followUpForm: FollowUpForm = {
    customerId: '',
    invoiceId: '',
    activityType: '',
    outcome: '',
    nextActionDate: '',
    nextAction: '',
  };

  adjustmentForm: AdjustmentForm = {
    type: '',
    customerId: '',
    invoiceId: '',
    receiptId: '',
    sourceInvoiceId: '',
    amount: 0,
    reason: '',
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
  canApproveAdjustments = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER') || roles.includes('CONTADOR');
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
    this.loadReceiptCustomers();
  }

  // ── Tab switching ────────────────────────────────────────────────────────

  setTab(tab: 'cartera' | 'aging' | 'receipts' | 'collections') {
    this.activeTab.set(tab);
    if (tab === 'aging' && !this.aging()) this.loadAging();
    if (tab === 'receipts' && this.receipts().length === 0) this.loadReceipts();
    if (tab === 'collections') {
      if (!this.collectionWorkbench()) this.loadCollectionWorkbench();
      if (this.adjustments().length === 0) this.loadAdjustments();
    }
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

  loadReceipts() {
    this.receiptsLoading.set(true);
    this.http.get<any>(`${this.api}/receipts`, { params: { page: 1, limit: 50 } }).subscribe({
      next: (response) => {
        const res = response.data ?? response;
        this.receipts.set(res.data ?? []);
        this.receiptsTotal.set(res.total ?? (res.data ?? []).length ?? 0);
        this.receiptsLoading.set(false);
      },
      error: () => {
        this.receiptsLoading.set(false);
        this.notify.error('Error al cargar recaudos');
      },
    });
  }

  loadCollectionWorkbench() {
    this.http.get<any>(`${this.api}/workbench`).subscribe({
      next: (response) => this.collectionWorkbench.set((response.data ?? response) as CollectionWorkbench),
      error: () => this.notify.error('Error al cargar la bandeja de cobranza'),
    });
  }

  loadAdjustments() {
    this.adjustmentsLoading.set(true);
    this.http.get<any>(`${this.api}/adjustments`).subscribe({
      next: (response) => {
        this.adjustments.set((response.data ?? response) as AdjustmentRecord[]);
        this.adjustmentsLoading.set(false);
      },
      error: () => {
        this.adjustmentsLoading.set(false);
        this.notify.error('Error al cargar ajustes de cartera');
      },
    });
  }

  loadReceiptCustomers() {
    this.http.get<any>(this.customersApi, { params: { page: 1, limit: 200 } }).subscribe({
      next: (response) => {
        const res = response.data ?? response;
        const rows = res.data ?? res ?? [];
        this.receiptCustomers.set(rows.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          documentNumber: customer.documentNumber,
        })));
      },
      error: () => {},
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
    if (this.showFollowUpModal()) { this.closeFollowUpModal(); return; }
    if (this.showAdjustmentModal()) { this.closeAdjustmentModal(); return; }
    if (this.showPromiseModal()) { this.closePromiseModal(); return; }
    if (this.showApplyReceiptModal()) { this.closeApplyReceiptModal(); return; }
    if (this.showReceiptModal()) { this.closeReceiptModal(); return; }
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
        if (this.activeTab() === 'receipts' || this.receipts().length > 0) this.loadReceipts();
        if (this.aging()) this.loadAging(); // refresh aging if already loaded
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al registrar pago'); },
    });
  }

  openReceiptModal() {
    this.receiptForm = {
      customerId: '',
      amount: 0,
      paymentDate: this.today,
      paymentMethod: '',
      reference: '',
      notes: '',
    };
    this.receiptApplications.set([]);
    this.receiptPendingInvoices.set([]);
    this.showReceiptModal.set(true);
  }

  closeReceiptModal() {
    this.showReceiptModal.set(false);
  }

  openPromiseModal() {
    this.promiseForm = { customerId: '', invoiceId: '', amount: 0, promisedDate: this.today, notes: '' };
    this.collectionInvoices.set([]);
    this.showPromiseModal.set(true);
  }

  closePromiseModal() {
    this.showPromiseModal.set(false);
  }

  openFollowUpModal() {
    this.followUpForm = { customerId: '', invoiceId: '', activityType: '', outcome: '', nextActionDate: '', nextAction: '' };
    this.collectionInvoices.set([]);
    this.showFollowUpModal.set(true);
  }

  closeFollowUpModal() {
    this.showFollowUpModal.set(false);
  }

  openAdjustmentModal(prefill?: Partial<AdjustmentForm>) {
    if (this.receipts().length === 0) this.loadReceipts();
    this.adjustmentForm = {
      type: '',
      customerId: '',
      invoiceId: '',
      receiptId: '',
      sourceInvoiceId: '',
      amount: 0,
      reason: '',
      notes: '',
      ...prefill,
    };
    this.selectedAdjustmentReceipt.set(null);
    if (this.adjustmentForm.customerId) {
      this.onAdjustmentCustomerChange(this.adjustmentForm.customerId);
    } else {
      this.collectionInvoices.set([]);
    }
    if (this.adjustmentForm.receiptId) {
      this.syncAdjustmentReceipt(this.adjustmentForm.receiptId);
    }
    this.showAdjustmentModal.set(true);
  }

  openReceiptReversal(receipt: ReceiptRecord) {
    this.openAdjustmentModal({
      type: 'RECEIPT_REVERSAL',
      customerId: receipt.customerId,
      receiptId: receipt.id,
      amount: receipt.amount,
      reason: `Reversión controlada del recaudo ${receipt.number}`,
    });
  }

  closeAdjustmentModal() {
    this.showAdjustmentModal.set(false);
    this.selectedAdjustmentReceipt.set(null);
  }

  openApplyReceiptModal(receipt: ReceiptRecord) {
    this.selectedReceipt.set({
      id: receipt.id,
      number: receipt.number,
      customerId: receipt.customerId,
      customerName: receipt.customer?.name || 'Cliente',
      unappliedAmount: receipt.unappliedAmount,
    });
    this.receiptApplications.set([]);
    this.showApplyReceiptModal.set(true);
    this.onReceiptCustomerChange(receipt.customerId);
  }

  closeApplyReceiptModal() {
    this.showApplyReceiptModal.set(false);
    this.selectedReceipt.set(null);
    this.receiptApplications.set([]);
    this.receiptPendingInvoices.set([]);
  }

  onReceiptCustomerChange(customerId: string) {
    this.receiptApplications.set([]);
    if (!customerId) {
      this.receiptPendingInvoices.set([]);
      return;
    }

    this.http.get<any>(this.api, { params: { customerId, page: 1, limit: 100 } }).subscribe({
      next: (response) => {
        const res = response.data ?? response;
        const rows: ReceivableInvoice[] = res.data ?? [];
        this.receiptPendingInvoices.set(rows.filter((invoice) => invoice.balance > 0.01 && invoice.status !== 'PAID'));
      },
      error: () => {
        this.receiptPendingInvoices.set([]);
        this.notify.error('Error al cargar facturas del cliente');
      },
    });
  }

  onCollectionCustomerChange(customerId: string) {
    this.collectionInvoices.set([]);
    if (!customerId) return;
    this.http.get<any>(this.api, { params: { customerId, page: 1, limit: 100 } }).subscribe({
      next: (response) => {
        const res = response.data ?? response;
        const rows: ReceivableInvoice[] = res.data ?? [];
        this.collectionInvoices.set(rows.filter((invoice) => invoice.balance > 0.01 && invoice.status !== 'PAID'));
      },
      error: () => this.notify.error('Error al cargar facturas del cliente'),
    });
  }

  onAdjustmentCustomerChange(customerId: string) {
    this.adjustmentForm.customerId = customerId;
    this.adjustmentForm.invoiceId = '';
    this.adjustmentForm.sourceInvoiceId = '';
    this.adjustmentForm.receiptId = '';
    this.selectedAdjustmentReceipt.set(null);
    this.onCollectionCustomerChange(customerId);
  }

  onAdjustmentTypeChange(type: AdjustmentForm['type']) {
    this.adjustmentForm.type = type;
    this.adjustmentForm.invoiceId = '';
    this.adjustmentForm.sourceInvoiceId = '';
    this.adjustmentForm.receiptId = '';
    this.selectedAdjustmentReceipt.set(null);
    if (type !== 'RECEIPT_REVERSAL' && this.adjustmentForm.amount < 0) {
      this.adjustmentForm.amount = 0;
    }
  }

  syncAdjustmentReceipt(receiptId: string) {
    this.adjustmentForm.receiptId = receiptId;
    const receipt = this.receipts().find((item) => item.id === receiptId) ?? null;
    this.selectedAdjustmentReceipt.set(receipt);
    if (receipt) {
      this.adjustmentForm.amount = receipt.amount;
      this.adjustmentForm.customerId = receipt.customerId;
      this.onCollectionCustomerChange(receipt.customerId);
    }
  }

  setReceiptApplication(invoiceId: string, value: any) {
    const amount = Math.max(0, Number(value) || 0);
    const invoice = this.receiptPendingInvoices().find((item) => item.id === invoiceId);
    const safeAmount = invoice ? Math.min(amount, invoice.balance) : amount;
    const next = this.receiptApplications().filter((item) => item.invoiceId !== invoiceId);
    if (safeAmount > 0) next.push({ invoiceId, amount: safeAmount });
    this.receiptApplications.set(next);
  }

  receiptApplicationAmount(invoiceId: string) {
    return this.receiptApplications().find((item) => item.invoiceId === invoiceId)?.amount ?? 0;
  }

  remainingReceiptAmount() {
    const applied = this.receiptApplications().reduce((sum, item) => sum + item.amount, 0);
    return Math.max(0, (Number(this.receiptForm.amount) || 0) - applied);
  }

  remainingApplyReceiptAmount() {
    const selected = this.selectedReceipt();
    if (!selected) return 0;
    const applied = this.receiptApplications().reduce((sum, item) => sum + item.amount, 0);
    return Math.max(0, selected.unappliedAmount - applied);
  }

  submitReceipt() {
    if (!this.receiptForm.customerId) { this.notify.error('Selecciona el cliente'); return; }
    if (!this.receiptForm.paymentMethod) { this.notify.error('Selecciona el medio de pago'); return; }
    if (!this.receiptForm.paymentDate) { this.notify.error('Ingresa la fecha'); return; }
    if (!this.receiptForm.amount || this.receiptForm.amount <= 0) { this.notify.error('Ingresa un monto válido'); return; }

    const applications = this.receiptApplications()
      .filter((item) => item.amount > 0)
      .map((item) => ({ invoiceId: item.invoiceId, amount: item.amount }));
    const applied = applications.reduce((sum, item) => sum + item.amount, 0);
    if (applied > this.receiptForm.amount + 0.01) {
      this.notify.error('El total aplicado supera el monto recibido');
      return;
    }

    const payload = {
      ...this.receiptForm,
      applications,
    };

    this.saving.set(true);
    this.http.post<any>(`${this.api}/receipts`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeReceiptModal();
        this.notify.success('Recaudo creado correctamente');
        this.loadReceipts();
        this.loadDashboard();
        this.load();
        if (this.aging()) this.loadAging();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al crear recaudo');
      },
    });
  }

  submitApplyReceipt() {
    const selected = this.selectedReceipt();
    if (!selected) return;

    const applications = this.receiptApplications()
      .filter((item) => item.amount > 0)
      .map((item) => ({ invoiceId: item.invoiceId, amount: item.amount }));
    if (applications.length === 0) {
      this.notify.error('Ingresa al menos una aplicación');
      return;
    }

    const totalApplied = applications.reduce((sum, item) => sum + item.amount, 0);
    if (totalApplied > selected.unappliedAmount + 0.01) {
      this.notify.error('El total aplicado supera el saldo disponible del recaudo');
      return;
    }

    this.saving.set(true);
    this.http.post<any>(`${this.api}/receipts/${selected.id}/applications`, { applications }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeApplyReceiptModal();
        this.notify.success('Recaudo aplicado correctamente');
        this.loadReceipts();
        this.loadDashboard();
        this.load();
        if (this.aging()) this.loadAging();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al aplicar recaudo');
      },
    });
  }

  submitPromise() {
    if (!this.promiseForm.customerId) { this.notify.error('Selecciona el cliente'); return; }
    if (!this.promiseForm.amount || this.promiseForm.amount <= 0) { this.notify.error('Ingresa un monto válido'); return; }
    if (!this.promiseForm.promisedDate) { this.notify.error('Ingresa la fecha prometida'); return; }
    const payload = {
      customerId: this.promiseForm.customerId,
      invoiceId: this.promiseForm.invoiceId || undefined,
      amount: this.promiseForm.amount,
      promisedDate: this.promiseForm.promisedDate,
      notes: this.promiseForm.notes || undefined,
    };
    this.saving.set(true);
    this.http.post<any>(`${this.api}/promises`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePromiseModal();
        this.notify.success('Promesa de pago registrada');
        this.loadCollectionWorkbench();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al registrar promesa');
      },
    });
  }

  submitFollowUp() {
    if (!this.followUpForm.customerId) { this.notify.error('Selecciona el cliente'); return; }
    if (!this.followUpForm.activityType) { this.notify.error('Selecciona el tipo de gestión'); return; }
    if (!this.followUpForm.outcome.trim()) { this.notify.error('Ingresa el resultado de la gestión'); return; }
    const payload = {
      customerId: this.followUpForm.customerId,
      invoiceId: this.followUpForm.invoiceId || undefined,
      activityType: this.followUpForm.activityType,
      outcome: this.followUpForm.outcome,
      nextActionDate: this.followUpForm.nextActionDate || undefined,
      nextAction: this.followUpForm.nextAction || undefined,
    };
    this.saving.set(true);
    this.http.post<any>(`${this.api}/follow-ups`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeFollowUpModal();
        this.notify.success('Gestión registrada');
        this.loadCollectionWorkbench();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al registrar gestión');
      },
    });
  }

  submitAdjustment() {
    if (!this.adjustmentForm.type) { this.notify.error('Selecciona el tipo de ajuste'); return; }
    if (!this.adjustmentForm.customerId) { this.notify.error('Selecciona el cliente'); return; }
    if (['CREDIT_NOTE', 'DEBIT_NOTE', 'WRITE_OFF', 'PROVISION', 'RECOVERY'].includes(this.adjustmentForm.type) && !this.adjustmentForm.invoiceId) {
      this.notify.error('Selecciona la factura del ajuste');
      return;
    }
    if (this.adjustmentForm.type === 'RECEIPT_REVERSAL' && !this.adjustmentForm.receiptId) {
      this.notify.error('Selecciona el recaudo a reversar');
      return;
    }
    if (!this.adjustmentForm.amount || this.adjustmentForm.amount <= 0) { this.notify.error('Ingresa un monto válido'); return; }
    if (!this.adjustmentForm.reason.trim()) { this.notify.error('Ingresa el motivo del ajuste'); return; }

    const payload = {
      type: this.adjustmentForm.type,
      customerId: this.adjustmentForm.customerId,
      invoiceId: this.adjustmentForm.invoiceId || undefined,
      receiptId: this.adjustmentForm.receiptId || undefined,
      sourceInvoiceId: this.adjustmentForm.sourceInvoiceId || undefined,
      amount: this.adjustmentForm.amount,
      reason: this.adjustmentForm.reason,
      notes: this.adjustmentForm.notes || undefined,
    };

    this.saving.set(true);
    this.http.post<any>(`${this.api}/adjustments`, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdjustmentModal();
        this.notify.success('Ajuste enviado a aprobación');
        this.loadAdjustments();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al registrar ajuste');
      },
    });
  }

  approveAdjustment(adjustment: AdjustmentRecord) {
    if (!globalThis.confirm?.(`¿Aplicar el ajuste ${this.adjustmentTypeLabel(adjustment.type)} por ${adjustment.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}?`)) {
      return;
    }
    this.http.patch<any>(`${this.api}/adjustments/${adjustment.id}/approve`, {}).subscribe({
      next: () => {
        this.notify.success('Ajuste aprobado y aplicado');
        this.loadAdjustments();
        this.loadCollectionWorkbench();
        this.loadDashboard();
        this.load();
        this.loadReceipts();
        if (this.aging()) this.loadAging();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al aprobar ajuste'),
    });
  }

  rejectAdjustment(adjustment: AdjustmentRecord) {
    const reason = globalThis.prompt?.('Motivo del rechazo (opcional):', adjustment.rejectedReason ?? '') ?? '';
    this.http.patch<any>(`${this.api}/adjustments/${adjustment.id}/reject`, { reason }).subscribe({
      next: () => {
        this.notify.success('Ajuste rechazado');
        this.loadAdjustments();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al rechazar ajuste'),
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

  receiptStatusClass(status: string) {
    return {
      'badge--success': status === 'APPLIED',
      'badge--warn': status === 'PARTIALLY_APPLIED',
      'badge--muted': status === 'OPEN',
      'badge--danger': status === 'VOID',
    };
  }

  receiptStatusLabel(status: string) {
    const map: Record<string, string> = {
      OPEN: 'Disponible',
      PARTIALLY_APPLIED: 'Parcial',
      APPLIED: 'Aplicado',
      VOID: 'Anulado',
    };
    return map[status] ?? status;
  }

  promiseStatusClass(status: string) {
    return {
      'badge--muted': status === 'OPEN',
      'badge--success': status === 'FULFILLED',
      'badge--danger': status === 'BROKEN',
      'badge--warn': status === 'CANCELLED',
    };
  }

  promiseStatusLabel(status: string) {
    const map: Record<string, string> = {
      OPEN: 'Abierta',
      FULFILLED: 'Cumplida',
      BROKEN: 'Incumplida',
      CANCELLED: 'Cancelada',
    };
    return map[status] ?? status;
  }

  adjustmentStatusClass(status: string) {
    return {
      'badge--muted': status === 'PENDING_APPROVAL',
      'badge--success': status === 'APPLIED',
      'badge--danger': status === 'REJECTED',
    };
  }

  adjustmentStatusLabel(status: string) {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'Pendiente',
      APPLIED: 'Aplicado',
      REJECTED: 'Rechazado',
    };
    return map[status] ?? status;
  }

  adjustmentTypeLabel(type: string) {
    const map: Record<string, string> = {
      CREDIT_NOTE: 'Nota crédito',
      DEBIT_NOTE: 'Nota débito',
      WRITE_OFF: 'Castigo',
      PROVISION: 'Provisión',
      RECOVERY: 'Recuperación',
      RECEIPT_REVERSAL: 'Reversión recaudo',
    };
    return map[type] ?? type;
  }

  adjustmentReceipts() {
    return this.receipts().filter((receipt) =>
      receipt.status !== 'VOID'
      && (!this.adjustmentForm.customerId || receipt.customerId === this.adjustmentForm.customerId),
    );
  }

  pendingAdjustmentCount() {
    return this.adjustments().filter((item) => item.status === 'PENDING_APPROVAL').length;
  }

  updatePromiseStatus(promise: PromiseRecord, status: 'FULFILLED' | 'BROKEN' | 'CANCELLED') {
    this.http.patch<any>(`${this.api}/promises/${promise.id}/status`, { status }).subscribe({
      next: () => {
        this.notify.success('Estado de promesa actualizado');
        this.loadCollectionWorkbench();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al actualizar promesa'),
    });
  }

  nextFollowUpForInvoice(invoiceId: string) {
    const workbench = this.collectionWorkbench();
    if (!workbench) return '—';
    const followUp = workbench.followUps.find((item) => item.invoiceId === invoiceId && item.nextActionDate);
    if (!followUp) return '—';
    return `${followUp.nextActionDate} · ${followUp.nextAction || followUp.activityType}`;
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }

  min(a: number, b: number) { return Math.min(a, b); }

  nextPage() { this.page.update(p => p + 1); this.load(); }
  backPage() { this.page.update(p => p - 1); this.load(); }
}
