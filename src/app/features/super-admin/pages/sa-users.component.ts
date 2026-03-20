import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../../core/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../../environments/environment';

interface GlobalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  company: { id: string; name: string; nit: string } | null;
  roles: Array<{ role: { name: string; displayName: string } }>;
}

@Component({
  selector: 'app-sa-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="page animate-in">

      <!-- ── Header ── -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Usuarios globales</h2>
          <p class="page-subtitle">{{ total() }} usuarios registrados en la plataforma</p>
        </div>
      </div>

      <!-- ── Filtros ── -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
          </svg>
          <input type="text" [(ngModel)]="searchValue" (ngModelChange)="onSearch($event)"
                 placeholder="Buscar por nombre o email…" class="form-control search-input"/>
        </div>
        <select [(ngModel)]="filterActiveValue" (ngModelChange)="onFilterChange($event)"
                class="form-control filter-select">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      <!-- ── Tabla ── -->
      <div class="table-card">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="sk-row">
              <div class="sk" style="width:36px;height:36px;border-radius:9px;flex-shrink:0"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:5px">
                <div class="sk" style="width:150px;height:13px"></div>
                <div class="sk" style="width:190px;height:11px"></div>
              </div>
              <div class="sk" style="width:110px;height:13px"></div>
              <div class="sk" style="width:80px;height:22px;border-radius:99px"></div>
              <div class="sk" style="width:70px;height:22px;border-radius:99px"></div>
              <div class="sk" style="width:80px;height:13px"></div>
              <div class="sk" style="width:32px;height:28px;border-radius:8px;margin-left:auto"></div>
            </div>
          }
        } @else if (users().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44">
              <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
              <path d="M24 22a6 6 0 100-12 6 6 0 000 12zM12 38c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>No se encontraron usuarios</p>
          </div>
        } @else {
          <table class="co-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Empresa</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr class="co-row">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar" [class.user-avatar--sa]="user.isSuperAdmin">
                        {{ initials(user) }}
                      </div>
                      <div>
                        <div class="user-name">
                          {{ user.firstName }} {{ user.lastName }}
                          @if (user.isSuperAdmin) {
                            <span class="badge-sa">SA</span>
                          }
                        </div>
                        <div class="user-email">{{ user.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    @if (user.isSuperAdmin) {
                      <span class="badge-company-sa">Super Admin</span>
                    } @else if (user.company) {
                      <div class="company-cell">
                        <span class="company-name">{{ user.company.name }}</span>
                        <span class="company-nit">{{ user.company.nit }}</span>
                      </div>
                    } @else {
                      <span class="text-muted">Sin empresa</span>
                    }
                  </td>
                  <td>
                    @if (user.roles.length > 0) {
                      <span class="role-badge">{{ user.roles[0].role.displayName }}</span>
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td>
                    @if (user.isActive) {
                      <span class="badge-active">Activo</span>
                    } @else {
                      <span class="badge-inactive">Inactivo</span>
                    }
                  </td>
                  <td class="text-muted">{{ user.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td>
                    @if (!user.isSuperAdmin) {
                      <div class="row-actions">
                        <button class="icon-btn"
                                [title]="user.isActive ? 'Desactivar usuario' : 'Activar usuario'"
                                (click)="toggleActive(user)">
                          @if (user.isActive) {
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                            </svg>
                          } @else {
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
                            </svg>
                          }
                        </button>
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- Paginación -->
          @if (totalPages() > 1) {
            <div class="pagination">
              <span class="text-muted">Página {{ page() }} de {{ totalPages() }}</span>
              <div class="pag-btns">
                <button class="page-btn" [disabled]="page() === 1" (click)="setPage(page() - 1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
                  </svg>
                </button>
                <button class="page-btn" [disabled]="page() === totalPages()" (click)="setPage(page() + 1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                  </svg>
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <app-confirm-dialog />
  `,
  styles: [`
    @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
    @keyframes shimmer   { 0%{background-position:200%} 100%{background-position:-200%} }

    .animate-in { animation:fadeSlide .28s ease; }
    .page { padding:0; }

    .page-header   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-title    { font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { color:#9ab5cc; font-size:13.5px; margin:0; }

    .filters-bar  { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
    .search-wrap  { position:relative; flex:1; min-width:200px; max-width:400px; }
    .search-icon  { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9ab5cc; pointer-events:none; }
    .search-input { padding-left:34px !important; }
    .filter-select { max-width:180px; }

    .form-control {
      width:100%; padding:9px 12px; border:1.5px solid #dce6f0;
      border-radius:9px; font-size:13.5px; outline:none;
      transition:border-color .15s; box-sizing:border-box;
    }
    .form-control:focus { border-color:#1a407e; }

    .table-card { background:#fff; border-radius:14px; box-shadow:0 1px 4px rgba(12,28,53,.08); overflow:hidden; }
    .co-table   { width:100%; border-collapse:collapse; }
    .co-table th {
      font-size:11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.07em; color:#9ab5cc; padding:12px 16px;
      background:#fafbfc; border-bottom:1px solid #edf1f7; text-align:left;
    }
    .co-table td { padding:12px 16px; font-size:13.5px; color:#334155; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .co-row:last-child td { border-bottom:none; }
    .co-row:hover { background:#f8fafc; }

    /* Avatar */
    .user-cell   { display:flex; align-items:center; gap:10px; }
    .user-avatar {
      width:36px; height:36px; border-radius:9px;
      background:linear-gradient(135deg,#64748b,#94a3b8);
      color:#fff; font-size:11px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; text-transform:uppercase;
    }
    .user-avatar--sa {
      background:linear-gradient(135deg,#1a407e,#00c6a0);
    }
    .user-name  { font-size:13.5px; font-weight:600; color:#0c1c35; display:flex; align-items:center; gap:6px; }
    .user-email { font-size:11.5px; color:#94a3b8; }

    /* SA badge inline */
    .badge-sa {
      background:rgba(0,198,160,.15); color:#00a884;
      border-radius:5px; padding:1px 6px; font-size:10px; font-weight:800;
      letter-spacing:.04em;
    }

    /* Company cell */
    .company-cell { display:flex; flex-direction:column; gap:2px; }
    .company-name { font-size:13px; font-weight:600; color:#0c1c35; }
    .company-nit  { font-size:11px; color:#94a3b8; }

    .badge-company-sa {
      background:linear-gradient(135deg,rgba(26,64,126,.1),rgba(0,198,160,.1));
      color:#1a407e; border-radius:7px; padding:3px 9px; font-size:11.5px; font-weight:700;
    }

    /* Role badge */
    .role-badge {
      display:inline-block; background:#ede9fe; color:#5b21b6;
      border-radius:7px; padding:3px 9px; font-size:11.5px; font-weight:600;
    }

    .badge-active   { background:rgba(0,198,160,.12); color:#00a884; border-radius:9999px; padding:3px 10px; font-size:11.5px; font-weight:600; }
    .badge-inactive { background:#f1f5f9; color:#94a3b8; border-radius:9999px; padding:3px 10px; font-size:11.5px; font-weight:600; }

    .text-muted { color:#94a3b8; font-size:12.5px; }

    .row-actions { display:flex; gap:4px; justify-content:flex-end; }
    .icon-btn { background:none; border:none; cursor:pointer; padding:5px; border-radius:6px; color:#9ab5cc; transition:color .15s,background .15s; }
    .icon-btn:hover { background:#f0f4f9; color:#1a407e; }

    .sk-row { display:flex; align-items:center; gap:14px; padding:13px 16px; border-bottom:1px solid #f0f4f9; }
    .sk { background:linear-gradient(90deg,#f0f4f9 25%,#e8eef8 50%,#f0f4f9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px; display:block; }

    .empty-state { display:flex; flex-direction:column; align-items:center; gap:10px; padding:52px 24px; color:#94a3b8; font-size:14px; }

    /* Paginación */
    .pagination { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pag-btns   { display:flex; gap:6px; }
    .page-btn   {
      width:32px; height:32px; border-radius:8px; border:1px solid #dce6f0;
      background:#fff; color:#475569; cursor:pointer;
      display:flex; align-items:center; justify-content:center; transition:all .15s;
    }
    .page-btn:hover:not(:disabled) { background:#1a407e; color:#fff; border-color:#1a407e; }
    .page-btn:disabled { opacity:.4; cursor:default; }

    @media (max-width:768px) {
      .table-card { overflow-x:auto; }
      .co-table   { min-width:640px; }
    }
  `]
})
export class SaUsersComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/super-admin`;
  readonly limit = 25;

  users        = signal<GlobalUser[]>([]);
  total        = signal(0);
  loading      = signal(true);
  search       = signal('');
  filterActive = signal('');
  page         = signal(1);

  searchValue      = '';
  filterActiveValue = '';

  private searchTimer: any;

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
    private dialog: ConfirmDialogService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    let params = new HttpParams()
      .set('page', this.page())
      .set('limit', this.limit);
    if (this.search()) params = params.set('search', this.search());
    if (this.filterActive()) params = params.set('isActive', this.filterActive());

    this.http.get<any>(`${this.API}/users`, { params }).subscribe({
      next: r => {
        this.users.set(r.data ?? r);
        this.total.set(r.total ?? (r.data ?? r).length);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Error al cargar los usuarios');
        this.loading.set(false);
      },
    });
  }

  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }

  onFilterChange(value: string) {
    this.filterActive.set(value);
    this.page.set(1);
    this.load();
  }

  setPage(p: number) {
    this.page.set(p);
    this.load();
  }

  toggleActive(user: GlobalUser) {
    const action = user.isActive ? 'desactivar' : 'activar';
    this.dialog.confirm({
      title: `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      message: `${user.firstName} ${user.lastName}`,
      detail: user.email,
      confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
      danger: user.isActive,
    }).then(ok => {
      if (!ok) return;
      this.http.patch<any>(`${this.API}/users/${user.id}/toggle-active`, {}).subscribe({
        next: () => {
          this.notify.success(`Usuario ${user.isActive ? 'desactivado' : 'activado'} correctamente`);
          this.load();
        },
        error: (err) => this.notify.error(err?.error?.message || 'Error al cambiar el estado del usuario'),
      });
    });
  }

  initials(user: GlobalUser): string {
    const f = (user.firstName?.[0] ?? '').toUpperCase();
    const l = (user.lastName?.[0]  ?? '').toUpperCase();
    return f + l;
  }
}
