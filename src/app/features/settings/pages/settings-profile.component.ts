import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <section class="page-hero">
        <div class="page-hero-copy">
          <p class="page-kicker">Cuenta personal</p>
          <h2>Mi perfil y seguridad</h2>
          <p>Mantén tu identidad actualizada y protege el acceso a tu espacio de trabajo.</p>
        </div>

        <div class="page-hero-card">
          <div class="avatar-badge">{{ initials() }}</div>
          <div>
            <strong>{{ fullName() }}</strong>
            <span>{{ auth.user()?.email ?? 'Sin correo' }}</span>
          </div>
        </div>
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Cuenta</span>
          <strong>{{ auth.user()?.email ? 'Verificada' : 'Pendiente' }}</strong>
          <small>Correo principal protegido</small>
        </div>
        <div class="stat-card stat-card--accent">
          <span>Contacto</span>
          <strong>{{ form.phone || 'Sin telefono' }}</strong>
          <small>Canal para notificaciones clave</small>
        </div>
        <div class="stat-card">
          <span>Seguridad</span>
          <strong>{{ passwordState() }}</strong>
          <small>Actualiza tu clave regularmente</small>
        </div>
      </div>

      <div class="content-grid">
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Datos base</p>
              <h3>Informacion del perfil</h3>
            </div>
            <span class="panel-tag">Editable</span>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Nombre</label>
              <input type="text" [(ngModel)]="form.firstName" />
            </div>
            <div class="field">
              <label>Apellido</label>
              <input type="text" [(ngModel)]="form.lastName" />
            </div>
          </div>

          <div class="field">
            <label>Correo electronico</label>
            <input type="email" [value]="auth.user()?.email ?? ''" disabled class="disabled" />
            <span class="hint">Este correo se usa como identificador principal de acceso.</span>
          </div>

          <div class="field">
            <label>Telefono</label>
            <input type="tel" [(ngModel)]="form.phone" name="phone" autocomplete="tel" inputmode="tel" placeholder="+57 300 000 0000" />
          </div>

          <div class="form-footer">
            <button class="btn-primary" (click)="save()">Guardar cambios</button>
          </div>
        </section>

        <section class="panel-card panel-card--soft">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Acceso</p>
              <h3>Cambiar contrasena</h3>
            </div>
            <span class="panel-tag panel-tag--secure">Seguridad</span>
          </div>

          <div class="field">
            <label>Contrasena actual</label>
            <input type="password" [(ngModel)]="pwd.current" placeholder="••••••••" />
          </div>

          <div class="field-row">
            <div class="field">
              <label>Nueva contrasena</label>
              <input type="password" [(ngModel)]="pwd.newPwd" placeholder="Minimo 8 caracteres" />
            </div>
            <div class="field">
              <label>Confirmar contrasena</label>
              <input type="password" [(ngModel)]="pwd.confirm" placeholder="Repetir contrasena" />
            </div>
          </div>

          <div class="security-note">
            <strong>Recomendacion:</strong> usa una clave unica con letras, numeros y simbolos para reforzar el acceso.
          </div>

          <div class="form-footer">
            <button class="btn-primary btn-primary--dark" (click)="changePassword()">Actualizar contrasena</button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      display:grid;
      gap:18px;
    }

    .page-hero {
      display:grid;
      grid-template-columns:minmax(0, 1.3fr) minmax(260px, .7fr);
      gap:16px;
      padding:22px;
      border-radius:24px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.18), transparent 30%),
        linear-gradient(135deg, #0d2344 0%, #163b71 58%, #0d8b74 100%);
      color:#fff;
      box-shadow:0 20px 36px rgba(12, 28, 53, 0.14);
    }

    .page-kicker,
    .panel-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
    }

    .page-kicker { color:#8bf3cb; }
    .panel-kicker { color:#00a084; }

    .page-hero-copy h2,
    .panel-head h3 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      color:#0c1c35;
      letter-spacing:-.04em;
    }

    .page-hero-copy h2 {
      color:#fff;
      font-size:28px;
      line-height:1.04;
    }

    .page-hero-copy p:last-child {
      margin:10px 0 0;
      max-width:54ch;
      line-height:1.65;
      color:rgba(236, 244, 255, 0.8);
      font-size:13px;
    }

    .page-hero-card {
      display:flex;
      align-items:center;
      gap:12px;
      padding:16px;
      border-radius:20px;
      background:rgba(255, 255, 255, 0.12);
      border:1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter:blur(12px);
    }

    .avatar-badge {
      width:54px;
      height:54px;
      border-radius:18px;
      background:rgba(255, 255, 255, 0.18);
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:18px;
      font-weight:800;
      color:#fff;
      flex-shrink:0;
    }

    .page-hero-card strong {
      display:block;
      font-size:15px;
      font-weight:800;
      color:#fff;
    }

    .page-hero-card span {
      display:block;
      margin-top:4px;
      font-size:12px;
      color:rgba(236, 244, 255, 0.78);
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
      color:#7a90aa;
    }

    .stat-card--accent {
      background:linear-gradient(135deg, #eef9ff, #f2fffb);
      border-color:#bfe4f0;
    }

    .content-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:18px;
    }

    .panel-card {
      padding:22px;
      border-radius:24px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 18px 32px rgba(12, 28, 53, 0.06);
    }

    .panel-card--soft {
      background:linear-gradient(180deg, #fcfdff 0%, #f7fbff 100%);
    }

    .panel-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:18px;
    }

    .panel-head h3 {
      font-size:20px;
    }

    .panel-tag {
      padding:6px 10px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      font-size:11px;
      font-weight:700;
      color:#1d4ed8;
      white-space:nowrap;
    }

    .panel-tag--secure {
      background:#ecfdf5;
      border-color:#bbf7d0;
      color:#047857;
    }

    .field {
      margin-bottom:16px;
    }

    .field-row {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:16px;
    }

    label {
      display:block;
      margin-bottom:6px;
      font-size:12px;
      font-weight:700;
      color:#334155;
    }

    input {
      width:100%;
      padding:11px 13px;
      border:1px solid #d4deea;
      border-radius:12px;
      background:#fff;
      color:#0f172a;
      font-size:14px;
      box-sizing:border-box;
      transition:border-color .15s, box-shadow .15s, transform .15s;
    }

    input:focus {
      outline:none;
      border-color:#3b82f6;
      box-shadow:0 0 0 4px rgba(59, 130, 246, 0.1);
    }

    input.disabled {
      background:#f8fbff;
      color:#94a3b8;
    }

    .hint {
      display:block;
      margin-top:6px;
      font-size:12px;
      color:#8aa0b8;
      line-height:1.5;
    }

    .security-note {
      margin-top:4px;
      padding:12px 14px;
      border-radius:14px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      font-size:12px;
      line-height:1.6;
      color:#1e40af;
    }

    .form-footer {
      display:flex;
      justify-content:flex-end;
      margin-top:8px;
    }

    .btn-primary {
      border:none;
      border-radius:14px;
      padding:12px 18px;
      font-size:14px;
      font-weight:700;
      color:#fff;
      cursor:pointer;
      background:linear-gradient(135deg, #1a407e, #2563eb);
      box-shadow:0 14px 24px rgba(26, 64, 126, 0.2);
      transition:transform .15s, box-shadow .15s, opacity .15s;
    }

    .btn-primary:hover {
      transform:translateY(-1px);
      box-shadow:0 18px 28px rgba(26, 64, 126, 0.26);
    }

    .btn-primary--dark {
      background:linear-gradient(135deg, #0f274b, #0d8b74);
    }

    @media (max-width: 980px) {
      .page-hero,
      .content-grid,
      .stats-grid {
        grid-template-columns:1fr;
      }
    }

    @media (max-width: 640px) {
      .page-hero,
      .panel-card {
        padding:18px;
      }

      .field-row {
        grid-template-columns:1fr;
        gap:0;
      }

      .form-footer {
        justify-content:stretch;
      }

      .btn-primary {
        width:100%;
      }
    }
  `],
})
export class SettingsProfileComponent implements OnInit {
  form = { firstName: '', lastName: '', phone: '' };
  pwd = { current: '', newPwd: '', confirm: '' };

  constructor(
    protected auth: AuthService,
    private http: HttpClient,
    private notification: NotificationService,
  ) {}

  ngOnInit() {
    this.syncFormWithUser();
  }

  private syncFormWithUser() {
    const user = this.auth.user();
    if (!user) return;
    this.form.firstName = user.firstName ?? '';
    this.form.lastName = user.lastName ?? '';
    this.form.phone = user.phone ?? '';
  }

  initials(): string {
    return `${this.form.firstName?.[0] ?? ''}${this.form.lastName?.[0] ?? ''}`.trim().toUpperCase() || 'BF';
  }

  fullName(): string {
    return `${this.form.firstName} ${this.form.lastName}`.trim() || 'Tu perfil';
  }

  passwordState(): string {
    return this.pwd.newPwd ? 'En actualizacion' : 'Protegida';
  }

  save() {
    this.http.patch<any>(`${environment.apiUrl}/users/me`, this.form).subscribe({
      next: () => {
        this.notification.success('Perfil actualizado');
        this.auth.loadProfile().subscribe({
          next: () => this.syncFormWithUser(),
        });
      },
      error: () => this.notification.error('Error al guardar cambios'),
    });
  }

  changePassword() {
    if (this.pwd.newPwd !== this.pwd.confirm) {
      this.notification.error('Las contrasenas no coinciden');
      return;
    }
    if (this.pwd.newPwd.length < 8) {
      this.notification.error('La contrasena debe tener al menos 8 caracteres');
      return;
    }
    this.http.patch<any>(`${environment.apiUrl}/users/me/password`, {
      currentPassword: this.pwd.current,
      newPassword: this.pwd.newPwd,
    }).subscribe({
      next: () => {
        this.notification.success('Contrasena cambiada exitosamente');
        this.pwd = { current: '', newPwd: '', confirm: '' };
      },
      error: (err) => this.notification.error(err.error?.message || 'Error al cambiar contrasena'),
    });
  }
}
