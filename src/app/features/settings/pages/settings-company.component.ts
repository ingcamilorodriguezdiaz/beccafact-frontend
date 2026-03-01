import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings-company',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page">
      <h3>Mi empresa</h3>
      <div class="card">
        <div class="field-row">
          <div class="field">
            <label>Nombre comercial</label>
            <input type="text" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label>NIT</label>
            <input type="text" [value]="nit" disabled class="disabled" />
          </div>
        </div>
        <div class="field">
          <label>Razón social</label>
          <input type="text" [(ngModel)]="form.razonSocial" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Correo de contacto</label>
            <input type="email" [(ngModel)]="form.email" />
          </div>
          <div class="field">
            <label>Teléfono</label>
            <input type="tel" [(ngModel)]="form.phone" />
          </div>
        </div>
        <div class="field">
          <label>Dirección</label>
          <input type="text" [(ngModel)]="form.address" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Ciudad</label>
            <input type="text" [(ngModel)]="form.city" />
          </div>
          <div class="field">
            <label>Departamento</label>
            <input type="text" [(ngModel)]="form.department" />
          </div>
        </div>
        <div class="form-footer">
          <button class="btn-primary" (click)="save()">Guardar cambios</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page h3 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
    .card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; }
    .field { margin-bottom: 16px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input { width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
    input:focus { outline: none; border-color: #3b82f6; }
    input.disabled { background: #f8fafc; color: #94a3b8; }
    .form-footer { display: flex; justify-content: flex-end; margin-top: 8px; }
    .btn-primary { background: #1d4ed8; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
  `],
})
export class SettingsCompanyComponent implements OnInit {
  form = { name: '', razonSocial: '', email: '', phone: '', address: '', city: '', department: '' };
  nit = '';

  constructor(private http: HttpClient, private notification: NotificationService) {}

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/companies/me`).subscribe({
      next: (res) => {
        const d = res.data ?? res;
        this.nit = d.nit ?? '';
        this.form = {
          name: d.name ?? '',
          razonSocial: d.razonSocial ?? '',
          email: d.email ?? '',
          phone: d.phone ?? '',
          address: d.address ?? '',
          city: d.city ?? '',
          department: d.department ?? '',
        };
      },
    });
  }

  save() {
    this.http.put<any>(`${environment.apiUrl}/companies/me`, this.form).subscribe({
      next: () => this.notification.success('Datos actualizados'),
      error: () => this.notification.error('Error al guardar'),
    });
  }
}
