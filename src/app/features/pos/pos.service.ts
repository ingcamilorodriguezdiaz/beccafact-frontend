import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PosSession {
  id: string;
  companyId: string;
  userId: string;
  status: 'OPEN' | 'PENDING_CLOSE_APPROVAL' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  finalCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  countedCash?: number;
  closeRequestedAt?: string;
  closeApprovedAt?: string;
  closeRejectedAt?: string;
  closeRejectedReason?: string;
  lastHeartbeatAt?: string;
  offlineSinceAt?: string | null;
  offlineQueueDepth?: number;
  closingDenominations?: Record<string, number>;
  totalSales: number;
  totalTransactions: number;
  notes?: string;
  branch?: { id: string; name: string };
  terminal?: PosTerminal;
  shiftTemplate?: PosShiftTemplate;
  closeRequestedBy?: { id: string; firstName: string; lastName: string };
  closeApprovedBy?: { id: string; firstName: string; lastName: string };
  reopenedBy?: { id: string; firstName: string; lastName: string };
  user: { id: string; firstName: string; lastName: string; email?: string };
  _count?: { sales: number };
}

export interface PosTerminal {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  cashRegisterName?: string | null;
  deviceName?: string | null;
  printerName?: string | null;
  printerConnectionType?: string | null;
  printerPaperWidth: number;
  invoicePrefix?: string | null;
  receiptPrefix?: string | null;
  resolutionNumber?: string | null;
  resolutionLabel?: string | null;
  defaultPriceListId?: string | null;
  defaultInventoryLocationId?: string | null;
  isActive: boolean;
  isDefault: boolean;
  autoPrintReceipt: boolean;
  autoPrintInvoice: boolean;
  requireCustomerForInvoice: boolean;
  allowOpenDrawer: boolean;
  parameters?: Record<string, any> | null;
  lastHeartbeatAt?: string | null;
  heartbeatMeta?: Record<string, any> | null;
  heartbeatSlaSeconds?: number;
  branch?: { id: string; name: string } | null;
  defaultPriceList?: { id: string; name: string } | null;
  defaultInventoryLocation?: { id: string; name: string; code: string } | null;
}

export interface PosShiftTemplate {
  id: string;
  branchId?: string | null;
  code?: string | null;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  requiresBlindClose: boolean;
  isActive: boolean;
  parameters?: Record<string, any> | null;
  branch?: { id: string; name: string } | null;
}

export interface PosPriceListItem {
  id: string;
  productId: string;
  price: number;
  minQuantity?: number | null;
  product?: { id: string; name: string; sku: string };
}

export interface PosPriceList {
  id: string;
  branchId?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  isActive: boolean;
  isDefault: boolean;
  items: PosPriceListItem[];
}

export interface PosPromotion {
  id: string;
  branchId?: string | null;
  customerId?: string | null;
  productId?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  type: 'PRODUCT' | 'CUSTOMER' | 'ORDER' | 'VOLUME' | 'SCHEDULE';
  discountMode: 'PERCENT' | 'FIXED';
  discountValue: number;
  minQuantity?: number | null;
  minSubtotal?: number | null;
  daysOfWeek?: number[] | null;
  startTime?: string | null;
  endTime?: string | null;
  priority: number;
  stackable: boolean;
  customer?: { id: string; name: string; documentNumber: string } | null;
  product?: { id: string; name: string; sku: string } | null;
}

export interface PosCombo {
  id: string;
  branchId?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  comboPrice: number;
  isActive: boolean;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    product?: { id: string; name: string; sku: string };
  }>;
}

export interface PosLoyaltyCampaign {
  id: string;
  branchId?: string | null;
  customerId?: string | null;
  code?: string | null;
  name: string;
  description?: string | null;
  targetSegment?: string | null;
  targetTier?: string | null;
  minSubtotal?: number | null;
  pointsPerAmount: number;
  amountStep: number;
  bonusPoints: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
  customer?: { id: string; name: string; documentNumber: string } | null;
}

export interface PosCoupon {
  id: string;
  branchId?: string | null;
  customerId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  discountMode: 'PERCENT' | 'FIXED';
  discountValue: number;
  pointsCost: number;
  minSubtotal?: number | null;
  targetSegment?: string | null;
  targetTier?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  customer?: { id: string; name: string; documentNumber: string } | null;
}

export interface PosExternalOrder {
  id: string;
  branchId?: string | null;
  customerId?: string | null;
  channel: string;
  externalOrderNumber: string;
  status: string;
  orderType: 'IN_STORE' | 'PICKUP' | 'DELIVERY' | 'LAYAWAY' | 'PREORDER';
  scheduledAt?: string | null;
  deliveryAddress?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  syncedAt?: string | null;
  customer?: { id: string; name: string; documentNumber: string } | null;
  sales?: Array<{ id: string; saleNumber: string; status: string; total: number; orderStatus: string }>;
}

