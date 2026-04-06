import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';

// ── Interfaces de dominio ─────────────────────────────────────────────────────

interface PurchasingCustomer {
  id: string;
  documentType: 'NIT' | 'CC' | 'CE' | 'PASSPORT' | 'TI';
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTermDays?: number;
  creditLimit?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

type OrderStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'PARTIAL' | 'CANCELLED';

interface OrderLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  discountPercent: number;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  issueDate: string;
  dueDate?: string;
  customer: { id: string; name: string; documentNumber: string; email?: string; phone?: string; address?: string };
  status: OrderStatus;
  notes?: string;
  lines?: OrderLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
}

interface CustomerForm {
  documentType: string;
  documentNumber: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentTermDays: number | null;
  creditLimit: number | null;
  notes: string;
}

interface OrderForm {
  customerId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  lines: OrderLineForm[];
}

interface OrderLineForm {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  taxPercent: number;
  discountPercent: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Etiquetas legibles para cada estado de orden ──────────────────────────────
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT:     'Borrador',
  SENT:      'Enviada',
  RECEIVED:  'Recibida',
  PARTIAL:   'Parcial',
  CANCELLED: 'Cancelada',
};

@Component({
  selector: 'app-purchasing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Header hero ───────────────────────────────────────── -->
      <section class="hero-shell">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Gestión de compras</p>
            <h2 class="page-title">Compras y Clientes</h2>
            <p class="page-subtitle">Administra tus clientes asociados a compras y órdenes de compra desde un solo lugar, con visibilidad completa del proceso.</p>
          </div>
          @if (activeTab() === 'customers') {
            <button class="btn btn-primary" (click)="openCustomerModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nuevo Cliente
            </button>
          } @else {
            <button class="btn btn-primary" (click)="openOrderModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Orden
            </button>
          }
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Total visible</span>
            <strong>{{ activeTab() === 'customers' ? totalCustomers() : totalOrders() }}</strong>
            <small>{{ activeTab() === 'customers' ? 'Clientes registrados' : 'Órdenes de compra' }}</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Activos</span>
              <strong>{{ activeCustomers() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Recibidas</span>
              <strong>{{ receivedOrders() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Pendientes</span>
              <strong>{{ pendingOrders() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- ── KPI strip ─────────────────────────────────────────── -->
      <section class="kpi-strip">
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Clientes</span>
            <strong class="kpi-card__value">{{ totalCustomers() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Órdenes totales</span>
            <strong class="kpi-card__value">{{ totalOrders() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Recibidas</span>
            <strong class="kpi-card__value">{{ receivedOrders() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Pendientes</span>
            <strong class="kpi-card__value">{{ pendingOrders() }}</strong>
          </div>
        </article>
      </section>

      <!-- ── Pestañas ───────────────────────────────────────────── -->
      <div class="tabs-bar">
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'customers'" (click)="switchTab('customers')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
          Clientes
        </button>
        <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'orders'" (click)="switchTab('orders')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
          Órdenes de Compra
        </button>
      </div>

      <!-- ── Filtros ─────────────────────────────────────────────── -->
      <section class="filters-shell">
        <div class="filters-bar">
          <div class="search-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
            <input type="text" placeholder="Buscar..."
                   [(ngModel)]="searchText" (ngModelChange)="onSearch()" class="search-input"/>
          </div>

          @if (activeTab() === 'customers') {
            <select [(ngModel)]="filterActive" (ngModelChange)="loadCustomers()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <div class="view-toggle">
              <button [class.active]="customersViewMode() === 'table'" (click)="customersViewMode.set('table')" title="Vista tabla">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd"/></svg>
              </button>
              <button [class.active]="customersViewMode() === 'grid'" (click)="customersViewMode.set('grid')" title="Vista cuadrícula">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              </button>
            </div>
          }

          @if (activeTab() === 'orders') {
            <select [(ngModel)]="filterStatus" (ngModelChange)="loadOrders()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="SENT">Enviada</option>
              <option value="RECEIVED">Recibida</option>
              <option value="PARTIAL">Parcial</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadOrders()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
            <input type="date" [(ngModel)]="filterDateFrom" (ngModelChange)="loadOrders()" class="filter-select" title="Desde"/>
            <input type="date" [(ngModel)]="filterDateTo" (ngModelChange)="loadOrders()" class="filter-select" title="Hasta"/>
            <div class="view-toggle">
              <button [class.active]="ordersViewMode() === 'table'" (click)="ordersViewMode.set('table')" title="Vista tabla">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clip-rule="evenodd"/></svg>
              </button>
              <button [class.active]="ordersViewMode() === 'grid'" (click)="ordersViewMode.set('grid')" title="Vista cuadrícula">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
              </button>
            </div>
          }

          <div class="results-pill">{{ activeTab() === 'customers' ? totalCustomers() : totalOrders() }} resultados</div>
        </div>
      </section>

      <!-- ══ PESTAÑA CLIENTES ═══════════════════════════════════ -->
      @if (activeTab() === 'customers') {
        @if (customersViewMode() === 'table') {
        <div class="table-card">
          @if (loadingCustomers()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-avatar"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                </div>
              }
            </div>
          } @else if (customers().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
              </svg>
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay clientes registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openCustomerModal()">Crear primer cliente</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo Doc</th>
                  <th>N° Documento</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Plazo Pago</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of customers(); track c.id) {
                  <tr>
                    <td>
                      <div class="entity-cell">
                        <div class="entity-avatar">{{ initials(c.name) }}</div>
                        <div>
                          <div class="entity-name">{{ c.name }}</div>
                          @if (c.address) { <div class="entity-sub">{{ c.address }}</div> }
                        </div>
                      </div>
                    </td>
                    <td><span class="doc-badge">{{ c.documentType }}</span></td>
                    <td><span class="doc-number">{{ c.documentNumber }}</span></td>
                    <td class="text-muted">{{ c.email || '—' }}</td>
                    <td class="text-muted">{{ c.phone || '—' }}</td>
                    <td>
                      @if (c.paymentTermDays) {
                        <span class="term-badge">{{ c.paymentTermDays }} días</span>
                      } @else {
                        <span class="text-muted">Inmediato</span>
                      }
                    </td>
                    <td>
                      <span class="status-badge" [class.active]="c.isActive" [class.inactive]="!c.isActive">
                        {{ c.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Editar" (click)="openCustomerModal(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      </button>
                      <button class="btn-icon" [title]="c.isActive ? 'Desactivar' : 'Activar'" (click)="toggleCustomer(c)">
                        @if (c.isActive) {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/></svg>
                        } @else {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                        }
                      </button>
                      <button class="btn-icon" title="Ver órdenes" (click)="viewCustomerOrders(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (totalPagesCustomers() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageCustomers()-1)*limit + 1 }}–{{ min(pageCustomers()*limit, totalCustomers()) }} de {{ totalCustomers() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageCustomers() === 1" (click)="setPageCustomers(pageCustomers()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of pageRangeCustomers(); track p) {
                    <button class="btn-page" [class.active]="p === pageCustomers()" (click)="setPageCustomers(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageCustomers() === totalPagesCustomers()" (click)="setPageCustomers(pageCustomers()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        </div>
        } @else {
          @if (loadingCustomers()) {
            <div class="customer-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="customer-card customer-card--skeleton">
                  <div class="sk sk-avatar cc-sk-avatar"></div>
                  <div class="sk sk-line" style="width:70%;margin:10px auto 6px"></div>
                  <div class="sk sk-line" style="width:50%;margin:0 auto 14px"></div>
                  <div class="sk sk-line" style="width:90%"></div>
                  <div class="sk sk-line" style="width:80%;margin-top:6px"></div>
                </div>
              }
            </div>
          } @else if (customers().length === 0) {
            <div class="empty-state-grid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
              </svg>
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay clientes registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openCustomerModal()">Crear primer cliente</button>
              }
            </div>
          } @else {
            <div class="customer-grid">
              @for (c of customers(); track c.id) {
                <div class="customer-card" [class.customer-card--inactive]="!c.isActive">
                  <span class="cc-status status-badge" [class.active]="c.isActive" [class.inactive]="!c.isActive">
                    {{ c.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                  <div class="cc-top">
                    <div class="cc-avatar">{{ initials(c.name) }}</div>
                    <div class="cc-name">{{ c.name }}</div>
                    <div class="cc-doc"><span class="doc-badge">{{ c.documentType }}</span>{{ c.documentNumber }}</div>
                  </div>
                  <div class="cc-info">
                    @if (c.email) {
                      <div class="cc-info-row">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.25 2.94 6.34z"/><path d="M18 8.17l-7.37 4.08a1.5 1.5 0 01-1.26 0L2 8.17V14a2 2 0 002 2h12a2 2 0 002-2V8.17z"/></svg>
                        <span>{{ c.email }}</span>
                      </div>
                    }
                    @if (c.phone) {
                      <div class="cc-info-row">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                        <span>{{ c.phone }}</span>
                      </div>
                    }
                    @if (c.address) {
                      <div class="cc-info-row">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
                        <span>{{ c.address }}</span>
                      </div>
                    }
                    @if (c.paymentTermDays) {
                      <div class="cc-info-row cc-credit">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                        <span>{{ c.paymentTermDays }}d · {{ formatCurrency(c.creditLimit) }}</span>
                      </div>
                    }
                  </div>
                  <div class="cc-actions">
                    <button class="btn btn-sm btn-secondary" (click)="openCustomerModal(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      Editar
                    </button>
                    <button class="btn btn-sm btn-secondary" (click)="viewCustomerOrders(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                      Órdenes
                    </button>
                    <button class="btn-icon" [title]="c.isActive ? 'Desactivar' : 'Activar'" (click)="toggleCustomer(c)">
                      @if (c.isActive) {
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/></svg>
                      } @else {
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                      }
                    </button>
                  </div>
                </div>
              }
            </div>

            @if (totalPagesCustomers() > 1) {
              <div class="pagination pagination--standalone">
                <span class="pagination-info">{{ (pageCustomers()-1)*limit + 1 }}–{{ min(pageCustomers()*limit, totalCustomers()) }} de {{ totalCustomers() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageCustomers() === 1" (click)="setPageCustomers(pageCustomers()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of pageRangeCustomers(); track p) {
                    <button class="btn-page" [class.active]="p === pageCustomers()" (click)="setPageCustomers(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageCustomers() === totalPagesCustomers()" (click)="setPageCustomers(pageCustomers()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        }
      }

      <!-- ══ PESTAÑA ÓRDENES DE COMPRA ═════════════════════════ -->
      @if (activeTab() === 'orders') {
        @if (ordersViewMode() === 'table') {
        <div class="table-card">
          @if (loadingOrders()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                  <div class="sk sk-line" style="width:160px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                </div>
              }
            </div>
          } @else if (orders().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
              </svg>
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay órdenes de compra registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openOrderModal()">Crear primera orden</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N° Orden</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (o of orders(); track o.id) {
                  <tr>
                    <td><span class="order-number">{{ o.orderNumber }}</span></td>
                    <td class="text-muted">{{ formatDate(o.issueDate) }}</td>
                    <td>
                      <div class="entity-cell">
                        <div class="entity-avatar entity-avatar--sm">{{ initials(o.customer.name) }}</div>
                        <span class="entity-name">{{ o.customer.name }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="order-status-badge order-status-{{ o.status.toLowerCase() }}">
                        {{ orderStatusLabel(o.status) }}
                      </span>
                    </td>
                    <td class="amount-cell">{{ formatCurrency(o.total) }}</td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Ver detalle" (click)="openOrderDetail(o)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      </button>
                      @if (o.status === 'DRAFT') {
                        <button class="btn-icon" title="Editar orden" (click)="openEditOrder(o)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                        </button>
                      }
                      <button class="btn-icon" title="Enviar por correo" [disabled]="sendingOrderEmail()" (click)="openEmailConfirm(o)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.25 2.94 6.34z"/><path d="M18 8.17l-7.37 4.08a1.5 1.5 0 01-1.26 0L2 8.17V14a2 2 0 002 2h12a2 2 0 002-2V8.17z"/></svg>
                      </button>
                      <button class="btn-icon" title="Cambiar estado" (click)="openStatusModal(o)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (totalPagesOrders() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageOrders()-1)*limit + 1 }}–{{ min(pageOrders()*limit, totalOrders()) }} de {{ totalOrders() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageOrders() === 1" (click)="setPageOrders(pageOrders()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of pageRangeOrders(); track p) {
                    <button class="btn-page" [class.active]="p === pageOrders()" (click)="setPageOrders(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageOrders() === totalPagesOrders()" (click)="setPageOrders(pageOrders()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        </div>
        } @else {
          @if (loadingOrders()) {
            <div class="orders-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="order-card order-card--skeleton">
                  <div class="sk sk-line" style="width:45%;margin-bottom:10px"></div>
                  <div class="sk sk-line" style="width:70%;margin-bottom:8px"></div>
                  <div class="sk sk-line" style="width:55%;margin-bottom:18px"></div>
                  <div class="sk sk-line" style="width:100%;margin-bottom:6px"></div>
                  <div class="sk sk-line" style="width:80%"></div>
                </div>
              }
            </div>
          } @else if (orders().length === 0) {
            <div class="empty-state-grid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>
              </svg>
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay órdenes de compra registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openOrderModal()">Crear primera orden</button>
              }
            </div>
          } @else {
            <div class="orders-grid">
              @for (o of orders(); track o.id) {
                <div class="order-card">
                  <div class="order-card__head">
                    <div>
                      <div class="order-card__number">{{ o.orderNumber }}</div>
                      <div class="order-card__date">{{ formatDate(o.issueDate) }}</div>
                    </div>
                    <span class="order-status-badge order-status-{{ o.status.toLowerCase() }}">
                      {{ orderStatusLabel(o.status) }}
                    </span>
                  </div>
                  <div class="order-card__customer">
                    <div class="entity-avatar entity-avatar--sm">{{ initials(o.customer.name) }}</div>
                    <div>
                      <div class="entity-name">{{ o.customer.name }}</div>
                      <div class="entity-sub">{{ o.customer.documentNumber }}</div>
                    </div>
                  </div>
                  <div class="order-card__meta">
                    <div class="order-card__meta-row">
                      <span>Total</span>
                      <strong>{{ formatCurrency(o.total) }}</strong>
                    </div>
                    <div class="order-card__meta-row">
                      <span>Vencimiento</span>
                      <strong>{{ o.dueDate ? formatDate(o.dueDate) : '—' }}</strong>
                    </div>
                  </div>
                  <div class="order-card__actions">
                    <button class="btn btn-sm btn-secondary" (click)="openOrderDetail(o)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      Ver
                    </button>
                    @if (o.status === 'DRAFT') {
                      <button class="btn btn-sm btn-secondary" (click)="openEditOrder(o)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                        Editar
                      </button>
                    }
                    <button class="btn btn-sm btn-secondary" (click)="openStatusModal(o)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
                      Estado
                    </button>
                  </div>
                </div>
              }
            </div>

            @if (totalPagesOrders() > 1) {
              <div class="pagination pagination--standalone">
                <span class="pagination-info">{{ (pageOrders()-1)*limit + 1 }}–{{ min(pageOrders()*limit, totalOrders()) }} de {{ totalOrders() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageOrders() === 1" (click)="setPageOrders(pageOrders()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of pageRangeOrders(); track p) {
                    <button class="btn-page" [class.active]="p === pageOrders()" (click)="setPageOrders(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageOrders() === totalPagesOrders()" (click)="setPageOrders(pageOrders()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        }
      }

    </div>

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- MODAL: Nuevo / Editar Cliente                           -->
    <!-- ════════════════════════════════════════════════════════ -->
    @if (showCustomerModal()) {
      <div class="modal-overlay">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingCustomerId() ? 'Editar Cliente' : 'Nuevo Cliente' }}</h3>
            <button class="drawer-close" (click)="closeCustomerModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- Documento -->
            <div class="form-row">
              <div class="form-group">
                <label>Tipo documento *</label>
                <select [(ngModel)]="customerForm.documentType" class="form-control">
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula Extranjería (CE)</option>
                  <option value="PASSPORT">Pasaporte</option>
                  <option value="TI">Tarjeta Identidad (TI)</option>
                </select>
              </div>
              <div class="form-group">
                <label>N° Documento *</label>
                <input type="text" [(ngModel)]="customerForm.documentNumber" class="form-control" placeholder="900123456"/>
              </div>
            </div>
            <!-- Nombre -->
            <div class="form-group">
              <label>Nombre / Razón social *</label>
              <input type="text" [(ngModel)]="customerForm.name" class="form-control" placeholder="Cliente S.A.S."/>
            </div>
            <!-- Contacto -->
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="customerForm.email" class="form-control" placeholder="cliente@empresa.com"/>
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" [(ngModel)]="customerForm.phone" class="form-control" placeholder="+57 300 000 0000"/>
              </div>
            </div>
            <!-- Dirección -->
            <div class="form-group">
              <label>Dirección</label>
              <input type="text" [(ngModel)]="customerForm.address" class="form-control" placeholder="Calle 123 #45-67"/>
            </div>
            <!-- Condiciones comerciales -->
            <div class="form-row">
              <div class="form-group">
                <label>Plazo de Pago (días)</label>
                <input type="number" [(ngModel)]="customerForm.paymentTermDays" class="form-control" placeholder="30" min="0"/>
              </div>
              <div class="form-group">
                <label>Límite de Crédito (COP)</label>
                <input type="number" [(ngModel)]="customerForm.creditLimit" class="form-control" placeholder="0" min="0"/>
              </div>
            </div>
            <!-- Notas -->
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="customerForm.notes" class="form-control form-textarea" placeholder="Observaciones internas sobre el cliente..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeCustomerModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveCustomer()">
              {{ saving() ? 'Guardando...' : (editingCustomerId() ? 'Actualizar' : 'Crear cliente') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- MODAL: Nueva Orden de Compra                            -->
    <!-- ════════════════════════════════════════════════════════ -->
    @if (showOrderModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingOrderId() ? 'Editar Orden de Compra' : 'Nueva Orden de Compra' }}</h3>
              @if (editingOrderId()) {
                <div class="modal-sub">Solo se permiten cambios en órdenes en borrador. El cliente asociado no puede cambiarse.</div>
              }
            </div>
            <button class="drawer-close" (click)="closeOrderModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- Encabezado de la orden -->
            <div class="form-row">
              <div class="form-group">
                <label>Cliente *</label>
                <select [(ngModel)]="orderForm.customerId" class="form-control" [disabled]="!!editingOrderId()">
                  <option value="">— Seleccionar cliente —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Fecha Emisión *</label>
                <input type="date" [(ngModel)]="orderForm.issueDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha Vencimiento</label>
                <input type="date" [(ngModel)]="orderForm.dueDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="orderForm.notes" class="form-control" placeholder="Observaciones de la orden..."/>
              </div>
            </div>

            <!-- Líneas de la orden -->
            <div class="lines-section">
              <div class="lines-header">
                <span class="form-section-title">Líneas de Compra</span>
                <button class="btn btn-sm btn-secondary" type="button" (click)="addLine()">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                  Agregar línea
                </button>
              </div>

              @if (orderForm.lines.length === 0) {
                <div class="lines-empty">Agrega al menos una línea de compra para continuar.</div>
              }

              @for (line of orderForm.lines; track $index; let i = $index) {
                <div class="line-row">
                  <div class="line-desc">
                    <label>Descripción</label>
                    <input type="text" [(ngModel)]="line.description" class="form-control" placeholder="Producto o servicio"/>
                  </div>
                  <div class="line-qty">
                    <label>Cantidad</label>
                    <input type="number" [(ngModel)]="line.quantity" class="form-control" placeholder="1" min="0" step="0.01" (ngModelChange)="recalculate()"/>
                  </div>
                  <div class="line-price">
                    <label>Precio Unit.</label>
                    <input type="number" [(ngModel)]="line.unitPrice" class="form-control" placeholder="0" min="0" step="0.01" (ngModelChange)="recalculate()"/>
                  </div>
                  <div class="line-tax">
                    <label>% IVA</label>
                    <input type="number" [(ngModel)]="line.taxPercent" class="form-control" placeholder="19" min="0" max="100" (ngModelChange)="recalculate()"/>
                  </div>
                  <div class="line-disc">
                    <label>% Dto.</label>
                    <input type="number" [(ngModel)]="line.discountPercent" class="form-control" placeholder="0" min="0" max="100" (ngModelChange)="recalculate()"/>
                  </div>
                  <div class="line-summary">
                    <label>Resumen</label>
                    <div class="line-summary__values">
                      <span>Base: <strong>{{ formatCurrency(lineBase(line)) }}</strong></span>
                      <span>IVA: <strong>{{ formatCurrency(lineTax(line)) }}</strong></span>
                      <span>Total: <strong>{{ formatCurrency(lineTotal(line)) }}</strong></span>
                    </div>
                  </div>
                  <button class="btn-icon btn-icon-danger line-remove" title="Quitar línea" (click)="removeLine(i)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
              }

              <!-- Totales calculados en tiempo real -->
              @if (orderForm.lines.length > 0) {
                <div class="order-totals">
                  <div class="order-totals-row">
                    <span>Subtotal</span>
                    <strong>{{ formatCurrency(orderSubtotal()) }}</strong>
                  </div>
                  <div class="order-totals-row">
                    <span>IVA</span>
                    <strong>{{ formatCurrency(orderTax()) }}</strong>
                  </div>
                  <div class="order-totals-row order-totals-row--total">
                    <span>Total</span>
                    <strong>{{ formatCurrency(orderTotal()) }}</strong>
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeOrderModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveOrder()">
              {{ saving() ? 'Guardando...' : (editingOrderId() ? 'Guardar cambios' : 'Crear Orden') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- MODAL: Detalle de Orden                                 -->
    <!-- ════════════════════════════════════════════════════════ -->
    @if (detailOrder()) {
      <div class="modal-overlay modal-overlay--drawer">
        <div class="modal modal-drawer" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Orden {{ detailOrder()!.orderNumber }}</h3>
              <div class="modal-sub">{{ detailOrder()!.customer.name }} · {{ formatDate(detailOrder()!.issueDate) }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="order-status-badge order-status-{{ detailOrder()!.status.toLowerCase() }}">
                {{ orderStatusLabel(detailOrder()!.status) }}
              </span>
              <button class="drawer-close" (click)="detailOrder.set(null)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>
          <div class="modal-body">
            <!-- Info del cliente -->
            <div class="detail-grid">
              <div class="detail-item">
                <span>Cliente</span>
                <strong>{{ detailOrder()!.customer.name }}</strong>
              </div>
              <div class="detail-item">
                <span>N° Documento</span>
                <strong>{{ detailOrder()!.customer.documentNumber }}</strong>
              </div>
              <div class="detail-item">
                <span>Fecha emisión</span>
                <strong>{{ formatDate(detailOrder()!.issueDate) }}</strong>
              </div>
              <div class="detail-item">
                <span>Fecha vencimiento</span>
                <strong>{{ detailOrder()!.dueDate ? formatDate(detailOrder()!.dueDate!) : '—' }}</strong>
              </div>
            </div>
            @if (detailOrder()!.notes) {
              <div class="detail-notes">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
                {{ detailOrder()!.notes }}
              </div>
            }

            <!-- Líneas del detalle -->
            @if (detailOrder()!.lines && detailOrder()!.lines!.length > 0) {
              <div class="detail-section">
                <div class="detail-section-title">Líneas de Compra</div>
                <table class="data-table data-table--inner">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cant.</th>
                      <th>Precio Unit.</th>
                      <th>% IVA</th>
                      <th>% Dto.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of detailOrder()!.lines; track $index) {
                      <tr>
                        <td>{{ l.description }}</td>
                        <td>{{ l.quantity }}</td>
                        <td>{{ formatCurrency(l.unitPrice) }}</td>
                        <td>{{ l.taxPercent }}%</td>
                        <td>{{ l.discountPercent }}%</td>
                        <td class="amount-cell">{{ formatCurrency(calcLineSubtotal(l)) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Totales del detalle -->
            <div class="order-totals order-totals--detail">
              <div class="order-totals-row">
                <span>Subtotal</span>
                <strong>{{ formatCurrency(detailOrder()!.subtotal) }}</strong>
              </div>
              <div class="order-totals-row">
                <span>IVA</span>
                <strong>{{ formatCurrency(detailOrder()!.taxAmount) }}</strong>
              </div>
              <div class="order-totals-row order-totals-row--total">
                <span>Total</span>
                <strong>{{ formatCurrency(detailOrder()!.total) }}</strong>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            @if (detailOrder()!.status === 'DRAFT') {
              <button class="btn btn-secondary" (click)="openEditFromDetail()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                Editar orden
              </button>
            }
            <button class="btn btn-secondary" [disabled]="loadingPdf() || !detailOrder()" (click)="openOrderPdfPreview(detailOrder()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
              {{ loadingPdf() ? 'Generando vista...' : 'Vista previa' }}
            </button>
            <button class="btn btn-secondary" [disabled]="sendingOrderEmail() || !detailOrder()" (click)="openEmailConfirm(detailOrder()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.25 2.94 6.34z"/><path d="M18 8.17l-7.37 4.08a1.5 1.5 0 01-1.26 0L2 8.17V14a2 2 0 002 2h12a2 2 0 002-2V8.17z"/></svg>
              {{ sendingOrderEmail() ? 'Enviando...' : 'Enviar por correo' }}
            </button>
            <button class="btn btn-primary" (click)="openStatusFromDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
              Cambiar Estado
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPdfModal()) {
      <div class="modal-overlay">
        <div class="modal modal-pdf" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Vista previa de orden</h3>
              <div class="modal-sub">{{ detailOrder()?.orderNumber || 'Orden de compra' }}</div>
            </div>
            <button class="drawer-close" (click)="closePdfModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="pdf-iframe-wrap">
            @if (loadingPdf()) {
              <div class="pdf-loading">
                <div class="pdf-spinner"></div>
                <p>Generando vista previa...</p>
              </div>
            } @else if (pdfUrl()) {
              <iframe [src]="pdfUrl()!" class="pdf-iframe" frameborder="0"></iframe>
            }
          </div>
          <div class="modal-footer">
            <span class="pdf-note">Desde aquí también puedes descargar el PDF de la orden.</span>
            <button class="btn btn-secondary" (click)="closePdfModal()">Cerrar</button>
            <button class="btn btn-primary" [disabled]="downloadingPdf() || !detailOrder()" (click)="downloadOrderPdf(detailOrder()!)">
              {{ downloadingPdf() ? 'Descargando...' : 'Descargar PDF' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showEmailConfirmModal()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Confirmar envío</h3>
              <div class="modal-sub">{{ emailTargetOrder()?.orderNumber }} · {{ emailTargetOrder()?.customer?.name }}</div>
            </div>
            <button class="drawer-close" (click)="closeEmailConfirm()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Se enviará la orden de compra en PDF al siguiente correo. Verifica la dirección antes de continuar.</p>
            <div class="form-group" style="margin-top:12px;">
              <label>Correo del cliente</label>
              <input type="email" [(ngModel)]="emailConfirmTo" class="form-control" placeholder="cliente@empresa.com"/>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeEmailConfirm()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="sendingOrderEmail() || !emailConfirmTo.trim()" (click)="confirmSendOrderEmail()">
              {{ sendingOrderEmail() ? 'Enviando...' : 'Sí, enviar correo' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════════════ -->
    <!-- MODAL: Cambiar Estado de Orden                          -->
    <!-- ════════════════════════════════════════════════════════ -->
    @if (showStatusModal()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar Estado</h3>
            <button class="drawer-close" (click)="closeStatusModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Orden <strong>{{ statusTargetOrder()?.orderNumber }}</strong></p>
            <div class="form-group" style="margin-top:12px;">
              <label>Nuevo estado *</label>
              <select [(ngModel)]="newStatus" class="form-control">
                <option value="">— Seleccionar estado —</option>
                <option value="DRAFT">Borrador</option>
                <option value="SENT">Enviada</option>
                <option value="RECEIVED">Recibida</option>
                <option value="PARTIAL">Parcial</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeStatusModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving() || !newStatus" (click)="applyStatus()">
              {{ saving() ? 'Guardando...' : 'Aplicar cambio' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Layout principal ─────────────────────────────────────── */
    .page { max-width:1260px; padding-bottom:24px; }

    /* ── Hero shell ───────────────────────────────────────────── */
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .65fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(99,102,241,.18), transparent 26%),
        radial-gradient(circle at bottom right, rgba(16,185,129,.16), transparent 28%),
        linear-gradient(135deg, #1e1b4b 0%, #312e81 52%, #065f46 100%);
      box-shadow:0 24px 48px rgba(12,12,40,.18);
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
      color:#a5b4fc;
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
      color:#a5b4fc;
      margin-bottom:8px;
    }
    .hero-highlight strong { display:block; font-family:'Sora',sans-serif; font-size:40px; line-height:1; letter-spacing:-.06em; margin-bottom:8px; }
    .hero-highlight small { display:block; font-size:12px; line-height:1.5; color:rgba(236,244,255,.72); }
    .hero-mini-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; }
    .hero-mini-card { padding:12px 14px; border-radius:16px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.12); }
    .hero-mini-card__label { display:block; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:rgba(236,244,255,.72); margin-bottom:5px; }
    .hero-mini-card strong { font-family:'Sora',sans-serif; font-size:20px; color:#fff; letter-spacing:-.04em; }

    /* ── KPI strip ─────────────────────────────────────────────── */
    .kpi-strip { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; margin-bottom:18px; }
    .kpi-card { display:flex; align-items:flex-start; gap:14px; padding:16px 18px; border-radius:20px; background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; box-shadow:0 16px 28px rgba(12,28,53,.05); }
    .kpi-card__icon { width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #ede9fe, #e0efff); color:#4c1d95; flex-shrink:0; }
    .kpi-card__label { display:block; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#7b8fa8; margin-bottom:6px; }
    .kpi-card__value { font-family:'Sora',sans-serif; font-size:22px; line-height:1.1; letter-spacing:-.05em; color:#0c1c35; }

    /* ── Pestañas ──────────────────────────────────────────────── */
    .tabs-bar { display:flex; gap:4px; margin-bottom:18px; background:#f0f4f9; padding:4px; border-radius:14px; width:fit-content; border:1px solid #dce6f0; }
    .tab-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border:none; border-radius:10px; background:transparent; cursor:pointer; font-size:13.5px; font-weight:600; color:#64748b; transition:all .15s; }
    .tab-btn:hover { color:#1a407e; background:rgba(26,64,126,.06); }
    .tab-btn--active { background:#fff; color:#1a407e; box-shadow:0 4px 12px rgba(26,64,126,.1); }

    /* ── Filtros ───────────────────────────────────────────────── */
    .filters-shell { margin-bottom:18px; padding:14px 18px; border-radius:16px; background:rgba(255,255,255,.84); border:1px solid #dce6f0; box-shadow:0 8px 20px rgba(12,28,53,.04); backdrop-filter:blur(10px); }
    .filters-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; position:relative; max-width:380px; min-width:160px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; min-height:40px; padding:7px 12px 7px 36px; border:1px solid #dce6f0; border-radius:10px; font-size:14px; outline:none; background:#fff; box-shadow:0 4px 10px rgba(12,28,53,.03); }
    .search-input:focus { border-color:#4c1d95; box-shadow:0 0 0 3px rgba(76,29,149,0.08); }
    .filter-select { min-height:40px; padding:7px 12px; border:1px solid #dce6f0; border-radius:10px; font-size:13.5px; outline:none; background:#fff; color:#374151; box-shadow:0 4px 10px rgba(12,28,53,.03); }
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 8px 18px rgba(12,28,53,.03); }
    .view-toggle button { padding:9px 11px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button:hover { background:#f0f4f9; color:#4c1d95; }
    .view-toggle button.active { background:#4c1d95; color:#fff; }
    .results-pill { padding:7px 12px; border-radius:999px; background:#ede9fe; border:1px solid #c4b5fd; color:#5b21b6; font-size:12px; font-weight:700; white-space:nowrap; margin-left:auto; }

    /* ── Tabla ─────────────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; box-shadow:0 16px 28px rgba(12,28,53,.05); }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:14px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .data-table--inner { margin-top:8px; border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .data-table--inner th { font-size:10.5px; padding:9px 12px; }
    .data-table--inner td { padding:10px 12px; font-size:13px; }

    /* ── Celdas de entidad ─────────────────────────────────────── */
    .entity-cell { display:flex; align-items:center; gap:10px; }
    .entity-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#4c1d95,#065f46); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .entity-avatar--sm { width:28px; height:28px; font-size:10px; border-radius:6px; }
    .entity-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .entity-sub { font-size:12px; color:#9ca3af; margin-top:1px; }

    /* ── Badges ────────────────────────────────────────────────── */
    .doc-badge { background:#ede9fe; color:#4c1d95; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; }
    .doc-number { font-family:monospace; font-size:13px; color:#374151; }
    .text-muted { color:#9ca3af; }
    .term-badge { font-size:12px; color:#065f46; background:#d1fae5; padding:3px 8px; border-radius:6px; font-weight:600; }
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge.active { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }
    .order-number { font-family:monospace; font-weight:700; color:#4c1d95; font-size:13px; }
    .amount-cell { font-weight:700; color:#0c1c35; font-family:'Sora',sans-serif; font-size:13px; }

    /* Estados de orden coloreados */
    .order-status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .order-status-draft     { background:#f3f4f6; color:#374151; }
    .order-status-sent      { background:#dbeafe; color:#1e40af; }
    .order-status-received  { background:#d1fae5; color:#065f46; }
    .order-status-partial   { background:#fef3c7; color:#92400e; }
    .order-status-cancelled { background:#fee2e2; color:#991b1b; }

    /* ── Acciones ──────────────────────────────────────────────── */
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#9ca3af; transition:all .15s; box-shadow:0 4px 12px rgba(12,28,53,.03); }
    .btn-icon:hover { background:#f0f4ff; color:#4c1d95; border-color:#c4b5fd; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }

    /* ── Grid views ───────────────────────────────────────────── */
    .customer-grid, .orders-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
    .customer-card, .order-card {
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      border-radius:20px;
      padding:18px 16px 14px;
      position:relative;
      transition:box-shadow .18s, transform .18s, border-color .18s;
      display:flex;
      flex-direction:column;
      box-shadow:0 12px 26px rgba(12,28,53,.04);
    }
    .customer-card:hover, .order-card:hover { box-shadow:0 18px 32px rgba(76,29,149,.1); transform:translateY(-3px); border-color:#c4b5fd; }
    .customer-card--inactive { opacity:.76; border-color:#f0d4d4; background:#fdfafa; }
    .customer-card--skeleton, .order-card--skeleton { pointer-events:none; }
    .cc-status { position:absolute; top:12px; right:12px; }
    .cc-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 0 12px; }
    .cc-avatar { width:52px; height:52px; border-radius:12px; background:linear-gradient(135deg,#4c1d95,#065f46); color:#fff; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; margin-bottom:10px; }
    .cc-name { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:4px; }
    .cc-doc { font-size:11.5px; color:#9ca3af; display:flex; align-items:center; gap:5px; justify-content:center; }
    .cc-info { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px; display:flex; flex-direction:column; gap:5px; flex:1; }
    .cc-info-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; }
    .cc-info-row svg { color:#94a3b8; flex-shrink:0; }
    .cc-info-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cc-credit { color:#065f46; font-weight:600; }
    .cc-credit svg { color:#059669; }
    .cc-actions { display:flex; gap:6px; align-items:center; border-top:1px solid #f0f4f8; padding-top:10px; }
    .cc-actions .btn { flex:1; justify-content:center; }
    .order-card__head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:14px; }
    .order-card__number { font-family:'Sora',sans-serif; font-size:18px; line-height:1.1; color:#4c1d95; letter-spacing:-.04em; }
    .order-card__date { font-size:12px; color:#9ca3af; margin-top:4px; }
    .order-card__customer { display:flex; align-items:center; gap:10px; padding:12px 0; border-top:1px solid #f0f4f8; border-bottom:1px solid #f0f4f8; }
    .order-card__meta { display:flex; flex-direction:column; gap:8px; padding:12px 0; flex:1; }
    .order-card__meta-row { display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12.5px; color:#64748b; }
    .order-card__meta-row strong { color:#0c1c35; font-size:13.5px; }
    .order-card__actions { display:flex; gap:8px; border-top:1px solid #f0f4f8; padding-top:12px; }
    .order-card__actions .btn { flex:1; justify-content:center; }
    .pagination--standalone { background:#fff; border:1px solid #dce6f0; border-radius:12px; margin-top:4px; }
    .empty-state-grid { grid-column:1/-1; padding:64px 24px; text-align:center; color:#9ca3af; background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .empty-state-grid p { margin:16px 0; font-size:14px; }

    /* ── Paginación ────────────────────────────────────────────── */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; display:flex; align-items:center; justify-content:center; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#4c1d95; color:#4c1d95; }
    .btn-page.active { background:#4c1d95; border-color:#4c1d95; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* ── Skeleton ──────────────────────────────────────────────── */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:34px; height:34px; border-radius:8px; flex-shrink:0; }
    .cc-sk-avatar { width:52px; height:52px; border-radius:12px; display:block; margin:0 auto 10px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* ── Modal ─────────────────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal-overlay--drawer { align-items:stretch; justify-content:flex-end; padding:0; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-sm { max-width:420px; }
    .modal-lg { max-width:780px; }
    .modal-pdf { max-width:980px; height:90vh; }
    .modal-drawer { max-width:720px; height:100vh; max-height:100vh; border-radius:24px 0 0 24px; animation:slideInRight .22s ease-out; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-sub { font-size:12px; color:#9ca3af; margin-top:3px; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }
    .drawer-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .drawer-close:hover { background:#f0f4f8; color:#374151; }
    .pdf-iframe-wrap { flex:1; overflow:hidden; background:#e5e7eb; }
    .pdf-iframe { width:100%; height:100%; border:none; background:#fff; }
    .pdf-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px; color:#94a3b8; }
    .pdf-spinner { width:40px; height:40px; border:4px solid #e2e8f0; border-top-color:#1a407e; border-radius:50%; animation:spin .8s linear infinite; }
    .pdf-note { font-size:12px; color:#94a3b8; margin-right:auto; }

    /* ── Formulario ────────────────────────────────────────────── */
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#4c1d95; box-shadow:0 0 0 3px rgba(76,29,149,0.08); }
    .form-textarea { resize:vertical; min-height:72px; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#4c1d95; margin:0; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

    /* ── Líneas de orden ────────────────────────────────────────── */
    .lines-section { margin-top:8px; }
    .lines-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .lines-empty { padding:16px; text-align:center; color:#9ca3af; font-size:13px; background:#f8fafc; border-radius:8px; border:1px dashed #dce6f0; }
    .line-row { display:grid; grid-template-columns:2fr 1fr 1.2fr .8fr .8fr 1.4fr auto; gap:8px; align-items:flex-end; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f4f8; }
    .line-row label { display:block; font-size:11px; font-weight:600; color:#374151; margin-bottom:5px; }
    .line-remove { align-self:flex-end; margin-bottom:0; }
    .line-summary { min-width:140px; }
    .line-summary__values { min-height:42px; padding:8px 10px; border:1px solid #dce6f0; border-radius:8px; background:#f8fafc; display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:#64748b; }
    .line-summary__values strong { color:#0c1c35; font-size:12px; }

    /* ── Totales de orden ───────────────────────────────────────── */
    .order-totals { margin-top:16px; padding:14px 16px; background:#f8fafc; border-radius:10px; border:1px solid #dce6f0; }
    .order-totals--detail { margin-top:12px; }
    .order-totals-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; font-size:14px; color:#374151; }
    .order-totals-row strong { font-weight:700; color:#0c1c35; }
    .order-totals-row--total { border-top:1px solid #dce6f0; margin-top:6px; padding-top:10px; font-size:15px; font-weight:700; color:#0c1c35; }
    .order-totals-row--total strong { font-family:'Sora',sans-serif; font-size:18px; color:#4c1d95; }

    /* ── Detalle de orden ───────────────────────────────────────── */
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-section { margin-top:16px; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .detail-notes { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#faf9ff; border-radius:8px; border:1px solid #ede9fe; font-size:13px; color:#374151; margin-bottom:12px; }
    .detail-notes svg { flex-shrink:0; color:#7c3aed; margin-top:1px; }

    /* ── Botones ───────────────────────────────────────────────── */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#4c1d95; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#3b1580; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-sm { padding:7px 14px; font-size:13px; }

    /* ── Animación de entrada ──────────────────────────────────── */
    .animate-in { animation:fadeIn .25s ease-out; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* ── Responsive ───────────────────────────────────────────── */
    @media (max-width: 900px) {
      .line-row { grid-template-columns:1fr 1fr; }
    }
    @media (max-width: 768px) {
      .hero-shell { grid-template-columns:1fr; padding:18px; border-radius:24px; }
      .page-title { font-size:26px; }
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header .btn { width:100%; justify-content:center; }
      .hero-mini-grid, .kpi-strip { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .results-pill { margin-left:0; }
      .view-toggle { margin-left:0; }
    }
    @media (max-width: 640px) {
      .hero-mini-grid, .kpi-strip { grid-template-columns:1fr; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:520px; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal-overlay--drawer { align-items:flex-end; justify-content:stretch; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-drawer { max-width:100%; width:100%; height:95dvh; max-height:95dvh; border-radius:20px 20px 0 0; animation:fadeIn .2s ease-out; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .modal-footer .pdf-note { margin-right:0; }
      .form-row { grid-template-columns:1fr; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
      .detail-grid { grid-template-columns:1fr; }
      .line-row { grid-template-columns:1fr; }
      .customer-grid, .orders-grid { grid-template-columns:repeat(2, 1fr); gap:8px; }
    }
    @media (max-width: 400px) { .customer-grid, .orders-grid { grid-template-columns:1fr; } }
  `]
})
export class PurchasingComponent implements OnInit {
  // ── URLs de la API ──────────────────────────────────────────────────────────
  // Nota: environment.apiUrl ya incluye /api/v1; el módulo purchasing vive en /purchasing
  private readonly CUSTOMERS_API = `${environment.apiUrl}/purchasing/customers`;
  private readonly ORDERS_API    = `${environment.apiUrl}/purchasing/purchase-orders`;

  // ── Estado de pestañas ──────────────────────────────────────────────────────
  activeTab = signal<'customers' | 'orders'>('customers');
  customersViewMode = signal<'table' | 'grid'>('table');
  ordersViewMode = signal<'table' | 'grid'>('table');

  // ── Clientes asociados a compras ───────────────────────────────────────────
  customers           = signal<PurchasingCustomer[]>([]);
  allCustomers        = signal<PurchasingCustomer[]>([]);
  loadingCustomers    = signal(false);
  totalCustomers      = signal(0);
  pageCustomers       = signal(1);
  totalPagesCustomers = signal(1);

  // ── Órdenes de compra ───────────────────────────────────────────────────────
  orders           = signal<PurchaseOrder[]>([]);
  loadingOrders    = signal(false);
  totalOrders      = signal(0);
  pageOrders       = signal(1);
  totalPagesOrders = signal(1);

  // ── KPIs calculados ─────────────────────────────────────────────────────────
  activeCustomers = computed(() => this.allCustomers().filter(c => c.isActive).length);
  receivedOrders  = computed(() => this.orders().filter(o => o.status === 'RECEIVED').length);
  pendingOrders   = computed(() => this.orders().filter(o => o.status === 'DRAFT' || o.status === 'SENT').length);

  // ── Estado común ────────────────────────────────────────────────────────────
  saving = signal(false);
  readonly limit = 20;

  // ── Filtros ─────────────────────────────────────────────────────────────────
  searchText      = '';
  filterActive    = '';
  filterStatus    = '';
  filterCustomerId = '';
  filterDateFrom  = '';
  filterDateTo    = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Modal Cliente ───────────────────────────────────────────────────────────
  showCustomerModal = signal(false);
  editingCustomerId = signal<string | null>(null);
  customerForm: CustomerForm = this.emptyCustomerForm();

  // ── Modal Orden ─────────────────────────────────────────────────────────────
  showOrderModal = signal(false);
  editingOrderId = signal<string | null>(null);
  orderForm: OrderForm = this.emptyOrderForm();

  // Totales en tiempo real para la modal de nueva orden
  orderSubtotal = signal(0);
  orderTax      = signal(0);
  orderTotal    = signal(0);

  // ── Detalle de orden ─────────────────────────────────────────────────────────
  detailOrder = signal<PurchaseOrder | null>(null);
  showPdfModal = signal(false);
  pdfUrl = signal<SafeResourceUrl | null>(null);
  loadingPdf = signal(false);
  downloadingPdf = signal(false);
  sendingOrderEmail = signal(false);
  showEmailConfirmModal = signal(false);
  emailTargetOrder = signal<PurchaseOrder | null>(null);
  emailConfirmTo = '';
  private objectUrl: string | null = null;

  // ── Modal cambiar estado ─────────────────────────────────────────────────────
  showStatusModal  = signal(false);
  statusTargetOrder = signal<PurchaseOrder | null>(null);
  newStatus = '';

  constructor(
    private readonly http:   HttpClient,
    private readonly notify: NotificationService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.loadCustomers();
    this.loadAllCustomers();
    this.loadOrders();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Gestión de pestañas
  // ────────────────────────────────────────────────────────────────────────────

  switchTab(tab: 'customers' | 'orders') {
    this.activeTab.set(tab);
    this.searchText = '';
    if (tab === 'customers') this.loadCustomers();
    else this.loadOrders();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Carga de clientes asociados a compras
  // ────────────────────────────────────────────────────────────────────────────

  loadCustomers() {
    this.loadingCustomers.set(true);
    const params: Record<string, string | number> = {
      page:  this.pageCustomers(),
      limit: this.limit,
    };
    if (this.searchText)   params['search']   = this.searchText;
    if (this.filterActive) params['isActive']  = this.filterActive;

    this.http.get<PaginatedResponse<PurchasingCustomer>>(this.CUSTOMERS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.customers.set((data ?? []).map((customer) => this.mapCustomer(customer)));
        this.totalCustomers.set(total ?? 0);
        this.totalPagesCustomers.set(totalPages ?? 1);
        this.loadingCustomers.set(false);
      },
      error: () => {
        this.loadingCustomers.set(false);
        this.notify.error('Error al cargar clientes');
      },
    });
  }

  /** Carga todos los clientes activos para el select de la orden */
  private loadAllCustomers() {
    this.http.get<PaginatedResponse<PurchasingCustomer>>(this.CUSTOMERS_API, { params: { limit: 999 } }).subscribe({
      next: ({ data }) => this.allCustomers.set((data ?? []).map((customer) => this.mapCustomer(customer))),
      error: () => { /* no bloqueante */ },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Carga de órdenes de compra
  // ────────────────────────────────────────────────────────────────────────────

  loadOrders() {
    this.loadingOrders.set(true);
    const params: Record<string, string | number> = {
      page:  this.pageOrders(),
      limit: this.limit,
    };
    if (this.searchText)       params['search']     = this.searchText;
    if (this.filterStatus)     params['status']     = this.filterStatus;
    if (this.filterCustomerId) params['customerId'] = this.filterCustomerId;
    if (this.filterDateFrom)   params['dateFrom']   = this.filterDateFrom;
    if (this.filterDateTo)     params['dateTo']     = this.filterDateTo;

    this.http.get<PaginatedResponse<PurchaseOrder>>(this.ORDERS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.orders.set((data ?? []).map((order) => this.mapOrder(order)));
        this.totalOrders.set(total ?? 0);
        this.totalPagesOrders.set(totalPages ?? 1);
        this.loadingOrders.set(false);
      },
      error: () => {
        this.loadingOrders.set(false);
        this.notify.error('Error al cargar órdenes de compra');
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Búsqueda con debounce
  // ────────────────────────────────────────────────────────────────────────────

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      if (this.activeTab() === 'customers') {
        this.pageCustomers.set(1);
        this.loadCustomers();
      } else {
        this.pageOrders.set(1);
        this.loadOrders();
      }
    }, 350);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Paginación de clientes
  // ────────────────────────────────────────────────────────────────────────────

  setPageCustomers(p: number) { this.pageCustomers.set(p); this.loadCustomers(); }

  pageRangeCustomers(): number[] {
    return this.buildRange(this.totalPagesCustomers(), this.pageCustomers());
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Paginación de órdenes
  // ────────────────────────────────────────────────────────────────────────────

  setPageOrders(p: number) { this.pageOrders.set(p); this.loadOrders(); }

  pageRangeOrders(): number[] {
    return this.buildRange(this.totalPagesOrders(), this.pageOrders());
  }

  private buildRange(total: number, current: number): number[] {
    const range: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) range.push(i);
    return range;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD de clientes
  // ────────────────────────────────────────────────────────────────────────────

  openCustomerModal(customer?: PurchasingCustomer) {
    if (customer) {
      this.editingCustomerId.set(customer.id);
      this.customerForm = {
        documentType:    customer.documentType,
        documentNumber:  customer.documentNumber,
        name:            customer.name,
        email:           customer.email           ?? '',
        phone:           customer.phone           ?? '',
        address:         customer.address         ?? '',
        paymentTermDays: customer.paymentTermDays  ?? null,
        creditLimit:     customer.creditLimit      ?? null,
        notes:           customer.notes           ?? '',
      };
    } else {
      this.editingCustomerId.set(null);
      this.customerForm = this.emptyCustomerForm();
    }
    this.showCustomerModal.set(true);
  }

  closeCustomerModal() { this.showCustomerModal.set(false); }

  saveCustomer() {
    if (!this.customerForm.documentNumber?.trim() || !this.customerForm.name?.trim()) {
      this.notify.warning('Completa los campos obligatorios (documento y nombre)');
      return;
    }
    this.saving.set(true);
    const id = this.editingCustomerId();
    const { paymentTermDays, ...rest } = this.customerForm;
    const payload = {
      ...rest,
      creditDays: paymentTermDays,
    };
    const request$ = id
      ? this.http.put(`${this.CUSTOMERS_API}/${id}`, payload)
      : this.http.post(this.CUSTOMERS_API, payload);

    request$.subscribe({
      next: () => {
        this.notify.success(id ? 'Cliente actualizado' : 'Cliente creado exitosamente');
        this.saving.set(false);
        this.closeCustomerModal();
        this.loadCustomers();
        this.loadAllCustomers();
      },
      error: (err) => {
        this.notify.error(err?.error?.message || 'Error al guardar el cliente');
        this.saving.set(false);
      },
    });
  }

  toggleCustomer(customer: PurchasingCustomer) {
    this.http.patch(`${this.CUSTOMERS_API}/${customer.id}/toggle`, {}).subscribe({
      next: () => {
        this.notify.success(customer.isActive ? 'Cliente desactivado' : 'Cliente activado');
        this.loadCustomers();
        this.loadAllCustomers();
      },
      error: (err) => this.notify.error(err?.error?.message || 'Error al cambiar estado'),
    });
  }

  /** Cambia la pestaña a órdenes filtrando por el cliente seleccionado */
  viewCustomerOrders(customer: PurchasingCustomer) {
    this.filterCustomerId = customer.id;
    this.activeTab.set('orders');
    this.pageOrders.set(1);
    this.loadOrders();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD de órdenes de compra
  // ────────────────────────────────────────────────────────────────────────────

  openOrderModal() {
    this.editingOrderId.set(null);
    this.orderForm = this.emptyOrderForm();
    this.orderSubtotal.set(0);
    this.orderTax.set(0);
    this.orderTotal.set(0);
    this.showOrderModal.set(true);
  }

  closeOrderModal() {
    this.showOrderModal.set(false);
    this.editingOrderId.set(null);
  }

  openEditOrder(order: PurchaseOrder) {
    if (order.status !== 'DRAFT') {
      this.notify.warning('Solo se pueden editar órdenes en estado borrador');
      return;
    }

    if (!order.lines) {
      this.http.get<PurchaseOrder>(`${this.ORDERS_API}/${order.id}`).subscribe({
        next: (full) => this.startOrderEditing(this.mapOrder(full)),
        error: () => this.notify.error('No fue posible cargar la orden para editarla'),
      });
      return;
    }

    this.startOrderEditing(order);
  }

  private startOrderEditing(order: PurchaseOrder) {
    this.editingOrderId.set(order.id);
    this.orderForm = {
      customerId: order.customer?.id ?? '',
      issueDate: this.asInputDate(order.issueDate),
      dueDate: this.asInputDate(order.dueDate),
      notes: order.notes ?? '',
      lines: (order.lines ?? []).map((line) => ({
        description: line.description ?? '',
        quantity: Number(line.quantity ?? 0),
        unitPrice: Number(line.unitPrice ?? 0),
        taxPercent: Number(line.taxPercent ?? 0),
        discountPercent: Number(line.discountPercent ?? 0),
      })),
    };

    if (this.orderForm.lines.length === 0) {
      this.orderForm.lines = [{
        description: '',
        quantity: null,
        unitPrice: null,
        taxPercent: 19,
        discountPercent: 0,
      }];
    }

    this.recalculate();
    this.showOrderModal.set(true);
  }

  addLine() {
    this.orderForm.lines.push({
      description:     '',
      quantity:        null,
      unitPrice:       null,
      taxPercent:      19,
      discountPercent: 0,
    });
  }

  removeLine(index: number) {
    this.orderForm.lines.splice(index, 1);
    this.recalculate();
  }

  private sanitizePercent(value: number | null | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(100, Math.max(0, numeric));
  }

  private sanitizeAmount(value: number | null | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, numeric);
  }

  lineBase(line: OrderLine | OrderLineForm): number {
    const qty = this.sanitizeAmount((line as any).quantity);
    const price = this.sanitizeAmount((line as any).unitPrice);
    const discount = this.sanitizePercent((line as any).discountPercent ?? 0);
    return qty * price * (1 - discount / 100);
  }

  lineTax(line: OrderLine | OrderLineForm): number {
    const base = this.lineBase(line);
    const taxPercent = this.sanitizePercent((line as any).taxPercent ?? 0);
    return base * (taxPercent / 100);
  }

  lineTotal(line: OrderLine | OrderLineForm): number {
    const base = this.lineBase(line);
    const tax = this.lineTax(line);
    return base + tax;
  }

  /** Recalcula subtotal, IVA y total en tiempo real */
  recalculate() {
    let subtotal = 0;
    let tax      = 0;
    for (const l of this.orderForm.lines) {
      subtotal += this.lineBase(l);
      tax += this.lineTax(l);
    }
    this.orderSubtotal.set(subtotal);
    this.orderTax.set(tax);
    this.orderTotal.set(subtotal + tax);
  }

  saveOrder() {
    const editingId = this.editingOrderId();
    if (!editingId && !this.orderForm.customerId) {
      this.notify.warning('Selecciona un cliente para la orden');
      return;
    }
    if (!this.orderForm.issueDate) {
      this.notify.warning('Indica la fecha de emisión de la orden');
      return;
    }
    if (this.orderForm.lines.length === 0) {
      this.notify.warning('Agrega al menos una línea de compra');
      return;
    }
    const invalidLine = this.orderForm.lines.find((line) =>
      !line.description?.trim() ||
      this.sanitizeAmount(line.quantity) <= 0 ||
      this.sanitizeAmount(line.unitPrice) < 0,
    );
    if (invalidLine) {
      this.notify.warning('Completa cada línea con descripción, cantidad válida y precio unitario');
      return;
    }
    this.saving.set(true);
    const payload: any = {
      issueDate: this.orderForm.issueDate,
      dueDate: this.orderForm.dueDate || undefined,
      notes: this.orderForm.notes || undefined,
      items: this.orderForm.lines.map((line, index) => ({
        description: line.description.trim(),
        quantity: this.sanitizeAmount(line.quantity),
        unitPrice: this.sanitizeAmount(line.unitPrice),
        taxRate: this.sanitizePercent(line.taxPercent),
        discount: this.sanitizePercent(line.discountPercent),
        position: index + 1,
      })),
    };
    if (!editingId) {
      payload.customerId = this.orderForm.customerId;
    }

    const request$ = editingId
      ? this.http.put(`${this.ORDERS_API}/${editingId}`, payload)
      : this.http.post(this.ORDERS_API, payload);

    request$.subscribe({
      next: () => {
        this.notify.success(editingId ? 'Orden de compra actualizada exitosamente' : 'Orden de compra creada exitosamente');
        this.saving.set(false);
        this.closeOrderModal();
        this.loadOrders();
        if (this.detailOrder()?.id === editingId) {
          this.http.get<PurchaseOrder>(`${this.ORDERS_API}/${editingId}`).subscribe({
            next: (full) => this.detailOrder.set(this.mapOrder(full)),
            error: () => this.detailOrder.set(null),
          });
        }
      },
      error: (err) => {
        this.notify.error(err?.error?.message || (editingId ? 'Error al actualizar la orden' : 'Error al crear la orden'));
        this.saving.set(false);
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Detalle de orden
  // ────────────────────────────────────────────────────────────────────────────

  openOrderDetail(order: PurchaseOrder) {
    // Si la orden no trae líneas, las carga desde el backend
    if (!order.lines) {
      this.http.get<PurchaseOrder>(`${this.ORDERS_API}/${order.id}`).subscribe({
        next: (full) => this.detailOrder.set(this.mapOrder(full)),
        error: () => {
          this.detailOrder.set(order);
          this.notify.warning('No se pudieron cargar los detalles de la orden');
        },
      });
    } else {
      this.detailOrder.set(order);
    }
  }

  openEditFromDetail() {
    const order = this.detailOrder();
    if (!order) return;
    this.detailOrder.set(null);
    this.openEditOrder(order);
  }

  openOrderPdfPreview(order: PurchaseOrder) {
    this.loadingPdf.set(true);
    this.showPdfModal.set(true);
    this.http.get(`${this.ORDERS_API}/${order.id}/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.objectUrl = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.loadingPdf.set(false);
      },
      error: () => {
        this.loadingPdf.set(false);
        this.notify.error('No fue posible generar la vista previa de la orden');
      },
    });
  }

  downloadOrderPdf(order: PurchaseOrder) {
    this.downloadingPdf.set(true);
    this.http.get(`${this.ORDERS_API}/${order.id}/pdf/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `${order.orderNumber}.pdf`);
        this.downloadingPdf.set(false);
      },
      error: (err) => {
        this.downloadingPdf.set(false);
        this.notify.error(err?.error?.message || 'No fue posible descargar el PDF de la orden');
      },
    });
  }

  openEmailConfirm(order: PurchaseOrder) {
    this.emailTargetOrder.set(order);
    this.emailConfirmTo = order.customer?.email ?? '';
    this.showEmailConfirmModal.set(true);
  }

  closeEmailConfirm() {
    this.showEmailConfirmModal.set(false);
    this.emailTargetOrder.set(null);
    this.emailConfirmTo = '';
  }

  confirmSendOrderEmail() {
    const order = this.emailTargetOrder();
    const email = this.emailConfirmTo.trim();
    if (!order) return;
    if (!email) {
      this.notify.warning('Ingresa un correo electrónico antes de enviar');
      return;
    }
    this.sendingOrderEmail.set(true);
    this.http.post<{ message?: string }>(`${this.ORDERS_API}/${order.id}/email`, { to: email }).subscribe({
      next: (response) => {
        this.sendingOrderEmail.set(false);
        this.closeEmailConfirm();
        this.notify.success(response?.message || `Orden enviada a ${email}`);
      },
      error: (err) => {
        this.sendingOrderEmail.set(false);
        this.notify.error(err?.error?.message || 'No fue posible enviar el correo de la orden');
      },
    });
  }

  closePdfModal() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.pdfUrl.set(null);
    this.showPdfModal.set(false);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Cambio de estado
  // ────────────────────────────────────────────────────────────────────────────

  openStatusModal(order: PurchaseOrder) {
    this.statusTargetOrder.set(order);
    this.newStatus = order.status;
    this.showStatusModal.set(true);
  }

  /** Abre el modal de estado directamente desde el detalle */
  openStatusFromDetail() {
    const order = this.detailOrder();
    if (!order) return;
    this.detailOrder.set(null);
    this.openStatusModal(order);
  }

  closeStatusModal() {
    this.showStatusModal.set(false);
    this.statusTargetOrder.set(null);
    this.newStatus = '';
  }

  applyStatus() {
    const order = this.statusTargetOrder();
    if (!order || !this.newStatus) return;
    this.saving.set(true);
    this.http.patch(`${this.ORDERS_API}/${order.id}/status`, { status: this.newStatus }).subscribe({
      next: () => {
        this.notify.success(`Estado actualizado a "${this.orderStatusLabel(this.newStatus as OrderStatus)}"`);
        this.saving.set(false);
        this.closeStatusModal();
        this.loadOrders();
      },
      error: (err) => {
        this.notify.error(err?.error?.message || 'Error al cambiar el estado');
        this.saving.set(false);
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers de formato y cálculo
  // ────────────────────────────────────────────────────────────────────────────

  initials(name: string): string {
    return (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  formatCurrency(value?: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style:    'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  orderStatusLabel(status: OrderStatus | string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
  }

  /** Subtotal de una línea individual (usado en el detalle de la orden) */
  calcLineSubtotal(line: OrderLine): number {
    return this.lineBase(line);
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private asInputDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private mapCustomer(customer: any): PurchasingCustomer {
    return {
      ...customer,
      paymentTermDays: customer?.paymentTermDays ?? customer?.paymentTerms ?? customer?.creditDays ?? null,
    };
  }

  private mapOrder(order: any): PurchaseOrder {
    const sourceLines = order?.lines ?? order?.items;
    return {
      ...order,
      orderNumber: order?.orderNumber ?? order?.number ?? '',
      customer: order?.customer ?? order?.supplier,
      lines: sourceLines?.map((line: any) => ({
        description: line.description,
        quantity: Number(line.quantity ?? 0),
        unitPrice: Number(line.unitPrice ?? 0),
        taxPercent: Number(line.taxPercent ?? line.taxRate ?? 0),
        discountPercent: Number(line.discountPercent ?? line.discount ?? 0),
      })),
      subtotal: Number(order?.subtotal ?? 0),
      taxAmount: Number(order?.taxAmount ?? 0),
      total: Number(order?.total ?? 0),
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Factories de formulario vacío
  // ────────────────────────────────────────────────────────────────────────────

  private emptyCustomerForm(): CustomerForm {
    return {
      documentType:    'NIT',
      documentNumber:  '',
      name:            '',
      email:           '',
      phone:           '',
      address:         '',
      paymentTermDays: null,
      creditLimit:     null,
      notes:           '',
    };
  }

  private emptyOrderForm(): OrderForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      customerId: '',
      issueDate:  today,
      dueDate:    '',
      notes:      '',
      lines:      [],
    };
  }
}
