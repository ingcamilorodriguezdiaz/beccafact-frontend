import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface Company {
  id: string; name: string; nit: string; email: string;
  status: string; createdAt: string;
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
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
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

      <!-- ══ TABLE VIEW (desktop) ══ -->
      <div class="table-card">
        @if (loading()) {
          <div class="table-loading">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-avatar"></div>
                <div class="sk sk-line" style="width:160px"></div>
                <div class="sk sk-line" style="width:90px"></div>
                <div class="sk sk-line" style="width:80px"></div>
              </div>
            }
          </div>
        } @else if (companies().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path stroke-linecap="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
            <p>No hay empresas con los filtros aplicados</p>
          </div>
        } @else {
          <!-- Desktop table -->
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Plan</th>
                  <th class="text-center hide-md">Usuarios</th>
                  <th class="text-center hide-md">Facturas</th>
                  <th>Estado</th>
                  <th class="hide-sm">Registro</th>
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
                    <td><span class="nit-badge">{{ c.nit }}</span></td>
                    <td>
                      @if (c.subscriptions?.length) {
                        <span class="plan-badge">{{ c.subscriptions![0].plan.displayName }}</span>
                      } @else {
                        <span class="text-muted">Sin plan</span>
                      }
                    </td>
                    <td class="text-center hide-md">{{ c._count?.users ?? 0 }}</td>
                    <td class="text-center hide-md">{{ c._count?.invoices ?? 0 }}</td>
                    <td><span class="status-pill" [ngClass]="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
                    <td class="text-muted hide-sm">{{ c.createdAt | date:'dd/MM/yyyy' }}</td>
                    <td class="actions-cell">
                      @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                        <button class="btn-action btn-danger-sm" (click)="suspend(c)">Suspender</button>
                      }
                      @if (c.status === 'SUSPENDED') {
                        <button class="btn-action btn-success-sm" (click)="activate(c)">Activar</button>
                      }
                      <button class="btn-action btn-secondary-sm" (click)="openChangePlan(c)">Plan</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="pagination-info">Página {{ page() }} de {{ totalPages() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page()===1" (click)="setPage(page()-1)">‹</button>
                <button class="btn-page" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">›</button>
              </div>
            </div>
          }
        }
      </div>

      <!-- ══ CARD LIST (mobile) ══ -->
      @if (!loading() && companies().length > 0) {
        <div class="mobile-cards">
          @for (c of companies(); track c.id) {
            <div class="mobile-card">
              <div class="mc-top">
                <div class="co-avatar co-avatar-lg">{{ c.name[0].toUpperCase() }}</div>
                <div class="mc-info">
                  <div class="co-name">{{ c.name }}</div>
                  <div class="co-email">{{ c.email }}</div>
                  <div class="mc-meta">
                    <span class="nit-badge">{{ c.nit }}</span>
                    @if (c.subscriptions?.length) {
                      <span class="plan-badge">{{ c.subscriptions![0].plan.displayName }}</span>
                    }
                  </div>
                </div>
                <span class="status-pill" [ngClass]="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
              </div>
              <div class="mc-stats">
                <div class="mc-stat"><span>{{ c._count?.users ?? 0 }}</span><small>Usuarios</small></div>
                <div class="mc-stat"><span>{{ c._count?.invoices ?? 0 }}</span><small>Facturas</small></div>
                <div class="mc-stat"><span>{{ c.createdAt | date:'dd/MM/yy' }}</span><small>Registro</small></div>
              </div>
              <div class="mc-actions">
                @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                  <button class="btn-action btn-danger-sm" (click)="suspend(c)">Suspender</button>
                }
                @if (c.status === 'SUSPENDED') {
                  <button class="btn-action btn-success-sm" (click)="activate(c)">Activar</button>
                }
                <button class="btn-action btn-secondary-sm" (click)="openChangePlan(c)">Cambiar plan</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal cambiar plan -->
    @if (planTarget()) {
      <div class="modal-overlay" (click)="planTarget.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar plan — {{ planTarget()!.name }}</h3>
            <button class="modal-close" (click)="planTarget.set(null)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nuevo plan</label>
              <select [(ngModel)]="selectedPlanId" class="form-control">
                @for (p of plans(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }} — {{ fmtCOP(p.price) }}/mes</option>
                }
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="planTarget.set(null)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="changePlan()">
              {{ saving() ? 'Cambiando...' : 'Confirmar cambio' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1200px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* Filters */
    .filters-bar { display:flex; gap:10px; margin-bottom:16px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; min-width:180px; max-width:380px; position:relative; }
    .search-wrap svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 34px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; background:#fff; }

    /* Table */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .data-table { width:100%; border-collapse:collapse; min-width:640px; }
    .data-table th { padding:10px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:11px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .text-center { text-align:center; }
    .text-muted { color:#9ca3af; font-size:13px; }
    .company-cell { display:flex; align-items:center; gap:10px; }
    .co-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .co-avatar-lg { width:42px; height:42px; font-size:16px; border-radius:10px; }
    .co-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .co-email { font-size:12px; color:#9ca3af; }
    .nit-badge { background:#f0f4f9; color:#1a407e; font-size:11.5px; padding:2px 8px; border-radius:5px; font-family:monospace; white-space:nowrap; }
    .plan-badge { background:#e0faf4; color:#00a084; font-size:11.5px; padding:2px 8px; border-radius:5px; font-weight:700; white-space:nowrap; }
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; white-space:nowrap; }
    .s-active    { background:#d1fae5; color:#065f46; }
    .s-trial     { background:#dbeafe; color:#1e40af; }
    .s-suspended { background:#fee2e2; color:#991b1b; }
    .s-cancelled { background:#f3f4f6; color:#6b7280; }
    .actions-cell { white-space:nowrap; }
    .btn-action { padding:5px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn-danger-sm   { background:#fee2e2; color:#dc2626; margin-right:4px; }
    .btn-danger-sm:hover { background:#fecaca; }
    .btn-success-sm  { background:#d1fae5; color:#065f46; margin-right:4px; }
    .btn-success-sm:hover { background:#a7f3d0; }
    .btn-secondary-sm { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary-sm:hover { background:#e8eef8; }

    /* Skeleton */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:34px; height:34px; border-radius:8px; flex-shrink:0; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    /* Empty */
    .empty-state { padding:56px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:14px 0; font-size:14px; }

    /* Pagination */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:6px; }
    .btn-page { padding:6px 14px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:14px; cursor:pointer; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; color:#1a407e; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* Mobile cards — hidden on desktop */
    .mobile-cards { display:none; flex-direction:column; gap:10px; margin-top:12px; }
    .mobile-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:14px; }
    .mc-top { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
    .mc-info { flex:1; min-width:0; }
    .mc-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:5px; }
    .mc-stats { display:flex; gap:0; border-top:1px solid #f0f4f8; border-bottom:1px solid #f0f4f8; padding:8px 0; margin-bottom:10px; }
    .mc-stat { flex:1; text-align:center; }
    .mc-stat span { display:block; font-size:15px; font-weight:700; color:#0c1c35; }
    .mc-stat small { font-size:11px; color:#9ca3af; }
    .mc-actions { display:flex; gap:6px; flex-wrap:wrap; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:460px; display:flex; flex-direction:column; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body { padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }
    .form-group { margin-bottom:12px; }
    .form-label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 768px) {
      .filters-bar { flex-wrap:wrap; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .hide-md { display:none; }
    }
    @media (max-width: 640px) {
      .table-card { display:none; }       /* hide table on mobile */
      .mobile-cards { display:flex; }     /* show cards on mobile */
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
    }
    @media (max-width: 480px) {
      .hide-sm { display:none; }
    }
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
    this.http.get<any>(`${this.API}/plans`).subscribe({ next: r => this.plans.set(r.data ?? r), error: () => {} });
  }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350); }
  setPage(p: number) { this.page.set(p); this.load(); }

  suspend(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/suspend`, {}).subscribe({ next: () => { this.notify.success('Empresa suspendida'); this.load(); }, error: e => this.notify.error(e?.error?.message ?? 'Error') });
  }
  activate(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/activate`, {}).subscribe({ next: () => { this.notify.success('Empresa activada'); this.load(); }, error: e => this.notify.error(e?.error?.message ?? 'Error') });
  }
  openChangePlan(c: Company) { this.planTarget.set(c); this.selectedPlanId = ''; }
  changePlan() {
    if (!this.selectedPlanId) { this.notify.warning('Selecciona un plan'); return; }
    this.saving.set(true);
    this.http.post(`${this.API}/companies/${this.planTarget()!.id}/change-plan`, { planId: this.selectedPlanId }).subscribe({
      next: () => { this.notify.success('Plan cambiado'); this.saving.set(false); this.planTarget.set(null); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); }
    });
  }

  statusClass(s: string) { return { 's-active': s==='ACTIVE', 's-trial': s==='TRIAL', 's-suspended': s==='SUSPENDED', 's-cancelled': s==='CANCELLED' }; }
  statusLabel(s: string) { return ({ACTIVE:'Activo',TRIAL:'Trial',SUSPENDED:'Suspendido',CANCELLED:'Cancelado'} as any)[s] ?? s; }
  fmtCOP(v: number) { return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(v); }
}