export interface PosCustomerLoyaltyProfile {
  customer: {
    id: string;
    name: string;
    documentNumber: string;
    loyaltyCode?: string | null;
    membershipTier?: string | null;
    customerSegment?: string | null;
    loyaltyPointsBalance: number;
    loyaltyPointsEarned: number;
    loyaltyPointsRedeemed: number;
    lastPurchaseAt?: string | null;
  };
  metrics: {
    salesCount: number;
    totalSpent: number;
    averageTicket: number;
  };
  recentSales: Array<{
    id: string;
    saleNumber: string;
    total: number;
    status: string;
    createdAt: string;
    loyaltyPointsEarned: number;
    invoice?: { id: string; invoiceNumber: string; status: string } | null;
  }>;
  transactions: Array<{
    id: string;
    type: 'EARN' | 'REDEEM' | 'ADJUSTMENT';
    points: number;
    amountBase?: number | null;
    description?: string | null;
    createdAt: string;
    loyaltyCampaign?: { id: string; name: string } | null;
    sale?: { id: string; saleNumber: string } | null;
  }>;
}

export interface PosInventoryLocation {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  type: 'STORE' | 'BACKROOM' | 'WAREHOUSE' | 'TRANSIT';
  isDefault: boolean;
  isActive: boolean;
  allowPosSales: boolean;
  branch?: { id: string; name: string } | null;
  _count?: { stocks: number };
}

export interface PosInventoryStock {
  id: string;
  locationId: string;
  productId: string;
  lotNumber?: string | null;
  serialNumber?: string | null;
  expiresAt?: string | null;
  quantity: number;
  reservedQuantity: number;
  location?: { id: string; name: string; code: string };
  product?: { id: string; name: string; sku: string; stock: number };
}

export interface PosInventoryTransfer {
  id: string;
  reference: string;
  status: 'PENDING' | 'POSTED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  postedAt?: string | null;
  fromBranch?: { id: string; name: string } | null;
  toBranch?: { id: string; name: string } | null;
  fromLocation?: { id: string; name: string; code: string };
  toLocation?: { id: string; name: string; code: string };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    lotNumber?: string | null;
    serialNumber?: string | null;
    expiresAt?: string | null;
    product?: { id: string; name: string; sku: string };
  }>;
}

export interface PosCatalogProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  taxRate: number;
  taxType: string;
  stock: number;
  unit: string;
  minStock?: number;
  availableStock: number;
  reservedStock: number;
  hasInventoryDetail: boolean;
  inventoryLocations: Array<{
    stockId: string;
    locationId: string;
    locationName: string;
    locationCode: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    lotNumber?: string | null;
    serialNumber?: string | null;
    expiresAt?: string | null;
  }>;
}

export type PosGovernanceAction =
  | 'MANUAL_DISCOUNT'
  | 'CASH_WITHDRAWAL'
  | 'CANCEL_SALE'
  | 'REFUND_SALE'
  | 'REOPEN_SESSION'
  | 'APPROVE_POST_SALE';

export interface PosGovernanceRule {
  id?: string | null;
  action: PosGovernanceAction;
  allowedRoles: string[];
  requiresSupervisorOverride: boolean;
  maxDiscountPct?: number | null;
  maxAmountThreshold?: number | null;
  isActive: boolean;
  notes?: string | null;
}

export interface PosSupervisorOverride {
  id: string;
  action: PosGovernanceAction;
  resourceType: string;
  resourceId?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED';
  reason: string;
  requestedPayload?: Record<string, any> | null;
  decisionNotes?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  consumedAt?: string | null;
  createdAt: string;
  requestedBy?: { id: string; firstName: string; lastName: string } | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface PosAuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  createdAt: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  user?: { id: string; firstName: string; lastName: string; email?: string } | null;
}

export interface PosOperatingConfig {
  company?: {
    id: string;
    name: string;
    dianPosResolucion?: string | null;
    dianPosPrefijo?: string | null;
    dianPosRangoDesde?: number | null;
    dianPosRangoHasta?: number | null;
    dianPosFechaDesde?: string | null;
    dianPosFechaHasta?: string | null;
  } | null;
  branch?: { id: string; name: string; city?: string | null; address?: string | null } | null;
  terminals: PosTerminal[];
  shifts: PosShiftTemplate[];
  priceLists: PosPriceList[];
  promotions: PosPromotion[];
  combos: PosCombo[];
  loyaltyCampaigns: PosLoyaltyCampaign[];
  coupons: PosCoupon[];
  externalOrders: PosExternalOrder[];
  inventoryLocations: PosInventoryLocation[];
  inventoryTransfers: PosInventoryTransfer[];
  defaults?: {
    terminalId?: string | null;
    shiftTemplateId?: string | null;
    priceListId?: string | null;
    inventoryLocationId?: string | null;
  };
  fiscal?: {
    resolutionNumber?: string | null;
    prefix?: string | null;
    rangeFrom?: number | null;
    rangeTo?: number | null;
    validFrom?: string | null;
    validTo?: string | null;
  };
  governance?: {
    rules: PosGovernanceRule[];
    pendingOverrides: PosSupervisorOverride[];
    recentOverrides: PosSupervisorOverride[];
    recentAudit: PosAuditEntry[];
  };
}

