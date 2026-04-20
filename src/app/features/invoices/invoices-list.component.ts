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
  withholdingAmount?: number;
  icaAmount?: number;
  fiscalValidationStatus?: string | null;
  fiscalValidationNotes?: string | null;
  sourceChannel?: string; sourceTerminalId?: string | null;
  salesOrderId?: string | null;
  deliveryNoteId?: string | null;
  sourceQuoteId?: string | null;
  sourcePosSaleId?: string | null;
  billingMode?: string | null;
  inventoryStatus?: string | null;
  inventoryAppliedAt?: string | null;
  inventoryReversedAt?: string | null;
  deliveryStatus?: string | null;
  documentConfigId?: string | null;
  resolutionNumber?: string | null;
  resolutionLabel?: string | null;
  numberingRangeFrom?: number | null;
  numberingRangeTo?: number | null;
  resolutionValidFrom?: string | null;
  resolutionValidTo?: string | null;
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
  documentConfig?: InvoiceDocumentConfig | null;
}

interface Customer { id: string; name: string; documentNumber: string; documentType: string; }
interface Product { id: string; name: string; sku: string; price: number; taxRate: number; taxType: string; unit: string; }
interface BranchOption { id: string; name: string; }
interface PosTerminalOption { id: string; code: string; name: string; branchId?: string | null; branch?: { id: string; name: string } | null; }

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
}

interface InvoiceDocumentConfig {
  id: string;
  name: string;
  branchId?: string | null;
  posTerminalId?: string | null;
  channel: string;
  type: string;
  prefix: string;
  resolutionNumber?: string | null;
  resolutionLabel?: string | null;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  technicalKey?: string | null;
  isActive: boolean;
  isDefault: boolean;
  branch?: { id: string; name: string } | null;
  posTerminal?: { id: string; code: string; name: string; branchId?: string | null } | null;
}

interface SalesOrderSummary {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  requestedDate?: string | null;
  total: number;
  currency: string;
  customerName: string;
  quoteId?: string | null;
  posSaleId?: string | null;
  itemsCount: number;
}

interface DeliveryNoteSummary {
  id: string;
  number: string;
  status: string;
  inventoryStatus?: string | null;
  issueDate: string;
  salesOrderId?: string | null;
  posSaleId?: string | null;
  customerName: string;
  itemsCount: number;
  total: number;
}

interface QuoteFlowSummary {
  id: string;
  number: string;
  status: string;
  issueDate: string;
  total: number;
  customerName: string;
  customerDocument?: string | null;
}

interface PosSaleFlowSummary {
  id: string;
  saleNumber: string;
  status: string;
  total: number;
  customerName: string;
  orderType?: string | null;
  orderStatus?: string | null;
  createdAt?: string | null;
}

interface InvoiceStatement {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate?: string | null;
    total: number;
    customer: { id: string; name: string; documentNumber: string; email?: string; phone?: string };
  };
  summary: {
    total: number;
    paidAmount: number;
    adjustmentNet: number;
    balance: number;
    receiptsApplied: number;
    nextPromise?: {
      id: string;
      amount: number;
      promisedDate: string;
      status: string;
      notes?: string | null;
    } | null;
  };
  reconciliation: {
    appliedAmount: number;
    reconciledAmount: number;
    pendingReconciliation: number;
    receipts: Array<{
      receiptId: string;
      receiptNumber: string;
      receiptStatus: string;
      paymentMethod: string;
      reference?: string | null;
      paymentDate: string;
      appliedAmount: number;
      bankMovementId?: string | null;
      bankMovementStatus?: string | null;
      bankMovementReference?: string | null;
    }>;
  };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference?: string | null;
    notes?: string | null;
    user?: { firstName?: string; lastName?: string };
  }>;
  agreements: Array<{
    id: string;
    amount: number;
    promisedDate: string;
    status: string;
    notes?: string | null;
  }>;
  movements: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
}

interface InvoiceApproval {
  id: string;
  actionType: 'ISSUE' | 'CANCEL';
  status: string;
  reason?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  consumedAt?: string | null;
  requestedByName?: string | null;
  approvedByName?: string | null;
}

interface InvoiceAttachment {
  id: string;
  invoiceId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  category?: string | null;
  notes?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  uploadedByName?: string | null;
}

interface InvoiceAuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  createdAt: string;
  userName?: string | null;
  before?: any;
  after?: any;
}

interface InvoiceNoteContext {
  invoice: {
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate?: string | null;
    total: number;
    customer: { id: string; name: string; documentNumber: string };
    sourceChannel?: string | null;
    inventoryStatus?: string | null;
    deliveryStatus?: string | null;
  };
  documentBalance: {
    originalTotal: number;
    totalCredits: number;
    totalDebits: number;
    remainingBalance: number;
    creditCount: number;
    debitCount: number;
    fullyOffset: boolean;
  };
  cartera: {
    totalInvoiced: number;
    totalPaid: number;
    outstandingBalance: number;
    balance: number;
  };
  notes: Invoice[];
  lines: Array<{
    id: string;
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discount: number;
    total: number;
    product?: { id: string; name: string; sku: string } | null;
    creditedQty: number;
    debitedQty: number;
    remainingCreditQty: number;
    remainingCreditAmount: number;
  }>;
  reasonCatalog: {
    credit: Array<{ code: string; label: string }>;
    debit: Array<{ code: string; label: string }>;
  };
  guidedActions: {
    canFullCreditReverse: boolean;
    canPartialByLine: boolean;
    inventoryReturnEligible?: boolean;
  };
}

interface InvoiceFiscalSummaryReport {
  summary: {
    count: number;
    taxableBase: number;
    iva: number;
    retefuente: number;
    ica: number;
    total: number;
  };
  byType: Array<{
    type: string;
    count: number;
    taxableBase: number;
    iva: number;
    retefuente: number;
    ica: number;
    total: number;
  }>;
  byValidation: Array<{ status: string; count: number }>;
}

interface InvoiceVatSalesBookRow {
  id: string;
  invoiceNumber: string;
  prefix: string;
  issueDate: string;
  type: string;
  sourceChannel?: string | null;
  customerName: string;
  customerDocument: string;
  customerDocumentType?: string | null;
  taxableBase: number;
  iva: number;
  total: number;
}

interface InvoiceWithholdingsBookRow {
  id: string;
  invoiceNumber: string;
  prefix: string;
  issueDate: string;
  type: string;
  customerName: string;
  customerDocument: string;
  taxableBase: number;
  retefuente: number;
  ica: number;
  total: number;
}

interface InvoiceDianValidationRow {
  id: string;
  invoiceNumber: string;
  prefix: string;
  issueDate: string;
  type: string;
  status: string;
  sourceChannel?: string | null;
  dianStatus?: string | null;
  dianStatusCode?: string | null;
  fiscalValidationStatus: string;
  fiscalValidationNotes?: string | null;
  customerName: string;
  customerDocument: string;
}

interface InvoiceAnalyticsSummary {
  kpis: {
    issuedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    pendingDianCount: number;
    emittedAmount: number;
    collectedAmount: number;
    rejectionRate: number;
    collectionRate: number;
    avgResponseMinutes: number;
  };
  documentControl: {
    attachmentsCount: number;
    pendingApprovals: number;
    attachmentCoverage: number;
  };
  dian: {
    topStatusCodes: Array<{ code: string; count: number }>;
  };
  byBranch: Array<{
    key: string;
    count: number;
    emittedAmount: number;
    collectedAmount: number;
    rejectedCount: number;
    rejectionRate: number;
    collectionRate: number;
  }>;
  byChannel: Array<{
    key: string;
    count: number;
    emittedAmount: number;
    collectedAmount: number;
    rejectedCount: number;
    rejectionRate: number;
    collectionRate: number;
  }>;
  bySeller: Array<{
    key: string;
    count: number;
    emittedAmount: number;
    collectedAmount: number;
    rejectedCount: number;
    rejectionRate: number;
    collectionRate: number;
  }>;
  latestDocuments: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    total: number;
    status: string;
    dianStatus?: string | null;
    dianStatusCode?: string | null;
    branchName: string;
    channel: string;
    seller: string;
    collected: number;
    responseMinutes?: number | null;
  }>;
}

interface InvoiceOperationalMonitor {
  queue: {
    pending: number;
    failed: number;
    success: number;
    recent: InvoiceDianJob[];
  };
  externalIntakes: {
    pending: number;
    processed: number;
    recent: InvoiceExternalIntake[];
  };
  accounting: {
    recent: Array<{
      id: string;
      status: string;
      action: string;
      createdAt: string;
      resourceId?: string | null;
    }>;
  };
}

interface InvoiceDianJob {
  id: string;
  actionType: string;
  status: string;
  sourceChannel?: string | null;
  attempts: number;
  responseCode?: string | null;
  responseMessage?: string | null;
  createdAt: string;
  processedAt?: string | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    dianStatus?: string | null;
    dianStatusCode?: string | null;
    sourceChannel?: string | null;
    branchId?: string | null;
  } | null;
  branch?: { id: string; name: string } | null;
}

interface InvoiceExternalIntake {
  id: string;
  channel: string;
  externalRef: string;
  status: string;
  notes?: string | null;
  processedAt?: string | null;
  createdAt: string;
  linkedInvoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    dianStatus?: string | null;
  } | null;
  branch?: { id: string; name: string } | null;
}

