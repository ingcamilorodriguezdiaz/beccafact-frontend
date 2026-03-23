import { Component, HostListener, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface InvoiceItem {
  id: string; description: string; quantity: number; unitPrice: number;
  taxRate: number; taxAmount: number; discount: number; total: number;
  position: number; product?: { id: string; name: string; sku: string };
}
interface Invoice {
  id: string; invoiceNumber: string; prefix: string; type: string; status: string;
  issueDate: string; dueDate?: string; subtotal: number; taxAmount: number;
  discountAmount?: number; total: number; notes?: string; currency?: string;
  dianCufe?: string; dianStatus?: string; dianQrCode?: string;
  dianStatusCode?: string; dianStatusMsg?: string;
  dianErrors?: string;        // JSON array string: DIAN ErrorMessageList
  dianZipKey?: string; dianSentAt?: string; dianResponseAt?: string;
  dianAttempts?: number; xmlSigned?: string;
  customer: { id: string; name: string; documentNumber: string; email?: string; phone?: string; address?: string };
  items?: InvoiceItem[];
  _count?: { items: number };
  // Reference fields for NC/ND
  originalInvoiceId?: string;
  discrepancyReasonCode?: string;
  discrepancyReason?: string;
  dianCude?: string;
  // Relations
  creditDebitNotes?: Array<{
    id: string; invoiceNumber: string; prefix: string; type: string; status: string;
    total: number; issueDate: string; discrepancyReasonCode?: string; discrepancyReason?: string;
    dianCude?: string;
  }>;
  // Balance (loaded separately)
  balance?: {
    originalTotal: number; totalCredits: number; totalDebits: number;
    remainingBalance: number; creditCount: number; debitCount: number; fullyOffset: boolean;
  };
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
      <div class="page-header" id="tour-invoice-header">
        <div>
          <h2 class="page-title">Facturación Electrónica</h2>
          <p class="page-subtitle">{{ total() }} facturas · DIAN certificada</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <!-- Vista tabla / cuadrícula -->
          <div class="view-toggle">
            <button class="view-btn" [class.view-btn-active]="viewMode()==='table'" title="Vista tabla" (click)="viewMode.set('table')">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
            </button>
            <button class="view-btn" [class.view-btn-active]="viewMode()==='grid'" title="Vista cuadrícula" (click)="viewMode.set('grid')">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            </button>
          </div>
          <button class="btn btn-outline btn-sm" (click)="load()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
            Actualizar
          </button>
          <button class="btn btn-primary btn-sm" id="tour-new-invoice" (click)="openNewInvoice()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
            Nueva factura
          </button>
        </div>
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
      <div class="filters-bar" id="tour-invoice-filters">
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
      <div class="table-card" id="tour-invoice-table">
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
        } @else if (viewMode() === 'table') {
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
                      <span class="client-name">{{ inv?.customer?.name }}</span>
                      <span class="client-doc">{{ inv?.customer?.documentNumber }}</span>
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
                    <button class="btn-icon" title="Ver detalle" (click)="viewDetail(inv)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    </button>
                    @if (inv.status === 'DRAFT') {
                      <button class="btn-icon btn-icon-blue" title="Enviar a DIAN"
                              [disabled]="sending()[inv.id]" (click)="issueInvoice(inv)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                      </button>
                    }
                    @if (inv.dianZipKey || inv.dianCufe) {
                      <button class="btn-icon" title="Consultar estado DIAN"
                              [disabled]="querying()[inv.id]" (click)="queryDianStatus(inv)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
                      </button>
                    }
                    @if (inv.status === 'ACCEPTED_DIAN' || inv.status === 'SENT_DIAN' || inv.status === 'ISSUED') {
                      <button class="btn-icon btn-icon-success" title="Marcar pagada" (click)="markPaid(inv)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                      </button>
                    }
                    @if (inv.status === 'ACCEPTED_DIAN' && inv.type === 'VENTA') {
                      <button class="btn-icon btn-icon-nc" title="Nueva Nota Crédito" (click)="openNoteModal(inv,'credit')">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
                      </button>
                      <button class="btn-icon btn-icon-nd" title="Nueva Nota Débito" (click)="openNoteModal(inv,'debit')">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
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
        } @else {
          <!-- ── Vista cuadrícula ── -->
          <div class="inv-grid">
            @for (inv of invoices(); track inv.id) {
              <div class="inv-card" (click)="viewDetail(inv)">
                <div class="inv-card-top">
                  <div class="inv-card-number">{{ inv.invoiceNumber }}</div>
                  <span class="status-pill status-{{ inv.status.toLowerCase() }}">{{ statusLabel(inv.status) }}</span>
                </div>
                <div class="inv-card-type">
                  <span class="type-badge type-{{ inv.type.toLowerCase() }}">{{ typeLabel(inv.type) }}</span>
                  @if (inv.dianCufe) { <span class="cufe-badge">CUFE ✓</span> }
                </div>
                <div class="inv-card-client">{{ inv?.customer?.name }}</div>
                <div class="inv-card-doc">{{ inv?.customer?.documentNumber }}</div>
                <div class="inv-card-total">{{ fmtCOP(inv.total) }}</div>
                <div class="inv-card-meta">
                  <span>{{ inv.issueDate | date:'dd/MM/yy' }}</span>
                  <span class="dian-badge dian-{{ (inv.dianStatus ?? 'pending').toLowerCase() }}">{{ dianLabel(inv.dianStatus) }}</span>
                </div>
                <div class="inv-card-actions" (click)="$event.stopPropagation()">
                  @if (inv.status === 'DRAFT') {
                    <button class="btn-icon btn-icon-blue" title="Enviar a DIAN" [disabled]="sending()[inv.id]" (click)="issueInvoice(inv)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                    </button>
                  }
                  @if (inv.status === 'ACCEPTED_DIAN' || inv.status === 'SENT_DIAN' || inv.status === 'ISSUED') {
                    <button class="btn-icon btn-icon-success" title="Marcar pagada" (click)="markPaid(inv)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </button>
                  }
                  @if (inv.status === 'ACCEPTED_DIAN' && inv.type === 'VENTA') {
                    <button class="btn-icon btn-icon-nc" title="Nota Crédito" (click)="openNoteModal(inv,'credit')">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
                    </button>
                    <button class="btn-icon btn-icon-nd" title="Nota Débito" (click)="openNoteModal(inv,'debit')">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                    </button>
                  }
                  @if (inv.dianZipKey || inv.dianCufe) {
                    <button class="btn-icon" title="Consultar DIAN" [disabled]="querying()[inv.id]" (click)="queryDianStatus(inv)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

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

    <!-- ═══════════════════════════════════════════════════════
         DRAWER — Detalle de factura
    ═══════════════════════════════════════════════════════ -->
    @if (detailInvoice()) {
      <div class="drawer-overlay" (click)="detailInvoice.set(null)">
        <div class="drawer" (click)="$event.stopPropagation()">

          <div class="drawer-header">
            <div class="drawer-header-left">
              <div class="drawer-inv-number">{{ detailInvoice()!.invoiceNumber }}</div>
              <div class="drawer-inv-meta">
                <span class="type-badge type-{{ detailInvoice()!.type.toLowerCase() }}">{{ typeLabel(detailInvoice()!.type) }}</span>
                <span class="drawer-dot">·</span>
                <span class="drawer-date">{{ detailInvoice()!.issueDate | date:'dd MMM yyyy' }}</span>
              </div>
            </div>
            <div class="drawer-header-right">
              <span class="status-pill status-{{ detailInvoice()!.status.toLowerCase() }}">
                {{ statusLabel(detailInvoice()!.status) }}
              </span>
              <button class="drawer-close" (click)="detailInvoice.set(null)" title="Cerrar">
                <svg viewBox="0 0 20 20" fill="currentColor" width="17"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>

          <div class="drawer-body">

            <!-- Cliente -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                Cliente
              </div>
              <div class="dw-card">
                <div class="dw-client-name">{{ detailInvoice()?.customer?.name }}</div>
                <div class="dw-client-doc">{{ detailInvoice()?.customer?.documentNumber }}</div>
                @if (detailInvoice()?.customer?.email) {
                  <div class="dw-client-extra">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    {{ detailInvoice()?.customer?.email }}
                  </div>
                }
                @if (detailInvoice()?.customer?.phone) {
                  <div class="dw-client-extra">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                    {{ detailInvoice()!.customer.phone }}
                  </div>
                }
              </div>
            </div>

            <!-- Fechas -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg>
                Fechas
              </div>
              <div class="dw-dates-row">
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Emisión</span>
                  <span class="dw-date-val">{{ detailInvoice()!.issueDate | date:'dd/MM/yyyy' }}</span>
                </div>
                <div class="dw-date-chip" [class.dw-date-chip-overdue]="isOverdue(detailInvoice()!)">
                  <span class="dw-date-lbl">Vencimiento</span>
                  <span class="dw-date-val">{{ detailInvoice()!.dueDate ? (detailInvoice()!.dueDate! | date:'dd/MM/yyyy') : 'Contado' }}</span>
                </div>
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Moneda</span>
                  <span class="dw-date-val">{{ detailInvoice()!.currency ?? 'COP' }}</span>
                </div>
              </div>
            </div>

            <!-- Balance strip (VENTA + ACCEPTED_DIAN) -->
            @if (detailInvoice()!.type === 'VENTA' && detailInvoice()!.status === 'ACCEPTED_DIAN') {
              <div class="dw-section" style="padding-top:12px;padding-bottom:12px">
                <div class="balance-strip" (click)="openNoteModal(detailInvoice()!, 'credit')">
                  <span class="balance-label">Saldo disponible</span>
                  <span class="balance-value">Cargar saldo →</span>
                </div>
              </div>
            }

            <!-- Ítems -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
                Ítems
                @if (detailInvoice()!.items) {
                  <span class="dw-badge-count">{{ detailInvoice()!.items!.length }}</span>
                } @else {
                  <span class="dw-badge-count">{{ detailInvoice()!._count?.items ?? 0 }}</span>
                }
              </div>
              @if (detailInvoice()!.items && detailInvoice()!.items!.length > 0) {
                <div class="dw-items-table">
                  <div class="dw-items-head">
                    <span class="dwi-col-desc">Descripción</span>
                    <span class="dwi-col-qty">Cant.</span>
                    <span class="dwi-col-price">Precio</span>
                    <span class="dwi-col-tax">IVA</span>
                    <span class="dwi-col-total">Total</span>
                  </div>
                  @for (it of detailInvoice()!.items!; track it.id; let odd = $odd) {
                    <div class="dw-items-row" [class.dw-items-row-odd]="odd">
                      <div class="dwi-col-desc">
                        <span class="dwi-desc-text">{{ it.description }}</span>
                        @if (it.product) { <span class="dwi-sku">{{ it?.product?.sku }}</span> }
                        @if (it.discount > 0) { <span class="dwi-disc">-{{ it.discount }}% dto.</span> }
                      </div>
                      <div class="dwi-col-qty">{{ it.quantity }}</div>
                      <div class="dwi-col-price">{{ fmtCOP(it.unitPrice) }}</div>
                      <div class="dwi-col-tax">{{ it.taxRate }}%</div>
                      <div class="dwi-col-total">{{ fmtCOP(it.total) }}</div>
                    </div>
                  }
                </div>
              } @else if (!detailInvoice()!.items) {
                <div class="dw-items-empty">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>
                  Cargando ítems...
                </div>
              }
            </div>

            <!-- Totales -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/></svg>
                Totales
              </div>
              <div class="dw-totals">
                <div class="dw-total-row"><span>Subtotal</span><span>{{ fmtCOP(detailInvoice()!.subtotal) }}</span></div>
                <div class="dw-total-row"><span>IVA</span><span>{{ fmtCOP(detailInvoice()!.taxAmount) }}</span></div>
                @if ((detailInvoice()!.discountAmount ?? 0) > 0) {
                  <div class="dw-total-row dw-total-disc"><span>Descuento</span><span>-{{ fmtCOP(detailInvoice()!.discountAmount!) }}</span></div>
                }
                <div class="dw-total-row dw-total-grand"><span>Total</span><span>{{ fmtCOP(detailInvoice()!.total) }}</span></div>
              </div>
            </div>

            <!-- DIAN -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                DIAN
              </div>
              <div class="dw-card dw-dian-card">

                <!-- Estado factura -->
                <div class="dw-dian-row">
                  <span class="dw-dian-lbl">Estado factura</span>
                  <span class="status-pill status-{{ detailInvoice()!.status.toLowerCase() }}">
                    {{ statusLabel(detailInvoice()!.status) }}
                  </span>
                </div>

                <!-- Código DIAN -->
                @if (detailInvoice()!.dianStatusCode) {
                  <div class="dw-dian-row" style="margin-top:6px">
                    <span class="dw-dian-lbl">Código DIAN</span>
                    <span style="font-size:12px;color:#374151;font-family:monospace;font-weight:600">
                      {{ detailInvoice()!.dianStatusCode }}
                      @if (dianCodeDesc(detailInvoice()!.dianStatusCode)) {
                        <span style="font-weight:400;color:#6b7280"> — {{ dianCodeDesc(detailInvoice()!.dianStatusCode) }}</span>
                      }
                    </span>
                  </div>
                }

                <!-- ZipKey -->
                @if (detailInvoice()!.dianZipKey) {
                  <div class="dw-dian-row" style="margin-top:6px">
                    <span class="dw-dian-lbl">ZipKey</span>
                    <span style="font-size:11px;color:#374151;font-family:monospace;display:flex;align-items:center;gap:4px">
                      {{ detailInvoice()!.dianZipKey!.slice(0,20) }}…
                      <button class="btn-icon" style="width:18px;height:18px;padding:2px" title="Copiar ZipKey" (click)="copyText(detailInvoice()!.dianZipKey!)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                      </button>
                    </span>
                  </div>
                }

                <!-- Fechas -->
                @if (detailInvoice()!.dianSentAt) {
                  <div class="dw-dian-row" style="margin-top:6px">
                    <span class="dw-dian-lbl">Enviado</span>
                    <span style="font-size:12px;color:#374151">{{ detailInvoice()!.dianSentAt! | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }
                @if (detailInvoice()!.dianResponseAt) {
                  <div class="dw-dian-row" style="margin-top:4px">
                    <span class="dw-dian-lbl">Última consulta</span>
                    <span style="font-size:12px;color:#374151">{{ detailInvoice()!.dianResponseAt! | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                }

                <!-- Mensaje DIAN de estado (texto plano) -->
                @if (detailInvoice()!.dianStatusMsg && !detailInvoice()!.dianErrors) {
                  <div class="dian-msg-block"
                       [class.dian-msg-ok]="detailInvoice()!.status === 'ACCEPTED_DIAN'"
                       [class.dian-msg-err]="detailInvoice()!.status === 'REJECTED_DIAN'">
                    {{ detailInvoice()!.dianStatusMsg }}
                  </div>
                }

                <!-- Lista de errores DIAN (ErrorMessageList) -->
                @if (parseDianErrors(detailInvoice()!.dianErrors).length > 0) {
                  <div class="dian-errors-block">
                    <div class="dian-errors-header">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13" style="flex-shrink:0">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                      </svg>
                      <span>Respuesta de validación DIAN ({{ parseDianErrors(detailInvoice()!.dianErrors).length }} reglas)</span>
                    </div>
                    <ul class="dian-errors-list">
                      @for (err of parseDianErrors(detailInvoice()!.dianErrors); track $index) {
                        <li class="dian-error-item"
                            [class.dian-error-rechazo]="dianErrorSeverity(err) === 'rechazo'"
                            [class.dian-error-notif]="dianErrorSeverity(err) === 'notificacion'">
                          <span class="dian-error-badge">
                            {{ dianErrorSeverity(err) === 'notificacion' ? 'Notif.' : 'Rechazo' }}
                          </span>
                          <span class="dian-error-text">{{ err }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }

                                <!-- Pendiente -->
                @if (!detailInvoice()!.dianCufe && detailInvoice()!.status === 'DRAFT') {
                  <div class="dian-pending-note">
                    <strong>Factura pendiente de envío.</strong> Usa el botón "Enviar a DIAN" para generar el XML UBL 2.1 y transmitirla.
                  </div>
                }

                <!-- Enviada sin respuesta aún -->
                @if (detailInvoice()!.status === 'SENT_DIAN' && !detailInvoice()!.dianStatusCode) {
                  <div class="dian-pending-note" style="background:#eff6ff;border-color:#bfdbfe;color:#1e40af">
                    <strong>En proceso.</strong> La DIAN está validando la factura. Pulsa "Consultar DIAN" para obtener el resultado.
                  </div>
                }

              </div>
            </div>

            <!-- Notas -->
            @if (detailInvoice()!.notes) {
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"/></svg>
                  Notas
                </div>
                <div class="dw-notes">{{ detailInvoice()!.notes }}</div>
              </div>
            }

          </div><!-- /drawer-body -->

          <!-- Drawer footer -->
          <div class="drawer-footer">
            @if (detailInvoice()!.dianCufe) {
              <button class="btn btn-outline btn-sm" (click)="downloadXml(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
                XML UBL 2.1
              </button>
            }
            <button class="btn btn-outline btn-sm" (click)="openPdfPreview(detailInvoice()!)" [disabled]="loadingPdf()">
              @if (loadingPdf()) { <span class="btn-spinner"></span> Generando... }
              @else {
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
                Vista previa
              }
            </button>
            @if (detailInvoice()!.status === 'DRAFT') {
              <button class="btn btn-secondary btn-sm" (click)="openEditModal(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                Editar
              </button>
              <button class="btn btn-primary btn-sm" [disabled]="sending()[detailInvoice()!.id]"
                      (click)="issueInvoice(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                {{ sending()[detailInvoice()!.id] ? 'Enviando...' : 'Enviar a DIAN' }}
              </button>
            }
            @if (detailInvoice()!.dianZipKey || detailInvoice()!.dianCufe) {
              <button class="btn btn-outline btn-sm" [disabled]="querying()[detailInvoice()!.id]"
                      (click)="queryDianStatus(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
                {{ querying()[detailInvoice()!.id] ? 'Consultando...' : 'Consultar DIAN' }}
              </button>
            }
            @if (detailInvoice()!.status === 'ACCEPTED_DIAN' || detailInvoice()!.status === 'SENT_DIAN' || detailInvoice()!.status === 'ISSUED') {
              <button class="btn btn-success btn-sm" (click)="markPaid(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                Marcar pagada
              </button>
            }
            @if (detailInvoice()!.status === 'ACCEPTED_DIAN' && detailInvoice()!.type === 'VENTA') {
              <button class="btn btn-outline btn-sm" style="border-color:#9d174d;color:#9d174d"
                      (click)="openNoteModal(detailInvoice()!, 'credit')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
                Nota Crédito
              </button>
              <button class="btn btn-outline btn-sm" style="border-color:#92400e;color:#92400e"
                      (click)="openNoteModal(detailInvoice()!, 'debit')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Nota Débito
              </button>
            }
          </div>

        </div><!-- /drawer -->
      </div><!-- /drawer-overlay -->
    }

    <!-- PDF Preview Modal -->
    @if (showPdfModal()) {
      <div class="modal-overlay" >
        <div class="modal modal-pdf" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" style="color:#dc2626"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
              Vista previa de factura
            </h3>
            <button class="modal-close" (click)="closePdfModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="pdf-iframe-wrap">
            @if (loadingPdf()) {
              <div class="pdf-loading"><div class="pdf-spinner"></div><p>Generando previsualización...</p></div>
            } @else if (pdfUrl()) {
              <iframe [src]="pdfUrl()!" class="pdf-iframe" frameborder="0"></iframe>
            }
          </div>
          <div class="modal-footer">
            <span class="pdf-note">⚠ Las facturas en borrador incluyen marca de agua</span>
            <button class="btn btn-secondary" (click)="closePdfModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Draft Modal -->
    @if (showEditModal()) {
      <div class="modal-overlay modal-invoice-overlay" >
        <div class="modal modal-xl modal-invoice" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" style="color:#1a407e"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              Editar borrador — {{ detailInvoice()?.invoiceNumber }}
            </h3>
            <button class="modal-close" (click)="closeEditModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group"><label>Prefijo *</label><input type="text" [(ngModel)]="editInvoice.prefix" class="form-control" placeholder="FV"/></div>
              <div class="form-group"><label>Fecha emisión *</label><input type="date" [(ngModel)]="editInvoice.issueDate" class="form-control"/></div>
              <div class="form-group"><label>Fecha vencimiento</label><input type="date" [(ngModel)]="editInvoice.dueDate" class="form-control"/></div>
              <div class="form-group">
                <label>Moneda</label>
                <select [(ngModel)]="editInvoice.currency" class="form-control">
                  <option value="COP">COP</option><option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Cliente *</label>
              <select [(ngModel)]="editInvoice.customerId" class="form-control">
                <option value="">Seleccionar cliente...</option>
                @for (c of customers(); track c.id) { <option [value]="c.id">{{ c.name }} — {{ c.documentNumber }}</option> }
              </select>
            </div>
            <div class="form-section-title">
              Líneas de factura
              <button class="btn-add-line" (click)="addEditLine()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Agregar línea
              </button>
            </div>
            <div class="lines-table">
              <div class="lines-header">
                <span style="flex:3">Descripción</span><span style="flex:1">Cant.</span>
                <span style="flex:1.5">Precio unit.</span><span style="flex:1">IVA %</span>
                <span style="flex:1">Desc. %</span><span style="flex:1.5;text-align:right">Total</span>
                <span style="width:32px"></span>
              </div>
              @for (line of editLines; track $index; let i = $index) {
                <div class="lines-row">
                  <div class="line-cell line-cell--desc">
                    <span class="line-label">Descripción</span>
                    <select [(ngModel)]="line.productId" (ngModelChange)="onEditProductSelect(i, $event)" class="form-control form-sm">
                      <option value="">Descripción libre</option>
                      @for (p of lineProducts(); track p.id) { <option [value]="p.id">{{ p.name }} ({{ p.sku }})</option> }
                    </select>
                    @if (!line.productId) {
                      <input type="text" [(ngModel)]="line.description" class="form-control form-sm" style="margin-top:4px" placeholder="Descripción..."/>
                    }
                  </div>
                  <div class="line-cell line-cell--qty"><span class="line-label">Cant.</span><input type="number" [(ngModel)]="line.quantity" min="0.01" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--price"><span class="line-label">Precio unit.</span><input type="number" [(ngModel)]="line.unitPrice" min="0" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--tax"><span class="line-label">IVA %</span><input type="number" [(ngModel)]="line.taxRate" min="0" max="100" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--disc"><span class="line-label">Desc. %</span><input type="number" [(ngModel)]="line.discount" min="0" max="100" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--total"><span class="line-label">Total</span><span class="line-total">{{ fmtCOP(lineTotal(line)) }}</span></div>
                  <button class="btn-remove" (click)="removeEditLine(i)" [disabled]="editLines.length===1">×</button>
                </div>
              }
            </div>
            <div class="totals-box" style="margin-top:14px">
              <div class="totals-row"><span>Subtotal</span><strong>{{ fmtCOP(editSubtotal()) }}</strong></div>
              <div class="totals-row"><span>IVA</span><strong>{{ fmtCOP(editTax()) }}</strong></div>
              <div class="totals-row totals-total"><span>Total</span><strong>{{ fmtCOP(editSubtotal() + editTax()) }}</strong></div>
            </div>
            <div class="form-group" style="margin-top:14px">
              <label>Notas / observaciones</label>
              <textarea [(ngModel)]="editInvoice.notes" class="form-control" rows="2" placeholder="Información adicional..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeEditModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingEdit()" (click)="saveEdit()">
              {{ savingEdit() ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- New Invoice Modal -->
    @if (showModal()) {
      <div class="modal-overlay modal-invoice-overlay" >
        <div class="modal modal-xl modal-invoice" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva factura electrónica</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label>Tipo *</label>
                <select [(ngModel)]="newInvoice.type" class="form-control">
                  <option value="VENTA">Factura de venta</option>
                  <option value="NOTA_CREDITO">Nota crédito</option>
                  <option value="NOTA_DEBITO">Nota débito</option>
                </select>
              </div>
              <div class="form-group"><label>Prefijo *</label><input type="text" [(ngModel)]="newInvoice.prefix" class="form-control" placeholder="FV"/></div>
              <div class="form-group"><label>Fecha emisión *</label><input type="date" [(ngModel)]="newInvoice.issueDate" class="form-control"/></div>
              <div class="form-group"><label>Fecha vencimiento</label><input type="date" [(ngModel)]="newInvoice.dueDate" class="form-control"/></div>
            </div>
            <div class="form-group">
              <label>Cliente *</label>
              <select [(ngModel)]="newInvoice.customerId" class="form-control">
                <option value="">Seleccionar cliente...</option>
                @for (c of customers(); track c.id) { <option [value]="c.id">{{ c.name }} — {{ c.documentNumber }}</option> }
              </select>
            </div>
            <div class="form-section-title">
              Líneas de factura
              <button class="btn-add-line" (click)="addLine()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Agregar línea
              </button>
            </div>
            <div class="lines-table">
              <div class="lines-header">
                <span style="flex:3">Descripción</span><span style="flex:1">Cant.</span>
                <span style="flex:1.5">Precio unit.</span><span style="flex:1">IVA %</span>
                <span style="flex:1">Desc. %</span><span style="flex:1.5;text-align:right">Total</span>
                <span style="width:32px"></span>
              </div>
              @for (line of lines; track $index; let i = $index) {
                <div class="lines-row">
                  <div class="line-cell line-cell--desc">
                    <span class="line-label">Descripción</span>
                    <select [(ngModel)]="line.productId" (ngModelChange)="onProductSelect(i, $event)" class="form-control form-sm">
                      <option value="">Descripción libre</option>
                      @for (p of lineProducts(); track p.id) { <option [value]="p.id">{{ p.name }} ({{ p.sku }})</option> }
                    </select>
                    @if (!line.productId) {
                      <input type="text" [(ngModel)]="line.description" class="form-control form-sm" style="margin-top:4px" placeholder="Descripción del ítem..."/>
                    }
                  </div>
                  <div class="line-cell line-cell--qty"><span class="line-label">Cant.</span><input type="number" [(ngModel)]="line.quantity" (ngModelChange)="calcLine(i)" min="0.01" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--price"><span class="line-label">Precio unit.</span><input type="number" [(ngModel)]="line.unitPrice" (ngModelChange)="calcLine(i)" min="0" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--tax"><span class="line-label">IVA %</span><input type="number" [(ngModel)]="line.taxRate" (ngModelChange)="calcLine(i)" min="0" max="100" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--disc"><span class="line-label">Desc. %</span><input type="number" [(ngModel)]="line.discount" (ngModelChange)="calcLine(i)" min="0" max="100" class="form-control form-sm"/></div>
                  <div class="line-cell line-cell--total"><span class="line-label">Total</span><span class="line-total">{{ fmtCOP(lineTotal(line)) }}</span></div>
                  <button class="btn-remove" (click)="removeLine(i)" [disabled]="lines.length === 1">×</button>
                </div>
              }
            </div>
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><strong>{{ fmtCOP(subtotalVal()) }}</strong></div>
              <div class="totals-row"><span>IVA</span><strong>{{ fmtCOP(totalTaxVal()) }}</strong></div>
              <div class="totals-row totals-total"><span>Total</span><strong>{{ fmtCOP(subtotalVal() + totalTaxVal()) }}</strong></div>
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

    <!-- ── Modal Nota Crédito / Débito ─────────────────────────────── -->
    @if (noteModal() !== 'none') {
      <div class="modal-overlay" (click)="closeNoteModal()">
        <div class="modal modal-box modal-lg" (click)="$event.stopPropagation()">

          <div class="modal-header">
            <h3 class="modal-title">
              @if (noteModal() === 'credit') { Nueva Nota Crédito }
              @else { Nueva Nota Débito }
              <span class="ref-badge">Ref: {{ noteTarget()?.invoiceNumber }}</span>
            </h3>
            <button class="modal-close" (click)="closeNoteModal()">✕</button>
          </div>

          <!-- Balance info -->
          @if (noteModal() === 'credit') {
            <div class="balance-info">
              @if (loadingBalance()) {
                <span class="balance-loading">Calculando saldo...</span>
              } @else if (noteBalance()) {
                <span>Valor original: <strong>{{ noteBalance().originalTotal | number:'1.2-2' }}</strong></span>
                <span>Créditos emitidos: <strong style="color:#dc2626">−{{ noteBalance().totalCredits | number:'1.2-2' }}</strong></span>
                <span>Saldo disponible: <strong style="color:#059669">{{ noteBalance().remainingBalance | number:'1.2-2' }}</strong></span>
              }
            </div>
          }

          <div class="modal-body">

            <!-- Motivo -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Código de motivo DIAN *</label>
                <select [(ngModel)]="noteForm.discrepancyReasonCode" class="form-control">
                  @if (noteModal() === 'credit') {
                    <option value="1">1 – Devolución parcial de bienes</option>
                    <option value="2">2 – Anulación de factura electrónica</option>
                    <option value="3">3 – Rebaja total aplicada</option>
                    <option value="4">4 – Descuento total aplicado</option>
                    <option value="5">5 – Rescisión: nulidad por falta de requisitos</option>
                    <option value="6">6 – Otros</option>
                  } @else {
                    <option value="1">1 – Intereses</option>
                    <option value="2">2 – Gastos por cobrar</option>
                    <option value="3">3 – Cambio en el valor</option>
                    <option value="4">4 – Otros</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Prefijo documento</label>
                <input type="text" [(ngModel)]="noteForm.prefix" class="form-control" style="max-width:100px" placeholder="NC"/>
              </div>
              <div class="form-group">
                <label class="form-label">Fecha de emisión *</label>
                <input type="date" [(ngModel)]="noteForm.issueDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label class="form-label">Fecha vencimiento</label>
                <input type="date" [(ngModel)]="noteForm.dueDate" class="form-control"/>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Descripción del motivo *</label>
              <input type="text" [(ngModel)]="noteForm.discrepancyReason" class="form-control"
                     placeholder="Ej: Devolución de mercancía en mal estado"/>
            </div>

            <!-- Líneas -->
            <div class="note-lines-header">
              <span class="form-label" style="margin:0">Ítems de la nota</span>
              <button type="button" class="btn btn-sm btn-outline" (click)="addNoteLine()">+ Línea</button>
            </div>
            <div class="note-line note-line-head">
              <div class="nl-desc"><span class="nl-label">Descripción *</span></div>
              <div class="nl-num"><span class="nl-label">Cantidad</span></div>
              <div class="nl-num"><span class="nl-label">Precio unit.</span></div>
              <div class="nl-num"><span class="nl-label">Dto. %</span></div>
              <div class="nl-num"><span class="nl-label">IVA %</span></div>
              <div class="nl-total"><span class="nl-label">Total</span></div>
              <div class="nl-del"></div>
            </div>
            @for (item of noteForm.items; track $index; let i = $index) {
              <div class="note-line">
                <div class="nl-desc">
                  <input type="text" [(ngModel)]="item.description" class="form-control"
                         placeholder="Descripción del ítem"/>
                </div>
                <div class="nl-num">
                  <input type="number" [(ngModel)]="item.quantity" class="form-control" min="0.0001" step="0.01" placeholder="1"/>
                </div>
                <div class="nl-num">
                  <input type="number" [(ngModel)]="item.unitPrice" class="form-control" min="0" step="0.01" placeholder="0.00"/>
                </div>
                <div class="nl-num">
                  <input type="number" [(ngModel)]="item.discount" class="form-control" min="0" max="100" step="0.01" placeholder="0"/>
                </div>
                <div class="nl-num">
                  <input type="number" [(ngModel)]="item.taxRate" class="form-control" min="0" step="1" placeholder="19"/>
                </div>
                <div class="nl-total">
                  {{ noteLineTotal(item) | number:'1.2-2' }}
                </div>
                <div class="nl-del">
                  @if (noteForm.items.length > 1) {
                    <button type="button" class="icon-btn danger" (click)="removeNoteLine(i)" title="Eliminar línea">✕</button>
                  }
                </div>
              </div>
            }

            <div class="note-total-row">
              <span>Total nota:</span>
              <strong>{{ noteTotalAmount() | number:'1.2-2' }}</strong>
              @if (noteModal() === 'credit' && noteBalance() && noteTotalAmount() > noteBalance().remainingBalance + 0.01) {
                <span class="note-exceeds">⚠ Excede el saldo disponible</span>
              }
            </div>

            <div class="form-group" style="margin-top:12px">
              <label class="form-label">Observaciones</label>
              <input type="text" [(ngModel)]="noteForm.notes" class="form-control" placeholder="Notas adicionales (opcional)"/>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline btn-sm" (click)="closeNoteModal()">Cancelar</button>
            <button class="btn btn-primary btn-sm" (click)="submitNote()" [disabled]="saving()">
              @if (saving()) { Guardando... }
              @else {
                @if (noteModal() === 'credit') { Crear Nota Crédito }
                @else { Crear Nota Débito }
              }
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
    .dian-pendiente,.dian-undefined,.dian-pending { background:#f3f4f6; color:#6b7280; }
    .dian-aceptado,.dian-accepted_dian { background:#d1fae5; color:#065f46; }
    .dian-rechazado,.dian-rejected_dian { background:#fee2e2; color:#991b1b; }
    .dian-sent,.dian-enviada,.dian-issued { background:#dbeafe; color:#1e40af; }
    .dian-error { background:#fee2e2; color:#991b1b; }
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; white-space:nowrap; }
    .status-draft { background:#f3f4f6; color:#6b7280; }
    .status-sent_dian,.status-issued { background:#dbeafe; color:#1e40af; }
    .status-accepted_dian { background:#d1fae5; color:#065f46; }
    .status-rejected_dian { background:#fee2e2; color:#991b1b; }
    .status-paid { background:#d1fae5; color:#065f46; }
    .status-overdue { background:#fee2e2; color:#991b1b; }
    .status-cancelled { background:#f3f4f6; color:#6b7280; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; display:inline-flex; align-items:center; }
    .btn-icon:hover:not(:disabled) { background:#f0f4f9; color:#1a407e; }
    .btn-icon:disabled { opacity:.4; cursor:default; }
    .btn-icon-success:hover:not(:disabled) { background:#d1fae5; color:#065f46; }
    .btn-icon-blue:hover:not(:disabled) { background:#dbeafe; color:#1e40af; }
    .btn-icon-nc:hover:not(:disabled) { background:#fce7f3; color:#9d174d; }
    .btn-icon-nd:hover:not(:disabled) { background:#fef3c7; color:#92400e; }
    /* View toggle */
    .view-toggle { display:flex; border:1px solid #dce6f0; border-radius:8px; overflow:hidden; }
    .view-btn { background:#fff; border:none; padding:7px 10px; cursor:pointer; color:#9ca3af; transition:all .15s; display:inline-flex; align-items:center; }
    .view-btn:hover { background:#f0f4f9; color:#374151; }
    .view-btn-active { background:#1a407e; color:#fff !important; }
    /* Grid view */
    .inv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; padding:16px; }
    .inv-card { background:#fff; border:1px solid #dce6f0; border-radius:10px; padding:16px; cursor:pointer; transition:box-shadow .15s,border-color .15s; display:flex; flex-direction:column; gap:8px; }
    .inv-card:hover { border-color:#93c5fd; box-shadow:0 4px 12px rgba(26,64,126,.08); }
    .inv-card-top { display:flex; align-items:center; justify-content:space-between; }
    .inv-card-number { font-family:monospace; font-weight:700; color:#1a407e; font-size:14px; }
    .inv-card-type { display:flex; align-items:center; gap:6px; }
    .inv-card-client { font-weight:600; color:#0c1c35; font-size:13.5px; }
    .inv-card-doc { font-size:11.5px; color:#9ca3af; }
    .inv-card-total { font-size:16px; font-weight:700; color:#0c1c35; }
    .inv-card-meta { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#9ca3af; }
    .inv-card-actions { display:flex; gap:4px; padding-top:4px; border-top:1px solid #f0f4f8; }
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

    /* DRAWER */
    .drawer-overlay { position:fixed; inset:0; background:rgba(12,28,53,.4); z-index:100; display:flex; justify-content:flex-end; backdrop-filter:blur(2px); }
    .drawer { width:460px; max-width:100vw; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-8px 0 32px rgba(12,28,53,.12); }
    .drawer-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #f0f4f8; flex-shrink:0; gap:12px; }
    .drawer-header-left { flex:1; min-width:0; }
    .drawer-inv-number { font-family:'Sora',monospace; font-size:20px; font-weight:800; color:#0c1c35; letter-spacing:.5px; }
    .drawer-inv-meta { display:flex; align-items:center; gap:6px; margin-top:5px; flex-wrap:wrap; }
    .drawer-dot { color:#cbd5e1; font-size:12px; }
    .drawer-date { font-size:12px; color:#94a3b8; }
    .drawer-header-right { display:flex; align-items:center; gap:8px; flex-shrink:0; padding-top:2px; }
    .drawer-close { background:none; border:none; cursor:pointer; color:#94a3b8; padding:5px; border-radius:7px; transition:all .15s; }
    .drawer-close:hover { background:#f1f5f9; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:0; scrollbar-width:thin; scrollbar-color:#e2e8f0 transparent; }
    .drawer-body::-webkit-scrollbar { width:4px; }
    .drawer-body::-webkit-scrollbar-track { background:transparent; }
    .drawer-body::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }
    .dw-section { padding:16px 22px; border-bottom:1px solid #f8fafc; }
    .dw-section:last-child { border-bottom:none; }
    .dw-section-title { display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; margin-bottom:10px; }
    .dw-section-title svg { flex-shrink:0; }
    .dw-badge-count { background:#e8eef8; color:#1a407e; font-size:10px; font-weight:700; padding:1px 6px; border-radius:9999px; margin-left:4px; }
    .dw-card { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; padding:12px 14px; }
    .dw-client-name { font-size:14px; font-weight:700; color:#0c1c35; margin-bottom:2px; }
    .dw-client-doc { font-size:12px; color:#64748b; font-family:monospace; margin-bottom:4px; }
    .dw-client-extra { display:flex; align-items:center; gap:5px; font-size:12px; color:#64748b; margin-top:4px; }
    .dw-client-extra svg { color:#94a3b8; flex-shrink:0; }
    .dw-dates-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .dw-date-chip { background:#f8fafc; border:1px solid #f0f4f8; border-radius:8px; padding:8px 10px; text-align:center; }
    .dw-date-chip-overdue { background:#fff5f5; border-color:#fecaca; }
    .dw-date-chip-overdue .dw-date-val { color:#dc2626 !important; }
    .dw-date-lbl { display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin-bottom:3px; }
    .dw-date-val { display:block; font-size:12.5px; font-weight:700; color:#1e293b; }
    .dw-items-table { border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .dw-items-head { display:grid; grid-template-columns:1fr 52px 90px 48px 80px; align-items:center; padding:7px 12px; background:#f8fafc; border-bottom:1px solid #f0f4f8; }
    .dw-items-head span { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
    .dw-items-row { display:grid; grid-template-columns:1fr 52px 90px 48px 80px; align-items:center; padding:9px 12px; border-bottom:1px solid #f8fafc; transition:background .1s; }
    .dw-items-row:last-child { border-bottom:none; }
    .dw-items-row:hover { background:#fafcff; }
    .dw-items-row-odd { background:#fafcff; }
    .dw-items-row-odd:hover { background:#f0f6ff; }
    .dwi-col-desc { min-width:0; padding-right:8px; }
    .dwi-col-qty,.dwi-col-tax { text-align:center; font-size:12.5px; color:#475569; }
    .dwi-col-price { text-align:right; font-size:12px; color:#475569; padding-right:4px; }
    .dwi-col-total { text-align:right; font-size:12.5px; font-weight:700; color:#0c1c35; }
    .dwi-desc-text { display:block; font-size:13px; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dwi-sku { display:inline-block; font-size:10.5px; color:#94a3b8; font-family:monospace; margin-top:1px; }
    .dwi-disc { display:inline-block; font-size:10px; font-weight:700; color:#f59e0b; background:#fef3c7; padding:1px 5px; border-radius:4px; margin-left:4px; }
    .dw-items-empty { display:flex; align-items:center; gap:6px; font-size:12px; color:#94a3b8; padding:12px 0; }
    .dw-totals { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .dw-total-row { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border-bottom:1px solid #f0f4f8; font-size:13px; color:#64748b; }
    .dw-total-row:last-child { border-bottom:none; }
    .dw-total-disc { color:#f59e0b; }
    .dw-total-grand { background:#fff; border-top:2px solid #e8eef8 !important; border-bottom:none !important; }
    .dw-total-grand span:first-child { font-weight:700; font-size:14px; color:#0c1c35; }
    .dw-total-grand span:last-child { font-family:'Sora',sans-serif; font-size:17px; font-weight:800; color:#1a407e; }
    .dw-dian-card { padding:10px 14px; }
    .dw-dian-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .dw-dian-lbl { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; }
    .dw-dian-cufe { margin-top:8px; }
    .dw-cufe-code { display:block; font-size:10.5px; color:#475569; font-family:monospace; word-break:break-all; margin-top:4px; background:#f1f5f9; padding:6px 8px; border-radius:6px; line-height:1.5; }
    .dian-msg-block { margin-top:8px; padding:8px 10px; background:#f8fafc; border-radius:7px; border-left:3px solid #94a3b8; font-size:12px; color:#374151; line-height:1.5; }
    .dian-msg-ok { border-left-color:#10b981; background:#f0fdf4; }
    .dian-msg-err { border-left-color:#dc2626; background:#fef2f2; }
    .dian-pending-note { margin-top:10px; padding:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; font-size:12px; color:#92400e; line-height:1.5; }

    /* DIAN error list */
    .dian-errors-block { margin-top:10px; border:1px solid #fca5a5; border-radius:8px; overflow:hidden; }
    .dian-errors-header { display:flex; align-items:center; gap:6px; padding:7px 10px; background:#fef2f2; font-size:11.5px; font-weight:600; color:#b91c1c; border-bottom:1px solid #fca5a5; }
    .dian-errors-list { list-style:none; margin:0; padding:0; }
    .dian-error-item { display:flex; align-items:flex-start; gap:6px; padding:6px 10px; font-size:11.5px; line-height:1.45; border-bottom:1px solid #fee2e2; }
    .dian-error-item:last-child { border-bottom:none; }
    .dian-error-rechazo { background:#fff5f5; }
    .dian-error-notif { background:#fafafa; }
    .dian-error-badge { flex-shrink:0; margin-top:1px; padding:1px 5px; border-radius:3px; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; }
    .dian-error-rechazo .dian-error-badge { background:#fee2e2; color:#b91c1c; }
    .dian-error-notif .dian-error-badge { background:#e0f2fe; color:#0369a1; }
    .dian-error-text { color:#374151; }
    .dw-notes { font-size:13px; color:#475569; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; line-height:1.5; }
    .drawer-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap; }

    /* MODALS */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; }
    .modal-xl { max-width:900px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; flex-shrink:0; gap:10px; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; display:flex; align-items:center; gap:8px; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; align-items:center; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; flex-shrink:0; }
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

    /* PDF modal */
    .modal-pdf { max-width:900px; height:90vh; }
    .pdf-iframe-wrap { flex:1; overflow:hidden; background:#e5e7eb; }
    .pdf-iframe { width:100%; height:100%; border:none; }
    .pdf-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px; color:#94a3b8; }
    .pdf-spinner { width:40px; height:40px; border:4px solid #e2e8f0; border-top-color:#1a407e; border-radius:50%; animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .pdf-note { font-size:12px; color:#94a3b8; margin-right:auto; }

    /* Buttons */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-sm { padding:7px 13px; font-size:13px; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover:not(:disabled) { background:#e8eef8; }
    .btn-success { background:#065f46; color:#fff; border:none; }
    .btn-success:hover:not(:disabled) { background:#047857; }
    .btn-outline { background:#fff; border:1px solid #dce6f0; color:#374151; }
    .btn-outline:hover:not(:disabled) { background:#f8fafc; border-color:#1a407e; color:#1a407e; }
    .btn-outline:disabled, .btn-primary:disabled, .btn-secondary:disabled { opacity:.5; cursor:not-allowed; }
    .btn-spinner { width:13px; height:13px; border:2px solid rgba(0,0,0,.15); border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }

    /* Line labels — hidden desktop, visible mobile */
    .line-label { display:none; }
    .line-cell { display:contents; }
    .lines-row { display:flex; align-items:flex-start; gap:8px; padding:8px 12px; border-top:1px solid #f0f4f8; }
    .line-cell--desc  { flex:3; }
    .line-cell--qty   { flex:1; }
    .line-cell--price { flex:1.5; }
    .line-cell--tax   { flex:1; }
    .line-cell--disc  { flex:1; }
    .line-cell--total { flex:1.5; display:flex; align-items:center; justify-content:flex-end; }
    @media (min-width:601px) { .line-cell { display:flex; flex-direction:column; } }

    /* Responsive */
    @media (max-width:768px) {
      .kpi-strip { grid-template-columns:1fr 1fr; }
      .modal-invoice { max-width:100% !important; }
      .modal-body { padding:16px 18px; } .modal-header { padding:14px 18px; } .modal-footer { padding:12px 18px; gap:8px; }
      .form-row-3 { grid-template-columns:1fr 1fr !important; gap:10px; }
    }
    @media (max-width:600px) {
      .kpi-strip { grid-template-columns:1fr 1fr; }
      .modal-invoice-overlay { align-items:flex-end !important; padding:0 !important; }
      .modal-invoice { border-radius:20px 20px 0 0 !important; max-height:96vh !important; max-width:100% !important; width:100% !important; }
      .modal-header { padding:14px 16px 12px; } .modal-header h3 { font-size:15px; }
      .modal-body { padding:14px 16px 8px; }
      .form-row-3 { grid-template-columns:1fr 1fr !important; gap:8px; }
      .modal-footer { padding:10px 16px 16px; flex-direction:column-reverse !important; gap:8px !important; align-items:stretch !important; }
      .modal-footer .btn { width:100% !important; justify-content:center !important; }
      .lines-header { display:none !important; }
      .lines-row { display:grid !important; grid-template-columns:1fr 1fr !important; gap:8px !important; padding:12px 12px 14px !important; border-top:1px solid #f0f4f8; border-radius:8px; background:#fafcff; margin:6px 0; position:relative; }
      .line-cell { display:flex !important; flex-direction:column !important; gap:4px; }
      .line-cell--desc { grid-column:1 / -1; } .line-cell--qty { grid-column:1; } .line-cell--price { grid-column:2; }
      .line-cell--tax { grid-column:1; } .line-cell--disc { grid-column:2; }
      .line-cell--total { grid-column:1 / -1; justify-content:flex-end !important; border-top:1px dashed #e5e7eb; padding-top:6px; margin-top:2px; }
      .line-label { display:block !important; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:2px; }
      .btn-remove { position:absolute !important; top:10px; right:10px; background:#fee2e2 !important; color:#dc2626 !important; border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:16px; padding:0 !important; }
      .btn-remove:disabled { background:#f1f5f9 !important; color:#cbd5e1 !important; }
      .totals-box { padding:12px 14px; } .totals-row { font-size:13px; }
      .totals-total { font-size:14px !important; } .totals-total span, .totals-total strong { font-size:14px !important; }
    }
    @media (max-width:400px) {
      .form-row-3 { grid-template-columns:1fr !important; }
      .modal-header h3 { font-size:14px; }
    }

    /* Note modal */
    .modal-lg { max-width: 720px; }
    .ref-badge { font-size:12px; font-weight:500; color:#6b7280; background:#f3f4f6; padding:2px 8px; border-radius:6px; margin-left:8px; }
    .balance-info { display:flex; flex-wrap:wrap; gap:16px; padding:10px 16px; background:#f0fdf4; border-radius:8px; margin:0 0 16px; font-size:13px; color:#374151; }
    .balance-loading { color:#9ca3af; font-size:13px; }
    .note-lines-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
    .note-line { display:grid; grid-template-columns:1fr 80px 110px 70px 70px 100px 28px; gap:6px; align-items:center; margin-bottom:6px; }
    .note-line-head { margin-bottom:2px; }
    .nl-label { font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.04em; }
    .nl-desc, .nl-num, .nl-total, .nl-del { font-size:13px; }
    .nl-total { text-align:right; color:#374151; font-weight:600; font-size:13px; padding-right:4px; }
    .nl-del { display:flex; justify-content:center; }
    .note-total-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-top:1px solid #e5e7eb; font-size:14px; margin-top:4px; }
    .note-total-row strong { font-size:15px; color:#0c1c35; }
    .note-exceeds { color:#dc2626; font-size:12px; font-weight:600; }
    .balance-strip { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; font-size:12.5px; cursor:pointer; margin-bottom:12px; }
    .balance-label { color:#0369a1; font-weight:600; }
    .balance-value { color:#0284c7; }
    .icon-btn { background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:4px; font-size:13px; }
    .icon-btn.danger { color:#9ca3af; }
    .icon-btn.danger:hover { color:#dc2626; background:#fee2e2; }
    .form-row { display:grid; grid-template-columns:1fr auto auto; gap:12px; margin-bottom:12px; }
    .form-label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .modal-box { background:#fff; border-radius:16px; width:100%; max-height:90vh; display:flex; flex-direction:column; }
  `]
})
export class InvoicesListComponent implements OnInit {
  private readonly API      = `${environment.apiUrl}/invoices`;
  private readonly CUST_API = `${environment.apiUrl}/customers`;
  private readonly PROD_API = `${environment.apiUrl}/products`;

  invoices     = signal<Invoice[]>([]);
  customers    = signal<Customer[]>([]);
  lineProducts = signal<Product[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  savingEdit   = signal(false);
  total        = signal(0);
  page         = signal(1);
  totalPages   = signal(1);

  detailInvoice = signal<Invoice | null>(null);
  showModal     = signal(false);
  viewMode      = signal<'table' | 'grid'>('table');
  showPdfModal  = signal(false);
  showEditModal = signal(false);
  pdfUrl        = signal<SafeResourceUrl | null>(null);
  objectUrl: string | null = null;
  loadingPdf    = signal(false);

  // DIAN async state tracking
  sending  = signal<Record<string, boolean>>({});
  querying = signal<Record<string, boolean>>({});

  // Credit / Debit note modal state
  noteModal      = signal<'none'|'credit'|'debit'>('none');
  noteTarget     = signal<Invoice | null>(null);
  noteBalance    = signal<any>(null);
  loadingBalance = signal(false);
  noteForm = {
    prefix:                'NC',
    discrepancyReasonCode: '1',
    discrepancyReason:     '',
    items:                 [] as any[],
    notes:                 '',
    issueDate:             new Date().toISOString().substring(0, 10),
    dueDate:               '',
  };

  editInvoice = { customerId:'', prefix:'FV', issueDate:'', dueDate:'', notes:'', currency:'COP' };
  editLines: InvoiceLine[] = [];

  lines: InvoiceLine[] = [this.newLine()];
  newInvoice = { type:'VENTA', prefix:'FV', issueDate:new Date().toISOString().slice(0,10), dueDate:'', customerId:'', notes:'' };

  search = ''; filterStatus = ''; filterType = ''; filterFrom = ''; filterTo = '';
  private searchTimer: any;

  kpis: Array<{ label:string; value:string }> = [
    { label:'Este mes',        value:'$0' },
    { label:'Pendientes DIAN', value:'0'  },
    { label:'Vencidas',        value:'0'  },
    { label:'Pagadas',         value:'0'  },
  ];

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() { this.load(); this.loadCustomers(); this.loadProducts(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search)       params.search = this.search;
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterType)   params.type   = this.filterType;
    if (this.filterFrom)   params.from   = this.filterFrom;
    if (this.filterTo)     params.to     = this.filterTo;
    this.http.get<any>(this.API, { params }).subscribe({
      next: r => {
        this.invoices.set(r?.data ?? r);
        this.total.set(r?.total ?? r.length);
        this.totalPages.set(r?.totalPages ?? 1);
        this.loading.set(false);
        this.computeKpis(r?.data ?? r);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar facturas'); }
    });
  }

  computeKpis(data: Invoice[]) {
    const now = new Date(), m = now.getMonth(), y = now.getFullYear();
    const thisMonth = data.filter(i => { const d = new Date(i.issueDate); return d.getMonth()===m && d.getFullYear()===y && i.status!=='CANCELLED'; });
    this.kpis = [
      { label:'Este mes',        value:this.fmtCOP(thisMonth.reduce((s,i)=>s+Number(i.total),0)) },
      { label:'Pendientes DIAN', value:String(data.filter(i=>['SENT_DIAN','DRAFT','ISSUED'].includes(i.status)).length) },
      { label:'Vencidas',        value:String(data.filter(i=>i.status==='OVERDUE').length) },
      { label:'Pagadas',         value:String(data.filter(i=>i.status==='PAID').length) },
    ];
  }

  loadCustomers() { this.http.get<any>(`${this.CUST_API}?limit=200`).subscribe({ next: r => this.customers.set(r.data ?? r), error: ()=>{} }); }
  loadProducts()  { this.http.get<any>(`${this.PROD_API}?limit=100&status=ACTIVE`).subscribe({ next: r => this.lineProducts.set(r.data ?? r), error: ()=>{} }); }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(()=>{ this.page.set(1); this.load(); }, 350); }
  setPage(p: number) { this.page.set(p); this.load(); }
  pageRange(): number[] { const tp=this.totalPages(),cp=this.page(),r:number[]=[]; for(let i=Math.max(1,cp-2);i<=Math.min(tp,cp+2);i++) r.push(i); return r; }

  openNewInvoice() {
    this.lines = [this.newLine()];
    this.newInvoice = { type:'VENTA', prefix:'FV', issueDate:new Date().toISOString().slice(0,10), dueDate:'', customerId:'', notes:'' };
    this.showModal.set(true);
  }
  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales — solo el botón X
  }

    closeModal()  { this.showModal.set(false); }
  addLine()     { this.lines.push(this.newLine()); }
  removeLine(i: number) { this.lines.splice(i, 1); }

  onProductSelect(i: number, productId: string) {
    if (!productId) return;
    const p = this.lineProducts().find(p => p.id === productId);
    if (p) { this.lines[i].description = p.name; this.lines[i].unitPrice = Number(p.price); this.lines[i].taxRate = Number(p.taxRate); }
  }
  calcLine(i: number) {}

  lineTotal(line: InvoiceLine): number { const base = line.quantity * line.unitPrice * (1 - line.discount/100); return base + base * (line.taxRate/100); }
  subtotalVal(): number { return this.lines.reduce((s,l)=>s+l.quantity*l.unitPrice*(1-l.discount/100),0); }
  totalTaxVal(): number { return this.lines.reduce((s,l)=>{ const b=l.quantity*l.unitPrice*(1-l.discount/100); return s+b*(l.taxRate/100); },0); }

  saveInvoice(sendDian: boolean) {
    if (!this.newInvoice.customerId) { this.notify.warning('Selecciona un cliente'); return; }
    if (this.lines.some(l=>!l.description&&!l.productId)) { this.notify.warning('Todas las líneas necesitan descripción'); return; }
    this.saving.set(true);
    const body = { ...this.newInvoice, dueDate:this.newInvoice.dueDate||undefined, sendToDian:sendDian,
      items:this.lines.map((l,i)=>({ productId:l.productId||undefined, description:l.description, quantity:l.quantity, unitPrice:l.unitPrice, taxRate:l.taxRate, discount:l.discount, position:i+1 })) };
    this.http.post(this.API, body).subscribe({
      next: () => { this.notify.success(sendDian?'Factura creada y enviada a DIAN':'Factura guardada como borrador'); this.saving.set(false); this.closeModal(); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al crear factura'); }
    });
  }

  viewDetail(inv: Invoice) {
    this.http.get<any>(`${this.API}/${inv.id}`).subscribe({
      next: r  => this.detailInvoice.set(r.data ?? r),
      error: () => this.detailInvoice.set(inv),
    });
  }

  // ── DIAN: Enviar XML UBL 2.1 ──────────────────────────────────────────
  issueInvoice(inv: Invoice) {
    this.sending.update(s => ({ ...s, [inv.id]: true }));
    this.http.post<any>(`${this.API}/${inv.id}/issue`, {}).subscribe({
      next: res => {
        this.sending.update(s => ({ ...s, [inv.id]: false }));
        // Backend returns the updated invoice directly (Prisma record)
        const updated: Invoice = res?.data ?? res;
        this.load();
        if (this.detailInvoice()?.id === inv.id) this.detailInvoice.set(updated);
        const zipKey  = updated?.dianZipKey  ?? res?.dianResult?.zipKey;
        const errors: string[] = res?.dianResult?.errorMessages ?? [];
        if (zipKey) {
          this.notify.success(`✓ Enviada a DIAN (ZipKey: ${zipKey.slice(0,8)}…) — pulsa "Consultar DIAN" para confirmar aceptación.`);
        } else if (errors.length > 0) {
          this.notify.error(`DIAN rechazó: ${errors.slice(0, 2).join(' | ')}`);
        } else {
          this.notify.warning(`Factura procesada sin ZipKey — revisa el estado manualmente.`);
        }
      },
      error: err => {
        this.sending.update(s => ({ ...s, [inv.id]: false }));
        const msg = err?.error?.message ?? err?.message ?? 'Error al enviar a la DIAN';
        this.notify.error(msg);
      }
    });
  }

  // ── DIAN: Consultar estado ────────────────────────────────────────────
  queryDianStatus(inv: Invoice) {
    this.querying.update(q => ({ ...q, [inv.id]: true }));
    this.http.post<any>(`${this.API}/${inv.id}/dian-status`, {}).subscribe({
      next: res => {
        this.querying.update(q => ({ ...q, [inv.id]: false }));
        // Backend returns the updated Prisma invoice record directly
        const updated: Invoice = res?.data ?? res;
        this.load();
        if (this.detailInvoice()?.id === inv.id) this.detailInvoice.set(updated);
        const invStatus = updated?.status ?? res?.status;
        const code      = updated?.dianStatusCode ?? res?.dianStatusCode ?? '—';
        const msg       = updated?.dianStatusMsg  ?? res?.dianStatusMsg  ?? '';
        if (invStatus === 'ACCEPTED_DIAN') {
          this.notify.success('✓ Factura aceptada por la DIAN (código 00)');
        } else if (invStatus === 'REJECTED_DIAN') {
          const detail = msg ? ` — ${msg.slice(0, 120)}` : '';
          this.notify.error(`✗ Rechazada por DIAN (código ${code})${detail}`);
        } else {
          this.notify.info(`Estado DIAN: código ${code} — ${msg || 'En proceso'}`);
        }
      },
      error: err => {
        this.querying.update(q => ({ ...q, [inv.id]: false }));
        const msg = err?.error?.message ?? err?.message ?? 'Error al consultar DIAN';
        this.notify.error(msg);
      }
    });
  }

  // ── DIAN: Descargar XML firmado ───────────────────────────────────────
  downloadXml(inv: Invoice) {
    this.http.get(`${this.API}/${inv.id}/xml`, { responseType:'text' }).subscribe({
      next: xml => {
        const blob = new Blob([xml], { type:'application/xml' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href:url, download:`${inv.prefix}${inv.invoiceNumber}.xml` });
        a.click(); URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('XML no disponible aún para esta factura'),
    });
  }

  openPdfPreview(inv: Invoice) {
    this.loadingPdf.set(true); this.showPdfModal.set(true);
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${this.API}/${inv.id}/pdf`, { responseType:'blob', headers:{ Authorization:`Bearer ${token}` } }).subscribe({
      next: blob => { this.objectUrl = URL.createObjectURL(new Blob([blob], { type:'text/html' })); this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl)); this.loadingPdf.set(false); },
      error: () => { this.loadingPdf.set(false); this.notify.error('Error al generar la vista previa'); }
    });
  }
  closePdfModal() { if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; } this.pdfUrl.set(null); this.showPdfModal.set(false); }

  openEditModal(inv: Invoice) {
    this.editInvoice = { customerId:inv.customer.id, prefix:inv.prefix, issueDate:inv.issueDate?.slice(0,10)??'', dueDate:inv.dueDate?.slice(0,10)??'', notes:inv.notes??'', currency:inv.currency??'COP' };
    this.editLines = (inv.items??[]).map(it => ({ productId:it.product?.id??'', description:it.description, quantity:Number(it.quantity), unitPrice:Number(it.unitPrice), taxRate:Number(it.taxRate), discount:Number(it.discount) }));
    if (this.editLines.length === 0) this.editLines = [this.newLine()];
    this.showEditModal.set(true);
  }
  closeEditModal() { this.showEditModal.set(false); }
  addEditLine()    { this.editLines.push(this.newLine()); }
  removeEditLine(i: number) { if (this.editLines.length > 1) this.editLines.splice(i, 1); }
  onEditProductSelect(i: number, productId: string) {
    if (!productId) return;
    const p = this.lineProducts().find(p => p.id === productId);
    if (p) { this.editLines[i].description = p.name; this.editLines[i].unitPrice = Number(p.price); this.editLines[i].taxRate = Number(p.taxRate); }
  }
  editSubtotal() { return this.editLines.reduce((s,l)=>s+l.quantity*l.unitPrice*(1-l.discount/100),0); }
  editTax()      { return this.editLines.reduce((s,l)=>{ const b=l.quantity*l.unitPrice*(1-l.discount/100); return s+b*(l.taxRate/100); },0); }

  saveEdit() {
    const inv = this.detailInvoice(); if (!inv) return;
    if (!this.editInvoice.customerId) { this.notify.warning('Selecciona un cliente'); return; }
    if (this.editLines.some(l=>!l.description&&!l.productId)) { this.notify.warning('Todas las líneas necesitan descripción'); return; }
    this.savingEdit.set(true);
    const body = { customerId:this.editInvoice.customerId, prefix:this.editInvoice.prefix, issueDate:this.editInvoice.issueDate, dueDate:this.editInvoice.dueDate||undefined, notes:this.editInvoice.notes, currency:this.editInvoice.currency,
      items:this.editLines.map((l,i)=>({ productId:l.productId||undefined, description:l.description, quantity:l.quantity, unitPrice:l.unitPrice, taxRate:l.taxRate, discount:l.discount, position:i+1 })) };
    this.http.patch<any>(`${this.API}/${inv.id}`, body).subscribe({
      next: r => { this.notify.success('Factura actualizada'); this.savingEdit.set(false); this.showEditModal.set(false); this.detailInvoice.set(r.data ?? r); this.load(); },
      error: e => { this.savingEdit.set(false); this.notify.error(e?.error?.message ?? 'Error al guardar'); }
    });
  }

  markPaid(inv: Invoice) {
    this.http.patch(`${this.API}/${inv.id}/paid`, {}).subscribe({
      next: () => { this.notify.success('Factura marcada como pagada'); this.detailInvoice.set(null); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error al marcar como pagada')
    });
  }

  copyText(text: string) { navigator.clipboard.writeText(text).then(()=>this.notify.success('Copiado al portapapeles')); }

  isOverdue(inv: Invoice): boolean { return inv.dueDate ? new Date(inv.dueDate) < new Date() && inv.status!=='PAID' && inv.status!=='CANCELLED' : false; }
  typeLabel(t: string)   { return ({ VENTA:'Venta', NOTA_CREDITO:'N. Crédito', NOTA_DEBITO:'N. Débito', SOPORTE_ADQUISICION:'Soporte' } as any)[t] ?? t; }
  statusLabel(s: string) { return ({ DRAFT:'Borrador', SENT_DIAN:'Enviada', ISSUED:'Enviada', ACCEPTED_DIAN:'Aceptada', REJECTED_DIAN:'Rechazada', PAID:'Pagada', CANCELLED:'Anulada', OVERDUE:'Vencida' } as any)[s] ?? s; }
  dianLabel(s?: string)  { if (!s) return 'Pendiente'; return ({ ACEPTADO:'Aceptado', RECHAZADO:'Rechazado', PENDIENTE:'Pendiente', ACCEPTED_DIAN:'Aceptado', REJECTED_DIAN:'Rechazado', SENT:'Enviado', ISSUED:'Enviado', ERROR:'Error' } as any)[s] ?? s; }
  dianCodeDesc(code?: string): string { return ({ '00':'Procesado correctamente','0':'Procesado correctamente','66':'NSU no encontrado','90':'TrackId no encontrado','99':'Errores de validación' } as any)[code??''] ?? ''; }
  parseDianErrors(raw?: string): string[] {
    if (!raw) return [];
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [String(arr)]; }
    catch { return raw.split(';').map(s => s.trim()).filter(Boolean); }
  }
  dianErrorSeverity(msg: string): 'rechazo' | 'notificacion' {
    return /Notificaci/i.test(msg) ? 'notificacion' : 'rechazo';
  }
  fmtCOP(v: number) { return new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v); }
  min(a: number, b: number) { return Math.min(a, b); }
  private newLine(): InvoiceLine { return { productId:'', description:'', quantity:1, unitPrice:0, taxRate:19, discount:0 }; }

  // ── Notas Crédito / Débito ───────────────────────────────────────────

  async openNoteModal(inv: Invoice, type: 'credit' | 'debit') {
    this.noteTarget.set(inv);
    this.noteModal.set(type === 'credit' ? 'credit' : 'debit');
    this.noteForm.prefix = type === 'credit' ? 'NC' : 'ND';
    this.noteForm.discrepancyReasonCode = type === 'credit' ? '1' : '6';
    this.noteForm.discrepancyReason = '';
    this.noteForm.items = [{ productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 }];
    this.noteForm.issueDate = new Date().toISOString().substring(0, 10);
    // Load balance
    this.loadingBalance.set(true);
    this.http.get<any>(`${this.API}/${inv.id}/balance`).subscribe({
      next: bal => { this.noteBalance.set(bal); this.loadingBalance.set(false); },
      error: ()  => this.loadingBalance.set(false),
    });
  }

  closeNoteModal() {
    this.noteModal.set('none');
    this.noteTarget.set(null);
    this.noteBalance.set(null);
  }

  addNoteLine() {
    this.noteForm.items = [...this.noteForm.items, { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 }];
  }

  removeNoteLine(i: number) {
    this.noteForm.items = this.noteForm.items.filter((_, idx) => idx !== i);
  }

  noteLineTotal(item: any): number {
    const sub = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return sub * (1 + item.taxRate / 100);
  }

  noteTotalAmount(): number {
    return this.noteForm.items.reduce((s, item) => s + this.noteLineTotal(item), 0);
  }

  submitNote() {
    const inv = this.noteTarget();
    if (!inv) return;
    const type = this.noteModal();
    if (type === 'none') return;

    if (!this.noteForm.discrepancyReason.trim()) {
      this.notify.error('Ingresa la descripción del motivo'); return;
    }
    if (this.noteForm.items.length === 0 || this.noteForm.items.some(i => !i.description || i.unitPrice <= 0)) {
      this.notify.error('Completa todas las líneas de la nota'); return;
    }
    const bal = this.noteBalance();
    if (type === 'credit' && bal && this.noteTotalAmount() > bal.remainingBalance + 0.01) {
      this.notify.error(`El valor (${this.noteTotalAmount().toFixed(2)}) supera el saldo disponible (${bal.remainingBalance.toFixed(2)})`); return;
    }

    const endpoint = type === 'credit'
      ? `${this.API}/${inv.id}/credit-note`
      : `${this.API}/${inv.id}/debit-note`;

    const body = {
      customerId:            inv.customer.id,
      prefix:                this.noteForm.prefix,
      discrepancyReasonCode: this.noteForm.discrepancyReasonCode,
      discrepancyReason:     this.noteForm.discrepancyReason,
      issueDate:             this.noteForm.issueDate,
      dueDate:               this.noteForm.dueDate || undefined,
      notes:                 this.noteForm.notes,
      items: this.noteForm.items.map((item, i) => ({
        ...(item.productId ? { productId: item.productId } : {}),
        description: item.description,
        quantity:    Number(item.quantity),
        unitPrice:   Number(item.unitPrice),
        taxRate:     Number(item.taxRate ?? 19),
        discount:    Number(item.discount ?? 0),
        position:    i + 1,
      })),
    };

    this.saving.set(true);
    this.http.post<any>(endpoint, body).subscribe({
      next: () => {
        this.notify.success(type === 'credit' ? 'Nota crédito creada' : 'Nota débito creada');
        this.closeNoteModal();
        this.load();
        this.saving.set(false);
      },
      error: err => {
        this.notify.error(err?.error?.message || 'Error al crear la nota');
        this.saving.set(false);
      },
    });
  }
}