export interface PosSaleItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  subtotal: number;
  total: number;
  product?: { id: string; name: string; sku: string };
}

export interface PosPostSaleRequest {
  id: string;
  type: 'RETURN' | 'EXCHANGE';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  reasonCode:
    | 'DEFECTIVE_PRODUCT'
    | 'WRONG_PRODUCT'
    | 'CUSTOMER_DISSATISFACTION'
    | 'BILLING_ERROR'
    | 'WARRANTY'
    | 'OTHER';
  reasonDetail?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  approvalNotes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  sale?: {
    id: string;
    saleNumber: string;
    total?: number;
    status?: string;
    customer?: { id: string; name: string; documentNumber: string } | null;
    invoice?: { id: string; invoiceNumber: string; status: string } | null;
  };
  creditNoteInvoice?: { id: string; invoiceNumber: string; status: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  items: Array<{
    id: string;
    lineType: 'RETURN' | 'REPLACEMENT';
    saleItemId?: string | null;
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    subtotal: number;
    total: number;
    product?: { id: string; name: string; sku: string } | null;
    saleItem?: { id: string; description: string; quantity: number } | null;
  }>;
}

export type PosPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'TRANSFER'
  | 'MIXED'
  | 'DATAPHONE'
  | 'WALLET'
  | 'VOUCHER'
  | 'GIFT_CARD'
  | 'AGREEMENT';

export interface PosSalePayment {
  id: string;
  paymentMethod: PosPaymentMethod;
  amount: number;
  transactionReference?: string;
  providerName?: string;
  notes?: string;
  createdAt: string;
}

export interface PosPricingPreview {
  items: Array<{
    index: number;
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    manualDiscount: number;
    promoDiscount: number;
    appliedPromotions: string[];
    subtotal: number;
    taxAmount: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  orderPromotionDiscount: number;
  comboDiscount: number;
  manualDiscountAmount: number;
  total: number;
  priceList?: { id: string; name: string } | null;
  appliedCombos: Array<{ comboId: string; comboName: string; discount: number }>;
  appliedOrderPromotions: string[];
}

export interface PosSalesAnalytics {
  kpis: {
    totalSales: number;
    completedCount: number;
    avgTicket: number;
    grossMarginAmount: number;
    grossMarginPct: number;
    totalDiscounts: number;
    totalRefunded: number;
    totalCancelled: number;
    refundRate: number;
    approvedReturns: number;
  };
  byTerminal: Array<{
    terminalId: string;
    terminalName: string;
    sales: number;
    transactions: number;
    avgTicket: number;
    refunds: number;
  }>;
  byCashier: Array<{
    cashierId: string;
    cashierName: string;
    sales: number;
    transactions: number;
    margin: number;
    refunds: number;
    avgTicket: number;
    productivityScore: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    sales: number;
    transactions: number;
    avgTicket: number;
  }>;
  byHour: Array<{
    hour: number;
    sales: number;
    transactions: number;
    avgTicket: number;
  }>;
  byPaymentMethod: Array<{
    paymentMethod: string;
    total: number;
    count: number;
  }>;
  productivity: Array<{
    cashierId: string;
    cashierName: string;
    sales: number;
    transactions: number;
    margin: number;
    refunds: number;
    avgTicket: number;
    productivityScore: number;
  }>;
}

export interface PosIntegrationSummary {
  accounting: {
    completedSales: number;
    integratedSales: number;
    refundedSales: number;
    integratedRefunds: number;
    cashMovements: number;
    integratedCashMovements: number;
    failures: number;
    recentActivity: Array<{
      id: string;
      resourceType: string;
      resourceId: string;
      status: string;
      message?: string | null;
      createdAt: string;
    }>;
  };
  cartera: {
    pendingCount: number;
    pendingAmount: number;
    recentPending: Array<{
      id: string;
      saleNumber: string;
      customerName: string;
      remainingAmount: number;
    }>;
  };
  purchasing: {
    replenishmentCount: number;
    requestCount: number;
    suggestedProducts: Array<{
      id: string;
      name: string;
      sku: string;
      stock: number;
      minStock: number;
    }>;
    recentRequests: Array<{
      id: string;
      reference: string;
      message?: string | null;
      createdAt: string;
    }>;
  };
  inventory: {
    openReservations: number;
    reservedUnits: number;
    pendingTransfers: number;
    discrepancyCount: number;
  };
  loyalty: {
    activeCampaigns: number;
    issuedPoints: number;
    redeemedPoints: number;
    redeemedAmount: number;
    activeCoupons: number;
  };
  ecommerce: {
    channels: Array<{
      orderType: string;
      orderStatus: string;
      count: number;
      total: number;
    }>;
    externalOrders: Array<{
      channel: string;
      status: string;
      count: number;
      total: number;
    }>;
  };
  banks: {
    electronicPayments: number;
    referencedPayments: number;
    matchedBankMovements: number;
    reconciledBankMovements: number;
    pendingReconciliation: number;
    latestBatch?: {
      id: string;
      reference: string;
      createdAt: string;
      matchedPayments: number;
      reconciledPayments: number;
    } | null;
  };
  traces: Array<{
    id: string;
    module: string;
    sourceType: string;
    sourceId: string;
    targetType?: string | null;
    targetId?: string | null;
    status: string;
    message?: string | null;
    createdAt: string;
  }>;
}

export interface PosCustomerAccountStatement {
  customer: {
    id: string;
    name: string;
    documentNumber: string;
    loyaltyPointsBalance: number;
    membershipTier?: string | null;
    customerSegment?: string | null;
  };
  cartera?: any;
  pos: {
    pendingCount: number;
    pendingAmount: number;
    recentPending: Array<{
      id: string;
      saleNumber: string;
      total: number;
      remainingAmount: number;
      createdAt: string;
      orderType: string;
      paymentMethod: string;
    }>;
  };
  summary: {
    posPendingAmount: number;
    carteraBalance: number;
    combinedExposure: number;
  };
}

export interface PosMultiBranchOverview {
  generatedAt: string;
  totals: {
    branches: number;
    terminals: number;
    onlineTerminals: number;
    openSessions: number;
    pendingOmnichannel: number;
    pendingTransfers: number;
    openIncidents: number;
    slaBreaches: number;
  };
  branches: Array<{
    branchId: string;
    branchName: string;
    city?: string | null;
    isMain: boolean;
    terminalsTotal: number;
    terminalsOnline: number;
    openSessions: number;
    activeCashiers: number;
    salesToday: number;
    avgTicketToday: number;
    pendingOrders: number;
    reservedUnits: number;
    pendingTransfersIn: number;
    pendingTransfersOut: number;
    openIncidents: number;
    criticalIncidents: number;
    lastHeartbeatAt?: string | null;
  }>;
  terminals: Array<{
    terminalId: string;
    code: string;
    name: string;
    branchId?: string | null;
    isDefault: boolean;
    lastHeartbeatAt?: string | null;
    heartbeatStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    openIncidents: number;
  }>;
  sessions: Array<{
    sessionId: string;
    branchId?: string | null;
    terminalId?: string | null;
    terminalCode?: string | null;
    cashierId: string;
    lastHeartbeatAt?: string | null;
    heartbeatStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    offlineQueueDepth?: number;
  }>;
  incidents: PosOperationalIncident[];
  deployments: PosConfigDeployment[];
}

export interface PosSale {
  id: string;
  companyId: string;
  sessionId: string;
  clientSyncId?: string | null;
  orderType: 'IN_STORE' | 'PICKUP' | 'DELIVERY' | 'LAYAWAY' | 'PREORDER';
  orderStatus: 'OPEN' | 'READY' | 'IN_TRANSIT' | 'CLOSED' | 'CANCELLED';
  saleNumber: string;
  orderReference?: string | null;
  scheduledAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  deliveryAddress?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  dispatchNotes?: string | null;
  isPreOrder?: boolean;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: PosPaymentMethod;
  amountPaid: number;
  change: number;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'ADVANCE';
  advanceAmount: number;
  remainingAmount: number;
  deliveryStatus: 'PENDING' | 'DELIVERED';
  notes?: string;
  createdAt: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  inventoryLocation?: { id: string; name: string; code: string } | null;
  invoiceId?: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: string;
    dianZipKey?: string;
    dianStatusCode?: string;
    dianStatusMsg?: string;
    dianCufe?: string;
    dianQrCode?: string;
    dianSentAt?: string;
  };
  customer?: { id: string; name: string; documentNumber: string; documentType?: string };
  items: PosSaleItem[];
  payments?: PosSalePayment[];
  postSaleRequests?: PosPostSaleRequest[];
  loyaltyCampaign?: { id: string; name: string } | null;
}

export interface PosOperationalIncident {
  id: string;
  branchId?: string | null;
  terminalId?: string | null;
  sessionId?: string | null;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: string;
  title: string;
  description?: string | null;
  startedAt: string;
  resolvedAt?: string | null;
  branch?: { id: string; name: string } | null;
  terminal?: { id: string; code: string; name: string } | null;
  resolvedBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface PosConfigDeployment {
  id: string;
  branchId?: string | null;
  terminalId?: string | null;
  scope: string;
  deploymentType: string;
  status: string;
  versionLabel?: string | null;
  conflictCount: number;
  createdAt: string;
  appliedAt?: string | null;
  branch?: { id: string; name: string } | null;
  terminal?: { id: string; code: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
}

export interface PosInvoiceDetail {
  id: string;
  invoiceNumber: string;
  prefix?: string;
  type: string;
  status: string;
  issueDate?: string;
  dueDate?: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  notes?: string | null;
  currency?: string;
  dianZipKey?: string;
  dianStatusCode?: string;
  dianStatusMsg?: string;
  dianCufe?: string;
  dianQrCode?: string;
  dianSentAt?: string;
  customer?: {
    id: string;
    name: string;
    documentNumber: string;
    documentType?: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discount: number;
    total: number;
    product?: { id: string; name: string; sku: string; unit?: string };
  }>;
}

export interface PosCashMovement {
  id: string;
  sessionId: string;
  userId: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string };
}

export interface CartItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  sku?: string;
  stock?: number;
  availableStock?: number;
}

@Injectable({ providedIn: 'root' })
export class PosApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/pos`;

  getOperatingConfig(): Observable<PosOperatingConfig> {
    return this.http.get<PosOperatingConfig>(`${this.base}/config/operating`);
  }

  getGovernanceAudit(limit = 40): Observable<PosAuditEntry[]> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<PosAuditEntry[]>(`${this.base}/governance/audit`, { params });
  }

  saveGovernanceRule(dto: PosGovernanceRule): Observable<PosGovernanceRule> {
    return this.http.post<PosGovernanceRule>(`${this.base}/governance/rules`, dto);
  }

  requestSupervisorOverride(dto: {
    action: PosGovernanceAction;
    resourceType: string;
    resourceId?: string;
    reason: string;
    branchId?: string;
    requestedPayload?: Record<string, any>;
  }): Observable<PosSupervisorOverride> {
    return this.http.post<PosSupervisorOverride>(`${this.base}/governance/overrides`, dto);
  }

  approveSupervisorOverride(id: string, notes?: string): Observable<PosSupervisorOverride> {
    return this.http.patch<PosSupervisorOverride>(`${this.base}/governance/overrides/${id}/approve`, { notes });
  }

  rejectSupervisorOverride(id: string, notes?: string): Observable<PosSupervisorOverride> {
    return this.http.patch<PosSupervisorOverride>(`${this.base}/governance/overrides/${id}/reject`, { notes });
  }

  getTerminals(): Observable<PosTerminal[]> {
    return this.http.get<PosTerminal[]>(`${this.base}/terminals`);
  }

  createTerminal(dto: any): Observable<PosTerminal> {
    return this.http.post<PosTerminal>(`${this.base}/terminals`, dto);
  }

  updateTerminal(id: string, dto: any): Observable<PosTerminal> {
    return this.http.patch<PosTerminal>(`${this.base}/terminals/${id}`, dto);
  }

  getPriceLists(): Observable<PosPriceList[]> {
    return this.http.get<PosPriceList[]>(`${this.base}/price-lists`);
  }

  createPriceList(dto: any): Observable<PosPriceList> {
    return this.http.post<PosPriceList>(`${this.base}/price-lists`, dto);
  }

  updatePriceList(id: string, dto: any): Observable<PosPriceList> {
    return this.http.patch<PosPriceList>(`${this.base}/price-lists/${id}`, dto);
  }

  getPromotions(): Observable<PosPromotion[]> {
    return this.http.get<PosPromotion[]>(`${this.base}/promotions`);
  }

  createPromotion(dto: any): Observable<PosPromotion> {
    return this.http.post<PosPromotion>(`${this.base}/promotions`, dto);
  }

  updatePromotion(id: string, dto: any): Observable<PosPromotion> {
    return this.http.patch<PosPromotion>(`${this.base}/promotions/${id}`, dto);
  }

  getCombos(): Observable<PosCombo[]> {
    return this.http.get<PosCombo[]>(`${this.base}/combos`);
  }

  createCombo(dto: any): Observable<PosCombo> {
    return this.http.post<PosCombo>(`${this.base}/combos`, dto);
  }

  updateCombo(id: string, dto: any): Observable<PosCombo> {
    return this.http.patch<PosCombo>(`${this.base}/combos/${id}`, dto);
  }

  getLoyaltyCampaigns(): Observable<PosLoyaltyCampaign[]> {
    return this.http.get<PosLoyaltyCampaign[]>(`${this.base}/loyalty-campaigns`);
  }

  createLoyaltyCampaign(dto: any): Observable<PosLoyaltyCampaign> {
    return this.http.post<PosLoyaltyCampaign>(`${this.base}/loyalty-campaigns`, dto);
  }

  updateLoyaltyCampaign(id: string, dto: any): Observable<PosLoyaltyCampaign> {
    return this.http.patch<PosLoyaltyCampaign>(`${this.base}/loyalty-campaigns/${id}`, dto);
  }

  getCustomerLoyaltyProfile(customerId: string): Observable<PosCustomerLoyaltyProfile> {
    return this.http.get<PosCustomerLoyaltyProfile>(`${this.base}/customers/${customerId}/loyalty-profile`);
  }

  getCustomerAccountStatement(customerId: string): Observable<PosCustomerAccountStatement> {
    return this.http.get<PosCustomerAccountStatement>(`${this.base}/customers/${customerId}/account-statement`);
  }

  getCoupons(): Observable<PosCoupon[]> {
    return this.http.get<PosCoupon[]>(`${this.base}/coupons`);
  }

  createCoupon(dto: any): Observable<PosCoupon> {
    return this.http.post<PosCoupon>(`${this.base}/coupons`, dto);
  }

  updateCoupon(id: string, dto: any): Observable<PosCoupon> {
    return this.http.patch<PosCoupon>(`${this.base}/coupons/${id}`, dto);
  }

  getExternalOrders(): Observable<PosExternalOrder[]> {
    return this.http.get<PosExternalOrder[]>(`${this.base}/external-orders`);
  }

  createExternalOrder(dto: any): Observable<PosExternalOrder> {
    return this.http.post<PosExternalOrder>(`${this.base}/external-orders`, dto);
  }

  updateExternalOrderStatus(id: string, dto: { status: string; payload?: Record<string, unknown> }): Observable<PosExternalOrder> {
    return this.http.patch<PosExternalOrder>(`${this.base}/external-orders/${id}/status`, dto);
  }

  getCatalogProducts(params?: { search?: string; locationId?: string }): Observable<PosCatalogProduct[]> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.locationId) httpParams = httpParams.set('locationId', params.locationId);
    return this.http.get<PosCatalogProduct[]>(`${this.base}/catalog/products`, { params: httpParams });
  }

  getInventoryLocations(): Observable<PosInventoryLocation[]> {
    return this.http.get<PosInventoryLocation[]>(`${this.base}/inventory/locations`);
  }

  createInventoryLocation(dto: any): Observable<PosInventoryLocation> {
    return this.http.post<PosInventoryLocation>(`${this.base}/inventory/locations`, dto);
  }

  updateInventoryLocation(id: string, dto: any): Observable<PosInventoryLocation> {
    return this.http.patch<PosInventoryLocation>(`${this.base}/inventory/locations/${id}`, dto);
  }

  getInventoryStocks(search?: string): Observable<PosInventoryStock[]> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<PosInventoryStock[]>(`${this.base}/inventory/stocks`, { params });
  }

  createInventoryStock(dto: any): Observable<PosInventoryStock> {
    return this.http.post<PosInventoryStock>(`${this.base}/inventory/stocks`, dto);
  }

  getInventoryTransfers(): Observable<PosInventoryTransfer[]> {
    return this.http.get<PosInventoryTransfer[]>(`${this.base}/inventory/transfers`);
  }

  createInventoryTransfer(dto: any): Observable<PosInventoryTransfer> {
    return this.http.post<PosInventoryTransfer>(`${this.base}/inventory/transfers`, dto);
  }

  postInventoryTransfer(id: string): Observable<PosInventoryTransfer> {
    return this.http.patch<PosInventoryTransfer>(`${this.base}/inventory/transfers/${id}/post`, {});
  }

  previewPricing(dto: any): Observable<PosPricingPreview> {
    return this.http.post<PosPricingPreview>(`${this.base}/pricing/preview`, dto);
  }

  getShiftTemplates(): Observable<PosShiftTemplate[]> {
    return this.http.get<PosShiftTemplate[]>(`${this.base}/shifts`);
  }

  createShiftTemplate(dto: any): Observable<PosShiftTemplate> {
    return this.http.post<PosShiftTemplate>(`${this.base}/shifts`, dto);
  }

  updateShiftTemplate(id: string, dto: any): Observable<PosShiftTemplate> {
    return this.http.patch<PosShiftTemplate>(`${this.base}/shifts/${id}`, dto);
  }

  // Sessions
  openSession(dto: { initialCash: number; terminalId?: string; shiftTemplateId?: string; notes?: string }): Observable<PosSession> {
    return this.http.post<PosSession>(`${this.base}/sessions`, dto);
  }

  closeSession(sessionId: string, dto: { finalCash: number; notes?: string; denominations?: Record<string, number>; governanceOverrideId?: string }): Observable<PosSession & { requiresApproval?: boolean; summary?: any }> {
    return this.http.patch<PosSession>(`${this.base}/sessions/${sessionId}/close`, dto);
  }

  approveCloseSession(sessionId: string, dto: { notes?: string } = {}): Observable<PosSession> {
    return this.http.patch<PosSession>(`${this.base}/sessions/${sessionId}/approve-close`, dto);
  }

  reopenSession(sessionId: string, dto: { initialCash?: number; terminalId?: string; shiftTemplateId?: string; notes?: string; governanceOverrideId?: string } = {}): Observable<PosSession> {
    return this.http.post<PosSession>(`${this.base}/sessions/${sessionId}/reopen`, dto);
  }

  getActiveSession(): Observable<PosSession | null> {
    return this.http.get<PosSession | null>(`${this.base}/sessions/active`);
  }

  getSessions(params: Record<string, any> = {}): Observable<{ data: PosSession[]; total: number }> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) p = p.set(k, v); });
    return this.http.get<{ data: PosSession[]; total: number }>(`${this.base}/sessions`, { params: p });
  }

  getSession(id: string): Observable<PosSession> {
    return this.http.get<PosSession>(`${this.base}/sessions/${id}`);
  }

  // Sales
  createSale(dto: any): Observable<PosSale> {
    return this.http.post<PosSale>(`${this.base}/sales`, dto);
  }

  cancelSale(saleId: string, notes?: string, governanceOverrideId?: string): Observable<any> {
    return this.http.patch(`${this.base}/sales/${saleId}/cancel`, { notes, governanceOverrideId });
  }

  getSales(params: Record<string, any> = {}): Observable<{ data: PosSale[]; total: number }> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) p = p.set(k, v); });
    return this.http.get<{ data: PosSale[]; total: number }>(`${this.base}/sales`, { params: p });
  }

  getSalesSummary(from?: string, to?: string, sessionId?: string): Observable<any> {
    let p = new HttpParams();
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    if (sessionId) p = p.set('sessionId', sessionId);
    return this.http.get(`${this.base}/sales/summary`, { params: p });
  }

  getSalesAnalytics(from?: string, to?: string): Observable<PosSalesAnalytics> {
    let p = new HttpParams();
    if (from) p = p.set('from', from);
    if (to) p = p.set('to', to);
    return this.http.get<PosSalesAnalytics>(`${this.base}/sales/analytics`, { params: p });
  }

  getIntegrationsSummary(): Observable<PosIntegrationSummary> {
    return this.http.get<PosIntegrationSummary>(`${this.base}/integrations/summary`);
  }

  getMultiBranchOverview(): Observable<PosMultiBranchOverview> {
    return this.http.get<PosMultiBranchOverview>(`${this.base}/multi-branch/overview`);
  }

  getOperationalIncidents(): Observable<PosOperationalIncident[]> {
    return this.http.get<PosOperationalIncident[]>(`${this.base}/operations/incidents`);
  }

  resolveOperationalIncident(id: string, dto: { notes?: string } = {}): Observable<PosOperationalIncident> {
    return this.http.patch<PosOperationalIncident>(`${this.base}/operations/incidents/${id}/resolve`, dto);
  }

  getConfigDeployments(): Observable<PosConfigDeployment[]> {
    return this.http.get<PosConfigDeployment[]>(`${this.base}/operations/config-deployments`);
  }

  createConfigDeployment(dto: {
    deploymentType: string;
    scope: string;
    versionLabel?: string;
    terminalId?: string;
    branchIds?: string[];
  }): Observable<PosConfigDeployment[]> {
    return this.http.post<PosConfigDeployment[]>(`${this.base}/operations/config-deployments`, dto);
  }

  syncAccountingIntegrations(): Observable<{
    sales: any[];
    refunds: any[];
    cashMovements: any[];
  }> {
    return this.http.post<{
      sales: any[];
      refunds: any[];
      cashMovements: any[];
    }>(`${this.base}/integrations/sync-accounting`, {});
  }

  createReplenishmentRequest(dto: any = {}): Observable<any> {
    return this.http.post(`${this.base}/integrations/replenishment-request`, dto);
  }

  reconcileElectronicPayments(dto: { limit?: number } = {}): Observable<any> {
    return this.http.post(`${this.base}/integrations/reconcile-electronic-payments`, dto);
  }

  sendTerminalHeartbeat(
    terminalId: string,
    dto: {
      sessionId?: string;
      cartCount?: number;
      pendingOrders?: number;
      pendingSyncCount?: number;
      currentView?: string;
      userAgent?: string;
      recoverySnapshot?: Record<string, unknown>;
    },
  ): Observable<{
    terminal: {
      id: string;
      code: string;
      name: string;
      branchId?: string | null;
      lastHeartbeatAt?: string | null;
      heartbeatStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    };
    session?: {
      id: string;
      lastHeartbeatAt?: string | null;
      offlineSinceAt?: string | null;
      offlineQueueDepth?: number;
    } | null;
  }> {
    return this.http.post<{
      terminal: {
        id: string;
        code: string;
        name: string;
        branchId?: string | null;
        lastHeartbeatAt?: string | null;
        heartbeatStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
      };
      session?: {
        id: string;
        lastHeartbeatAt?: string | null;
        offlineSinceAt?: string | null;
        offlineQueueDepth?: number;
      } | null;
    }>(`${this.base}/terminals/${terminalId}/heartbeat`, dto);
  }

  getReceipt(saleId: string): Observable<{ html: string }> {
    return this.http.get<{ html: string }>(`${this.base}/sales/${saleId}/receipt`);
  }

  generateInvoiceFromSale(saleId: string): Observable<any> {
    return this.http.post(`${this.base}/sales/${saleId}/invoice`, {});
  }

  private getContextHeaders(source: 'invoice' | 'pos') {
    return { headers: { 'X-Context-Source': source } };
  }

  submitInvoiceToDian(invoiceId: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/invoices/${invoiceId}/issue`, {},this.getContextHeaders('pos'));
  }

  queryInvoiceDianStatus(invoiceId: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/invoices/${invoiceId}/dian-status`, {});
  }

  getInvoiceDetail(invoiceId: string): Observable<PosInvoiceDetail> {
    return this.http.get<PosInvoiceDetail>(`${environment.apiUrl}/invoices/${invoiceId}`);
  }

  getInvoiceXml(invoiceId: string): Observable<string> {
    return this.http.get(`${environment.apiUrl}/invoices/${invoiceId}/xml`, { responseType: 'text' });
  }

  getInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  }

  downloadInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/invoices/${invoiceId}/pdf/download`, { responseType: 'blob' });
  }

  downloadInvoiceZip(invoiceId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/invoices/${invoiceId}/zip`, { responseType: 'blob' });
  }

  markInvoicePaid(invoiceId: string): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/invoices/${invoiceId}/paid`, {});
  }

  addPayment(saleId: string, dto: { amountPaid?: number; paymentMethod?: string; payments?: Array<{ paymentMethod: string; amount: number; transactionReference?: string; providerName?: string; notes?: string }>; notes?: string }): Observable<PosSale> {
    return this.http.patch<PosSale>(`${this.base}/sales/${saleId}/pay`, dto);
  }

  markDelivered(saleId: string, dto: { notes?: string; generateInvoice?: boolean }): Observable<PosSale & { invoice?: any }> {
    return this.http.patch<PosSale & { invoice?: any }>(`${this.base}/sales/${saleId}/deliver`, dto);
  }

  dispatchSale(saleId: string, dto: { notes?: string } = {}): Observable<PosSale> {
    return this.http.patch<PosSale>(`${this.base}/sales/${saleId}/dispatch`, dto);
  }

  refundSale(saleId: string, reason?: string, governanceOverrideId?: string): Observable<PosSale> {
    return this.http.patch<PosSale>(`${this.base}/sales/${saleId}/refund`, { reason, governanceOverrideId });
  }

  getPostSaleRequests(params: Record<string, any> = {}): Observable<PosPostSaleRequest[]> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') p = p.set(k, v);
    });
    return this.http.get<PosPostSaleRequest[]>(`${this.base}/post-sale-requests`, { params: p });
  }

  createPostSaleRequest(
    saleId: string,
    dto: {
      type: 'RETURN' | 'EXCHANGE';
      reasonCode: string;
      reasonDetail?: string;
      items: Array<{ saleItemId: string; quantity: number }>;
      replacements?: Array<{ productId: string; description?: string; quantity: number }>;
    },
  ): Observable<PosPostSaleRequest> {
    return this.http.post<PosPostSaleRequest>(`${this.base}/sales/${saleId}/post-sale`, dto);
  }

  approvePostSaleRequest(id: string, approvalNotes?: string): Observable<PosPostSaleRequest> {
    return this.http.patch<PosPostSaleRequest>(`${this.base}/post-sale-requests/${id}/approve`, {
      approvalNotes,
    });
  }

  rejectPostSaleRequest(id: string, approvalNotes?: string): Observable<PosPostSaleRequest> {
    return this.http.patch<PosPostSaleRequest>(`${this.base}/post-sale-requests/${id}/reject`, {
      approvalNotes,
    });
  }

  // Cash movements
  createCashMovement(sessionId: string, dto: { type: 'IN' | 'OUT'; amount: number; reason: string; governanceOverrideId?: string }): Observable<PosCashMovement> {
    return this.http.post<PosCashMovement>(`${this.base}/sessions/${sessionId}/cash-movements`, dto);
  }

  getCashMovements(sessionId: string): Observable<PosCashMovement[]> {
    return this.http.get<PosCashMovement[]>(`${this.base}/sessions/${sessionId}/cash-movements`);
  }
}