@Component({
  selector: 'app-invoices-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <section class="hero-shell" id="tour-invoice-header">
        <div class="hero-main">
          <div class="hero-copy">
            <p class="hero-kicker">Facturacion DIAN</p>
            <h2 class="page-title">Centro de facturacion electronica</h2>
            <p class="page-subtitle">Controla ventas, estados DIAN y seguimiento de cartera desde una vista mas clara y ejecutiva.</p>
          </div>

          <div class="hero-actions"></div>
        </div>

        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Total visible</span>
            <strong>{{ total() }}</strong>
            <small>{{ viewMode() === 'table' ? 'Vista operativa en tabla' : 'Vista ejecutiva en tarjetas' }}</small>
          </div>
          <div class="hero-summary-list">
            <div class="hero-summary-pill">
              <span class="dot dot-success"></span>
              {{ acceptedCount() }} aceptadas
            </div>
            <div class="hero-summary-pill">
              <span class="dot dot-warn"></span>
              {{ pendingCount() }} pendientes
            </div>
            <div class="hero-summary-pill">
              <span class="dot dot-danger"></span>
              {{ rejectedCount() }} rechazadas
            </div>
          </div>
        </div>
      </section>

      <section class="tabs-shell">
        <div class="tabs-shell__head">
          <div>
            <span class="tabs-shell__eyebrow">Navegación del módulo</span>
            <h3>Áreas de Facturación</h3>
          </div>
          <p>Organiza la operación entre emisión diaria, gobierno documental, cumplimiento DIAN y seguimiento comercial.</p>
        </div>

        <div class="tabs-groups">
          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Operación diaria</span>
              <small>Acciones de trabajo frecuentes para el equipo comercial y documental.</small>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'refresh'" (click)="triggerInvoiceAction('refresh')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Actualizar</span>
                  <span class="tab-btn__meta">Recarga facturas, KPIs y estados visibles del módulo.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'new'" (click)="triggerInvoiceAction('new')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Nueva factura</span>
                  <span class="tab-btn__meta">Emite un documento directo usando cliente, líneas y DIAN.</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Gobierno y cumplimiento</span>
              <small>Configuración fiscal, monitoreo DIAN y control documental del proceso.</small>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'config'" (click)="triggerInvoiceAction('config')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17a1 1 0 00-1.98 0l-.114.764a1 1 0 01-.79.82l-.775.154a1 1 0 00-.543 1.67l.53.53a1 1 0 010 1.414l-.53.53a1 1 0 00.543 1.67l.775.154a1 1 0 01.79.82l.114.764a1 1 0 001.98 0l.114-.764a1 1 0 01.79-.82l.775-.154a1 1 0 00.543-1.67l-.53-.53a1 1 0 010-1.414l.53-.53a1 1 0 00-.543-1.67l-.775-.154a1 1 0 01-.79-.82l-.114-.764zM10.5 8a2 2 0 100 4 2 2 0 000-4z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Configuración documental</span>
                  <span class="tab-btn__meta">Prefijos, resoluciones, canales y ámbito por sede o caja.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'fiscal'" (click)="triggerInvoiceAction('fiscal')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.055a7.002 7.002 0 015.945 5.945H18a1 1 0 110 2h-1.055a7.002 7.002 0 01-5.945 5.945V19a1 1 0 11-2 0v-1.055a7.002 7.002 0 01-5.945-5.945H2a1 1 0 110-2h1.055a7.002 7.002 0 015.945-5.945V3a1 1 0 011-1zm0 4a5 5 0 100 10 5 5 0 000-10zm-1 2a1 1 0 012 0v2h2a1 1 0 110 2h-3a1 1 0 01-1-1V8z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Fiscalidad</span>
                  <span class="tab-btn__meta">Libros fiscales, validación previa y control tributario Colombia.</span>
                </span>
              </button>
              <button class="tab-btn tab-btn--utility" [class.tab-btn--active]="focusedInvoiceAction() === 'operations'" (click)="triggerInvoiceAction('operations')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.09A6.002 6.002 0 0115.91 9H17a1 1 0 110 2h-1.09A6.002 6.002 0 0111 15.91V17a1 1 0 11-2 0v-1.09A6.002 6.002 0 014.09 11H3a1 1 0 110-2h1.09A6.002 6.002 0 019 4.09V3a1 1 0 011-1zm0 4a4 4 0 100 8 4 4 0 000-8zm0 2a1 1 0 011 1v1h1a1 1 0 110 2h-2a1 1 0 01-1-1V9a1 1 0 011-1z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Operación DIAN</span>
                  <span class="tab-btn__meta">Cola técnica, intake externo y reprocesos del canal documental.</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Gestión comercial</span>
              <small>Seguimiento a orígenes, trazabilidad y lectura ejecutiva del desempeño.</small>
            </div>
            <div class="tab-grid tab-grid--compact">
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'flow'" (click)="triggerInvoiceAction('flow')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h4.586A2 2 0 0111 3.586L12.414 5H15a2 2 0 012 2v1a1 1 0 11-2 0V7H5v8h4a1 1 0 110 2H5a2 2 0 01-2-2V5zm11.293 4.293a1 1 0 011.414 0L19 12.586l-3.293 3.293a1 1 0 01-1.414-1.414L15.586 13H11a1 1 0 110-2h4.586l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Flujo comercial</span>
                  <span class="tab-btn__meta">Pedidos, remisiones y facturación desde origen comercial.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="focusedInvoiceAction() === 'analytics'" (click)="triggerInvoiceAction('analytics')">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 3a1 1 0 011 1v11h11a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm3 8a1 1 0 011-1h1a1 1 0 011 1v2a1 1 0 11-2 0v-1H8v1a1 1 0 11-2 0v-2zm4-4a1 1 0 011-1h1a1 1 0 011 1v6a1 1 0 11-2 0V8h-1v5a1 1 0 11-2 0V7zm4-2a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 11-2 0V6h-1v7a1 1 0 11-2 0V5z" clip-rule="evenodd"/>
                </svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Analítica</span>
                  <span class="tab-btn__meta">KPIs de emisión, recaudo, rechazo DIAN y gestión documental.</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </section>

      <!-- KPI strip -->
      <section class="kpi-strip">
        @for (k of kpis; track k.label) {
          <article class="kpi-card">
            <div class="kpi-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm6 4a1 1 0 00-1 1v8a1 1 0 102 0V8a1 1 0 00-1-1zm5-3a1 1 0 00-1 1v11a1 1 0 102 0V5a1 1 0 00-1-1z"/></svg>
            </div>
            <div class="kpi-body">
              <div class="kpi-value">{{ k.value }}</div>
              <div class="kpi-label">{{ k.label }}</div>
            </div>
          </article>
        }
      </section>

      <!-- Filters -->
      <section class="filters-card" id="tour-invoice-filters">
        <div class="filters-head">
          <div>
            <p class="filters-kicker">Exploracion</p>
            <h3>Busca y segmenta tus comprobantes</h3>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div class="view-toggle view-toggle--surface">
              <button class="view-btn view-btn--surface" [class.view-btn-active]="viewMode()==='table'" title="Vista tabla" (click)="viewMode.set('table')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
                Lista
              </button>
              <button class="view-btn view-btn--surface" [class.view-btn-active]="viewMode()==='grid'" title="Vista cuadrícula" (click)="viewMode.set('grid')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a1 2 0 01-2-2v-2z"/></svg>
                Tarjetas
              </button>
            </div>
            <div class="results-pill">{{ total() }} resultados</div>
            <button class="btn btn-primary btn-sm" id="tour-new-invoice" (click)="triggerInvoiceAction('new')">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva factura
            </button>
          </div>
        </div>
        <div class="filters-bar">
          <div class="search-wrap search-wrap-wide">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
            <input type="text" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Buscar por numero, prefijo o cliente..." class="search-input"/>
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
      </section>

      <!-- Table / Grid -->
      @if (viewMode() === 'table') {
      <section class="table-shell" id="tour-invoice-table">
        <div class="table-shell-head">
          <div>
            <p class="table-kicker">Listado</p>
            <h3>Operacion detallada de facturas</h3>
          </div>
          <div class="table-shell-meta">
            <span class="meta-chip">DIAN</span>
            <span class="meta-chip meta-chip-soft">{{ page() }}/{{ totalPages() || 1 }}</span>
          </div>
        </div>
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
        }
        </div>
      </section>
      } @else {
        @if (loading()) {
          <div class="table-card">
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
          </div>
        } @else if (invoices().length === 0) {
          <div class="table-card">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path stroke-linecap="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path stroke-linecap="round" d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              <p>No hay facturas con los filtros actuales</p>
              <button class="btn btn-primary btn-sm" (click)="openNewInvoice()">Crear primera factura</button>
            </div>
          </div>
        } @else {
          <section class="table-shell">
            <div class="table-shell-head">
              <div>
                <p class="table-kicker">Vista ejecutiva</p>
                <h3>Resumen en tarjetas</h3>
              </div>
              <div class="table-shell-meta">
                <span class="meta-chip">{{ total() }} visibles</span>
              </div>
            </div>
          </section>
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
            <div class="pagination pagination--standalone">
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
      }
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

            @if (detailInvoice()?.documentConfig || detailInvoice()?.resolutionNumber || detailInvoice()?.sourceChannel) {
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h3l2 2 2-2h5a2 2 0 002-2V5a2 2 0 00-2-2H4z"/></svg>
                  Configuración documental
                </div>
                <div class="dw-card dw-fiscal-card">
                  <div class="dw-fiscal-row"><span>Canal</span><strong>{{ channelLabel(detailInvoice()?.sourceChannel) }}</strong></div>
                  <div class="dw-fiscal-row"><span>Configuración</span><strong>{{ detailInvoice()?.documentConfig?.name || 'Legado / empresa' }}</strong></div>
                  <div class="dw-fiscal-row"><span>Prefijo</span><strong>{{ detailInvoice()?.documentConfig?.prefix || detailInvoice()?.prefix || '—' }}</strong></div>
                  <div class="dw-fiscal-row"><span>Resolución</span><strong>{{ detailInvoice()?.resolutionNumber || detailInvoice()?.documentConfig?.resolutionNumber || '—' }}</strong></div>
                  <div class="dw-fiscal-row"><span>Clave técnica</span><strong>{{ detailInvoice()?.documentConfig?.technicalKey || '—' }}</strong></div>
                  <div class="dw-fiscal-row"><span>Rango</span><strong>{{ formatRange(detailInvoice()?.numberingRangeFrom || detailInvoice()?.documentConfig?.rangeFrom, detailInvoice()?.numberingRangeTo || detailInvoice()?.documentConfig?.rangeTo) }}</strong></div>
                </div>
              </div>
            }

            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 012 2v1a1 1 0 11-2 0V8H4v8h5a1 1 0 110 2H6a2 2 0 01-2-2V4zm9.293 7.293a1 1 0 011.414 0L18 14.586l-3.293 3.293a1 1 0 01-1.414-1.414L14.586 15H11a1 1 0 110-2h3.586l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                Fiscalidad Colombia
              </div>
              <div class="dw-card dw-fiscal-card">
                <div class="dw-fiscal-row"><span>Base gravable</span><strong>{{ fmtCOP(detailInvoice()!.subtotal) }}</strong></div>
                <div class="dw-fiscal-row"><span>IVA ventas</span><strong>{{ fmtCOP(detailInvoice()!.taxAmount) }}</strong></div>
                <div class="dw-fiscal-row"><span>ReteFuente</span><strong>{{ fmtCOP(detailInvoice()!.withholdingAmount ?? 0) }}</strong></div>
                <div class="dw-fiscal-row"><span>ICA</span><strong>{{ fmtCOP(detailInvoice()!.icaAmount ?? 0) }}</strong></div>
                <div class="dw-fiscal-row"><span>Validación fiscal</span><strong>{{ fiscalValidationLabel(detailInvoice()!.fiscalValidationStatus) }}</strong></div>
                @if (detailInvoice()?.fiscalValidationNotes) {
                  <div class="dw-fiscal-row"><span>Notas</span><strong>{{ detailInvoice()!.fiscalValidationNotes }}</strong></div>
                }
              </div>
            </div>

            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 2a1 1 0 01.894.553l1.382 2.764 3.049.443a1 1 0 01.554 1.706l-2.206 2.15.52 3.037a1 1 0 01-1.451 1.054L10 12.347l-2.742 1.44a1 1 0 01-1.45-1.054l.52-3.037-2.206-2.15a1 1 0 01.554-1.706l3.048-.443L9.106 2.553A1 1 0 0110 2zm-4 13a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
                Operación e inventario
              </div>
              <div class="dw-card dw-fiscal-card">
                <div class="dw-fiscal-row"><span>Flujo comercial</span><strong>{{ invoiceFlowLabel(detailInvoice()!) }}</strong></div>
                <div class="dw-fiscal-row"><span>Canal origen</span><strong>{{ channelLabel(detailInvoice()?.sourceChannel) }}</strong></div>
                <div class="dw-fiscal-row"><span>Inventario</span><strong>{{ inventoryStatusLabel(detailInvoice()?.inventoryStatus) }}</strong></div>
                <div class="dw-fiscal-row"><span>Entrega</span><strong>{{ deliveryStatusLabel(detailInvoice()?.deliveryStatus) }}</strong></div>
                @if (detailInvoice()?.inventoryAppliedAt) {
                  <div class="dw-fiscal-row"><span>Aplicado</span><strong>{{ detailInvoice()!.inventoryAppliedAt! | date:'dd/MM/yyyy HH:mm' }}</strong></div>
                }
                @if (detailInvoice()?.inventoryReversedAt) {
                  <div class="dw-fiscal-row"><span>Reversado</span><strong>{{ detailInvoice()!.inventoryReversedAt! | date:'dd/MM/yyyy HH:mm' }}</strong></div>
                }
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

            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h7a2 2 0 012 2v1h1a2 2 0 012 2v7a2 2 0 01-2 2h-1v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H3a1 1 0 110-2h1V8a2 2 0 012-2h7V4H6v1a1 1 0 11-2 0V4zm2 4v8h7V8H6zm9 0v8h1V8h-1z" clip-rule="evenodd"/></svg>
                Recaudo y cartera
              </div>
              <div class="dw-card">
                @if (loadingStatement()) {
                  <div class="dw-items-empty">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" clip-rule="evenodd"/></svg>
                    Cargando estado de cuenta...
                  </div>
                } @else if (invoiceStatement()) {
                  <div class="invoice-collection-grid">
                    <div class="invoice-collection-kpi">
                      <span>Pagado</span>
                      <strong>{{ fmtCOP(invoiceStatement()!.summary.paidAmount) }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Saldo</span>
                      <strong>{{ fmtCOP(invoiceStatement()!.summary.balance) }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Conciliado</span>
                      <strong>{{ fmtCOP(invoiceStatement()!.reconciliation.reconciledAmount) }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Pend. conciliar</span>
                      <strong>{{ fmtCOP(invoiceStatement()!.reconciliation.pendingReconciliation) }}</strong>
                    </div>
                  </div>
                  @if (invoiceStatement()!.summary.nextPromise) {
                    <div class="invoice-inline-banner">
                      Próximo acuerdo: {{ invoiceStatement()!.summary.nextPromise!.promisedDate | date:'dd/MM/yyyy' }}
                      por {{ fmtCOP(invoiceStatement()!.summary.nextPromise!.amount) }}
                    </div>
                  }
                  <div class="dw-fiscal-card">
                    <div class="dw-fiscal-row"><span>Recaudos aplicados</span><strong>{{ invoiceStatement()!.summary.receiptsApplied }}</strong></div>
                    <div class="dw-fiscal-row"><span>Aplicado a factura</span><strong>{{ fmtCOP(invoiceStatement()!.reconciliation.appliedAmount) }}</strong></div>
                    <div class="dw-fiscal-row"><span>Ajustes netos</span><strong>{{ fmtCOP(invoiceStatement()!.summary.adjustmentNet) }}</strong></div>
                  </div>
                  @if (invoiceStatement()!.payments.length > 0) {
                    <div class="invoice-mini-list">
                      @for (payment of invoiceStatement()!.payments.slice(0, 4); track payment.id) {
                        <div class="invoice-mini-row">
                          <span>{{ payment.paymentDate | date:'dd/MM/yyyy' }} · {{ payment.paymentMethod }}</span>
                          <strong>{{ fmtCOP(payment.amount) }}</strong>
                        </div>
                      }
                    </div>
                  }
                } @else {
                  <div class="dw-items-empty">
                    No hay estado de cuenta disponible para esta factura.
                  </div>
                }
              </div>
            </div>

            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 2a1 1 0 01.894.553l2.04 4.08 4.505.654a1 1 0 01.554 1.706l-3.259 3.177.769 4.487a1 1 0 01-1.451 1.054L10 15.347l-4.052 2.13a1 1 0 01-1.451-1.054l.769-4.487-3.259-3.177a1 1 0 01.554-1.706l4.505-.654 2.04-4.08A1 1 0 0110 2z" clip-rule="evenodd"/></svg>
                Gobierno documental y auditoría
              </div>
              <div class="dw-card">
                @if (loadingGovernance()) {
                  <div class="dw-items-empty">Cargando flujo de aprobación, soportes y bitácora...</div>
                } @else {
                  <div class="invoice-collection-grid">
                    <div class="invoice-collection-kpi">
                      <span>Aprobaciones</span>
                      <strong>{{ approvalFlow().length }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Soportes</span>
                      <strong>{{ attachments().length }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Eventos</span>
                      <strong>{{ auditTrail().length }}</strong>
                    </div>
                    <div class="invoice-collection-kpi">
                      <span>Pendiente</span>
                      <strong>{{ pendingApproval() ? approvalActionLabel(pendingApproval()!.actionType) : 'No' }}</strong>
                    </div>
                  </div>

                  <div class="dw-fiscal-card">
                    <div class="dw-fiscal-row"><span>Flujo de aprobación</span><strong>{{ approvalFlow().length ? approvalStatusLabel(approvalFlow()[0].status) : 'Sin solicitudes' }}</strong></div>
                    <div class="dw-fiscal-row"><span>Última acción</span><strong>{{ approvalFlow().length ? approvalActionLabel(approvalFlow()[0].actionType) : '—' }}</strong></div>
                  </div>

                  @if (approvalFlow().length > 0) {
                    <div class="invoice-mini-list">
                      @for (item of approvalFlow().slice(0, 3); track item.id) {
                        <div class="invoice-mini-row">
                          <span>{{ approvalActionLabel(item.actionType) }} · {{ approvalStatusLabel(item.status) }} · {{ item.requestedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                          <strong>{{ item.requestedByName || 'Sistema' }}</strong>
                        </div>
                      }
                    </div>
                  }

                  @if (attachments().length > 0) {
                    <div class="invoice-mini-list">
                      @for (item of attachments().slice(0, 3); track item.id) {
                        <div class="invoice-mini-row">
                          <span>{{ item.fileName }} · {{ item.category || 'SOPORTE' }}</span>
                          <strong><a [href]="item.fileUrl" target="_blank" rel="noopener">Abrir</a></strong>
                        </div>
                      }
                    </div>
                  }

                  @if (auditTrail().length > 0) {
                    <div class="invoice-mini-list">
                      @for (item of auditTrail().slice(0, 4); track item.id) {
                        <div class="invoice-mini-row">
                          <span>{{ auditActionLabel(item.action) }} · {{ item.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                          <strong>{{ item.userName || 'Sistema' }}</strong>
                        </div>
                      }
                    </div>
                  }
                }
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
            <button class="btn btn-outline btn-sm" (click)="openPdfPreview(detailInvoice()!)" [disabled]="loadingPdf()">
              @if (loadingPdf()) { <span class="btn-spinner"></span> Generando... }
              @else {
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
                Vista previa
              }
            </button>
            @if (detailInvoice()!.dianCufe) {
              <button class="btn btn-outline btn-sm" (click)="downloadInvoiceZip(detailInvoice()!)" [disabled]="downloadingZip()">
                @if (downloadingZip()) { <span class="btn-spinner"></span> Descargando... }
                @else {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
                  Descargar ZIP
                }
              </button>
            }
            @if (detailInvoice()!.status === 'DRAFT') {
              <button class="btn btn-outline btn-sm" (click)="openApprovalRequestModal('ISSUE')">
                Solicitar aprobación emisión
              </button>
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
            @if (detailInvoice()!.status !== 'CANCELLED' && detailInvoice()!.status !== 'PAID' && detailInvoice()!.status !== 'ACCEPTED_DIAN') {
              <button class="btn btn-outline btn-sm" (click)="openApprovalRequestModal('CANCEL')">
                Solicitar aprobación anulación
              </button>
            }
            <button class="btn btn-outline btn-sm" (click)="openAttachmentModal()">
              Agregar soporte
            </button>
            @if (pendingApproval()) {
              <button class="btn btn-outline btn-sm" (click)="approvePendingApproval()">
                Aprobar {{ pendingApprovalActionLabel() }}
              </button>
              <button class="btn btn-outline btn-sm" (click)="rejectPendingApproval()">
                Rechazar {{ pendingApprovalActionLabel() }}
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
              <button class="btn btn-outline btn-sm" (click)="openPaymentModal(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v3H6a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V6z" clip-rule="evenodd"/></svg>
                Registrar pago
              </button>
              <button class="btn btn-outline btn-sm" (click)="openAgreementModal(detailInvoice()!)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v1a1 1 0 11-2 0V5H6v10h8v-1a1 1 0 112 0v1a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm7.293 2.293a1 1 0 011.414 0L16 10.586l-3.293 3.293a1 1 0 11-1.414-1.414L12.586 11H9a1 1 0 110-2h3.586l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                Acuerdo
              </button>
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
            <button class="btn btn-primary" (click)="downloadPdf(detailInvoice()!)" [disabled]="downloadingPdf() || !detailInvoice()">
              @if (downloadingPdf()) { <span class="btn-spinner"></span> Descargando... }
              @else { Descargar PDF }
            </button>
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
                <select [(ngModel)]="newInvoice.type" (ngModelChange)="onInvoiceChannelChanged()" class="form-control">
                  <option value="VENTA">Factura de venta</option>
                  <option value="NOTA_CREDITO">Nota crédito</option>
                  <option value="NOTA_DEBITO">Nota débito</option>
                </select>
              </div>
              <div class="form-group"><label>Prefijo *</label><input type="text" [(ngModel)]="newInvoice.prefix" class="form-control" placeholder="FV"/></div>
              <div class="form-group"><label>Fecha emisión *</label><input type="date" [(ngModel)]="newInvoice.issueDate" class="form-control"/></div>
              <div class="form-group"><label>Fecha vencimiento</label><input type="date" [(ngModel)]="newInvoice.dueDate" class="form-control"/></div>
            </div>
            <div class="form-row-3">
              <div class="form-group">
                <label>Canal *</label>
                <select [(ngModel)]="newInvoice.sourceChannel" (ngModelChange)="onInvoiceChannelChanged()" class="form-control">
                  <option value="DIRECT">Directo</option>
                  <option value="POS">POS</option>
                  <option value="ONLINE">Online</option>
                  <option value="WHOLESALE">Mayorista</option>
                </select>
              </div>
              <div class="form-group" style="grid-column: span 3;">
                <label>Configuración documental</label>
                <select [(ngModel)]="newInvoice.documentConfigId" (ngModelChange)="onDocumentConfigSelected($event)" class="form-control">
                  <option value="">Usar configuración automática</option>
                  @for (cfg of availableDocumentConfigs(); track cfg.id) {
                    <option [value]="cfg.id">{{ cfg.name }} · {{ cfg.prefix }} · {{ channelLabel(cfg.channel) }}</option>
                  }
                </select>
              </div>
            </div>
            @if (selectedDocumentConfig()) {
              <div class="document-config-banner">
                <div><span class="document-config-label">Prefijo</span><strong>{{ selectedDocumentConfig()!.prefix }}</strong></div>
                <div><span class="document-config-label">Resolución</span><strong>{{ selectedDocumentConfig()!.resolutionNumber || '—' }}</strong></div>
                <div><span class="document-config-label">Rango</span><strong>{{ formatRange(selectedDocumentConfig()!.rangeFrom, selectedDocumentConfig()!.rangeTo) }}</strong></div>
                <div><span class="document-config-label">Ámbito</span><strong>{{ documentConfigScope(selectedDocumentConfig()!) }}</strong></div>
              </div>
            }
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

    @if (showConfigModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Configuración documental</h3>
            <button class="modal-close" (click)="closeConfigModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="document-admin-layout">
              <div class="document-admin-list">
                @if (documentConfigs().length === 0) {
                  <div class="empty-state compact-empty">
                    <p>No hay configuraciones documentales registradas.</p>
                  </div>
                } @else {
                  @for (cfg of documentConfigs(); track cfg.id) {
                    <button type="button" class="document-admin-item" [class.document-admin-item-active]="editingDocumentConfigId === cfg.id" (click)="editDocumentConfig(cfg)">
                      <strong>{{ cfg.name }}</strong>
                      <span>{{ cfg.prefix }} · {{ channelLabel(cfg.channel) }}</span>
                      <small>{{ documentConfigScope(cfg) }}</small>
                    </button>
                  }
                }
              </div>
              <div class="document-admin-form">
                <div class="form-row-3">
                  <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" [(ngModel)]="documentConfigForm.name" class="form-control" placeholder="Resolución principal"/>
                  </div>
                  <div class="form-group">
                    <label>Canal *</label>
                    <select [(ngModel)]="documentConfigForm.channel" (ngModelChange)="onDocumentConfigChannelChanged($event)" class="form-control">
                      <option value="DIRECT">Directo</option>
                      <option value="POS">POS</option>
                      <option value="ONLINE">Online</option>
                      <option value="WHOLESALE">Mayorista</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Tipo *</label>
                    <select [(ngModel)]="documentConfigForm.type" class="form-control">
                      <option value="VENTA">{{ documentConfigForm.channel === 'POS' ? 'Factura POS electrónica' : 'Factura venta' }}</option>
                      <option value="NOTA_CREDITO">Nota crédito</option>
                      <option value="NOTA_DEBITO">Nota débito</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Prefijo *</label>
                    <input type="text" [(ngModel)]="documentConfigForm.prefix" class="form-control" placeholder="FV"/>
                  </div>
                </div>
                <div class="form-row-3">
                  <div class="form-group">
                    <label>Resolución</label>
                    <input type="text" [(ngModel)]="documentConfigForm.resolutionNumber" class="form-control" placeholder="18760000001"/>
                  </div>
                  <div class="form-group">
                    <label>Etiqueta</label>
                    <input type="text" [(ngModel)]="documentConfigForm.resolutionLabel" class="form-control" placeholder="Resolución principal"/>
                  </div>
                  <div class="form-group">
                    <label>Clave técnica</label>
                    <input type="text" [(ngModel)]="documentConfigForm.technicalKey" class="form-control" placeholder="Clave técnica DIAN"/>
                  </div>
                </div>
                <div class="form-row-3">
                  <div class="form-group">
                    <label>Rango desde</label>
                    <input type="number" [(ngModel)]="documentConfigForm.rangeFrom" class="form-control" min="1"/>
                  </div>
                  <div class="form-group">
                    <label>Rango hasta</label>
                    <input type="number" [(ngModel)]="documentConfigForm.rangeTo" class="form-control" min="1"/>
                  </div>
                </div>
                <div class="form-row-3">
                  <div class="form-group">
                    <label>Vigencia desde</label>
                    <input type="date" [(ngModel)]="documentConfigForm.validFrom" class="form-control"/>
                  </div>
                  <div class="form-group">
                    <label>Vigencia hasta</label>
                    <input type="date" [(ngModel)]="documentConfigForm.validTo" class="form-control"/>
                  </div>
                  <div class="form-group">
                    <label>Sucursal</label>
                    <select [(ngModel)]="documentConfigForm.branchId" (ngModelChange)="onDocumentConfigBranchChanged($event)" class="form-control">
                      <option value="">Empresa completa</option>
                      @for (branch of branches(); track branch.id) {
                        <option [value]="branch.id">{{ branch.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Caja / terminal</label>
                    <select [(ngModel)]="documentConfigForm.posTerminalId" class="form-control" [disabled]="documentConfigForm.channel !== 'POS'">
                      <option value="">Todas las cajas</option>
                      @for (terminal of availableDocumentConfigTerminals(); track terminal.id) {
                        <option [value]="terminal.id">{{ terminal.code }} · {{ terminal.name }}{{ terminal.branch?.name ? ' · ' + terminal.branch?.name : '' }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="form-row-3">
                  <label class="document-toggle">
                    <input type="checkbox" [(ngModel)]="documentConfigForm.isActive"/>
                    <span>Activa</span>
                  </label>
                  <label class="document-toggle">
                    <input type="checkbox" [(ngModel)]="documentConfigForm.isDefault"/>
                    <span>Predeterminada</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="resetDocumentConfigForm()">Nueva configuración</button>
            <button class="btn btn-outline" (click)="closeConfigModal()">Cerrar</button>
            <button class="btn btn-primary" [disabled]="savingConfig()" (click)="saveDocumentConfig()">
              {{ savingConfig() ? 'Guardando...' : (editingDocumentConfigId ? 'Actualizar' : 'Crear configuración') }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showCommercialFlowModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Flujo comercial multipaso</h3>
            <button class="modal-close" (click)="closeCommercialFlowModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="invoice-collection-grid" style="margin-bottom:16px">
              @for (kpi of commercialFlowKpis(); track kpi.label) {
                <div class="invoice-collection-kpi">
                  <span>{{ kpi.label }}</span>
                  <strong>{{ kpi.value }}</strong>
                </div>
              }
            </div>
            <div class="commercial-flow-layout">
              <div class="commercial-flow-panel commercial-flow-panel--primary">
                <div class="commercial-flow-title">Centro operativo</div>
                <div class="commercial-flow-form-section">
                  <h4>Operación base</h4>
                  <div class="form-group" style="margin-bottom:0">
                    <label>Operación</label>
                    <select [(ngModel)]="commercialFlowMode" class="form-control">
                      <option value="order">Crear pedido</option>
                      <option value="delivery">Crear remisión</option>
                      <option value="invoice">Facturar origen</option>
                    </select>
                  </div>
                  <div class="invoice-inline-banner" style="margin:12px 0 0">
                    {{ commercialFlowInventoryHint() }}
                  </div>
                </div>
                <div class="commercial-flow-form-section">
                  <h4>Fuentes comerciales</h4>
                  <div class="commercial-flow-form-grid">
                  <div class="form-group">
                    <label>Cotización origen</label>
                    <div class="source-picker">
                      <input
                        type="text"
                        [(ngModel)]="commercialSourceSearch.quote"
                        (ngModelChange)="onCommercialSourceSearchChanged('quote', $event)"
                        class="form-control"
                        placeholder="Busca por número, cliente o documento"
                      />
                      <select
                        [(ngModel)]="commercialFlowForm.quoteId"
                        (ngModelChange)="onQuoteOptionSelected($event)"
                        class="form-control"
                      >
                        <option value="">Sin cotización</option>
                        @for (quote of quoteOptions(); track quote.id) {
                          <option [value]="quote.id">
                            {{ quote.number }} · {{ quote.customerName }} · {{ fmtCOP(quote.total) }}
                          </option>
                        }
                      </select>
                      <small class="source-picker__hint">
                        @if (selectedQuoteOption()) {
                          <strong>{{ selectedQuoteOption()!.number }}</strong> · {{ selectedQuoteOption()!.customerName }}
                        } @else {
                          Busca la cotización por cliente o número comercial.
                        }
                      </small>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Venta POS origen</label>
                    <div class="source-picker">
                      <input
                        type="text"
                        [(ngModel)]="commercialSourceSearch.posSale"
                        (ngModelChange)="onCommercialSourceSearchChanged('posSale', $event)"
                        class="form-control"
                        placeholder="Busca por venta, cliente o canal POS"
                      />
                      <select
                        [(ngModel)]="commercialFlowForm.posSaleId"
                        (ngModelChange)="onPosSaleOptionSelected($event)"
                        class="form-control"
                      >
                        <option value="">Sin venta POS</option>
                        @for (sale of posSaleOptions(); track sale.id) {
                          <option [value]="sale.id">
                            {{ sale.saleNumber }} · {{ sale.customerName }} · {{ fmtCOP(sale.total) }}
                          </option>
                        }
                      </select>
                      <small class="source-picker__hint">
                        @if (selectedPosSaleOption()) {
                          <strong>{{ selectedPosSaleOption()!.saleNumber }}</strong> · {{ selectedPosSaleOption()!.customerName }}
                        } @else {
                          Busca la venta POS por número de venta o nombre del cliente.
                        }
                      </small>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Pedido comercial</label>
                    <div class="source-picker">
                      <input
                        type="text"
                        [(ngModel)]="commercialSourceSearch.salesOrder"
                        (ngModelChange)="onCommercialSourceSearchChanged('salesOrder', $event)"
                        class="form-control"
                        placeholder="Busca por pedido, cliente o estado"
                      />
                      <select
                        [(ngModel)]="commercialFlowForm.salesOrderId"
                        (ngModelChange)="onSalesOrderSelected($event)"
                        class="form-control"
                      >
                        <option value="">Sin pedido</option>
                        @for (order of salesOrders(); track order.id) {
                          <option [value]="order.id">
                            {{ order.number }} · {{ order.customerName }} · {{ fmtCOP(order.total) }}
                          </option>
                        }
                      </select>
                      <small class="source-picker__hint">
                        @if (selectedSalesOrderOption()) {
                          <strong>{{ selectedSalesOrderOption()!.number }}</strong> · {{ selectedSalesOrderOption()!.customerName }}
                        } @else {
                          Selecciona un pedido para remisionar o facturar parcialmente.
                        }
                      </small>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Remisión</label>
                    <div class="source-picker">
                      <input
                        type="text"
                        [(ngModel)]="commercialSourceSearch.deliveryNote"
                        (ngModelChange)="onCommercialSourceSearchChanged('deliveryNote', $event)"
                        class="form-control"
                        placeholder="Busca por remisión, cliente o estado"
                      />
                      <select
                        [(ngModel)]="commercialFlowForm.deliveryNoteId"
                        (ngModelChange)="onDeliveryNoteSelected($event)"
                        class="form-control"
                      >
                        <option value="">Sin remisión</option>
                        @for (note of deliveryNotes(); track note.id) {
                          <option [value]="note.id">
                            {{ note.number }} · {{ note.customerName }} · {{ fmtCOP(note.total) }}
                          </option>
                        }
                      </select>
                      <small class="source-picker__hint">
                        @if (selectedDeliveryNoteOption()) {
                          <strong>{{ selectedDeliveryNoteOption()!.number }}</strong> · {{ selectedDeliveryNoteOption()!.customerName }}
                        } @else {
                          Selecciona la remisión cuando la factura deba salir desde entrega previa.
                        }
                      </small>
                    </div>
                  </div>
                  </div>
                </div>
                <div class="commercial-flow-form-section">
                  <h4>Datos del documento</h4>
                  <div class="commercial-flow-meta-grid">
                  <div class="form-group">
                    <label>Cliente</label>
                    <select [(ngModel)]="commercialFlowForm.customerId" class="form-control">
                      <option value="">Automático desde origen</option>
                      @for (c of customers(); track c.id) { <option [value]="c.id">{{ c.name }} — {{ c.documentNumber }}</option> }
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Fecha emisión</label>
                    <input type="date" [(ngModel)]="commercialFlowForm.issueDate" class="form-control"/>
                  </div>
                  <div class="form-group">
                    <label>Fecha vencimiento</label>
                    <input type="date" [(ngModel)]="commercialFlowForm.dueDate" class="form-control"/>
                  </div>
                  <div class="form-group">
                    <label class="document-toggle">
                      <input type="checkbox" [(ngModel)]="commercialFlowForm.applyAdvance"/>
                      <span>Aplicar anticipo POS</span>
                    </label>
                  </div>
                  </div>
                  <div class="form-group" style="margin:14px 0 0">
                    <label>Notas</label>
                    <textarea [(ngModel)]="commercialFlowForm.notes" class="form-control" rows="3" placeholder="Observaciones del flujo comercial..."></textarea>
                  </div>
                </div>
              </div>
              <div class="commercial-flow-panel">
                <div class="commercial-flow-title">Pedidos recientes</div>
                @if (salesOrders().length === 0) {
                  <div class="empty-state compact-empty"><p>No hay pedidos comerciales recientes.</p></div>
                } @else {
                  <div class="commercial-order-list">
                    @for (order of salesOrders(); track order.id) {
                      <button type="button" class="document-admin-item" (click)="useSalesOrder(order)">
                        <strong>{{ order.number }}</strong>
                        <span>{{ order.customerName }}</span>
                        <small>{{ order.status }} · {{ fmtCOP(order.total) }} · {{ order.itemsCount }} líneas</small>
                      </button>
                    }
                  </div>
                }
              </div>
              <div class="commercial-flow-panel">
                <div class="commercial-flow-title">Remisiones recientes</div>
                @if (deliveryNotes().length === 0) {
                  <div class="empty-state compact-empty"><p>No hay remisiones recientes disponibles.</p></div>
                } @else {
                  <div class="commercial-order-list">
                    @for (note of deliveryNotes(); track note.id) {
                      <button type="button" class="document-admin-item" (click)="useDeliveryNote(note)">
                        <strong>{{ note.number }}</strong>
                        <span>{{ note.customerName }}</span>
                        <small>{{ deliveryStatusLabel(note.status) }} · {{ inventoryStatusLabel(note.inventoryStatus) }} · {{ fmtCOP(note.total) }}</small>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeCommercialFlowModal()">Cerrar</button>
            <button class="btn btn-primary" [disabled]="savingFlow()" (click)="submitCommercialFlow()">
              {{ savingFlow() ? 'Procesando...' : commercialFlowActionLabel() }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showFiscalModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Fiscalidad empresarial Colombia</h3>
            <button class="modal-close" (click)="closeFiscalModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label>Desde</label>
                <input type="date" [(ngModel)]="fiscalFilters.dateFrom" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Hasta</label>
                <input type="date" [(ngModel)]="fiscalFilters.dateTo" class="form-control"/>
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-outline" style="width:100%" [disabled]="loadingFiscalReports()" (click)="loadFiscalReports()">
                  {{ loadingFiscalReports() ? 'Cargando...' : 'Actualizar reportes' }}
                </button>
              </div>
            </div>

            @if (fiscalSummaryReport()) {
              <div class="invoice-collection-grid">
                <div class="invoice-collection-kpi"><span>Base gravable</span><strong>{{ fmtCOP(fiscalSummaryReport()!.summary.taxableBase) }}</strong></div>
                <div class="invoice-collection-kpi"><span>IVA ventas</span><strong>{{ fmtCOP(fiscalSummaryReport()!.summary.iva) }}</strong></div>
                <div class="invoice-collection-kpi"><span>ReteFuente</span><strong>{{ fmtCOP(fiscalSummaryReport()!.summary.retefuente) }}</strong></div>
                <div class="invoice-collection-kpi"><span>ICA</span><strong>{{ fmtCOP(fiscalSummaryReport()!.summary.ica) }}</strong></div>
              </div>
            }

            <div class="dw-section" style="padding:0">
              <div class="dw-section-title">Libro IVA ventas</div>
              <div class="dw-card">
                @if (vatSalesBook().length === 0) {
                  <div class="dw-items-empty">No hay registros para el rango seleccionado.</div>
                } @else {
                  <div class="invoice-mini-list">
                    @for (row of vatSalesBook().slice(0, 8); track row.id) {
                      <div class="invoice-mini-row">
                        <span>{{ row.issueDate | date:'dd/MM/yyyy' }} · {{ row.prefix }}{{ row.invoiceNumber }} · {{ row.customerName }}</span>
                        <strong>{{ fmtCOP(row.iva) }}</strong>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="dw-section" style="padding:0">
              <div class="dw-section-title">Libro retenciones ventas</div>
              <div class="dw-card">
                @if (withholdingsBook().length === 0) {
                  <div class="dw-items-empty">No hay retenciones registradas para el rango seleccionado.</div>
                } @else {
                  <div class="invoice-mini-list">
                    @for (row of withholdingsBook().slice(0, 8); track row.id) {
                      <div class="invoice-mini-row">
                        <span>{{ row.issueDate | date:'dd/MM/yyyy' }} · {{ row.prefix }}{{ row.invoiceNumber }} · {{ row.customerName }}</span>
                        <strong>{{ fmtCOP(row.retefuente + row.ica) }}</strong>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="dw-section" style="padding:0">
              <div class="dw-section-title">Control de validación DIAN</div>
              <div class="dw-card">
                @if (dianValidationReport().length === 0) {
                  <div class="dw-items-empty">No hay documentos en el rango seleccionado.</div>
                } @else {
                  <div class="invoice-mini-list">
                    @for (row of dianValidationReport().slice(0, 8); track row.id) {
                      <div class="invoice-mini-row">
                        <span>{{ row.prefix }}{{ row.invoiceNumber }} · {{ row.customerName }} · {{ fiscalValidationLabel(row.fiscalValidationStatus) }}</span>
                        <strong>{{ row.dianStatusCode || row.dianStatus || 'Pendiente' }}</strong>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeFiscalModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showAnalyticsModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Analítica y gestión documental</h3>
            <button class="modal-close" (click)="closeAnalyticsModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label>Desde</label>
                <input type="date" [(ngModel)]="analyticsFilters.dateFrom" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Hasta</label>
                <input type="date" [(ngModel)]="analyticsFilters.dateTo" class="form-control"/>
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-outline" style="width:100%" [disabled]="loadingAnalytics()" (click)="loadAnalytics()">
                  {{ loadingAnalytics() ? 'Cargando...' : 'Actualizar analítica' }}
                </button>
              </div>
            </div>

            @if (invoiceAnalytics()) {
              <div class="invoice-collection-grid">
                <div class="invoice-collection-kpi"><span>Emitidas</span><strong>{{ invoiceAnalytics()!.kpis.issuedCount }}</strong></div>
                <div class="invoice-collection-kpi"><span>Rechazo DIAN</span><strong>{{ invoiceAnalytics()!.kpis.rejectionRate }}%</strong></div>
                <div class="invoice-collection-kpi"><span>Resp. promedio</span><strong>{{ invoiceAnalytics()!.kpis.avgResponseMinutes }} min</strong></div>
                <div class="invoice-collection-kpi"><span>Recaudo vs emitido</span><strong>{{ invoiceAnalytics()!.kpis.collectionRate }}%</strong></div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Pulso ejecutivo</div>
                <div class="dw-card dw-fiscal-card">
                  <div class="dw-fiscal-row"><span>Total emitido</span><strong>{{ fmtCOP(invoiceAnalytics()!.kpis.emittedAmount) }}</strong></div>
                  <div class="dw-fiscal-row"><span>Total recaudado</span><strong>{{ fmtCOP(invoiceAnalytics()!.kpis.collectedAmount) }}</strong></div>
                  <div class="dw-fiscal-row"><span>Pendientes DIAN</span><strong>{{ invoiceAnalytics()!.kpis.pendingDianCount }}</strong></div>
                  <div class="dw-fiscal-row"><span>Aceptadas</span><strong>{{ invoiceAnalytics()!.kpis.acceptedCount }}</strong></div>
                  <div class="dw-fiscal-row"><span>Soportes</span><strong>{{ invoiceAnalytics()!.documentControl.attachmentsCount }}</strong></div>
                  <div class="dw-fiscal-row"><span>Aprobaciones pendientes</span><strong>{{ invoiceAnalytics()!.documentControl.pendingApprovals }}</strong></div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Facturación por sede</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (row of invoiceAnalytics()!.byBranch.slice(0, 6); track row.key) {
                      <div class="invoice-mini-row">
                        <span>{{ row.key }} · {{ row.count }} docs · recaudo {{ row.collectionRate }}%</span>
                        <strong>{{ fmtCOP(row.emittedAmount) }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Facturación por canal</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (row of invoiceAnalytics()!.byChannel.slice(0, 6); track row.key) {
                      <div class="invoice-mini-row">
                        <span>{{ channelLabel(row.key) }} · {{ row.count }} docs · rechazo {{ row.rejectionRate }}%</span>
                        <strong>{{ fmtCOP(row.emittedAmount) }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Facturación por vendedor</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (row of invoiceAnalytics()!.bySeller.slice(0, 6); track row.key) {
                      <div class="invoice-mini-row">
                        <span>{{ row.key }} · {{ row.count }} docs · recaudo {{ row.collectionRate }}%</span>
                        <strong>{{ fmtCOP(row.emittedAmount) }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Códigos y respuesta DIAN</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (row of invoiceAnalytics()!.dian.topStatusCodes; track row.code) {
                      <div class="invoice-mini-row">
                        <span>{{ row.code }}</span>
                        <strong>{{ row.count }}</strong>
                      </div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="dw-items-empty">No hay datos analíticos para el rango seleccionado.</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeAnalyticsModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showOperationsModal()) {
      <div class="modal-overlay">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Resiliencia operativa e integraciones empresariales</h3>
            <button class="modal-close" (click)="closeOperationsModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="invoice-inline-banner">
              Monitorea cola DIAN, intake externo y reintentos masivos desde una sola vista operativa.
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label>Acción masiva</label>
                <select [(ngModel)]="operationsForm.actionType" class="form-control">
                  <option value="SEND_DIAN">Enviar a DIAN</option>
                  <option value="QUERY_DIAN_STATUS">Consultar estado DIAN</option>
                </select>
              </div>
              <div class="form-group">
                <label>Modo de reproceso</label>
                <select [(ngModel)]="operationsForm.scope" class="form-control">
                  <option value="AUTO">Automático según cola</option>
                  <option value="SELECTED">Facturas visibles seleccionadas</option>
                </select>
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-outline" style="width:100%" [disabled]="savingOperations()" (click)="queueBulkReprocess()">
                  {{ savingOperations() ? 'Procesando...' : 'Colar reproceso masivo' }}
                </button>
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label>Canal externo</label>
                <select [(ngModel)]="externalIntakeForm.channel" class="form-control">
                  <option value="ECOMMERCE">E-commerce</option>
                  <option value="MARKETPLACE">Marketplace</option>
                  <option value="POS">POS</option>
                  <option value="API">API</option>
                </select>
              </div>
              <div class="form-group">
                <label>Referencia externa</label>
                <input type="text" [(ngModel)]="externalIntakeForm.externalRef" class="form-control" placeholder="WEB-10024"/>
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn btn-primary" style="width:100%" [disabled]="savingOperations()" (click)="submitExternalIntake()">
                  Registrar intake externo
                </button>
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label>Cliente</label>
                <select [(ngModel)]="externalIntakeForm.customerId" class="form-control">
                  <option value="">Selecciona un cliente</option>
                  @for (customer of customers(); track customer.id) {
                    <option [value]="customer.id">{{ customer.name }} · {{ customer.documentNumber }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="externalIntakeForm.notes" class="form-control" placeholder="Pedido integrado desde canal externo"/>
              </div>
              <div class="form-group">
                <label>Auto procesar</label>
                <select [(ngModel)]="externalIntakeForm.autoProcess" class="form-control">
                  <option [ngValue]="true">Sí</option>
                  <option [ngValue]="false">No</option>
                </select>
              </div>
            </div>

            @if (operationsMonitor()) {
              <div class="invoice-collection-grid">
                <div class="invoice-collection-kpi"><span>Cola pendiente</span><strong>{{ operationsMonitor()!.queue.pending }}</strong></div>
                <div class="invoice-collection-kpi"><span>Fallidos</span><strong>{{ operationsMonitor()!.queue.failed }}</strong></div>
                <div class="invoice-collection-kpi"><span>Procesados</span><strong>{{ operationsMonitor()!.queue.success }}</strong></div>
                <div class="invoice-collection-kpi"><span>Intakes pendientes</span><strong>{{ operationsMonitor()!.externalIntakes.pending }}</strong></div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Cola técnica DIAN</div>
                <div class="dw-card">
                  <div class="form-row-3" style="margin-bottom:12px">
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn-outline" style="width:100%" [disabled]="loadingOperations() || savingOperations()" (click)="loadOperationsMonitor()">
                        {{ loadingOperations() ? 'Actualizando...' : 'Actualizar monitor' }}
                      </button>
                    </div>
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn-outline" style="width:100%" [disabled]="savingOperations()" (click)="processQueuedOperations()">
                        Ejecutar cola pendiente
                      </button>
                    </div>
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn-outline" style="width:100%" [disabled]="savingOperations() || !detailInvoice()" (click)="queueSingleReprocess('QUERY_DIAN_STATUS')">
                        Reprocesar factura abierta
                      </button>
                    </div>
                  </div>
                  <div class="invoice-mini-list">
                    @for (job of operationsMonitor()!.queue.recent.slice(0, 8); track job.id) {
                      <div class="invoice-mini-row">
                        <span>{{ dianActionLabel(job.actionType) }} · {{ job.invoice?.invoiceNumber || 'Sin factura' }} · {{ channelLabel(job.sourceChannel || job.invoice?.sourceChannel || 'DIRECT') }} · {{ job.branch?.name || 'Todas las sedes' }}</span>
                        <strong>{{ dianJobStatusLabel(job.status) }}</strong>
                      </div>
                    }
                    @if (operationsMonitor()!.queue.recent.length === 0) {
                      <div class="dw-items-empty">No hay movimientos recientes en la cola DIAN.</div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Canales externos e intake</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (intake of externalIntakes().slice(0, 8); track intake.id) {
                      <div class="invoice-mini-row">
                        <span>{{ intake.channel }} · {{ intake.externalRef }} · {{ intake.branch?.name || 'Empresa' }} · {{ intake.linkedInvoice?.invoiceNumber || 'Pendiente' }}</span>
                        <strong>{{ intake.status }}</strong>
                      </div>
                    }
                    @if (externalIntakes().length === 0) {
                      <div class="dw-items-empty">No hay intakes externos registrados.</div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Integración contable reciente</div>
                <div class="dw-card">
                  <div class="invoice-mini-list">
                    @for (integration of operationsMonitor()!.accounting.recent.slice(0, 6); track integration.id) {
                      <div class="invoice-mini-row">
                        <span>{{ integration.action }} · {{ integration.resourceId || 'Sin recurso' }}</span>
                        <strong>{{ integration.status }}</strong>
                      </div>
                    }
                    @if (operationsMonitor()!.accounting.recent.length === 0) {
                      <div class="dw-items-empty">No hay sincronizaciones contables recientes.</div>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="dw-items-empty">No hay información operativa disponible todavía.</div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="closeOperationsModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

    @if (showApprovalRequestModal()) {
      <div class="modal-overlay">
        <div class="modal modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Solicitar aprobación</h3>
            <button class="modal-close" (click)="closeApprovalRequestModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Acción</label>
              <select [(ngModel)]="approvalRequestForm.actionType" class="form-control">
                <option value="ISSUE">Emitir</option>
                <option value="CANCEL">Anular</option>
              </select>
            </div>
            <div class="form-group">
              <label>Motivo</label>
              <textarea [(ngModel)]="approvalRequestForm.reason" class="form-control" rows="3" placeholder="Motivo de la solicitud..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeApprovalRequestModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingApprovalRequest()" (click)="submitApprovalRequest()">
              {{ savingApprovalRequest() ? 'Enviando...' : 'Solicitar aprobación' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showAttachmentModal()) {
      <div class="modal-overlay">
        <div class="modal modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Agregar soporte</h3>
            <button class="modal-close" (click)="closeAttachmentModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="attachmentForm.fileName" class="form-control" placeholder="Soporte.pdf"/>
            </div>
            <div class="form-group">
              <label>URL *</label>
              <input type="text" [(ngModel)]="attachmentForm.fileUrl" class="form-control" placeholder="https://..."/>
            </div>
            <div class="form-row-3">
              <div class="form-group">
                <label>Categoría</label>
                <input type="text" [(ngModel)]="attachmentForm.category" class="form-control" placeholder="SOPORTE"/>
              </div>
              <div class="form-group">
                <label>MIME</label>
                <input type="text" [(ngModel)]="attachmentForm.mimeType" class="form-control" placeholder="application/pdf"/>
              </div>
              <div class="form-group">
                <label>Tamaño bytes</label>
                <input type="number" [(ngModel)]="attachmentForm.sizeBytes" class="form-control" min="0"/>
              </div>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="attachmentForm.notes" class="form-control" rows="2" placeholder="Descripción breve..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAttachmentModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingAttachment()" (click)="submitAttachment()">
              {{ savingAttachment() ? 'Guardando...' : 'Agregar soporte' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) {
      <div class="modal-overlay">
        <div class="modal modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Registrar pago parcial</h3>
            <button class="modal-close" (click)="closePaymentModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="balance-info">
              <span>Saldo actual: <strong>{{ fmtCOP(invoiceStatement()?.summary?.balance ?? detailInvoice()?.total ?? 0) }}</strong></span>
            </div>
            <div class="form-row-3">
              <div class="form-group">
                <label>Monto *</label>
                <input type="number" [(ngModel)]="paymentForm.amount" class="form-control" min="0.01" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" [(ngModel)]="paymentForm.paymentDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Medio *</label>
                <select [(ngModel)]="paymentForm.paymentMethod" class="form-control">
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="CONSIGNACION">Consignación</option>
                </select>
              </div>
            </div>
            <div class="form-row-3">
              <div class="form-group">
                <label>Referencia</label>
                <input type="text" [(ngModel)]="paymentForm.reference" class="form-control" placeholder="Transacción / recibo"/>
              </div>
              <div class="form-group" style="grid-column: span 2;">
                <label>Notas</label>
                <textarea [(ngModel)]="paymentForm.notes" class="form-control" rows="2" placeholder="Observaciones del recaudo..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePaymentModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingPayment()" (click)="submitPayment()">
              {{ savingPayment() ? 'Aplicando...' : 'Registrar pago' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showAgreementModal()) {
      <div class="modal-overlay">
        <div class="modal modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Crear acuerdo de pago</h3>
            <button class="modal-close" (click)="closeAgreementModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row-3">
              <div class="form-group">
                <label>Monto *</label>
                <input type="number" [(ngModel)]="agreementForm.amount" class="form-control" min="0.01" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Fecha prometida *</label>
                <input type="date" [(ngModel)]="agreementForm.promisedDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <textarea [(ngModel)]="agreementForm.notes" class="form-control" rows="2" placeholder="Detalle del acuerdo..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAgreementModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingAgreement()" (click)="submitAgreement()">
              {{ savingAgreement() ? 'Guardando...' : 'Crear acuerdo' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Modal Nota Crédito / Débito ─────────────────────────────── -->
    @if (noteModal() !== 'none') {
      <div class="modal-overlay">
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

          @if (noteContext()) {
            <div class="balance-info">
              <span>Líneas pendientes: <strong>{{ notePendingLinesCount() }}</strong></span>
              <span>Notas emitidas: <strong>{{ noteContext()!.notes.length }}</strong></span>
              <span>Cartera pendiente: <strong>{{ fmtCOP(noteContext()!.cartera.outstandingBalance) }}</strong></span>
            </div>
          }

          <div class="modal-body">

            <!-- Motivo -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Código de motivo DIAN *</label>
                <select [(ngModel)]="noteForm.discrepancyReasonCode" class="form-control">
                  @for (reason of noteReasonOptions(); track reason.code) {
                    <option [value]="reason.code">{{ reason.code }} – {{ reason.label }}</option>
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

            @if (noteContext() && noteModal() === 'credit') {
              <div class="dw-section" style="padding:0;margin-bottom:12px">
                <div class="note-lines-header">
                  <span class="form-label" style="margin:0">Reverso guiado desde la factura original</span>
                  <div style="display:flex; gap:8px; flex-wrap:wrap">
                    <button type="button" class="btn btn-sm btn-outline" (click)="loadPendingOriginalLines()">
                      Cargar líneas pendientes
                    </button>
                    <button type="button" class="btn btn-sm btn-outline" [disabled]="!noteContext()!.guidedActions.canFullCreditReverse" (click)="loadFullReverseNote()">
                      Reverso total guiado
                    </button>
                  </div>
                </div>
                <div class="document-admin-list" style="max-height:180px">
                  @for (line of noteContext()!.lines; track line.id) {
                    <button type="button" class="document-admin-item" (click)="addOriginalLineToNote(line)" [disabled]="line.remainingCreditQty <= 0.0001">
                      <strong>{{ line.description }}</strong>
                      <span>
                        Orig: {{ line.quantity }} · Pend.: {{ line.remainingCreditQty }} · {{ fmtCOP(line.remainingCreditAmount) }}
                      </span>
                      @if (line.product?.sku) {
                        <small>{{ line.product?.sku }}</small>
                      }
                    </button>
                  }
                </div>
              </div>
            }

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
    .page {
      max-width:1340px;
      padding:4px 0 24px;
    }
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .65fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(10, 201, 168, .16), transparent 28%),
        radial-gradient(circle at bottom right, rgba(59, 130, 246, .16), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0f7a72 100%);
      color:#fff;
      box-shadow:0 24px 48px rgba(12,28,53,.16);
    }
    .hero-main {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:18px;
    }
    .hero-copy { max-width:640px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#89f3d1;
    }
    .page-title {
      font-family:'Sora',sans-serif;
      font-size:32px;
      line-height:1.02;
      font-weight:800;
      letter-spacing:-.05em;
      color:#fff;
      margin:0 0 10px;
    }
    .page-subtitle {
      font-size:14px;
      line-height:1.6;
      color:rgba(236,244,255,.82);
      margin:0;
      max-width:60ch;
    }
    .hero-actions {
      display:flex;
      flex-wrap:wrap;
      justify-content:flex-end;
      gap:8px;
      align-items:center;
      flex-shrink:0;
    }
    .hero-aside {
      display:grid;
      gap:12px;
      align-content:start;
    }
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
      color:rgba(236,244,255,.72);
      font-size:12px;
      line-height:1.5;
    }
    .hero-summary-list {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:10px;
    }
    .hero-summary-pill {
      display:flex;
      align-items:center;
      gap:8px;
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.12);
      font-size:12px;
      font-weight:700;
      color:#f8fbff;
    }
    .dot {
      width:8px;
      height:8px;
      border-radius:999px;
      flex-shrink:0;
    }
    .dot-success { background:#34d399; box-shadow:0 0 0 4px rgba(52,211,153,.16); }
    .dot-warn { background:#fbbf24; box-shadow:0 0 0 4px rgba(251,191,36,.14); }
    .dot-danger { background:#fb7185; box-shadow:0 0 0 4px rgba(251,113,133,.14); }

    .tabs-shell {
      margin-bottom:18px;
      border-radius:28px;
      padding:20px;
      background:linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(247,251,255,.96) 100%);
      border:1px solid #dce6f0;
      box-shadow:0 20px 36px rgba(12,28,53,.06);
    }
    .tabs-shell__head {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:18px;
      margin-bottom:18px;
    }
    .tabs-shell__eyebrow {
      display:block;
      margin-bottom:6px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .tabs-shell__head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:22px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .tabs-shell__head p {
      margin:0;
      max-width:56ch;
      font-size:13px;
      line-height:1.6;
      color:#6b7f96;
      text-align:right;
    }
    .tabs-groups {
      display:grid;
      gap:16px;
    }
    .tab-group {
      padding:16px;
      border-radius:22px;
      border:1px solid #e3ecf5;
      background:linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(246,250,255,.95) 100%);
    }
    .tab-group--utility {
      background:linear-gradient(180deg, #f7fffc 0%, #effbf7 100%);
      border-color:#cfeee3;
    }
    .tab-group__header {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .tab-group__label {
      display:block;
      font-size:11px;
      font-weight:800;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:#1a407e;
      margin-bottom:4px;
    }
    .tab-group__header small {
      color:#7a8ea7;
      font-size:12px;
      line-height:1.5;
      text-align:right;
    }
    .tab-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
    }
    .tab-grid--compact {
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }
    .tab-btn {
      display:flex;
      align-items:flex-start;
      gap:12px;
      min-height:78px;
      width:100%;
      padding:16px;
      border-radius:18px;
      border:1px solid #dbe5ef;
      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      color:#0c1c35;
      cursor:pointer;
      text-align:left;
      transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
      box-shadow:0 12px 22px rgba(12,28,53,.05);
    }
    .tab-btn svg {
      width:20px;
      height:20px;
      flex-shrink:0;
      color:#1a407e;
      margin-top:2px;
      transition:color .18s ease, transform .18s ease;
    }
    .tab-btn__content {
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }
    .tab-btn__title {
      font-size:14px;
      font-weight:800;
      color:#0c1c35;
      letter-spacing:-.02em;
    }
    .tab-btn__meta {
      font-size:12px;
      line-height:1.5;
      color:#6f8399;
    }
    .tab-btn:hover {
      transform:translateY(-2px);
      border-color:#93c5fd;
      box-shadow:0 18px 30px rgba(26,64,126,.1);
      background:linear-gradient(180deg, #ffffff 0%, #eef6ff 100%);
    }
    .tab-btn:hover svg {
      color:#123f7b;
      transform:scale(1.05);
    }
    .tab-btn--active {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 24px 36px rgba(15,39,75,.24);
    }
    .tab-btn--active .tab-btn__title,
    .tab-btn--active .tab-btn__meta {
      color:#f8fbff;
    }
    .tab-btn--active svg { color:#dffef5; }
    .tab-btn--active .tab-btn__meta { color:rgba(236,244,255,.82); }
    .tab-btn--active:hover {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 28px 40px rgba(15,39,75,.28);
    }
    .tab-btn--utility {
      background:linear-gradient(180deg, #f7fffc 0%, #eefbf6 100%);
    }
    .tab-btn--utility.tab-btn--active,
    .tab-btn--utility.tab-btn--active:hover {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 24px 36px rgba(15,39,75,.24);
    }

    /* KPI strip */
    .kpi-strip {
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:14px;
      margin-bottom:18px;
    }
    .kpi-card {
      display:flex;
      align-items:flex-start;
      gap:14px;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      border-radius:20px;
      padding:16px 18px;
      box-shadow:0 16px 28px rgba(12,28,53,.05);
    }
    .kpi-icon {
      width:42px;
      height:42px;
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg, #e0efff, #eefaf7);
      color:#1a407e;
      flex-shrink:0;
    }
    .kpi-body { min-width:0; }
    .kpi-value { font-family:'Sora',sans-serif; font-size:22px; font-weight:800; color:#0c1c35; letter-spacing:-.05em; }
    .kpi-label { font-size:12px; color:#7a8ea7; margin-top:4px; }

    /* Filters */
    .filters-card {
      margin-bottom:18px;
      padding:18px;
      border-radius:24px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 16px 30px rgba(12,28,53,.05);
      backdrop-filter:blur(10px);
    }
    .filters-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .filters-kicker {
      margin:0 0 6px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .filters-head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .results-pill {
      padding:8px 12px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:12px;
      font-weight:700;
      white-space:nowrap;
    }
    .filters-bar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .search-wrap { flex:1; min-width:220px; max-width:320px; position:relative; }
    .search-wrap-wide { max-width:420px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input,
    .filter-select,
    .filter-date {
      min-height:42px;
      box-shadow:0 8px 20px rgba(12,28,53,.03);
    }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:12px; font-size:13.5px; outline:none; background:#fff; }
    .filter-date { padding:8px 10px; border:1px solid #dce6f0; border-radius:12px; font-size:13.5px; outline:none; color:#374151; background:#fff; }

    /* Table */
    .table-shell {
      border-radius:26px;
      background:rgba(255,255,255,.72);
      border:1px solid #dce6f0;
      box-shadow:0 18px 32px rgba(12,28,53,.05);
      overflow:hidden;
    }
    .table-shell-head {
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
    .table-kicker {
      margin:0 0 5px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .table-shell-head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .table-shell-meta {
      display:flex;
      gap:8px;
      align-items:center;
      flex-wrap:wrap;
    }
    .meta-chip {
      padding:7px 11px;
      border-radius:999px;
      background:#0f274b;
      color:#fff;
      font-size:11px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .meta-chip-soft {
      background:#edf5ff;
      color:#1a407e;
      border:1px solid #bfdbfe;
    }
    .table-card { background:#fff; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:14px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#f9fbff; }
    .inv-number { font-family:monospace; font-weight:800; color:#1a407e; cursor:pointer; font-size:13px; }
    .inv-number:hover { text-decoration:underline; }
    .cufe-badge { font-size:10px; color:#065f46; background:#d1fae5; padding:2px 7px; border-radius:999px; margin-top:5px; display:inline-block; font-weight:700; }
    .client-name { display:block; font-weight:600; color:#0c1c35; font-size:13.5px; }
    .client-doc { font-size:11.5px; color:#9ca3af; margin-top:3px; }
    .text-muted { color:#9ca3af; }
    .overdue-cell { color:#dc2626; font-weight:600; }
    .inv-total { color:#0c1c35; }
    .type-badge { padding:4px 9px; border-radius:999px; font-size:11px; font-weight:800; }
    .type-venta { background:#dbeafe; color:#1e40af; }
    .type-nota_credito { background:#fce7f3; color:#9d174d; }
    .type-nota_debito { background:#fef3c7; color:#92400e; }
    .dian-badge { padding:4px 8px; border-radius:999px; font-size:10.5px; font-weight:800; }
    .dian-pendiente,.dian-undefined,.dian-pending { background:#f3f4f6; color:#6b7280; }
    .dian-aceptado,.dian-accepted_dian { background:#d1fae5; color:#065f46; }
    .dian-rechazado,.dian-rejected_dian { background:#fee2e2; color:#991b1b; }
    .dian-sent,.dian-enviada,.dian-issued { background:#dbeafe; color:#1e40af; }
    .dian-error { background:#fee2e2; color:#991b1b; }
    .status-pill { padding:4px 10px; border-radius:9999px; font-size:11px; font-weight:800; white-space:nowrap; }
    .status-draft { background:#f3f4f6; color:#6b7280; }
    .status-sent_dian,.status-issued { background:#dbeafe; color:#1e40af; }
    .status-accepted_dian { background:#d1fae5; color:#065f46; }
    .status-rejected_dian { background:#fee2e2; color:#991b1b; }
    .status-paid { background:#d1fae5; color:#065f46; }
    .status-overdue { background:#fee2e2; color:#991b1b; }
    .status-cancelled { background:#f3f4f6; color:#6b7280; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#8ca0b7; transition:all .15s; display:inline-flex; align-items:center; box-shadow:0 6px 16px rgba(12,28,53,.03); }
    .btn-icon:hover:not(:disabled) { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
    .btn-icon:disabled { opacity:.4; cursor:default; }
    .btn-icon-success:hover:not(:disabled) { background:#d1fae5; color:#065f46; }
    .btn-icon-blue:hover:not(:disabled) { background:#dbeafe; color:#1e40af; }
    .btn-icon-nc:hover:not(:disabled) { background:#fce7f3; color:#9d174d; }
    .btn-icon-nd:hover:not(:disabled) { background:#fef3c7; color:#92400e; }
    /* View toggle */
    .view-toggle { display:flex; border:1px solid rgba(255,255,255,.18); border-radius:12px; overflow:hidden; background:rgba(255,255,255,.1); backdrop-filter:blur(8px); }
    .view-btn { background:transparent; border:none; padding:9px 12px; cursor:pointer; color:rgba(236,244,255,.74); transition:all .15s; display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:700; }
    .view-btn:hover { background:rgba(255,255,255,.1); color:#fff; }
    .view-btn-active { background:#fff; color:#123f7b !important; }
    .view-toggle--surface {
      border-color:#dce6f0;
      background:#f8fbff;
      backdrop-filter:none;
      box-shadow:0 8px 18px rgba(12,28,53,.04);
    }
    .view-btn--surface {
      color:#5b7088;
    }
    .view-btn--surface:hover {
      background:#eef6ff;
      color:#123f7b;
    }
    /* Grid view */
    .inv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; padding:0; }
    .inv-card { background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; border-radius:20px; padding:18px; cursor:pointer; transition:box-shadow .16s,border-color .16s, transform .16s; display:flex; flex-direction:column; gap:10px; box-shadow:0 12px 26px rgba(12,28,53,.04); }
    .inv-card:hover { border-color:#93c5fd; box-shadow:0 18px 32px rgba(26,64,126,.1); transform:translateY(-3px); }
    .inv-card-top { display:flex; align-items:center; justify-content:space-between; }
    .inv-card-number { font-family:monospace; font-weight:800; color:#1a407e; font-size:14px; }
    .inv-card-type { display:flex; align-items:center; gap:6px; }
    .inv-card-client { font-weight:700; color:#0c1c35; font-size:14px; }
    .inv-card-doc { font-size:11.5px; color:#9ca3af; }
    .inv-card-total { font-size:18px; font-weight:800; color:#0c1c35; font-family:'Sora',sans-serif; }
    .inv-card-meta { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:#9ca3af; }
    .inv-card-actions { display:flex; gap:6px; padding-top:8px; border-top:1px solid #f0f4f8; }
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-top:1px solid #f0f4f8; background:#fbfdff; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:6px 10px; border:1px solid #dce6f0; border-radius:10px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:34px; box-shadow:0 6px 16px rgba(12,28,53,.03); }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }
    .empty-state { padding:72px 24px; text-align:center; color:#9ca3af; }
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
    .dw-fiscal-card { display:grid; gap:8px; }
    .dw-fiscal-row { display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12.5px; color:#475569; }
    .dw-fiscal-row strong { color:#0c1c35; text-align:right; }
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
    .drawer-footer {
      padding:14px 22px;
      border-top:1px solid #f0f4f8;
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:10px;
      flex-shrink:0;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
    }
    .drawer-footer .btn {
      width:100%;
      min-height:40px;
      justify-content:center;
      text-align:center;
      white-space:normal;
      line-height:1.25;
      padding-inline:12px;
      box-shadow:0 8px 18px rgba(12,28,53,.04);
    }
    .drawer-footer .btn svg { flex-shrink:0; }

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
    .document-config-banner {
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:10px;
      margin:0 0 14px;
      padding:12px 14px;
      border-radius:14px;
      background:#f6fbff;
      border:1px solid #d7e7f8;
    }
    .document-config-banner > div {
      display:flex;
      flex-direction:column;
      gap:3px;
    }
    .document-config-label {
      font-size:10px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#7a8ea7;
    }
    .document-config-banner strong {
      color:#123f7b;
      font-size:13px;
    }
    .document-admin-layout {
      display:grid;
      grid-template-columns:280px 1fr;
      gap:18px;
    }
    .commercial-flow-layout {
      display:grid;
      grid-template-columns:1.15fr .85fr .85fr;
      gap:18px;
    }
    .commercial-flow-panel {
      border:1px solid #dce6f0;
      border-radius:18px;
      background:#fbfdff;
      padding:16px;
    }
    .commercial-flow-panel--primary {
      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow:0 16px 32px rgba(26,64,126,.06);
    }
    .commercial-flow-title {
      font-family:'Sora',sans-serif;
      font-size:15px;
      font-weight:700;
      color:#0c1c35;
      margin-bottom:12px;
    }
    .commercial-flow-form-section {
      border:1px solid #e5eef8;
      border-radius:16px;
      background:#fff;
      padding:14px;
      margin-bottom:14px;
    }
    .commercial-flow-form-section:last-child {
      margin-bottom:0;
    }
    .commercial-flow-form-section h4 {
      margin:0 0 10px;
      font-size:12px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#6b7f96;
    }
    .commercial-flow-form-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:14px;
    }
    .commercial-flow-meta-grid {
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:14px;
    }
    .commercial-order-list {
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height:420px;
      overflow:auto;
      padding-right:4px;
    }
    .document-admin-list {
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .document-admin-item {
      text-align:left;
      border:1px solid #dce6f0;
      background:#fff;
      border-radius:14px;
      padding:12px 14px;
      display:flex;
      flex-direction:column;
      gap:4px;
      cursor:pointer;
      transition:all .15s;
    }
    .document-admin-item:hover,
    .document-admin-item-active {
      border-color:#93c5fd;
      background:#f8fbff;
      box-shadow:0 10px 22px rgba(26,64,126,.08);
    }
    .document-admin-item strong { color:#0c1c35; font-size:13px; }
    .document-admin-item span { color:#1a407e; font-size:12px; font-weight:700; }
    .document-admin-item small { color:#7a8ea7; font-size:11px; }
    .document-toggle {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding-top:8px;
      font-size:13px;
      font-weight:600;
      color:#374151;
    }
    .compact-empty { padding:24px 16px; border:1px dashed #dce6f0; border-radius:14px; background:#fbfdff; }

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
    @media (max-width:1024px) {
      .hero-shell {
        grid-template-columns:1fr;
      }
      .hero-main {
        flex-direction:column;
      }
      .hero-actions {
        justify-content:flex-start;
      }
      .hero-summary-list {
        grid-template-columns:repeat(3, minmax(0, 1fr));
      }
      .tabs-shell__head {
        flex-direction:column;
        align-items:flex-start;
      }
      .tabs-shell__head p {
        text-align:left;
      }
      .tab-grid {
        grid-template-columns:repeat(2, minmax(0, 1fr));
      }
      .kpi-strip {
        grid-template-columns:repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width:768px) {
      .hero-shell {
        padding:18px;
        border-radius:24px;
      }
      .page-title {
        font-size:26px;
      }
      .tabs-shell {
        padding:18px;
        border-radius:24px;
      }
      .filters-card,
      .table-shell-head {
        padding-left:16px;
        padding-right:16px;
      }
      .filters-head,
      .table-shell-head {
        flex-direction:column;
        align-items:flex-start;
      }
      .results-pill,
      .table-shell-meta {
        align-self:flex-start;
      }
      .kpi-strip { grid-template-columns:1fr 1fr; }
      .tab-group {
        padding:14px;
        border-radius:18px;
      }
      .tab-grid,
      .tab-grid--compact {
        grid-template-columns:1fr;
      }
      .modal-invoice { max-width:100% !important; }
      .modal-body { padding:16px 18px; } .modal-header { padding:14px 18px; } .modal-footer { padding:12px 18px; gap:8px; }
      .form-row-3 { grid-template-columns:1fr 1fr !important; gap:10px; }
      .document-config-banner,
      .document-admin-layout,
      .commercial-flow-layout { grid-template-columns:1fr; }
      .commercial-flow-form-grid,
      .commercial-flow-meta-grid { grid-template-columns:1fr; }
      .drawer-footer { grid-template-columns:1fr; }
    }
    @media (max-width:600px) {
      .hero-shell {
        padding:16px;
        gap:14px;
      }
      .hero-actions {
        width:100%;
      }
      .hero-actions .btn,
      .hero-actions .view-toggle {
        width:100%;
      }
      .tabs-shell {
        padding:16px;
      }
      .view-toggle {
        justify-content:stretch;
      }
      .view-btn {
        flex:1;
        justify-content:center;
      }
      .hero-summary-list,
      .kpi-strip {
        grid-template-columns:1fr;
      }
      .filters-bar {
        flex-direction:column;
        align-items:stretch;
      }
      .search-wrap,
      .search-wrap-wide {
        max-width:none;
      }
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
    .invoice-collection-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
    .invoice-collection-kpi { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; background:#f8fafc; display:flex; flex-direction:column; gap:4px; }
    .invoice-collection-kpi span { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; }
    .invoice-collection-kpi strong { font-size:15px; color:#0f172a; }
    .invoice-inline-banner { margin-bottom:12px; padding:10px 12px; border-radius:10px; background:#eff6ff; color:#1d4ed8; font-size:12.5px; font-weight:600; }
    .invoice-mini-list { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
    .invoice-mini-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 10px; border-radius:8px; background:#f8fafc; font-size:12.5px; color:#475569; }
    .source-picker { display:flex; flex-direction:column; gap:8px; }
    .source-picker__hint { font-size:12px; color:#64748b; line-height:1.4; }
    .source-picker__hint strong { color:#0f172a; }
    .note-guided-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:11px; font-weight:700; }
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
  private readonly PROD_API = `${environment.apiUrl}/invoices/products`;
  private readonly COMP_API = `${environment.apiUrl}/companies/me`;
  private readonly BRANCHES_API = `${environment.apiUrl}/branches`;
  private readonly DOC_CFG_API = `${environment.apiUrl}/invoices/document-configs`;
  private readonly POS_TERMINALS_API = `${environment.apiUrl}/pos/terminals`;
  private readonly QUOTE_API = `${environment.apiUrl}/quotes`;
  private readonly POS_SALES_API = `${environment.apiUrl}/pos/sales`;
  private readonly ORDER_API = `${environment.apiUrl}/invoices/sales-orders`;
  private readonly DELIVERY_API = `${environment.apiUrl}/invoices/delivery-notes`;
  private readonly DELIVERY_LIST_API = `${environment.apiUrl}/invoices/delivery-notes`;
  private readonly SOURCE_INVOICE_API = `${environment.apiUrl}/invoices/from-source`;
  private readonly PAYMENT_API = (invoiceId: string) => `${this.API}/${invoiceId}/payments`;
  private readonly AGREEMENT_API = (invoiceId: string) => `${this.API}/${invoiceId}/payment-agreements`;
  private readonly STATEMENT_API = (invoiceId: string) => `${this.API}/${invoiceId}/statement`;
  private readonly NOTE_CONTEXT_API = (invoiceId: string) => `${this.API}/${invoiceId}/note-context`;
  private readonly APPROVAL_FLOW_API = (invoiceId: string) => `${this.API}/${invoiceId}/approval-flow`;
  private readonly REQUEST_APPROVAL_API = (invoiceId: string) => `${this.API}/${invoiceId}/request-approval`;
  private readonly APPROVE_APPROVAL_API = (invoiceId: string) => `${this.API}/${invoiceId}/approve-approval`;
  private readonly REJECT_APPROVAL_API = (invoiceId: string) => `${this.API}/${invoiceId}/reject-approval`;
  private readonly ATTACHMENTS_API = (invoiceId: string) => `${this.API}/${invoiceId}/attachments`;
  private readonly AUDIT_API = (invoiceId: string) => `${this.API}/${invoiceId}/audit-trail`;
  private readonly FISCAL_SUMMARY_API = `${this.API}/reports/fiscal-summary`;
  private readonly VAT_SALES_BOOK_API = `${this.API}/reports/vat-sales-book`;
  private readonly WITHHOLDINGS_BOOK_API = `${this.API}/reports/withholdings-book`;
  private readonly DIAN_VALIDATION_REPORT_API = `${this.API}/reports/dian-validation`;
  private readonly ANALYTICS_SUMMARY_API = `${this.API}/analytics/summary`;
  private readonly OPERATIONS_MONITOR_API = `${this.API}/operations/monitor`;
  private readonly PROCESS_QUEUE_API = `${this.API}/operations/process-queue`;
  private readonly BULK_REPROCESS_API = `${this.API}/operations/reprocess`;
  private readonly EXTERNAL_INTAKES_API = `${this.API}/external-intakes`;
  private readonly QUEUE_REPROCESS_API = (invoiceId: string) => `${this.API}/${invoiceId}/queue-reprocess`;

  companyPrefix = signal('FV');

  invoices     = signal<Invoice[]>([]);
  customers    = signal<Customer[]>([]);
  lineProducts = signal<Product[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  savingConfig = signal(false);
  savingFlow   = signal(false);
  savingEdit   = signal(false);
  savingPayment = signal(false);
  savingAgreement = signal(false);
  total        = signal(0);
  page         = signal(1);
  totalPages   = signal(1);

  detailInvoice = signal<Invoice | null>(null);
  showModal     = signal(false);
  showConfigModal = signal(false);
  showCommercialFlowModal = signal(false);
  showPaymentModal = signal(false);
  showAgreementModal = signal(false);
  showFiscalModal = signal(false);
  showAnalyticsModal = signal(false);
  showOperationsModal = signal(false);
  focusedInvoiceAction = signal<'refresh' | 'config' | 'flow' | 'fiscal' | 'analytics' | 'operations' | 'new'>('refresh');
  viewMode      = signal<'table' | 'grid'>('table');
  showPdfModal  = signal(false);
  showEditModal = signal(false);
  pdfUrl        = signal<SafeResourceUrl | null>(null);
  objectUrl: string | null = null;
  loadingPdf    = signal(false);
  downloadingPdf = signal(false);
  downloadingZip = signal(false);

  // DIAN async state tracking
  sending  = signal<Record<string, boolean>>({});
  querying = signal<Record<string, boolean>>({});
  documentConfigs = signal<InvoiceDocumentConfig[]>([]);
  branches = signal<BranchOption[]>([]);
  posTerminals = signal<PosTerminalOption[]>([]);
  quoteOptions = signal<QuoteFlowSummary[]>([]);
  posSaleOptions = signal<PosSaleFlowSummary[]>([]);
  salesOrders = signal<SalesOrderSummary[]>([]);
  deliveryNotes = signal<DeliveryNoteSummary[]>([]);
  invoiceStatement = signal<InvoiceStatement | null>(null);
  loadingStatement = signal(false);
  noteContext = signal<InvoiceNoteContext | null>(null);
  approvalFlow = signal<InvoiceApproval[]>([]);
  attachments = signal<InvoiceAttachment[]>([]);
  auditTrail = signal<InvoiceAuditEntry[]>([]);
  loadingGovernance = signal(false);
  showApprovalRequestModal = signal(false);
  showAttachmentModal = signal(false);
  savingApprovalRequest = signal(false);
  savingAttachment = signal(false);
  loadingFiscalReports = signal(false);
  loadingAnalytics = signal(false);
  loadingOperations = signal(false);
  savingOperations = signal(false);
  fiscalSummaryReport = signal<InvoiceFiscalSummaryReport | null>(null);
  vatSalesBook = signal<InvoiceVatSalesBookRow[]>([]);
  withholdingsBook = signal<InvoiceWithholdingsBookRow[]>([]);
  dianValidationReport = signal<InvoiceDianValidationRow[]>([]);
  invoiceAnalytics = signal<InvoiceAnalyticsSummary | null>(null);
  operationsMonitor = signal<InvoiceOperationalMonitor | null>(null);
  externalIntakes = signal<InvoiceExternalIntake[]>([]);

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
  newInvoice = { type:'VENTA', prefix:'FV', issueDate:new Date().toISOString().slice(0,10), dueDate:'', customerId:'', notes:'', documentConfigId:'', sourceChannel:'DIRECT' };
  // prefix se sobreescribe en openNewInvoice() con el valor real de la empresa
  editingDocumentConfigId: string | null = null;
  documentConfigForm = this.emptyDocumentConfigForm();
  commercialFlowMode: 'order' | 'delivery' | 'invoice' = 'order';
  commercialFlowForm = this.emptyCommercialFlowForm();
  commercialSourceSearch = this.emptyCommercialSourceSearch();
  paymentForm = this.emptyPaymentForm();
  agreementForm = this.emptyAgreementForm();
  approvalRequestForm = this.emptyApprovalRequestForm();
  attachmentForm = this.emptyAttachmentForm();
  fiscalFilters = this.emptyFiscalFilters();
  analyticsFilters = this.emptyFiscalFilters();
  operationsForm = this.emptyOperationsForm();
  externalIntakeForm = this.emptyExternalIntakeForm();

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

  ngOnInit() {
    this.load();
    this.loadCustomers();
    this.loadProducts();
    this.loadCompanyPrefix();
    this.loadDocumentConfigs();
    this.loadBranches();
    this.loadPosTerminals();
  }

  loadCompanyPrefix() {
    this.http.get<any>(this.COMP_API).subscribe({
      next: r => {
        const prefix = (r?.data ?? r)?.dianPrefijo;
        if (prefix) {
          this.companyPrefix.set(prefix);
          if (!this.documentConfigForm.prefix) {
            this.documentConfigForm = { ...this.documentConfigForm, prefix };
          }
        }
      },
      error: () => {},
    });
  }

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

  acceptedCount() { return this.invoices().filter(i => i.status === 'ACCEPTED_DIAN' || i.status === 'PAID').length; }
  pendingCount()  { return this.invoices().filter(i => ['DRAFT', 'SENT_DIAN', 'ISSUED'].includes(i.status)).length; }
  rejectedCount() { return this.invoices().filter(i => i.status === 'REJECTED_DIAN').length; }

  loadCustomers() { this.http.get<any>(`${this.CUST_API}?limit=200`).subscribe({ next: r => this.customers.set(r.data ?? r), error: ()=>{} }); }
  loadProducts()  { this.http.get<any>(`${this.PROD_API}?limit=100&status=ACTIVE`).subscribe({ next: r => this.lineProducts.set(r.data ?? r), error: ()=>{} }); }
  loadBranches() {
    this.http.get<any>(this.BRANCHES_API).subscribe({
      next: r => this.branches.set(r?.data ?? r ?? []),
      error: () => this.branches.set([]),
    });
  }
  loadPosTerminals(branchId?: string) {
    const params: any = branchId ? { branchId } : { all: '1' };
    this.http.get<any>(this.POS_TERMINALS_API, { params }).subscribe({
      next: r => this.posTerminals.set(r?.data ?? r ?? []),
      error: () => this.posTerminals.set([]),
    });
  }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(()=>{ this.page.set(1); this.load(); }, 350); }
  setPage(p: number) { this.page.set(p); this.load(); }
  pageRange(): number[] { const tp=this.totalPages(),cp=this.page(),r:number[]=[]; for(let i=Math.max(1,cp-2);i<=Math.min(tp,cp+2);i++) r.push(i); return r; }

  openNewInvoice() {
    this.lines = [this.newLine()];
    const defaultConfig = this.defaultDocumentConfig('DIRECT', 'VENTA');
    this.newInvoice = {
      type:'VENTA',
      prefix: defaultConfig?.prefix || this.companyPrefix(),
      issueDate:new Date().toISOString().slice(0,10),
      dueDate:'',
      customerId:'',
      notes:'',
      documentConfigId: defaultConfig?.id || '',
      sourceChannel:'DIRECT',
    };
    this.showModal.set(true);
  }

  triggerInvoiceAction(action: 'refresh' | 'config' | 'flow' | 'fiscal' | 'analytics' | 'operations' | 'new') {
    this.focusedInvoiceAction.set(action);
    if (action === 'refresh') {
      this.load();
      return;
    }
    if (action === 'config') {
      this.openConfigModal();
      return;
    }
    if (action === 'flow') {
      this.openCommercialFlowModal();
      return;
    }
    if (action === 'fiscal') {
      this.openFiscalModal();
      return;
    }
    if (action === 'analytics') {
      this.openAnalyticsModal();
      return;
    }
    if (action === 'operations') {
      this.openOperationsModal();
      return;
    }
    this.openNewInvoice();
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
    const body = {
      ...this.newInvoice,
      documentConfigId: this.newInvoice.documentConfigId || undefined,
      sourceChannel: this.newInvoice.sourceChannel || 'DIRECT',
      dueDate:this.newInvoice.dueDate||undefined,
      sendToDian:sendDian,
      items:this.lines.map((l,i)=>({ productId:l.productId||undefined, description:l.description, quantity:l.quantity, unitPrice:l.unitPrice, taxRate:l.taxRate, discount:l.discount, position:i+1 })) };
    this.http.post(this.API, body).subscribe({
      next: () => { this.notify.success(sendDian?'Factura creada y enviada a DIAN':'Factura guardada como borrador'); this.saving.set(false); this.closeModal(); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al crear factura'); }
    });
  }

  viewDetail(inv: Invoice) {
    this.loadInvoiceStatement(inv.id);
    this.loadGovernance(inv.id);
    this.http.get<any>(`${this.API}/${inv.id}`).subscribe({
      next: r  => this.detailInvoice.set(r.data ?? r),
      error: () => this.detailInvoice.set(inv),
    });
  }

  loadGovernance(invoiceId: string) {
    this.loadingGovernance.set(true);
    this.http.get<InvoiceApproval[]>(this.APPROVAL_FLOW_API(invoiceId)).subscribe({
      next: response => this.approvalFlow.set(response ?? []),
      error: () => this.approvalFlow.set([]),
    });
    this.http.get<InvoiceAttachment[]>(this.ATTACHMENTS_API(invoiceId)).subscribe({
      next: response => this.attachments.set(response ?? []),
      error: () => this.attachments.set([]),
    });
    this.http.get<InvoiceAuditEntry[]>(this.AUDIT_API(invoiceId)).subscribe({
      next: response => {
        this.auditTrail.set(response ?? []);
        this.loadingGovernance.set(false);
      },
      error: () => {
        this.auditTrail.set([]);
        this.loadingGovernance.set(false);
      },
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

  openPdfPreview(inv: Invoice) {
    this.loadingPdf.set(true); this.showPdfModal.set(true);
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${this.API}/${inv.id}/pdf`, { responseType:'blob', headers:{ Authorization:`Bearer ${token}` } }).subscribe({
      next: blob => { this.objectUrl = URL.createObjectURL(new Blob([blob], { type:'text/html' })); this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl)); this.loadingPdf.set(false); },
      error: () => { this.loadingPdf.set(false); this.notify.error('Error al generar la vista previa'); }
    });
  }
  downloadPdf(inv: Invoice) {
    this.downloadingPdf.set(true);
    this.http.get(`${this.API}/${inv.id}/pdf/download`, { responseType:'blob' }).subscribe({
      next: blob => {
        this.triggerDownload(blob, `${inv.prefix}${inv.invoiceNumber}.pdf`);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.downloadingPdf.set(false);
        this.notify.error('No fue posible descargar el PDF de la factura');
      }
    });
  }
  downloadInvoiceZip(inv: Invoice) {
    this.downloadingZip.set(true);
    this.http.get(`${this.API}/${inv.id}/zip`, { responseType:'blob' }).subscribe({
      next: blob => {
        this.triggerDownload(blob, `${inv.prefix}${inv.invoiceNumber}.zip`);
        this.downloadingZip.set(false);
      },
      error: () => {
        this.downloadingZip.set(false);
        this.notify.error('No fue posible descargar el ZIP de la factura');
      }
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

  private emptyPaymentForm() {
    return {
      amount: null as number | null,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'TRANSFERENCIA',
      reference: '',
      notes: '',
    };
  }

  private emptyAgreementForm() {
    return {
      amount: null as number | null,
      promisedDate: new Date().toISOString().slice(0, 10),
      notes: '',
    };
  }

  private emptyApprovalRequestForm() {
    return {
      actionType: 'ISSUE' as 'ISSUE' | 'CANCEL',
      reason: '',
    };
  }

  private emptyAttachmentForm() {
    return {
      fileName: '',
      fileUrl: '',
      mimeType: '',
      category: 'SOPORTE',
      notes: '',
      sizeBytes: null as number | null,
    };
  }

  private emptyFiscalFilters() {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return {
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: to.toISOString().slice(0, 10),
    };
  }

  private emptyOperationsForm() {
    return {
      actionType: 'SEND_DIAN' as 'SEND_DIAN' | 'QUERY_DIAN_STATUS',
      scope: 'AUTO' as 'AUTO' | 'SELECTED',
    };
  }

  private emptyExternalIntakeForm() {
    return {
      channel: 'ECOMMERCE',
      externalRef: '',
      customerId: '',
      notes: '',
      autoProcess: true,
    };
  }

  loadInvoiceStatement(invoiceId: string) {
    this.loadingStatement.set(true);
    this.http.get<InvoiceStatement>(this.STATEMENT_API(invoiceId)).subscribe({
      next: response => {
        this.invoiceStatement.set(response);
        this.loadingStatement.set(false);
      },
      error: () => {
        this.invoiceStatement.set(null);
        this.loadingStatement.set(false);
      },
    });
  }

  openPaymentModal(inv: Invoice) {
    this.paymentForm = this.emptyPaymentForm();
    const balance = this.invoiceStatement()?.summary.balance;
    if (balance && balance > 0) {
      this.paymentForm.amount = Number(balance.toFixed(2));
    }
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
  }

  submitPayment() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    if (!this.paymentForm.amount || this.paymentForm.amount <= 0) {
      this.notify.warning('Ingresa un monto válido');
      return;
    }
    this.savingPayment.set(true);
    this.http.post<any>(this.PAYMENT_API(invoice.id), this.paymentForm).subscribe({
      next: () => {
        this.savingPayment.set(false);
        this.showPaymentModal.set(false);
        this.notify.success('Pago registrado correctamente');
        this.loadInvoiceStatement(invoice.id);
        this.viewDetail(invoice);
        this.load();
      },
      error: error => {
        this.savingPayment.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible registrar el pago');
      },
    });
  }

  openAgreementModal(inv: Invoice) {
    this.agreementForm = this.emptyAgreementForm();
    const balance = this.invoiceStatement()?.summary.balance;
    if (balance && balance > 0) {
      this.agreementForm.amount = Number(balance.toFixed(2));
    }
    this.showAgreementModal.set(true);
  }

  closeAgreementModal() {
    this.showAgreementModal.set(false);
  }

  submitAgreement() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    if (!this.agreementForm.amount || this.agreementForm.amount <= 0) {
      this.notify.warning('Ingresa un monto válido para el acuerdo');
      return;
    }
    this.savingAgreement.set(true);
    this.http.post<any>(this.AGREEMENT_API(invoice.id), this.agreementForm).subscribe({
      next: () => {
        this.savingAgreement.set(false);
        this.showAgreementModal.set(false);
        this.notify.success('Acuerdo de pago creado');
        this.loadInvoiceStatement(invoice.id);
      },
      error: error => {
        this.savingAgreement.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible crear el acuerdo');
      },
    });
  }

  openApprovalRequestModal(actionType: 'ISSUE' | 'CANCEL') {
    this.approvalRequestForm = {
      actionType,
      reason: '',
    };
    this.showApprovalRequestModal.set(true);
  }

  closeApprovalRequestModal() {
    this.showApprovalRequestModal.set(false);
  }

  submitApprovalRequest() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    this.savingApprovalRequest.set(true);
    this.http.post<InvoiceApproval[]>(this.REQUEST_APPROVAL_API(invoice.id), this.approvalRequestForm).subscribe({
      next: response => {
        this.approvalFlow.set(response ?? []);
        this.savingApprovalRequest.set(false);
        this.showApprovalRequestModal.set(false);
        this.notify.success('Solicitud de aprobación registrada');
      },
      error: error => {
        this.savingApprovalRequest.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible solicitar la aprobación');
      },
    });
  }

  approvePendingApproval() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    this.http.patch<InvoiceApproval[]>(this.APPROVE_APPROVAL_API(invoice.id), {}).subscribe({
      next: response => {
        this.approvalFlow.set(response ?? []);
        this.notify.success('Solicitud aprobada');
      },
      error: error => this.notify.error(error?.error?.message ?? 'No fue posible aprobar la solicitud'),
    });
  }

  rejectPendingApproval() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    const reason = this.pendingApprovalActionLabel() === 'emitir'
      ? 'Solicitud rechazada para emitir'
      : 'Solicitud rechazada para anular';
    this.http.patch<InvoiceApproval[]>(this.REJECT_APPROVAL_API(invoice.id), { reason }).subscribe({
      next: response => {
        this.approvalFlow.set(response ?? []);
        this.notify.success('Solicitud rechazada');
      },
      error: error => this.notify.error(error?.error?.message ?? 'No fue posible rechazar la solicitud'),
    });
  }

  openAttachmentModal() {
    this.attachmentForm = this.emptyAttachmentForm();
    this.showAttachmentModal.set(true);
  }

  closeAttachmentModal() {
    this.showAttachmentModal.set(false);
  }

  submitAttachment() {
    const invoice = this.detailInvoice();
    if (!invoice) return;
    if (!this.attachmentForm.fileName.trim() || !this.attachmentForm.fileUrl.trim()) {
      this.notify.warning('Define nombre y URL del soporte');
      return;
    }
    this.savingAttachment.set(true);
    this.http.post<InvoiceAttachment[]>(this.ATTACHMENTS_API(invoice.id), {
      ...this.attachmentForm,
      fileName: this.attachmentForm.fileName.trim(),
      fileUrl: this.attachmentForm.fileUrl.trim(),
      mimeType: this.attachmentForm.mimeType.trim() || undefined,
      category: this.attachmentForm.category.trim() || undefined,
      notes: this.attachmentForm.notes.trim() || undefined,
      sizeBytes: this.attachmentForm.sizeBytes ?? undefined,
    }).subscribe({
      next: response => {
        this.attachments.set(response ?? []);
        this.savingAttachment.set(false);
        this.showAttachmentModal.set(false);
        this.notify.success('Soporte agregado');
      },
      error: error => {
        this.savingAttachment.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible agregar el soporte');
      },
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
  dianActionLabel(action?: string | null) {
    return ({ SEND_DIAN: 'Enviar DIAN', QUERY_DIAN_STATUS: 'Consultar DIAN' } as any)[action ?? ''] ?? (action || 'Operación');
  }
  dianJobStatusLabel(status?: string | null) {
    return ({ PENDING: 'Pendiente', PROCESSING: 'Procesando', SUCCESS: 'Correcto', FAILED: 'Fallido', SKIPPED: 'Omitido' } as any)[status ?? ''] ?? (status || 'Pendiente');
  }
  fmtCOP(v: number) { return new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v); }
  min(a: number, b: number) { return Math.min(a, b); }
  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  private newLine(): InvoiceLine { return { productId:'', description:'', quantity:1, unitPrice:0, taxRate:19, discount:0 }; }
  private emptyDocumentConfigForm() {
    return {
      name: '',
      channel: 'DIRECT',
      type: 'VENTA',
      prefix: this.companyPrefix(),
      resolutionNumber: '',
      resolutionLabel: '',
      technicalKey: '',
      rangeFrom: null as number | null,
      rangeTo: null as number | null,
      validFrom: '',
      validTo: '',
      branchId: '',
      posTerminalId: '',
      isActive: true,
      isDefault: false,
    };
  }
  private emptyCommercialFlowForm() {
    return {
      quoteId: '',
      posSaleId: '',
      salesOrderId: '',
      deliveryNoteId: '',
      customerId: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      notes: '',
      applyAdvance: false,
    };
  }

  private emptyCommercialSourceSearch() {
    return {
      quote: '',
      posSale: '',
      salesOrder: '',
      deliveryNote: '',
    };
  }

  loadDocumentConfigs() {
    this.http.get<any>(this.DOC_CFG_API).subscribe({
      next: response => this.documentConfigs.set(response?.data ?? response ?? []),
      error: () => this.notify.warning('No fue posible cargar la configuración documental'),
    });
  }

  loadQuoteOptions(search = '') {
    const params: any = { limit: 12 };
    if (search.trim()) params.search = search.trim();
    this.http.get<any>(this.QUOTE_API, { params }).subscribe({
      next: response => {
        const rows = response?.data ?? response ?? [];
        this.quoteOptions.set(
          rows.map((item: any) => ({
            id: item.id,
            number: item.number,
            status: item.status,
            issueDate: item.issueDate,
            total: Number(item.total ?? 0),
            customerName: item.customer?.name ?? 'Cliente sin nombre',
            customerDocument: item.customer?.documentNumber ?? null,
          })),
        );
      },
      error: () => this.quoteOptions.set([]),
    });
  }

  loadPosSaleOptions(search = '') {
    const params: any = { limit: 12 };
    if (search.trim()) params.search = search.trim();
    this.http.get<any>(this.POS_SALES_API, { params }).subscribe({
      next: response => {
        const rows = response?.data ?? response ?? [];
        this.posSaleOptions.set(
          rows.map((item: any) => ({
            id: item.id,
            saleNumber: item.saleNumber,
            status: item.status,
            total: Number(item.total ?? 0),
            customerName: item.customer?.name ?? item.customerName ?? 'Cliente POS',
            orderType: item.orderType ?? null,
            orderStatus: item.orderStatus ?? null,
            createdAt: item.createdAt ?? null,
          })),
        );
      },
      error: () => this.posSaleOptions.set([]),
    });
  }

  loadSalesOrders(search = '') {
    const params: any = {};
    if (search.trim()) params.search = search.trim();
    this.http.get<any>(this.ORDER_API, { params }).subscribe({
      next: response => this.salesOrders.set(response?.data ?? response ?? []),
      error: () => this.salesOrders.set([]),
    });
  }

  loadDeliveryNotes(search = '') {
    const params: any = {};
    if (search.trim()) params.search = search.trim();
    this.http.get<any>(this.DELIVERY_LIST_API, { params }).subscribe({
      next: response => this.deliveryNotes.set(response?.data ?? response ?? []),
      error: () => this.deliveryNotes.set([]),
    });
  }

  openConfigModal() {
    this.showConfigModal.set(true);
    if (!this.documentConfigs().length) this.resetDocumentConfigForm();
  }

  openCommercialFlowModal() {
    this.commercialFlowMode = 'order';
    this.commercialFlowForm = this.emptyCommercialFlowForm();
    this.commercialSourceSearch = this.emptyCommercialSourceSearch();
    this.showCommercialFlowModal.set(true);
    this.loadQuoteOptions();
    this.loadPosSaleOptions();
    this.loadSalesOrders();
    this.loadDeliveryNotes();
  }

  openFiscalModal() {
    this.showFiscalModal.set(true);
    if (!this.fiscalSummaryReport()) {
      this.loadFiscalReports();
    }
  }

  openAnalyticsModal() {
    this.showAnalyticsModal.set(true);
    if (!this.invoiceAnalytics()) {
      this.loadAnalytics();
    }
  }

  openOperationsModal() {
    this.showOperationsModal.set(true);
    this.loadOperationsMonitor();
  }

  closeCommercialFlowModal() {
    this.showCommercialFlowModal.set(false);
  }

  closeFiscalModal() {
    this.showFiscalModal.set(false);
  }

  closeAnalyticsModal() {
    this.showAnalyticsModal.set(false);
  }

  closeOperationsModal() {
    this.showOperationsModal.set(false);
  }

  closeConfigModal() {
    this.showConfigModal.set(false);
  }

  loadFiscalReports() {
    if (!this.fiscalFilters.dateFrom || !this.fiscalFilters.dateTo) {
      this.notify.warning('Define el rango de fechas para los reportes fiscales');
      return;
    }
    const params = {
      dateFrom: this.fiscalFilters.dateFrom,
      dateTo: this.fiscalFilters.dateTo,
    };
    this.loadingFiscalReports.set(true);
    this.http.get<InvoiceFiscalSummaryReport>(this.FISCAL_SUMMARY_API, { params }).subscribe({
      next: response => this.fiscalSummaryReport.set(response),
      error: () => this.fiscalSummaryReport.set(null),
    });
    this.http.get<InvoiceVatSalesBookRow[]>(this.VAT_SALES_BOOK_API, { params }).subscribe({
      next: response => this.vatSalesBook.set(response ?? []),
      error: () => this.vatSalesBook.set([]),
    });
    this.http.get<InvoiceWithholdingsBookRow[]>(this.WITHHOLDINGS_BOOK_API, { params }).subscribe({
      next: response => this.withholdingsBook.set(response ?? []),
      error: () => this.withholdingsBook.set([]),
    });
    this.http.get<InvoiceDianValidationRow[]>(this.DIAN_VALIDATION_REPORT_API, { params }).subscribe({
      next: response => {
        this.dianValidationReport.set(response ?? []);
        this.loadingFiscalReports.set(false);
      },
      error: () => {
        this.dianValidationReport.set([]);
        this.loadingFiscalReports.set(false);
      },
    });
  }

  loadAnalytics() {
    if (!this.analyticsFilters.dateFrom || !this.analyticsFilters.dateTo) {
      this.notify.warning('Define el rango de fechas para la analítica');
      return;
    }
    this.loadingAnalytics.set(true);
    this.http.get<InvoiceAnalyticsSummary>(this.ANALYTICS_SUMMARY_API, {
      params: {
        dateFrom: this.analyticsFilters.dateFrom,
        dateTo: this.analyticsFilters.dateTo,
      },
    }).subscribe({
      next: response => {
        this.invoiceAnalytics.set(response);
        this.loadingAnalytics.set(false);
      },
      error: () => {
        this.invoiceAnalytics.set(null);
        this.loadingAnalytics.set(false);
        this.notify.error('No fue posible cargar la analítica de facturación');
      },
    });
  }

  loadOperationsMonitor() {
    this.loadingOperations.set(true);
    this.http.get<InvoiceOperationalMonitor>(this.OPERATIONS_MONITOR_API).subscribe({
      next: response => {
        this.operationsMonitor.set(response);
        this.externalIntakes.set(response.externalIntakes.recent ?? []);
        this.loadingOperations.set(false);
      },
      error: () => {
        this.operationsMonitor.set(null);
        this.externalIntakes.set([]);
        this.loadingOperations.set(false);
        this.notify.error('No fue posible cargar el monitor operativo DIAN');
      },
    });
  }

  queueBulkReprocess() {
    this.savingOperations.set(true);
    const body: any = { actionType: this.operationsForm.actionType };
    if (this.operationsForm.scope === 'SELECTED') {
      body.invoiceIds = this.invoices().slice(0, 20).map((item) => item.id);
    }
    this.http.post<any>(this.BULK_REPROCESS_API, body).subscribe({
      next: response => {
        this.savingOperations.set(false);
        this.notify.success(`Se encolaron ${response?.queued ?? 0} operaciones DIAN`);
        this.loadOperationsMonitor();
      },
      error: error => {
        this.savingOperations.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible encolar el reproceso masivo');
      },
    });
  }

  processQueuedOperations() {
    this.savingOperations.set(true);
    this.http.post<any>(this.PROCESS_QUEUE_API, {}).subscribe({
      next: response => {
        this.savingOperations.set(false);
        this.notify.success(`Cola procesada: ${response?.processed ?? 0} tareas`);
        this.loadOperationsMonitor();
        this.load();
      },
      error: error => {
        this.savingOperations.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible ejecutar la cola DIAN');
      },
    });
  }

  queueSingleReprocess(actionType: 'SEND_DIAN' | 'QUERY_DIAN_STATUS') {
    const invoice = this.detailInvoice();
    if (!invoice) {
      this.notify.warning('Abre una factura para reintentarlo');
      return;
    }
    this.savingOperations.set(true);
    this.http.post<any>(this.QUEUE_REPROCESS_API(invoice.id), { actionType }).subscribe({
      next: () => {
        this.savingOperations.set(false);
        this.notify.success('Factura agregada a la cola de reproceso');
        this.loadOperationsMonitor();
      },
      error: error => {
        this.savingOperations.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible agregar la factura a la cola');
      },
    });
  }

  submitExternalIntake() {
    if (!this.externalIntakeForm.externalRef.trim() || !this.externalIntakeForm.customerId) {
      this.notify.warning('Define referencia externa y cliente para registrar el intake');
      return;
    }
    const firstProduct = this.lineProducts()[0];
    if (!firstProduct) {
      this.notify.warning('Se requiere al menos un producto para simular el intake externo');
      return;
    }
    this.savingOperations.set(true);
    this.http.post<any>(this.EXTERNAL_INTAKES_API, {
      channel: this.externalIntakeForm.channel,
      externalRef: this.externalIntakeForm.externalRef.trim(),
      notes: this.externalIntakeForm.notes.trim() || undefined,
      autoProcess: this.externalIntakeForm.autoProcess,
      customerPayload: {
        customerId: this.externalIntakeForm.customerId,
      },
      invoicePayload: {
        customerId: this.externalIntakeForm.customerId,
        sourceChannel: this.externalIntakeForm.channel,
        notes: this.externalIntakeForm.notes.trim() || undefined,
        items: [
          {
            productId: firstProduct.id,
            description: firstProduct.name,
            quantity: 1,
            unitPrice: Number(firstProduct.price),
            taxRate: Number(firstProduct.taxRate ?? 19),
            discount: 0,
            position: 1,
          },
        ],
      },
    }).subscribe({
      next: () => {
        this.savingOperations.set(false);
        this.externalIntakeForm = this.emptyExternalIntakeForm();
        this.notify.success('Intake externo registrado');
        this.loadOperationsMonitor();
        this.load();
      },
      error: error => {
        this.savingOperations.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible registrar el intake externo');
      },
    });
  }

  resetDocumentConfigForm() {
    this.editingDocumentConfigId = null;
    this.documentConfigForm = this.emptyDocumentConfigForm();
    this.loadPosTerminals();
  }

  editDocumentConfig(config: InvoiceDocumentConfig) {
    this.editingDocumentConfigId = config.id;
    this.documentConfigForm = {
      name: config.name,
      channel: config.channel,
      type: config.type,
      prefix: config.prefix,
      resolutionNumber: config.resolutionNumber || '',
      resolutionLabel: config.resolutionLabel || '',
      technicalKey: config.technicalKey || '',
      rangeFrom: config.rangeFrom ?? null,
      rangeTo: config.rangeTo ?? null,
      validFrom: config.validFrom || '',
      validTo: config.validTo || '',
      branchId: config.branchId || '',
      posTerminalId: config.posTerminalId || '',
      isActive: config.isActive,
      isDefault: config.isDefault,
    };
    this.loadPosTerminals(config.branchId || undefined);
  }

  saveDocumentConfig() {
    if (!this.documentConfigForm.name.trim() || !this.documentConfigForm.prefix.trim()) {
      this.notify.warning('Define al menos nombre y prefijo para la configuración documental');
      return;
    }
    const payload = {
      ...this.documentConfigForm,
      name: this.documentConfigForm.name.trim(),
      prefix: this.documentConfigForm.prefix.trim().toUpperCase(),
      branchId: this.documentConfigForm.branchId || undefined,
      posTerminalId: this.documentConfigForm.posTerminalId || undefined,
      resolutionNumber: this.documentConfigForm.resolutionNumber.trim() || undefined,
      resolutionLabel: this.documentConfigForm.resolutionLabel.trim() || undefined,
      technicalKey: this.documentConfigForm.technicalKey.trim() || undefined,
      validFrom: this.documentConfigForm.validFrom || undefined,
      validTo: this.documentConfigForm.validTo || undefined,
      rangeFrom: this.documentConfigForm.rangeFrom ?? undefined,
      rangeTo: this.documentConfigForm.rangeTo ?? undefined,
    };
    this.savingConfig.set(true);
    const request = this.editingDocumentConfigId
      ? this.http.patch(`${this.DOC_CFG_API}/${this.editingDocumentConfigId}`, payload)
      : this.http.post(this.DOC_CFG_API, payload);
    request.subscribe({
      next: () => {
        this.notify.success(this.editingDocumentConfigId ? 'Configuración documental actualizada' : 'Configuración documental creada');
        this.savingConfig.set(false);
        this.loadDocumentConfigs();
        this.resetDocumentConfigForm();
      },
      error: (error) => {
        this.savingConfig.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible guardar la configuración documental');
      },
    });
  }

  availableDocumentConfigs() {
    const channel = this.newInvoice.sourceChannel || 'DIRECT';
    const type = this.newInvoice.type || 'VENTA';
    return this.documentConfigs().filter((cfg) => cfg.channel === channel && cfg.type === type && cfg.isActive);
  }

  selectedDocumentConfig() {
    return this.documentConfigs().find((cfg) => cfg.id === this.newInvoice.documentConfigId) || null;
  }

  defaultDocumentConfig(channel: string, type: string) {
    const configs = this.documentConfigs().filter((cfg) => cfg.channel === channel && cfg.type === type && cfg.isActive);
    return configs.find((cfg) => cfg.isDefault) || configs[0] || null;
  }

  onDocumentConfigSelected(documentConfigId: string) {
    const selected = this.documentConfigs().find((cfg) => cfg.id === documentConfigId);
    if (!selected) {
      this.newInvoice.prefix = this.companyPrefix();
      return;
    }
    this.newInvoice.prefix = selected.prefix;
    this.newInvoice.sourceChannel = selected.channel;
  }

  onInvoiceChannelChanged() {
    const defaultConfig = this.defaultDocumentConfig(this.newInvoice.sourceChannel || 'DIRECT', this.newInvoice.type || 'VENTA');
    this.newInvoice.documentConfigId = defaultConfig?.id || '';
    this.newInvoice.prefix = defaultConfig?.prefix || this.companyPrefix();
  }

  availableDocumentConfigTerminals() {
    const branchId = this.documentConfigForm.branchId || '';
    if (!branchId) return this.posTerminals();
    return this.posTerminals().filter((terminal) => (terminal.branchId ?? terminal.branch?.id ?? '') === branchId);
  }

  onDocumentConfigBranchChanged(branchId: string) {
    this.documentConfigForm.branchId = branchId;
    this.documentConfigForm.posTerminalId = '';
    this.loadPosTerminals(branchId || undefined);
  }

  onDocumentConfigChannelChanged(channel: string) {
    this.documentConfigForm.channel = channel;
    if (channel !== 'POS') {
      this.documentConfigForm.posTerminalId = '';
    }
  }

  documentConfigScope(config: InvoiceDocumentConfig) {
    if (config.posTerminal) return `Caja ${config.posTerminal.code} · ${config.posTerminal.name}`;
    if (config.branch) return `Sucursal ${config.branch.name}`;
    if (config.posTerminalId) return `Caja ${config.posTerminalId}`;
    if (config.branchId) return `Sucursal ${config.branchId}`;
    return 'Empresa';
  }

  formatRange(from?: number | null, to?: number | null) {
    if (!from && !to) return 'Abierto';
    return `${from ?? '—'} a ${to ?? '—'}`;
  }

  channelLabel(channel?: string | null) {
    return ({
      DIRECT:'Directo',
      POS:'POS',
      ONLINE:'Online',
      WHOLESALE:'Mayorista',
      ECOMMERCE:'E-commerce',
      MARKETPLACE:'Marketplace',
      API:'API',
    } as any)[channel ?? 'DIRECT'] ?? (channel || 'Directo');
  }

  invoiceFlowLabel(invoice: Invoice) {
    if (invoice.deliveryNoteId) return 'Remisión → Factura';
    if (invoice.salesOrderId) return 'Pedido → Factura';
    if (invoice.sourceQuoteId) return 'Cotización → Factura';
    if (invoice.sourcePosSaleId || invoice.sourceChannel === 'POS') return 'POS → Factura';
    return invoice.type === 'NOTA_CREDITO' || invoice.type === 'NOTA_DEBITO' ? 'Ajuste documental' : 'Facturación directa';
  }

  inventoryStatusLabel(status?: string | null) {
    return ({
      PENDING: 'Pendiente',
      POSTED: 'Aplicado',
      EXTERNAL: 'Gestionado por otro módulo',
      DELIVERED: 'Consumido por remisión',
      NOT_APPLICABLE: 'No aplica',
      RETURNED: 'Reintegrado',
    } as any)[status ?? 'PENDING'] ?? (status || 'Pendiente');
  }

  deliveryStatusLabel(status?: string | null) {
    return ({
      PENDING: 'Pendiente',
      DELIVERED: 'Entregado',
      RETURNED: 'Devuelto',
      EXTERNAL: 'Gestionado externamente',
    } as any)[status ?? 'PENDING'] ?? (status || 'Pendiente');
  }

  approvalActionLabel(action?: string | null) {
    return ({ ISSUE: 'Emitir', CANCEL: 'Anular' } as any)[action ?? 'ISSUE'] ?? (action || 'Emitir');
  }

  approvalStatusLabel(status?: string | null) {
    return ({
      PENDING: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
      CONSUMED: 'Consumida',
    } as any)[status ?? 'PENDING'] ?? (status || 'Pendiente');
  }

  pendingApproval() {
    return this.approvalFlow().find((item) => item.status === 'PENDING') ?? null;
  }

  pendingApprovalActionLabel() {
    const actionType = this.pendingApproval()?.actionType;
    return actionType === 'CANCEL' ? 'anular' : 'emitir';
  }

  auditActionLabel(action?: string | null) {
    return ({
      INVOICE_CREATED: 'Factura creada',
      INVOICE_ISSUED_TO_DIAN: 'Factura enviada a DIAN',
      INVOICE_DIAN_STATUS_QUERIED: 'Estado DIAN consultado',
      INVOICE_CANCELLED: 'Factura anulada',
      INVOICE_MARKED_PAID: 'Factura marcada como pagada',
      INVOICE_APPROVAL_REQUESTED: 'Aprobación solicitada',
      INVOICE_APPROVAL_APPROVED: 'Aprobación aceptada',
      INVOICE_APPROVAL_REJECTED: 'Aprobación rechazada',
      INVOICE_ATTACHMENT_ADDED: 'Soporte agregado',
    } as any)[action ?? ''] ?? (action || 'Evento');
  }

  fiscalValidationLabel(status?: string | null) {
    return ({
      READY: 'Lista para DIAN',
      REVIEW_REQUIRED: 'Requiere revisión',
      PENDING: 'Pendiente',
    } as any)[status ?? 'PENDING'] ?? (status || 'Pendiente');
  }

  commercialFlowInventoryHint() {
    if (this.commercialFlowMode === 'delivery') {
      return 'La remisión mueve inventario en operación directa. Si el origen es POS, el inventario se respeta como externo.';
    }
    if (this.commercialFlowMode === 'invoice') {
      return 'La factura descuenta inventario solo cuando no viene de POS ni de una remisión ya aplicada.';
    }
    return 'El pedido comercial reserva el flujo, pero no mueve inventario hasta la remisión o la factura según el origen.';
  }

  commercialFlowActionLabel() {
    return this.commercialFlowMode === 'order'
      ? 'Crear pedido'
      : this.commercialFlowMode === 'delivery'
        ? 'Crear remisión'
        : 'Crear factura desde origen';
  }

  onCommercialSourceSearchChanged(
    type: 'quote' | 'posSale' | 'salesOrder' | 'deliveryNote',
    value: string,
  ) {
    this.commercialSourceSearch = {
      ...this.commercialSourceSearch,
      [type]: value,
    };
    if (type === 'quote') {
      this.loadQuoteOptions(value);
      return;
    }
    if (type === 'posSale') {
      this.loadPosSaleOptions(value);
      return;
    }
    if (type === 'salesOrder') {
      this.loadSalesOrders(value);
      return;
    }
    this.loadDeliveryNotes(value);
  }

  selectedQuoteOption() {
    return this.quoteOptions().find((item) => item.id === this.commercialFlowForm.quoteId) ?? null;
  }

  selectedPosSaleOption() {
    return this.posSaleOptions().find((item) => item.id === this.commercialFlowForm.posSaleId) ?? null;
  }

  selectedSalesOrderOption() {
    return this.salesOrders().find((item) => item.id === this.commercialFlowForm.salesOrderId) ?? null;
  }

  selectedDeliveryNoteOption() {
    return this.deliveryNotes().find((item) => item.id === this.commercialFlowForm.deliveryNoteId) ?? null;
  }

  onQuoteOptionSelected(quoteId: string) {
    this.commercialFlowForm.quoteId = quoteId;
  }

  onPosSaleOptionSelected(posSaleId: string) {
    this.commercialFlowForm.posSaleId = posSaleId;
  }

  onSalesOrderSelected(salesOrderId: string) {
    this.commercialFlowForm.salesOrderId = salesOrderId;
    const order = this.salesOrders().find((item) => item.id === salesOrderId);
    if (!order) return;
    if (order.quoteId) this.commercialFlowForm.quoteId = order.quoteId;
    if (order.posSaleId) this.commercialFlowForm.posSaleId = order.posSaleId;
    if (this.commercialFlowMode === 'invoice') {
      this.commercialFlowForm.deliveryNoteId = '';
    }
  }

  onDeliveryNoteSelected(deliveryNoteId: string) {
    this.commercialFlowForm.deliveryNoteId = deliveryNoteId;
    const note = this.deliveryNotes().find((item) => item.id === deliveryNoteId);
    if (!note) return;
    if (note.salesOrderId) this.commercialFlowForm.salesOrderId = note.salesOrderId;
    if (note.posSaleId) this.commercialFlowForm.posSaleId = note.posSaleId;
  }

  useSalesOrder(order: SalesOrderSummary) {
    this.onSalesOrderSelected(order.id);
    this.commercialFlowForm.customerId = '';
  }

  useDeliveryNote(note: DeliveryNoteSummary) {
    this.onDeliveryNoteSelected(note.id);
    this.commercialFlowForm.customerId = '';
    this.commercialFlowMode = 'invoice';
  }

  commercialFlowKpis() {
    const orders = this.salesOrders();
    const notes = this.deliveryNotes();
    return [
      { label: 'Pedidos abiertos', value: String(orders.filter((item) => item.status === 'OPEN').length) },
      { label: 'Remisiones emitidas', value: String(notes.filter((item) => item.status === 'POSTED').length) },
      { label: 'Pedidos recientes', value: String(orders.length) },
      { label: 'Remisiones recientes', value: String(notes.length) },
    ];
  }

  submitCommercialFlow() {
    this.savingFlow.set(true);
    const payload = {
      ...this.commercialFlowForm,
      quoteId: this.commercialFlowForm.quoteId || undefined,
      posSaleId: this.commercialFlowForm.posSaleId || undefined,
      salesOrderId: this.commercialFlowForm.salesOrderId || undefined,
      deliveryNoteId: this.commercialFlowForm.deliveryNoteId || undefined,
      customerId: this.commercialFlowForm.customerId || undefined,
      dueDate: this.commercialFlowForm.dueDate || undefined,
      notes: this.commercialFlowForm.notes || undefined,
      applyAdvance: !!this.commercialFlowForm.applyAdvance,
    };
    const request = this.commercialFlowMode === 'order'
      ? this.http.post(this.ORDER_API, payload)
      : this.commercialFlowMode === 'delivery'
        ? this.http.post(this.DELIVERY_API, payload)
        : this.http.post(this.SOURCE_INVOICE_API, payload);

    request.subscribe({
      next: () => {
        this.notify.success(
          this.commercialFlowMode === 'order'
            ? 'Pedido comercial creado'
            : this.commercialFlowMode === 'delivery'
              ? 'Remisión creada'
              : 'Factura creada desde origen comercial',
        );
        this.savingFlow.set(false);
        this.loadSalesOrders();
        this.loadDeliveryNotes();
        this.closeCommercialFlowModal();
        this.load();
      },
      error: (error) => {
        this.savingFlow.set(false);
        this.notify.error(error?.error?.message ?? 'No fue posible ejecutar el flujo comercial');
      },
    });
  }

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
    this.http.get<InvoiceNoteContext>(this.NOTE_CONTEXT_API(inv.id)).subscribe({
      next: context => this.noteContext.set(context),
      error: () => this.noteContext.set(null),
    });
  }

  closeNoteModal() {
    this.noteModal.set('none');
    this.noteTarget.set(null);
    this.noteBalance.set(null);
    this.noteContext.set(null);
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

  noteReasonOptions() {
    const context = this.noteContext();
    if (!context) {
      return this.noteModal() === 'credit'
        ? [
            { code: '1', label: 'Devolución parcial de bienes o servicios' },
            { code: '2', label: 'Anulación o reverso total de la factura' },
            { code: '3', label: 'Rebaja o descuento sobre la operación' },
            { code: '4', label: 'Ajuste comercial o de calidad' },
            { code: '5', label: 'Rescisión o nulidad' },
            { code: '6', label: 'Otros ajustes del documento' },
          ]
        : [
            { code: '1', label: 'Intereses' },
            { code: '2', label: 'Gastos por cobrar' },
            { code: '3', label: 'Cambio en el valor facturado' },
            { code: '4', label: 'Otros' },
            { code: '5', label: 'Ajuste por servicio adicional' },
            { code: '6', label: 'Regularización comercial' },
          ];
    }
    return this.noteModal() === 'credit' ? context.reasonCatalog.credit : context.reasonCatalog.debit;
  }

  notePendingLinesCount() {
    return this.noteContext()?.lines.filter((line) => line.remainingCreditQty > 0.0001).length ?? 0;
  }

  addOriginalLineToNote(line: InvoiceNoteContext['lines'][number]) {
    const quantity = Math.max(0, Number(line.remainingCreditQty ?? 0));
    if (quantity <= 0) return;
    this.noteForm.items = [
      ...this.noteForm.items,
      {
        productId: line.productId ?? '',
        description: line.description,
        quantity,
        unitPrice: Number(line.unitPrice),
        taxRate: Number(line.taxRate ?? 19),
        discount: Number(line.discount ?? 0),
      },
    ];
  }

  loadPendingOriginalLines() {
    const context = this.noteContext();
    if (!context) return;
    const pending = context.lines
      .filter((line) => line.remainingCreditQty > 0.0001)
      .map((line) => ({
        productId: line.productId ?? '',
        description: line.description,
        quantity: Number(line.remainingCreditQty),
        unitPrice: Number(line.unitPrice),
        taxRate: Number(line.taxRate ?? 19),
        discount: Number(line.discount ?? 0),
      }));
    if (!pending.length) {
      this.notify.info('No hay líneas pendientes por revertir');
      return;
    }
    this.noteForm.items = pending;
  }

  loadFullReverseNote() {
    this.loadPendingOriginalLines();
    this.noteForm.discrepancyReasonCode = '2';
    this.noteForm.discrepancyReason = 'Reverso total guiado del documento original';
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
