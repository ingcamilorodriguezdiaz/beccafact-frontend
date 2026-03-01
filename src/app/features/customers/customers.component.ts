import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../model/api-response.model';
import { PaginatedResponse } from '../../model/paginate-response.model';

interface Customer {
  id: string;
  documentType: 'NIT' | 'CC' | 'CE' | 'PASSPORT' | 'TI';
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  creditDays?: number;
  isActive: boolean;
  createdAt: string;
  invoices?: Array<{ id: string; invoiceNumber: string; total: number; status: string; issueDate: string }>;
}

interface CustomerForm {
  documentType: string;
  documentNumber: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  creditLimit: number | null;
  creditDays: number | null;
}

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Clientes</h2>
          <p class="page-subtitle">{{ total() }} clientes registrados</p>
        </div>
        <button class="btn btn-primary" (click)="openModal()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          Nuevo cliente
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
          <input type="text" placeholder="Buscar por nombre, documento o email..."
                 [(ngModel)]="search" (ngModelChange)="onSearch()" class="search-input"/>
        </div>
        <select [(ngModel)]="filterActive" (ngModelChange)="load()" class="filter-select">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <!-- Table -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-avatar"></div>
                <div class="sk sk-line" style="width:180px"></div>
                <div class="sk sk-line" style="width:120px"></div>
                <div class="sk sk-line" style="width:140px"></div>
                <div class="sk sk-line" style="width:80px"></div>
                <div class="sk sk-line" style="width:60px"></div>
              </div>
            }
          </div>
        } @else if (customers().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path stroke-linecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
            </svg>
            <p>{{ search ? 'Sin resultados para "' + search + '"' : 'No hay clientes registrados aún' }}</p>
            @if (!search) {
              <button class="btn btn-primary btn-sm" (click)="openModal()">Crear primer cliente</button>
            }
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Contacto</th>
                <th>Ciudad</th>
                <th>Crédito</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of customers(); track c.id) {
                <tr>
                  <td>
                    <div class="customer-cell">
                      <div class="cust-avatar">{{ initials(c.name) }}</div>
                      <div>
                        <div class="cust-name">{{ c.name }}</div>
                        @if (c.email) { <div class="cust-email">{{ c.email }}</div> }
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="doc-badge">{{ c.documentType }}</span>
                    <span class="doc-number">{{ c.documentNumber }}</span>
                  </td>
                  <td class="text-muted">{{ c.phone || '—' }}</td>
                  <td class="text-muted">{{ c.city || '—' }}</td>
                  <td>
                    @if (c.creditDays) {
                      <span class="credit-badge">{{ c.creditDays }}d / {{ formatCurrency(c.creditLimit) }}</span>
                    } @else {
                      <span class="text-muted">Contado</span>
                    }
                  </td>
                  <td>
                    <span class="status-badge" [class.active]="c.isActive" [class.inactive]="!c.isActive">
                      {{ c.isActive ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-icon" title="Ver detalle" (click)="viewDetail(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    </button>
                    <button class="btn-icon" title="Editar" (click)="openModal(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                    </button>
                    <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDelete(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="pagination-info">{{ (page()-1)*limit + 1 }}–{{ min(page()*limit, total()) }} de {{ total() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page() === 1" (click)="setPage(page()-1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                </button>
                @for (p of pageRange(); track p) {
                  <button class="btn-page" [class.active]="p === page()" (click)="setPage(p)">{{ p }}</button>
                }
                <button class="btn-page" [disabled]="page() === totalPages()" (click)="setPage(page()+1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- ── Detail Drawer ───────────────────────────────────── -->
    @if (detailCustomer()) {
      <div class="drawer-overlay" (click)="closeDetail()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-avatar">{{ initials(detailCustomer()!.name) }}</div>
            <div>
              <div class="drawer-title">{{ detailCustomer()!.name }}</div>
              <div class="drawer-sub">{{ detailCustomer()!.documentType }} {{ detailCustomer()!.documentNumber }}</div>
            </div>
            <button class="drawer-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="drawer-body">
            <div class="detail-grid">
              <div class="detail-item"><span>Email</span><strong>{{ detailCustomer()!.email || '—' }}</strong></div>
              <div class="detail-item"><span>Teléfono</span><strong>{{ detailCustomer()!.phone || '—' }}</strong></div>
              <div class="detail-item"><span>Ciudad</span><strong>{{ detailCustomer()!.city || '—' }}</strong></div>
              <div class="detail-item"><span>Dirección</span><strong>{{ detailCustomer()!.address || '—' }}</strong></div>
              <div class="detail-item"><span>Crédito límite</span><strong>{{ formatCurrency(detailCustomer()!.creditLimit) }}</strong></div>
              <div class="detail-item"><span>Días crédito</span><strong>{{ detailCustomer()!.creditDays ?? '—' }}</strong></div>
            </div>
            @if (detailCustomer()!.invoices?.length) {
              <div class="detail-section">
                <div class="detail-section-title">Últimas facturas</div>
                @for (inv of detailCustomer()!.invoices; track inv.id) {
                  <div class="inv-row">
                    <span class="inv-num">{{ inv.invoiceNumber }}</span>
                    <span class="inv-status inv-status-{{ inv.status.toLowerCase() }}">{{ statusLabel(inv.status) }}</span>
                    <span class="inv-total">{{ formatCurrency(inv.total) }}</span>
                  </div>
                }
              </div>
            }
          </div>
          <div class="drawer-footer">
            <button class="btn btn-secondary" (click)="openModal(detailCustomer()!)">Editar cliente</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Create / Edit Modal ─────────────────────────────── -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Editar cliente' : 'Nuevo cliente' }}</h3>
            <button class="drawer-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Tipo documento *</label>
                <select [(ngModel)]="form.documentType" class="form-control">
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula Extranjería (CE)</option>
                  <option value="PASSPORT">Pasaporte</option>
                  <option value="TI">Tarjeta Identidad (TI)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Número de documento *</label>
                <input type="text" [(ngModel)]="form.documentNumber" class="form-control" placeholder="900123456-1"/>
              </div>
            </div>
            <div class="form-group">
              <label>Nombre / Razón social *</label>
              <input type="text" [(ngModel)]="form.name" class="form-control" placeholder="Empresa S.A.S."/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="form.email" class="form-control" placeholder="correo@empresa.com"/>
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" [(ngModel)]="form.phone" class="form-control" placeholder="+57 300 000 0000"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" [(ngModel)]="form.city" class="form-control" placeholder="Bogotá"/>
              </div>
              <div class="form-group">
                <label>Dirección</label>
                <input type="text" [(ngModel)]="form.address" class="form-control" placeholder="Calle 123 #45-67"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Límite de crédito (COP)</label>
                <input type="number" [(ngModel)]="form.creditLimit" class="form-control" placeholder="0"/>
              </div>
              <div class="form-group">
                <label>Días de crédito</label>
                <input type="number" [(ngModel)]="form.creditDays" class="form-control" placeholder="30"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : 'Crear cliente') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Delete Confirm ─────────────────────────────────── -->
    @if (deleteTarget()) {
      <div class="modal-overlay" (click)="deleteTarget.set(null)">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Eliminar cliente</h3>
          </div>
          <div class="modal-body">
            <p>¿Estás seguro de eliminar a <strong>{{ deleteTarget()!.name }}</strong>? Esta acción no se puede deshacer.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="deleteTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="saving()" (click)="doDelete()">
              {{ saving() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1200px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* Filters */
    .filters-bar { display:flex; gap:12px; margin-bottom:16px; }
    .search-wrap { flex:1; position:relative; max-width:420px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#374151; }

    /* Table card */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:11px 16px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:12px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }

    /* Customer cell */
    .customer-cell { display:flex; align-items:center; gap:10px; }
    .cust-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .cust-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .cust-email { font-size:12px; color:#9ca3af; margin-top:1px; }

    /* Badges */
    .doc-badge { background:#e8eef8; color:#1a407e; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-right:6px; }
    .doc-number { font-family:monospace; font-size:13px; color:#374151; }
    .text-muted { color:#9ca3af; }
    .credit-badge { font-size:12px; color:#065f46; background:#d1fae5; padding:3px 8px; border-radius:6px; font-weight:600; }
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge.active { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }

    /* Actions */
    .actions-cell { text-align:right; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; }

    /* Pagination */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* Skeleton */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:34px; height:34px; border-radius:8px; flex-shrink:0; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* Empty state */
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* Drawer */
    .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:100; display:flex; justify-content:flex-end; }
    .drawer { width:420px; max-width:100%; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-4px 0 24px rgba(0,0,0,.15); }
    .drawer-header { display:flex; align-items:center; gap:12px; padding:20px; border-bottom:1px solid #f0f4f8; }
    .drawer-avatar { width:44px; height:44px; border-radius:10px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .drawer-title { font-weight:700; font-size:16px; color:#0c1c35; }
    .drawer-sub { font-size:12px; color:#9ca3af; margin-top:2px; }
    .drawer-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; }
    .drawer-close:hover { background:#f0f4f8; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:20px; }
    .drawer-footer { padding:16px 20px; border-top:1px solid #f0f4f8; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-section { margin-top:16px; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .inv-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #f0f4f8; font-size:13px; }
    .inv-num { font-family:monospace; font-weight:600; color:#1a407e; flex:1; }
    .inv-total { font-weight:700; color:#0c1c35; }
    .inv-status { padding:2px 8px; border-radius:6px; font-size:10px; font-weight:700; }
    .inv-status-paid, .inv-status-accepted_dian { background:#d1fae5; color:#065f46; }
    .inv-status-draft { background:#f3f4f6; color:#6b7280; }
    .inv-status-overdue { background:#fee2e2; color:#991b1b; }
    .inv-status-sent_dian { background:#dbeafe; color:#1e40af; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-sm { max-width:400px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-sm { padding:7px 14px; font-size:13px; }
  `]
})
export class CustomersComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/customers`;

  customers = signal<Customer[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  readonly limit = 20;

  search = '';
  filterActive = '';
  private searchTimer: any;

  showModal = signal(false);
  editingId = signal<string | null>(null);
  detailCustomer = signal<Customer | null>(null);
  deleteTarget = signal<Customer | null>(null);

  form: CustomerForm = this.emptyForm();

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: this.limit };
    if (this.search) params.search = this.search;
    if (this.filterActive !== '') params.isActive = this.filterActive;

    this.http.get<PaginatedResponse<Customer>>(`${this.API}`, { params }).subscribe({
      next: ({data:customers,total,totalPages}) => {
        this.customers.set(customers ?? []);
        this.total.set(total ?? 0);
        this.totalPages.set(totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar clientes'); }
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  openModal(customer?: Customer) {
    if (customer) {
      this.editingId.set(customer.id);
      this.form = {
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
        name: customer.name,
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        address: customer.address ?? '',
        city: customer.city ?? '',
        creditLimit: customer.creditLimit ?? null,
        creditDays: customer.creditDays ?? null,
      };
    } else {
      this.editingId.set(null);
      this.form = this.emptyForm();
    }
    this.detailCustomer.set(null);
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.documentNumber || !this.form.name) {
      this.notify.warning('Documento y nombre son obligatorios'); return;
    }
    this.saving.set(true);
    const body = { ...this.form };
    const req = this.editingId()
      ? this.http.patch(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Cliente actualizado' : 'Cliente creado');
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al guardar');
      }
    });
  }

  viewDetail(c: Customer) {
    this.http.get<Customer>(`${this.API}/${c.id}`).subscribe({
      next: r => this.detailCustomer.set(r),
      error: () => this.detailCustomer.set(c)
    });
  }

  closeDetail() { this.detailCustomer.set(null); }

  confirmDelete(c: Customer) { this.deleteTarget.set(c); }

  doDelete() {
    const c = this.deleteTarget();
    if (!c) return;
    this.saving.set(true);
    this.http.delete(`${this.API}/${c.id}`).subscribe({
      next: () => {
        this.notify.success('Cliente eliminado');
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al eliminar');
      }
    });
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  formatCurrency(v?: number | null): string {
    if (!v) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Borrador', SENT_DIAN: 'Enviada', ACCEPTED_DIAN: 'Aceptada',
      REJECTED_DIAN: 'Rechazada', PAID: 'Pagada', CANCELLED: 'Anulada', OVERDUE: 'Vencida'
    };
    return map[s] ?? s;
  }

  min(a: number, b: number) { return Math.min(a, b); }

  private emptyForm(): CustomerForm {
    return { documentType: 'NIT', documentNumber: '', name: '', email: '', phone: '', address: '', city: '', creditLimit: null, creditDays: null };
  }
}