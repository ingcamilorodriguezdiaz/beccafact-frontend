import { Component, HostListener, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../model/paginate-response.model';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';

// ── Interfaces de dominio ─────────────────────────────────────────────────────

interface Quote {
  id: string;
  number: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED';
  issueDate: string;
  expiresAt?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes?: string;
  terms?: string;
  currency: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customer: { id: string; name: string; documentNumber: string };
  items?: QuoteItem[];
  createdAt: string;
}

interface QuoteItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  position: number;
}

// Línea editable en el formulario de cotización
interface QuoteLineForm {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

interface CustomerOption {
  id: string;
  name: string;
  documentNumber: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  taxRate?: number;
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <section class="hero-shell">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Gestión comercial</p>
            <h2 class="page-title">Cotizaciones</h2>
            <p class="page-subtitle">Crea, envía y convierte cotizaciones a facturas. Controla el ciclo de ventas desde la propuesta hasta el cierre.</p>
          </div>
          <button class="btn btn-primary" (click)="openFormModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            Nueva cotización
          </button>
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Total cotizaciones</span>
            <strong>{{ total() }}</strong>
            <small>{{ draftCount() }} borradores · {{ acceptedCount() }} aceptadas</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Enviadas</span>
              <strong>{{ sentCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Convertidas</span>
              <strong>{{ convertedCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Rechazadas</span>
              <strong>{{ rejectedCount() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- ── KPI strip ──────────────────────────────────────────────────────── -->
      <section class="kpi-strip">
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
            </svg>
          </div>
          <div>
            <span class="kpi-card__label">Borradores</span>
            <strong class="kpi-card__value">{{ draftCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.25 2.94 6.34z"/>
              <path d="M18 8.17l-7.37 4.08a1.5 1.5 0 01-1.26 0L2 8.17V14a2 2 0 002 2h12a2 2 0 002-2V8.17z"/>
            </svg>
          </div>
          <div>
            <span class="kpi-card__label">Enviadas</span>
            <strong class="kpi-card__value">{{ sentCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon kpi-card__icon--success">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
            </svg>
          </div>
          <div>
            <span class="kpi-card__label">Aceptadas</span>
            <strong class="kpi-card__value">{{ acceptedCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon kpi-card__icon--purple">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
              <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h2a1 1 0 010 2H5a1 1 0 01-1-1z"/>
            </svg>
          </div>
          <div>
            <span class="kpi-card__label">Convertidas</span>
            <strong class="kpi-card__value">{{ convertedCount() }}</strong>
          </div>
        </article>
      </section>

      <!-- ── Filtros ─────────────────────────────────────────────────────────── -->
      <section class="filters-shell">
        <div class="filters-head">
          <div>
            <p class="filters-kicker">Exploración</p>
            <h3>Filtra y encuentra cotizaciones</h3>
          </div>
          <div class="results-pill">{{ total() }} resultados</div>
        </div>
        <div class="filters-bar">
          <div class="search-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
            </svg>
            <input type="text" placeholder="Buscar por número o cliente..."
                   [(ngModel)]="search" (ngModelChange)="onSearch()" class="search-input"/>
          </div>
          <select [(ngModel)]="filterStatus" (ngModelChange)="onFilterChange()" class="filter-select">
            <option value="">Todos los estados</option>
            <option value="DRAFT">Borrador</option>
            <option value="SENT">Enviada</option>
            <option value="ACCEPTED">Aceptada</option>
            <option value="REJECTED">Rechazada</option>
            <option value="EXPIRED">Vencida</option>
            <option value="CONVERTED">Convertida</option>
          </select>
          <input type="date" [(ngModel)]="filterDateFrom" (ngModelChange)="onFilterChange()"
                 class="filter-select" title="Desde"/>
          <input type="date" [(ngModel)]="filterDateTo" (ngModelChange)="onFilterChange()"
                 class="filter-select" title="Hasta"/>
        </div>
      </section>

      <!-- ── Tabla ───────────────────────────────────────────────────────────── -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-line" style="width:100px"></div>
                <div class="sk sk-line" style="width:80px"></div>
                <div class="sk sk-line" style="width:80px"></div>
                <div class="sk sk-line" style="width:160px"></div>
                <div class="sk sk-line" style="width:70px"></div>
                <div class="sk sk-line" style="width:100px"></div>
              </div>
            }
          </div>
        } @else if (quotes().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
            </svg>
            <p>{{ search || filterStatus ? 'Sin resultados para los filtros aplicados' : 'No hay cotizaciones registradas aún' }}</p>
            @if (!search && !filterStatus) {
              <button class="btn btn-primary btn-sm" (click)="openFormModal()">Crear primera cotización</button>
            }
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>N° Cotización</th>
                <th>Fecha</th>
                <th>Vence</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th class="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (q of quotes(); track q.id) {
                <tr>
                  <td>
                    <span class="quote-number">{{ q.number }}</span>
                  </td>
                  <td class="text-muted">{{ formatDate(q.issueDate) }}</td>
                  <td class="text-muted">{{ q.expiresAt ? formatDate(q.expiresAt) : '—' }}</td>
                  <td>
                    <div class="customer-cell">
                      <div class="cust-avatar">{{ initials(q.customer.name) }}</div>
                      <div>
                        <div class="cust-name">{{ q.customer.name }}</div>
                        <div class="cust-email">{{ q.customer.documentNumber }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="status-badge status-{{ q.status.toLowerCase() }}">
                      {{ statusLabel(q.status) }}
                    </span>
                  </td>
                  <td class="text-right">
                    <strong class="quote-total">{{ formatCurrency(q.total) }}</strong>
                  </td>
                  <td class="actions-cell">
                    <!-- Ver detalle -->
                    <button class="btn-icon" title="Ver detalle" (click)="openDetail(q)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                      </svg>
                    </button>
                    <!-- Editar — solo DRAFT o SENT -->
                    @if (q.status === 'DRAFT' || q.status === 'SENT') {
                      <button class="btn-icon" title="Editar" (click)="openFormModal(q)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                    }
                    <!-- Cambiar estado — solo si no está CONVERTED -->
                    @if (q.status !== 'CONVERTED') {
                      <button class="btn-icon" title="Cambiar estado" (click)="openStatusModal(q)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
                        </svg>
                      </button>
                    }
                    <!-- Convertir a factura — solo ACCEPTED y no CONVERTED -->
                    @if (q.status === 'ACCEPTED') {
                      <button class="btn-icon btn-icon-success" title="Convertir a factura" (click)="openConvertConfirm(q)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z"/>
                        </svg>
                      </button>
                    }
                    <!-- Vista previa PDF — todos los estados -->
                    <button class="btn-icon" title="Vista previa PDF" (click)="openPdfPreview(q)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
                      </svg>
                    </button>
                    <!-- Enviar a DIAN — solo ACCEPTED o CONVERTED -->
                    @if (q.status === 'ACCEPTED' || q.status === 'CONVERTED') {
                      <button class="btn-icon btn-icon-primary" title="Enviar a DIAN" (click)="sendToDian(q)" [disabled]="sendingDian()[q.id]">
                        @if (sendingDian()[q.id]) {
                          <span class="btn-spinner-sm"></span>
                        } @else {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                          </svg>
                        }
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="pagination-info">{{ (page()-1)*limit + 1 }}–{{ min(page()*limit, total()) }} de {{ total() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page() === 1" (click)="setPage(page()-1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
                  </svg>
                </button>
                @for (p of pageRange(); track p) {
                  <button class="btn-page" [class.active]="p === page()" (click)="setPage(p)">{{ p }}</button>
                }
                <button class="btn-page" [disabled]="page() === totalPages()" (click)="setPage(page()+1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                  </svg>
                </button>
              </div>
            </div>
          }
        }
      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Modal: Nueva / Editar Cotización                                      -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    @if (showFormModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Editar cotización' : 'Nueva cotización' }}</h3>
            <button class="drawer-close" (click)="closeFormModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Cabecera de la cotización -->
            <div class="form-section-title">Datos generales</div>

            <!-- Cliente -->
            <div class="form-group">
              <label>Cliente *</label>
              <div class="autocomplete-wrap">
                <input type="text"
                       [(ngModel)]="customerSearch"
                       (input)="onCustomerSearchInput()"
                       (focus)="customerDropdownOpen.set(true)"
                       class="form-control"
                       placeholder="Buscar cliente por nombre o documento..."
                       autocomplete="off"/>
                @if (selectedCustomer()) {
                  <div class="selected-tag">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                    </svg>
                    {{ selectedCustomer()!.name }}
                    <button type="button" (click)="clearCustomer()">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                      </svg>
                    </button>
                  </div>
                }
                @if (customerDropdownOpen() && filteredCustomers().length > 0) {
                  <div class="autocomplete-dropdown">
                    @for (c of filteredCustomers(); track c.id) {
                      <button type="button" class="autocomplete-option" (click)="selectCustomer(c)">
                        <span class="opt-name">{{ c.name }}</span>
                        <span class="opt-sub">{{ c.documentNumber }}</span>
                      </button>
                    }
                  </div>
                }
                @if (customerDropdownOpen() && loadingCustomers() && filteredCustomers().length === 0) {
                  <div class="autocomplete-dropdown autocomplete-dropdown--empty">Buscando...</div>
                }
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Fecha de emisión *</label>
                <input type="date" [(ngModel)]="quoteForm.issueDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Fecha de vencimiento</label>
                <input type="date" [(ngModel)]="quoteForm.expiresAt" class="form-control"/>
              </div>
            </div>

            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="quoteForm.notes" class="form-control form-textarea"
                        rows="2" placeholder="Notas internas o para el cliente..."></textarea>
            </div>

            <div class="form-group">
              <label>Términos y condiciones</label>
              <textarea [(ngModel)]="quoteForm.terms" class="form-control form-textarea"
                        rows="3" placeholder="Condiciones de pago, vigencia, etc..."></textarea>
            </div>

            <!-- Líneas de la cotización -->
            <div class="form-section-title">
              Líneas de cotización
              <button type="button" class="btn btn-sm btn-secondary add-line-btn" (click)="addLine()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
                </svg>
                Agregar línea
              </button>
            </div>

            @if (lines().length === 0) {
              <div class="lines-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                <p>Agrega al menos una línea a la cotización</p>
              </div>
            }

            @for (line of lines(); let li = $index; track li) {
              <div class="line-card">
                <div class="line-header">
                  <span class="line-num">Línea {{ li + 1 }}</span>
                  <button type="button" class="btn-icon btn-icon-danger" title="Eliminar línea" (click)="removeLine(li)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
                    </svg>
                  </button>
                </div>

                <!-- Producto (opcional) -->
                <div class="form-group">
                  <label>Producto (opcional)</label>
                  <div class="autocomplete-wrap">
                    <input type="text"
                           [value]="lineProductSearch[li] || ''"
                           (input)="onLineProductSearch($event, li)"
                           (focus)="openProductDropdown(li)"
                           class="form-control"
                           placeholder="Buscar producto..."
                           autocomplete="off"/>
                    @if (activeProductDropdown() === li && filteredProducts().length > 0) {
                      <div class="autocomplete-dropdown">
                        @for (p of filteredProducts(); track p.id) {
                          <button type="button" class="autocomplete-option" (click)="selectProduct(p, li)">
                            <span class="opt-name">{{ p.name }}</span>
                            <span class="opt-sub">{{ formatCurrency(p.price) }}</span>
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>

                <!-- Descripción -->
                <div class="form-group">
                  <label>Descripción *</label>
                  <input type="text" [(ngModel)]="line.description" class="form-control"
                         placeholder="Descripción del producto o servicio"/>
                </div>

                <!-- Cantidad / Precio / IVA / Descuento -->
                <div class="line-fields">
                  <div class="form-group">
                    <label>Cantidad</label>
                    <input type="number" [(ngModel)]="line.quantity" (ngModelChange)="recalc()"
                           class="form-control" min="1" step="1"/>
                  </div>
                  <div class="form-group">
                    <label>Precio unit.</label>
                    <input type="number" [(ngModel)]="line.unitPrice" (ngModelChange)="recalc()"
                           class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="form-group">
                    <label>% IVA</label>
                    <input type="number" [(ngModel)]="line.taxRate" (ngModelChange)="recalc()"
                           class="form-control" min="0" max="100" step="0.01"/>
                  </div>
                  <div class="form-group">
                    <label>% Descuento</label>
                    <input type="number" [(ngModel)]="line.discount" (ngModelChange)="recalc()"
                           class="form-control" min="0" max="100" step="0.01"/>
                  </div>
                  <div class="form-group line-total-group">
                    <label>Total línea</label>
                    <div class="line-total">{{ formatCurrency(lineTotal(li)) }}</div>
                  </div>
                </div>
              </div>
            }

            <!-- Resumen de totales -->
            @if (lines().length > 0) {
              <div class="totals-summary">
                <div class="totals-row">
                  <span>Subtotal</span>
                  <strong>{{ formatCurrency(computedSubtotal()) }}</strong>
                </div>
                <div class="totals-row">
                  <span>IVA</span>
                  <strong>{{ formatCurrency(computedTax()) }}</strong>
                </div>
                <div class="totals-row totals-row--total">
                  <span>Total</span>
                  <strong>{{ formatCurrency(computedTotal()) }}</strong>
                </div>
              </div>
            }

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeFormModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveQuote()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar cotización' : 'Crear cotización') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Modal: Detalle Cotización (solo lectura)                              -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    @if (detailQuote()) {
      <div class="drawer-overlay" (click)="closeDetail()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-avatar">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
              </svg>
            </div>
            <div>
              <div class="drawer-title">{{ detailQuote()!.number }}</div>
              <div class="drawer-sub">
                <span class="status-badge status-{{ detailQuote()!.status.toLowerCase() }}">
                  {{ statusLabel(detailQuote()!.status) }}
                </span>
              </div>
            </div>
            <button class="drawer-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="drawer-body">

            <!-- Datos del cliente -->
            <div class="detail-section">
              <div class="detail-section-title">Cliente</div>
              <div class="detail-grid">
                <div class="detail-item"><span>Nombre</span><strong>{{ detailQuote()!.customer.name }}</strong></div>
                <div class="detail-item"><span>Documento</span><strong>{{ detailQuote()!.customer.documentNumber }}</strong></div>
                <div class="detail-item"><span>Fecha emisión</span><strong>{{ formatDate(detailQuote()!.issueDate) }}</strong></div>
                <div class="detail-item"><span>Vence</span><strong>{{ detailQuote()!.expiresAt ? formatDate(detailQuote()!.expiresAt!) : '—' }}</strong></div>
              </div>
            </div>

            <!-- Ítems -->
            @if (detailQuote()!.items && detailQuote()!.items!.length > 0) {
              <div class="detail-section">
                <div class="detail-section-title">Líneas</div>
                <div class="items-list">
                  @for (item of detailQuote()!.items; track item.id) {
                    <div class="item-row">
                      <div class="item-desc">
                        <strong>{{ item.description }}</strong>
                        <span>{{ item.quantity }} × {{ formatCurrency(item.unitPrice) }}</span>
                        @if (item.discount > 0) { <span class="item-discount">-{{ item.discount }}%</span> }
                        @if (item.taxRate > 0) { <span class="item-tax">IVA {{ item.taxRate }}%</span> }
                      </div>
                      <div class="item-total">{{ formatCurrency(item.total) }}</div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Totales -->
            <div class="detail-section">
              <div class="detail-grid">
                <div class="detail-item"><span>Subtotal</span><strong>{{ formatCurrency(detailQuote()!.subtotal) }}</strong></div>
                <div class="detail-item"><span>IVA</span><strong>{{ formatCurrency(detailQuote()!.taxAmount) }}</strong></div>
                <div class="detail-item detail-item--total"><span>Total</span><strong class="total-value">{{ formatCurrency(detailQuote()!.total) }}</strong></div>
              </div>
            </div>

            <!-- Link a factura si fue convertida -->
            @if (detailQuote()!.invoiceId) {
              <div class="invoice-link-card">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                  <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z"/>
                </svg>
                <div>
                  <span class="invoice-link-label">Convertida a factura</span>
                  <strong>{{ detailQuote()!.invoiceNumber ?? detailQuote()!.invoiceId }}</strong>
                </div>
              </div>
            }

            <!-- Notas y términos -->
            @if (detailQuote()!.notes) {
              <div class="detail-section">
                <div class="detail-section-title">Notas</div>
                <p class="detail-text">{{ detailQuote()!.notes }}</p>
              </div>
            }
            @if (detailQuote()!.terms) {
              <div class="detail-section">
                <div class="detail-section-title">Términos y condiciones</div>
                <p class="detail-text">{{ detailQuote()!.terms }}</p>
              </div>
            }

          </div>
          <div class="drawer-footer">
            @if (detailQuote()!.status === 'DRAFT' || detailQuote()!.status === 'SENT') {
              <button class="btn btn-secondary" (click)="openFormModal(detailQuote()!)">Editar</button>
            }
            @if (detailQuote()!.status !== 'CONVERTED') {
              <button class="btn btn-secondary" (click)="openStatusModal(detailQuote()!)">Cambiar estado</button>
            }
            @if (detailQuote()!.status === 'ACCEPTED') {
              <button class="btn btn-primary" (click)="openConvertConfirm(detailQuote()!)">Convertir a factura</button>
            }
            <button class="btn btn-secondary" (click)="openPdfPreview(detailQuote()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
              </svg>
              Vista previa PDF
            </button>
            <button class="btn btn-secondary" [disabled]="downloadingPdf()" (click)="downloadPdf(detailQuote()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
              </svg>
              {{ downloadingPdf() ? 'Descargando...' : 'Descargar PDF' }}
            </button>
            @if (detailQuote()!.status === 'ACCEPTED' || detailQuote()!.status === 'CONVERTED') {
              <button class="btn btn-primary" [disabled]="sendingDian()[detailQuote()!.id]" (click)="sendToDian(detailQuote()!)">
                @if (sendingDian()[detailQuote()!.id]) {
                  <span class="btn-spinner-sm"></span>
                  Enviando...
                } @else {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                  Enviar a DIAN
                }
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Modal: Cambiar Estado                                                 -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    @if (statusTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar estado</h3>
            <button class="drawer-close" (click)="statusTarget.set(null)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Cotización <strong>{{ statusTarget()!.number }}</strong></p>
            <div class="form-group" style="margin-top:12px">
              <label>Nuevo estado</label>
              <select [(ngModel)]="newStatus" class="form-control">
                <option value="DRAFT">Borrador</option>
                <option value="SENT">Enviada</option>
                <option value="ACCEPTED">Aceptada</option>
                <option value="REJECTED">Rechazada</option>
                <option value="EXPIRED">Vencida</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="statusTarget.set(null)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="changeStatus()">
              {{ saving() ? 'Guardando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Modal: Confirmación de Conversión a Factura                          -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    @if (convertTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Convertir a factura</h3>
          </div>
          <div class="modal-body">
            <div class="confirm-icon confirm-icon--success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p>¿Convertir la cotización <strong>{{ convertTarget()!.number }}</strong> en una factura de venta?</p>
            <p class="confirm-sub">Esta acción creará una nueva factura con los ítems de la cotización. La cotización quedará marcada como <strong>Convertida</strong>.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="convertTarget.set(null)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="doConvert()">
              {{ saving() ? 'Convirtiendo...' : 'Confirmar y convertir' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Modal: Vista previa PDF                                               -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    @if (showPdfModal()) {
      <div class="modal-overlay" (click)="closePdfModal()">
        <div class="modal modal-xl" style="height:90vh;display:flex;flex-direction:column;" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Vista previa de cotización</h3>
            <button class="drawer-close" (click)="closePdfModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div style="flex:1;overflow:hidden;padding:0;">
            @if (loadingPdf()) {
              <div class="pdf-loading">
                <div class="pdf-spinner"></div>
                <p>Generando previsualización...</p>
              </div>
            } @else if (pdfUrl()) {
              <iframe [src]="pdfUrl()!" class="pdf-iframe" frameborder="0"></iframe>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Layout base ─────────────────────────────────────────────────────── */
    .page { max-width:1260px; padding-bottom:24px; }

    /* ── Hero shell ──────────────────────────────────────────────────────── */
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(127,183,255,.18), transparent 26%),
        radial-gradient(circle at bottom right, rgba(45,212,191,.16), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0f7a72 100%);
      box-shadow:0 24px 48px rgba(12,28,53,.18);
      color:#fff;
    }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
    .hero-copy { max-width:620px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#a5c8ff;
    }
    .page-title { font-family:'Sora',sans-serif; font-size:32px; line-height:1.02; font-weight:800; color:#fff; margin:0 0 10px; letter-spacing:-.05em; }
    .page-subtitle { font-size:14px; color:rgba(236,244,255,.8); margin:0; line-height:1.6; }
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
      color:#c7d2fe;
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
      grid-template-columns:repeat(3,minmax(0,1fr));
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
    .hero-mini-card strong { font-family:'Sora',sans-serif; font-size:20px; color:#fff; letter-spacing:-.04em; }

    /* ── KPI strip ───────────────────────────────────────────────────────── */
    .kpi-strip {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
      margin-bottom:18px;
    }
    .kpi-card {
      display:flex;
      align-items:flex-start;
      gap:14px;
      padding:16px 18px;
      border-radius:20px;
      background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 16px 28px rgba(12,28,53,.05);
    }
    .kpi-card__icon {
      width:44px;
      height:44px;
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg,#e0efff,#eefaf7);
      color:#1a407e;
      flex-shrink:0;
    }
    .kpi-card__icon--success { background:linear-gradient(135deg,#d1fae5,#a7f3d0); color:#065f46; }
    .kpi-card__icon--purple { background:linear-gradient(135deg,#dbeafe,#bfdbfe); color:#1d4ed8; }
    .kpi-card__label {
      display:block;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#7b8fa8;
      margin-bottom:6px;
    }
    .kpi-card__value { font-family:'Sora',sans-serif; font-size:22px; line-height:1.1; letter-spacing:-.05em; color:#0c1c35; }

    /* ── Filters ─────────────────────────────────────────────────────────── */
    .filters-shell {
      margin-bottom:18px;
      padding:18px;
      border-radius:24px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 16px 30px rgba(12,28,53,.05);
      backdrop-filter:blur(10px);
    }
    .filters-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .filters-kicker { margin:0 0 6px; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#1a407e; }
    .filters-head h3 { margin:0; font-family:'Sora',sans-serif; font-size:18px; letter-spacing:-.04em; color:#0c1c35; }
    .results-pill { padding:8px 12px; border-radius:999px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:12px; font-weight:700; white-space:nowrap; }
    .filters-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; position:relative; max-width:420px; min-width:180px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; min-height:44px; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; background:#fff; box-shadow:0 8px 20px rgba(12,28,53,.03); }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { min-height:44px; padding:8px 12px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; background:#fff; color:#374151; box-shadow:0 8px 20px rgba(12,28,53,.03); }

    /* ── Table ───────────────────────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; box-shadow:0 16px 28px rgba(12,28,53,.05); }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:14px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .text-right { text-align:right; }
    .text-muted { color:#9ca3af; }

    .quote-number { font-family:monospace; font-weight:700; color:#1a407e; font-size:13px; }
    .quote-total { font-family:'Sora',sans-serif; font-size:14px; color:#0c1c35; }

    .customer-cell { display:flex; align-items:center; gap:10px; }
    .cust-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .cust-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .cust-email { font-size:12px; color:#9ca3af; margin-top:1px; }

    /* Estado badges */
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-draft    { background:#f3f4f6; color:#6b7280; }
    .status-sent     { background:#dbeafe; color:#1e40af; }
    .status-accepted { background:#d1fae5; color:#065f46; }
    .status-rejected { background:#fee2e2; color:#991b1b; }
    .status-expired  { background:#ffedd5; color:#9a3412; }
    .status-converted{ background:#dbeafe; color:#1d4ed8; }

    /* Acciones */
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#9ca3af; transition:all .15s; box-shadow:0 6px 16px rgba(12,28,53,.03); }
    .btn-icon:hover { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
    .btn-icon-success:hover { background:#d1fae5; color:#059669; border-color:#6ee7b7; }
    .btn-icon-primary { color:#1a407e; }
    .btn-icon-primary:hover { background:#dbeafe; color:#1a407e; border-color:#93c5fd; }

    /* Paginación */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; display:flex; align-items:center; justify-content:center; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* Skeleton */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* ── Drawer (detalle) ─────────────────────────────────────────────────── */
    .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:100; display:flex; justify-content:flex-end; }
    .drawer { width:480px; max-width:100%; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-4px 0 24px rgba(0,0,0,.15); }
    .drawer-header { display:flex; align-items:center; gap:12px; padding:20px; border-bottom:1px solid #f0f4f8; }
    .drawer-avatar { width:44px; height:44px; border-radius:10px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .drawer-title { font-weight:700; font-size:16px; color:#0c1c35; font-family:monospace; }
    .drawer-sub { margin-top:4px; }
    .drawer-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .drawer-close:hover { background:#f0f4f8; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:20px; }
    .drawer-footer { padding:16px 20px; border-top:1px solid #f0f4f8; display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }

    .detail-section { margin-bottom:20px; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-item--total span { color:#1a407e; }
    .total-value { font-family:'Sora',sans-serif; font-size:18px; color:#0c1c35; }
    .detail-text { font-size:13.5px; color:#374151; line-height:1.6; margin:0; white-space:pre-wrap; }

    .items-list { display:flex; flex-direction:column; gap:8px; }
    .item-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:10px; background:#f8fbff; border-radius:8px; border:1px solid #edf2fa; }
    .item-desc { flex:1; }
    .item-desc strong { display:block; font-size:13.5px; color:#0c1c35; margin-bottom:4px; }
    .item-desc span { display:inline-block; font-size:12px; color:#9ca3af; margin-right:8px; }
    .item-discount { color:#d97706; background:#fef3c7; padding:1px 5px; border-radius:4px; font-weight:600; }
    .item-tax { color:#2563eb; background:#dbeafe; padding:1px 5px; border-radius:4px; font-weight:600; }
    .item-total { font-weight:700; font-size:14px; color:#0c1c35; white-space:nowrap; }

    .invoice-link-card { display:flex; align-items:center; gap:10px; padding:12px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; margin-bottom:16px; }
    .invoice-link-card svg { color:#1d4ed8; flex-shrink:0; }
    .invoice-link-label { display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin-bottom:2px; }
    .invoice-link-card strong { font-family:monospace; font-size:14px; color:#1d4ed8; }

    /* ── Modal ───────────────────────────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-sm { max-width:420px; }
    .modal-lg { max-width:860px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; margin:0 0 8px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }

    /* ── Form ────────────────────────────────────────────────────────────── */
    .form-section-title {
      display:flex;
      align-items:center;
      justify-content:space-between;
      font-size:11px;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#1a407e;
      margin:16px 0 10px;
      padding-bottom:6px;
      border-bottom:1px solid #dbeafe;
    }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-textarea { resize:vertical; min-height:72px; line-height:1.5; font-family:inherit; }

    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#153569; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-sm { padding:7px 14px; font-size:13px; }

    /* ── Autocomplete ────────────────────────────────────────────────────── */
    .autocomplete-wrap { position:relative; }
    .autocomplete-dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff; border:1px solid #dce6f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.12); z-index:300; max-height:220px; overflow-y:auto; }
    .autocomplete-option { display:flex; align-items:center; justify-content:space-between; width:100%; padding:9px 14px; background:none; border:none; cursor:pointer; font-size:13.5px; color:#374151; text-align:left; transition:background .1s; }
    .autocomplete-option:hover { background:#eff6ff; }
    .opt-name { font-weight:500; }
    .opt-sub { font-size:11px; color:#9ca3af; }
    .autocomplete-dropdown--empty { padding:12px 14px; font-size:13px; color:#9ca3af; }
    .selected-tag { display:inline-flex; align-items:center; gap:5px; margin-top:5px; padding:3px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:12px; color:#1d4ed8; font-weight:600; }
    .selected-tag button { background:none; border:none; cursor:pointer; color:#1a407e; padding:0; display:flex; align-items:center; }

    /* ── Lines ───────────────────────────────────────────────────────────── */
    .add-line-btn { margin-left:auto; }
    .lines-empty { padding:24px; text-align:center; color:#9ca3af; border:2px dashed #dce6f0; border-radius:10px; margin-bottom:14px; }
    .lines-empty p { margin:8px 0 0; font-size:13px; }
    .line-card { background:#f8fbff; border:1px solid #e8eef8; border-radius:12px; padding:14px; margin-bottom:12px; }
    .line-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .line-num { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#1a407e; }
    .line-fields { display:grid; grid-template-columns:1fr 1fr 1fr 1fr auto; gap:10px; align-items:end; }
    .line-total-group { display:flex; flex-direction:column; }
    .line-total { padding:9px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:14px; font-weight:700; color:#1d4ed8; white-space:nowrap; }

    /* ── Totales ─────────────────────────────────────────────────────────── */
    .totals-summary { background:#f8fbff; border:1px solid #dce6f0; border-radius:12px; padding:16px; margin-top:8px; }
    .totals-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:14px; color:#374151; border-bottom:1px solid #f0f4f8; }
    .totals-row:last-child { border-bottom:none; }
    .totals-row--total { padding-top:10px; font-size:16px; font-weight:700; color:#0c1c35; }
    .totals-row--total strong { font-family:'Sora',sans-serif; font-size:18px; color:#1a407e; }

    /* ── Confirm dialog ──────────────────────────────────────────────────── */
    .confirm-icon { display:flex; justify-content:center; margin-bottom:12px; }
    .confirm-icon--success { color:#059669; }
    .confirm-sub { font-size:12.5px; color:#9ca3af; }

    /* ── Animate in ──────────────────────────────────────────────────────── */
    .animate-in { animation:fadeUp .3s ease; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }

    /* ── PDF modal ───────────────────────────────────────────────────────── */
    .modal-xl { width:min(95vw,1100px); }
    .pdf-iframe { width:100%; height:100%; border:none; display:block; }
    .pdf-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; gap:16px; color:#64748b; }
    .pdf-loading p { margin:0; font-size:14px; }
    .pdf-spinner { width:40px; height:40px; border:3px solid #e2e8f0; border-top-color:#1a407e; border-radius:50%; animation:spin .8s linear infinite; }
    .btn-spinner-sm { display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* ── Responsive ──────────────────────────────────────────────────────── */
    @media (max-width:768px) {
      .hero-shell { grid-template-columns:1fr; padding:18px; border-radius:24px; }
      .page-title { font-size:26px; }
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header .btn { width:100%; justify-content:center; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .filters-head { flex-direction:column; align-items:flex-start; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .drawer { width:100%; max-width:100%; }
      .line-fields { grid-template-columns:1fr 1fr; }
    }
    @media (max-width:640px) {
      .hero-shell { padding:16px; gap:14px; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:1fr; }
      .filters-shell { padding:14px; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:620px; }
      .drawer-overlay { align-items:flex-end; justify-content:stretch; }
      .drawer { width:100%; height:90dvh; border-radius:18px 18px 0 0; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .form-row { grid-template-columns:1fr; }
      .line-fields { grid-template-columns:1fr 1fr; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
    }
  `]
})
export class QuotesComponent implements OnInit {
  private readonly API          = `${environment.apiUrl}/quotes`;
  private readonly CUSTOMERS_API = `${environment.apiUrl}/customers`;
  private readonly PRODUCTS_API  = `${environment.apiUrl}/products`;

  // ── Lista principal ────────────────────────────────────────────────────────
  quotes      = signal<Quote[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  total       = signal(0);
  page        = signal(1);
  totalPages  = signal(1);
  readonly limit = 20;

  // Filtros
  search       = '';
  filterStatus = '';
  filterDateFrom = '';
  filterDateTo   = '';
  private searchTimer: any;

  // KPIs calculados sobre la página actual
  draftCount     = computed(() => this.quotes().filter(q => q.status === 'DRAFT').length);
  sentCount      = computed(() => this.quotes().filter(q => q.status === 'SENT').length);
  acceptedCount  = computed(() => this.quotes().filter(q => q.status === 'ACCEPTED').length);
  rejectedCount  = computed(() => this.quotes().filter(q => q.status === 'REJECTED').length);
  convertedCount = computed(() => this.quotes().filter(q => q.status === 'CONVERTED').length);

  // ── Modal: Formulario Nueva/Editar ─────────────────────────────────────────
  showFormModal = signal(false);
  editingId     = signal<string | null>(null);

  quoteForm: { issueDate: string; expiresAt: string; notes: string; terms: string } = this.emptyHeader();

  // Selección de cliente en el formulario
  selectedCustomer   = signal<CustomerOption | null>(null);
  customerSearch     = '';
  customerDropdownOpen = signal(false);
  loadingCustomers   = signal(false);
  allCustomers       = signal<CustomerOption[]>([]);
  filteredCustomers  = computed(() => {
    const q = this.customerSearch.toLowerCase().trim();
    if (!q) return this.allCustomers().slice(0, 30);
    return this.allCustomers()
      .filter(c => c.name.toLowerCase().includes(q) || c.documentNumber.includes(q))
      .slice(0, 30);
  });

  // Líneas dinámicas
  lines = signal<QuoteLineForm[]>([]);

  // Búsqueda de producto por línea
  lineProductSearch: string[] = [];
  activeProductDropdown = signal<number | null>(null);
  allProducts     = signal<ProductOption[]>([]);
  private productSearchSubject = new Subject<{ q: string; index: number }>();
  filteredProducts = signal<ProductOption[]>([]);

  // Totales calculados
  computedSubtotal = computed(() => this.lines().reduce((acc, l, i) => acc + this.lineSubtotal(i), 0));
  computedTax      = computed(() => {
    return this.lines().reduce((acc, l) => {
      const sub = l.quantity * l.unitPrice * (1 - l.discount / 100);
      return acc + sub * (l.taxRate / 100);
    }, 0);
  });
  computedTotal = computed(() => this.computedSubtotal() + this.computedTax());

  // ── Modal: Detalle ─────────────────────────────────────────────────────────
  detailQuote = signal<Quote | null>(null);

  // ── Modal: Cambiar Estado ──────────────────────────────────────────────────
  statusTarget = signal<Quote | null>(null);
  newStatus    = 'DRAFT';

  // ── Modal: Confirmar conversión ────────────────────────────────────────────
  convertTarget = signal<Quote | null>(null);

  // ── Modal: Vista previa PDF ────────────────────────────────────────────────
  showPdfModal    = signal(false);
  loadingPdf      = signal(false);
  pdfUrl          = signal<SafeResourceUrl | null>(null);
  downloadingPdf  = signal(false);
  sendingDian     = signal<{ [id: string]: boolean }>({});
  private objectUrl: string | null = null;

  constructor(private http: HttpClient, private notify: NotificationService, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    this.load();

    // Búsqueda de producto con debounce
    this.productSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.q === b.q),
      switchMap(({ q, index }) => {
        if (!q) return this.http.get<any>(`${this.PRODUCTS_API}?limit=30`);
        return this.http.get<any>(`${this.PRODUCTS_API}?search=${encodeURIComponent(q)}&limit=30`);
      }),
    ).subscribe({
      next: (res) => {
        const data: ProductOption[] = Array.isArray(res) ? res : (res.data ?? []);
        this.filteredProducts.set(data);
      },
      error: () => this.filteredProducts.set([]),
    });
  }

  // ── Carga de lista principal ────────────────────────────────────────────────

  load() {
    this.loading.set(true);
    const params: Record<string, string> = {
      page:  String(this.page()),
      limit: String(this.limit),
    };
    if (this.search)         params['search']   = this.search;
    if (this.filterStatus)   params['status']   = this.filterStatus;
    if (this.filterDateFrom) params['dateFrom']  = this.filterDateFrom;
    if (this.filterDateTo)   params['dateTo']    = this.filterDateTo;

    this.http.get<PaginatedResponse<Quote>>(this.API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.quotes.set(data ?? []);
        this.total.set(total ?? 0);
        this.totalPages.set(totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error al cargar cotizaciones');
      },
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  onFilterChange() { this.page.set(1); this.load(); }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  // ── Modal: Formulario ──────────────────────────────────────────────────────

  openFormModal(quote?: Quote) {
    if (quote) {
      // Editar cotización existente — carga el detalle para obtener los ítems
      this.editingId.set(quote.id);
      this.quoteForm = {
        issueDate:  quote.issueDate?.substring(0, 10) ?? '',
        expiresAt:  quote.expiresAt?.substring(0, 10) ?? '',
        notes:      quote.notes ?? '',
        terms:      quote.terms ?? '',
      };
      this.selectedCustomer.set({ id: quote.customer.id, name: quote.customer.name, documentNumber: quote.customer.documentNumber });
      this.customerSearch = quote.customer.name;

      // Cargar ítems completos si no están en la cotización de la lista
      if (quote.items && quote.items.length > 0) {
        this.setLinesFromItems(quote.items);
      } else {
        this.http.get<Quote>(`${this.API}/${quote.id}`).subscribe({
          next: (full) => this.setLinesFromItems(full.items ?? []),
          error: () => this.lines.set([this.emptyLine()]),
        });
      }
    } else {
      // Nueva cotización
      this.editingId.set(null);
      this.quoteForm = this.emptyHeader();
      this.selectedCustomer.set(null);
      this.customerSearch = '';
      this.lines.set([this.emptyLine()]);
      this.lineProductSearch = [''];
    }
    this.customerDropdownOpen.set(false);
    this.activeProductDropdown.set(null);
    this.detailQuote.set(null);
    this.loadCustomers();
    this.loadProducts('');
    this.showFormModal.set(true);
  }

  private setLinesFromItems(items: QuoteItem[]) {
    const mapped = items
      .sort((a, b) => a.position - b.position)
      .map(item => ({
        productId:   item.productId ?? '',
        description: item.description,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice,
        taxRate:     item.taxRate,
        discount:    item.discount,
      } as QuoteLineForm));
    this.lines.set(mapped);
    this.lineProductSearch = mapped.map(() => '');
  }

  closeFormModal() {
    this.showFormModal.set(false);
    this.activeProductDropdown.set(null);
    this.customerDropdownOpen.set(false);
  }

  saveQuote() {
    if (!this.selectedCustomer()) {
      this.notify.warning('Selecciona un cliente');
      return;
    }
    if (!this.quoteForm.issueDate) {
      this.notify.warning('La fecha de emisión es obligatoria');
      return;
    }
    if (this.lines().length === 0) {
      this.notify.warning('Agrega al menos una línea a la cotización');
      return;
    }
    const invalidLine = this.lines().find(l => !l.description?.trim());
    if (invalidLine) {
      this.notify.warning('Todas las líneas deben tener descripción');
      return;
    }

    this.saving.set(true);

    const body = {
      customerId: this.selectedCustomer()!.id,
      issueDate:  this.quoteForm.issueDate,
      expiresAt:  this.quoteForm.expiresAt || undefined,
      notes:      this.quoteForm.notes     || undefined,
      terms:      this.quoteForm.terms     || undefined,
      items: this.lines().map((l, idx) => ({
        productId:   l.productId   || undefined,
        description: l.description,
        quantity:    Number(l.quantity)  || 1,
        unitPrice:   Number(l.unitPrice) || 0,
        taxRate:     Number(l.taxRate)   ?? 19,
        discount:    Number(l.discount)  ?? 0,
        position:    idx + 1,
      })),
    };

    const req = this.editingId()
      ? this.http.put(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Cotización actualizada' : 'Cotización creada');
        this.saving.set(false);
        this.closeFormModal();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al guardar la cotización');
      },
    });
  }

  // ── Modal: Detalle ─────────────────────────────────────────────────────────

  openDetail(q: Quote) {
    // Carga el detalle completo para obtener los ítems
    this.http.get<Quote>(`${this.API}/${q.id}`).subscribe({
      next: (full) => this.detailQuote.set(full),
      error: () => this.detailQuote.set(q),
    });
  }

  closeDetail() { this.detailQuote.set(null); }

  // ── Modal: Cambiar Estado ──────────────────────────────────────────────────

  openStatusModal(q: Quote) {
    this.newStatus = q.status === 'CONVERTED' ? 'SENT' : q.status;
    this.statusTarget.set(q);
  }

  changeStatus() {
    const q = this.statusTarget();
    if (!q) return;
    this.saving.set(true);
    this.http.patch(`${this.API}/${q.id}/status`, { status: this.newStatus }).subscribe({
      next: () => {
        this.notify.success(`Estado actualizado a ${this.statusLabel(this.newStatus)}`);
        this.saving.set(false);
        this.statusTarget.set(null);
        // Actualiza el detalle si está abierto
        if (this.detailQuote()?.id === q.id) {
          this.openDetail(q);
        }
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al cambiar el estado');
      },
    });
  }

  // ── Modal: Convertir a Factura ─────────────────────────────────────────────

  openConvertConfirm(q: Quote) {
    this.convertTarget.set(q);
  }

  doConvert() {
    const q = this.convertTarget();
    if (!q) return;
    this.saving.set(true);
    this.http.patch<{ invoiceNumber: string; id: string }>(`${this.API}/${q.id}/convert`, {}).subscribe({
      next: (invoice) => {
        this.saving.set(false);
        this.convertTarget.set(null);
        // Cierra el detalle si estaba abierto para esa cotización
        if (this.detailQuote()?.id === q.id) {
          this.detailQuote.set(null);
        }
        this.notify.success(`Cotización ${q.number} convertida a factura ${invoice.invoiceNumber ?? invoice.id}`);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al convertir la cotización');
      },
    });
  }

  // ── PDF preview ────────────────────────────────────────────────────────────

  openPdfPreview(q: Quote) {
    this.loadingPdf.set(true);
    this.showPdfModal.set(true);
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${environment.apiUrl}/v1/quotes/${q.id}/pdf`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: blob => {
        this.objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.loadingPdf.set(false);
      },
      error: () => {
        this.loadingPdf.set(false);
        this.notify.error('Error al generar la vista previa');
      },
    });
  }

  closePdfModal() {
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.pdfUrl.set(null);
    this.showPdfModal.set(false);
  }

  downloadPdf(q: Quote) {
    this.downloadingPdf.set(true);
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${environment.apiUrl}/v1/quotes/${q.id}/pdf/download`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${q.number}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.downloadingPdf.set(false);
        this.notify.error('No fue posible descargar el PDF');
      },
    });
  }

  sendToDian(q: Quote) {
    if (q.invoiceId) {
      this.issueToDian(q.invoiceId, q);
      return;
    }
    this.sendingDian.update(s => ({ ...s, [q.id]: true }));
    this.http.patch<any>(`${environment.apiUrl}/v1/quotes/${q.id}/convert`, {}).subscribe({
      next: invoice => {
        this.notify.info('Cotización convertida a factura. Enviando a DIAN...');
        this.issueToDian(invoice.id, q);
      },
      error: err => {
        this.sendingDian.update(s => ({ ...s, [q.id]: false }));
        this.notify.error(err?.error?.message ?? 'Error al convertir la cotización');
      },
    });
  }

  private issueToDian(invoiceId: string, q: Quote) {
    this.sendingDian.update(s => ({ ...s, [q.id]: true }));
    this.http.post<any>(`${environment.apiUrl}/v1/invoices/${invoiceId}/issue`, {}).subscribe({
      next: result => {
        this.sendingDian.update(s => ({ ...s, [q.id]: false }));
        this.notify.success(`Factura enviada a DIAN. ZipKey: ${result.dianZipKey ?? 'OK'}`);
        this.load();
      },
      error: err => {
        this.sendingDian.update(s => ({ ...s, [q.id]: false }));
        this.notify.error(err?.error?.message ?? 'Error al enviar a la DIAN');
      },
    });
  }

  // ── Líneas dinámicas ───────────────────────────────────────────────────────

  addLine() {
    this.lines.update(ls => [...ls, this.emptyLine()]);
    this.lineProductSearch = [...this.lineProductSearch, ''];
  }

  removeLine(index: number) {
    this.lines.update(ls => ls.filter((_, i) => i !== index));
    this.lineProductSearch = this.lineProductSearch.filter((_, i) => i !== index);
  }

  // Dispara recalculo (los computed se actualizan automáticamente al mutar la señal)
  recalc() {
    // Forzar la actualización de la señal para que computed() reaccione
    this.lines.update(ls => [...ls]);
  }

  lineSubtotal(index: number): number {
    const l = this.lines()[index];
    if (!l) return 0;
    return l.quantity * l.unitPrice * (1 - l.discount / 100);
  }

  lineTotal(index: number): number {
    const l = this.lines()[index];
    if (!l) return 0;
    const sub = l.quantity * l.unitPrice * (1 - l.discount / 100);
    return sub + sub * (l.taxRate / 100);
  }

  // ── Búsqueda de clientes en el formulario ──────────────────────────────────

  private loadCustomers(q = '') {
    this.loadingCustomers.set(true);
    this.http.get<any>(`${this.CUSTOMERS_API}?search=${encodeURIComponent(q)}&limit=50`).subscribe({
      next: (res) => {
        const data: CustomerOption[] = Array.isArray(res) ? res : (res.data ?? []);
        this.allCustomers.set(data);
        this.loadingCustomers.set(false);
      },
      error: () => { this.loadingCustomers.set(false); },
    });
  }

  onCustomerSearchInput() {
    this.customerDropdownOpen.set(true);
    this.loadCustomers(this.customerSearch);
  }

  selectCustomer(c: CustomerOption) {
    this.selectedCustomer.set(c);
    this.customerSearch = c.name;
    this.customerDropdownOpen.set(false);
  }

  clearCustomer() {
    this.selectedCustomer.set(null);
    this.customerSearch = '';
  }

  // ── Búsqueda de productos por línea ────────────────────────────────────────

  private loadProducts(q: string) {
    this.http.get<any>(`${this.PRODUCTS_API}?search=${encodeURIComponent(q)}&limit=30`).subscribe({
      next: (res) => {
        const data: ProductOption[] = Array.isArray(res) ? res : (res.data ?? []);
        this.filteredProducts.set(data);
      },
      error: () => this.filteredProducts.set([]),
    });
  }

  onLineProductSearch(event: Event, index: number) {
    const q = (event.target as HTMLInputElement).value;
    this.lineProductSearch[index] = q;
    this.activeProductDropdown.set(index);
    this.productSearchSubject.next({ q, index });
  }

  openProductDropdown(index: number) {
    this.activeProductDropdown.set(index);
    if (this.filteredProducts().length === 0) {
      this.loadProducts('');
    }
  }

  selectProduct(p: ProductOption, index: number) {
    const current = this.lines();
    const updated = current.map((l, i) => {
      if (i !== index) return l;
      return {
        ...l,
        productId:   p.id,
        description: p.name,           // siempre sobreescribe con el nombre del producto
        unitPrice:   Number(p.price),  // Prisma serializa Decimal como string, forzar número
        taxRate:     Number(p.taxRate ?? 19),
      };
    });
    this.lines.set(updated);
    this.lineProductSearch[index] = p.name;
    this.activeProductDropdown.set(null);
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────

  @HostListener('document:click')
  onDocClick() {
    // Cierra dropdowns de autocomplete al hacer click fuera
    this.customerDropdownOpen.set(false);
    this.activeProductDropdown.set(null);
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  formatCurrency(v?: number | null): string {
    if (v == null) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    const date = new Date(d);
    // Ajustar para evitar desfase de zona horaria
    const utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return utc.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      DRAFT:     'Borrador',
      SENT:      'Enviada',
      ACCEPTED:  'Aceptada',
      REJECTED:  'Rechazada',
      EXPIRED:   'Vencida',
      CONVERTED: 'Convertida',
    };
    return map[s] ?? s;
  }

  min(a: number, b: number) { return Math.min(a, b); }

  // ── Fábricas de objetos vacíos ─────────────────────────────────────────────

  private emptyHeader() {
    const today = new Date().toISOString().substring(0, 10);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    return { issueDate: today, expiresAt: thirtyDays, notes: '', terms: '' };
  }

  private emptyLine(): QuoteLineForm {
    return { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 };
  }
}
