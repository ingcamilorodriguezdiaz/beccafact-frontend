import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PosSession {
  id: string;
  companyId: string;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  finalCash?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalTransactions: number;
  notes?: string;
  user: { id: string; firstName: string; lastName: string; email?: string };
  _count?: { sales: number };
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

export interface PosSale {
  id: string;
  companyId: string;
  sessionId: string;
  saleNumber: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
  amountPaid: number;
  change: number;
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'ADVANCE';
  advanceAmount: number;
  remainingAmount: number;
  deliveryStatus: 'PENDING' | 'DELIVERED';
  notes?: string;
  createdAt: string;
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
}

@Injectable({ providedIn: 'root' })
export class PosApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/pos`;

  // Sessions
  openSession(dto: { initialCash: number; notes?: string }): Observable<PosSession> {
    return this.http.post<PosSession>(`${this.base}/sessions`, dto);
  }

  closeSession(sessionId: string, dto: { finalCash: number; notes?: string }): Observable<PosSession> {
    return this.http.patch<PosSession>(`${this.base}/sessions/${sessionId}/close`, dto);
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

  cancelSale(saleId: string, notes?: string): Observable<any> {
    return this.http.patch(`${this.base}/sales/${saleId}/cancel`, { notes });
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

  getReceipt(saleId: string): Observable<{ html: string }> {
    return this.http.get<{ html: string }>(`${this.base}/sales/${saleId}/receipt`);
  }

  generateInvoiceFromSale(saleId: string): Observable<any> {
    return this.http.post(`${this.base}/sales/${saleId}/invoice`, {});
  }

  submitInvoiceToDian(invoiceId: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/invoices/${invoiceId}/issue`, {});
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

  markInvoicePaid(invoiceId: string): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/invoices/${invoiceId}/paid`, {});
  }

  addPayment(saleId: string, dto: { amountPaid: number; paymentMethod: string; notes?: string }): Observable<PosSale> {
    return this.http.patch<PosSale>(`${this.base}/sales/${saleId}/pay`, dto);
  }

  markDelivered(saleId: string, dto: { notes?: string; generateInvoice?: boolean }): Observable<PosSale & { invoice?: any }> {
    return this.http.patch<PosSale & { invoice?: any }>(`${this.base}/sales/${saleId}/deliver`, dto);
  }

  refundSale(saleId: string, reason?: string): Observable<PosSale> {
    return this.http.patch<PosSale>(`${this.base}/sales/${saleId}/refund`, { reason });
  }

  // Cash movements
  createCashMovement(sessionId: string, dto: { type: 'IN' | 'OUT'; amount: number; reason: string }): Observable<PosCashMovement> {
    return this.http.post<PosCashMovement>(`${this.base}/sessions/${sessionId}/cash-movements`, dto);
  }

  getCashMovements(sessionId: string): Observable<PosCashMovement[]> {
    return this.http.get<PosCashMovement[]>(`${this.base}/sessions/${sessionId}/cash-movements`);
  }
}
