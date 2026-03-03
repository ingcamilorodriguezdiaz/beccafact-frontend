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

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
}

@Component({
  selector: 'app-sa-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Empresas</h2>
          <p class="page-subtitle">
            {{ total() }} empresas registradas en la plataforma
          </p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar card card-sm">
        <div class="search-wrap">
          <input
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="onSearch()"
            placeholder="Buscar empresa o NIT..."
            class="form-control"
          />
        </div>

        <select
          [(ngModel)]="filterStatus"
          (ngModelChange)="load()"
          class="form-control"
          style="max-width:220px"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspendidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
      </div>

      <!-- Table -->
      <div class="card table-wrapper">
        @if (loading()) {
          <div class="loading-state">
            Cargando empresas...
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Plan</th>
                  <th class="text-center">Usuarios</th>
                  <th class="text-center">Facturas</th>
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
                        <div class="co-avatar">
                          {{ c.name[0].toUpperCase() }}
                        </div>
                        <div>
                          <div class="co-name">{{ c.name }}</div>
                          <div class="co-email">{{ c.email }}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span class="badge badge-muted">
                        {{ c.nit }}
                      </span>
                    </td>

                    <td>
                      @if (c.subscriptions && c.subscriptions.length > 0) {
                        <span class="badge badge-primary">
                          {{ c.subscriptions[0].plan.displayName }}
                        </span>
                      } @else {
                        <span class="text-muted">Sin plan</span>
                      }
                    </td>

                    <td class="text-center">
                      {{ c._count?.users ?? 0 }}
                    </td>

                    <td class="text-center">
                      {{ c._count?.invoices ?? 0 }}
                    </td>

                    <td>
                      <span
                        class="badge"
                        [ngClass]="{
                          'badge-success': c.status === 'ACTIVE',
                          'badge-warning': c.status === 'TRIAL',
                          'badge-danger': c.status === 'SUSPENDED',
                          'badge-muted': c.status === 'CANCELLED'
                        }"
                      >
                        {{ statusLabel(c.status) }}
                      </span>
                    </td>

                    <td class="text-muted">
                      {{ c.createdAt | date:'dd/MM/yyyy' }}
                    </td>

                    <td>
                      <div class="actions">
                        @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                          <button
                            class="btn btn-sm btn-danger"
                            (click)="suspend(c)"
                          >
                            Suspender
                          </button>
                        }

                        @if (c.status === 'SUSPENDED') {
                          <button
                            class="btn btn-sm btn-accent"
                            (click)="activate(c)"
                          >
                            Activar
                          </button>
                        }

                        <button
                          class="btn btn-sm btn-secondary"
                          (click)="openChangePlan(c)"
                        >
                          Cambiar plan
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="text-muted">
                Página {{ page() }} de {{ totalPages() }}
              </span>

              <div class="pagination-controls">
                <button
                  class="btn btn-sm btn-secondary"
                  [disabled]="page() === 1"
                  (click)="setPage(page()-1)"
                >
                  ‹
                </button>

                <button
                  class="btn btn-sm btn-secondary"
                  [disabled]="page() === totalPages()"
                  (click)="setPage(page()+1)"
                >
                  ›
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Modal -->
    @if (planTarget()) {
      <div class="modal-overlay" (click)="planTarget.set(null)">
        <div class="modal card card-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar plan — {{ planTarget()!.name }}</h3>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Nuevo plan</label>
              <select [(ngModel)]="selectedPlanId" class="form-control">
                @for (p of plans(); track p.id) {
                  <option [value]="p.id">
                    {{ p.displayName }} — {{ fmtCOP(p.price) }}/mes
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn btn-secondary"
              (click)="planTarget.set(null)"
            >
              Cancelar
            </button>

            <button
              class="btn btn-primary"
              [disabled]="saving()"
              (click)="changePlan()"
            >
              {{ saving() ? 'Cambiando...' : 'Confirmar cambio' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1200px; }

    .filters-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      align-items: center;
    }

    .search-wrap {
      flex: 1;
      max-width: 360px;
    }

    .table-wrapper {
      padding: 0;
      overflow: hidden;
    }

    .company-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .co-avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--r);
      background: linear-gradient(135deg, var(--brand), var(--accent));
      color: #fff;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }

    .co-name {
      font-weight: 600;
    }

    .co-email {
      font-size: 12px;
      color: var(--text-3);
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .loading-state {
      padding: 40px;
      text-align: center;
      color: var(--text-3);
    }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-top: 1px solid var(--border);
    }

    .pagination-controls {
      display: flex;
      gap: 8px;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 16px;
    }

    .modal {
      max-width: 460px;
      width: 100%;
    }

    .modal-header {
      margin-bottom: 20px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
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