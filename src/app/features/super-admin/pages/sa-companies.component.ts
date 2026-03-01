import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface Company {
  id: string;
  name: string;
  nit: string;
  email: string;
  status: string;
  createdAt: string;
  subscriptions?: Array<{ plan: { displayName: string; name: string } }>;
  _count?: { users: number; invoices: number };
}

interface Plan { id: string; name: string; displayName: string; price: number; }

@Component({
  selector: 'app-sa-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Empresas</h2>
          <p class="page-subtitle">{{ total() }} empresas registradas en la plataforma</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
          <input type="text" [(ngModel)]="search" (ngModelChange)="onSearch()" placeholder="Buscar empresa o NIT..." class="search-input"/>
        </div>
        <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="filter-select">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspendidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            @for (i of [1,2,3,4]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-avatar"></div>
                <div class="sk sk-line" style="width:160px"></div>
                <div class="sk sk-line" style="width:100px"></div>
                <div class="sk sk-line" style="width:80px"></div>
                <div class="sk sk-line" style="width:90px"></div>
              </div>
            }
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>NIT</th>
                <th>Plan</th>
                <th>Usuarios</th>
                <th>Facturas</th>
                <th>Estado</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of companies(); track c.id) {
                <tr>
                  <td>
                    <div class="company-cell">
                      <div class="co-avatar">{{ c.name[0].toUpperCase() }}</div>
                      <div>
                        <div class="co-name">{{ c.name }}</div>
                        <div class="co-email">{{ c.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td><code class="nit-code">{{ c.nit }}</code></td>
                  <td>
                    @if (c && c.subscriptions && c.subscriptions.length > 0) {
                      <span class="plan-pill plan-{{ c.subscriptions[0].plan.name.toLowerCase() }}">
                        {{ c.subscriptions[0].plan.displayName }}
                      </span>
                    } @else {
                      <span class="text-muted">Sin plan</span>
                    }
                  </td>
                  <td class="text-center">{{ c._count?.users ?? 0 }}</td>
                  <td class="text-center">{{ c._count?.invoices ?? 0 }}</td>
                  <td><span class="status-pill status-{{ c.status.toLowerCase() }}">{{ statusLabel(c.status) }}</span></td>
                  <td class="text-muted">{{ c.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td class="actions-cell">
                    @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                      <button class="btn-action btn-suspend" (click)="suspend(c)" title="Suspender">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
                        Suspender
                      </button>
                    }
                    @if (c.status === 'SUSPENDED') {
                      <button class="btn-action btn-activate" (click)="activate(c)" title="Activar">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                        Activar
                      </button>
                    }
                    <button class="btn-action btn-plan" (click)="openChangePlan(c)" title="Cambiar plan">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                      Plan
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="pagination-info">{{ (page()-1)*20+1 }}–{{ min(page()*20,total()) }} de {{ total() }}</span>
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

    <!-- Change Plan Modal -->
    @if (planTarget()) {
      <div class="modal-overlay" (click)="planTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar plan — {{ planTarget()!.name }}</h3>
            <button class="modal-close" (click)="planTarget.set(null)">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nuevo plan</label>
              <select [(ngModel)]="selectedPlanId" class="form-control">
                @for (p of plans(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }} — {{ fmtCOP(p.price) }}/mes</option>
                }
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="planTarget.set(null)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="changePlan()">{{ saving() ? 'Cambiando...' : 'Confirmar cambio' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width:1200px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#f0f6ff; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#4d7ab3; margin:0; }
    .filters-bar { display:flex; gap:10px; margin-bottom:14px; }
    .search-wrap { flex:1; max-width:360px; position:relative; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid rgba(255,255,255,.1); border-radius:8px; font-size:14px; outline:none; background:rgba(255,255,255,.06); color:#e2e8f0; }
    .search-input:focus { border-color:#00c6a0; }
    .filter-select { padding:8px 12px; border:1px solid rgba(255,255,255,.1); border-radius:8px; font-size:13.5px; outline:none; background:rgba(255,255,255,.06); color:#e2e8f0; }
    .table-card { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:12px; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:11px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#4d7ab3; background:rgba(255,255,255,.03); border-bottom:1px solid rgba(255,255,255,.06); text-align:left; }
    .data-table td { padding:12px 14px; font-size:13.5px; color:#d4e4f7; border-bottom:1px solid rgba(255,255,255,.05); vertical-align:middle; }
    .data-table tr:last-child td { border:none; }
    .data-table tr:hover td { background:rgba(255,255,255,.03); }
    .company-cell { display:flex; align-items:center; gap:10px; }
    .co-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .co-name { font-weight:600; color:#f0f6ff; }
    .co-email { font-size:12px; color:#4d7ab3; }
    .nit-code { font-family:monospace; font-size:12px; color:#7ea3cc; background:rgba(255,255,255,.06); padding:2px 6px; border-radius:4px; }
    .text-muted { color:#4d7ab3; }
    .text-center { text-align:center; }
    .plan-pill { padding:3px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; }
    .plan-basic,.plan-integración_básica { background:rgba(59,130,246,.2); color:#93c5fd; }
    .plan-empresarial { background:rgba(0,198,160,.2); color:#5eead4; }
    .plan-corporativo { background:rgba(245,158,11,.2); color:#fcd34d; }
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-active,.status-activo { background:rgba(16,185,129,.2); color:#6ee7b7; }
    .status-trial { background:rgba(99,102,241,.2); color:#a5b4fc; }
    .status-suspended,.status-suspendido { background:rgba(239,68,68,.2); color:#fca5a5; }
    .status-cancelled { background:rgba(107,114,128,.2); color:#9ca3af; }
    .actions-cell { display:flex; align-items:center; gap:6px; }
    .btn-action { display:inline-flex; align-items:center; gap:4px; padding:5px 10px; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s; }
    .btn-suspend { background:rgba(239,68,68,.15); color:#fca5a5; }
    .btn-suspend:hover { background:rgba(239,68,68,.3); }
    .btn-activate { background:rgba(16,185,129,.15); color:#6ee7b7; }
    .btn-activate:hover { background:rgba(16,185,129,.3); }
    .btn-plan { background:rgba(99,102,241,.15); color:#a5b4fc; }
    .btn-plan:hover { background:rgba(99,102,241,.3); }
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid rgba(255,255,255,.06); }
    .pagination-info { font-size:13px; color:#4d7ab3; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid rgba(255,255,255,.1); border-radius:6px; background:transparent; font-size:13px; cursor:pointer; color:#7ea3cc; min-width:32px; }
    .btn-page:hover:not(:disabled) { background:rgba(0,198,160,.15); border-color:#00c6a0; color:#00c6a0; }
    .btn-page.active { background:#00c6a0; border-color:#00c6a0; color:#0c1c35; }
    .btn-page:disabled { opacity:.3; cursor:default; }
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05); }
    .sk { background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.05) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:34px; height:34px; border-radius:8px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#1a2a42; border:1px solid rgba(255,255,255,.1); border-radius:16px; width:100%; max-width:440px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(255,255,255,.08); }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#f0f6ff; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#4d7ab3; font-size:20px; padding:0 4px; }
    .modal-body { padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid rgba(255,255,255,.08); }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#7ea3cc; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid rgba(255,255,255,.1); border-radius:8px; font-size:14px; outline:none; background:rgba(255,255,255,.06); color:#e2e8f0; box-sizing:border-box; }
    .form-control:focus { border-color:#00c6a0; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; }
    .btn-primary { background:#00c6a0; color:#0c1c35; }
    .btn-primary:hover:not(:disabled) { background:#00b38e; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:rgba(255,255,255,.08); color:#d4e4f7; border:1px solid rgba(255,255,255,.1); }
    .btn-secondary:hover { background:rgba(255,255,255,.14); }
  `]
})
export class SaCompaniesComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/super-admin`;

  companies = signal<Company[]>([]);
  plans = signal<Plan[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);

  search = '';
  filterStatus = '';
  private searchTimer: any;

  planTarget = signal<Company | null>(null);
  selectedPlanId = '';

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() { this.load(); this.loadPlans(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search) params.search = this.search;
    if (this.filterStatus) params.status = this.filterStatus;
    this.http.get<any>(`${this.API}/companies`, { params }).subscribe({
      next: r => { this.companies.set(r.data ?? r); this.total.set(r.total ?? r.length); this.totalPages.set(r.totalPages ?? 1); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  loadPlans() {
    this.http.get<any>(`${this.API}/plans`).subscribe({
      next: r => this.plans.set(r.data ?? r),
      error: () => {}
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const r: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) r.push(i);
    return r;
  }

  suspend(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/suspend`, {}).subscribe({
      next: () => { this.notify.success('Empresa suspendida'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error')
    });
  }

  activate(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/activate`, {}).subscribe({
      next: () => { this.notify.success('Empresa activada'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error')
    });
  }

  openChangePlan(c: Company) {
    this.planTarget.set(c);
    this.selectedPlanId = c.subscriptions?.[0] ? '' : '';
  }

  changePlan() {
    if (!this.selectedPlanId) { this.notify.warning('Selecciona un plan'); return; }
    this.saving.set(true);
    this.http.post(`${this.API}/companies/${this.planTarget()!.id}/change-plan`, { planId: this.selectedPlanId }).subscribe({
      next: () => { this.notify.success('Plan cambiado exitosamente'); this.saving.set(false); this.planTarget.set(null); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); }
    });
  }

  statusLabel(s: string): string {
    return { ACTIVE: 'Activo', TRIAL: 'Trial', SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado' }[s] ?? s;
  }

  fmtCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  min(a: number, b: number) { return Math.min(a, b); }
}