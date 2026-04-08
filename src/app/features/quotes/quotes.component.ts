import { Component, HostListener, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.component';
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
  salesOwnerName?: string;
  opportunityName?: string;
  sourceChannel?: string;
  lostReason?: string;
  currency: string;
  paymentTermLabel?: string;
  paymentTermDays?: number;
  deliveryLeadTimeDays?: number;
  deliveryTerms?: string;
  incotermCode?: string;
  incotermLocation?: string;
  exchangeRate?: number;
  commercialConditions?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  approvalRequired?: boolean;
  currentVersion?: number;
  approval?: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
    reason: string;
    sequence?: number;
    policyName?: string | null;
    requiredRole?: string | null;
    rejectedReason?: string | null;
  } | null;
  approvalFlow?: QuoteApprovalStep[];
  customer: { id: string; name: string; documentNumber: string };
  items?: QuoteItem[];
  createdAt: string;
}

interface QuoteAttachment {
  id: string;
  quoteId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  category?: string | null;
  notes?: string | null;
  sizeBytes?: number | null;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteComment {
  id: string;
  quoteId: string;
  commentType: string;
  message: string;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuoteAuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: any;
  after?: any;
  userId?: string | null;
  userName?: string | null;
  createdAt: string;
}

interface QuoteInventoryIntegrationLine {
  lineIndex: number;
  productId: string;
  description: string;
  sku: string;
  unit: string;
  status: string;
  requestedQuantity: number;
  currentStock: number;
  minStock: number;
  enoughStock: boolean;
  shortage: number;
  lowStock: boolean;
}

interface QuoteIntegrationSummary {
  quoteId: string;
  quoteNumber: string;
  sales: {
    status: string;
    canConvertToInvoice: boolean;
    hasInvoice: boolean;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
  };
  fiscal: {
    canSendToDian: boolean;
    requiresInvoiceCreation: boolean;
    dianFlowLabel: string;
  };
  inventory: {
    checkedLines: number;
    availableLines: number;
    unavailableLines: number;
    lowStockLines: number;
    lines: QuoteInventoryIntegrationLine[];
  };
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

interface CommercialMasterOption {
  id: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  code?: string | null;
  color?: string | null;
  position?: number;
  isDefault?: boolean;
  isClosed?: boolean;
  isActive?: boolean;
}

interface QuotePriceListItem {
  id?: string;
  productId?: string | null;
  description: string;
  unitPrice: number;
  taxRate: number;
  position?: number;
}

interface QuotePriceList {
  id: string;
  name: string;
  description?: string | null;
  currency: string;
  isDefault?: boolean;
  items: QuotePriceListItem[];
}

interface QuoteTemplateItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  position?: number;
}

interface QuoteTemplate {
  id: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  terms?: string | null;
  currency: string;
  isDefault?: boolean;
  items: QuoteTemplateItem[];
}

interface QuoteCommercialMasters {
  salesOwners: CommercialMasterOption[];
  sourceChannels: CommercialMasterOption[];
  lostReasons: CommercialMasterOption[];
  stages: CommercialMasterOption[];
  priceLists: QuotePriceList[];
  templates: QuoteTemplate[];
}

type MasterTab = 'salesOwners' | 'sourceChannels' | 'lostReasons' | 'stages' | 'priceLists' | 'templates';

interface QuoteFollowUp {
  id: string;
  activityType: string;
  notes: string;
  scheduledAt?: string | null;
  createdAt: string;
}

interface QuoteAnalyticsSummary {
  totalQuotes: number;
  totalAmount: number;
  convertedAmount: number;
  acceptedAmount: number;
  wonQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  winRate: number;
  lossRate: number;
  pendingApprovals: number;
  followUpCount: number;
  totalsByStatus: Record<string, number>;
  bySalesOwner: Array<{ name: string; totalQuotes: number; totalAmount: number; wonQuotes: number; winRate: number }>;
  byChannel: Array<{ channel: string; totalQuotes: number; totalAmount: number }>;
}

interface QuoteApprovalStep {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
  reason: string;
  sequence: number;
  policyName?: string | null;
  requiredRole?: string | null;
  thresholdType?: string | null;
  thresholdValue?: number | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
}

interface QuoteApprovalPolicy {
  id: string;
  name: string;
  approvalType: 'TOTAL' | 'DISCOUNT';
  thresholdValue: number;
  requiredRole: string;
  sequence: number;
  description?: string | null;
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
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
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="openApprovalPoliciesModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M10 1.75a.75.75 0 01.75.75v.756a6.502 6.502 0 012.52 1.045l.535-.536a.75.75 0 111.06 1.061l-.535.535a6.502 6.502 0 011.045 2.52h.756a.75.75 0 010 1.5h-.756a6.502 6.502 0 01-1.045 2.52l.535.535a.75.75 0 11-1.06 1.061l-.536-.535a6.502 6.502 0 01-2.52 1.045v.756a.75.75 0 01-1.5 0v-.756a6.502 6.502 0 01-2.52-1.045l-.536.535a.75.75 0 11-1.06-1.06l.535-.536A6.502 6.502 0 014.23 9.776h-.756a.75.75 0 010-1.5h.756A6.502 6.502 0 015.275 5.76l-.535-.536a.75.75 0 111.06-1.06l.536.535A6.502 6.502 0 018.856 3.65V2.5a.75.75 0 01.75-.75zm0 4a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5z"/>
              </svg>
              Aprobaciones
            </button>
            <button class="btn btn-secondary" (click)="openCommercialMastersModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M10 2a2 2 0 012 2v.341a6.002 6.002 0 012.5 1.443l.241-.14a2 2 0 012.732.732l1 1.732a2 2 0 01-.732 2.732l-.243.14a6.064 6.064 0 010 2.89l.243.14a2 2 0 01.732 2.732l-1 1.732a2 2 0 01-2.732.732l-.241-.14A6.002 6.002 0 0112 15.659V16a2 2 0 11-4 0v-.341a6.002 6.002 0 01-2.5-1.443l-.241.14a2 2 0 01-2.732-.732l-1-1.732a2 2 0 01.732-2.732l.243-.14a6.064 6.064 0 010-2.89l-.243-.14A2 2 0 011.527 3.99l1-1.732A2 2 0 015.26 1.526l.241.14A6.002 6.002 0 018 4.341V4a2 2 0 012-2zm0 5a3 3 0 100 6 3 3 0 000-6z"/>
              </svg>
              Maestros comerciales
            </button>
            <button class="btn btn-primary" (click)="openFormModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
              Nueva cotización
            </button>
          </div>
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

      <section class="analytics-strip">
        <article class="analytics-card">
          <span class="analytics-card__label">Conversión</span>
          <strong>{{ analyticsSummary()?.conversionRate ?? 0 }}%</strong>
          <small>{{ analyticsStatusCount('CONVERTED') }} cotizaciones convertidas</small>
        </article>
        <article class="analytics-card">
          <span class="analytics-card__label">Ganadas</span>
          <strong>{{ analyticsSummary()?.winRate ?? 0 }}%</strong>
          <small>{{ analyticsSummary()?.wonQuotes ?? 0 }} aceptadas o convertidas</small>
        </article>
        <article class="analytics-card">
          <span class="analytics-card__label">En seguimiento</span>
          <strong>{{ analyticsSummary()?.followUpCount ?? 0 }}</strong>
          <small>{{ analyticsSummary()?.pendingApprovals ?? 0 }} aprobaciones pendientes</small>
        </article>
        <article class="analytics-card">
          <span class="analytics-card__label">Valor convertido</span>
          <strong>{{ formatCurrency(analyticsSummary()?.convertedAmount ?? 0) }}</strong>
          <small>{{ topSalesOwnerLabel() }}</small>
        </article>
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
                    @if (q.approvalRequired) {
                      <div style="margin-top:6px">
                        <span class="status-badge status-draft">{{ approvalLabel(q.approval?.status || 'PENDING') }}</span>
                      </div>
                    }
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
                      <button class="btn-icon btn-icon-primary" [title]="q.invoiceId ? 'Enviar factura a DIAN' : 'Convertir y enviar a DIAN'" (click)="sendToDian(q)" [disabled]="sendingDian()[q.id]">
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

