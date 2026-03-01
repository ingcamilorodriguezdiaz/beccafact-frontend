import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
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

@Component({
  selector: 'app-settings-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="section-header">
        <div>
          <h3 class="section-title">Gestión de usuarios</h3>
          <p class="section-sub">Administra quién tiene acceso y qué puede hacer</p>
        </div>
        <button class="btn btn-primary" (click)="openModal()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          Invitar usuario
        </button>
      </div>

      <div class="users-table">
        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="user-row skeleton-row">
              <div class="sk sk-avatar"></div>
              <div class="sk sk-line" style="width:160px"></div>
              <div class="sk sk-line" style="width:120px"></div>
              <div class="sk sk-line" style="width:80px"></div>
            </div>
          }
        } @else if (users().length === 0) {
          <div class="empty-users">
            <p>No hay usuarios en esta empresa aún.</p>
          </div>
        } @else {
          @for (u of users(); track u.id) {
            <div class="user-row">
              <div class="user-avatar">{{ initials(u) }}</div>
              <div class="user-info">
                <div class="user-name">{{ u.firstName }} {{ u.lastName }}</div>
                <div class="user-email">{{ u.email }}</div>
              </div>
              <div class="user-roles">
                @for (r of u.roles; track r) {
                  <span class="role-badge role-{{ r.toLowerCase() }}">{{ roleLabel(r) }}</span>
                }
              </div>
              <div class="user-status">
                <span class="status-dot" [class.active]="u.isActive"></span>
                {{ u.isActive ? 'Activo' : 'Inactivo' }}
              </div>
              <div class="user-login text-muted">
                {{ u.lastLoginAt ? 'Última sesión ' + (u.lastLoginAt | date:'dd/MM/yy') : 'Nunca' }}
              </div>
              <div class="user-actions">
                <button class="btn-icon" (click)="openModal(u)" title="Editar">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                </button>
                <button class="btn-icon" (click)="toggleActive(u)" [title]="u.isActive ? 'Desactivar' : 'Activar'">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/></svg>
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Invite/Edit Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Editar usuario' : 'Invitar usuario' }}</h3>
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
                <input type="text" [(ngModel)]="form.lastName" class="form-control" placeholder="Pérez"/>
              </div>
            </div>
            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="form.email" class="form-control" [disabled]="!!editingId()" placeholder="usuario@empresa.com"/>
            </div>
            @if (!editingId()) {
              <div class="form-group">
                <label>Contraseña temporal *</label>
                <input type="password" [(ngModel)]="form.password" class="form-control" placeholder="Mínimo 8 caracteres"/>
              </div>
            }
            <div class="form-group">
              <label>Rol *</label>
              <select [(ngModel)]="form.role" class="form-control">
                <option value="ADMIN">Administrador — acceso total</option>
                <option value="MANAGER">Gerente — puede ver todo, crear y editar</option>
                <option value="OPERATOR">Operador — crea facturas y productos</option>
                <option value="VIEWER">Visualizador — solo lectura</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : 'Enviar invitación') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .section-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
    .section-title { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .section-sub { font-size:13px; color:#9ca3af; margin:0; }
    .users-table { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .user-row { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid #f0f4f8; }
    .user-row:last-child { border:none; }
    .user-avatar { width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .user-info { flex:1; min-width:0; }
    .user-name { font-size:14px; font-weight:600; color:#0c1c35; }
    .user-email { font-size:12px; color:#9ca3af; }
    .user-roles { display:flex; gap:4px; flex-wrap:wrap; }
    .role-badge { padding:2px 8px; border-radius:6px; font-size:10.5px; font-weight:700; }
    .role-admin { background:#dbeafe; color:#1e40af; }
    .role-manager { background:#ede9fe; color:#5b21b6; }
    .role-operator { background:#d1fae5; color:#065f46; }
    .role-viewer { background:#f3f4f6; color:#6b7280; }
    .user-status { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#374151; min-width:70px; }
    .status-dot { width:7px; height:7px; border-radius:50%; background:#d1d5db; }
    .status-dot.active { background:#10b981; }
    .user-login { font-size:12px; color:#9ca3af; min-width:120px; }
    .user-actions { display:flex; gap:4px; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .text-muted { color:#9ca3af; }
    .empty-users { padding:40px 24px; text-align:center; color:#9ca3af; font-size:14px; }
    .skeleton-row .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .skeleton-row .sk-avatar { width:36px; height:36px; border-radius:9px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:480px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; font-size:20px; padding:0 4px; }
    .modal-body { padding:20px 24px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control:disabled { background:#f8fafc; color:#9ca3af; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
  `]
})
export class SettingsUsersComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/users`;

  users = signal<UserEntry[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  editingId = signal<string | null>(null);
  form = { firstName: '', lastName: '', email: '', password: '', role: 'OPERATOR' };

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>(this.API).subscribe({
      next: r => { this.users.set(r.data ?? r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  openModal(u?: UserEntry) {
    if (u) {
      this.editingId.set(u.id);
      this.form = { firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', role: u.roles[0] ?? 'OPERATOR' };
    } else {
      this.editingId.set(null);
      this.form = { firstName: '', lastName: '', email: '', password: '', role: 'OPERATOR' };
    }
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.firstName || !this.form.email) { this.notify.warning('Nombre y email son obligatorios'); return; }
    this.saving.set(true);
    const body: any = { firstName: this.form.firstName, lastName: this.form.lastName, email: this.form.email, roles: [this.form.role] };
    if (!this.editingId() && this.form.password) body.password = this.form.password;

    const req = this.editingId()
      ? this.http.patch(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => { this.notify.success(this.editingId() ? 'Usuario actualizado' : 'Usuario creado'); this.saving.set(false); this.closeModal(); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al guardar'); }
    });
  }

  toggleActive(u: UserEntry) {
    this.http.patch(`${this.API}/${u.id}`, { isActive: !u.isActive }).subscribe({
      next: () => { this.notify.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error')
    });
  }

  initials(u: UserEntry): string { return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase(); }
  roleLabel(r: string): string { return { ADMIN: 'Admin', MANAGER: 'Gerente', OPERATOR: 'Operador', VIEWER: 'Viewer', SUPER_ADMIN: 'SuperAdmin' }[r] ?? r; }
}