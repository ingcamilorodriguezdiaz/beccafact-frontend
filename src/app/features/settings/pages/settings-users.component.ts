import { Component, HostListener, signal, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

interface UserEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  lastLoginAt?: string;
  roles: string[];
}

interface RoleEntry {
  id: string;
  name: string;
  displayName: string;
  description?: string;
}

@Component({
  selector: 'app-settings-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Equipo</p>
          <h2>Gestion de usuarios y permisos</h2>
          <p>Controla el acceso a cada modulo, mantén el equipo ordenado y define quien puede operar o administrar la plataforma.</p>
        </div>

        @if (canManage()) {
          <button class="btn btn-primary" (click)="openModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            Invitar usuario
          </button>
        } @else {
          <div class="readonly-badge">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
            </svg>
            Solo lectura
          </div>
        }
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Total usuarios</span>
          <strong>{{ users().length }}</strong>
          <small>Miembros registrados en tu empresa</small>
        </div>
        <div class="stat-card stat-card--accent">
          <span>Activos</span>
          <strong>{{ activeUsersCount() }}</strong>
          <small>Usuarios actualmente habilitados</small>
        </div>
        <div class="stat-card">
          <span>Administracion</span>
          <strong>{{ adminLikeUsersCount() }}</strong>
          <small>Perfiles con mas capacidad de gestion</small>
        </div>
      </div>

      <section class="users-shell">
        <div class="users-shell-head">
          <div>
            <p class="section-kicker">Accesos</p>
            <h3>Listado del equipo</h3>
          </div>
          <span class="section-note">{{ canManage() ? 'Gestion directa habilitada' : 'Consulta del estado actual' }}</span>
        </div>

        <div class="users-table">
          @if (loading()) {
            @for (i of [1,2,3]; track i) {
              <div class="user-row skeleton-row">
                <div class="sk sk-avatar"></div>
                <div class="skeleton-copy">
                  <div class="sk sk-line sk-line--lg"></div>
                  <div class="sk sk-line"></div>
                </div>
                <div class="sk sk-chip"></div>
              </div>
            }
          } @else if (users().length === 0) {
            <div class="empty-users">
              <p>No hay usuarios en esta empresa aun.</p>
              <span>Invita a tu equipo para empezar a distribuir permisos y responsabilidades.</span>
            </div>
          } @else {
            @for (u of users(); track u.id) {
              <div class="user-row">
                <div class="user-avatar">{{ initials(u) }}</div>

                <div class="user-main">
                  <div class="user-topline">
                    <div class="user-name">
                      {{ u.firstName }} {{ u.lastName }}
                      @if (u.id === currentUserId()) {
                        <span class="you-badge">Tu sesion</span>
                      }
                    </div>
                    <div class="user-status">
                      <span class="status-dot" [class.active]="u.isActive"></span>
                      {{ u.isActive ? 'Activo' : 'Inactivo' }}
                    </div>
                  </div>

                  <div class="user-email">{{ u.email }}</div>

                  <div class="user-meta">
                    <div class="user-roles">
                      @for (r of u.roles; track r) {
                        <span class="role-badge role-{{ r.toLowerCase() }}">{{ roleLabel(r) }}</span>
                      }
                    </div>
                    <div class="user-login">
                      {{ u.lastLoginAt ? 'Ult. sesion ' + (u.lastLoginAt | date:'dd/MM/yy') : 'Nunca ha ingresado' }}
                    </div>
                  </div>
                </div>

                <div class="user-actions">
                  @if (canManage() && u.id !== currentUserId()) {
                    <button class="btn-icon" (click)="openModal(u)" title="Editar">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                    </button>
                    <button class="btn-icon" (click)="toggleActive(u)" [title]="u.isActive ? 'Desactivar' : 'Activar'">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
                      </svg>
                    </button>
                  } @else if (u.id === currentUserId()) {
                    <span class="self-managed-note">Gestiona tu cuenta desde Mi perfil</span>
                  }
                </div>
              </div>
            }
          }
        </div>
      </section>

      @if (!canManage()) {
        <div class="info-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
          </svg>
          Solo los administradores y gerentes pueden invitar o modificar usuarios.
        </div>
      }
    </div>

    @if (showModal() && canManage()) {
      <div class="modal-overlay">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <p class="section-kicker">Acceso</p>
              <h3>{{ editingId() ? 'Editar usuario' : 'Invitar usuario' }}</h3>
            </div>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>

          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="form.firstName" class="form-control" placeholder="Juan"/>
              </div>
              <div class="form-group">
                <label>Apellido *</label>
                <input type="text" [(ngModel)]="form.lastName" class="form-control" placeholder="Perez"/>
              </div>
            </div>

            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="form.email" class="form-control"
                     [disabled]="!!editingId()" placeholder="usuario@empresa.com"/>
            </div>

            @if (!editingId()) {
              <div class="form-group">
                <label>Contrasena temporal *</label>
                <input type="password" [(ngModel)]="form.password" class="form-control"
                       placeholder="Minimo 8 caracteres"/>
              </div>
            }

            <div class="form-group">
              <label>Rol *</label>
              @if (loadingRoles()) {
                <div class="form-control roles-loading">Cargando roles...</div>
              } @else {
                <select [(ngModel)]="form.roleId" class="form-control">
                  @for (r of assignableRoles(); track r.id) {
                    <option [value]="r.id">{{ r.displayName }}</option>
                  }
                </select>
              }
              @if (!isAdmin()) {
                <p class="form-hint">Como gerente, no puedes asignar el rol Administrador.</p>
              }
            </div>

            @if (editingId() && isAdmin()) {
              <div class="password-panel">
                <div class="password-panel-head">
                  <div>
                    <label>Nueva contrasena</label>
                    <p class="form-hint">Opcional. Si la completas, se reemplazara la contraseña actual del usuario.</p>
                  </div>
                  @if (editingId() === currentUserId()) {
                    <span class="inline-note">Usa Mi perfil para cambiar tu propia clave.</span>
                  }
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <input type="password" [(ngModel)]="form.newPassword" class="form-control"
                           [disabled]="editingId() === currentUserId()"
                           placeholder="Minimo 8 caracteres"/>
                  </div>
                  <div class="form-group">
                    <input type="password" [(ngModel)]="form.confirmPassword" class="form-control"
                           [disabled]="editingId() === currentUserId()"
                           placeholder="Confirmar nueva contrasena"/>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving() || loadingRoles()" (click)="save()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : 'Enviar invitacion') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .settings-page { display:grid; gap:18px; }

    .page-hero,
    .users-shell {
      border-radius:24px;
      border:1px solid #dce6f0;
      background:#fff;
      box-shadow:0 18px 32px rgba(12, 28, 53, 0.06);
    }

    .page-hero {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding:22px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.12), transparent 28%),
        linear-gradient(135deg, #ffffff 0%, #f6fbff 100%);
    }

    .page-kicker,
    .section-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#00a084;
    }

    .page-hero h2,
    .users-shell-head h3,
    .modal-header h3 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      letter-spacing:-.05em;
      color:#0c1c35;
    }

    .page-hero h2 {
      font-size:28px;
      line-height:1.04;
      max-width:16ch;
    }

    .page-hero p:last-child {
      margin:10px 0 0;
      max-width:58ch;
      line-height:1.7;
      color:#6f859f;
      font-size:13px;
    }

    .readonly-badge,
    .section-note {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:8px 12px;
      border-radius:999px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      font-size:11.5px;
      font-weight:700;
      color:#6f859f;
      white-space:nowrap;
    }

    .stats-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:14px;
    }

    .stat-card {
      display:grid;
      gap:4px;
      padding:16px 18px;
      border-radius:20px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 14px 28px rgba(12, 28, 53, 0.05);
    }

    .stat-card span {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.1em;
      color:#8aa0b8;
    }

    .stat-card strong {
      font-size:18px;
      font-weight:800;
      color:#0c1c35;
    }

    .stat-card small {
      font-size:12px;
      line-height:1.55;
      color:#7a90aa;
    }

    .stat-card--accent {
      background:linear-gradient(135deg, #eef9ff, #f2fffb);
      border-color:#bfe4f0;
    }

    .users-shell { padding:22px; }

    .users-shell-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:18px;
    }

    .users-shell-head h3 { font-size:20px; }

    .users-table {
      display:grid;
      gap:12px;
    }

    .user-row {
      display:grid;
      grid-template-columns:auto minmax(0, 1fr) auto;
      gap:14px;
      align-items:center;
      padding:16px;
      border-radius:20px;
      background:#fbfdff;
      border:1px solid #dce6f0;
    }

    .user-avatar {
      width:46px;
      height:46px;
      border-radius:16px;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      font-size:14px;
      font-weight:800;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:var(--font-d, 'Sora', sans-serif);
      flex-shrink:0;
      box-shadow:0 14px 22px rgba(26, 64, 126, 0.18);
    }

    .user-main { min-width:0; }

    .user-topline {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }

    .user-name {
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      font-size:15px;
      font-weight:800;
      color:#0c1c35;
    }

    .you-badge {
      padding:4px 8px;
      border-radius:999px;
      background:#e0f2fe;
      color:#0369a1;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .user-email {
      margin-top:4px;
      font-size:12px;
      color:#7a90aa;
    }

    .user-meta {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-top:10px;
      flex-wrap:wrap;
    }

    .user-roles {
      display:flex;
      gap:6px;
      flex-wrap:wrap;
    }

    .role-badge {
      padding:5px 9px;
      border-radius:999px;
      font-size:11px;
      font-weight:700;
    }

    .role-admin    { background:#dbeafe; color:#1e40af; }
    .role-manager  { background:#ede9fe; color:#5b21b6; }
    .role-operator { background:#d1fae5; color:#065f46; }
    .role-viewer   { background:#f3f4f6; color:#6b7280; }

    .user-status {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:5px 10px;
      border-radius:999px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      font-size:11px;
      font-weight:700;
      color:#475569;
      white-space:nowrap;
    }

    .status-dot {
      width:8px;
      height:8px;
      border-radius:50%;
      background:#d1d5db;
      flex-shrink:0;
    }

    .status-dot.active { background:#10b981; }

    .user-login {
      font-size:12px;
      color:#8aa0b8;
    }

    .user-actions {
      display:flex;
      gap:6px;
      align-items:center;
    }

    .self-managed-note {
      display:inline-flex;
      align-items:center;
      padding:8px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:11px;
      font-weight:700;
      white-space:nowrap;
    }

    .btn-icon {
      width:36px;
      height:36px;
      border:none;
      border-radius:12px;
      background:#fff;
      border:1px solid #dce6f0;
      color:#6f859f;
      cursor:pointer;
      transition:all .15s;
    }

    .btn-icon:hover {
      background:#eff6ff;
      border-color:#bfdbfe;
      color:#1d4ed8;
    }

    .empty-users {
      padding:40px 20px;
      text-align:center;
      border-radius:20px;
      background:#fbfdff;
      border:1px dashed #c9d7e6;
    }

    .empty-users p {
      margin:0;
      font-size:15px;
      font-weight:700;
      color:#334155;
    }

    .empty-users span {
      display:block;
      margin-top:8px;
      font-size:12px;
      color:#8aa0b8;
    }

    .info-banner {
      display:flex;
      align-items:center;
      gap:8px;
      padding:12px 14px;
      border-radius:16px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      font-size:13px;
      color:#1e40af;
    }

    .skeleton-row {
      grid-template-columns:auto minmax(0, 1fr) auto;
    }

    .skeleton-copy {
      display:grid;
      gap:8px;
    }

    .sk {
      display:block;
      border-radius:8px;
      background:linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%);
      background-size:200% 100%;
      animation:shimmer 1.5s infinite;
    }
    .sk-avatar { width:46px; height:46px; border-radius:16px; }
    .sk-line { width:120px; height:12px; }
    .sk-line--lg { width:180px; height:14px; }
    .sk-chip { width:88px; height:30px; border-radius:999px; }
    @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

    .modal-overlay {
      position:fixed;
      inset:0;
      background:rgba(12, 28, 53, 0.46);
      backdrop-filter:blur(4px);
      z-index:220;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .modal {
      width:100%;
      max-width:520px;
      border-radius:24px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 28px 48px rgba(12, 28, 53, 0.18);
      overflow:hidden;
    }

    .modal-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      padding:20px 22px;
      border-bottom:1px solid #eef3f8;
    }

    .modal-header h3 { font-size:20px; }

    .modal-close {
      width:32px;
      height:32px;
      border:none;
      border-radius:10px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      color:#6f859f;
      cursor:pointer;
      font-size:20px;
      line-height:1;
    }

    .modal-body {
      padding:20px 22px;
    }

    .modal-footer {
      display:flex;
      justify-content:flex-end;
      gap:10px;
      padding:16px 22px 22px;
      border-top:1px solid #eef3f8;
    }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; margin-bottom:6px; font-size:12px; font-weight:700; color:#334155; }
    .form-hint { margin:6px 0 0; font-size:11px; color:#8aa0b8; }
    .password-panel {
      margin-top:6px;
      padding:14px;
      border-radius:16px;
      background:#f8fbff;
      border:1px solid #dce6f0;
    }
    .password-panel-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }
    .inline-note {
      display:inline-flex;
      align-items:center;
      padding:6px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      font-size:11px;
      font-weight:700;
      color:#1d4ed8;
      white-space:nowrap;
    }

    .form-control {
      width:100%;
      padding:11px 13px;
      border:1px solid #d4deea;
      border-radius:12px;
      font-size:14px;
      outline:none;
      box-sizing:border-box;
      background:#fff;
      color:#0f172a;
    }

    .form-control:focus {
      border-color:#1a407e;
      box-shadow:0 0 0 4px rgba(26, 64, 126, 0.09);
    }

    .form-control:disabled {
      background:#f8fbff;
      color:#9ca3af;
    }

    .roles-loading {
      color:#94a3b8;
      pointer-events:none;
      display:flex;
      align-items:center;
    }

    .btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      padding:11px 18px;
      border-radius:14px;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      border:none;
    }

    .btn-primary {
      background:linear-gradient(135deg, #1a407e, #2563eb);
      color:#fff;
      box-shadow:0 14px 24px rgba(26, 64, 126, 0.18);
    }

    .btn-secondary {
      background:#f8fbff;
      border:1px solid #dce6f0;
      color:#334155;
    }

    @media (max-width: 980px) {
      .page-hero,
      .users-shell-head,
      .user-topline { flex-direction:column; align-items:flex-start; }
      .stats-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 640px) {
      .page-hero,
      .users-shell,
      .user-row { padding:18px; }
      .user-row {
        grid-template-columns:1fr;
      }
      .user-avatar { width:42px; height:42px; }
      .user-actions { justify-content:flex-start; }
      .modal { border-radius:22px; }
      .form-row { grid-template-columns:1fr; }
      .modal-footer {
        flex-direction:column-reverse;
      }
      .modal-footer .btn,
      .btn.btn-primary { width:100%; }
    }
  `]
})
export class SettingsUsersComponent implements OnInit {
  private readonly API      = `${environment.apiUrl}/users`;
  private readonly ROLES_API = `${environment.apiUrl}/users/roles`;
  private auth = inject(AuthService);

  users        = signal<UserEntry[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  showModal    = signal(false);
  editingId    = signal<string | null>(null);

  availableRoles = signal<RoleEntry[]>([]);
  loadingRoles   = signal(false);

  form = { firstName: '', lastName: '', email: '', password: '', roleId: '', newPassword: '', confirmPassword: '' };

  currentUserId = computed(() => this.auth.user()?.id ?? '');
  private userRoles = computed(() => this.auth.user()?.roles ?? []);
  canManage = computed(() => this.userRoles().some(r => r === 'ADMIN' || r === 'MANAGER'));
  isAdmin   = computed(() => this.userRoles().includes('ADMIN'));

  assignableRoles = computed(() =>
    this.isAdmin()
      ? this.availableRoles()
      : this.availableRoles().filter(r => r.name !== 'ADMIN')
  );

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.loadRoles();
    this.load();
  }

  activeUsersCount(): number {
    return this.users().filter((user) => user.isActive).length;
  }

  adminLikeUsersCount(): number {
    return this.users().filter((user) => user.roles.includes('ADMIN') || user.roles.includes('MANAGER')).length;
  }

  load() {
    this.loading.set(true);
    this.http.get<any>(this.API).subscribe({
      next: r => { this.users.set(r.data ?? r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadRoles() {
    this.loadingRoles.set(true);
    this.http.get<RoleEntry[]>(this.ROLES_API).subscribe({
      next: roles => {
        this.availableRoles.set(roles);
        const defaultRole = roles.find(r => r.name === 'OPERATOR') ?? roles[0];
        if (defaultRole && !this.form.roleId) {
          this.form.roleId = defaultRole.id;
        }
        this.loadingRoles.set(false);
      },
      error: () => {
        this.loadingRoles.set(false);
        this.notify.error('No se pudieron cargar los roles');
      },
    });
  }

  openModal(u?: UserEntry) {
    if (!this.canManage()) return;

    if (u) {
      const currentRoleName = u.roles[0] ?? 'OPERATOR';
      const matchedRole = this.availableRoles().find(r => r.name === currentRoleName);
      const defaultRole  = this.availableRoles().find(r => r.name === 'OPERATOR') ?? this.availableRoles()[0];

      this.editingId.set(u.id);
      this.form = {
        firstName: u.firstName,
        lastName:  u.lastName,
        email:     u.email,
        password:  '',
        roleId:    matchedRole?.id ?? defaultRole?.id ?? '',
        newPassword: '',
        confirmPassword: '',
      };
    } else {
      const defaultRole = this.availableRoles().find(r => r.name === 'OPERATOR') ?? this.availableRoles()[0];
      this.editingId.set(null);
      this.form = {
        firstName: '', lastName: '', email: '', password: '', roleId: defaultRole?.id ?? '',
        newPassword: '', confirmPassword: '',
      };
    }

    this.showModal.set(true);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales.
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.canManage()) return;
    if (!this.form.firstName || !this.form.email) {
      this.notify.warning('Nombre y email son obligatorios'); return;
    }
    if (!this.form.roleId) {
      this.notify.warning('Selecciona un rol'); return;
    }
    if (this.editingId() && this.isAdmin() && this.form.newPassword) {
      if (this.form.newPassword.length < 8) {
        this.notify.warning('La contrasena debe tener al menos 8 caracteres'); return;
      }
      if (this.form.newPassword !== this.form.confirmPassword) {
        this.notify.warning('Las contrasenas no coinciden'); return;
      }
    }

    this.saving.set(true);

    const body: any = {
      firstName: this.form.firstName,
      lastName:  this.form.lastName,
      roleId:    this.form.roleId,
    };
    if (!this.editingId()) {
      body.email = this.form.email;
      if (this.form.password) body.password = this.form.password;
    }

    const request = this.editingId()
      ? this.http.put(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    request.subscribe({
      next: () => {
        if (this.editingId() && this.isAdmin() && this.form.newPassword && this.editingId() !== this.currentUserId()) {
          this.http.patch(`${this.API}/${this.editingId()}/password`, {
            newPassword: this.form.newPassword,
          }).subscribe({
            next: () => {
              this.notify.success('Usuario y contrasena actualizados');
              this.saving.set(false); this.closeModal(); this.load();
            },
            error: e => {
              this.saving.set(false);
              this.notify.error(e?.error?.message ?? 'Usuario actualizado, pero no se pudo cambiar la contrasena');
            },
          });
          return;
        }

        this.notify.success(this.editingId() ? 'Usuario actualizado' : 'Invitacion enviada');
        this.saving.set(false); this.closeModal(); this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al guardar'); },
    });
  }

  toggleActive(u: UserEntry) {
    if (!this.canManage() || u.id === this.currentUserId()) return;
    this.http.put(`${this.API}/${u.id}`, { isActive: !u.isActive }).subscribe({
      next: () => { this.notify.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error'),
    });
  }

  initials(u: UserEntry): string {
    return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();
  }

  roleLabel(roleName: string): string {
    const found = this.availableRoles().find(r => r.name === roleName);
    if (found) return found.displayName;
    const fallback: Record<string, string> = {
      ADMIN: 'Admin', MANAGER: 'Gerente', OPERATOR: 'Operador', VIEWER: 'Visualizador',
    };
    return fallback[roleName] ?? roleName;
  }
}