            <div class="form-row form-row--triple">
              <div class="form-group">
                <label>Responsable comercial</label>
                <select [(ngModel)]="quoteForm.salesOwnerId" (ngModelChange)="onSalesOwnerChange($event)" class="form-control">
                  <option value="">Sin asignar</option>
                  @for (owner of commercialMasters().salesOwners; track owner.id) {
                    <option [value]="owner.id">{{ owner.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Oportunidad</label>
                <input type="text" [(ngModel)]="quoteForm.opportunityName" class="form-control"
                       placeholder="Ej. Renovación anual"/>
              </div>
              <div class="form-group">
                <label>Canal</label>
                <select [(ngModel)]="quoteForm.sourceChannelId" (ngModelChange)="onSourceChannelChange($event)" class="form-control">
                  <option value="">Sin canal</option>
                  @for (channel of commercialMasters().sourceChannels; track channel.id) {
                    <option [value]="channel.id">{{ channel.name }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="form-row form-row--triple">
              <div class="form-group">
                <label>Lista de precios</label>
                <select [(ngModel)]="quoteForm.priceListId" (ngModelChange)="onPriceListChange($event)" class="form-control">
                  <option value="">Sin lista aplicada</option>
                  @for (priceList of commercialMasters().priceLists; track priceList.id) {
                    <option [value]="priceList.id">{{ priceList.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Plantilla</label>
                <select [(ngModel)]="quoteForm.templateId" (ngModelChange)="onTemplateChange($event)" class="form-control">
                  <option value="">Sin plantilla</option>
                  @for (template of commercialMasters().templates; track template.id) {
                    <option [value]="template.id">{{ template.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Moneda de referencia</label>
                <input type="text" [value]="selectedCommercialCurrency()" class="form-control" readonly/>
              </div>
            </div>

            <div class="form-section-title">Condiciones comerciales</div>

            <div class="form-row form-row--triple">
              <div class="form-group">
                <label>Término de pago</label>
                <input type="text" [(ngModel)]="quoteForm.paymentTermLabel" class="form-control" placeholder="Ej. Crédito 30 días"/>
              </div>
              <div class="form-group">
                <label>Días de pago</label>
                <input type="number" [(ngModel)]="quoteForm.paymentTermDays" class="form-control" min="0" step="1" placeholder="30"/>
              </div>
              <div class="form-group">
                <label>Tasa de cambio</label>
                <input type="number" [(ngModel)]="quoteForm.exchangeRate" class="form-control" min="0.0001" step="0.0001"/>
              </div>
            </div>

            <div class="form-row form-row--triple">
              <div class="form-group">
                <label>Incoterm</label>
                <input type="text" [(ngModel)]="quoteForm.incotermCode" class="form-control" placeholder="Ej. EXW, FOB, CIF"/>
              </div>
              <div class="form-group">
                <label>Ubicación incoterm</label>
                <input type="text" [(ngModel)]="quoteForm.incotermLocation" class="form-control" placeholder="Ej. Bogotá, Colombia"/>
              </div>
              <div class="form-group">
                <label>Entrega en días</label>
                <input type="number" [(ngModel)]="quoteForm.deliveryLeadTimeDays" class="form-control" min="0" step="1" placeholder="5"/>
              </div>
            </div>

            <div class="form-group">
              <label>Condiciones de entrega</label>
              <textarea [(ngModel)]="quoteForm.deliveryTerms" class="form-control form-textarea"
                        rows="2" placeholder="Ej. Entrega parcial permitida, sujeto a disponibilidad..."></textarea>
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

            <div class="form-group">
              <label>Cláusulas comerciales avanzadas</label>
              <textarea [(ngModel)]="quoteForm.commercialConditions" class="form-control form-textarea"
                        rows="3" placeholder="Restricciones, condiciones de servicio, exclusiones, revisiones de precio..."></textarea>
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
            <div class="drawer-header__content">
              <div class="drawer-avatar">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
                </svg>
              </div>
              <div class="drawer-headline">
                <span class="drawer-kicker">Detalle comercial</span>
                <div class="drawer-title">{{ detailQuote()!.number }}</div>
                <div class="drawer-meta">
                  <span class="status-badge status-{{ detailQuote()!.status.toLowerCase() }}">
                    {{ statusLabel(detailQuote()!.status) }}
                  </span>
                  <span class="drawer-meta__text">Versión v{{ detailQuote()!.currentVersion || 0 }}</span>
                  <span class="drawer-meta__text">Emitida {{ formatDate(detailQuote()!.issueDate) }}</span>
                </div>
              </div>
            </div>
            <button class="drawer-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="drawer-body">
            <div class="quote-spotlight">
              <div class="quote-spotlight__main">
                <span class="quote-spotlight__label">Cliente</span>
                <strong>{{ detailQuote()!.customer.name }}</strong>
                <small>{{ detailQuote()!.customer.documentNumber }}</small>
              </div>
              <div class="quote-spotlight__metric">
                <span class="quote-spotlight__label">Total</span>
                <strong>{{ formatCurrency(detailQuote()!.total) }}</strong>
                <small>IVA {{ formatCurrency(detailQuote()!.taxAmount) }}</small>
              </div>
              <div class="quote-spotlight__metric">
                <span class="quote-spotlight__label">Vigencia</span>
                <strong>{{ detailQuote()!.expiresAt ? formatDate(detailQuote()!.expiresAt!) : 'Sin fecha' }}</strong>
                <small>{{ detailQuote()!.sourceChannel || 'Sin canal comercial' }}</small>
              </div>
            </div>

            <!-- Datos del cliente -->
            <div class="detail-section detail-card">
              <div class="detail-section-title">Cliente</div>
              <div class="detail-grid">
                <div class="detail-item"><span>Nombre</span><strong>{{ detailQuote()!.customer.name }}</strong></div>
                <div class="detail-item"><span>Documento</span><strong>{{ detailQuote()!.customer.documentNumber }}</strong></div>
                <div class="detail-item"><span>Fecha emisión</span><strong>{{ formatDate(detailQuote()!.issueDate) }}</strong></div>
                <div class="detail-item"><span>Vence</span><strong>{{ detailQuote()!.expiresAt ? formatDate(detailQuote()!.expiresAt!) : '—' }}</strong></div>
              </div>
            </div>

            <div class="detail-section detail-card">
              <div class="detail-section-title">Gestión comercial</div>
              <div class="detail-grid">
                <div class="detail-item"><span>Responsable</span><strong>{{ detailQuote()!.salesOwnerName || 'Sin asignar' }}</strong></div>
                <div class="detail-item"><span>Canal</span><strong>{{ detailQuote()!.sourceChannel || 'Sin canal' }}</strong></div>
                <div class="detail-item"><span>Oportunidad</span><strong>{{ detailQuote()!.opportunityName || 'Sin oportunidad' }}</strong></div>
                <div class="detail-item"><span>Motivo de pérdida</span><strong>{{ detailQuote()!.lostReason || 'No aplica' }}</strong></div>
              </div>
            </div>

            <div class="detail-section detail-card">
              <div class="detail-section-title">Condiciones comerciales</div>
              <div class="detail-grid">
                <div class="detail-item"><span>Término de pago</span><strong>{{ detailQuote()!.paymentTermLabel || 'Sin definir' }}</strong></div>
                <div class="detail-item"><span>Días de pago</span><strong>{{ detailQuote()!.paymentTermDays ?? '—' }}</strong></div>
                <div class="detail-item"><span>Incoterm</span><strong>{{ detailQuote()!.incotermCode || 'No aplica' }}</strong></div>
                <div class="detail-item"><span>Ubicación</span><strong>{{ detailQuote()!.incotermLocation || '—' }}</strong></div>
                <div class="detail-item"><span>Entrega en días</span><strong>{{ detailQuote()!.deliveryLeadTimeDays ?? '—' }}</strong></div>
                <div class="detail-item"><span>Tasa de cambio</span><strong>{{ detailQuote()!.exchangeRate ?? 1 }}</strong></div>
              </div>
              @if (detailQuote()!.deliveryTerms) {
                <div class="detail-note">
                  <span>Condiciones de entrega</span>
                  <p>{{ detailQuote()!.deliveryTerms }}</p>
                </div>
              }
              @if (detailQuote()!.commercialConditions) {
                <div class="detail-note">
                  <span>Cláusulas avanzadas</span>
                  <p>{{ detailQuote()!.commercialConditions }}</p>
                </div>
              }
            </div>

            @if (quoteIntegrationSummary()) {
              <div class="detail-section detail-card">
                <div class="detail-section-title">Integraciones empresariales</div>
                <div class="detail-grid">
                  <div class="detail-item"><span>Conversión comercial</span><strong>{{ quoteIntegrationSummary()!.sales.hasInvoice ? 'Factura generada' : 'Pendiente de factura' }}</strong></div>
                  <div class="detail-item"><span>Flujo fiscal</span><strong>{{ quoteIntegrationSummary()!.fiscal.dianFlowLabel }}</strong></div>
                  <div class="detail-item"><span>Líneas con stock</span><strong>{{ quoteIntegrationSummary()!.inventory.availableLines }}/{{ quoteIntegrationSummary()!.inventory.checkedLines }}</strong></div>
                  <div class="detail-item"><span>Líneas sin stock</span><strong>{{ quoteIntegrationSummary()!.inventory.unavailableLines }}</strong></div>
                </div>
                @if (quoteIntegrationSummary()!.sales.invoiceNumber) {
                  <div class="detail-note">
                    <span>Factura relacionada</span>
                    <p>{{ quoteIntegrationSummary()!.sales.invoiceNumber }}</p>
                  </div>
                }
                @if (quoteIntegrationSummary()!.inventory.lines.length) {
                  <div class="integration-stock-list">
                    @for (line of quoteIntegrationSummary()!.inventory.lines; track line.lineIndex) {
                      <div class="integration-stock-row">
                        <div>
                          <strong>{{ line.description }}</strong>
                          <small>{{ line.sku || 'Sin SKU' }} · Solicitado {{ line.requestedQuantity }} {{ line.unit }}</small>
                        </div>
                        <span class="status-badge status-{{ line.enoughStock ? 'accepted' : 'rejected' }}">
                          {{ line.enoughStock ? ('Stock ' + line.currentStock) : ('Faltan ' + line.shortage) }}
                        </span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="followups-empty">No hay líneas con productos inventariables vinculados a esta cotización.</div>
                }
              </div>
            }

            <!-- Ítems -->
            @if (detailQuote()!.items && detailQuote()!.items!.length > 0) {
              <div class="detail-section detail-card">
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
            <div class="detail-section detail-card">
              <div class="detail-grid">
                <div class="detail-item"><span>Subtotal</span><strong>{{ formatCurrency(detailQuote()!.subtotal) }}</strong></div>
                <div class="detail-item"><span>IVA</span><strong>{{ formatCurrency(detailQuote()!.taxAmount) }}</strong></div>
                <div class="detail-item detail-item--total"><span>Total</span><strong class="total-value">{{ formatCurrency(detailQuote()!.total) }}</strong></div>
                <div class="detail-item"><span>Versión</span><strong>v{{ detailQuote()!.currentVersion || 0 }}</strong></div>
              </div>
            </div>

            @if (detailQuote()!.approvalRequired) {
              <div class="detail-section detail-card">
                <div class="detail-section-title">Aprobación comercial</div>
                <div class="detail-grid">
                  <div class="detail-item"><span>Estado</span><strong>{{ approvalLabel(detailQuote()!.approval?.status || 'PENDING') }}</strong></div>
                  <div class="detail-item"><span>Política actual</span><strong>{{ detailQuote()!.approval?.policyName || 'Política comercial general' }}</strong></div>
                  <div class="detail-item"><span>Rol requerido</span><strong>{{ detailQuote()!.approval?.requiredRole || 'MANAGER' }}</strong></div>
                  <div class="detail-item"><span>Motivo</span><strong>{{ detailQuote()!.approval?.reason || 'Supera política comercial' }}</strong></div>
                  @if (detailQuote()!.approval?.rejectedReason) {
                    <div class="detail-item"><span>Rechazo</span><strong>{{ detailQuote()!.approval?.rejectedReason }}</strong></div>
                  }
                </div>
                @if (detailQuote()!.approvalFlow?.length) {
                  <div class="approval-flow-list">
                    @for (step of detailQuote()!.approvalFlow!; track step.id) {
                      <div class="approval-flow-row">
                        <div>
                          <strong>Nivel {{ step.sequence }} · {{ step.policyName || 'Política general' }}</strong>
                          <small>{{ step.requiredRole || 'MANAGER' }} · {{ thresholdLabel(step) }}</small>
                        </div>
                        <span class="status-badge status-{{ approvalStatusClass(step.status) }}">{{ approvalLabel(step.status) }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <div class="detail-section detail-card">
              <div class="detail-section-title">Seguimiento comercial</div>
              @if (quoteFollowUps().length === 0) {
                <div class="followups-empty">Todavía no hay seguimientos registrados para esta cotización.</div>
              } @else {
                <div class="followups-list">
                  @for (followUp of quoteFollowUps(); track followUp.id) {
                    <div class="followup-row">
                      <div class="followup-badge">{{ followUpTypeLabel(followUp.activityType) }}</div>
                      <div class="followup-content">
                        <strong>{{ followUp.notes }}</strong>
                        <small>
                          {{ formatDateTime(followUp.createdAt) }}
                          @if (followUp.scheduledAt) {
                            · Programado para {{ formatDateTime(followUp.scheduledAt!) }}
                          }
                        </small>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="detail-section detail-card">
              <div class="detail-section-header">
                <div class="detail-section-title">Documentación</div>
                <button class="btn btn-secondary btn-xs" (click)="registerQuoteAttachment(detailQuote()!)">Registrar adjunto</button>
              </div>
              @if (quoteAttachments().length === 0) {
                <div class="followups-empty">Todavía no hay adjuntos documentales registrados para esta cotización.</div>
              } @else {
                <div class="document-list">
                  @for (attachment of quoteAttachments(); track attachment.id) {
                    <a class="document-row" [href]="attachment.fileUrl" target="_blank" rel="noopener noreferrer">
                      <div>
                        <strong>{{ attachment.fileName }}</strong>
                        <small>
                          {{ attachment.category || 'General' }}
                          · {{ formatDateTime(attachment.createdAt) }}
                          @if (attachment.uploadedByName) {
                            · {{ attachment.uploadedByName }}
                          }
                        </small>
                        @if (attachment.notes) {
                          <small>{{ attachment.notes }}</small>
                        }
                      </div>
                      <span class="document-link">Abrir</span>
                    </a>
                  }
                </div>
              }
            </div>

            <div class="detail-section detail-card">
              <div class="detail-section-header">
                <div class="detail-section-title">Comentarios internos</div>
                <button class="btn btn-secondary btn-xs" (click)="addQuoteComment(detailQuote()!)">Agregar comentario</button>
              </div>
              @if (quoteComments().length === 0) {
                <div class="followups-empty">Todavía no hay comentarios internos registrados.</div>
              } @else {
                <div class="comment-list">
                  @for (comment of quoteComments(); track comment.id) {
                    <div class="comment-row">
                      <strong>{{ comment.createdByName || 'Equipo comercial' }}</strong>
                      <small>{{ formatDateTime(comment.createdAt) }} · {{ commentTypeLabel(comment.commentType) }}</small>
                      <p>{{ comment.message }}</p>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="detail-section detail-card">
              <div class="detail-section-title">Bitácora de auditoría</div>
              @if (quoteAuditTrail().length === 0) {
                <div class="followups-empty">Todavía no hay eventos de auditoría visibles para esta cotización.</div>
              } @else {
                <div class="audit-list">
                  @for (entry of quoteAuditTrail(); track entry.id) {
                    <div class="audit-row">
                      <div>
                        <strong>{{ auditActionLabel(entry.action) }}</strong>
                        <small>
                          {{ formatDateTime(entry.createdAt) }}
                          @if (entry.userName) {
                            · {{ entry.userName }}
                          }
                        </small>
                      </div>
                    </div>
                  }
                </div>
              }
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
              <div class="detail-section detail-card">
                <div class="detail-section-title">Notas</div>
                <p class="detail-text">{{ detailQuote()!.notes }}</p>
              </div>
            }
            @if (detailQuote()!.terms) {
              <div class="detail-section detail-card">
                <div class="detail-section-title">Términos y condiciones</div>
                <p class="detail-text">{{ detailQuote()!.terms }}</p>
              </div>
            }

          </div>
          <div class="drawer-footer">
            <div class="drawer-footer__group drawer-footer__group--secondary">
              @if (detailQuote()!.status === 'DRAFT' || detailQuote()!.status === 'SENT') {
                <button class="btn btn-secondary" (click)="openFormModal(detailQuote()!)">Editar</button>
              }
              <button class="btn btn-secondary" (click)="duplicateQuote(detailQuote()!)">Duplicar</button>
              <button class="btn btn-secondary" (click)="renewQuote(detailQuote()!)">Renovar</button>
              <button class="btn btn-secondary" (click)="createQuoteFollowUp(detailQuote()!)">Registrar seguimiento</button>
              @if (detailQuote()!.approvalRequired && (!detailQuote()!.approval || detailQuote()!.approval?.status !== 'APPROVED')) {
                <button class="btn btn-secondary" (click)="requestApproval(detailQuote()!)">Solicitar aprobación</button>
              }
              @if (detailQuote()!.approval?.status === 'PENDING') {
                <button class="btn btn-secondary" (click)="approveQuote(detailQuote()!)">Aprobar</button>
                <button class="btn btn-secondary" (click)="rejectQuoteApproval(detailQuote()!)">Rechazar</button>
              }
              @if (detailQuote()!.status !== 'CONVERTED') {
                <button class="btn btn-secondary" (click)="openStatusModal(detailQuote()!)">Cambiar estado</button>
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
            </div>
            <div class="drawer-footer__group drawer-footer__group--primary">
              @if (detailQuote()!.status === 'ACCEPTED') {
                <button class="btn btn-primary" (click)="openConvertConfirm(detailQuote()!)">Convertir a factura</button>
              }
              @if (detailQuote()!.status === 'ACCEPTED' || detailQuote()!.status === 'CONVERTED') {
                <button class="btn btn-primary" [disabled]="sendingDian()[detailQuote()!.id]" (click)="sendToDian(detailQuote()!)">
                  @if (sendingDian()[detailQuote()!.id]) {
                    <span class="btn-spinner-sm"></span>
                    Enviando...
                  } @else {
                    <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                    </svg>
                    {{ detailQuote()!.invoiceId ? 'Enviar factura a DIAN' : 'Convertir y enviar a DIAN' }}
                  }
                </button>
              }
            </div>
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
            @if (newStatus === 'REJECTED') {
              <div class="form-group">
                <label>Motivo de pérdida *</label>
                <select [(ngModel)]="statusLostReason" class="form-control">
                  <option value="">Selecciona un motivo</option>
                  @for (reason of commercialMasters().lostReasons; track reason.id) {
                    <option [value]="reason.name">{{ reason.name }}</option>
                  }
                  <option value="__custom__">Escribir otro motivo</option>
                </select>
              </div>
              @if (statusLostReason === '__custom__') {
                <div class="form-group">
                  <label>Motivo personalizado *</label>
                  <textarea [(ngModel)]="customStatusLostReason" class="form-control form-textarea"
                            rows="3" placeholder="Indica por qué se perdió o rechazó la oportunidad"></textarea>
                </div>
              }
            }
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

    @if (showCommercialMastersModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Maestros comerciales</h3>
            <button class="drawer-close" (click)="closeCommercialMastersModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body commercial-masters">
            <aside class="masters-sidebar">
              @for (tab of masterTabs; track tab.id) {
                <button
                  class="master-tab-btn"
                  [class.active]="activeMasterTab() === tab.id"
                  (click)="setMasterTab(tab.id)">
                  <span>{{ tab.label }}</span>
                  <small>{{ masterTabCount(tab.id) }}</small>
                </button>
              }
            </aside>

            <div class="masters-content">
              <div class="masters-toolbar">
                <div>
                  <p class="filters-kicker">Configuración comercial</p>
                  <h3>{{ activeMasterLabel() }}</h3>
                </div>
                <button class="btn btn-primary" (click)="openMasterEditor()">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
                  </svg>
                  Nuevo {{ activeMasterSingular() }}
                </button>
              </div>

              @if (showMasterEditor()) {
                <div class="master-editor-card">
                  <div class="master-editor-head">
                    <strong>{{ editingMasterId() ? 'Editar' : 'Nuevo' }} {{ activeMasterSingular() }}</strong>
                    <button class="btn btn-secondary btn-sm" (click)="cancelMasterEditor()">Cancelar</button>
                  </div>

                  @if (activeMasterTab() === 'salesOwners' || activeMasterTab() === 'sourceChannels' || activeMasterTab() === 'lostReasons' || activeMasterTab() === 'stages') {
                    <div class="form-row form-row--triple">
                      <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" [(ngModel)]="masterForm.name" class="form-control"/>
                      </div>
                      @if (activeMasterTab() === 'salesOwners') {
                        <div class="form-group">
                          <label>Correo</label>
                          <input type="text" [(ngModel)]="masterForm.email" class="form-control"/>
                        </div>
                        <div class="form-group">
                          <label>Teléfono</label>
                          <input type="text" [(ngModel)]="masterForm.phone" class="form-control"/>
                        </div>
                      } @else if (activeMasterTab() === 'stages') {
                        <div class="form-group">
                          <label>Código</label>
                          <input type="text" [(ngModel)]="masterForm.code" class="form-control"/>
                        </div>
                        <div class="form-group">
                          <label>Color</label>
                          <input type="text" [(ngModel)]="masterForm.color" class="form-control" placeholder="#2563eb"/>
                        </div>
                      }
                    </div>

                    @if (activeMasterTab() === 'stages') {
                      <div class="form-row form-row--triple">
                        <div class="form-group">
                          <label>Posición</label>
                          <input type="number" [(ngModel)]="masterForm.position" class="form-control" min="0"/>
                        </div>
                        <label class="master-check">
                          <input type="checkbox" [(ngModel)]="masterForm.isDefault"/>
                          Etapa predeterminada
                        </label>
                        <label class="master-check">
                          <input type="checkbox" [(ngModel)]="masterForm.isClosed"/>
                          Marca cierre comercial
                        </label>
                      </div>
                    }

                    <div class="form-group">
                      <label>Descripción</label>
                      <textarea [(ngModel)]="masterForm.description" rows="2" class="form-control form-textarea"></textarea>
                    </div>
                  }

                  @if (activeMasterTab() === 'priceLists') {
                    <div class="form-row form-row--triple">
                      <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" [(ngModel)]="masterForm.name" class="form-control"/>
                      </div>
                      <div class="form-group">
                        <label>Moneda</label>
                        <input type="text" [(ngModel)]="masterForm.currency" class="form-control"/>
                      </div>
                      <label class="master-check">
                        <input type="checkbox" [(ngModel)]="masterForm.isDefault"/>
                        Lista predeterminada
                      </label>
                    </div>
                    <div class="form-group">
                      <label>Descripción</label>
                      <textarea [(ngModel)]="masterForm.description" rows="2" class="form-control form-textarea"></textarea>
                    </div>
                    <div class="form-section-title">
                      Ítems de la lista
                      <button type="button" class="btn btn-sm btn-secondary add-line-btn" (click)="addPriceListItem()">
                        Agregar ítem
                      </button>
                    </div>
                    @for (item of masterForm.priceListItems; let idx = $index; track idx) {
                      <div class="line-card compact-line-card">
                        <div class="line-fields">
                          <div class="form-group">
                            <label>Descripción *</label>
                            <input type="text" [(ngModel)]="item.description" class="form-control"/>
                          </div>
                          <div class="form-group">
                            <label>Precio</label>
                            <input type="number" [(ngModel)]="item.unitPrice" class="form-control" min="0" step="0.01"/>
                          </div>
                          <div class="form-group">
                            <label>IVA %</label>
                            <input type="number" [(ngModel)]="item.taxRate" class="form-control" min="0" max="100" step="0.01"/>
                          </div>
                          <div class="form-group">
                            <label>Producto</label>
                            <select [(ngModel)]="item.productId" class="form-control">
                              <option value="">Sin producto</option>
                              @for (product of allProducts(); track product.id) {
                                <option [value]="product.id">{{ product.name }}</option>
                              }
                            </select>
                          </div>
                          <button type="button" class="btn-icon btn-icon-danger" (click)="removePriceListItem(idx)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  }

                  @if (activeMasterTab() === 'templates') {
                    <div class="form-row form-row--triple">
                      <div class="form-group">
                        <label>Nombre *</label>
                        <input type="text" [(ngModel)]="masterForm.name" class="form-control"/>
                      </div>
                      <div class="form-group">
                        <label>Moneda</label>
                        <input type="text" [(ngModel)]="masterForm.currency" class="form-control"/>
                      </div>
                      <label class="master-check">
                        <input type="checkbox" [(ngModel)]="masterForm.isDefault"/>
                        Plantilla predeterminada
                      </label>
                    </div>
                    <div class="form-group">
                      <label>Descripción</label>
                      <textarea [(ngModel)]="masterForm.description" rows="2" class="form-control form-textarea"></textarea>
                    </div>
                    <div class="form-row">
                      <div class="form-group">
                        <label>Notas</label>
                        <textarea [(ngModel)]="masterForm.notes" rows="2" class="form-control form-textarea"></textarea>
                      </div>
                      <div class="form-group">
                        <label>Términos</label>
                        <textarea [(ngModel)]="masterForm.terms" rows="2" class="form-control form-textarea"></textarea>
                      </div>
                    </div>
                    <div class="form-section-title">
                      Líneas de plantilla
                      <button type="button" class="btn btn-sm btn-secondary add-line-btn" (click)="addTemplateItem()">
                        Agregar línea
                      </button>
                    </div>
                    @for (item of masterForm.templateItems; let idx = $index; track idx) {
                      <div class="line-card compact-line-card">
                        <div class="line-fields line-fields--template">
                          <div class="form-group">
                            <label>Descripción *</label>
                            <input type="text" [(ngModel)]="item.description" class="form-control"/>
                          </div>
                          <div class="form-group">
                            <label>Cant.</label>
                            <input type="number" [(ngModel)]="item.quantity" class="form-control" min="0.0001" step="0.01"/>
                          </div>
                          <div class="form-group">
                            <label>Precio</label>
                            <input type="number" [(ngModel)]="item.unitPrice" class="form-control" min="0" step="0.01"/>
                          </div>
                          <div class="form-group">
                            <label>IVA %</label>
                            <input type="number" [(ngModel)]="item.taxRate" class="form-control" min="0" max="100" step="0.01"/>
                          </div>
                          <div class="form-group">
                            <label>Desc. %</label>
                            <input type="number" [(ngModel)]="item.discount" class="form-control" min="0" max="100" step="0.01"/>
                          </div>
                          <button type="button" class="btn-icon btn-icon-danger" (click)="removeTemplateItem(idx)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  }

                  <div class="modal-footer master-editor-footer">
                    <button class="btn btn-secondary" (click)="cancelMasterEditor()">Cancelar</button>
                    <button class="btn btn-primary" [disabled]="savingMaster()" (click)="saveMaster()">
                      {{ savingMaster() ? 'Guardando...' : (editingMasterId() ? 'Actualizar' : 'Crear') }}
                    </button>
                  </div>
                </div>
              }

              <div class="master-list-card">
                @if (currentMasterRows().length === 0) {
                  <div class="empty-state">
                    <p>No hay registros configurados para {{ activeMasterLabel().toLowerCase() }}.</p>
                  </div>
                } @else {
                  <div class="master-list">
                    @for (row of currentMasterRows(); track row.id) {
                      <div class="master-row">
                        <div class="master-row__main">
                          <strong>{{ row.name }}</strong>
                          <small>{{ masterRowSummary(row) }}</small>
                        </div>
                        <div class="master-row__actions">
                          <button class="btn btn-secondary btn-sm" (click)="openMasterEditor(row)">Editar</button>
                          <button class="btn btn-secondary btn-sm" (click)="removeMaster(row)">Desactivar</button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }

    @if (showApprovalPoliciesModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Políticas de aprobación</h3>
            <button class="drawer-close" (click)="closeApprovalPoliciesModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="masters-toolbar">
              <div>
                <p class="filters-kicker">Workflow empresarial</p>
                <h3>Secuencias y umbrales</h3>
              </div>
              <button class="btn btn-primary" (click)="openApprovalPolicyEditor()">
                Nueva política
              </button>
            </div>

            @if (showApprovalPolicyEditor()) {
              <div class="master-editor-card" style="margin-top:14px;">
                <div class="master-editor-head">
                  <strong>{{ editingApprovalPolicyId() ? 'Editar' : 'Nueva' }} política</strong>
                  <button class="btn btn-secondary btn-sm" (click)="cancelApprovalPolicyEditor()">Cancelar</button>
                </div>
                <div class="form-row form-row--triple">
                  <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" [(ngModel)]="approvalPolicyForm.name" class="form-control"/>
                  </div>
                  <div class="form-group">
                    <label>Tipo</label>
                    <select [(ngModel)]="approvalPolicyForm.approvalType" class="form-control">
                      <option value="TOTAL">Monto total</option>
                      <option value="DISCOUNT">Descuento por línea</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Umbral</label>
                    <input type="number" [(ngModel)]="approvalPolicyForm.thresholdValue" class="form-control" min="0" step="0.01"/>
                  </div>
                </div>
                <div class="form-row form-row--triple">
                  <div class="form-group">
                    <label>Rol aprobador</label>
                    <select [(ngModel)]="approvalPolicyForm.requiredRole" class="form-control">
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="CONTADOR">CONTADOR</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Secuencia</label>
                    <input type="number" [(ngModel)]="approvalPolicyForm.sequence" class="form-control" min="1"/>
                  </div>
                </div>
                <div class="form-group">
                  <label>Descripción</label>
                  <textarea [(ngModel)]="approvalPolicyForm.description" rows="2" class="form-control form-textarea"></textarea>
                </div>
                <div class="modal-footer master-editor-footer">
                  <button class="btn btn-secondary" (click)="cancelApprovalPolicyEditor()">Cancelar</button>
                  <button class="btn btn-primary" [disabled]="savingApprovalPolicy()" (click)="saveApprovalPolicy()">
                    {{ savingApprovalPolicy() ? 'Guardando...' : (editingApprovalPolicyId() ? 'Actualizar' : 'Crear') }}
                  </button>
                </div>
              </div>
            }

            <div class="master-list-card" style="margin-top:14px;">
              @if (approvalPolicies().length === 0) {
                <div class="empty-state">
                  <p>No hay políticas empresariales configuradas.</p>
                </div>
              } @else {
                <div class="master-list">
                  @for (policy of approvalPolicies(); track policy.id) {
                    <div class="master-row">
                      <div class="master-row__main">
                        <strong>{{ policy.name }}</strong>
                        <small>{{ approvalPolicySummary(policy) }}</small>
                      </div>
                      <div class="master-row__actions">
                        <button class="btn btn-secondary btn-sm" (click)="openApprovalPolicyEditor(policy)">Editar</button>
                        <button class="btn btn-secondary btn-sm" (click)="removeApprovalPolicy(policy)">Desactivar</button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <app-confirm-dialog />
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
    .header-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
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
    .analytics-strip {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:14px;
      margin-bottom:18px;
    }
    .analytics-card {
      padding:16px 18px;
      border-radius:20px;
      background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 16px 28px rgba(12,28,53,.05);
    }
    .analytics-card__label {
      display:block;
      margin-bottom:8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#1a407e;
    }
    .analytics-card strong {
      display:block;
      font-family:'Sora',sans-serif;
      font-size:24px;
      line-height:1.08;
      letter-spacing:-.05em;
      color:#0c1c35;
    }
    .analytics-card small {
      display:block;
      margin-top:8px;
      font-size:12px;
      line-height:1.5;
      color:#6b7f95;
    }

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
    .drawer {
      width:540px;
      max-width:100%;
      background:#fff;
      height:100%;
      display:flex;
      flex-direction:column;
      box-shadow:-10px 0 36px rgba(0,0,0,.18);
    }
    .drawer-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding:24px 24px 20px;
      border-bottom:1px solid rgba(226,234,243,.8);
      background:
        radial-gradient(circle at top left, rgba(127,183,255,.18), transparent 28%),
        radial-gradient(circle at bottom right, rgba(45,212,191,.12), transparent 28%),
        linear-gradient(135deg,#0d2344 0%, #16386a 56%, #0f7a72 100%);
      color:#fff;
    }
    .drawer-header__content { display:flex; align-items:flex-start; gap:14px; min-width:0; }
    .drawer-headline { min-width:0; }
    .drawer-avatar {
      width:50px;
      height:50px;
      border-radius:16px;
      background:rgba(255,255,255,.14);
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      border:1px solid rgba(255,255,255,.16);
      backdrop-filter:blur(10px);
    }
    .drawer-kicker {
      display:block;
      margin-bottom:6px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#bfdbfe;
    }
    .drawer-title {
      font-family:'Sora',sans-serif;
      font-weight:800;
      font-size:24px;
      line-height:1.05;
      color:#fff;
      letter-spacing:-.05em;
      word-break:break-word;
    }
    .drawer-meta {
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:8px;
      margin-top:10px;
    }
    .drawer-meta__text {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.14);
      font-size:11px;
      font-weight:700;
      color:rgba(236,244,255,.92);
      white-space:nowrap;
    }
    .drawer-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .drawer-close:hover { background:rgba(255,255,255,.12); color:#fff; }
    .drawer-body {
      flex:1;
      overflow-y:auto;
      padding:20px;
      background:
        linear-gradient(180deg,#f7fbff 0%, #fdfefe 100%);
    }
    .quote-spotlight {
      display:grid;
      grid-template-columns:1.2fr .9fr .9fr;
      gap:12px;
      margin-bottom:18px;
    }
    .quote-spotlight__main,
    .quote-spotlight__metric {
      padding:16px;
      border-radius:18px;
      border:1px solid #dfeaf4;
      background:#ffffff;
      box-shadow:0 14px 24px rgba(12,28,53,.05);
    }
    .quote-spotlight__main {
      background:linear-gradient(135deg,#eff6ff 0%, #f8fbff 100%);
    }
    .quote-spotlight__label {
      display:block;
      margin-bottom:8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#1a407e;
    }
    .quote-spotlight__main strong,
    .quote-spotlight__metric strong {
      display:block;
      font-family:'Sora',sans-serif;
      font-size:18px;
      line-height:1.15;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .quote-spotlight__main small,
    .quote-spotlight__metric small {
      display:block;
      margin-top:6px;
      font-size:12px;
      line-height:1.5;
      color:#6b7f95;
    }
    .drawer-footer {
      padding:18px 20px 20px;
      border-top:1px solid #e6edf5;
      display:grid;
      gap:14px;
      align-items:start;
      background:
        linear-gradient(180deg, rgba(248,251,255,.92) 0%, #ffffff 100%);
      box-shadow:0 -12px 28px rgba(12,28,53,.06);
    }
    .drawer-footer__group {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      padding:12px;
      border-radius:16px;
      border:1px solid #e4ecf5;
      background:#f8fbff;
    }
    .drawer-footer__group--secondary { justify-content:flex-start; }
    .drawer-footer__group--primary {
      justify-content:flex-end;
      background:linear-gradient(135deg, #eef5ff 0%, #f0fdf9 100%);
      border-color:#d8e5f2;
    }
    .drawer-footer .btn {
      min-height:40px;
      border-radius:12px;
      padding:10px 14px;
      font-size:13px;
      font-weight:700;
      letter-spacing:-.01em;
      box-shadow:none;
    }
    .drawer-footer .btn svg { flex-shrink:0; }
    .drawer-footer .btn-secondary {
      background:#ffffff;
      color:#35506f;
      border:1px solid #d6e2ee;
    }
    .drawer-footer .btn-secondary:hover {
      background:#eff6ff;
      border-color:#9fbfe3;
      color:#163a63;
      transform:translateY(-1px);
    }
    .drawer-footer .btn-primary {
      background:linear-gradient(135deg,#163c72 0%, #0f8a7f 100%);
      color:#fff;
      border:1px solid transparent;
      box-shadow:0 10px 18px rgba(22,60,114,.18);
    }
    .drawer-footer .btn-primary:hover:not(:disabled) {
      background:linear-gradient(135deg,#12335f 0%, #0c766d 100%);
      transform:translateY(-1px);
      box-shadow:0 14px 24px rgba(22,60,114,.2);
    }
    .drawer-footer .btn:disabled {
      opacity:.65;
      transform:none;
      box-shadow:none;
    }

    .detail-section { margin-bottom:16px; }
    .detail-card {
      padding:16px;
      border-radius:18px;
      border:1px solid #e1eaf3;
      background:#fff;
      box-shadow:0 12px 24px rgba(12,28,53,.04);
    }
    .detail-section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#7b8fa8; margin-bottom:12px; }
    .detail-section-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .detail-section-header .detail-section-title { margin-bottom:0; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .detail-item {
      padding:12px 14px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #e6eef7;
    }
    .detail-item span { display:block; font-size:10px; color:#7b8fa8; font-weight:800; text-transform:uppercase; letter-spacing:.08em; margin-bottom:5px; }
    .detail-item strong { font-size:14px; color:#0c1c35; line-height:1.45; }
    .detail-item--total span { color:#1a407e; }
    .total-value { font-family:'Sora',sans-serif; font-size:18px; color:#0c1c35; }
    .detail-text { font-size:13.5px; color:#374151; line-height:1.6; margin:0; white-space:pre-wrap; }
    .detail-note {
      margin-top:12px;
      padding:12px 14px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #e6eef7;
    }
    .detail-note span {
      display:block;
      margin-bottom:6px;
      font-size:10px;
      color:#7b8fa8;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
    }
    .detail-note p { margin:0; color:#374151; font-size:13px; line-height:1.6; white-space:pre-wrap; }
    .followups-empty {
      padding:14px;
      border-radius:12px;
      border:1px dashed #c7d7ea;
      background:#f8fbff;
      color:#6b7f95;
      font-size:13px;
    }
    .followups-list { display:flex; flex-direction:column; gap:10px; }
    .followup-row {
      display:flex;
      align-items:flex-start;
      gap:10px;
      padding:12px;
      border-radius:12px;
      background:#f8fbff;
      border:1px solid #e3ebf5;
    }
    .followup-badge {
      padding:5px 9px;
      border-radius:999px;
      background:#dbeafe;
      color:#1d4ed8;
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
    }
    .followup-content { display:grid; gap:4px; }
    .followup-content strong { font-size:13.5px; color:#0c1c35; }
    .followup-content small { font-size:12px; color:#6b7f95; line-height:1.45; }
    .document-list, .comment-list, .audit-list { display:flex; flex-direction:column; gap:10px; }
    .document-row, .comment-row, .audit-row {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      padding:12px 14px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #e3ebf5;
    }
    .document-row { text-decoration:none; }
    .document-row:hover { border-color:#9fbfe3; background:#eff6ff; }
    .document-row > div, .comment-row, .audit-row > div { display:grid; gap:4px; min-width:0; }
    .document-row strong, .comment-row strong, .audit-row strong { font-size:13.5px; color:#0c1c35; }
    .document-row small, .comment-row small, .audit-row small { font-size:12px; color:#6b7f95; line-height:1.45; }
    .comment-row p { margin:0; color:#374151; font-size:13px; line-height:1.6; white-space:pre-wrap; }
    .document-link { flex-shrink:0; align-self:center; font-size:12px; font-weight:800; color:#1d4ed8; }
    .btn-xs { min-height:34px; padding:8px 12px; border-radius:12px; font-size:12px; }
    .integration-stock-list { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
    .integration-stock-row {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #e5edf6;
    }
    .integration-stock-row > div { display:grid; gap:4px; min-width:0; }
    .integration-stock-row strong { display:block; color:#0c1c35; font-size:13px; }
    .integration-stock-row small { color:#6b7f95; font-size:12px; }
    .approval-flow-list { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
    .approval-flow-row {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #e5edf6;
    }
    .approval-flow-row strong { display:block; color:#0c1c35; font-size:13px; }
    .approval-flow-row small { color:#6b7f95; font-size:12px; }

    .items-list { display:flex; flex-direction:column; gap:10px; }
    .item-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:14px; background:#f8fbff; border-radius:14px; border:1px solid #e5edf6; }
    .item-desc { flex:1; }
    .item-desc strong { display:block; font-size:13.5px; color:#0c1c35; margin-bottom:4px; }
    .item-desc span { display:inline-block; font-size:12px; color:#9ca3af; margin-right:8px; }
    .item-discount { color:#d97706; background:#fef3c7; padding:1px 5px; border-radius:4px; font-weight:600; }
    .item-tax { color:#2563eb; background:#dbeafe; padding:1px 5px; border-radius:4px; font-weight:600; }
    .item-total { font-weight:700; font-size:14px; color:#0c1c35; white-space:nowrap; }

    .invoice-link-card { display:flex; align-items:center; gap:12px; padding:14px 16px; background:linear-gradient(135deg,#eff6ff 0%, #f7fbff 100%); border:1px solid #bfdbfe; border-radius:16px; margin-bottom:16px; box-shadow:0 10px 20px rgba(29,78,216,.08); }
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
    .form-row--triple { grid-template-columns:repeat(3,minmax(0,1fr)); }
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
    .line-fields--template { grid-template-columns:1.8fr .7fr .8fr .7fr .7fr auto; }
    .line-total-group { display:flex; flex-direction:column; }
    .line-total { padding:9px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; font-size:14px; font-weight:700; color:#1d4ed8; white-space:nowrap; }
    .compact-line-card { padding:12px; }
    .master-check {
      display:flex;
      align-items:center;
      gap:8px;
      min-height:42px;
      padding:0 12px;
      border:1px solid #dce6f0;
      border-radius:10px;
      background:#f8fbff;
      color:#35506f;
      font-size:13px;
      font-weight:600;
    }
    .commercial-masters {
      display:grid;
      grid-template-columns:220px minmax(0,1fr);
      gap:18px;
    }
    .masters-sidebar {
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:10px;
      border:1px solid #e2e8f0;
      border-radius:18px;
      background:#f8fbff;
      align-self:start;
    }
    .master-tab-btn {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:8px;
      width:100%;
      padding:11px 12px;
      border-radius:12px;
      border:1px solid transparent;
      background:transparent;
      cursor:pointer;
      color:#35506f;
      text-align:left;
      font-weight:700;
    }
    .master-tab-btn small { color:#6b7f95; font-size:11px; }
    .master-tab-btn.active {
      background:#eaf3ff;
      border-color:#bfd6f5;
      color:#163a63;
      box-shadow:0 8px 18px rgba(12,28,53,.05);
    }
    .masters-content { display:grid; gap:14px; min-width:0; }
    .masters-toolbar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:16px 18px;
      border-radius:18px;
      border:1px solid #dce6f0;
      background:linear-gradient(135deg,#f8fbff 0%,#ffffff 100%);
    }
    .masters-toolbar h3 { margin:0; font-family:'Sora',sans-serif; font-size:20px; letter-spacing:-.04em; color:#0c1c35; }
    .master-editor-card,
    .master-list-card {
      padding:18px;
      border-radius:18px;
      border:1px solid #dce6f0;
      background:#fff;
      box-shadow:0 14px 26px rgba(12,28,53,.05);
    }
    .master-editor-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .master-list { display:flex; flex-direction:column; gap:10px; }
    .master-row {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:14px 16px;
      border:1px solid #e6eef7;
      border-radius:14px;
      background:#f8fbff;
    }
    .master-row__main { display:grid; gap:4px; min-width:0; }
    .master-row__main strong { color:#0c1c35; font-size:14px; }
    .master-row__main small { color:#6b7f95; font-size:12px; line-height:1.45; }
    .master-row__actions { display:flex; gap:8px; flex-wrap:wrap; }
    .master-editor-footer { padding:0; border:none; margin-top:12px; }

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
      .header-actions { width:100%; flex-direction:column; }
      .page-header .btn { width:100%; justify-content:center; }
      .hero-mini-grid,
      .kpi-strip,
      .analytics-strip { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .filters-head { flex-direction:column; align-items:flex-start; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .drawer { width:100%; max-width:100%; }
      .quote-spotlight { grid-template-columns:1fr; }
      .line-fields { grid-template-columns:1fr 1fr; }
    }
    @media (max-width:640px) {
      .hero-shell { padding:16px; gap:14px; }
      .hero-mini-grid,
      .kpi-strip,
      .analytics-strip { grid-template-columns:1fr; }
      .filters-shell { padding:14px; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:620px; }
      .drawer-overlay { align-items:flex-end; justify-content:stretch; }
      .drawer { width:100%; height:92dvh; border-radius:22px 22px 0 0; }
      .drawer-header { padding:20px 18px 18px; }
      .drawer-title { font-size:21px; }
      .quote-spotlight { grid-template-columns:1fr; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .drawer-footer__group { flex-direction:column; }
      .drawer-footer__group .btn { width:100%; justify-content:center; }
      .form-row { grid-template-columns:1fr; }
      .form-row--triple { grid-template-columns:1fr; }
      .line-fields { grid-template-columns:1fr 1fr; }
      .line-fields--template { grid-template-columns:1fr 1fr; }
      .commercial-masters { grid-template-columns:1fr; }
      .masters-sidebar { flex-direction:row; overflow:auto; }
      .master-tab-btn { min-width:180px; }
      .master-row { flex-direction:column; align-items:flex-start; }
      .master-row__actions { width:100%; }
      .master-row__actions .btn { flex:1; justify-content:center; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
    }
  `]
})
export class QuotesComponent implements OnInit {
  private readonly API          = `${environment.apiUrl}/quotes`;
  private readonly CUSTOMERS_API = `${environment.apiUrl}/customers`;
  private readonly PRODUCTS_API  = `${environment.apiUrl}/products`;
  readonly masterTabs: Array<{ id: MasterTab; label: string }> = [
    { id: 'salesOwners', label: 'Responsables' },
    { id: 'sourceChannels', label: 'Canales' },
    { id: 'lostReasons', label: 'Motivos de pérdida' },
    { id: 'stages', label: 'Etapas' },
    { id: 'priceLists', label: 'Listas de precios' },
    { id: 'templates', label: 'Plantillas' },
  ];

  // ── Lista principal ────────────────────────────────────────────────────────
  quotes      = signal<Quote[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  total       = signal(0);
  page        = signal(1);
  totalPages  = signal(1);
  analyticsSummary = signal<QuoteAnalyticsSummary | null>(null);
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

  quoteForm: {
    issueDate: string;
    expiresAt: string;
    notes: string;
    terms: string;
    paymentTermLabel: string;
    paymentTermDays: number | null;
    deliveryLeadTimeDays: number | null;
    deliveryTerms: string;
    incotermCode: string;
    incotermLocation: string;
    exchangeRate: number;
    commercialConditions: string;
    salesOwnerId: string;
    salesOwnerName: string;
    opportunityName: string;
    sourceChannelId: string;
    sourceChannel: string;
    priceListId: string;
    templateId: string;
  } = this.emptyHeader();

  commercialMasters = signal<QuoteCommercialMasters>({
    salesOwners: [],
    sourceChannels: [],
    lostReasons: [],
    stages: [],
    priceLists: [],
    templates: [],
  });
  loadingMasters = signal(false);
  showCommercialMastersModal = signal(false);
  activeMasterTab = signal<MasterTab>('salesOwners');
  showMasterEditor = signal(false);
  editingMasterId = signal<string | null>(null);
  savingMaster = signal(false);
  masterForm = this.emptyMasterForm();
  approvalPolicies = signal<QuoteApprovalPolicy[]>([]);
  showApprovalPoliciesModal = signal(false);
  showApprovalPolicyEditor = signal(false);
  editingApprovalPolicyId = signal<string | null>(null);
  savingApprovalPolicy = signal(false);
  approvalPolicyForm = this.emptyApprovalPolicyForm();

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
  statusLostReason = '';
  customStatusLostReason = '';

  // ── Modal: Confirmar conversión ────────────────────────────────────────────
  convertTarget = signal<Quote | null>(null);

  // ── Modal: Vista previa PDF ────────────────────────────────────────────────
  showPdfModal    = signal(false);
  loadingPdf      = signal(false);
  pdfUrl          = signal<SafeResourceUrl | null>(null);
  downloadingPdf  = signal(false);
  sendingDian     = signal<{ [id: string]: boolean }>({});
  quoteFollowUps  = signal<QuoteFollowUp[]>([]);
  quoteAttachments = signal<QuoteAttachment[]>([]);
  quoteComments = signal<QuoteComment[]>([]);
  quoteAuditTrail = signal<QuoteAuditEntry[]>([]);
  quoteIntegrationSummary = signal<QuoteIntegrationSummary | null>(null);
  private objectUrl: string | null = null;

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
    private sanitizer: DomSanitizer,
    private dialog: ConfirmDialogService,
  ) {}

  ngOnInit() {
    this.load();
    this.loadCommercialMasters();
    this.loadApprovalPolicies();

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
    this.loadAnalytics();
  }

  loadAnalytics() {
    const params: Record<string, string> = {};
    if (this.filterDateFrom) params['dateFrom'] = this.filterDateFrom;
    if (this.filterDateTo) params['dateTo'] = this.filterDateTo;
    this.http.get<QuoteAnalyticsSummary>(`${this.API}/analytics/summary`, { params }).subscribe({
      next: (summary) => this.analyticsSummary.set(summary),
      error: () => this.analyticsSummary.set(null),
    });
  }

  loadCommercialMasters() {
    this.loadingMasters.set(true);
    this.http.get<QuoteCommercialMasters>(`${this.API}/masters`).subscribe({
      next: (masters) => {
        this.commercialMasters.set({
          salesOwners: masters?.salesOwners ?? [],
          sourceChannels: masters?.sourceChannels ?? [],
          lostReasons: masters?.lostReasons ?? [],
          stages: masters?.stages ?? [],
          priceLists: masters?.priceLists ?? [],
          templates: masters?.templates ?? [],
        });
        this.loadingMasters.set(false);
      },
      error: () => {
        this.loadingMasters.set(false);
      },
    });
  }

  loadApprovalPolicies() {
    this.http.get<QuoteApprovalPolicy[]>(`${this.API}/approval-policies`).subscribe({
      next: (rows) => this.approvalPolicies.set(rows ?? []),
      error: () => this.approvalPolicies.set([]),
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  onFilterChange() { this.page.set(1); this.load(); }

  onSalesOwnerChange(id: string) {
    const owner = this.commercialMasters().salesOwners.find((row) => row.id === id);
    this.quoteForm.salesOwnerName = owner?.name ?? '';
  }

  onSourceChannelChange(id: string) {
    const channel = this.commercialMasters().sourceChannels.find((row) => row.id === id);
    this.quoteForm.sourceChannel = channel?.name ?? '';
  }

  onPriceListChange(id: string) {
    this.quoteForm.priceListId = id;
    if (!id) return;
    const priceList = this.commercialMasters().priceLists.find((row) => row.id === id);
    if (!priceList) return;
    const nextLines = this.lines().map((line) => {
      const matched = priceList.items.find((item) =>
        (item.productId && item.productId === line.productId) ||
        item.description.trim().toLowerCase() === line.description.trim().toLowerCase(),
      );
      if (!matched) return line;
      return {
        ...line,
        unitPrice: matched.unitPrice,
        taxRate: matched.taxRate ?? line.taxRate,
      };
    });
    this.lines.set(nextLines);
    this.recalc();
  }

  onTemplateChange(id: string) {
    this.quoteForm.templateId = id;
    if (!id) return;
    const template = this.commercialMasters().templates.find((row) => row.id === id);
    if (!template) return;
    this.quoteForm.notes = template.notes ?? this.quoteForm.notes;
    this.quoteForm.terms = template.terms ?? this.quoteForm.terms;
    this.lines.set(template.items.map((item) => ({
      productId: item.productId ?? '',
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount,
    })));
    this.lineProductSearch = template.items.map(() => '');
    if (template.currency) {
      this.quoteForm.priceListId = this.quoteForm.priceListId || '';
    }
    this.recalc();
  }

  selectedCommercialCurrency() {
    const templateCurrency = this.commercialMasters().templates.find((row) => row.id === this.quoteForm.templateId)?.currency;
    const priceListCurrency = this.commercialMasters().priceLists.find((row) => row.id === this.quoteForm.priceListId)?.currency;
    return templateCurrency || priceListCurrency || 'COP';
  }

  openCommercialMastersModal(tab: MasterTab = 'salesOwners') {
    this.setMasterTab(tab);
    this.showCommercialMastersModal.set(true);
    this.loadCommercialMasters();
    this.loadProducts('');
  }

  closeCommercialMastersModal() {
    this.showCommercialMastersModal.set(false);
    this.cancelMasterEditor();
  }

  openApprovalPoliciesModal() {
    this.showApprovalPoliciesModal.set(true);
    this.loadApprovalPolicies();
  }

  closeApprovalPoliciesModal() {
    this.showApprovalPoliciesModal.set(false);
    this.cancelApprovalPolicyEditor();
  }

  openApprovalPolicyEditor(policy?: QuoteApprovalPolicy) {
    this.editingApprovalPolicyId.set(policy?.id ?? null);
    this.approvalPolicyForm = policy
      ? {
          name: policy.name,
          approvalType: policy.approvalType,
          thresholdValue: Number(policy.thresholdValue ?? 0),
          requiredRole: policy.requiredRole || 'MANAGER',
          sequence: Number(policy.sequence ?? 1),
          description: policy.description ?? '',
        }
      : this.emptyApprovalPolicyForm();
    this.showApprovalPolicyEditor.set(true);
  }

  cancelApprovalPolicyEditor() {
    this.showApprovalPolicyEditor.set(false);
    this.editingApprovalPolicyId.set(null);
    this.approvalPolicyForm = this.emptyApprovalPolicyForm();
  }

  saveApprovalPolicy() {
    const id = this.editingApprovalPolicyId();
    const body = {
      name: this.approvalPolicyForm.name,
      approvalType: this.approvalPolicyForm.approvalType,
      thresholdValue: Number(this.approvalPolicyForm.thresholdValue || 0),
      requiredRole: this.approvalPolicyForm.requiredRole || 'MANAGER',
      sequence: Number(this.approvalPolicyForm.sequence || 1),
      description: this.approvalPolicyForm.description || undefined,
    };
    this.savingApprovalPolicy.set(true);
    const request$ = id
      ? this.http.put(`${this.API}/approval-policies/${id}`, body)
      : this.http.post(`${this.API}/approval-policies`, body);
    request$.subscribe({
      next: () => {
        this.notify.success(`Política ${id ? 'actualizada' : 'creada'} correctamente`);
        this.savingApprovalPolicy.set(false);
        this.cancelApprovalPolicyEditor();
        this.loadApprovalPolicies();
      },
      error: (e) => {
        this.savingApprovalPolicy.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible guardar la política');
      },
    });
  }

  removeApprovalPolicy(policy: QuoteApprovalPolicy) {
    this.dialog.confirm({
      title: 'Desactivar política',
      message: `Se desactivará la política "${policy.name}".`,
      confirmLabel: 'Desactivar',
      danger: true,
      icon: 'warning',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.http.delete(`${this.API}/approval-policies/${policy.id}`).subscribe({
        next: () => {
          this.notify.success('Política desactivada');
          this.loadApprovalPolicies();
        },
        error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible desactivar la política'),
      });
    });
  }

  approvalPolicySummary(policy: QuoteApprovalPolicy) {
    const metric = policy.approvalType === 'TOTAL'
      ? `Monto >= ${this.formatCurrency(policy.thresholdValue)}`
      : `Descuento >= ${policy.thresholdValue}%`;
    return `${metric} · ${policy.requiredRole} · nivel ${policy.sequence}`;
  }

  thresholdLabel(step: QuoteApprovalStep) {
    if (step.thresholdType === 'DISCOUNT') return `Descuento >= ${Number(step.thresholdValue ?? 0)}%`;
    if (step.thresholdType === 'TOTAL') return `Monto >= ${this.formatCurrency(Number(step.thresholdValue ?? 0))}`;
    return 'Política general';
  }

  approvalStatusClass(status: string) {
    const map: Record<string, string> = {
      PENDING: 'draft',
      APPROVED: 'accepted',
      REJECTED: 'rejected',
      SUPERSEDED: 'expired',
    };
    return map[status] ?? 'draft';
  }

  setMasterTab(tab: MasterTab) {
    this.activeMasterTab.set(tab);
    this.cancelMasterEditor();
  }

  activeMasterLabel() {
    return this.masterTabs.find((tab) => tab.id === this.activeMasterTab())?.label ?? 'Maestros';
  }

  activeMasterSingular() {
    const labels: Record<MasterTab, string> = {
      salesOwners: 'responsable',
      sourceChannels: 'canal',
      lostReasons: 'motivo',
      stages: 'etapa',
      priceLists: 'lista',
      templates: 'plantilla',
    };
    return labels[this.activeMasterTab()];
  }

  masterTabCount(tab: MasterTab) {
    return this.currentMasterRows(tab).length;
  }

  currentMasterRows(tab = this.activeMasterTab()) {
    const masters = this.commercialMasters();
    if (tab === 'salesOwners') return masters.salesOwners;
    if (tab === 'sourceChannels') return masters.sourceChannels;
    if (tab === 'lostReasons') return masters.lostReasons;
    if (tab === 'stages') return masters.stages;
    if (tab === 'priceLists') return masters.priceLists;
    return masters.templates;
  }

  masterRowSummary(row: any) {
    if ('items' in row) {
      const extra = row.currency ? ` · ${row.currency}` : '';
      return `${row.items?.length ?? 0} ítems${extra}`;
    }
    if (row.email || row.phone) {
      return [row.email, row.phone].filter(Boolean).join(' · ') || row.description || 'Sin detalle';
    }
    if (row.code || row.position !== undefined) {
      const pieces = [row.code, row.position !== undefined ? `Posición ${row.position}` : '', row.isClosed ? 'Cierre' : ''];
      return pieces.filter(Boolean).join(' · ') || row.description || 'Etapa comercial';
    }
    return row.description || 'Configuración comercial';
  }

  openMasterEditor(row?: any) {
    const tab = this.activeMasterTab();
    this.editingMasterId.set(row?.id ?? null);
    if (!row) {
      this.masterForm = this.emptyMasterForm();
      if (tab === 'priceLists') this.addPriceListItem();
      if (tab === 'templates') this.addTemplateItem();
      this.showMasterEditor.set(true);
      return;
    }
    this.masterForm = {
      name: row.name ?? '',
      description: row.description ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      code: row.code ?? '',
      color: row.color ?? '#2563eb',
      position: row.position ?? 0,
      isDefault: Boolean(row.isDefault),
      isClosed: Boolean(row.isClosed),
      currency: row.currency ?? 'COP',
      notes: row.notes ?? '',
      terms: row.terms ?? '',
      priceListItems: 'items' in row ? (row.items ?? []).map((item: any) => ({
        productId: item.productId ?? '',
        description: item.description ?? '',
        unitPrice: Number(item.unitPrice ?? 0),
        taxRate: Number(item.taxRate ?? 19),
      })) : [],
      templateItems: 'items' in row ? (row.items ?? []).map((item: any) => ({
        productId: item.productId ?? '',
        description: item.description ?? '',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unitPrice ?? 0),
        taxRate: Number(item.taxRate ?? 19),
        discount: Number(item.discount ?? 0),
      })) : [],
    };
    this.showMasterEditor.set(true);
  }

  cancelMasterEditor() {
    this.showMasterEditor.set(false);
    this.editingMasterId.set(null);
    this.masterForm = this.emptyMasterForm();
  }

  saveMaster() {
    const tab = this.activeMasterTab();
    const id = this.editingMasterId();
    const isEdit = Boolean(id);
    const routeMap: Record<Exclude<MasterTab, 'priceLists' | 'templates'>, string> = {
      salesOwners: 'sales-owners',
      sourceChannels: 'source-channels',
      lostReasons: 'lost-reasons',
      stages: 'stages',
    };
    let request$;
    if (tab === 'priceLists') {
      const body = {
        name: this.masterForm.name,
        description: this.masterForm.description || undefined,
        currency: this.masterForm.currency || 'COP',
        isDefault: this.masterForm.isDefault,
        items: this.masterForm.priceListItems
          .filter((item) => item.description.trim())
          .map((item, index) => ({
            productId: item.productId || undefined,
            description: item.description,
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            position: index + 1,
          })),
      };
      request$ = isEdit
        ? this.http.put(`${this.API}/masters/price-lists/${id}`, body)
        : this.http.post(`${this.API}/masters/price-lists`, body);
    } else if (tab === 'templates') {
      const body = {
        name: this.masterForm.name,
        description: this.masterForm.description || undefined,
        notes: this.masterForm.notes || undefined,
        terms: this.masterForm.terms || undefined,
        currency: this.masterForm.currency || 'COP',
        isDefault: this.masterForm.isDefault,
        items: this.masterForm.templateItems
          .filter((item) => item.description.trim())
          .map((item, index) => ({
            productId: item.productId || undefined,
            description: item.description,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            position: index + 1,
          })),
      };
      request$ = isEdit
        ? this.http.put(`${this.API}/masters/templates/${id}`, body)
        : this.http.post(`${this.API}/masters/templates`, body);
    } else {
      const route = routeMap[tab];
      const body = {
        name: this.masterForm.name,
        description: this.masterForm.description || undefined,
        email: this.masterForm.email || undefined,
        phone: this.masterForm.phone || undefined,
        code: this.masterForm.code || undefined,
        color: this.masterForm.color || undefined,
        position: Number(this.masterForm.position || 0),
        isDefault: this.masterForm.isDefault,
        isClosed: this.masterForm.isClosed,
      };
      request$ = isEdit
        ? this.http.put(`${this.API}/masters/${route}/${id}`, body)
        : this.http.post(`${this.API}/masters/${route}`, body);
    }

    this.savingMaster.set(true);
    request$.subscribe({
      next: () => {
        this.notify.success(`${isEdit ? 'Actualizado' : 'Creado'} ${this.activeMasterSingular()} correctamente`);
        this.savingMaster.set(false);
        this.cancelMasterEditor();
        this.loadCommercialMasters();
      },
      error: (e: any) => {
        this.savingMaster.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible guardar el maestro comercial');
      },
    });
  }

  removeMaster(row: any) {
    const tab = this.activeMasterTab();
    const routeMap: Record<MasterTab, string> = {
      salesOwners: 'sales-owners',
      sourceChannels: 'source-channels',
      lostReasons: 'lost-reasons',
      stages: 'stages',
      priceLists: 'price-lists',
      templates: 'templates',
    };
    this.dialog.confirm({
      title: 'Desactivar registro',
      message: `Se desactivará "${row.name}".`,
      confirmLabel: 'Desactivar',
      danger: true,
      icon: 'warning',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.http.delete(`${this.API}/masters/${routeMap[tab]}/${row.id}`).subscribe({
        next: () => {
          this.notify.success('Registro desactivado');
          this.loadCommercialMasters();
        },
        error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible desactivar el registro'),
      });
    });
  }

  addPriceListItem() {
    this.masterForm.priceListItems = [
      ...this.masterForm.priceListItems,
      { productId: '', description: '', unitPrice: 0, taxRate: 19 },
    ];
  }

  removePriceListItem(index: number) {
    this.masterForm.priceListItems = this.masterForm.priceListItems.filter((_, idx) => idx !== index);
  }

  addTemplateItem() {
    this.masterForm.templateItems = [
      ...this.masterForm.templateItems,
      { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 },
    ];
  }

  removeTemplateItem(index: number) {
    this.masterForm.templateItems = this.masterForm.templateItems.filter((_, idx) => idx !== index);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  // ── Modal: Formulario ──────────────────────────────────────────────────────

  openFormModal(quote?: Quote) {
    this.loadCommercialMasters();
    if (quote) {
      // Editar cotización existente — carga el detalle para obtener los ítems
      this.editingId.set(quote.id);
      this.quoteForm = {
        issueDate:  quote.issueDate?.substring(0, 10) ?? '',
        expiresAt:  quote.expiresAt?.substring(0, 10) ?? '',
        notes:      quote.notes ?? '',
        terms:      quote.terms ?? '',
        paymentTermLabel: quote.paymentTermLabel ?? '',
        paymentTermDays: quote.paymentTermDays ?? null,
        deliveryLeadTimeDays: quote.deliveryLeadTimeDays ?? null,
        deliveryTerms: quote.deliveryTerms ?? '',
        incotermCode: quote.incotermCode ?? '',
        incotermLocation: quote.incotermLocation ?? '',
        exchangeRate: quote.exchangeRate ?? 1,
        commercialConditions: quote.commercialConditions ?? '',
        salesOwnerId: this.findMasterIdByName('salesOwners', quote.salesOwnerName),
        salesOwnerName: quote.salesOwnerName ?? '',
        opportunityName: quote.opportunityName ?? '',
        sourceChannelId: this.findMasterIdByName('sourceChannels', quote.sourceChannel),
        sourceChannel: quote.sourceChannel ?? '',
        priceListId: '',
        templateId: '',
      };
      this.selectedCustomer.set({ id: quote.customer.id, name: quote.customer.name, documentNumber: quote.customer.documentNumber });
      this.customerSearch = quote.customer.name;

      // Cargar ítems completos si no están en la cotización de la lista
      if (quote.items && quote.items.length > 0) {
        this.setLinesFromItems(quote.items);
      } else {
        this.http.get<Quote>(`${this.API}/${quote.id}`).subscribe({
          next: (full) => {
            this.quoteForm = {
              issueDate:  full.issueDate?.substring(0, 10) ?? '',
              expiresAt:  full.expiresAt?.substring(0, 10) ?? '',
              notes:      full.notes ?? '',
              terms:      full.terms ?? '',
              paymentTermLabel: full.paymentTermLabel ?? '',
              paymentTermDays: full.paymentTermDays ?? null,
              deliveryLeadTimeDays: full.deliveryLeadTimeDays ?? null,
              deliveryTerms: full.deliveryTerms ?? '',
              incotermCode: full.incotermCode ?? '',
              incotermLocation: full.incotermLocation ?? '',
              exchangeRate: full.exchangeRate ?? 1,
              commercialConditions: full.commercialConditions ?? '',
              salesOwnerId: this.findMasterIdByName('salesOwners', full.salesOwnerName),
              salesOwnerName: full.salesOwnerName ?? '',
              opportunityName: full.opportunityName ?? '',
              sourceChannelId: this.findMasterIdByName('sourceChannels', full.sourceChannel),
              sourceChannel: full.sourceChannel ?? '',
              priceListId: '',
              templateId: '',
            };
            this.setLinesFromItems(full.items ?? []);
          },
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
      paymentTermLabel: this.quoteForm.paymentTermLabel || undefined,
      paymentTermDays: this.quoteForm.paymentTermDays ?? undefined,
      deliveryLeadTimeDays: this.quoteForm.deliveryLeadTimeDays ?? undefined,
      deliveryTerms: this.quoteForm.deliveryTerms || undefined,
      incotermCode: this.quoteForm.incotermCode || undefined,
      incotermLocation: this.quoteForm.incotermLocation || undefined,
      exchangeRate: Number(this.quoteForm.exchangeRate || 1),
      commercialConditions: this.quoteForm.commercialConditions || undefined,
      salesOwnerName: this.quoteForm.salesOwnerName || undefined,
      opportunityName: this.quoteForm.opportunityName || undefined,
      sourceChannel: this.quoteForm.sourceChannel || undefined,
      currency: this.selectedCommercialCurrency(),
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
      next: (full) => {
        this.detailQuote.set(full);
        this.loadFollowUps(full.id);
        this.loadAttachments(full.id);
        this.loadComments(full.id);
        this.loadAuditTrail(full.id);
        this.loadIntegrationSummary(full.id);
      },
      error: () => {
        this.detailQuote.set(q);
        this.loadFollowUps(q.id);
        this.loadAttachments(q.id);
        this.loadComments(q.id);
        this.loadAuditTrail(q.id);
        this.loadIntegrationSummary(q.id);
      },
    });
  }

  closeDetail() {
    this.detailQuote.set(null);
    this.quoteFollowUps.set([]);
    this.quoteAttachments.set([]);
    this.quoteComments.set([]);
    this.quoteAuditTrail.set([]);
    this.quoteIntegrationSummary.set(null);
  }

  // ── Modal: Cambiar Estado ──────────────────────────────────────────────────

  openStatusModal(q: Quote) {
    this.newStatus = q.status === 'CONVERTED' ? 'SENT' : q.status;
    const matchedLostReason = this.findMasterIdByName('lostReasons', q.lostReason ?? '');
    this.statusLostReason = matchedLostReason ? (q.lostReason ?? '') : (q.lostReason ? '__custom__' : '');
    this.customStatusLostReason = matchedLostReason ? '' : (q.lostReason ?? '');
    this.statusTarget.set(q);
  }

  changeStatus() {
    const q = this.statusTarget();
    if (!q) return;
    const finalLostReason = this.statusLostReason === '__custom__'
      ? this.customStatusLostReason.trim()
      : this.statusLostReason.trim();
    if (this.newStatus === 'REJECTED' && !finalLostReason) {
      this.notify.warning('Debes indicar el motivo de pérdida');
      return;
    }
    this.saving.set(true);
    this.http.patch(`${this.API}/${q.id}/status`, { status: this.newStatus, lostReason: finalLostReason || undefined }).subscribe({
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

  async requestApproval(q: Quote) {
    const reason = await this.dialog.prompt({
      title: 'Solicitar aprobación comercial',
      message: `Vas a solicitar aprobación para la cotización ${q.number}.`,
      detail: 'Este motivo ayudará a justificar la solicitud ante el responsable comercial.',
      inputLabel: 'Motivo',
      placeholder: 'Describe por qué debe aprobarse esta cotización',
      initialValue: q.approval?.reason || 'Supera política comercial',
      confirmLabel: 'Solicitar aprobación',
      icon: 'approval',
      inputType: 'textarea',
    });
    if (reason === null) return;
    this.http.post(`${this.API}/${q.id}/request-approval`, { reason }).subscribe({
      next: () => {
        this.notify.success('Solicitud de aprobación enviada');
        this.openDetail(q);
        this.load();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al solicitar aprobación'),
    });
  }

  approveQuote(q: Quote) {
    this.http.patch(`${this.API}/${q.id}/approve`, {}).subscribe({
      next: () => {
        this.notify.success('Cotización aprobada');
        this.openDetail(q);
        this.load();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al aprobar la cotización'),
    });
  }

  async rejectQuoteApproval(q: Quote) {
    const reason = await this.dialog.prompt({
      title: 'Rechazar aprobación',
      message: `Indica el motivo del rechazo para la cotización ${q.number}.`,
      inputLabel: 'Motivo del rechazo',
      placeholder: 'Describe la razón del rechazo',
      initialValue: q.approval?.rejectedReason || '',
      confirmLabel: 'Rechazar',
      danger: true,
      icon: 'rule',
      inputType: 'textarea',
    });
    if (reason === null) return;
    this.http.patch(`${this.API}/${q.id}/reject-approval`, { reason }).subscribe({
      next: () => {
        this.notify.success('Aprobación rechazada');
        this.openDetail(q);
        this.load();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al rechazar la aprobación'),
    });
  }

  loadFollowUps(quoteId: string) {
    this.http.get<QuoteFollowUp[]>(`${this.API}/${quoteId}/follow-ups`).subscribe({
      next: (rows) => this.quoteFollowUps.set(rows ?? []),
      error: () => this.quoteFollowUps.set([]),
    });
  }

  loadAttachments(quoteId: string) {
    this.http.get<QuoteAttachment[]>(`${this.API}/${quoteId}/attachments`).subscribe({
      next: (rows) => this.quoteAttachments.set(rows ?? []),
      error: () => this.quoteAttachments.set([]),
    });
  }

  loadComments(quoteId: string) {
    this.http.get<QuoteComment[]>(`${this.API}/${quoteId}/comments`).subscribe({
      next: (rows) => this.quoteComments.set(rows ?? []),
      error: () => this.quoteComments.set([]),
    });
  }

  loadAuditTrail(quoteId: string) {
    this.http.get<QuoteAuditEntry[]>(`${this.API}/${quoteId}/audit-trail`).subscribe({
      next: (rows) => this.quoteAuditTrail.set(rows ?? []),
      error: () => this.quoteAuditTrail.set([]),
    });
  }

  loadIntegrationSummary(quoteId: string) {
    this.http.get<QuoteIntegrationSummary>(`${this.API}/${quoteId}/integration-summary`).subscribe({
      next: (row) => this.quoteIntegrationSummary.set(row ?? null),
      error: () => this.quoteIntegrationSummary.set(null),
    });
  }

  duplicateQuote(q: Quote) {
    this.http.post(`${this.API}/${q.id}/duplicate`, {}).subscribe({
      next: () => {
        this.notify.success('Cotización duplicada en un nuevo borrador');
        this.load();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible duplicar la cotización'),
    });
  }

  renewQuote(q: Quote) {
    this.http.post(`${this.API}/${q.id}/renew`, {}).subscribe({
      next: () => {
        this.notify.success('Cotización renovada en un nuevo borrador');
        this.load();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible renovar la cotización'),
    });
  }

  async createQuoteFollowUp(q: Quote) {
    const activityType = await this.dialog.prompt({
      title: 'Nuevo seguimiento comercial',
      message: `Selecciona el tipo de seguimiento para la cotización ${q.number}.`,
      inputLabel: 'Tipo de seguimiento',
      confirmLabel: 'Continuar',
      icon: 'support_agent',
      inputType: 'select',
      initialValue: 'CALL',
      options: [
        { label: 'Llamada', value: 'CALL' },
        { label: 'Correo', value: 'EMAIL' },
        { label: 'Reunión', value: 'MEETING' },
        { label: 'WhatsApp', value: 'WHATSAPP' },
        { label: 'Nota interna', value: 'NOTE' },
      ],
    });
    if (activityType === null) return;

    const notes = await this.dialog.prompt({
      title: 'Detalle del seguimiento',
      message: 'Registra el resultado o contexto del seguimiento comercial.',
      inputLabel: 'Detalle',
      placeholder: 'Ej. Cliente solicita una nueva reunión el próximo martes',
      confirmLabel: 'Continuar',
      icon: 'edit_note',
      inputType: 'textarea',
    });
    if (notes === null) return;

    const scheduledAt = await this.dialog.prompt({
      title: 'Programar seguimiento',
      message: 'Si quieres, indica una fecha para el próximo contacto.',
      detail: 'Este campo es opcional.',
      inputLabel: 'Fecha programada',
      confirmLabel: 'Guardar seguimiento',
      icon: 'event',
      inputType: 'date',
      allowEmpty: true,
    });
    if (scheduledAt === null) return;

    this.http.post(`${this.API}/${q.id}/follow-ups`, {
      activityType,
      notes,
      scheduledAt: scheduledAt || undefined,
    }).subscribe({
      next: () => {
        this.notify.success('Seguimiento registrado');
        if (this.detailQuote()?.id === q.id) {
          this.loadFollowUps(q.id);
        }
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible registrar el seguimiento'),
    });
  }

  async registerQuoteAttachment(q: Quote) {
    const fileName = await this.dialog.prompt({
      title: 'Registrar adjunto',
      message: `Registra un soporte documental para la cotización ${q.number}.`,
      inputLabel: 'Nombre del archivo',
      placeholder: 'Ej. Propuesta técnica.pdf',
      confirmLabel: 'Continuar',
      icon: 'attach_file',
    });
    if (fileName === null) return;

    const fileUrl = await this.dialog.prompt({
      title: 'URL del adjunto',
      message: 'Indica la URL o ubicación pública del archivo.',
      inputLabel: 'URL',
      placeholder: 'https://...',
      confirmLabel: 'Continuar',
      icon: 'link',
    });
    if (fileUrl === null) return;

    const category = await this.dialog.prompt({
      title: 'Categoría documental',
      message: 'Si quieres, clasifica el adjunto.',
      detail: 'Este campo es opcional.',
      inputLabel: 'Categoría',
      placeholder: 'Ej. SOPORTE, PROPUESTA, ANEXO',
      confirmLabel: 'Continuar',
      icon: 'folder',
      allowEmpty: true,
    });
    if (category === null) return;

    const notes = await this.dialog.prompt({
      title: 'Notas del adjunto',
      message: 'Puedes registrar una nota interna breve para este documento.',
      detail: 'Este campo es opcional.',
      inputLabel: 'Notas',
      placeholder: 'Observaciones del documento',
      confirmLabel: 'Registrar adjunto',
      icon: 'description',
      inputType: 'textarea',
      allowEmpty: true,
    });
    if (notes === null) return;

    this.http.post(`${this.API}/${q.id}/attachments`, {
      fileName,
      fileUrl,
      category: category || undefined,
      notes: notes || undefined,
    }).subscribe({
      next: () => {
        this.notify.success('Adjunto registrado');
        if (this.detailQuote()?.id === q.id) {
          this.loadAttachments(q.id);
          this.loadAuditTrail(q.id);
        }
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible registrar el adjunto'),
    });
  }

  async addQuoteComment(q: Quote) {
    const message = await this.dialog.prompt({
      title: 'Agregar comentario interno',
      message: `Registra una nota interna para la cotización ${q.number}.`,
      inputLabel: 'Comentario',
      placeholder: 'Escribe el comentario interno',
      confirmLabel: 'Guardar comentario',
      icon: 'comment',
      inputType: 'textarea',
    });
    if (message === null) return;

    this.http.post(`${this.API}/${q.id}/comments`, {
      commentType: 'INTERNAL',
      message,
    }).subscribe({
      next: () => {
        this.notify.success('Comentario registrado');
        if (this.detailQuote()?.id === q.id) {
          this.loadComments(q.id);
          this.loadAuditTrail(q.id);
        }
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible registrar el comentario'),
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
    this.http.get(`${this.API}/${q.id}/pdf`, {
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
    this.http.get(`${this.API}/${q.id}/pdf/download`, {
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
    this.sendingDian.update(s => ({ ...s, [q.id]: true }));
    this.http.post<any>(`${this.API}/${q.id}/send-to-dian`, {}).subscribe({
      next: result => {
        this.sendingDian.update(s => ({ ...s, [q.id]: false }));
        const zipKey = result?.dianZipKey ?? 'OK';
        const invoiceNumber = result?.invoiceNumber ? `Factura ${result.invoiceNumber}. ` : '';
        this.notify.success(`${invoiceNumber}Enviada a DIAN. ZipKey: ${zipKey}`);
        if (this.detailQuote()?.id === q.id) {
          this.openDetail(q);
        }
        this.load();
      },
      error: err => {
        this.sendingDian.update(s => ({ ...s, [q.id]: false }));
        this.notify.error(err?.error?.message ?? 'Error al enviar la cotización a DIAN');
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

  approvalLabel(status: string) {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      SUPERSEDED: 'Reemplazada',
    };
    return map[status] ?? status;
  }

  followUpTypeLabel(type: string) {
    const map: Record<string, string> = {
      CALL: 'Llamada',
      EMAIL: 'Correo',
      MEETING: 'Reunión',
      WHATSAPP: 'WhatsApp',
      NOTE: 'Nota',
    };
    return map[type] ?? type;
  }

  commentTypeLabel(type: string) {
    const map: Record<string, string> = {
      INTERNAL: 'Comentario interno',
      DECISION: 'Decisión',
      REVIEW: 'Revisión',
    };
    return map[type] ?? type;
  }

  auditActionLabel(action: string) {
    const map: Record<string, string> = {
      QUOTE_CREATED: 'Cotización creada',
      QUOTE_UPDATED: 'Cotización actualizada',
      QUOTE_STATUS_UPDATED: 'Estado actualizado',
      QUOTE_APPROVAL_REQUESTED: 'Aprobación solicitada',
      QUOTE_APPROVED: 'Cotización aprobada',
      QUOTE_APPROVAL_REJECTED: 'Aprobación rechazada',
      QUOTE_FOLLOWUP_CREATED: 'Seguimiento registrado',
      QUOTE_ATTACHMENT_CREATED: 'Adjunto registrado',
      QUOTE_COMMENT_CREATED: 'Comentario registrado',
      QUOTE_CONVERTED: 'Cotización convertida',
      QUOTE_SENT_TO_DIAN: 'Factura enviada a DIAN desde cotización',
      QUOTE_DUPLICATED: 'Cotización duplicada',
      QUOTE_DELETED: 'Cotización eliminada',
    };
    return map[action] ?? action;
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

  formatDateTime(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  topSalesOwnerLabel() {
    const topOwner = this.analyticsSummary()?.bySalesOwner?.[0];
    if (!topOwner) return 'Sin responsable líder';
    return `${topOwner.name} lidera con ${topOwner.winRate}%`;
  }

  analyticsStatusCount(status: string) {
    return this.analyticsSummary()?.totalsByStatus?.[status] ?? 0;
  }

  // ── Fábricas de objetos vacíos ─────────────────────────────────────────────

  private emptyHeader() {
    const today = new Date().toISOString().substring(0, 10);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    return {
      issueDate: today,
      expiresAt: thirtyDays,
      notes: '',
      terms: '',
      paymentTermLabel: '',
      paymentTermDays: null,
      deliveryLeadTimeDays: null,
      deliveryTerms: '',
      incotermCode: '',
      incotermLocation: '',
      exchangeRate: 1,
      commercialConditions: '',
      salesOwnerId: '',
      salesOwnerName: '',
      opportunityName: '',
      sourceChannelId: '',
      sourceChannel: '',
      priceListId: '',
      templateId: '',
    };
  }

  private emptyLine(): QuoteLineForm {
    return { productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 19, discount: 0 };
  }

  private emptyMasterForm() {
    return {
      name: '',
      description: '',
      email: '',
      phone: '',
      code: '',
      color: '#2563eb',
      position: 0,
      isDefault: false,
      isClosed: false,
      currency: 'COP',
      notes: '',
      terms: '',
      priceListItems: [] as Array<{ productId: string; description: string; unitPrice: number; taxRate: number }>,
      templateItems: [] as Array<{ productId: string; description: string; quantity: number; unitPrice: number; taxRate: number; discount: number }>,
    };
  }

  private emptyApprovalPolicyForm() {
    return {
      name: '',
      approvalType: 'TOTAL' as 'TOTAL' | 'DISCOUNT',
      thresholdValue: 0,
      requiredRole: 'MANAGER',
      sequence: 1,
      description: '',
    };
  }

  private findMasterIdByName(kind: 'salesOwners' | 'sourceChannels' | 'lostReasons', name?: string | null) {
    const value = (name ?? '').trim().toLowerCase();
    if (!value) return '';
    const rows = this.commercialMasters()[kind];
    return rows.find((row) => row.name.trim().toLowerCase() === value)?.id ?? '';
  }
}
