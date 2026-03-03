import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface AuditLog {
  id: string;
  companyId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: any;
  after?: any;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  company?: { name: string };
}

interface PagedResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'action-create', UPDATE: 'action-update', DELETE: 'action-delete',
  LOGIN: 'action-login', EXPORT: 'action-export', SUSPEND: 'action-suspend',
  ACTIVATE: 'action-activate', CHANGE_PLAN: 'action-change',
};

@Component({
  selector: 'app-sa-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <div class="page-header">
        <div>
          <h2 class="page-title">Logs de Auditoría</h2>
          <p class="page-subtitle">Registro completo de acciones del sistema</p>
        </div>
        <button class="btn-ghost" (click)="reset()" type="button">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
          Limpiar filtros
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <label class="filter-label">Empresa (ID)</label>
            <input type="text" [(ngModel)]="filters.companyId" (ngModelChange)="onFilterChange()" placeholder="UUID de empresa" class="filter-input"/>
          </div>
          <div class="filter-group">
            <label class="filter-label">Recurso</label>
            <select [(ngModel)]="filters.resource" (ngModelChange)="onFilterChange()" class="filter-input">
              <option value="">Todos los recursos</option>
              <option value="invoice">Factura</option>
              <option value="product">Producto</option>
              <option value="user">Usuario</option>
              <option value="company">Empresa</option>
              <option value="subscription">Suscripción</option>
              <option value="customer">Cliente</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Acción</label>
            <select [(ngModel)]="filters.action" (ngModelChange)="onFilterChange()" class="filter-input">
              <option value="">Todas las acciones</option>
              <option value="CREATE">Crear</option>
              <option value="UPDATE">Actualizar</option>
              <option value="DELETE">Eliminar</option>
              <option value="LOGIN">Login</option>
              <option value="EXPORT">Exportar</option>
              <option value="SUSPEND">Suspender</option>
              <option value="ACTIVATE">Activar</option>
              <option value="CHANGE_PLAN">Cambiar plan</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Desde</label>
            <input type="date" [(ngModel)]="filters.from" (ngModelChange)="onFilterChange()" class="filter-input"/>
          </div>
          <div class="filter-group">
            <label class="filter-label">Hasta</label>
            <input type="date" [(ngModel)]="filters.to" (ngModelChange)="onFilterChange()" class="filter-input"/>
          </div>
        </div>
      </div>

      <!-- Results info -->
      @if (!loading()) {
        <div class="results-bar">
          <span class="results-count">{{ total() }} registros encontrados</span>
          <span class="results-page">Página {{ page() }} de {{ totalPages() }}</span>
        </div>
      }

      <!-- Table -->
      <div class="table-card">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-row">
              <div class="sk" style="width:90px;height:24px;border-radius:12px"></div>
              <div class="sk" style="width:140px;height:14px"></div>
              <div class="sk" style="width:80px;height:20px;border-radius:8px"></div>
              <div class="sk" style="width:100px;height:14px"></div>
              <div class="sk" style="width:120px;height:14px"></div>
            </div>
          }
        } @else if (logs().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44"><rect width="48" height="48" rx="12" fill="#f0f4f9"/><path d="M16 20h16M16 26h10M16 32h8M13 14h22a2 2 0 012 2v20a2 2 0 01-2 2H13a2 2 0 01-2-2V16a2 2 0 012-2z" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
            <p>Sin registros con los filtros aplicados</p>
          </div>
        } @else {
          <table class="audit-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Empresa</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Recurso</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (log of logs(); track log.id) {
                <tr class="log-row" (click)="toggleExpand(log.id)">
                  <td>
                    <div class="log-date">{{ log.createdAt | date:'dd/MM/yyyy' }}</div>
                    <div class="log-time">{{ log.createdAt | date:'HH:mm:ss' }}</div>
                  </td>
                  <td>
                    @if (log.company) {
                      <span class="company-name">{{ log.company.name }}</span>
                    } @else {
                      <span class="text-muted">Sistema</span>
                    }
                  </td>
                  <td>
                    @if (log.user) {
                      <div class="user-cell">
                        <div class="user-avatar-sm">{{ (log.user.firstName[0] || '') + (log.user.lastName[0] || '') }}</div>
                        <div>
                          <div class="user-name-sm">{{ log.user.firstName }} {{ log.user.lastName }}</div>
                          <div class="user-email-sm">{{ log.user.email }}</div>
                        </div>
                      </div>
                    } @else {
                      <span class="text-muted">Sistema</span>
                    }
                  </td>
                  <td>
                    <span class="action-pill {{ getActionClass(log.action) }}">{{ log.action }}</span>
                  </td>
                  <td>
                    <span class="resource-badge">{{ log.resource }}</span>
                    @if (log.resourceId) {
                      <div class="resource-id">{{ log.resourceId.slice(0, 8) }}…</div>
                    }
                  </td>
                  <td><span class="ip-badge">{{ log.ip || '—' }}</span></td>
                  <td>
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" class="expand-icon" [class.expanded]="expanded().has(log.id)">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                    </svg>
                  </td>
                </tr>
                @if (expanded().has(log.id)) {
                  <tr class="expand-row">
                    <td colspan="7">
                      <div class="expand-body">
                        <div class="expand-cols">
                          <div class="expand-col">
                            <div class="expand-title">ANTES</div>
                            <pre class="json-pre">{{ log.before | json }}</pre>
                          </div>
                          <div class="expand-col">
                            <div class="expand-title">DESPUÉS</div>
                            <pre class="json-pre">{{ log.after | json }}</pre>
                          </div>
                          <div class="expand-col">
                            <div class="expand-title">METADATA</div>
                            <div class="meta-grid">
                              <span class="meta-key">ID</span>
                              <span class="meta-val">{{ log.id }}</span>
                              <span class="meta-key">Recurso ID</span>
                              <span class="meta-val">{{ log.resourceId || '—' }}</span>
                              <span class="meta-key">User Agent</span>
                              <span class="meta-val" style="font-size:10px;word-break:break-all">{{ log.userAgent || '—' }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="page() <= 1" (click)="goTo(page() - 1)" type="button">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
              </button>
              <span class="page-info">{{ page() }} / {{ totalPages() }}</span>
              <button class="page-btn" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)" type="button">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1300px; }
    .animate-in { animation: fadeUp 0.25s ease; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }

    .btn-ghost {
      display:inline-flex; align-items:center; gap:7px; padding:8px 14px;
      background:#fff; border:1px solid #dce6f0; color:#475569; border-radius:8px;
      font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s;
    }
    .btn-ghost:hover { background:#f0f4f9; }

    /* Filters */
    .filters-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:16px 20px; margin-bottom:16px; }
    .filters-row { display:grid; grid-template-columns:1.5fr 1fr 1fr 1fr 1fr; gap:12px; }
    .filter-label { display:block; font-size:11.5px; font-weight:700; color:#64748b; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em; }
    .filter-input {
      width:100%; padding:7px 10px; border:1px solid #dce6f0; border-radius:8px;
      font-size:13px; color:#0c1c35; box-sizing:border-box; outline:none;
      background:#fff; transition:border-color 0.15s;
    }
    .filter-input:focus { border-color:#1a407e; }

    .results-bar { display:flex; justify-content:space-between; margin-bottom:10px; padding:0 2px; }
    .results-count { font-size:13px; color:#475569; font-weight:600; }
    .results-page { font-size:12.5px; color:#94a3b8; }

    /* Table */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .audit-table { width:100%; border-collapse:collapse; }
    .audit-table th {
      padding:10px 14px; text-align:left; font-size:11px; font-weight:700;
      color:#64748b; text-transform:uppercase; letter-spacing:0.07em;
      background:#f8fafc; border-bottom:1px solid #dce6f0;
    }
    .log-row { cursor:pointer; transition:background 0.1s; }
    .log-row:hover { background:#f8fafc; }
    .log-row td { padding:10px 14px; border-bottom:1px solid #f0f4f9; vertical-align:middle; }
    .log-date { font-size:13px; font-weight:600; color:#334155; }
    .log-time { font-size:11px; color:#94a3b8; }
    .company-name { font-size:13px; font-weight:600; color:#334155; }
    .text-muted { font-size:12px; color:#94a3b8; }

    .user-cell { display:flex; align-items:center; gap:8px; }
    .user-avatar-sm {
      width:28px; height:28px; border-radius:7px; flex-shrink:0;
      background:linear-gradient(135deg,#1a407e,#00c6a0);
      color:#fff; font-size:10px; font-weight:700;
      display:flex; align-items:center; justify-content:center; text-transform:uppercase;
    }
    .user-name-sm { font-size:12.5px; font-weight:600; color:#334155; }
    .user-email-sm { font-size:11px; color:#94a3b8; }

    .action-pill {
      display:inline-block; padding:3px 9px; border-radius:99px;
      font-size:11px; font-weight:700; letter-spacing:0.04em;
    }
    .action-create { background:#dcfce7; color:#15803d; }
    .action-update { background:#dbeafe; color:#1d4ed8; }
    .action-delete { background:#fee2e2; color:#dc2626; }
    .action-login  { background:#f3e8ff; color:#7c3aed; }
    .action-export { background:#e0f2fe; color:#0369a1; }
    .action-suspend{ background:#fef3c7; color:#92400e; }
    .action-activate { background:#d1fae5; color:#065f46; }
    .action-change { background:#fce7f3; color:#9d174d; }

    .resource-badge { font-size:11.5px; font-weight:600; color:#475569; background:#f0f4f9; padding:2px 7px; border-radius:5px; }
    .resource-id { font-size:10.5px; color:#94a3b8; font-family:monospace; margin-top:2px; }
    .ip-badge { font-family:monospace; font-size:12px; color:#64748b; }

    .expand-icon { color:#94a3b8; transition:transform 0.2s; }
    .expand-icon.expanded { transform:rotate(180deg); color:#1a407e; }

    .expand-row td { padding:0; border-bottom:1px solid #dce6f0; }
    .expand-body { padding:16px 20px; background:#f8fafc; }
    .expand-cols { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:16px; }
    .expand-title { font-size:10.5px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; }
    .json-pre {
      margin:0; padding:10px; background:#fff; border:1px solid #e2e8f0;
      border-radius:8px; font-size:11px; color:#334155; overflow:auto;
      max-height:160px; white-space:pre-wrap; word-break:break-all;
    }
    .meta-grid { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; align-items:start; }
    .meta-key { font-size:11px; font-weight:700; color:#64748b; white-space:nowrap; }
    .meta-val { font-size:11px; color:#334155; font-family:monospace; word-break:break-all; }

    /* Skeleton */
    .skeleton-row { display:flex; align-items:center; gap:20px; padding:14px 20px; border-bottom:1px solid #f0f4f9; }
    .sk { background:linear-gradient(90deg,#f0f4f9 25%,#e2e8f0 50%,#f0f4f9 75%); background-size:200%; border-radius:6px; animation:shimmer 1.4s infinite; height:14px; }
    @keyframes shimmer { from{background-position:200%} to{background-position:-200%} }

    /* Empty */
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:48px; color:#94a3b8; font-size:14px; }

    /* Pagination */
    .pagination { display:flex; align-items:center; justify-content:center; gap:12px; padding:14px; border-top:1px solid #f0f4f9; }
    .page-btn {
      width:32px; height:32px; border-radius:8px; border:1px solid #dce6f0;
      background:#fff; color:#475569; cursor:pointer; display:flex;
      align-items:center; justify-content:center; transition:all 0.15s;
    }
    .page-btn:hover:not(:disabled) { background:#1a407e; color:#fff; border-color:#1a407e; }
    .page-btn:disabled { opacity:0.4; cursor:default; }
    .page-info { font-size:13px; font-weight:600; color:#475569; min-width:60px; text-align:center; }
  `],
})
export class SaAuditComponent implements OnInit {
  logs = signal<AuditLog[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  expanded = signal<Set<string>>(new Set());

  filters = { companyId: '', resource: '', action: '', from: '', to: '' };
  private filterTimer: any;

  private readonly api = `${environment.apiUrl}/super-admin/audit-logs`;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  onFilterChange() {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  reset() {
    this.filters = { companyId: '', resource: '', action: '', from: '', to: '' };
    this.page.set(1);
    this.load();
  }

  goTo(p: number) { this.page.set(p); this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 50 };
    if (this.filters.companyId) params.companyId = this.filters.companyId;
    if (this.filters.resource) params.resource = this.filters.resource;
    if (this.filters.action) params.action = this.filters.action;
    if (this.filters.from) params.from = this.filters.from;
    if (this.filters.to) params.to = this.filters.to;

    const qs = new URLSearchParams(params).toString();
    this.http.get<PagedResult>(`${this.api}?${qs}`).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(Math.ceil(res.total / 50));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleExpand(id: string) {
    const s = new Set(this.expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expanded.set(s);
  }

  getActionClass(action: string) {
    return ACTION_COLORS[action] ?? 'action-update';
  }
}
