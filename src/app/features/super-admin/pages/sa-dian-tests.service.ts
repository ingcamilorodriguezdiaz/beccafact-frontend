import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DianTestSetDocument {
  id: string;
  sequence: number;
  docType: string; // FACTURA | NOTA_CREDITO | NOTA_DEBITO | NOMINA | NOMINA_AJUSTE
  invoiceId?: string;
  payrollId?: string;
  status: string; // PENDING | SENT | ACCEPTED | REJECTED | ERROR
  dianZipKey?: string;
  dianStatusCode?: string;
  dianStatusMsg?: string;
  errorMsg?: string;
  sentAt?: string;
}

export interface DianTestSet {
  id: string;
  companyId: string;
  type: 'FACTURACION' | 'NOMINA' | 'POS_ELECTRONICO';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalDocs: number;
  sentDocs: number;
  acceptedDocs: number;
  rejectedDocs: number;
  errorDocs: number;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  documents?: DianTestSetDocument[];
}

@Injectable({ providedIn: 'root' })
export class SaDianTestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/super-admin/dian-test-sets`;

  findByCompany(companyId: string): Observable<DianTestSet[]> {
    return this.http.get<DianTestSet[]>(`${this.base}/company/${companyId}`);
  }

  findOne(id: string): Observable<DianTestSet> {
    return this.http.get<DianTestSet>(`${this.base}/${id}`);
  }

  startFacturacion(companyId: string): Observable<DianTestSet> {
    return this.http.post<DianTestSet>(`${this.base}/company/${companyId}/facturacion`, {});
  }

  startNomina(companyId: string): Observable<DianTestSet> {
    return this.http.post<DianTestSet>(`${this.base}/company/${companyId}/nomina`, {});
  }

  checkStatuses(id: string): Observable<DianTestSet> {
    return this.http.post<DianTestSet>(`${this.base}/${id}/check-status`, {});
  }

  startPosElectronico(companyId: string): Observable<DianTestSet> {
    return this.http.post<DianTestSet>(`${this.base}/company/${companyId}/pos-electronico`, {});
  }

  cancel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  reset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/reset`);
  }
}
