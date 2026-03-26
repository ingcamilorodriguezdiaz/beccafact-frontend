import { Component, HostListener, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

interface ReceivableInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  total: number;
  balance: number;
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

interface ReceivableDashboard {
  resumen: {
    totalCartera: number;
    totalVencido: number;
    totalPorVencer: number;
    totalAlDia: number;
    totalFacturas: number;
    clientesEnMora: number;
  };
}

interface PaymentForm {
  amount: number;
  date: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}

@Component({
  selector: 'app-cartera',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    <div class="ct">

      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Cartera</h1>
          <p class="page-header__sub">Gestión de cuentas por cobrar y seguimiento de pagos</p>
        </div>
        <div class="page-header__actions">
          <button class="btn btn--secondary btn--sm" (click)="load()">
            <span class="material-symbols-outlined">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      <!-- ── KPI Cards ──────────────────────────────────────── -->
      @if (dashboard()) {
        <div class="ct__kpis">
          <div class="ct__kpi ct__kpi--neutral">
            <div class="ct__kpi-icon"><span class="material-symbols-outlined">account_balance_wallet</span></div>
            <div class="ct__kpi-body">
              <div class="ct__kpi-val">{{ dashboard()!.resumen.totalCartera | currency:'COP':'symbol':'1.0-0' }}</div>
              <div class="ct__kpi-label">Total cartera</div>
              <div class="ct__kpi-sub">{{ dashboard()!.resumen.totalFacturas }} invoices</div>
            </div>
          </div>
          <div class="ct__kpi ct__kpi--danger">
            <div class="ct__kpi-icon"><span class="material-symbols-outlined">warning</span></div>
            <div class="ct__kpi-body">
              <div class="ct__kpi-val">{{ dashboard()!.resumen.totalVencido | currency:'COP':'symbol':'1.0-0' }}</div>
              <div class="ct__kpi-label">Vencido</div>
              <div class="ct__kpi-sub">{{ dashboard()!.resumen.clientesEnMora }} clientes en mora</div>
            </div>
          </div>
          <div class="ct__kpi ct__kpi--warn">
            <div class="ct__kpi-icon"><span class="material-symbols-outlined">schedule</span></div>
            <div class="ct__kpi-body">
              <div class="ct__kpi-val">{{ dashboard()!.resumen.totalPorVencer | currency:'COP':'symbol':'1.0-0' }}</div>
              <div class="ct__kpi-label">Por vencer (30 días)</div>
            </div>
          </div>
          <div class="ct__kpi ct__kpi--success">
            <div class="ct__kpi-icon"><span class="material-symbols-outlined">check_circle</span></div>
            <div class="ct__kpi-body">
              <div class="ct__kpi-val">{{ dashboard()!.resumen.totalAlDia | currency:'COP':'symbol':'1.0-0' }}</div>
              <div class="ct__kpi-label">Al día</div>
            </div>
          </div>
        </div>
      }

      <!-- ── Filtros ────────────────────────────────────────── -->
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

      <!-- ── Tabla ──────────────────────────────────────────── -->
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
              <p>No hay invoices en cartera con los filtros seleccionados</p>
            </div>
          } @else {
            <table class="bf-table">
              <thead>
                <tr>
                  <th>N° Factura</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
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
                        <span [class.text-danger]="f.daysOverdue! > 0">
                          {{ f.dueDate | date:'dd/MM/yy' }}
                          @if (f.daysOverdue! > 0) {
                            <small class="ct__dias-badge">+{{ f.daysOverdue }}d</small>
                          }
                        </span>
                      } @else {
                        <span class="text-muted">—</span>
                      }
                    </td>
                    <td class="td-currency">{{ f.balance | currency:'COP':'symbol':'1.0-0' }}</td>
                    <td>
                      <span class="badge" [ngClass]="statusClass(f.carteraStatus)">
                        {{ statusLabel(f.carteraStatus) }}
                      </span>
                    </td>
                    <td>
                      <div class="ct__row-actions">
                        <!-- Ver cliente siempre visible -->
                        <button class="btn-icon" title="Ver cliente"
                                (click)="verCliente(f.customer.id)">
                          <span class="material-symbols-outlined">person</span>
                        </button>
                        <!-- Registrar pago: solo ADMIN/MANAGER -->
                        @if (canRegisterPayment() && f.status !== 'PAID') {
                          <button class="btn-icon btn-icon--success" title="Registrar pago"
                                  (click)="openPago(f)">
                            <span class="material-symbols-outlined">payments</span>
                          </button>
                        }
                        <!-- Recordatorio: solo ADMIN/MANAGER -->
                        @if (canSendReminder() && f.status !== 'PAID') {
                          <button class="btn-icon btn-icon--warn" title="Enviar recordatorio"
                                  (click)="sendReminder(f)">
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

    </div><!-- /ct -->

    <!-- ══════════════════════════════════════════════════════════════
         MODAL CLIENTE (detalle de cartera por cliente)
         ══════════════════════════════════════════════════════════════ -->
    @if (showCustomerModal()) {
      <div class="modal-overlay" >
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cartera del cliente</h3>
            <button class="modal-close" (click)="showCustomerModal.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            @if (customerReceivables()) {
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
                  <div class="ct__ck-val">{{ customerReceivables()!.resumen.saldoPendiente | currency:'COP':'symbol':'1.0-0' }}</div>
                  <div class="ct__ck-label">Saldo pendiente</div>
                </div>
                <div class="ct__ck ct__ck--danger">
                  <div class="ct__ck-val">{{ customerReceivables()!.resumen.saldoVencido | currency:'COP':'symbol':'1.0-0' }}</div>
                  <div class="ct__ck-label">Saldo vencido</div>
                </div>
                <div class="ct__ck">
                  <div class="ct__ck-val">{{ customerReceivables()!.resumen.invoicesPendientes }}</div>
                  <div class="ct__ck-label">Facturas pendientes</div>
                </div>
                <div class="ct__ck">
                  <div class="ct__ck-val">{{ customerReceivables()!.resumen.invoicesPagadas }}</div>
                  <div class="ct__ck-label">Facturas pagadas</div>
                </div>
              </div>
              <table class="bf-table bf-table--sm">
                <thead>
                  <tr><th>Factura</th><th>Emisión</th><th>Vencimiento</th><th>Total</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  @for (inv of customerReceivables()!.invoices; track inv.id) {
                    <tr>
                      <td><code>{{ inv.invoiceNumber }}</code></td>
                      <td>{{ inv.issueDate | date:'dd/MM/yy' }}</td>
                      <td>{{ inv.dueDate ? (inv.dueDate | date:'dd/MM/yy') : '—' }}</td>
                      <td>{{ inv.total | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(inv.carteraStatus)">{{ statusLabel(inv.carteraStatus) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="modal-loading">
                <div class="spinner"></div>
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════
         MODAL REGISTRAR PAGO
         ══════════════════════════════════════════════════════════════ -->
    @if (showPaymentModal()) {
      <div class="modal-overlay" >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Registrar pago — {{ paymentInvoice()?.invoiceNumber }}</h3>
            <button class="modal-close" (click)="closePago()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Monto recibido *</label>
              <input type="number" class="form-control" [(ngModel)]="paymentForm.amount"
                     [placeholder]="paymentInvoice()?.balance ?? 0" min="0" />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Fecha de pago *</label>
                <input type="date" class="form-control" [(ngModel)]="paymentForm.date" />
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
                     placeholder="Nro. transferencia, cheque, etc." />
            </div>
            <div class="form-group">
              <label class="form-label">Notas</label>
              <textarea class="form-control" [(ngModel)]="paymentForm.notes" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closePago()">Cancelar</button>
            <button class="btn btn--primary" (click)="submitPago()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Registrar pago' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .ct { max-width: 1280px; }

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
    .ct__dias-badge { background:#fee2e2; color:#ef4444; font-size:10px; font-weight:700; padding:1px 4px; border-radius:4px; margin-left:4px; }
    .text-danger { color:#ef4444; }
    .text-muted  { color:#94a3b8; }

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

    /* Skeleton & spinner */
    .modal-loading { display:flex; justify-content:center; padding:32px; }
    .spinner { width:32px; height:32px; border:3px solid #f0f4f8; border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

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

    /* Form */
    .form-group { margin-bottom:14px; }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    textarea.form-control { resize:vertical; min-height:56px; }

    /* Btns */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn--primary { background:#1a407e; color:#fff; }
    .btn--primary:hover:not(:disabled) { background:#133265; }
    .btn--primary:disabled { opacity:.6; cursor:default; }
    .btn--secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn--secondary:hover { background:#e8eef8; }
    .btn--sm { padding:7px 14px; font-size:12.5px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-header__title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-header__sub { font-size:13px; color:#64748b; margin:0; }
    .page-header__actions { display:flex; gap:8px; }
    .card { background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .card--sm { padding:12px 16px; }
    .card--flat { box-shadow:none; }
    .mb-4 { margin-bottom:16px; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid #dce6f0; border-radius:8px; padding:7px 11px; background:#fff; }
    .search-box__icon { font-size:16px; color:#94a3b8; }
    .search-box__input { border:none; outline:none; font-size:13.5px; color:#0c1c35; width:100%; background:transparent; }

    @media (max-width:900px) {
      .ct__kpis { grid-template-columns:repeat(2,1fr); }
    }
    @media (max-width:640px) {
      .ct__kpis { grid-template-columns:1fr; }
      .ct__filters { flex-direction:column; align-items:stretch; }
      .ct__cliente-kpis { grid-template-columns:repeat(2,1fr); }
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

  invoices      = signal<ReceivableInvoice[]>([]);
  dashboard     = signal<any | null>(null);
  loading       = signal(true);
  saving        = signal(false);
  total         = signal(0);
  page          = signal(1);
  search        = '';
  statusFilter  = signal('');
  showPaymentModal = signal(false);
  paymentInvoice   = signal<ReceivableInvoice | null>(null);
  showCustomerModal = signal(false);
  customerReceivables   = signal<any>(null);

  paymentForm: PaymentForm = { amount: 0, date: new Date().toISOString().split('T')[0], paymentMethod: '', reference: '', notes: '' };

  // Permisos según rol
  canRegisterPayment = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  });
  canSendReminder = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  });

  readonly statusFilters = [
    { value: '', label: 'Todos' },
    { value: 'VENCIDA', label: 'Vencida' },
    { value: 'EN_MORA', label: 'En mora' },
    { value: 'POR_VENCER', label: 'Por vencer' },
    { value: 'AL_DIA', label: 'Al día' },
    { value: 'PAGADA', label: 'Pagada' },
  ];

  ngOnInit() {
    this.loadDashboard();
    this.load();
  }

  loadDashboard() {
    this.http.get<any>(`${this.api}/dashboard`).subscribe({
      next: d => this.dashboard.set(d),
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

  verCliente(customerId: string) {
    this.customerReceivables.set(null);
    this.showCustomerModal.set(true);
    this.http.get<any>(`${this.api}/cliente/${customerId}`).subscribe({
      next: d => this.customerReceivables.set(d.data ?? d),
      error: () => { this.notify.error('Error al cargar cartera del cliente'); this.showCustomerModal.set(false); },
    });
  }

  openPago(f: ReceivableInvoice) {
    this.paymentInvoice.set(f);
    this.paymentForm = { amount: f.balance, date: new Date().toISOString().split('T')[0], paymentMethod: '', reference: '', notes: '' };
    this.showPaymentModal.set(true);
  }
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales — solo el botón X
  }

    closePago() { this.showPaymentModal.set(false); this.paymentInvoice.set(null); }

  submitPago() {
    if (!this.paymentForm.paymentMethod) { this.notify.error('Selecciona el medio de pago'); return; }
    if (!this.paymentForm.amount) { this.notify.error('Ingresa el monto'); return; }
    this.saving.set(true);
    this.http.post<any>(`${this.api}/${this.paymentInvoice()!.id}/pago`, this.paymentForm).subscribe({
      next: () => {
        this.saving.set(false); this.closePago();
        this.notify.success('Pago registrado correctamente');
        this.loadDashboard(); this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  sendReminder(f: ReceivableInvoice) {
    this.http.post<any>(`${this.api}/${f.id}/recordatorio`, {}).subscribe({
      next: r => this.notify.success((r.data ?? r).message ?? 'Recordatorio enviado'),
      error: e => this.notify.error(e?.error?.message ?? 'Error al enviar recordatorio'),
    });
  }

  statusClass(s: string) {
    return {
      'badge--success': s === 'AL_DIA',
      'badge--warn':    s === 'POR_VENCER',
      'badge--danger':  s === 'VENCIDA',
      'badge--mora':    s === 'EN_MORA',
      'badge--muted':   s === 'PAID',
    };
  }

  statusLabel(s: string) {
    const map: Record<string,string> = {
      AL_DIA: 'Al día', POR_VENCER: 'Por vencer', VENCIDA: 'Vencida', EN_MORA: 'En mora', PAID: 'Pagada',
    };
    return map[s] ?? s;
  }

  min(a: number, b: number) { return Math.min(a, b); }


  nextPage() {
    this.page.update(p => p + 1);
    this.load();
  }

  backPage() {
    this.page.update(p => p - 1);
    this.load();
  }
}