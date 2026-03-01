import { Component, signal, OnInit } from '@angular/core';
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
      <h3>Mi perfil</h3>
      <div class="card">
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
          <label>Correo electrónico</label>
          <input type="email" [value]="auth.user()?.email ?? ''" disabled class="disabled" />
          <span class="hint">El correo no se puede cambiar</span>
        </div>
        <div class="field">
          <label>Teléfono</label>
          <input type="tel" [(ngModel)]="form.phone" placeholder="+57 300 000 0000" />
        </div>
        <div class="form-footer">
          <button class="btn-primary" (click)="save()">Guardar cambios</button>
        </div>
      </div>

      <h3 style="margin-top:24px">Cambiar contraseña</h3>
      <div class="card">
        <div class="field">
          <label>Contraseña actual</label>
          <input type="password" [(ngModel)]="pwd.current" placeholder="••••••••" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Nueva contraseña</label>
            <input type="password" [(ngModel)]="pwd.newPwd" placeholder="Mínimo 8 caracteres" />
          </div>
          <div class="field">
            <label>Confirmar contraseña</label>
            <input type="password" [(ngModel)]="pwd.confirm" placeholder="Repetir contraseña" />
          </div>
        </div>
        <div class="form-footer">
          <button class="btn-primary" (click)="changePassword()">Cambiar contraseña</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page h3 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
    .card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    .field { margin-bottom: 16px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    input.disabled { background: #f8fafc; color: #94a3b8; }
    .hint { font-size: 12px; color: #94a3b8; margin-top: 4px; display: block; }
    .form-footer { display: flex; justify-content: flex-end; margin-top: 8px; }
    .btn-primary { background: #1d4ed8; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
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
    const user = this.auth.user();
    if (user) {
      this.form.firstName = user.firstName ?? '';
      this.form.lastName = user.lastName ?? '';
    }
  }

  save() {
    this.http.put<any>(`${environment.apiUrl}/users/me`, this.form).subscribe({
      next: () => {
        this.notification.success('Perfil actualizado');
        this.auth.loadProfile().subscribe();
      },
      error: () => this.notification.error('Error al guardar cambios'),
    });
  }

  changePassword() {
    if (this.pwd.newPwd !== this.pwd.confirm) {
      this.notification.error('Las contraseñas no coinciden');
      return;
    }
    if (this.pwd.newPwd.length < 8) {
      this.notification.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.http.patch<any>(`${environment.apiUrl}/users/me/password`, {
      currentPassword: this.pwd.current,
      newPassword: this.pwd.newPwd,
    }).subscribe({
      next: () => {
        this.notification.success('Contraseña cambiada exitosamente');
        this.pwd = { current: '', newPwd: '', confirm: '' };
      },
      error: (err) => this.notification.error(err.error?.message || 'Error al cambiar contraseña'),
    });
  }
}
