import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';

interface Invoice {
  id: string;
  invoiceNumber: string;
  prefix: string;
  type: string;
  status: string;
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  dianCufe?: string;
  dianStatus?: string;
  customer: { id: string; name: string; documentNumber: string };
  _count?: { items: number };
}

interface Customer { id: string; name: string; documentNumber: string; documentType: string; }
interface Product { id: string; name: string; sku: string; price: number; taxRate: number; taxType: string; unit: string; }

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Facturación Electrónica</h2>
          <p class="page-subtitle">{{ total() }} facturas · DIAN certificada</p>
        </div>
        <button class="btn btn-primary" (click)="openNewInvoice()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          Nueva factura
        </button>
      </div>

      <!-- KPI strip -->
      <div class="kpi-strip">
        @for (k of kpis; track k.label) {
          <div class="kpi-card">
            <div class="kpi-value">{{ k.value }}</div>
            <div class="kpi-label">{{ k.label }}</div>
          </div>
        }
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
          <input type="text" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Buscar por número o cliente..." class="search-input"/>
        </div>
        <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="filter-select">
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="SENT_DIAN">Enviada DIAN</option>
          <option value="ACCEPTED_DIAN">Aceptada DIAN</option>
          <option value="REJECTED_DIAN">Rechazada</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
          <option value="CANCELLED">Anulada</option>
        </select>
        <select [(ngModel)]="filterType" (ngModelChange)="load()" class="filter-select">
          <option value="">Todos los tipos</option>
          <option value="VENTA">Factura venta</option>
          <option value="NOTA_CREDITO">Nota crédito</option>
          <option value="NOTA_DEBITO">Nota débito</option>
        </select>
        <input type="date" [(ngModel)]="filterFrom" (ngModelChange)="load()" class="filter-date" title="Desde"/>
        <input type="date" [(ngModel)]="filterTo" (ngModelChange)="load()" class="filter-date" title="Hasta"/>
      </div>

      <!-- Table -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-line" style="width:100px"></div>
                <div class="sk sk-line" style="width:180px"></div>
                <div class="sk sk-line" style="width:90px"></div>
                <div class="sk sk-line" style="width:100px"></div>
                <div class="sk sk-line" style="width:80px"></div>
              </div>
            }
          </div>
        } @else if (invoices().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path stroke-linecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path stroke-linecap="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            <p>No hay facturas con los filtros actuales</p>
            <button class="btn btn-primary btn-sm" (click)="openNewInvoice()">Crear primera factura</button>
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Fecha emisión</th>
                <th>Vencimiento</th>
                <th>Total</th>
                <th>DIAN</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (inv of invoices(); track inv.id) {
                <tr>
                  <td>
                    <span class="inv-number" (click)="viewDetail(inv)">{{ inv.invoiceNumber }}</span>
                    @if (inv.dianCufe) {
                      <div class="cufe-badge" [title]="inv.dianCufe">CUFE ✓</div>
                    }
                  </td>
                  <td><span class="type-badge type-{{ inv.type.toLowerCase() }}">{{ typeLabel(inv.type) }}</span></td>
                  <td>
                    <div class="client-cell">
                      <span class="client-name">{{ inv.customer.name }}</span>
                      <span class="client-doc">{{ inv.customer.documentNumber }}</span>
                    </div>
                  </td>
                  <td class="text-muted">{{ inv.issueDate | date:'dd/MM/yyyy' }}</td>
                  <td [class.overdue-cell]="isOverdue(inv)">
                    {{ inv.dueDate ? (inv.dueDate | date:'dd/MM/yyyy') : 'Contado' }}
                  </td>
                  <td><strong class="inv-total">{{ fmtCOP(inv.total) }}</strong></td>
                  <td>
                    <span class="dian-badge dian-{{ (inv.dianStatus ?? 'pending').toLowerCase() }}">
                      {{ dianLabel(inv.dianStatus) }}
                    </span>
                  </td>
                  <td>
                    <span class="status-pill status-{{ inv.status.toLowerCase() }}">{{ statusLabel(inv.status) }}</span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-icon" title="Ver" (click)="viewDetail(inv)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    </button>
                    @if (inv.status === 'ACCEPTED_DIAN' || inv.status === 'SENT_DIAN') {
                      <button class="btn-icon btn-icon-success" title="Marcar pagada" (click)="markPaid(inv)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                      </button>
                    }
                    @if (inv.status === 'DRAFT') {
                      <button class="btn-icon" title="Enviar a DIAN" (click)="sendToDian(inv)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="pagination-info">{{ (page()-1)*20+1 }}–{{ min(page()*20, total()) }} de {{ total() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page()===1" (click)="setPage(page()-1)">‹</button>
                @for (p of pageRange(); track p) {
                  <button class="btn-page" [class.active]="p===page()" (click)="setPage(p)">{{ p }}</button>
                }
                <button class="btn-page" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">›</button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- ── Invoice Detail Drawer ─────────────────────────── -->
    @if (detailInvoice()) {
      <div class="drawer-overlay" (click)="detailInvoice.set(null)">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div>
              <div class="drawer-title">{{ detailInvoice()!.invoiceNumber }}</div>
              <div class="drawer-sub">{{ typeLabel(detailInvoice()!.type) }} · {{ detailInvoice()!.issueDate | date:'dd/MM/yyyy' }}</div>
            </div>
            <span class="status-pill status-{{ detailInvoice()!.status.toLowerCase() }}" style="margin-left:auto;margin-right:12px">
              {{ statusLabel(detailInvoice()!.status) }}
            </span>
            <button class="drawer-close" (click)="detailInvoice.set(null)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="drawer-body">
            <div class="detail-section">
              <div class="ds-title">Cliente</div>
              <div class="ds-row"><span>Nombre</span><strong>{{ detailInvoice()!.customer.name }}</strong></div>
              <div class="ds-row"><span>Documento</span><strong>{{ detailInvoice()!.customer.documentNumber }}</strong></div>
            </div>
            <div class="detail-section">
              <div class="ds-title">DIAN</div>
              <div class="ds-row"><span>Estado DIAN</span><strong>{{ dianLabel(detailInvoice()!.dianStatus) }}</strong></div>
              @if (detailInvoice()!.dianCufe) {
                <div class="ds-row"><span>CUFE</span><code style="font-size:11px;word-break:break-all">{{ detailInvoice()!.dianCufe }}</code></div>
              }
            </div>
            <div class="detail-section">
              <div class="ds-title">Totales</div>
              <div class="ds-row"><span>Subtotal</span><strong>{{ fmtCOP(detailInvoice()!.subtotal) }}</strong></div>
              <div class="ds-row"><span>IVA</span><strong>{{ fmtCOP(detailInvoice()!.taxAmount) }}</strong></div>
              <div class="ds-row total-row"><span>Total</span><strong>{{ fmtCOP(detailInvoice()!.total) }}</strong></div>
            </div>
          </div>
          <div class="drawer-footer">
            @if (detailInvoice()!.status === 'DRAFT') {
              <button class="btn btn-primary" (click)="sendToDian(detailInvoice()!)">Enviar a DIAN</button>
            }
            @if (detailInvoice()!.status === 'ACCEPTED_DIAN') {
              <button class="btn btn-primary" (click)="markPaid(detailInvoice()!)">Marcar pagada</button>
            }
          </div>
        </div>
      </div>
    }

    <!-- ── New Invoice Modal ──────────────────────────────── -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva factura electrónica</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- Header fields -->
            <div class="form-row-3">
              <div class="form-group">
                <label>Tipo *</label>
                <select [(ngModel)]="newInvoice.type" class="form-control">
                  <option value="VENTA">Factura de venta</option>
                  <option value="NOTA_CREDITO">Nota crédito</option>
                  <option value="NOTA_DEBITO">Nota débito</option>
                </select>
              </div>
              <div class="form-group">
                <label>Prefijo *</label>
                <input type="text" [(ngModel)]="newInvoice.prefix" class="form-control" placeholder="FV"/>
              </div>
              <div class="form-group">
                <label>Fecha emisión *</label>
                <input type="date" [(ngModel)]="newInvoice.issueDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Fecha vencimiento</label>
                <input type="date" [(ngModel)]="newInvoice.dueDate" class="form-control"/>
              </div>
            </div>
            <div class="form-group">
              <label>Cliente *</label>
              <select [(ngModel)]="newInvoice.customerId" class="form-control">
                <option value="">Seleccionar cliente...</option>
                @for (c of customers(); track c.id) {
                  <option [value]="c.id">{{ c.name }} — {{ c.documentNumber }}</option>
                }
              </select>
            </div>

            <!-- Line items -->
            <div class="form-section-title">
              Líneas de factura
              <button class="btn-add-line" (click)="addLine()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Agregar línea
              </button>
            </div>
            <div class="lines-table">
              <div class="lines-header">
                <span style="flex:3">Descripción</span>
                <span style="flex:1">Cant.</span>
                <span style="flex:1.5">Precio unit.</span>
                <span style="flex:1">IVA %</span>
                <span style="flex:1">Desc. %</span>
                <span style="flex:1.5;text-align:right">Total</span>
                <span style="width:32px"></span>
              </div>
              @for (line of lines; track $index; let i = $index) {
                <div class="lines-row">
                  <div style="flex:3">
                    <select [(ngModel)]="line.productId" (ngModelChange)="onProductSelect(i, $event)" class="form-control form-sm">
                      <option value="">Descripción libre</option>
                      @for (p of lineProducts(); track p.id) {
                        <option [value]="p.id">{{ p.name }} ({{ p.sku }})</option>
                      }
                    </select>
                    @if (!line.productId) {
                      <input type="text" [(ngModel)]="line.description" class="form-control form-sm" style="margin-top:4px" placeholder="Descripción del ítem..."/>
                    }
                  </div>
                  <input type="number" [(ngModel)]="line.quantity" (ngModelChange)="calcLine(i)" min="0.01" class="form-control form-sm" style="flex:1"/>
                  <input type="number" [(ngModel)]="line.unitPrice" (ngModelChange)="calcLine(i)" min="0" class="form-control form-sm" style="flex:1.5"/>
                  <input type="number" [(ngModel)]="line.taxRate" (ngModelChange)="calcLine(i)" min="0" max="100" class="form-control form-sm" style="flex:1"/>
                  <input type="number" [(ngModel)]="line.discount" (ngModelChange)="calcLine(i)" min="0" max="100" class="form-control form-sm" style="flex:1"/>
                  <span class="line-total" style="flex:1.5">{{ fmtCOP(lineTotal(line)) }}</span>
                  <button class="btn-remove" (click)="removeLine(i)" [disabled]="lines.length === 1">×</button>
                </div>
              }
            </div>

            <!-- Totals summary -->
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><strong>{{ fmtCOP(subtotal()) }}</strong></div>
              <div class="totals-row"><span>IVA</span><strong>{{ fmtCOP(totalTax()) }}</strong></div>
              <div class="totals-row totals-total"><span>Total</span><strong>{{ fmtCOP(subtotal() + totalTax()) }}</strong></div>
            </div>

            <div class="form-group" style="margin-top:14px">
              <label>Notas / observaciones</label>
              <textarea [(ngModel)]="newInvoice.notes" class="form-control" rows="2" placeholder="Información adicional para el receptor..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-secondary" [disabled]="saving()" (click)="saveInvoice(false)">Guardar borrador</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveInvoice(true)">
              {{ saving() ? 'Enviando...' : 'Crear y enviar a DIAN' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width:1300px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* KPI strip */
    .kpi-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
    .kpi-card { background:#fff; border:1px solid #dce6f0; border-radius:10px; padding:14px 16px; }
    .kpi-value { font-family:'Sora',sans-serif; font-size:20px; font-weight:700; color:#0c1c35; }
    .kpi-label { font-size:12px; color:#9ca3af; margin-top:3px; }

    /* Filters */
    .filters-bar { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
    .search-wrap { flex:1; min-width:200px; max-width:320px; position:relative; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; background:#fff; }
    .filter-date { padding:8px 10px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; color:#374151; }

    /* Table */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:11px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:11px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .inv-number { font-family:monospace; font-weight:700; color:#1a407e; cursor:pointer; }
    .inv-number:hover { text-decoration:underline; }
    .cufe-badge { font-size:10px; color:#065f46; background:#d1fae5; padding:1px 6px; border-radius:4px; margin-top:2px; display:inline-block; }
    .client-name { display:block; font-weight:600; color:#0c1c35; font-size:13.5px; }
    .client-doc { font-size:11.5px; color:#9ca3af; }
    .text-muted { color:#9ca3af; }
    .overdue-cell { color:#dc2626; font-weight:600; }
    .inv-total { color:#0c1c35; }
    .type-badge { padding:3px 8px; border-radius:6px; font-size:11px; font-weight:700; }
    .type-venta { background:#dbeafe; color:#1e40af; }
    .type-nota_credito { background:#fce7f3; color:#9d174d; }
    .type-nota_debito { background:#fef3c7; color:#92400e; }
    .dian-badge { padding:3px 8px; border-radius:6px; font-size:10.5px; font-weight:700; }
    .dian-pendiente, .dian-undefined { background:#f3f4f6; color:#6b7280; }
    .dian-aceptado { background:#d1fae5; color:#065f46; }
    .dian-rechazado { background:#fee2e2; color:#991b1b; }
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-draft { background:#f3f4f6; color:#6b7280; }
    .status-sent_dian { background:#dbeafe; color:#1e40af; }
    .status-accepted_dian { background:#d1fae5; color:#065f46; }
    .status-rejected_dian { background:#fee2e2; color:#991b1b; }
    .status-paid { background:#d1fae5; color:#065f46; }
    .status-overdue { background:#fee2e2; color:#991b1b; }
    .status-cancelled { background:#f3f4f6; color:#6b7280; }
    .actions-cell { text-align:right; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .btn-icon-success:hover { background:#d1fae5; color:#065f46; }
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* Drawer */
    .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:100; display:flex; justify-content:flex-end; }
    .drawer { width:420px; max-width:100%; background:#fff; height:100%; display:flex; flex-direction:column; }
    .drawer-header { display:flex; align-items:center; gap:10px; padding:18px 20px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .drawer-title { font-weight:700; font-size:16px; color:#0c1c35; font-family:'Sora',sans-serif; }
    .drawer-sub { font-size:12px; color:#9ca3af; margin-top:2px; }
    .drawer-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .drawer-body { flex:1; overflow-y:auto; padding:20px; }
    .drawer-footer { padding:16px 20px; border-top:1px solid #f0f4f8; display:flex; gap:10px; flex-shrink:0; }
    .detail-section { margin-bottom:20px; }
    .ds-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .ds-row { display:flex; justify-content:space-between; align-items:flex-start; padding:7px 0; border-bottom:1px solid #f8fafc; font-size:13.5px; }
    .ds-row span { color:#9ca3af; }
    .ds-row strong { color:#0c1c35; text-align:right; max-width:240px; }
    .total-row { background:#f8fafc; padding:10px 8px; border-radius:8px; font-size:15px; border:none !important; }
    .total-row span, .total-row strong { color:#0c1c35; font-size:15px; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; }
    .modal-xl { max-width:900px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; flex-shrink:0; }
    .form-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:12px; }
    .form-group { margin-bottom:12px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-sm { padding:6px 10px; font-size:13px; }
    .form-section-title { display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9ca3af; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #f0f4f8; }
    .btn-add-line { background:#e8eef8; border:none; color:#1a407e; font-size:12px; font-weight:700; padding:4px 10px; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:4px; }
    .btn-add-line:hover { background:#d1dff5; }
    .lines-table { border:1px solid #f0f4f8; border-radius:8px; overflow:hidden; }
    .lines-header { display:flex; align-items:center; gap:8px; padding:8px 12px; background:#f8fafc; font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; }
    .lines-row { display:flex; align-items:flex-start; gap:8px; padding:8px 12px; border-top:1px solid #f0f4f8; }
    .line-total { display:flex; align-items:center; justify-content:flex-end; font-weight:700; font-size:13px; color:#0c1c35; }
    .btn-remove { background:none; border:none; cursor:pointer; color:#9ca3af; font-size:18px; padding:0 4px; border-radius:4px; align-self:center; }
    .btn-remove:hover:not(:disabled) { color:#dc2626; background:#fee2e2; }
    .btn-remove:disabled { opacity:.3; cursor:default; }
    .totals-box { background:#f8fafc; border:1px solid #f0f4f8; border-radius:8px; padding:14px 16px; margin-top:14px; }
    .totals-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13.5px; color:#6b7280; }
    .totals-row strong { color:#374151; }
    .totals-total { border-top:1px solid #e5e7eb; margin-top:6px; padding-top:10px; font-size:15px; }
    .totals-total span, .totals-total strong { color:#0c1c35; font-weight:700; font-size:15px; }
    textarea.form-control { resize:vertical; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-sm { padding:7px 14px; font-size:13px; }
  `]
})
export class InvoicesListComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/invoices`;
  private readonly CUST_API = `${environment.apiUrl}/customers`;
  private readonly PROD_API = `${environment.apiUrl}/products`;

  invoices = signal<Invoice[]>([]);
  customers = signal<Customer[]>([]);
  lineProducts = signal<Product[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);

  detailInvoice = signal<Invoice | null>(null);
  showModal = signal(false);

  search = '';
  filterStatus = '';
  filterType = '';
  filterFrom = '';
  filterTo = '';
  private searchTimer: any;

  kpis: Array<{ label: string; value: string }> = [
    { label: 'Este mes', value: '$0' },
    { label: 'Pendientes DIAN', value: '0' },
    { label: 'Vencidas', value: '0' },
    { label: 'Pagadas', value: '0' },
  ];

  lines: InvoiceLine[] = [this.newLine()];
  newInvoice = { type: 'VENTA', prefix: 'FV', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', customerId: '', notes: '' };

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.load();
    this.loadCustomers();
    this.loadProducts();
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search) params.search = this.search;
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterType) params.type = this.filterType;
    if (this.filterFrom) params.from = this.filterFrom;
    if (this.filterTo) params.to = this.filterTo;

    this.http.get<any>(this.API, { params }).subscribe({
      next: r => {
        this.invoices.set(r.data ?? r);
        this.total.set(r.total ?? r.length);
        this.totalPages.set(r.totalPages ?? 1);
        this.loading.set(false);
        this.computeKpis(r.data ?? r);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar facturas'); }
    });
  }

  computeKpis(data: Invoice[]) {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const thisMonth = data.filter(i => {
      const d = new Date(i.issueDate);
      return d.getMonth() === month && d.getFullYear() === year && i.status !== 'CANCELLED';
    });
    const total = thisMonth.reduce((s, i) => s + Number(i.total), 0);
    const pending = data.filter(i => i.status === 'SENT_DIAN' || i.status === 'DRAFT').length;
    const overdue = data.filter(i => i.status === 'OVERDUE').length;
    const paid = data.filter(i => i.status === 'PAID').length;
    this.kpis = [
      { label: 'Este mes', value: this.fmtCOP(total) },
      { label: 'Pendientes DIAN', value: String(pending) },
      { label: 'Vencidas', value: String(overdue) },
      { label: 'Pagadas', value: String(paid) },
    ];
  }

  loadCustomers() {
    this.http.get<any>(`${this.CUST_API}?limit=100`).subscribe({
      next: r => this.customers.set(r.data ?? r),
      error: () => {}
    });
  }

  loadProducts() {
    this.http.get<any>(`${this.PROD_API}?limit=100&status=ACTIVE`).subscribe({
      next: r => this.lineProducts.set(r.data ?? r),
      error: () => {}
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const r: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) r.push(i);
    return r;
  }

  openNewInvoice() {
    this.lines = [this.newLine()];
    this.newInvoice = { type: 'VENTA', prefix: 'FV', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', customerId: '', notes: '' };
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  addLine() { this.lines.push(this.newLine()); }

  removeLine(i: number) { this.lines.splice(i, 1); }

  onProductSelect(i: number, productId: string) {
    if (!productId) return;
    const p = this.lineProducts().find(p => p.id === productId);
    if (p) {
      this.lines[i].description = p.name;
      this.lines[i].unitPrice = Number(p.price);
      this.lines[i].taxRate = Number(p.taxRate);
    }
  }

  calcLine(i: number) { /* reactive via template */ }

  lineTotal(line: InvoiceLine): number {
    const base = line.quantity * line.unitPrice * (1 - line.discount / 100);
    return base + base * (line.taxRate / 100);
  }

  subtotal(): number {
    return this.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 - l.discount / 100), 0);
  }

  totalTax(): number {
    return this.lines.reduce((s, l) => {
      const base = l.quantity * l.unitPrice * (1 - l.discount / 100);
      return s + base * (l.taxRate / 100);
    }, 0);
  }

  saveInvoice(sendDian: boolean) {
    if (!this.newInvoice.customerId) { this.notify.warning('Selecciona un cliente'); return; }
    if (this.lines.some(l => !l.description && !l.productId)) { this.notify.warning('Todas las líneas necesitan descripción'); return; }

    this.saving.set(true);
    const body = {
      ...this.newInvoice,
      dueDate: this.newInvoice.dueDate || undefined,
      sendToDian: sendDian,
      items: this.lines.map((l, i) => ({
        productId: l.productId || undefined,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        discount: l.discount,
        position: i + 1,
      }))
    };

    this.http.post(this.API, body).subscribe({
      next: () => {
        this.notify.success(sendDian ? 'Factura creada y enviada a DIAN' : 'Factura guardada como borrador');
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al crear factura'); }
    });
  }

  viewDetail(inv: Invoice) {
    this.http.get<Invoice>(`${this.API}/${inv.id}`).subscribe({
      next: r => this.detailInvoice.set(r),
      error: () => this.detailInvoice.set(inv)
    });
  }

  sendToDian(inv: Invoice) {
    this.http.post(`${this.API}/${inv.id}/send-dian`, {}).subscribe({
      next: () => { this.notify.success('Factura enviada a DIAN'); this.detailInvoice.set(null); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error al enviar')
    });
  }

  markPaid(inv: Invoice) {
    this.http.post(`${this.API}/${inv.id}/mark-paid`, {}).subscribe({
      next: () => { this.notify.success('Factura marcada como pagada'); this.detailInvoice.set(null); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error')
    });
  }

  isOverdue(inv: Invoice): boolean {
    return inv.dueDate ? new Date(inv.dueDate) < new Date() && inv.status !== 'PAID' && inv.status !== 'CANCELLED' : false;
  }

  typeLabel(t: string): string {
    return { VENTA: 'Venta', NOTA_CREDITO: 'N. Crédito', NOTA_DEBITO: 'N. Débito', SOPORTE_ADQUISICION: 'Soporte' }[t] ?? t;
  }

  statusLabel(s: string): string {
    return { DRAFT: 'Borrador', SENT_DIAN: 'Enviada', ACCEPTED_DIAN: 'Aceptada', REJECTED_DIAN: 'Rechazada', PAID: 'Pagada', CANCELLED: 'Anulada', OVERDUE: 'Vencida' }[s] ?? s;
  }

  dianLabel(s?: string): string {
    if (!s) return 'Pendiente';
    return { ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado', PENDIENTE: 'Pendiente' }[s] ?? s;
  }

  fmtCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  min(a: number, b: number) { return Math.min(a, b); }

  private newLine(): InvoiceLine {
    return { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 };
  }
}