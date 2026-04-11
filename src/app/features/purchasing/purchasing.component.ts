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
type RequestStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'CANCELLED';
type ReceiptStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PurchaseInvoiceStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type AccountPayableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';
type AccountPayableScheduleStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
type PayablePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
type PurchaseAdvanceStatus = 'OPEN' | 'PARTIAL' | 'APPLIED' | 'CANCELLED';
type PurchaseAdjustmentStatus = 'PENDING_APPROVAL' | 'APPLIED' | 'REJECTED';
type PurchaseAdjustmentType = 'RETURN' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'RECEIPT_REVERSAL' | 'INVOICE_REVERSAL' | 'PAYMENT_REVERSAL';
type SupplierQuoteStatus = 'RECEIVED' | 'AWARDED' | 'REJECTED' | 'EXPIRED';
type FrameworkAgreementStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
type PurchaseBudgetStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

interface PurchaseBudget {
  id: string;
  number: string;
  title: string;
  status: PurchaseBudgetStatus;
  amount: number;
  committedAmount: number;
  executedAmount: number;
  availableAmount: number;
  startDate: string;
  endDate?: string;
  area?: string;
  costCenter?: string;
  projectCode?: string;
  notes?: string;
  createdAt: string;
}

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
  budgetId?: string;
  budget?: { id: string; number: string; title: string } | null;
  requestingArea?: string;
  costCenter?: string;
  projectCode?: string;
  status: OrderStatus;
  notes?: string;
  lines?: OrderLine[];
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
}

interface PurchaseRequestLine {
  id?: string;
  description: string;
  quantity: number;
  estimatedUnitPrice?: number | null;
  position: number;
}

interface PurchaseRequest {
  id: string;
  number: string;
  status: RequestStatus;
  requestDate: string;
  neededByDate?: string;
  notes?: string;
  budgetId?: string;
  budget?: { id: string; number: string; title: string } | null;
  requestingArea?: string;
  costCenter?: string;
  projectCode?: string;
  itemsCount?: number;
  customer?: { id: string; name: string; documentNumber: string } | null;
  approval?: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; reason?: string; rejectedReason?: string | null } | null;
  linkedOrders?: Array<{ id: string; orderNumber: string; status: OrderStatus; total: number }>;
  items?: PurchaseRequestLine[];
  createdAt: string;
}

interface PurchaseReceiptLine {
  orderItemId?: string;
  description: string;
  orderedQuantity?: number | null;
  receivedQuantity: number | null;
  position: number;
}

interface PurchaseReceipt {
  id: string;
  number: string;
  status: ReceiptStatus;
  receiptDate: string;
  orderId: string;
  orderNumber: string;
  orderStatus?: OrderStatus;
  customer?: { id: string; name: string; documentNumber?: string } | null;
  itemsCount?: number;
  items?: PurchaseReceiptLine[];
  createdAt: string;
}

interface PurchaseInvoiceLine {
  orderItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total?: number;
  position: number;
}

interface PurchaseInvoice {
  id: string;
  number: string;
  supplierInvoiceNumber: string;
  status: PurchaseInvoiceStatus;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  itemsCount?: number;
  purchaseOrderId?: string;
  orderNumber?: string;
  receiptId?: string;
  customerId: string;
  customer?: { id: string; name: string; documentNumber?: string; email?: string } | null;
  accountPayable?: { id: string; number: string; status: AccountPayableStatus; balance: number } | null;
  items?: PurchaseInvoiceLine[];
  createdAt: string;
}

interface AccountPayablePayment {
  id: string;
  number: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PayablePaymentMethod;
  reference?: string;
  notes?: string;
}

interface AccountPayableSchedule {
  id: string;
  number: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: AccountPayableScheduleStatus;
  notes?: string;
}

interface AccountPayable {
  id: string;
  number: string;
  concept: string;
  status: AccountPayableStatus;
  issueDate: string;
  dueDate?: string;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  isOverdue?: boolean;
  customerId: string;
  customer?: { id: string; name: string; documentNumber?: string; email?: string } | null;
  purchaseInvoiceId?: string;
  invoiceNumber?: string;
  supplierInvoiceNumber?: string;
  paymentsCount?: number;
  payments?: AccountPayablePayment[];
  schedules?: AccountPayableSchedule[];
  advances?: Array<{ id: string; purchaseAdvanceId: string; advanceNumber: string; amount: number; applicationDate: string; paymentMethod?: PayablePaymentMethod }>;
}

interface PurchaseAdvance {
  id: string;
  number: string;
  status: PurchaseAdvanceStatus;
  issueDate: string;
  amount: number;
  appliedAmount: number;
  balance: number;
  paymentMethod: PayablePaymentMethod;
  reference?: string;
  notes?: string;
  customerId: string;
  customer?: { id: string; name: string; documentNumber?: string; email?: string } | null;
  applicationsCount?: number;
  applications?: Array<{ id: string; payableNumber: string; amount: number; applicationDate: string; notes?: string }>;
}

interface PurchasingAnalyticsSummary {
  ordersCount: number;
  ordersTotal: number;
  averageOrder: number;
  receivedCount: number;
  partialCount: number;
  cancelledCount: number;
}

interface PurchasingAnalyticsReport {
  summary: PurchasingAnalyticsSummary;
  supplierPerformance: Array<{ id: string; name: string; ordersCount: number; totalSpend: number; avgLeadTimeDays: number }>;
  topProducts: Array<{ productId?: string; productName: string; quantity: number; totalSpend: number }>;
  spendByArea: Array<{ area: string; costCenter: string; ordersCount: number; totalSpend: number }>;
  budgetVsActual: Array<{ id: string; number: string; title: string; budgetAmount: number; executedAmount: number; availableAmount: number; executionPct: number }>;
}

interface PurchasingTraceabilityRow {
  requestId: string;
  requestNumber: string;
  requestStatus: string;
  requestDate: string;
  customerName?: string;
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  issueDate?: string;
  orderTotal: number;
  receiptsCount: number;
  postedReceiptsCount: number;
  invoicesCount: number;
  payablesCount: number;
  pendingBalance: number;
  completionStage: string;
}

interface PurchaseAdjustment {
  id: string;
  type: PurchaseAdjustmentType;
  status: PurchaseAdjustmentStatus;
  customerId: string;
  customer?: { id: string; name: string } | null;
  receiptId?: string;
  purchaseInvoiceId?: string;
  accountPayableId?: string;
  paymentId?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  payableNumber?: string;
  paymentNumber?: string;
  amount: number;
  reason: string;
  notes?: string;
  rejectedReason?: string;
  createdAt: string;
}

interface SupplierQuoteLine {
  requestItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  position: number;
}

interface SupplierQuote {
  id: string;
  number: string;
  status: SupplierQuoteStatus;
  purchaseRequestId?: string;
  requestNumber?: string;
  validUntil?: string;
  leadTimeDays?: number;
  paymentTermDays?: number;
  notes?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  score?: number | null;
  itemsCount?: number;
  customerId: string;
  customer?: { id: string; name: string; documentNumber?: string } | null;
  items?: SupplierQuoteLine[];
  createdAt: string;
}

interface FrameworkAgreementLine {
  productId?: string;
  description: string;
  unitPrice: number;
  taxRate: number;
  minQuantity?: number | null;
  notes?: string;
  position: number;
}

interface FrameworkAgreement {
  id: string;
  number: string;
  status: FrameworkAgreementStatus;
  title: string;
  startDate: string;
  endDate?: string;
  paymentTermDays?: number;
  leadTimeDays?: number;
  notes?: string;
  itemsCount?: number;
  customerId: string;
  customer?: { id: string; name: string } | null;
  items?: FrameworkAgreementLine[];
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
  budgetId: string;
  requestingArea: string;
  costCenter: string;
  projectCode: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  lines: OrderLineForm[];
}

interface RequestForm {
  customerId: string;
  budgetId: string;
  requestingArea: string;
  costCenter: string;
  projectCode: string;
  requestDate: string;
  neededByDate: string;
  notes: string;
  items: RequestLineForm[];
}

interface RequestLineForm {
  description: string;
  quantity: number | null;
  estimatedUnitPrice: number | null;
}

interface ReceiptForm {
  orderId: string;
  receiptDate: string;
  notes: string;
  items: ReceiptLineForm[];
}

interface ReceiptLineForm {
  orderItemId?: string;
  description: string;
  orderedQuantity?: number | null;
  receivedQuantity: number | null;
}

interface PurchaseInvoiceForm {
  customerId: string;
  purchaseOrderId: string;
  receiptId: string;
  supplierInvoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  items: PurchaseInvoiceLineForm[];
}

interface PurchaseInvoiceLineForm {
  orderItemId?: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  taxRate: number;
  discount: number;
}

interface PayablePaymentForm {
  paymentDate: string;
  amount: number | null;
  paymentMethod: PayablePaymentMethod;
  reference: string;
  notes: string;
}

interface PayableScheduleForm {
  schedules: Array<{ dueDate: string; amount: number | null; notes: string }>;
}

interface PurchaseAdvanceForm {
  customerId: string;
  issueDate: string;
  amount: number | null;
  paymentMethod: PayablePaymentMethod;
  reference: string;
  notes: string;
}

interface PurchaseAdvanceApplyForm {
  accountPayableId: string;
  amount: number | null;
  notes: string;
}

interface PurchaseAdjustmentForm {
  customerId: string;
  type: PurchaseAdjustmentType;
  receiptId: string;
  purchaseInvoiceId: string;
  accountPayableId: string;
  paymentId: string;
  amount: number | null;
  reason: string;
  notes: string;
}

interface SupplierQuoteForm {
  customerId: string;
  purchaseRequestId: string;
  validUntil: string;
  leadTimeDays: number | null;
  paymentTermDays: number | null;
  notes: string;
  items: SupplierQuoteLineForm[];
}

interface SupplierQuoteLineForm {
  requestItemId?: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  taxRate: number;
}

interface FrameworkAgreementForm {
  customerId: string;
  title: string;
  startDate: string;
  endDate: string;
  paymentTermDays: number | null;
  leadTimeDays: number | null;
  notes: string;
  items: FrameworkAgreementLineForm[];
}

interface FrameworkAgreementLineForm {
  productId?: string;
  description: string;
  unitPrice: number | null;
  taxRate: number;
  minQuantity: number | null;
  notes: string;
}

interface PurchaseBudgetForm {
  title: string;
  status: PurchaseBudgetStatus;
  amount: number | null;
  startDate: string;
  endDate: string;
  area: string;
  costCenter: string;
  projectCode: string;
  notes: string;
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

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  ORDERED: 'Convertida a orden',
  CANCELLED: 'Cancelada',
};

const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Registrada',
  CANCELLED: 'Cancelada',
};

const PURCHASE_INVOICE_STATUS_LABELS: Record<PurchaseInvoiceStatus, string> = {
  DRAFT: 'Borrador',
  POSTED: 'Contabilizada',
  CANCELLED: 'Cancelada',
};

const ACCOUNT_PAYABLE_STATUS_LABELS: Record<AccountPayableStatus, string> = {
  OPEN: 'Abierta',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
};

const PURCHASE_ADJUSTMENT_STATUS_LABELS: Record<PurchaseAdjustmentStatus, string> = {
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPLIED: 'Aplicado',
  REJECTED: 'Rechazado',
};

const PURCHASE_ADJUSTMENT_TYPE_LABELS: Record<PurchaseAdjustmentType, string> = {
  RETURN: 'Devolución',
  CREDIT_NOTE: 'Nota crédito',
  DEBIT_NOTE: 'Nota débito',
  RECEIPT_REVERSAL: 'Reversión recepción',
  INVOICE_REVERSAL: 'Reversión factura',
  PAYMENT_REVERSAL: 'Reversión pago',
};

const SUPPLIER_QUOTE_STATUS_LABELS: Record<SupplierQuoteStatus, string> = {
  RECEIVED: 'Recibida',
  AWARDED: 'Adjudicada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
};

const FRAMEWORK_AGREEMENT_STATUS_LABELS: Record<FrameworkAgreementStatus, string> = {
  ACTIVE: 'Activo',
  EXPIRED: 'Expirado',
  SUSPENDED: 'Suspendido',
};

const PURCHASE_BUDGET_STATUS_LABELS: Record<PurchaseBudgetStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  CLOSED: 'Cerrado',
};

