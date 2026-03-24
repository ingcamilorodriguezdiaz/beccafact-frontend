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
  status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  notes?: string;
  createdAt: string;
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string; status: string };
  customer?: { id: string; name: string; documentNumber: string; documentType?: string };
  items: PosSaleItem[];
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
}