@Component({
  selector: 'app-purchasing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Header hero ───────────────────────────────────────── -->
      <section class="hero-shell" id="tour-purchasing-header">
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
          } @else if (activeTab() === 'requests') {
            <button class="btn btn-primary" (click)="openRequestModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Solicitud
            </button>
          } @else if (activeTab() === 'orders') {
            <button class="btn btn-primary" (click)="openOrderModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Orden
            </button>
          } @else if (activeTab() === 'receipts') {
            <button class="btn btn-primary" (click)="openReceiptModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Recepción
            </button>
          } @else if (activeTab() === 'purchaseInvoices') {
            <button class="btn btn-primary" (click)="openPurchaseInvoiceModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Factura
            </button>
          } @else if (activeTab() === 'purchaseAdvances') {
            <button class="btn btn-primary" (click)="openPurchaseAdvanceModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0V7H7a1 1 0 110-2h2V3a1 1 0 011-1zm-5 9a2 2 0 00-2 2v2a3 3 0 003 3h8a3 3 0 003-3v-2a2 2 0 00-2-2H5z" clip-rule="evenodd"/></svg>
              Nuevo Anticipo
            </button>
          } @else if (activeTab() === 'budgets') {
            <button class="btn btn-primary" (click)="openPurchaseBudgetModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nuevo Presupuesto
            </button>
          } @else if (activeTab() === 'adjustments') {
            <button class="btn btn-primary" (click)="openPurchaseAdjustmentModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nuevo Ajuste
            </button>
          } @else if (activeTab() === 'supplierQuotes') {
            <button class="btn btn-primary" (click)="openSupplierQuoteModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nueva Cotización
            </button>
          } @else if (activeTab() === 'frameworkAgreements') {
            <button class="btn btn-primary" (click)="openFrameworkAgreementModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
              Nuevo Acuerdo
            </button>
          }
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Total visible</span>
            <strong>{{ activeTab() === 'customers' ? totalCustomers() : activeTab() === 'budgets' ? totalPurchaseBudgets() : activeTab() === 'requests' ? totalRequests() : activeTab() === 'orders' ? totalOrders() : activeTab() === 'receipts' ? totalReceipts() : activeTab() === 'purchaseInvoices' ? totalPurchaseInvoices() : activeTab() === 'accountsPayable' ? totalAccountsPayable() : activeTab() === 'purchaseAdvances' ? totalPurchaseAdvances() : activeTab() === 'adjustments' ? totalPurchaseAdjustments() : activeTab() === 'supplierQuotes' ? totalSupplierQuotes() : activeTab() === 'analytics' ? totalTraceability() : totalFrameworkAgreements() }}</strong>
            <small>{{ activeTab() === 'customers' ? 'Clientes registrados' : activeTab() === 'budgets' ? 'Presupuestos disponibles para compras' : activeTab() === 'requests' ? 'Solicitudes de compra' : activeTab() === 'orders' ? 'Órdenes de compra' : activeTab() === 'receipts' ? 'Recepciones registradas' : activeTab() === 'purchaseInvoices' ? 'Facturas de proveedor' : activeTab() === 'accountsPayable' ? 'Cuentas por pagar' : activeTab() === 'purchaseAdvances' ? 'Anticipos a proveedor' : activeTab() === 'adjustments' ? 'Ajustes de compra' : activeTab() === 'supplierQuotes' ? 'Ofertas comparables por solicitud' : activeTab() === 'analytics' ? 'Filas trazables del proceso' : 'Acuerdos vigentes con proveedor' }}</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Activos</span>
              <strong>{{ activeCustomers() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Aprobaciones</span>
              <strong>{{ pendingRequests() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Recepciones / CxP</span>
              <strong>{{ activeTab() === 'accountsPayable' ? openPayables() : activeTab() === 'purchaseAdvances' ? totalPurchaseAdvances() : postedReceipts() }}</strong>
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
      <section class="tabs-shell" id="tour-purchasing-nav">
        <div class="tabs-shell__head">
          <div>
            <span class="tabs-shell__eyebrow">Navegación del módulo</span>
            <h3>Áreas de Compras</h3>
          </div>
          <p>Organiza el flujo por operación, abastecimiento y control financiero.</p>
        </div>

        <div class="tabs-groups">
          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Base comercial</span>
              <small>Terceros y control inicial</small>
            </div>
            <div class="tab-grid tab-grid--compact">
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'customers'" (click)="switchTab('customers')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Clientes</span>
                  <span class="tab-btn__meta">Terceros asociados a compras</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'budgets'" (click)="switchTab('budgets')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v1H4V4zm0 3h12v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm3 2a1 1 0 000 2h6a1 1 0 100-2H7zm0 3a1 1 0 100 2h3a1 1 0 100-2H7z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Presupuestos</span>
                  <span class="tab-btn__meta">Cupos y control financiero</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Operación de compra</span>
              <small>Solicitud, orden, recepción y causación</small>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'requests'" (click)="switchTab('requests')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V8.414A2 2 0 0013.414 7L10 3.586A2 2 0 008.586 3H4zm5 4a1 1 0 10-2 0v1H6a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2H9V7z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Solicitudes</span>
                  <span class="tab-btn__meta">Requerimientos internos</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'orders'" (click)="switchTab('orders')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Órdenes de Compra</span>
                  <span class="tab-btn__meta">Órdenes emitidas al proveedor</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'receipts'" (click)="switchTab('receipts')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 4a2 2 0 012-2h8a2 2 0 011.414.586l2 2A2 2 0 0117 6v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm4 4a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Recepciones</span>
                  <span class="tab-btn__meta">Ingreso y control de recepción</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'purchaseInvoices'" (click)="switchTab('purchaseInvoices')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7.414A2 2 0 0016.414 6l-2.414-2.414A2 2 0 0012.586 3H5zm2 5a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h4a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Facturas de Proveedor</span>
                  <span class="tab-btn__meta">Causación y soporte documental</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Tesorería y ajustes</span>
              <small>Obligaciones, anticipos y novedades</small>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'accountsPayable'" (click)="switchTab('accountsPayable')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v2H4V4zm0 4h12v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8zm3 2a1 1 0 000 2h6a1 1 0 100-2H7z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Cuentas por Pagar</span>
                  <span class="tab-btn__meta">Obligaciones pendientes</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'purchaseAdvances'" (click)="switchTab('purchaseAdvances')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 2a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0V7H7a1 1 0 110-2h2V3a1 1 0 011-1z"/><path d="M4 11a2 2 0 012-2h8a2 2 0 012 2v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Anticipos</span>
                  <span class="tab-btn__meta">Pagos adelantados al proveedor</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'adjustments'" (click)="switchTab('adjustments')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.268a7.001 7.001 0 013.95 1.636l.896-.518a1 1 0 111 1.732l-.897.518a7.036 7.036 0 010 3.728l.897.518a1 1 0 01-1 1.732l-.896-.518A7.001 7.001 0 0111 15.732V17a1 1 0 11-2 0v-1.268a7.001 7.001 0 01-3.95-1.636l-.896.518a1 1 0 01-1-1.732l.897-.518a7.036 7.036 0 010-3.728l-.897-.518a1 1 0 111-1.732l.896.518A7.001 7.001 0 019 4.268V3a1 1 0 011-1zm0 5a3 3 0 100 6 3 3 0 000-6z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Ajustes</span>
                  <span class="tab-btn__meta">Novedades, devoluciones y cambios</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <span class="tab-group__label">Abastecimiento estratégico</span>
              <small>Negociación y acuerdos con proveedores</small>
            </div>
            <div class="tab-grid tab-grid--compact">
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'supplierQuotes'" (click)="switchTab('supplierQuotes')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v3H4V4zm0 5h12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm3 2a1 1 0 000 2h6a1 1 0 100-2H7z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Cotizaciones de Proveedor</span>
                  <span class="tab-btn__meta">Comparación de ofertas</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'frameworkAgreements'" (click)="switchTab('frameworkAgreements')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8l-5-5H4zm8 1.414L16.586 9H13a1 1 0 01-1-1V4.414zM6 11a1 1 0 000 2h8a1 1 0 100-2H6zm0 3a1 1 0 100 2h5a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Acuerdos Marco</span>
                  <span class="tab-btn__meta">Condiciones negociadas vigentes</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab() === 'analytics'" (click)="switchTab('analytics')">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M3 3h2v14H3V3zm6 5h2v9H9V8zm6-4h2v13h-2V4z"/></svg>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Analítica</span>
                  <span class="tab-btn__meta">Desempeño y trazabilidad</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </section>

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

          @if (activeTab() === 'budgets') {
            <select [(ngModel)]="filterBudgetStatus" (ngModelChange)="loadPurchaseBudgets()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="CLOSED">Cerrado</option>
            </select>
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

          @if (activeTab() === 'requests') {
            <select [(ngModel)]="filterRequestStatus" (ngModelChange)="loadRequests()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="PENDING_APPROVAL">Pendiente aprobación</option>
              <option value="APPROVED">Aprobada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="ORDERED">Convertida</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          }

          @if (activeTab() === 'receipts') {
            <select [(ngModel)]="filterReceiptStatus" (ngModelChange)="loadReceipts()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="POSTED">Registradas</option>
              <option value="DRAFT">Borrador</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <select [(ngModel)]="filterOrderId" (ngModelChange)="loadReceipts()" class="filter-select">
              <option value="">Todas las órdenes</option>
              @for (o of orders(); track o.id) {
                <option [value]="o.id">{{ o.orderNumber }}</option>
              }
            </select>
          }

          @if (activeTab() === 'purchaseInvoices') {
            <select [(ngModel)]="filterPurchaseInvoiceStatus" (ngModelChange)="loadPurchaseInvoices()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="POSTED">Contabilizada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadPurchaseInvoices()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'accountsPayable') {
            <select [(ngModel)]="filterPayableStatus" (ngModelChange)="loadAccountsPayable()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="OPEN">Abiertas</option>
              <option value="PARTIAL">Parciales</option>
              <option value="PAID">Pagadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadAccountsPayable()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'purchaseAdvances') {
            <select [(ngModel)]="filterAdvanceStatus" (ngModelChange)="loadPurchaseAdvances()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="OPEN">Abierto</option>
              <option value="PARTIAL">Aplicado parcial</option>
              <option value="APPLIED">Aplicado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadPurchaseAdvances()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'adjustments') {
            <select [(ngModel)]="filterAdjustmentStatus" (ngModelChange)="loadPurchaseAdjustments()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="PENDING_APPROVAL">Pendiente aprobación</option>
              <option value="APPLIED">Aplicados</option>
              <option value="REJECTED">Rechazados</option>
            </select>
            <select [(ngModel)]="filterAdjustmentType" (ngModelChange)="loadPurchaseAdjustments()" class="filter-select">
              <option value="">Todos los tipos</option>
              <option value="RETURN">Devolución</option>
              <option value="CREDIT_NOTE">Nota crédito</option>
              <option value="DEBIT_NOTE">Nota débito</option>
              <option value="RECEIPT_REVERSAL">Reversión recepción</option>
              <option value="INVOICE_REVERSAL">Reversión factura</option>
              <option value="PAYMENT_REVERSAL">Reversión pago</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadPurchaseAdjustments()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'supplierQuotes') {
            <select [(ngModel)]="filterSupplierQuoteStatus" (ngModelChange)="loadSupplierQuotes()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="RECEIVED">Recibidas</option>
              <option value="AWARDED">Adjudicadas</option>
              <option value="REJECTED">Rechazadas</option>
              <option value="EXPIRED">Expiradas</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadSupplierQuotes()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'frameworkAgreements') {
            <select [(ngModel)]="filterFrameworkAgreementStatus" (ngModelChange)="loadFrameworkAgreements()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="EXPIRED">Expirados</option>
              <option value="SUSPENDED">Suspendidos</option>
            </select>
            <select [(ngModel)]="filterCustomerId" (ngModelChange)="loadFrameworkAgreements()" class="filter-select">
              <option value="">Todos los clientes</option>
              @for (c of allCustomers(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          }

          @if (activeTab() === 'analytics') {
            <input type="date" [(ngModel)]="filterDateFrom" (ngModelChange)="loadAnalytics()" class="filter-select" title="Desde"/>
            <input type="date" [(ngModel)]="filterDateTo" (ngModelChange)="loadAnalytics()" class="filter-select" title="Hasta"/>
          }

          <div class="results-pill">{{ activeTab() === 'customers' ? totalCustomers() : activeTab() === 'budgets' ? totalPurchaseBudgets() : activeTab() === 'requests' ? totalRequests() : activeTab() === 'orders' ? totalOrders() : activeTab() === 'receipts' ? totalReceipts() : activeTab() === 'purchaseInvoices' ? totalPurchaseInvoices() : activeTab() === 'accountsPayable' ? totalAccountsPayable() : activeTab() === 'purchaseAdvances' ? totalPurchaseAdvances() : activeTab() === 'adjustments' ? totalPurchaseAdjustments() : activeTab() === 'supplierQuotes' ? totalSupplierQuotes() : activeTab() === 'analytics' ? totalTraceability() : totalFrameworkAgreements() }} resultados</div>
        </div>
      </section>

          @if (activeTab() === 'budgets') {
        <div class="table-card">
          @if (loadingPurchaseBudgets()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:200px"></div>
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                </div>
              }
            </div>
          } @else if (purchaseBudgets().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay presupuestos de compra registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openPurchaseBudgetModal()">Crear primer presupuesto</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Presupuesto</th>
                  <th>Vigencia</th>
                  <th>Monto</th>
                  <th>Comprometido</th>
                  <th>Ejecutado</th>
                  <th>Disponible</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (budget of purchaseBudgets(); track budget.id) {
                  <tr>
                    <td><span class="order-number">{{ budget.number }}</span></td>
                    <td>
                      <div class="entity-name">{{ budget.title }}</div>
                      <div class="entity-sub">{{ budget.costCenter || 'Sin centro de costo' }} · {{ budget.projectCode || 'Sin proyecto' }}</div>
                    </td>
                    <td>{{ formatDate(budget.startDate) }} · {{ budget.endDate ? formatDate(budget.endDate) : 'Abierto' }}</td>
                    <td class="amount-cell">{{ formatCurrency(budget.amount) }}</td>
                    <td>{{ formatCurrency(budget.committedAmount) }}</td>
                    <td>{{ formatCurrency(budget.executedAmount) }}</td>
                    <td class="amount-cell">{{ formatCurrency(budget.availableAmount) }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ budget.status.toLowerCase() }}">
                        {{ purchaseBudgetStatusLabel(budget.status) }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Editar" (click)="openPurchaseBudgetModal(budget)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesPurchaseBudgets() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pagePurchaseBudgets()-1)*limit + 1 }}–{{ min(pagePurchaseBudgets()*limit, totalPurchaseBudgets()) }} de {{ totalPurchaseBudgets() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pagePurchaseBudgets() === 1" (click)="setPagePurchaseBudgets(pagePurchaseBudgets()-1)">‹</button>
                  @for (p of pageRangePurchaseBudgets(); track p) {
                    <button class="btn-page" [class.active]="p === pagePurchaseBudgets()" (click)="setPagePurchaseBudgets(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pagePurchaseBudgets() === totalPagesPurchaseBudgets()" (click)="setPagePurchaseBudgets(pagePurchaseBudgets()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

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

      <!-- ══ PESTAÑA SOLICITUDES DE COMPRA ═════════════════════ -->
      @if (activeTab() === 'requests') {
        <div class="table-card">
          @if (loadingRequests()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (requests().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay solicitudes de compra registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openRequestModal()">Crear primera solicitud</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N° Solicitud</th>
                  <th>Fecha</th>
                  <th>Cliente sugerido</th>
                  <th>Estado</th>
                  <th>Ítems</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (r of requests(); track r.id) {
                  <tr>
                    <td><span class="order-number">{{ r.number }}</span></td>
                    <td class="text-muted">{{ formatDate(r.requestDate) }}</td>
                    <td>{{ r.customer?.name || 'Sin cliente' }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ r.status.toLowerCase() }}">
                        {{ requestStatusLabel(r.status) }}
                      </span>
                    </td>
                    <td>{{ r.itemsCount || r.items?.length || 0 }}</td>
                    <td class="actions-cell">
                      @if (r.status === 'DRAFT' || r.status === 'REJECTED') {
                        <button class="btn-icon" title="Editar" (click)="openRequestModal(r)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                        </button>
                        <button class="btn-icon" title="Solicitar aprobación" (click)="requestRequestApproval(r)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L11 9.586V7z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                      @if (r.approval?.status === 'PENDING') {
                        <button class="btn-icon" title="Aprobar" (click)="approveRequest(r)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                        </button>
                        <button class="btn-icon" title="Rechazar" (click)="rejectRequest(r)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-10.95a1 1 0 10-1.414-1.415L10 7.757 7.879 5.636A1 1 0 106.464 7.05L8.586 9.17l-2.122 2.122a1 1 0 001.415 1.414L10 10.586l2.121 2.12a1 1 0 001.415-1.413L11.414 9.17l2.122-2.121z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                      @if (r.status === 'APPROVED') {
                        <button class="btn-icon" title="Convertir a orden" (click)="convertRequestToOrder(r)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesRequests() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageRequests()-1)*limit + 1 }}–{{ min(pageRequests()*limit, totalRequests()) }} de {{ totalRequests() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageRequests() === 1" (click)="setPageRequests(pageRequests()-1)">‹</button>
                  @for (p of pageRangeRequests(); track p) {
                    <button class="btn-page" [class.active]="p === pageRequests()" (click)="setPageRequests(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageRequests() === totalPagesRequests()" (click)="setPageRequests(pageRequests()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
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

      <!-- ══ PESTAÑA RECEPCIONES ═══════════════════════════════ -->
      @if (activeTab() === 'receipts') {
        <div class="table-card">
          @if (loadingReceipts()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (receipts().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay recepciones registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openReceiptModal()">Registrar primera recepción</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N° Recepción</th>
                  <th>Fecha</th>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Ítems</th>
                </tr>
              </thead>
              <tbody>
                @for (r of receipts(); track r.id) {
                  <tr>
                    <td><span class="order-number">{{ r.number }}</span></td>
                    <td class="text-muted">{{ formatDate(r.receiptDate) }}</td>
                    <td>{{ r.orderNumber }}</td>
                    <td>{{ r.customer?.name || '—' }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ r.status.toLowerCase() }}">
                        {{ receiptStatusLabel(r.status) }}
                      </span>
                    </td>
                    <td>{{ r.itemsCount || r.items?.length || 0 }}</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesReceipts() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageReceipts()-1)*limit + 1 }}–{{ min(pageReceipts()*limit, totalReceipts()) }} de {{ totalReceipts() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageReceipts() === 1" (click)="setPageReceipts(pageReceipts()-1)">‹</button>
                  @for (p of pageRangeReceipts(); track p) {
                    <button class="btn-page" [class.active]="p === pageReceipts()" (click)="setPageReceipts(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageReceipts() === totalPagesReceipts()" (click)="setPageReceipts(pageReceipts()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'purchaseInvoices') {
        <div class="table-card">
          @if (loadingPurchaseInvoices()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:160px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (purchaseInvoices().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay facturas de proveedor registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openPurchaseInvoiceModal()">Crear primera factura</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Interno</th>
                  <th>Factura proveedor</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>CxP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (invoice of purchaseInvoices(); track invoice.id) {
                  <tr>
                    <td><span class="order-number">{{ invoice.number }}</span></td>
                    <td>{{ invoice.supplierInvoiceNumber }}</td>
                    <td>{{ formatDate(invoice.issueDate) }}</td>
                    <td>{{ invoice.customer?.name || '—' }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ invoice.status.toLowerCase() }}">
                        {{ purchaseInvoiceStatusLabel(invoice.status) }}
                      </span>
                    </td>
                    <td class="amount-cell">{{ formatCurrency(invoice.total) }}</td>
                    <td>{{ invoice.accountPayable?.number || 'Pendiente' }}</td>
                    <td class="actions-cell">
                      @if (invoice.status === 'DRAFT') {
                        <button class="btn-icon" title="Contabilizar" [disabled]="saving()" (click)="postPurchaseInvoice(invoice)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesPurchaseInvoices() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pagePurchaseInvoices()-1)*limit + 1 }}–{{ min(pagePurchaseInvoices()*limit, totalPurchaseInvoices()) }} de {{ totalPurchaseInvoices() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pagePurchaseInvoices() === 1" (click)="setPagePurchaseInvoices(pagePurchaseInvoices()-1)">‹</button>
                  @for (p of pageRangePurchaseInvoices(); track p) {
                    <button class="btn-page" [class.active]="p === pagePurchaseInvoices()" (click)="setPagePurchaseInvoices(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pagePurchaseInvoices() === totalPagesPurchaseInvoices()" (click)="setPagePurchaseInvoices(pagePurchaseInvoices()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'accountsPayable') {
        <div class="table-card">
          @if (loadingAccountsPayable()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:160px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (accountsPayable().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay cuentas por pagar generadas' }}</p>
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N° CxP</th>
                  <th>Concepto</th>
                  <th>Cliente</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (payable of accountsPayable(); track payable.id) {
                  <tr>
                    <td><span class="order-number">{{ payable.number }}</span></td>
                    <td>{{ payable.concept }}</td>
                    <td>{{ payable.customer?.name || '—' }}</td>
                    <td>{{ payable.dueDate ? formatDate(payable.dueDate) : '—' }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ payable.status.toLowerCase() }}">
                        {{ accountPayableStatusLabel(payable.status) }}
                      </span>
                    </td>
                    <td class="amount-cell">{{ formatCurrency(payable.balance) }}</td>
                    <td class="actions-cell">
                      @if (payable.status === 'OPEN' || payable.status === 'PARTIAL') {
                        <button class="btn-icon" title="Programar pagos" (click)="openPayableScheduleModal(payable)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M6 2a1 1 0 012 0v1h4V2a1 1 0 112 0v1h1a2 2 0 012 2v3H3V5a2 2 0 012-2h1V2zm11 8H3v5a2 2 0 002 2h10a2 2 0 002-2v-5zM5 12a1 1 0 100 2h3a1 1 0 100-2H5z" clip-rule="evenodd"/></svg>
                        </button>
                        <button class="btn-icon" title="Registrar pago" (click)="openPayablePaymentModal(payable)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v2H4V4zm0 4h12v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8zm3 2a1 1 0 000 2h6a1 1 0 100-2H7z"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesAccountsPayable() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageAccountsPayable()-1)*limit + 1 }}–{{ min(pageAccountsPayable()*limit, totalAccountsPayable()) }} de {{ totalAccountsPayable() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageAccountsPayable() === 1" (click)="setPageAccountsPayable(pageAccountsPayable()-1)">‹</button>
                  @for (p of pageRangeAccountsPayable(); track p) {
                    <button class="btn-page" [class.active]="p === pageAccountsPayable()" (click)="setPageAccountsPayable(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageAccountsPayable() === totalPagesAccountsPayable()" (click)="setPageAccountsPayable(pageAccountsPayable()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'purchaseAdvances') {
        <div class="table-card">
          @if (loadingPurchaseAdvances()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:110px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (purchaseAdvances().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay anticipos de proveedor registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openPurchaseAdvanceModal()">Registrar primer anticipo</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N° Anticipo</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Valor</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (advance of purchaseAdvances(); track advance.id) {
                  <tr>
                    <td><span class="order-number">{{ advance.number }}</span></td>
                    <td>{{ advance.customer?.name || '—' }}</td>
                    <td>{{ formatDate(advance.issueDate) }}</td>
                    <td><span class="order-status-badge order-status-{{ advance.status.toLowerCase() }}">{{ advance.status }}</span></td>
                    <td class="amount-cell">{{ formatCurrency(advance.amount) }}</td>
                    <td class="amount-cell">{{ formatCurrency(advance.balance) }}</td>
                    <td class="actions-cell">
                      @if (advance.balance > 0.009 && (advance.status === 'OPEN' || advance.status === 'PARTIAL')) {
                        <button class="btn-icon" title="Aplicar a cuenta por pagar" (click)="openApplyAdvanceModal(advance)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0V7H7a1 1 0 110-2h2V3a1 1 0 011-1zm-5 9a2 2 0 012-2h6a2 2 0 012 2v4a3 3 0 01-3 3H7a3 3 0 01-3-3v-4z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesPurchaseAdvances() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pagePurchaseAdvances()-1)*limit + 1 }}–{{ min(pagePurchaseAdvances()*limit, totalPurchaseAdvances()) }} de {{ totalPurchaseAdvances() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pagePurchaseAdvances() === 1" (click)="setPagePurchaseAdvances(pagePurchaseAdvances()-1)">‹</button>
                  @for (p of pageRangePurchaseAdvances(); track p) {
                    <button class="btn-page" [class.active]="p === pagePurchaseAdvances()" (click)="setPagePurchaseAdvances(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pagePurchaseAdvances() === totalPagesPurchaseAdvances()" (click)="setPagePurchaseAdvances(pagePurchaseAdvances()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'adjustments') {
        <div class="table-card">
          @if (loadingPurchaseAdjustments()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:160px"></div>
                  <div class="sk sk-line" style="width:200px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (purchaseAdjustments().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay ajustes de compra registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openPurchaseAdjustmentModal()">Crear primer ajuste</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Referencia</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (adjustment of purchaseAdjustments(); track adjustment.id) {
                  <tr>
                    <td>{{ purchaseAdjustmentTypeLabel(adjustment.type) }}</td>
                    <td>{{ adjustment.customer?.name || '—' }}</td>
                    <td>{{ adjustment.receiptNumber || adjustment.invoiceNumber || adjustment.payableNumber || adjustment.paymentNumber || '—' }}</td>
                    <td class="amount-cell">{{ formatCurrency(adjustment.amount) }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ adjustment.status.toLowerCase() }}">
                        {{ purchaseAdjustmentStatusLabel(adjustment.status) }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      @if (adjustment.status === 'PENDING_APPROVAL') {
                        <button class="btn-icon" title="Aprobar" [disabled]="saving()" (click)="approvePurchaseAdjustment(adjustment)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Rechazar" [disabled]="saving()" (click)="rejectPurchaseAdjustment(adjustment)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesPurchaseAdjustments() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pagePurchaseAdjustments()-1)*limit + 1 }}–{{ min(pagePurchaseAdjustments()*limit, totalPurchaseAdjustments()) }} de {{ totalPurchaseAdjustments() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pagePurchaseAdjustments() === 1" (click)="setPagePurchaseAdjustments(pagePurchaseAdjustments()-1)">‹</button>
                  @for (p of pageRangePurchaseAdjustments(); track p) {
                    <button class="btn-page" [class.active]="p === pagePurchaseAdjustments()" (click)="setPagePurchaseAdjustments(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pagePurchaseAdjustments() === totalPagesPurchaseAdjustments()" (click)="setPagePurchaseAdjustments(pagePurchaseAdjustments()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'supplierQuotes') {
        <div class="table-card">
          @if (loadingSupplierQuotes()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (supplierQuotes().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay cotizaciones de proveedor registradas' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openSupplierQuoteModal()">Crear primera cotización</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Proveedor</th>
                  <th>Solicitud</th>
                  <th>Vigencia</th>
                  <th>Lead Time</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (quote of supplierQuotes(); track quote.id) {
                  <tr>
                    <td><span class="order-number">{{ quote.number }}</span></td>
                    <td>{{ quote.customer?.name || '—' }}</td>
                    <td>{{ quote.requestNumber || 'Sin solicitud' }}</td>
                    <td>{{ quote.validUntil ? formatDate(quote.validUntil) : '—' }}</td>
                    <td>{{ quote.leadTimeDays != null ? quote.leadTimeDays + ' días' : '—' }}</td>
                    <td class="amount-cell">{{ formatCurrency(quote.total) }}</td>
                    <td>
                      <span class="order-status-badge order-status-{{ quote.status.toLowerCase() }}">
                        {{ supplierQuoteStatusLabel(quote.status) }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      @if (quote.status === 'RECEIVED') {
                        <button class="btn-icon" title="Adjudicar y crear orden" [disabled]="saving()" (click)="awardSupplierQuote(quote)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 111.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesSupplierQuotes() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageSupplierQuotes()-1)*limit + 1 }}–{{ min(pageSupplierQuotes()*limit, totalSupplierQuotes()) }} de {{ totalSupplierQuotes() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageSupplierQuotes() === 1" (click)="setPageSupplierQuotes(pageSupplierQuotes()-1)">‹</button>
                  @for (p of pageRangeSupplierQuotes(); track p) {
                    <button class="btn-page" [class.active]="p === pageSupplierQuotes()" (click)="setPageSupplierQuotes(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageSupplierQuotes() === totalPagesSupplierQuotes()" (click)="setPageSupplierQuotes(pageSupplierQuotes()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'frameworkAgreements') {
        <div class="table-card">
          @if (loadingFrameworkAgreements()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                </div>
              }
            </div>
          } @else if (frameworkAgreements().length === 0) {
            <div class="empty-state">
              <p>{{ searchText ? 'Sin resultados para "' + searchText + '"' : 'No hay acuerdos marco registrados' }}</p>
              @if (!searchText) {
                <button class="btn btn-primary btn-sm" (click)="openFrameworkAgreementModal()">Crear primer acuerdo</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Título</th>
                  <th>Proveedor</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Condiciones</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (agreement of frameworkAgreements(); track agreement.id) {
                  <tr>
                    <td><span class="order-number">{{ agreement.number }}</span></td>
                    <td>{{ agreement.title }}</td>
                    <td>{{ agreement.customer?.name || '—' }}</td>
                    <td>{{ formatDate(agreement.startDate) }}</td>
                    <td>{{ agreement.endDate ? formatDate(agreement.endDate) : 'Abierto' }}</td>
                    <td>{{ agreement.paymentTermDays ?? 0 }} días / {{ agreement.leadTimeDays ?? 0 }} días</td>
                    <td>
                      <span class="order-status-badge order-status-{{ agreement.status.toLowerCase() }}">
                        {{ frameworkAgreementStatusLabel(agreement.status) }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPagesFrameworkAgreements() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (pageFrameworkAgreements()-1)*limit + 1 }}–{{ min(pageFrameworkAgreements()*limit, totalFrameworkAgreements()) }} de {{ totalFrameworkAgreements() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="pageFrameworkAgreements() === 1" (click)="setPageFrameworkAgreements(pageFrameworkAgreements()-1)">‹</button>
                  @for (p of pageRangeFrameworkAgreements(); track p) {
                    <button class="btn-page" [class.active]="p === pageFrameworkAgreements()" (click)="setPageFrameworkAgreements(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="pageFrameworkAgreements() === totalPagesFrameworkAgreements()" (click)="setPageFrameworkAgreements(pageFrameworkAgreements()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'analytics') {
        <div class="analytics-stack">
          @if (loadingAnalytics()) {
            <div class="table-card">
              <div class="table-loading">
                @for (i of [1,2,3,4]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:140px"></div>
                    <div class="sk sk-line" style="width:220px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                  </div>
                }
              </div>
            </div>
          } @else {
            <section class="analytics-cards">
              <article class="analytics-card">
                <span class="analytics-card__label">Órdenes</span>
                <strong>{{ analyticsReport()?.summary?.ordersCount ?? 0 }}</strong>
                <small>{{ formatCurrency(analyticsReport()?.summary?.ordersTotal ?? 0) }}</small>
              </article>
              <article class="analytics-card">
                <span class="analytics-card__label">Orden promedio</span>
                <strong>{{ formatCurrency(analyticsReport()?.summary?.averageOrder ?? 0) }}</strong>
                <small>Ticket medio de compra</small>
              </article>
              <article class="analytics-card">
                <span class="analytics-card__label">Recibidas</span>
                <strong>{{ analyticsReport()?.summary?.receivedCount ?? 0 }}</strong>
                <small>Parciales: {{ analyticsReport()?.summary?.partialCount ?? 0 }}</small>
              </article>
              <article class="analytics-card">
                <span class="analytics-card__label">Canceladas</span>
                <strong>{{ analyticsReport()?.summary?.cancelledCount ?? 0 }}</strong>
                <small>Periodo filtrado</small>
              </article>
            </section>

            <div class="analytics-grid">
              <div class="table-card">
                <div class="section-head">
                  <h3>Desempeño de proveedores</h3>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Órdenes</th>
                      <th>Gasto</th>
                      <th>Lead Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of analyticsReport()?.supplierPerformance ?? []; track item.id) {
                      <tr>
                        <td>{{ item.name }}</td>
                        <td>{{ item.ordersCount }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.totalSpend) }}</td>
                        <td>{{ item.avgLeadTimeDays | number:'1.0-1' }} días</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="table-card">
                <div class="section-head">
                  <h3>Top productos comprados</h3>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of analyticsReport()?.topProducts ?? []; track item.productId ?? item.productName) {
                      <tr>
                        <td>{{ item.productName }}</td>
                        <td>{{ item.quantity | number:'1.0-2' }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.totalSpend) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="analytics-grid">
              <div class="table-card">
                <div class="section-head">
                  <h3>Compras por área</h3>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Área</th>
                      <th>Centro de costo</th>
                      <th>Órdenes</th>
                      <th>Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of analyticsReport()?.spendByArea ?? []; track item.area + item.costCenter) {
                      <tr>
                        <td>{{ item.area }}</td>
                        <td>{{ item.costCenter }}</td>
                        <td>{{ item.ordersCount }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.totalSpend) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="table-card">
                <div class="section-head">
                  <h3>Presupuesto vs ejecutado</h3>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Presupuesto</th>
                      <th>Monto</th>
                      <th>Ejecutado</th>
                      <th>Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of analyticsReport()?.budgetVsActual ?? []; track item.id) {
                      <tr>
                        <td>{{ item.number }} · {{ item.title }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.budgetAmount) }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.executedAmount) }}</td>
                        <td class="amount-cell">{{ formatCurrency(item.availableAmount) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="table-card">
              <div class="section-head">
                <h3>Trazabilidad del proceso</h3>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Solicitud</th>
                    <th>Proveedor</th>
                    <th>Orden</th>
                    <th>Etapa</th>
                    <th>Recepciones</th>
                    <th>Facturas</th>
                    <th>Saldo CxP</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of traceabilityRows(); track row.requestId + (row.orderId || '')) {
                    <tr>
                      <td>{{ row.requestNumber }}</td>
                      <td>{{ row.customerName || '—' }}</td>
                      <td>{{ row.orderNumber || '—' }}</td>
                      <td>{{ row.completionStage }}</td>
                      <td>{{ row.postedReceiptsCount }}/{{ row.receiptsCount }}</td>
                      <td>{{ row.invoicesCount }}</td>
                      <td class="amount-cell">{{ formatCurrency(row.pendingBalance) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              @if (totalPagesTraceability() > 1) {
                <div class="pagination">
                  <span class="pagination-info">{{ (pageTraceability()-1)*limit + 1 }}–{{ min(pageTraceability()*limit, totalTraceability()) }} de {{ totalTraceability() }}</span>
                  <div class="pagination-btns">
                    <button class="btn-page" [disabled]="pageTraceability() === 1" (click)="setPageTraceability(pageTraceability()-1)">‹</button>
                    @for (p of pageRangeTraceability(); track p) {
                      <button class="btn-page" [class.active]="p === pageTraceability()" (click)="setPageTraceability(p)">{{ p }}</button>
                    }
                    <button class="btn-page" [disabled]="pageTraceability() === totalPagesTraceability()" (click)="setPageTraceability(pageTraceability()+1)">›</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
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

    @if (showPurchaseBudgetModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingBudgetId() ? 'Editar Presupuesto de Compra' : 'Nuevo Presupuesto de Compra' }}</h3>
            <button class="drawer-close" (click)="closePurchaseBudgetModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Título *</label>
                <input type="text" [(ngModel)]="purchaseBudgetForm.title" class="form-control" placeholder="Presupuesto operativo 2026"/>
              </div>
              <div class="form-group">
                <label>Estado *</label>
                <select [(ngModel)]="purchaseBudgetForm.status" class="form-control">
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Monto *</label>
                <input type="number" [(ngModel)]="purchaseBudgetForm.amount" class="form-control" min="0" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Área</label>
                <input type="text" [(ngModel)]="purchaseBudgetForm.area" class="form-control" placeholder="Operaciones"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha inicio *</label>
                <input type="date" [(ngModel)]="purchaseBudgetForm.startDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Fecha fin</label>
                <input type="date" [(ngModel)]="purchaseBudgetForm.endDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Centro de costo</label>
                <input type="text" [(ngModel)]="purchaseBudgetForm.costCenter" class="form-control" placeholder="CC-OPER-01"/>
              </div>
              <div class="form-group">
                <label>Proyecto</label>
                <input type="text" [(ngModel)]="purchaseBudgetForm.projectCode" class="form-control" placeholder="PRJ-EXP-2026"/>
              </div>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="purchaseBudgetForm.notes" class="form-control form-textarea" placeholder="Alcance, reglas de uso y restricciones del presupuesto"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePurchaseBudgetModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePurchaseBudget()">
              {{ saving() ? 'Guardando...' : (editingBudgetId() ? 'Actualizar presupuesto' : 'Crear presupuesto') }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showRequestModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingRequestId() ? 'Editar Solicitud de Compra' : 'Nueva Solicitud de Compra' }}</h3>
            <button class="drawer-close" (click)="closeRequestModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Cliente sugerido</label>
                <select [(ngModel)]="requestForm.customerId" class="form-control">
                  <option value="">— Sin cliente —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Fecha solicitud *</label>
                <input type="date" [(ngModel)]="requestForm.requestDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Presupuesto</label>
                <select [(ngModel)]="requestForm.budgetId" class="form-control">
                  <option value="">— Sin presupuesto —</option>
                  @for (budget of purchaseBudgets(); track budget.id) {
                    <option [value]="budget.id">{{ budget.number }} · {{ budget.title }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Área solicitante</label>
                <input type="text" [(ngModel)]="requestForm.requestingArea" class="form-control" placeholder="Operaciones"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha requerida</label>
                <input type="date" [(ngModel)]="requestForm.neededByDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="requestForm.notes" class="form-control" placeholder="Observaciones de la solicitud"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Centro de costo</label>
                <input type="text" [(ngModel)]="requestForm.costCenter" class="form-control" placeholder="CC-OPER-01"/>
              </div>
              <div class="form-group">
                <label>Proyecto</label>
                <input type="text" [(ngModel)]="requestForm.projectCode" class="form-control" placeholder="PRJ-EXP-2026"/>
              </div>
            </div>
            <div class="lines-section">
              <div class="lines-header">
                <span class="form-section-title">Ítems solicitados</span>
                <button class="btn btn-sm btn-secondary" type="button" (click)="addRequestLine()">Agregar ítem</button>
              </div>
              @for (line of requestForm.items; track $index; let i = $index) {
                <div class="line-row">
                  <div class="line-desc">
                    <label>Descripción</label>
                    <input type="text" [(ngModel)]="line.description" class="form-control" placeholder="Producto o servicio solicitado"/>
                  </div>
                  <div class="line-qty">
                    <label>Cantidad</label>
                    <input type="number" [(ngModel)]="line.quantity" class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="line-price">
                    <label>Precio estimado</label>
                    <input type="number" [(ngModel)]="line.estimatedUnitPrice" class="form-control" min="0" step="0.01"/>
                  </div>
                  <button class="btn-icon btn-icon-danger line-remove" title="Quitar ítem" (click)="removeRequestLine(i)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeRequestModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveRequest()">
              {{ saving() ? 'Guardando...' : (editingRequestId() ? 'Actualizar solicitud' : 'Crear solicitud') }}
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
                <label>Presupuesto</label>
                <select [(ngModel)]="orderForm.budgetId" class="form-control">
                  <option value="">— Sin presupuesto —</option>
                  @for (budget of purchaseBudgets(); track budget.id) {
                    <option [value]="budget.id">{{ budget.number }} · {{ budget.title }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Área solicitante</label>
                <input type="text" [(ngModel)]="orderForm.requestingArea" class="form-control" placeholder="Operaciones"/>
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
            <div class="form-row">
              <div class="form-group">
                <label>Centro de costo</label>
                <input type="text" [(ngModel)]="orderForm.costCenter" class="form-control" placeholder="CC-OPER-01"/>
              </div>
              <div class="form-group">
                <label>Proyecto</label>
                <input type="text" [(ngModel)]="orderForm.projectCode" class="form-control" placeholder="PRJ-EXP-2026"/>
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

    @if (showReceiptModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva Recepción de Compra</h3>
            <button class="drawer-close" (click)="closeReceiptModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Orden de compra *</label>
                <select [(ngModel)]="receiptForm.orderId" (ngModelChange)="onReceiptOrderChange()" class="form-control">
                  <option value="">— Seleccionar orden —</option>
                  @for (o of orders(); track o.id) {
                    @if (o.status === 'SENT' || o.status === 'PARTIAL' || o.status === 'DRAFT') {
                      <option [value]="o.id">{{ o.orderNumber }} · {{ o.customer.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Fecha recepción *</label>
                <input type="date" [(ngModel)]="receiptForm.receiptDate" class="form-control"/>
              </div>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <input type="text" [(ngModel)]="receiptForm.notes" class="form-control" placeholder="Observaciones de la recepción"/>
            </div>
            @if (receiptForm.items.length > 0) {
              <div class="lines-section">
                <div class="lines-header">
                  <span class="form-section-title">Líneas recibidas</span>
                </div>
                @for (line of receiptForm.items; track $index; let i = $index) {
                  <div class="line-row">
                    <div class="line-desc">
                      <label>Descripción</label>
                      <input type="text" [(ngModel)]="line.description" class="form-control" readonly/>
                    </div>
                    <div class="line-qty">
                      <label>Cant. ordenada</label>
                      <input type="number" [ngModel]="line.orderedQuantity" class="form-control" readonly/>
                    </div>
                    <div class="line-price">
                      <label>Cant. recibida</label>
                      <input type="number" [(ngModel)]="line.receivedQuantity" class="form-control" min="0" step="0.01"/>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeReceiptModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveReceipt()">
              {{ saving() ? 'Guardando...' : 'Registrar recepción' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPurchaseInvoiceModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva Factura de Proveedor</h3>
            <button class="drawer-close" (click)="closePurchaseInvoiceModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Orden de compra relacionada</label>
                <select [(ngModel)]="purchaseInvoiceForm.purchaseOrderId" (ngModelChange)="onPurchaseInvoiceOrderChange()" class="form-control">
                  <option value="">— Seleccionar orden —</option>
                  @for (o of orders(); track o.id) {
                    @if (o.status === 'RECEIVED' || o.status === 'PARTIAL' || o.status === 'SENT') {
                      <option [value]="o.id">{{ o.orderNumber }} · {{ o.customer.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Cliente *</label>
                <select [(ngModel)]="purchaseInvoiceForm.customerId" class="form-control">
                  <option value="">— Seleccionar cliente —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>N° factura proveedor *</label>
                <input type="text" [(ngModel)]="purchaseInvoiceForm.supplierInvoiceNumber" class="form-control" placeholder="FV-12345"/>
              </div>
              <div class="form-group">
                <label>Fecha emisión *</label>
                <input type="date" [(ngModel)]="purchaseInvoiceForm.issueDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha vencimiento</label>
                <input type="date" [(ngModel)]="purchaseInvoiceForm.dueDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="purchaseInvoiceForm.notes" class="form-control" placeholder="Observaciones de la factura"/>
              </div>
            </div>
            @if (purchaseInvoiceForm.items.length > 0) {
              <div class="lines-section">
                <div class="lines-header">
                  <span class="form-section-title">Líneas facturadas</span>
                </div>
                @for (line of purchaseInvoiceForm.items; track $index) {
                  <div class="line-row">
                    <div class="line-desc">
                      <label>Descripción</label>
                      <input type="text" [(ngModel)]="line.description" class="form-control"/>
                    </div>
                    <div class="line-qty">
                      <label>Cantidad</label>
                      <input type="number" [(ngModel)]="line.quantity" class="form-control" min="0" step="0.01"/>
                    </div>
                    <div class="line-price">
                      <label>Precio unit.</label>
                      <input type="number" [(ngModel)]="line.unitPrice" class="form-control" min="0" step="0.01"/>
                    </div>
                    <div class="line-tax">
                      <label>% IVA</label>
                      <input type="number" [(ngModel)]="line.taxRate" class="form-control" min="0" max="100"/>
                    </div>
                    <div class="line-disc">
                      <label>% Dto.</label>
                      <input type="number" [(ngModel)]="line.discount" class="form-control" min="0" max="100"/>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePurchaseInvoiceModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePurchaseInvoice()">
              {{ saving() ? 'Guardando...' : 'Crear factura' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPayablePaymentModal() && payablePaymentTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Registrar pago</h3>
              <div class="modal-sub">{{ payablePaymentTarget()!.number }} · Saldo {{ formatCurrency(payablePaymentTarget()!.balance) }}</div>
            </div>
            <button class="drawer-close" (click)="closePayablePaymentModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Fecha pago *</label>
              <input type="date" [(ngModel)]="payablePaymentForm.paymentDate" class="form-control"/>
            </div>
            <div class="form-group">
              <label>Valor *</label>
              <input type="number" [(ngModel)]="payablePaymentForm.amount" class="form-control" min="0" step="0.01"/>
            </div>
            <div class="form-group">
              <label>Método de pago *</label>
              <select [(ngModel)]="payablePaymentForm.paymentMethod" class="form-control">
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="MIXED">Mixto</option>
              </select>
            </div>
            <div class="form-group">
              <label>Referencia</label>
              <input type="text" [(ngModel)]="payablePaymentForm.reference" class="form-control" placeholder="Comprobante o referencia bancaria"/>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="payablePaymentForm.notes" class="form-control form-textarea" placeholder="Observaciones del pago"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePayablePaymentModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePayablePayment()">
              {{ saving() ? 'Guardando...' : 'Registrar pago' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPayableScheduleModal() && payableScheduleTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-md" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Programación de Pago</h3>
              <div class="modal-sub">{{ payableScheduleTarget()!.number }} · Saldo {{ formatCurrency(payableScheduleTarget()!.balance) }}</div>
            </div>
            <button class="drawer-close" (click)="closePayableScheduleModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="lines-section">
              <div class="lines-header">
                <span class="form-section-title">Cuotas</span>
                <button class="btn btn-secondary btn-sm" (click)="addPayableScheduleLine()">Agregar cuota</button>
              </div>
              @for (line of payableScheduleForm.schedules; track $index; let i = $index) {
                <div class="line-row">
                  <div class="line-price">
                    <label>Vence</label>
                    <input type="date" [(ngModel)]="line.dueDate" class="form-control"/>
                  </div>
                  <div class="line-price">
                    <label>Valor</label>
                    <input type="number" [(ngModel)]="line.amount" class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="line-desc">
                    <label>Notas</label>
                    <input type="text" [(ngModel)]="line.notes" class="form-control" placeholder="Opcional"/>
                  </div>
                  <div class="line-actions">
                    <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="removePayableScheduleLine(i)" [disabled]="payableScheduleForm.schedules.length === 1">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7H3a1 1 0 010-2h3V4z" clip-rule="evenodd"/></svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePayableScheduleModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePayableSchedule()">{{ saving() ? 'Guardando...' : 'Guardar cronograma' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showPurchaseAdvanceModal()) {
      <div class="modal-overlay">
        <div class="modal modal-md" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo Anticipo</h3>
            <button class="drawer-close" (click)="closePurchaseAdvanceModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Proveedor *</label>
                <select [(ngModel)]="purchaseAdvanceForm.customerId" class="form-control">
                  <option value="">— Seleccionar proveedor —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" [(ngModel)]="purchaseAdvanceForm.issueDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Valor *</label>
                <input type="number" [(ngModel)]="purchaseAdvanceForm.amount" class="form-control" min="0" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Medio de pago *</label>
                <select [(ngModel)]="purchaseAdvanceForm.paymentMethod" class="form-control">
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="MIXED">Mixto</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Referencia</label>
                <input type="text" [(ngModel)]="purchaseAdvanceForm.reference" class="form-control" placeholder="Referencia bancaria o soporte"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="purchaseAdvanceForm.notes" class="form-control" placeholder="Observaciones"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePurchaseAdvanceModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePurchaseAdvance()">{{ saving() ? 'Guardando...' : 'Registrar anticipo' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showApplyAdvanceModal() && advanceApplyTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-md" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Aplicar Anticipo</h3>
              <div class="modal-sub">{{ advanceApplyTarget()!.number }} · Saldo {{ formatCurrency(advanceApplyTarget()!.balance) }}</div>
            </div>
            <button class="drawer-close" (click)="closeApplyAdvanceModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Cuenta por pagar *</label>
              <select [(ngModel)]="purchaseAdvanceApplyForm.accountPayableId" class="form-control">
                <option value="">— Seleccionar cuenta por pagar —</option>
                @for (payable of accountsPayable(); track payable.id) {
                  @if ((payable.status === 'OPEN' || payable.status === 'PARTIAL') && payable.customerId === advanceApplyTarget()!.customerId) {
                    <option [value]="payable.id">{{ payable.number }} · {{ formatCurrency(payable.balance) }}</option>
                  }
                }
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Valor *</label>
                <input type="number" [(ngModel)]="purchaseAdvanceApplyForm.amount" class="form-control" min="0" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="purchaseAdvanceApplyForm.notes" class="form-control" placeholder="Observación opcional"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeApplyAdvanceModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveAdvanceApplication()">{{ saving() ? 'Aplicando...' : 'Aplicar anticipo' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showPurchaseAdjustmentModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo Ajuste de Compra</h3>
            <button class="drawer-close" (click)="closePurchaseAdjustmentModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Cliente *</label>
                <select [(ngModel)]="purchaseAdjustmentForm.customerId" class="form-control">
                  <option value="">— Seleccionar cliente —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Tipo *</label>
                <select [(ngModel)]="purchaseAdjustmentForm.type" class="form-control">
                  <option value="RETURN">Devolución</option>
                  <option value="CREDIT_NOTE">Nota crédito</option>
                  <option value="DEBIT_NOTE">Nota débito</option>
                  <option value="RECEIPT_REVERSAL">Reversión recepción</option>
                  <option value="INVOICE_REVERSAL">Reversión factura</option>
                  <option value="PAYMENT_REVERSAL">Reversión pago</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Recepción</label>
                <select [(ngModel)]="purchaseAdjustmentForm.receiptId" class="form-control">
                  <option value="">— Sin recepción —</option>
                  @for (r of receipts(); track r.id) {
                    <option [value]="r.id">{{ r.number }} · {{ r.orderNumber }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Factura proveedor</label>
                <select [(ngModel)]="purchaseAdjustmentForm.purchaseInvoiceId" class="form-control">
                  <option value="">— Sin factura —</option>
                  @for (invoice of purchaseInvoices(); track invoice.id) {
                    <option [value]="invoice.id">{{ invoice.number }} · {{ invoice.customer?.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Cuenta por pagar</label>
                <select [(ngModel)]="purchaseAdjustmentForm.accountPayableId" (ngModelChange)="onAdjustmentPayableChange()" class="form-control">
                  <option value="">— Sin cuenta por pagar —</option>
                  @for (payable of accountsPayable(); track payable.id) {
                    <option [value]="payable.id">{{ payable.number }} · {{ payable.customer?.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Pago asociado</label>
                <select [(ngModel)]="purchaseAdjustmentForm.paymentId" class="form-control">
                  <option value="">— Sin pago —</option>
                  @for (payment of adjustmentPaymentOptions(); track payment.id) {
                    <option [value]="payment.id">{{ payment.number }} · {{ formatCurrency(payment.amount) }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Valor *</label>
                <input type="number" [(ngModel)]="purchaseAdjustmentForm.amount" class="form-control" min="0" step="0.01"/>
              </div>
              <div class="form-group">
                <label>Motivo *</label>
                <input type="text" [(ngModel)]="purchaseAdjustmentForm.reason" class="form-control" placeholder="Describe el ajuste"/>
              </div>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="purchaseAdjustmentForm.notes" class="form-control form-textarea" placeholder="Observaciones del ajuste"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePurchaseAdjustmentModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="savePurchaseAdjustment()">
              {{ saving() ? 'Guardando...' : 'Enviar a aprobación' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showSupplierQuoteModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva Cotización de Proveedor</h3>
            <button class="drawer-close" (click)="closeSupplierQuoteModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Proveedor *</label>
                <select [(ngModel)]="supplierQuoteForm.customerId" class="form-control">
                  <option value="">— Seleccionar proveedor —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Solicitud de compra</label>
                <select [(ngModel)]="supplierQuoteForm.purchaseRequestId" (ngModelChange)="onSupplierQuoteRequestChange()" class="form-control">
                  <option value="">— Sin solicitud —</option>
                  @for (request of requests(); track request.id) {
                    <option [value]="request.id">{{ request.number }} · {{ request.customer?.name || 'Interna' }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Vigencia</label>
                <input type="date" [(ngModel)]="supplierQuoteForm.validUntil" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Lead time (días)</label>
                <input type="number" [(ngModel)]="supplierQuoteForm.leadTimeDays" class="form-control" min="0"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Plazo de pago (días)</label>
                <input type="number" [(ngModel)]="supplierQuoteForm.paymentTermDays" class="form-control" min="0"/>
              </div>
              <div class="form-group">
                <label>Notas</label>
                <input type="text" [(ngModel)]="supplierQuoteForm.notes" class="form-control" placeholder="Condiciones comerciales o comentarios"/>
              </div>
            </div>
            <div class="lines-section">
              <div class="lines-header">
                <span class="form-section-title">Líneas ofertadas</span>
                <button class="btn btn-sm btn-secondary" type="button" (click)="addSupplierQuoteLine()">Agregar línea</button>
              </div>
              @for (line of supplierQuoteForm.items; track $index; let i = $index) {
                <div class="line-row">
                  <div class="line-desc">
                    <label>Descripción</label>
                    <input type="text" [(ngModel)]="line.description" class="form-control" placeholder="Producto o servicio ofertado"/>
                  </div>
                  <div class="line-qty">
                    <label>Cantidad</label>
                    <input type="number" [(ngModel)]="line.quantity" class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="line-price">
                    <label>Precio unitario</label>
                    <input type="number" [(ngModel)]="line.unitPrice" class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="line-price">
                    <label>IVA %</label>
                    <input type="number" [(ngModel)]="line.taxRate" class="form-control" min="0" max="100" step="0.01"/>
                  </div>
                  <button class="btn-icon btn-icon-danger line-remove" title="Quitar línea" (click)="removeSupplierQuoteLine(i)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeSupplierQuoteModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveSupplierQuote()">
              {{ saving() ? 'Guardando...' : 'Registrar cotización' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showFrameworkAgreementModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo Acuerdo Marco</h3>
            <button class="drawer-close" (click)="closeFrameworkAgreementModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Proveedor *</label>
                <select [(ngModel)]="frameworkAgreementForm.customerId" class="form-control">
                  <option value="">— Seleccionar proveedor —</option>
                  @for (c of allCustomers(); track c.id) {
                    @if (c.isActive) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Título *</label>
                <input type="text" [(ngModel)]="frameworkAgreementForm.title" class="form-control" placeholder="Acuerdo de suministro anual"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha inicio *</label>
                <input type="date" [(ngModel)]="frameworkAgreementForm.startDate" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Fecha fin</label>
                <input type="date" [(ngModel)]="frameworkAgreementForm.endDate" class="form-control"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Plazo de pago (días)</label>
                <input type="number" [(ngModel)]="frameworkAgreementForm.paymentTermDays" class="form-control" min="0"/>
              </div>
              <div class="form-group">
                <label>Lead time (días)</label>
                <input type="number" [(ngModel)]="frameworkAgreementForm.leadTimeDays" class="form-control" min="0"/>
              </div>
            </div>
            <div class="form-group">
              <label>Notas</label>
              <textarea [(ngModel)]="frameworkAgreementForm.notes" class="form-control form-textarea" placeholder="Condiciones generales del acuerdo"></textarea>
            </div>
            <div class="lines-section">
              <div class="lines-header">
                <span class="form-section-title">Ítems negociados</span>
                <button class="btn btn-sm btn-secondary" type="button" (click)="addFrameworkAgreementLine()">Agregar línea</button>
              </div>
              @for (line of frameworkAgreementForm.items; track $index; let i = $index) {
                <div class="line-row">
                  <div class="line-desc">
                    <label>Descripción</label>
                    <input type="text" [(ngModel)]="line.description" class="form-control" placeholder="Producto, servicio o familia negociada"/>
                  </div>
                  <div class="line-price">
                    <label>Precio</label>
                    <input type="number" [(ngModel)]="line.unitPrice" class="form-control" min="0" step="0.01"/>
                  </div>
                  <div class="line-price">
                    <label>IVA %</label>
                    <input type="number" [(ngModel)]="line.taxRate" class="form-control" min="0" max="100" step="0.01"/>
                  </div>
                  <div class="line-price">
                    <label>Cantidad mínima</label>
                    <input type="number" [(ngModel)]="line.minQuantity" class="form-control" min="0" step="0.01"/>
                  </div>
                  <button class="btn-icon btn-icon-danger line-remove" title="Quitar línea" (click)="removeFrameworkAgreementLine(i)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
                <div class="form-group">
                  <label>Notas de línea</label>
                  <input type="text" [(ngModel)]="line.notes" class="form-control" placeholder="Cobertura, empaque, observaciones o vigencias particulares"/>
                </div>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeFrameworkAgreementModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveFrameworkAgreement()">
              {{ saving() ? 'Guardando...' : 'Registrar acuerdo' }}
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
    .kpi-card__icon { width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #e0efff, #eefbf7); color:#1a407e; flex-shrink:0; }
    .kpi-card__label { display:block; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#7b8fa8; margin-bottom:6px; }
    .kpi-card__value { font-family:'Sora',sans-serif; font-size:22px; line-height:1.1; letter-spacing:-.05em; color:#0c1c35; }
    .analytics-stack { display:grid; gap:16px; }
    .analytics-cards { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; }
    .analytics-card { border:1px solid #dce6f0; border-radius:18px; background:linear-gradient(180deg, #fff, #f7fbff); padding:16px; box-shadow:0 12px 24px rgba(12,28,53,.05); }
    .analytics-card__label { display:block; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#7b8fa8; margin-bottom:8px; }
    .analytics-card strong { display:block; font-family:'Sora',sans-serif; font-size:24px; color:#0c1c35; }
    .analytics-card small { color:#6d7f94; }
    .analytics-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; }
    .section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .section-head h3 { margin:0; font-size:16px; color:#0c1c35; }

    /* ── Pestañas ──────────────────────────────────────────────── */
    .tabs-shell {
      margin-bottom:18px;
      padding:18px;
      border-radius:24px;
      background:linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(245,248,252,.98) 100%);
      border:1px solid #dce6f0;
      box-shadow:0 18px 34px rgba(12,28,53,.06);
    }
    .tabs-shell__head {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:18px;
      margin-bottom:16px;
      padding-bottom:14px;
      border-bottom:1px solid #e4edf5;
    }
    .tabs-shell__eyebrow {
      display:inline-flex;
      margin-bottom:6px;
      font-size:11px;
      font-weight:800;
      letter-spacing:.1em;
      text-transform:uppercase;
      color:#6f85a0;
    }
    .tabs-shell__head h3 {
      margin:0;
      font-size:20px;
      line-height:1.1;
      letter-spacing:-.04em;
      color:#0c1c35;
      font-family:'Sora',sans-serif;
    }
    .tabs-shell__head p {
      margin:0;
      max-width:360px;
      font-size:13px;
      line-height:1.55;
      color:#6d7f94;
      text-align:right;
    }
    .tabs-groups {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:14px;
    }
    .tab-group {
      padding:14px;
      border-radius:20px;
      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      border:1px solid #dde7f1;
      box-shadow:0 12px 24px rgba(12,28,53,.04);
    }
    .tab-group__header {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px;
      margin-bottom:12px;
    }
    .tab-group__label {
      display:block;
      font-size:12px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#173d73;
    }
    .tab-group__header small {
      font-size:11.5px;
      color:#7c8fa5;
      text-align:right;
      line-height:1.4;
    }
    .tab-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:10px;
    }
    .tab-btn {
      display:flex;
      align-items:flex-start;
      gap:12px;
      min-height:72px;
      padding:14px 15px;
      width:100%;
      text-align:left;
      border:1px solid #dce6f0;
      border-radius:16px;
      background:linear-gradient(180deg, #fcfdff 0%, #f3f7fb 100%);
      cursor:pointer;
      font-size:13px;
      font-weight:700;
      line-height:1.25;
      color:#4b647f;
      transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease, color .16s ease;
      box-shadow:0 8px 16px rgba(12,28,53,.035);
    }
    .tab-btn svg {
      flex-shrink:0;
      width:18px;
      height:18px;
      margin-top:2px;
      color:#6b85a3;
      transition:color .16s ease, transform .16s ease;
    }
    .tab-btn__content {
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }
    .tab-btn__title {
      display:block;
      font-size:13.5px;
      font-weight:800;
      color:inherit;
    }
    .tab-btn__meta {
      display:block;
      font-size:11.5px;
      line-height:1.45;
      color:#7b8fa8;
    }
    .tab-btn:hover {
      color:#123b6d;
      border-color:#bfd2e6;
      background:linear-gradient(180deg, #ffffff 0%, #eff6ff 100%);
      transform:translateY(-1px);
      box-shadow:0 14px 24px rgba(26,64,126,.08);
    }
    .tab-btn:hover svg {
      color:#1a407e;
      transform:scale(1.05);
    }
    .tab-btn--active {
      color:#fff;
      border-color:rgba(15,138,127,.28);
      background:linear-gradient(135deg,#163c72 0%, #0f8a7f 100%);
      box-shadow:0 16px 28px rgba(15,62,114,.2);
    }
    .tab-btn--active svg { color:#dffef5; }
    .tab-btn--active .tab-btn__meta { color:rgba(236,244,255,.82); }
    .tab-btn--active:hover {
      color:#fff;
      border-color:rgba(15,138,127,.34);
      background:linear-gradient(135deg,#143866 0%, #0d7b72 100%);
      box-shadow:0 18px 30px rgba(15,62,114,.24);
    }
    .tab-btn--active:hover svg {
      color:#dffef5;
      transform:scale(1.05);
    }
    .tab-btn--active:hover .tab-btn__meta {
      color:rgba(236,244,255,.86);
    }

    /* ── Filtros ───────────────────────────────────────────────── */
    .filters-shell { margin-bottom:18px; padding:14px 18px; border-radius:16px; background:rgba(255,255,255,.84); border:1px solid #dce6f0; box-shadow:0 8px 20px rgba(12,28,53,.04); backdrop-filter:blur(10px); }
    .filters-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; position:relative; max-width:380px; min-width:160px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; min-height:40px; padding:7px 12px 7px 36px; border:1px solid #dce6f0; border-radius:10px; font-size:14px; outline:none; background:#fff; box-shadow:0 4px 10px rgba(12,28,53,.03); }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .filter-select { min-height:40px; padding:7px 12px; border:1px solid #dce6f0; border-radius:10px; font-size:13.5px; outline:none; background:#fff; color:#374151; box-shadow:0 4px 10px rgba(12,28,53,.03); }
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 8px 18px rgba(12,28,53,.03); }
    .view-toggle button { padding:9px 11px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button:hover { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }
    .results-pill { padding:7px 12px; border-radius:999px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:12px; font-weight:700; white-space:nowrap; margin-left:auto; }

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
    .entity-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .entity-avatar--sm { width:28px; height:28px; font-size:10px; border-radius:6px; }
    .entity-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .entity-sub { font-size:12px; color:#9ca3af; margin-top:1px; }

    /* ── Badges ────────────────────────────────────────────────── */
    .doc-badge { background:#e0efff; color:#1a407e; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; }
    .doc-number { font-family:monospace; font-size:13px; color:#374151; }
    .text-muted { color:#9ca3af; }
    .term-badge { font-size:12px; color:#065f46; background:#d1fae5; padding:3px 8px; border-radius:6px; font-weight:600; }
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge.active { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }
    .order-number { font-family:monospace; font-weight:700; color:#1a407e; font-size:13px; }
    .amount-cell { font-weight:700; color:#0c1c35; font-family:'Sora',sans-serif; font-size:13px; }

    /* Estados de orden coloreados */
    .order-status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .order-status-draft     { background:#f3f4f6; color:#374151; }
    .order-status-sent      { background:#dbeafe; color:#1e40af; }
    .order-status-received  { background:#d1fae5; color:#065f46; }
    .order-status-partial   { background:#fef3c7; color:#92400e; }
    .order-status-cancelled { background:#fee2e2; color:#991b1b; }
    .order-status-pending_approval { background:#ede9fe; color:#6d28d9; }
    .order-status-approved { background:#d1fae5; color:#065f46; }
    .order-status-rejected { background:#fee2e2; color:#991b1b; }
    .order-status-ordered { background:#dbeafe; color:#1d4ed8; }
    .order-status-posted { background:#dcfce7; color:#166534; }
    .order-status-open { background:#fef3c7; color:#92400e; }
    .order-status-paid { background:#dcfce7; color:#166534; }
    .order-status-active { background:#d1fae5; color:#065f46; }
    .order-status-closed { background:#e5e7eb; color:#374151; }
    .order-status-expired { background:#fee2e2; color:#991b1b; }
    .order-status-suspended { background:#fef3c7; color:#92400e; }
    .order-status-awarded { background:#dcfce7; color:#166534; }

    /* ── Acciones ──────────────────────────────────────────────── */
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#9ca3af; transition:all .15s; box-shadow:0 4px 12px rgba(12,28,53,.03); }
    .btn-icon:hover { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
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
    .customer-card:hover, .order-card:hover { box-shadow:0 18px 32px rgba(26,64,126,.1); transform:translateY(-3px); border-color:#93c5fd; }
    .customer-card--inactive { opacity:.76; border-color:#f0d4d4; background:#fdfafa; }
    .customer-card--skeleton, .order-card--skeleton { pointer-events:none; }
    .cc-status { position:absolute; top:12px; right:12px; }
    .cc-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 0 12px; }
    .cc-avatar { width:52px; height:52px; border-radius:12px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; margin-bottom:10px; }
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
    .order-card__number { font-family:'Sora',sans-serif; font-size:18px; line-height:1.1; color:#1a407e; letter-spacing:-.04em; }
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
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
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
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .form-textarea { resize:vertical; min-height:72px; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin:0; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

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
    .order-totals-row--total strong { font-family:'Sora',sans-serif; font-size:18px; color:#1a407e; }

    /* ── Detalle de orden ───────────────────────────────────────── */
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-section { margin-top:16px; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .detail-notes { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe; font-size:13px; color:#374151; margin-bottom:12px; }
    .detail-notes svg { flex-shrink:0; color:#1d4ed8; margin-top:1px; }

    /* ── Botones ───────────────────────────────────────────────── */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#153569; }
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
      .hero-mini-grid, .kpi-strip, .analytics-cards, .analytics-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .tabs-shell { padding:16px; }
      .tabs-shell__head { align-items:flex-start; flex-direction:column; }
      .tabs-shell__head p { max-width:none; text-align:left; }
      .tabs-groups { grid-template-columns:1fr; }
      .tab-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .tab-btn { min-height:68px; padding:13px 14px; font-size:13px; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .results-pill { margin-left:0; }
      .view-toggle { margin-left:0; }
    }
    @media (max-width: 640px) {
      .tabs-shell { padding:14px; border-radius:20px; }
      .tabs-shell__head { margin-bottom:14px; padding-bottom:12px; }
      .tabs-shell__head h3 { font-size:18px; }
      .tab-group { padding:12px; border-radius:18px; }
      .tab-group__header { align-items:flex-start; flex-direction:column; margin-bottom:10px; }
      .tab-group__header small { text-align:left; }
      .tab-grid { grid-template-columns:1fr; gap:8px; }
      .tab-btn { min-height:64px; padding:12px 13px; border-radius:14px; }
      .tab-btn__title { font-size:13px; }
      .tab-btn__meta { font-size:11px; }
      .hero-mini-grid, .kpi-strip, .analytics-cards, .analytics-grid { grid-template-columns:1fr; }
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
  private readonly REQUESTS_API  = `${environment.apiUrl}/purchasing/purchase-requests`;
  private readonly ORDERS_API    = `${environment.apiUrl}/purchasing/purchase-orders`;
  private readonly RECEIPTS_API  = `${environment.apiUrl}/purchasing/purchase-receipts`;
  private readonly PURCHASE_INVOICES_API = `${environment.apiUrl}/purchasing/purchase-invoices`;
  private readonly ACCOUNTS_PAYABLE_API = `${environment.apiUrl}/purchasing/accounts-payable`;
  private readonly PURCHASE_ADJUSTMENTS_API = `${environment.apiUrl}/purchasing/purchase-adjustments`;
  private readonly PURCHASE_ADVANCES_API = `${environment.apiUrl}/purchasing/purchase-advances`;
  private readonly SUPPLIER_QUOTES_API = `${environment.apiUrl}/purchasing/supplier-quotes`;
  private readonly FRAMEWORK_AGREEMENTS_API = `${environment.apiUrl}/purchasing/framework-agreements`;
  private readonly PURCHASE_BUDGETS_API = `${environment.apiUrl}/purchasing/purchase-budgets`;
  private readonly PURCHASING_ANALYTICS_API = `${environment.apiUrl}/purchasing/reports/analytics`;
  private readonly PURCHASING_TRACEABILITY_API = `${environment.apiUrl}/purchasing/reports/traceability`;

  // ── Estado de pestañas ──────────────────────────────────────────────────────
  activeTab = signal<'customers' | 'budgets' | 'requests' | 'orders' | 'receipts' | 'purchaseInvoices' | 'accountsPayable' | 'purchaseAdvances' | 'adjustments' | 'supplierQuotes' | 'frameworkAgreements' | 'analytics'>('customers');
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

  // ── Solicitudes de compra ───────────────────────────────────────────────────
  requests           = signal<PurchaseRequest[]>([]);
  loadingRequests    = signal(false);
  totalRequests      = signal(0);
  pageRequests       = signal(1);
  totalPagesRequests = signal(1);

  // ── Recepciones de compra ───────────────────────────────────────────────────
  receipts           = signal<PurchaseReceipt[]>([]);
  loadingReceipts    = signal(false);
  totalReceipts      = signal(0);
  pageReceipts       = signal(1);
  totalPagesReceipts = signal(1);

  purchaseInvoices           = signal<PurchaseInvoice[]>([]);
  loadingPurchaseInvoices    = signal(false);
  totalPurchaseInvoices      = signal(0);
  pagePurchaseInvoices       = signal(1);
  totalPagesPurchaseInvoices = signal(1);

  accountsPayable           = signal<AccountPayable[]>([]);
  loadingAccountsPayable    = signal(false);
  totalAccountsPayable      = signal(0);
  pageAccountsPayable       = signal(1);
  totalPagesAccountsPayable = signal(1);

  purchaseAdvances           = signal<PurchaseAdvance[]>([]);
  loadingPurchaseAdvances    = signal(false);
  totalPurchaseAdvances      = signal(0);
  pagePurchaseAdvances       = signal(1);
  totalPagesPurchaseAdvances = signal(1);

  purchaseAdjustments           = signal<PurchaseAdjustment[]>([]);
  loadingPurchaseAdjustments    = signal(false);
  totalPurchaseAdjustments      = signal(0);
  pagePurchaseAdjustments       = signal(1);
  totalPagesPurchaseAdjustments = signal(1);

  supplierQuotes           = signal<SupplierQuote[]>([]);
  loadingSupplierQuotes    = signal(false);
  totalSupplierQuotes      = signal(0);
  pageSupplierQuotes       = signal(1);
  totalPagesSupplierQuotes = signal(1);

  frameworkAgreements           = signal<FrameworkAgreement[]>([]);
  loadingFrameworkAgreements    = signal(false);
  totalFrameworkAgreements      = signal(0);
  pageFrameworkAgreements       = signal(1);
  totalPagesFrameworkAgreements = signal(1);

  purchaseBudgets           = signal<PurchaseBudget[]>([]);
  loadingPurchaseBudgets    = signal(false);
  totalPurchaseBudgets      = signal(0);
  pagePurchaseBudgets       = signal(1);
  totalPagesPurchaseBudgets = signal(1);

  analyticsReport = signal<PurchasingAnalyticsReport | null>(null);
  loadingAnalytics = signal(false);
  traceabilityRows = signal<PurchasingTraceabilityRow[]>([]);
  totalTraceability = signal(0);
  pageTraceability = signal(1);
  totalPagesTraceability = signal(1);

  // ── KPIs calculados ─────────────────────────────────────────────────────────
  activeCustomers = computed(() => this.allCustomers().filter(c => c.isActive).length);
  receivedOrders  = computed(() => this.orders().filter(o => o.status === 'RECEIVED').length);
  pendingOrders   = computed(() => this.orders().filter(o => o.status === 'DRAFT' || o.status === 'SENT').length);
  pendingRequests = computed(() => this.requests().filter(r => r.status === 'PENDING_APPROVAL').length);
  postedReceipts  = computed(() => this.receipts().filter(r => r.status === 'POSTED').length);
  openPayables    = computed(() => this.accountsPayable().filter(p => p.status === 'OPEN' || p.status === 'PARTIAL').length);

  // ── Estado común ────────────────────────────────────────────────────────────
  saving = signal(false);
  readonly limit = 20;

  // ── Filtros ─────────────────────────────────────────────────────────────────
  searchText      = '';
  filterActive    = '';
  filterStatus    = '';
  filterRequestStatus = '';
  filterReceiptStatus = '';
  filterPurchaseInvoiceStatus = '';
  filterPayableStatus = '';
  filterAdvanceStatus = '';
  filterAdjustmentStatus = '';
  filterAdjustmentType = '';
  filterSupplierQuoteStatus = '';
  filterFrameworkAgreementStatus = '';
  filterBudgetStatus = '';
  filterCustomerId = '';
  filterOrderId = '';
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

  // ── Modal Solicitud ─────────────────────────────────────────────────────────
  showRequestModal = signal(false);
  editingRequestId = signal<string | null>(null);
  requestForm: RequestForm = this.emptyRequestForm();

  // ── Modal Recepción ─────────────────────────────────────────────────────────
  showReceiptModal = signal(false);
  receiptForm: ReceiptForm = this.emptyReceiptForm();

  showPurchaseInvoiceModal = signal(false);
  purchaseInvoiceForm: PurchaseInvoiceForm = this.emptyPurchaseInvoiceForm();

  showPayablePaymentModal = signal(false);
  payablePaymentTarget = signal<AccountPayable | null>(null);
  payablePaymentForm: PayablePaymentForm = this.emptyPayablePaymentForm();
  showPayableScheduleModal = signal(false);
  payableScheduleTarget = signal<AccountPayable | null>(null);
  payableScheduleForm: PayableScheduleForm = this.emptyPayableScheduleForm();

  showPurchaseAdvanceModal = signal(false);
  purchaseAdvanceForm: PurchaseAdvanceForm = this.emptyPurchaseAdvanceForm();
  showApplyAdvanceModal = signal(false);
  advanceApplyTarget = signal<PurchaseAdvance | null>(null);
  purchaseAdvanceApplyForm: PurchaseAdvanceApplyForm = this.emptyPurchaseAdvanceApplyForm();

  showPurchaseAdjustmentModal = signal(false);
  purchaseAdjustmentForm: PurchaseAdjustmentForm = this.emptyPurchaseAdjustmentForm();
  adjustmentPaymentOptions = signal<AccountPayablePayment[]>([]);

  showSupplierQuoteModal = signal(false);
  supplierQuoteForm: SupplierQuoteForm = this.emptySupplierQuoteForm();

  showFrameworkAgreementModal = signal(false);
  frameworkAgreementForm: FrameworkAgreementForm = this.emptyFrameworkAgreementForm();

  showPurchaseBudgetModal = signal(false);
  editingBudgetId = signal<string | null>(null);
  purchaseBudgetForm: PurchaseBudgetForm = this.emptyPurchaseBudgetForm();

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
    this.loadPurchaseBudgets();
    this.loadRequests();
    this.loadOrders();
    this.loadReceipts();
    this.loadPurchaseInvoices();
    this.loadAccountsPayable();
    this.loadPurchaseAdvances();
    this.loadPurchaseAdjustments();
    this.loadSupplierQuotes();
    this.loadFrameworkAgreements();
    this.loadAnalytics();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Gestión de pestañas
  // ────────────────────────────────────────────────────────────────────────────

  switchTab(tab: 'customers' | 'budgets' | 'requests' | 'orders' | 'receipts' | 'purchaseInvoices' | 'accountsPayable' | 'purchaseAdvances' | 'adjustments' | 'supplierQuotes' | 'frameworkAgreements' | 'analytics') {
    this.activeTab.set(tab);
    this.searchText = '';
    if (tab === 'customers') this.loadCustomers();
    else if (tab === 'budgets') this.loadPurchaseBudgets();
    else if (tab === 'requests') this.loadRequests();
    else if (tab === 'orders') this.loadOrders();
    else if (tab === 'receipts') this.loadReceipts();
    else if (tab === 'purchaseInvoices') this.loadPurchaseInvoices();
    else if (tab === 'accountsPayable') this.loadAccountsPayable();
    else if (tab === 'purchaseAdvances') this.loadPurchaseAdvances();
    else if (tab === 'adjustments') this.loadPurchaseAdjustments();
    else if (tab === 'supplierQuotes') this.loadSupplierQuotes();
    else if (tab === 'frameworkAgreements') this.loadFrameworkAgreements();
    else this.loadAnalytics();
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

  loadPurchaseBudgets() {
    this.loadingPurchaseBudgets.set(true);
    const params: Record<string, string | number> = {
      page: this.pagePurchaseBudgets(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterBudgetStatus) params['status'] = this.filterBudgetStatus;

    this.http.get<PaginatedResponse<PurchaseBudget>>(this.PURCHASE_BUDGETS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.purchaseBudgets.set((data ?? []).map((budget) => this.mapPurchaseBudget(budget)));
        this.totalPurchaseBudgets.set(total ?? 0);
        this.totalPagesPurchaseBudgets.set(totalPages ?? 1);
        this.loadingPurchaseBudgets.set(false);
      },
      error: () => {
        this.loadingPurchaseBudgets.set(false);
        this.notify.error('Error al cargar presupuestos de compra');
      },
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

  loadRequests() {
    this.loadingRequests.set(true);
    const params: Record<string, string | number> = {
      page: this.pageRequests(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterRequestStatus) params['status'] = this.filterRequestStatus;

    this.http.get<PaginatedResponse<PurchaseRequest>>(this.REQUESTS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.requests.set((data ?? []).map((request) => this.mapRequest(request)));
        this.totalRequests.set(total ?? 0);
        this.totalPagesRequests.set(totalPages ?? 1);
        this.loadingRequests.set(false);
      },
      error: () => {
        this.loadingRequests.set(false);
        this.notify.error('Error al cargar solicitudes de compra');
      },
    });
  }

  loadReceipts() {
    this.loadingReceipts.set(true);
    const params: Record<string, string | number> = {
      page: this.pageReceipts(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterReceiptStatus) params['status'] = this.filterReceiptStatus;
    if (this.filterOrderId) params['orderId'] = this.filterOrderId;

    this.http.get<PaginatedResponse<PurchaseReceipt>>(this.RECEIPTS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.receipts.set((data ?? []).map((receipt) => this.mapReceipt(receipt)));
        this.totalReceipts.set(total ?? 0);
        this.totalPagesReceipts.set(totalPages ?? 1);
        this.loadingReceipts.set(false);
      },
      error: () => {
        this.loadingReceipts.set(false);
        this.notify.error('Error al cargar recepciones');
      },
    });
  }

  loadPurchaseInvoices() {
    this.loadingPurchaseInvoices.set(true);
    const params: Record<string, string | number> = {
      page: this.pagePurchaseInvoices(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterPurchaseInvoiceStatus) params['status'] = this.filterPurchaseInvoiceStatus;
    if (this.filterCustomerId && this.activeTab() === 'purchaseInvoices') params['customerId'] = this.filterCustomerId;

    this.http.get<PaginatedResponse<PurchaseInvoice>>(this.PURCHASE_INVOICES_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.purchaseInvoices.set((data ?? []).map((invoice) => this.mapPurchaseInvoice(invoice)));
        this.totalPurchaseInvoices.set(total ?? 0);
        this.totalPagesPurchaseInvoices.set(totalPages ?? 1);
        this.loadingPurchaseInvoices.set(false);
      },
      error: () => {
        this.loadingPurchaseInvoices.set(false);
        this.notify.error('Error al cargar facturas de proveedor');
      },
    });
  }

  loadAccountsPayable() {
    this.loadingAccountsPayable.set(true);
    const params: Record<string, string | number> = {
      page: this.pageAccountsPayable(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterPayableStatus) params['status'] = this.filterPayableStatus;
    if (this.filterCustomerId && this.activeTab() === 'accountsPayable') params['customerId'] = this.filterCustomerId;

    this.http.get<PaginatedResponse<AccountPayable>>(this.ACCOUNTS_PAYABLE_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.accountsPayable.set((data ?? []).map((payable) => this.mapAccountPayable(payable)));
        this.totalAccountsPayable.set(total ?? 0);
        this.totalPagesAccountsPayable.set(totalPages ?? 1);
        this.loadingAccountsPayable.set(false);
      },
      error: () => {
        this.loadingAccountsPayable.set(false);
        this.notify.error('Error al cargar cuentas por pagar');
      },
    });
  }

  loadPurchaseAdvances() {
    this.loadingPurchaseAdvances.set(true);
    const params: Record<string, string | number> = {
      page: this.pagePurchaseAdvances(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterAdvanceStatus) params['status'] = this.filterAdvanceStatus;
    if (this.filterCustomerId && this.activeTab() === 'purchaseAdvances') params['customerId'] = this.filterCustomerId;

    this.http.get<PaginatedResponse<PurchaseAdvance>>(this.PURCHASE_ADVANCES_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.purchaseAdvances.set((data ?? []).map((advance) => this.mapPurchaseAdvance(advance)));
        this.totalPurchaseAdvances.set(total ?? 0);
        this.totalPagesPurchaseAdvances.set(totalPages ?? 1);
        this.loadingPurchaseAdvances.set(false);
      },
      error: () => {
        this.loadingPurchaseAdvances.set(false);
        this.notify.error('Error al cargar anticipos');
      },
    });
  }

  loadPurchaseAdjustments() {
    this.loadingPurchaseAdjustments.set(true);
    const params: Record<string, string | number> = {
      page: this.pagePurchaseAdjustments(),
      limit: this.limit,
    };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterAdjustmentStatus) params['status'] = this.filterAdjustmentStatus;
    if (this.filterAdjustmentType) params['type'] = this.filterAdjustmentType;
    if (this.filterCustomerId && this.activeTab() === 'adjustments') params['customerId'] = this.filterCustomerId;

    this.http.get<PaginatedResponse<PurchaseAdjustment>>(this.PURCHASE_ADJUSTMENTS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.purchaseAdjustments.set((data ?? []).map((item) => this.mapPurchaseAdjustment(item)));
        this.totalPurchaseAdjustments.set(total ?? 0);
        this.totalPagesPurchaseAdjustments.set(totalPages ?? 1);
        this.loadingPurchaseAdjustments.set(false);
      },
      error: () => {
        this.loadingPurchaseAdjustments.set(false);
        this.notify.error('Error al cargar ajustes de compra');
      },
    });
  }

  loadSupplierQuotes() {
    this.loadingSupplierQuotes.set(true);
    const params: Record<string, string | number> = { page: this.pageSupplierQuotes(), limit: this.limit };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterSupplierQuoteStatus) params['status'] = this.filterSupplierQuoteStatus;
    if (this.filterCustomerId && this.activeTab() === 'supplierQuotes') params['customerId'] = this.filterCustomerId;
    this.http.get<PaginatedResponse<SupplierQuote>>(this.SUPPLIER_QUOTES_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.supplierQuotes.set((data ?? []).map((quote) => this.mapSupplierQuote(quote)));
        this.totalSupplierQuotes.set(total ?? 0);
        this.totalPagesSupplierQuotes.set(totalPages ?? 1);
        this.loadingSupplierQuotes.set(false);
      },
      error: () => {
        this.loadingSupplierQuotes.set(false);
        this.notify.error('Error al cargar cotizaciones de proveedor');
      },
    });
  }

  loadFrameworkAgreements() {
    this.loadingFrameworkAgreements.set(true);
    const params: Record<string, string | number> = { page: this.pageFrameworkAgreements(), limit: this.limit };
    if (this.searchText) params['search'] = this.searchText;
    if (this.filterFrameworkAgreementStatus) params['status'] = this.filterFrameworkAgreementStatus;
    if (this.filterCustomerId && this.activeTab() === 'frameworkAgreements') params['customerId'] = this.filterCustomerId;
    this.http.get<PaginatedResponse<FrameworkAgreement>>(this.FRAMEWORK_AGREEMENTS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.frameworkAgreements.set((data ?? []).map((agreement) => this.mapFrameworkAgreement(agreement)));
        this.totalFrameworkAgreements.set(total ?? 0);
        this.totalPagesFrameworkAgreements.set(totalPages ?? 1);
        this.loadingFrameworkAgreements.set(false);
      },
      error: () => {
        this.loadingFrameworkAgreements.set(false);
        this.notify.error('Error al cargar acuerdos marco');
      },
    });
  }

  loadAnalytics() {
    this.loadingAnalytics.set(true);
    const analyticsParams: Record<string, string> = {};
    if (this.filterDateFrom) analyticsParams['dateFrom'] = this.filterDateFrom;
    if (this.filterDateTo) analyticsParams['dateTo'] = this.filterDateTo;

    const traceabilityParams: Record<string, string | number> = {
      page: this.pageTraceability(),
      limit: this.limit,
    };
    if (this.searchText) traceabilityParams['search'] = this.searchText;
    if (this.filterDateFrom) traceabilityParams['dateFrom'] = this.filterDateFrom;
    if (this.filterDateTo) traceabilityParams['dateTo'] = this.filterDateTo;

    this.http.get<PurchasingAnalyticsReport>(this.PURCHASING_ANALYTICS_API, { params: analyticsParams }).subscribe({
      next: (report) => {
        this.analyticsReport.set(report);
        this.loadingAnalytics.set(false);
      },
      error: () => {
        this.analyticsReport.set(null);
        this.loadingAnalytics.set(false);
        this.notify.error('No fue posible cargar la analítica de compras');
      },
    });

    this.http.get<PaginatedResponse<PurchasingTraceabilityRow>>(this.PURCHASING_TRACEABILITY_API, { params: traceabilityParams }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.traceabilityRows.set((data ?? []).map((row) => this.mapTraceabilityRow(row)));
        this.totalTraceability.set(total ?? 0);
        this.totalPagesTraceability.set(totalPages ?? 1);
      },
      error: () => {
        this.traceabilityRows.set([]);
        this.totalTraceability.set(0);
        this.totalPagesTraceability.set(1);
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
      } else if (this.activeTab() === 'budgets') {
        this.pagePurchaseBudgets.set(1);
        this.loadPurchaseBudgets();
      } else if (this.activeTab() === 'requests') {
        this.pageRequests.set(1);
        this.loadRequests();
      } else if (this.activeTab() === 'orders') {
        this.pageOrders.set(1);
        this.loadOrders();
      } else if (this.activeTab() === 'purchaseInvoices') {
        this.pagePurchaseInvoices.set(1);
        this.loadPurchaseInvoices();
      } else if (this.activeTab() === 'accountsPayable') {
        this.pageAccountsPayable.set(1);
        this.loadAccountsPayable();
      } else if (this.activeTab() === 'purchaseAdvances') {
        this.pagePurchaseAdvances.set(1);
        this.loadPurchaseAdvances();
      } else if (this.activeTab() === 'analytics') {
        this.pageTraceability.set(1);
        this.loadAnalytics();
      } else if (this.activeTab() === 'adjustments') {
        this.pagePurchaseAdjustments.set(1);
        this.loadPurchaseAdjustments();
      } else if (this.activeTab() === 'supplierQuotes') {
        this.pageSupplierQuotes.set(1);
        this.loadSupplierQuotes();
      } else if (this.activeTab() === 'frameworkAgreements') {
        this.pageFrameworkAgreements.set(1);
        this.loadFrameworkAgreements();
      } else {
        this.pageReceipts.set(1);
        this.loadReceipts();
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

  setPagePurchaseBudgets(p: number) { this.pagePurchaseBudgets.set(p); this.loadPurchaseBudgets(); }
  pageRangePurchaseBudgets(): number[] { return this.buildRange(this.totalPagesPurchaseBudgets(), this.pagePurchaseBudgets()); }

  // ────────────────────────────────────────────────────────────────────────────
  // Paginación de órdenes
  // ────────────────────────────────────────────────────────────────────────────

  setPageOrders(p: number) { this.pageOrders.set(p); this.loadOrders(); }

  pageRangeOrders(): number[] {
    return this.buildRange(this.totalPagesOrders(), this.pageOrders());
  }

  setPageRequests(p: number) { this.pageRequests.set(p); this.loadRequests(); }
  pageRangeRequests(): number[] { return this.buildRange(this.totalPagesRequests(), this.pageRequests()); }

  setPageReceipts(p: number) { this.pageReceipts.set(p); this.loadReceipts(); }
  pageRangeReceipts(): number[] { return this.buildRange(this.totalPagesReceipts(), this.pageReceipts()); }

  setPagePurchaseInvoices(p: number) { this.pagePurchaseInvoices.set(p); this.loadPurchaseInvoices(); }
  pageRangePurchaseInvoices(): number[] { return this.buildRange(this.totalPagesPurchaseInvoices(), this.pagePurchaseInvoices()); }

  setPageAccountsPayable(p: number) { this.pageAccountsPayable.set(p); this.loadAccountsPayable(); }
  pageRangeAccountsPayable(): number[] { return this.buildRange(this.totalPagesAccountsPayable(), this.pageAccountsPayable()); }

  setPagePurchaseAdvances(p: number) { this.pagePurchaseAdvances.set(p); this.loadPurchaseAdvances(); }
  pageRangePurchaseAdvances(): number[] { return this.buildRange(this.totalPagesPurchaseAdvances(), this.pagePurchaseAdvances()); }

  setPageTraceability(p: number) { this.pageTraceability.set(p); this.loadAnalytics(); }
  pageRangeTraceability(): number[] { return this.buildRange(this.totalPagesTraceability(), this.pageTraceability()); }

  setPagePurchaseAdjustments(p: number) { this.pagePurchaseAdjustments.set(p); this.loadPurchaseAdjustments(); }
  pageRangePurchaseAdjustments(): number[] { return this.buildRange(this.totalPagesPurchaseAdjustments(), this.pagePurchaseAdjustments()); }

  setPageSupplierQuotes(p: number) { this.pageSupplierQuotes.set(p); this.loadSupplierQuotes(); }
  pageRangeSupplierQuotes(): number[] { return this.buildRange(this.totalPagesSupplierQuotes(), this.pageSupplierQuotes()); }

  setPageFrameworkAgreements(p: number) { this.pageFrameworkAgreements.set(p); this.loadFrameworkAgreements(); }
  pageRangeFrameworkAgreements(): number[] { return this.buildRange(this.totalPagesFrameworkAgreements(), this.pageFrameworkAgreements()); }

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

  openPurchaseBudgetModal(budget?: PurchaseBudget) {
    if (budget) {
      this.editingBudgetId.set(budget.id);
      this.purchaseBudgetForm = {
        title: budget.title,
        status: budget.status,
        amount: budget.amount,
        startDate: this.asInputDate(budget.startDate),
        endDate: this.asInputDate(budget.endDate),
        area: budget.area ?? '',
        costCenter: budget.costCenter ?? '',
        projectCode: budget.projectCode ?? '',
        notes: budget.notes ?? '',
      };
    } else {
      this.editingBudgetId.set(null);
      this.purchaseBudgetForm = this.emptyPurchaseBudgetForm();
    }
    this.showPurchaseBudgetModal.set(true);
  }

  closePurchaseBudgetModal() {
    this.showPurchaseBudgetModal.set(false);
    this.editingBudgetId.set(null);
    this.purchaseBudgetForm = this.emptyPurchaseBudgetForm();
  }

  savePurchaseBudget() {
    if (!this.purchaseBudgetForm.title.trim()) {
      this.notify.warning('Ingresa el nombre del presupuesto');
      return;
    }
    if (this.sanitizeAmount(this.purchaseBudgetForm.amount) <= 0) {
      this.notify.warning('El monto del presupuesto debe ser mayor que cero');
      return;
    }
    if (!this.purchaseBudgetForm.startDate) {
      this.notify.warning('Indica la fecha inicial del presupuesto');
      return;
    }

    const payload = {
      title: this.purchaseBudgetForm.title.trim(),
      status: this.purchaseBudgetForm.status,
      amount: this.sanitizeAmount(this.purchaseBudgetForm.amount),
      startDate: this.purchaseBudgetForm.startDate,
      endDate: this.purchaseBudgetForm.endDate || undefined,
      area: this.purchaseBudgetForm.area || undefined,
      costCenter: this.purchaseBudgetForm.costCenter || undefined,
      projectCode: this.purchaseBudgetForm.projectCode || undefined,
      notes: this.purchaseBudgetForm.notes || undefined,
    };
    const id = this.editingBudgetId();
    this.saving.set(true);
    const request$ = id
      ? this.http.put(`${this.PURCHASE_BUDGETS_API}/${id}`, payload)
      : this.http.post(this.PURCHASE_BUDGETS_API, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closePurchaseBudgetModal();
        this.notify.success(id ? 'Presupuesto actualizado' : 'Presupuesto creado');
        this.loadPurchaseBudgets();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible guardar el presupuesto');
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Solicitudes de compra
  // ────────────────────────────────────────────────────────────────────────────

  openRequestModal(request?: PurchaseRequest) {
    if (request) {
      if (!request.items?.length) {
        this.http.get<PurchaseRequest>(`${this.REQUESTS_API}/${request.id}`).subscribe({
          next: (full) => this.openRequestModal(this.mapRequest(full)),
          error: () => this.notify.error('No fue posible cargar la solicitud para editarla'),
        });
        return;
      }
      this.editingRequestId.set(request.id);
      this.requestForm = {
        customerId: request.customer?.id ?? '',
        budgetId: request.budget?.id ?? request.budgetId ?? '',
        requestingArea: request.requestingArea ?? '',
        costCenter: request.costCenter ?? '',
        projectCode: request.projectCode ?? '',
        requestDate: this.asInputDate(request.requestDate),
        neededByDate: this.asInputDate(request.neededByDate),
        notes: request.notes ?? '',
        items: (request.items ?? []).map((item) => ({
          description: item.description,
          quantity: Number(item.quantity ?? 0),
          estimatedUnitPrice: item.estimatedUnitPrice == null ? null : Number(item.estimatedUnitPrice),
        })),
      };
      if (!this.requestForm.items.length) {
        this.requestForm.items = [{ description: '', quantity: null, estimatedUnitPrice: null }];
      }
    } else {
      this.editingRequestId.set(null);
      this.requestForm = this.emptyRequestForm();
    }
    this.showRequestModal.set(true);
  }

  closeRequestModal() {
    this.showRequestModal.set(false);
    this.editingRequestId.set(null);
  }

  addRequestLine() {
    this.requestForm.items.push({ description: '', quantity: null, estimatedUnitPrice: null });
  }

  removeRequestLine(index: number) {
    this.requestForm.items.splice(index, 1);
  }

  saveRequest() {
    const editingId = this.editingRequestId();
    if (!this.requestForm.requestDate) {
      this.notify.warning('Indica la fecha de la solicitud');
      return;
    }
    if (!this.requestForm.items.length) {
      this.notify.warning('Agrega al menos un ítem a la solicitud');
      return;
    }
    const invalidLine = this.requestForm.items.find((item) => !item.description?.trim() || this.sanitizeAmount(item.quantity) <= 0);
    if (invalidLine) {
      this.notify.warning('Cada ítem de la solicitud debe tener descripción y cantidad válida');
      return;
    }

    this.saving.set(true);
    const payload = {
      requestDate: this.requestForm.requestDate,
      neededByDate: this.requestForm.neededByDate || undefined,
      notes: this.requestForm.notes || undefined,
      customerId: this.requestForm.customerId || undefined,
      budgetId: this.requestForm.budgetId || undefined,
      requestingArea: this.requestForm.requestingArea || undefined,
      costCenter: this.requestForm.costCenter || undefined,
      projectCode: this.requestForm.projectCode || undefined,
      items: this.requestForm.items.map((item, index) => ({
        description: item.description.trim(),
        quantity: this.sanitizeAmount(item.quantity),
        estimatedUnitPrice: item.estimatedUnitPrice == null ? undefined : this.sanitizeAmount(item.estimatedUnitPrice),
        position: index + 1,
      })),
    };

    const request$ = editingId
      ? this.http.put(`${this.REQUESTS_API}/${editingId}`, payload)
      : this.http.post(this.REQUESTS_API, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(editingId ? 'Solicitud actualizada' : 'Solicitud creada');
        this.closeRequestModal();
        this.loadRequests();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible guardar la solicitud');
      },
    });
  }

  requestRequestApproval(request: PurchaseRequest) {
    this.http.post(`${this.REQUESTS_API}/${request.id}/request-approval`, {}).subscribe({
      next: () => {
        this.notify.success('Solicitud enviada a aprobación');
        this.loadRequests();
      },
      error: (err) => this.notify.error(err?.error?.message || 'No fue posible solicitar aprobación'),
    });
  }

  approveRequest(request: PurchaseRequest) {
    this.http.patch(`${this.REQUESTS_API}/${request.id}/approve`, {}).subscribe({
      next: () => {
        this.notify.success('Solicitud aprobada');
        this.loadRequests();
      },
      error: (err) => this.notify.error(err?.error?.message || 'No fue posible aprobar la solicitud'),
    });
  }

  rejectRequest(request: PurchaseRequest) {
    this.http.patch(`${this.REQUESTS_API}/${request.id}/reject`, {}).subscribe({
      next: () => {
        this.notify.success('Solicitud rechazada');
        this.loadRequests();
      },
      error: (err) => this.notify.error(err?.error?.message || 'No fue posible rechazar la solicitud'),
    });
  }

  convertRequestToOrder(request: PurchaseRequest) {
    const customerId = request.customer?.id;
    if (!customerId) {
      this.notify.warning('Asocia un cliente a la solicitud antes de convertirla en orden');
      return;
    }
    this.http.post(`${this.REQUESTS_API}/${request.id}/convert-to-order`, {
      customerId,
      issueDate: this.asInputDate(new Date().toISOString()),
      notes: request.notes || undefined,
    }).subscribe({
      next: () => {
        this.notify.success('Solicitud convertida en orden de compra');
        this.loadRequests();
        this.loadOrders();
      },
      error: (err) => this.notify.error(err?.error?.message || 'No fue posible convertir la solicitud'),
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Recepciones de compra
  // ────────────────────────────────────────────────────────────────────────────

  openReceiptModal() {
    this.receiptForm = this.emptyReceiptForm();
    this.showReceiptModal.set(true);
  }

  closeReceiptModal() {
    this.showReceiptModal.set(false);
    this.receiptForm = this.emptyReceiptForm();
  }

  onReceiptOrderChange() {
    const orderId = this.receiptForm.orderId;
    if (!orderId) {
      this.receiptForm.items = [];
      return;
    }
    this.http.get<PurchaseOrder>(`${this.ORDERS_API}/${orderId}`).subscribe({
      next: (order) => {
        const mapped = this.mapOrder(order);
        this.receiptForm.items = (mapped.lines ?? []).map((line, index) => ({
          orderItemId: (order as any)?.items?.[index]?.id,
          description: line.description,
          orderedQuantity: Number(line.quantity ?? 0),
          receivedQuantity: Number(line.quantity ?? 0),
        }));
      },
      error: () => this.notify.error('No fue posible cargar la orden para registrar la recepción'),
    });
  }

  saveReceipt() {
    if (!this.receiptForm.orderId) {
      this.notify.warning('Selecciona una orden de compra');
      return;
    }
    if (!this.receiptForm.receiptDate) {
      this.notify.warning('Indica la fecha de recepción');
      return;
    }
    if (!this.receiptForm.items.length) {
      this.notify.warning('La recepción debe incluir al menos una línea');
      return;
    }
    const validItems = this.receiptForm.items.filter((item) => this.sanitizeAmount(item.receivedQuantity) > 0);
    if (!validItems.length) {
      this.notify.warning('Registra al menos una cantidad recibida mayor que cero');
      return;
    }

    this.saving.set(true);
    this.http.post(this.RECEIPTS_API, {
      orderId: this.receiptForm.orderId,
      receiptDate: this.receiptForm.receiptDate,
      notes: this.receiptForm.notes || undefined,
      items: validItems.map((item, index) => ({
        orderItemId: item.orderItemId || undefined,
        description: item.description,
        orderedQuantity: item.orderedQuantity == null ? undefined : this.sanitizeAmount(item.orderedQuantity),
        receivedQuantity: this.sanitizeAmount(item.receivedQuantity),
        position: index + 1,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeReceiptModal();
        this.notify.success('Recepción registrada correctamente');
        this.loadReceipts();
        this.loadOrders();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible registrar la recepción');
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Facturas de proveedor
  // ────────────────────────────────────────────────────────────────────────────

  openPurchaseInvoiceModal() {
    this.purchaseInvoiceForm = this.emptyPurchaseInvoiceForm();
    this.showPurchaseInvoiceModal.set(true);
  }

  closePurchaseInvoiceModal() {
    this.showPurchaseInvoiceModal.set(false);
    this.purchaseInvoiceForm = this.emptyPurchaseInvoiceForm();
  }

  onPurchaseInvoiceOrderChange() {
    const orderId = this.purchaseInvoiceForm.purchaseOrderId;
    if (!orderId) {
      this.purchaseInvoiceForm.items = [];
      this.purchaseInvoiceForm.customerId = '';
      return;
    }

    this.http.get<PurchaseOrder>(`${this.ORDERS_API}/${orderId}`).subscribe({
      next: (order) => {
        const mapped = this.mapOrder(order);
        this.purchaseInvoiceForm.customerId = mapped.customer?.id ?? '';
        this.purchaseInvoiceForm.items = (mapped.lines ?? []).map((line, index) => ({
          orderItemId: (order as any)?.items?.[index]?.id,
          description: line.description,
          quantity: Number(line.quantity ?? 0),
          unitPrice: Number(line.unitPrice ?? 0),
          taxRate: Number(line.taxPercent ?? 19),
          discount: Number(line.discountPercent ?? 0),
        }));
      },
      error: () => this.notify.error('No fue posible cargar la orden para la factura del proveedor'),
    });
  }

  savePurchaseInvoice() {
    if (!this.purchaseInvoiceForm.customerId) {
      this.notify.warning('Selecciona un cliente para la factura de proveedor');
      return;
    }
    if (!this.purchaseInvoiceForm.supplierInvoiceNumber.trim()) {
      this.notify.warning('Ingresa el número de la factura del proveedor');
      return;
    }
    if (!this.purchaseInvoiceForm.issueDate) {
      this.notify.warning('Indica la fecha de emisión');
      return;
    }
    if (!this.purchaseInvoiceForm.items.length) {
      this.notify.warning('La factura debe incluir al menos una línea');
      return;
    }

    const invalidLine = this.purchaseInvoiceForm.items.find((line) =>
      !line.description?.trim() ||
      this.sanitizeAmount(line.quantity) <= 0 ||
      this.sanitizeAmount(line.unitPrice) < 0,
    );
    if (invalidLine) {
      this.notify.warning('Completa correctamente las líneas de la factura');
      return;
    }

    this.saving.set(true);
    this.http.post(this.PURCHASE_INVOICES_API, {
      customerId: this.purchaseInvoiceForm.customerId,
      purchaseOrderId: this.purchaseInvoiceForm.purchaseOrderId || undefined,
      receiptId: this.purchaseInvoiceForm.receiptId || undefined,
      supplierInvoiceNumber: this.purchaseInvoiceForm.supplierInvoiceNumber.trim(),
      issueDate: this.purchaseInvoiceForm.issueDate,
      dueDate: this.purchaseInvoiceForm.dueDate || undefined,
      notes: this.purchaseInvoiceForm.notes || undefined,
      items: this.purchaseInvoiceForm.items.map((item, index) => ({
        orderItemId: item.orderItemId || undefined,
        description: item.description.trim(),
        quantity: this.sanitizeAmount(item.quantity),
        unitPrice: this.sanitizeAmount(item.unitPrice),
        taxRate: this.sanitizePercent(item.taxRate),
        discount: this.sanitizePercent(item.discount),
        position: index + 1,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePurchaseInvoiceModal();
        this.notify.success('Factura de proveedor creada');
        this.loadPurchaseInvoices();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible crear la factura de proveedor');
      },
    });
  }

  postPurchaseInvoice(invoice: PurchaseInvoice) {
    this.saving.set(true);
    this.http.patch(`${this.PURCHASE_INVOICES_API}/${invoice.id}/post`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Factura contabilizada y cuenta por pagar generada');
        this.loadPurchaseInvoices();
        this.loadAccountsPayable();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible contabilizar la factura');
      },
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Cuentas por pagar
  // ────────────────────────────────────────────────────────────────────────────

  openPayablePaymentModal(payable: AccountPayable) {
    this.payablePaymentTarget.set(payable);
    this.payablePaymentForm = {
      ...this.emptyPayablePaymentForm(),
      amount: payable.balance,
    };
    this.showPayablePaymentModal.set(true);
  }

  closePayablePaymentModal() {
    this.showPayablePaymentModal.set(false);
    this.payablePaymentTarget.set(null);
    this.payablePaymentForm = this.emptyPayablePaymentForm();
  }

  savePayablePayment() {
    const payable = this.payablePaymentTarget();
    if (!payable) return;
    if (!this.payablePaymentForm.paymentDate) {
      this.notify.warning('Indica la fecha del pago');
      return;
    }
    if (this.sanitizeAmount(this.payablePaymentForm.amount) <= 0) {
      this.notify.warning('El valor del pago debe ser mayor que cero');
      return;
    }

    this.saving.set(true);
    this.http.post(`${this.ACCOUNTS_PAYABLE_API}/${payable.id}/payments`, {
      paymentDate: this.payablePaymentForm.paymentDate,
      amount: this.sanitizeAmount(this.payablePaymentForm.amount),
      paymentMethod: this.payablePaymentForm.paymentMethod,
      reference: this.payablePaymentForm.reference || undefined,
      notes: this.payablePaymentForm.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePayablePaymentModal();
        this.notify.success('Pago registrado correctamente');
        this.loadAccountsPayable();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible registrar el pago');
      },
    });
  }

  openPayableScheduleModal(payable: AccountPayable) {
    this.http.get<AccountPayable>(`${this.ACCOUNTS_PAYABLE_API}/${payable.id}`).subscribe({
      next: (detail) => {
        const mapped = this.mapAccountPayable(detail);
        this.payableScheduleTarget.set(mapped);
        const defaultDueDate = mapped.dueDate ? this.asInputDate(mapped.dueDate) : this.asInputDate(new Date().toISOString());
        const scheduleSource: Array<{ dueDate: string; amount: number; notes?: string }> = mapped.schedules?.length
          ? mapped.schedules.map((schedule) => ({
              dueDate: schedule.dueDate,
              amount: Number(schedule.balance ?? 0),
              notes: schedule.notes ?? '',
            }))
          : [{ dueDate: defaultDueDate, amount: mapped.balance, notes: '' }];
        this.payableScheduleForm = {
          schedules: scheduleSource.map((schedule) => ({
            dueDate: this.asInputDate(schedule.dueDate),
            amount: Number(schedule.amount ?? 0),
            notes: schedule.notes ?? '',
          })),
        };
        this.showPayableScheduleModal.set(true);
      },
      error: () => this.notify.error('No fue posible cargar la programación de pagos'),
    });
  }

  closePayableScheduleModal() {
    this.showPayableScheduleModal.set(false);
    this.payableScheduleTarget.set(null);
    this.payableScheduleForm = this.emptyPayableScheduleForm();
  }

  addPayableScheduleLine() {
    this.payableScheduleForm.schedules.push({
      dueDate: this.asInputDate(new Date().toISOString()),
      amount: null,
      notes: '',
    });
  }

  removePayableScheduleLine(index: number) {
    this.payableScheduleForm.schedules.splice(index, 1);
  }

  savePayableSchedule() {
    const payable = this.payableScheduleTarget();
    if (!payable) return;
    if (!this.payableScheduleForm.schedules.length) {
      this.notify.warning('Agrega al menos una cuota al cronograma');
      return;
    }
    const invalidLine = this.payableScheduleForm.schedules.find((line) => !line.dueDate || this.sanitizeAmount(line.amount) <= 0);
    if (invalidLine) {
      this.notify.warning('Cada cuota debe tener fecha de vencimiento y valor válido');
      return;
    }
    const totalScheduled = this.payableScheduleForm.schedules.reduce((sum, line) => sum + this.sanitizeAmount(line.amount), 0);
    if (Math.abs(totalScheduled - payable.balance) > 0.01) {
      this.notify.warning(`La suma del cronograma debe ser igual al saldo pendiente: ${this.formatCurrency(payable.balance)}`);
      return;
    }

    this.saving.set(true);
    this.http.post(`${this.ACCOUNTS_PAYABLE_API}/${payable.id}/schedules`, {
      schedules: this.payableScheduleForm.schedules.map((line) => ({
        dueDate: line.dueDate,
        amount: this.sanitizeAmount(line.amount),
        notes: line.notes || undefined,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePayableScheduleModal();
        this.notify.success('Cronograma de pago actualizado');
        this.loadAccountsPayable();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible guardar el cronograma');
      },
    });
  }

  openPurchaseAdvanceModal() {
    this.purchaseAdvanceForm = this.emptyPurchaseAdvanceForm();
    this.showPurchaseAdvanceModal.set(true);
  }

  closePurchaseAdvanceModal() {
    this.showPurchaseAdvanceModal.set(false);
    this.purchaseAdvanceForm = this.emptyPurchaseAdvanceForm();
  }

  savePurchaseAdvance() {
    if (!this.purchaseAdvanceForm.customerId) {
      this.notify.warning('Selecciona el proveedor del anticipo');
      return;
    }
    if (!this.purchaseAdvanceForm.issueDate) {
      this.notify.warning('Indica la fecha del anticipo');
      return;
    }
    if (this.sanitizeAmount(this.purchaseAdvanceForm.amount) <= 0) {
      this.notify.warning('El valor del anticipo debe ser mayor que cero');
      return;
    }

    this.saving.set(true);
    this.http.post(this.PURCHASE_ADVANCES_API, {
      customerId: this.purchaseAdvanceForm.customerId,
      issueDate: this.purchaseAdvanceForm.issueDate,
      amount: this.sanitizeAmount(this.purchaseAdvanceForm.amount),
      paymentMethod: this.purchaseAdvanceForm.paymentMethod,
      reference: this.purchaseAdvanceForm.reference || undefined,
      notes: this.purchaseAdvanceForm.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePurchaseAdvanceModal();
        this.notify.success('Anticipo registrado');
        this.loadPurchaseAdvances();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible registrar el anticipo');
      },
    });
  }

  openApplyAdvanceModal(advance: PurchaseAdvance) {
    this.advanceApplyTarget.set(advance);
    this.purchaseAdvanceApplyForm = {
      ...this.emptyPurchaseAdvanceApplyForm(),
      amount: advance.balance,
    };
    this.showApplyAdvanceModal.set(true);
  }

  closeApplyAdvanceModal() {
    this.showApplyAdvanceModal.set(false);
    this.advanceApplyTarget.set(null);
    this.purchaseAdvanceApplyForm = this.emptyPurchaseAdvanceApplyForm();
  }

  saveAdvanceApplication() {
    const advance = this.advanceApplyTarget();
    if (!advance) return;
    if (!this.purchaseAdvanceApplyForm.accountPayableId) {
      this.notify.warning('Selecciona la cuenta por pagar a la que aplicarás el anticipo');
      return;
    }
    if (this.sanitizeAmount(this.purchaseAdvanceApplyForm.amount) <= 0) {
      this.notify.warning('El valor aplicado debe ser mayor que cero');
      return;
    }
    this.saving.set(true);
    this.http.post(`${this.PURCHASE_ADVANCES_API}/${advance.id}/apply`, {
      accountPayableId: this.purchaseAdvanceApplyForm.accountPayableId,
      amount: this.sanitizeAmount(this.purchaseAdvanceApplyForm.amount),
      notes: this.purchaseAdvanceApplyForm.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeApplyAdvanceModal();
        this.notify.success('Anticipo aplicado a la cuenta por pagar');
        this.loadPurchaseAdvances();
        this.loadAccountsPayable();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible aplicar el anticipo');
      },
    });
  }

  openPurchaseAdjustmentModal() {
    this.purchaseAdjustmentForm = this.emptyPurchaseAdjustmentForm();
    this.showPurchaseAdjustmentModal.set(true);
  }

  closePurchaseAdjustmentModal() {
    this.showPurchaseAdjustmentModal.set(false);
    this.purchaseAdjustmentForm = this.emptyPurchaseAdjustmentForm();
    this.adjustmentPaymentOptions.set([]);
  }

  onAdjustmentPayableChange() {
    this.purchaseAdjustmentForm.paymentId = '';
    const payableId = this.purchaseAdjustmentForm.accountPayableId;
    if (!payableId) {
      this.adjustmentPaymentOptions.set([]);
      return;
    }
    this.http.get<AccountPayable>(`${this.ACCOUNTS_PAYABLE_API}/${payableId}`).subscribe({
      next: (payable) => this.adjustmentPaymentOptions.set((this.mapAccountPayable(payable).payments ?? [])),
      error: () => {
        this.adjustmentPaymentOptions.set([]);
        this.notify.error('No fue posible cargar los pagos de la cuenta por pagar');
      },
    });
  }

  savePurchaseAdjustment() {
    if (!this.purchaseAdjustmentForm.customerId) {
      this.notify.warning('Selecciona un cliente para el ajuste');
      return;
    }
    if (this.sanitizeAmount(this.purchaseAdjustmentForm.amount) <= 0) {
      this.notify.warning('El valor del ajuste debe ser mayor que cero');
      return;
    }
    if (!this.purchaseAdjustmentForm.reason.trim()) {
      this.notify.warning('Indica el motivo del ajuste');
      return;
    }

    this.saving.set(true);
    this.http.post(this.PURCHASE_ADJUSTMENTS_API, {
      customerId: this.purchaseAdjustmentForm.customerId,
      type: this.purchaseAdjustmentForm.type,
      receiptId: this.purchaseAdjustmentForm.receiptId || undefined,
      purchaseInvoiceId: this.purchaseAdjustmentForm.purchaseInvoiceId || undefined,
      accountPayableId: this.purchaseAdjustmentForm.accountPayableId || undefined,
      paymentId: this.purchaseAdjustmentForm.paymentId || undefined,
      amount: this.sanitizeAmount(this.purchaseAdjustmentForm.amount),
      reason: this.purchaseAdjustmentForm.reason.trim(),
      notes: this.purchaseAdjustmentForm.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closePurchaseAdjustmentModal();
        this.notify.success('Ajuste enviado a aprobación');
        this.loadPurchaseAdjustments();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible crear el ajuste');
      },
    });
  }

  approvePurchaseAdjustment(adjustment: PurchaseAdjustment) {
    this.saving.set(true);
    this.http.patch(`${this.PURCHASE_ADJUSTMENTS_API}/${adjustment.id}/approve`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Ajuste aprobado y aplicado');
        this.loadPurchaseAdjustments();
        this.loadReceipts();
        this.loadPurchaseInvoices();
        this.loadAccountsPayable();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible aprobar el ajuste');
      },
    });
  }

  rejectPurchaseAdjustment(adjustment: PurchaseAdjustment) {
    this.saving.set(true);
    this.http.patch(`${this.PURCHASE_ADJUSTMENTS_API}/${adjustment.id}/reject`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Ajuste rechazado');
        this.loadPurchaseAdjustments();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible rechazar el ajuste');
      },
    });
  }

  openSupplierQuoteModal() {
    this.supplierQuoteForm = this.emptySupplierQuoteForm();
    this.showSupplierQuoteModal.set(true);
  }

  closeSupplierQuoteModal() {
    this.showSupplierQuoteModal.set(false);
    this.supplierQuoteForm = this.emptySupplierQuoteForm();
  }

  addSupplierQuoteLine() {
    this.supplierQuoteForm.items.push({
      description: '',
      quantity: null,
      unitPrice: null,
      taxRate: 19,
    });
  }

  removeSupplierQuoteLine(index: number) {
    this.supplierQuoteForm.items.splice(index, 1);
  }

  onSupplierQuoteRequestChange() {
    const requestId = this.supplierQuoteForm.purchaseRequestId;
    if (!requestId) {
      this.supplierQuoteForm.items = [];
      return;
    }
    this.http.get<PurchaseRequest>(`${this.REQUESTS_API}/${requestId}`).subscribe({
      next: (request) => {
        const mapped = this.mapRequest(request);
        this.supplierQuoteForm.items = (mapped.items ?? []).map((item) => ({
          requestItemId: item.id,
          description: item.description,
          quantity: Number(item.quantity ?? 0),
          unitPrice: item.estimatedUnitPrice ?? null,
          taxRate: 19,
        }));
      },
      error: () => this.notify.error('No fue posible cargar la solicitud de compra'),
    });
  }

  saveSupplierQuote() {
    if (!this.supplierQuoteForm.customerId) {
      this.notify.warning('Selecciona el cliente/proveedor de la cotización');
      return;
    }
    if (!this.supplierQuoteForm.items.length) {
      this.notify.warning('Agrega al menos una línea a la cotización');
      return;
    }
    const invalidLine = this.supplierQuoteForm.items.find((item) =>
      !item.description?.trim() ||
      this.sanitizeAmount(item.quantity) <= 0 ||
      this.sanitizeAmount(item.unitPrice) <= 0,
    );
    if (invalidLine) {
      this.notify.warning('Completa todas las líneas con descripción, cantidad y precio válidos');
      return;
    }
    this.saving.set(true);
    this.http.post(this.SUPPLIER_QUOTES_API, {
      customerId: this.supplierQuoteForm.customerId,
      purchaseRequestId: this.supplierQuoteForm.purchaseRequestId || undefined,
      validUntil: this.supplierQuoteForm.validUntil || undefined,
      leadTimeDays: this.supplierQuoteForm.leadTimeDays ?? undefined,
      paymentTermDays: this.supplierQuoteForm.paymentTermDays ?? undefined,
      notes: this.supplierQuoteForm.notes || undefined,
      items: this.supplierQuoteForm.items.map((item, index) => ({
        requestItemId: item.requestItemId || undefined,
        description: item.description,
        quantity: this.sanitizeAmount(item.quantity),
        unitPrice: this.sanitizeAmount(item.unitPrice),
        taxRate: this.sanitizePercent(item.taxRate),
        position: index + 1,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeSupplierQuoteModal();
        this.notify.success('Cotización de proveedor registrada');
        this.loadSupplierQuotes();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible registrar la cotización');
      },
    });
  }

  awardSupplierQuote(quote: SupplierQuote) {
    this.saving.set(true);
    this.http.post(`${this.SUPPLIER_QUOTES_API}/${quote.id}/award`, {
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: quote.validUntil || undefined,
      notes: quote.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success('Cotización adjudicada y orden creada');
        this.loadSupplierQuotes();
        this.loadOrders();
        this.loadRequests();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible adjudicar la cotización');
      },
    });
  }

  openFrameworkAgreementModal() {
    this.frameworkAgreementForm = this.emptyFrameworkAgreementForm();
    this.showFrameworkAgreementModal.set(true);
  }

  closeFrameworkAgreementModal() {
    this.showFrameworkAgreementModal.set(false);
    this.frameworkAgreementForm = this.emptyFrameworkAgreementForm();
  }

  addFrameworkAgreementLine() {
    this.frameworkAgreementForm.items.push({
      description: '',
      unitPrice: null,
      taxRate: 19,
      minQuantity: null,
      notes: '',
    });
  }

  removeFrameworkAgreementLine(index: number) {
    this.frameworkAgreementForm.items.splice(index, 1);
  }

  saveFrameworkAgreement() {
    if (!this.frameworkAgreementForm.customerId) {
      this.notify.warning('Selecciona el cliente/proveedor del acuerdo');
      return;
    }
    if (!this.frameworkAgreementForm.title.trim()) {
      this.notify.warning('Ingresa el título del acuerdo');
      return;
    }
    if (!this.frameworkAgreementForm.startDate) {
      this.notify.warning('Indica la fecha inicial del acuerdo');
      return;
    }
    if (!this.frameworkAgreementForm.items.length) {
      this.notify.warning('Agrega al menos una línea al acuerdo marco');
      return;
    }
    const invalidLine = this.frameworkAgreementForm.items.find((item) =>
      !item.description?.trim() || this.sanitizeAmount(item.unitPrice) <= 0,
    );
    if (invalidLine) {
      this.notify.warning('Completa cada línea del acuerdo con descripción y precio válidos');
      return;
    }
    this.saving.set(true);
    this.http.post(this.FRAMEWORK_AGREEMENTS_API, {
      customerId: this.frameworkAgreementForm.customerId,
      title: this.frameworkAgreementForm.title.trim(),
      startDate: this.frameworkAgreementForm.startDate,
      endDate: this.frameworkAgreementForm.endDate || undefined,
      paymentTermDays: this.frameworkAgreementForm.paymentTermDays ?? undefined,
      leadTimeDays: this.frameworkAgreementForm.leadTimeDays ?? undefined,
      notes: this.frameworkAgreementForm.notes || undefined,
      items: this.frameworkAgreementForm.items.map((item, index) => ({
        description: item.description,
        unitPrice: this.sanitizeAmount(item.unitPrice),
        taxRate: this.sanitizePercent(item.taxRate),
        minQuantity: item.minQuantity == null ? undefined : this.sanitizeAmount(item.minQuantity),
        notes: item.notes || undefined,
        position: index + 1,
      })),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeFrameworkAgreementModal();
        this.notify.success('Acuerdo marco registrado');
        this.loadFrameworkAgreements();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message || 'No fue posible registrar el acuerdo marco');
      },
    });
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
      budgetId: order.budget?.id ?? order.budgetId ?? '',
      requestingArea: order.requestingArea ?? '',
      costCenter: order.costCenter ?? '',
      projectCode: order.projectCode ?? '',
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
      budgetId: this.orderForm.budgetId || undefined,
      issueDate: this.orderForm.issueDate,
      dueDate: this.orderForm.dueDate || undefined,
      notes: this.orderForm.notes || undefined,
      requestingArea: this.orderForm.requestingArea || undefined,
      costCenter: this.orderForm.costCenter || undefined,
      projectCode: this.orderForm.projectCode || undefined,
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

  requestStatusLabel(status: RequestStatus | string): string {
    return REQUEST_STATUS_LABELS[status as RequestStatus] ?? status;
  }

  receiptStatusLabel(status: ReceiptStatus | string): string {
    return RECEIPT_STATUS_LABELS[status as ReceiptStatus] ?? status;
  }

  purchaseInvoiceStatusLabel(status: PurchaseInvoiceStatus | string): string {
    return PURCHASE_INVOICE_STATUS_LABELS[status as PurchaseInvoiceStatus] ?? status;
  }

  accountPayableStatusLabel(status: AccountPayableStatus | string): string {
    return ACCOUNT_PAYABLE_STATUS_LABELS[status as AccountPayableStatus] ?? status;
  }

  purchaseAdjustmentStatusLabel(status: PurchaseAdjustmentStatus | string): string {
    return PURCHASE_ADJUSTMENT_STATUS_LABELS[status as PurchaseAdjustmentStatus] ?? status;
  }

  purchaseAdjustmentTypeLabel(type: PurchaseAdjustmentType | string): string {
    return PURCHASE_ADJUSTMENT_TYPE_LABELS[type as PurchaseAdjustmentType] ?? type;
  }

  supplierQuoteStatusLabel(status: SupplierQuoteStatus | string): string {
    return SUPPLIER_QUOTE_STATUS_LABELS[status as SupplierQuoteStatus] ?? status;
  }

  frameworkAgreementStatusLabel(status: FrameworkAgreementStatus | string): string {
    return FRAMEWORK_AGREEMENT_STATUS_LABELS[status as FrameworkAgreementStatus] ?? status;
  }

  purchaseBudgetStatusLabel(status: PurchaseBudgetStatus | string): string {
    return PURCHASE_BUDGET_STATUS_LABELS[status as PurchaseBudgetStatus] ?? status;
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

  private mapRequest(request: any): PurchaseRequest {
    return {
      ...request,
      customer: request?.customer ?? null,
      items: request?.items?.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        estimatedUnitPrice: item.estimatedUnitPrice == null ? null : Number(item.estimatedUnitPrice),
      })),
      linkedOrders: request?.linkedOrders?.map((order: any) => ({
        ...order,
        orderNumber: order.orderNumber ?? order.number,
        total: Number(order.total ?? 0),
      })),
    };
  }

  private mapReceipt(receipt: any): PurchaseReceipt {
    return {
      ...receipt,
      items: receipt?.items?.map((item: any) => ({
        ...item,
        orderedQuantity: item.orderedQuantity == null ? null : Number(item.orderedQuantity),
        receivedQuantity: Number(item.receivedQuantity ?? 0),
      })),
    };
  }

  private mapPurchaseInvoice(invoice: any): PurchaseInvoice {
    return {
      ...invoice,
      subtotal: Number(invoice?.subtotal ?? 0),
      taxAmount: Number(invoice?.taxAmount ?? 0),
      total: Number(invoice?.total ?? 0),
      accountPayable: invoice?.accountPayable
        ? {
            ...invoice.accountPayable,
            balance: Number(invoice.accountPayable.balance ?? 0),
          }
        : null,
      items: invoice?.items?.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        discount: Number(item.discount ?? 0),
        total: Number(item.total ?? 0),
      })),
    };
  }

  private mapAccountPayable(payable: any): AccountPayable {
    return {
      ...payable,
      originalAmount: Number(payable?.originalAmount ?? 0),
      paidAmount: Number(payable?.paidAmount ?? 0),
      balance: Number(payable?.balance ?? 0),
      schedules: payable?.schedules?.map((schedule: any) => ({
        ...schedule,
        amount: Number(schedule.amount ?? 0),
        paidAmount: Number(schedule.paidAmount ?? 0),
        balance: Number(schedule.balance ?? 0),
      })),
      advances: payable?.advances?.map((application: any) => ({
        ...application,
        amount: Number(application.amount ?? 0),
      })),
      payments: payable?.payments?.map((payment: any) => ({
        ...payment,
        amount: Number(payment.amount ?? 0),
      })),
    };
  }

  private mapPurchaseAdvance(advance: any): PurchaseAdvance {
    return {
      ...advance,
      amount: Number(advance?.amount ?? 0),
      appliedAmount: Number(advance?.appliedAmount ?? 0),
      balance: Number(advance?.balance ?? 0),
      applications: advance?.applications?.map((application: any) => ({
        ...application,
        amount: Number(application.amount ?? 0),
      })),
    };
  }

  private mapTraceabilityRow(row: any): PurchasingTraceabilityRow {
    return {
      ...row,
      orderTotal: Number(row?.orderTotal ?? 0),
      receiptsCount: Number(row?.receiptsCount ?? 0),
      postedReceiptsCount: Number(row?.postedReceiptsCount ?? 0),
      invoicesCount: Number(row?.invoicesCount ?? 0),
      payablesCount: Number(row?.payablesCount ?? 0),
      pendingBalance: Number(row?.pendingBalance ?? 0),
    };
  }

  private mapPurchaseAdjustment(adjustment: any): PurchaseAdjustment {
    return {
      ...adjustment,
      amount: Number(adjustment?.amount ?? 0),
    };
  }

  private mapPurchaseBudget(budget: any): PurchaseBudget {
    return {
      ...budget,
      amount: Number(budget?.amount ?? 0),
      committedAmount: Number(budget?.committedAmount ?? 0),
      executedAmount: Number(budget?.executedAmount ?? 0),
      availableAmount: Number(budget?.availableAmount ?? 0),
    };
  }

  private mapSupplierQuote(quote: any): SupplierQuote {
    return {
      ...quote,
      subtotal: Number(quote?.subtotal ?? 0),
      taxAmount: Number(quote?.taxAmount ?? 0),
      total: Number(quote?.total ?? 0),
      score: quote?.score == null ? null : Number(quote.score),
      items: quote?.items?.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        total: Number(item.total ?? 0),
      })),
    };
  }

  private mapFrameworkAgreement(agreement: any): FrameworkAgreement {
    return {
      ...agreement,
      items: agreement?.items?.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        minQuantity: item.minQuantity == null ? null : Number(item.minQuantity),
      })),
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
      budgetId: '',
      requestingArea: '',
      costCenter: '',
      projectCode: '',
      issueDate:  today,
      dueDate:    '',
      notes:      '',
      lines:      [],
    };
  }

  private emptyRequestForm(): RequestForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      customerId: '',
      budgetId: '',
      requestingArea: '',
      costCenter: '',
      projectCode: '',
      requestDate: today,
      neededByDate: '',
      notes: '',
      items: [{ description: '', quantity: null, estimatedUnitPrice: null }],
    };
  }

  private emptyReceiptForm(): ReceiptForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      orderId: '',
      receiptDate: today,
      notes: '',
      items: [],
    };
  }

  private emptyPurchaseInvoiceForm(): PurchaseInvoiceForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      customerId: '',
      purchaseOrderId: '',
      receiptId: '',
      supplierInvoiceNumber: '',
      issueDate: today,
      dueDate: '',
      notes: '',
      items: [],
    };
  }

  private emptyPayablePaymentForm(): PayablePaymentForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      paymentDate: today,
      amount: null,
      paymentMethod: 'TRANSFER',
      reference: '',
      notes: '',
    };
  }

  private emptyPayableScheduleForm(): PayableScheduleForm {
    return {
      schedules: [{ dueDate: this.asInputDate(new Date().toISOString()), amount: null, notes: '' }],
    };
  }

  private emptyPurchaseAdvanceForm(): PurchaseAdvanceForm {
    return {
      customerId: '',
      issueDate: this.asInputDate(new Date().toISOString()),
      amount: null,
      paymentMethod: 'TRANSFER',
      reference: '',
      notes: '',
    };
  }

  private emptyPurchaseAdvanceApplyForm(): PurchaseAdvanceApplyForm {
    return {
      accountPayableId: '',
      amount: null,
      notes: '',
    };
  }

  private emptyPurchaseAdjustmentForm(): PurchaseAdjustmentForm {
    return {
      customerId: '',
      type: 'RETURN',
      receiptId: '',
      purchaseInvoiceId: '',
      accountPayableId: '',
      paymentId: '',
      amount: null,
      reason: '',
      notes: '',
    };
  }

  private emptyPurchaseBudgetForm(): PurchaseBudgetForm {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: '',
      status: 'DRAFT',
      amount: null,
      startDate: today,
      endDate: '',
      area: '',
      costCenter: '',
      projectCode: '',
      notes: '',
    };
  }

  private emptySupplierQuoteForm(): SupplierQuoteForm {
    return {
      customerId: '',
      purchaseRequestId: '',
      validUntil: '',
      leadTimeDays: null,
      paymentTermDays: null,
      notes: '',
      items: [{ description: '', quantity: null, unitPrice: null, taxRate: 19 }],
    };
  }

  private emptyFrameworkAgreementForm(): FrameworkAgreementForm {
    const today = new Date().toISOString().slice(0, 10);
    return {
      customerId: '',
      title: '',
      startDate: today,
      endDate: '',
      paymentTermDays: null,
      leadTimeDays: null,
      notes: '',
      items: [{ description: '', unitPrice: null, taxRate: 19, minQuantity: null, notes: '' }],
    };
  }
}
