import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings-company',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="section-header">
        <div>
          <h3 class="section-title">Mi empresa</h3>
          <p class="section-sub">Información legal y de contacto de tu empresa</p>
        </div>

        @if (canManage()) {
          <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
            </svg>
            {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        } @else {
          <div class="readonly-badge">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
            </svg>
            Solo lectura
          </div>
        }
      </div>

      <div class="form-card">
        @if (loading()) {
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton-row">
              <div class="sk" style="width:100px;height:12px;margin-bottom:6px"></div>
              <div class="sk" style="width:100%;height:38px;border-radius:8px"></div>
            </div>
          }
        } @else {
          <div class="form-row">
            <div class="form-group">
              <label>Nombre comercial *</label>
              <input type="text" [(ngModel)]="form.name"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="Empresa S.A.S"/>
            </div>
            <div class="form-group">
              <label>NIT</label>
              <input type="text" [value]="nit" disabled
                     class="form-control form-control--disabled" placeholder="900.123.456-7"/>
            </div>
          </div>

          <div class="form-group">
            <label>Razón social</label>
            <input type="text" [(ngModel)]="form.razonSocial"
                   [disabled]="!canManage()" class="form-control"
                   [class.form-control--disabled]="!canManage()"
                   placeholder="Empresa S.A.S"/>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Correo de contacto</label>
              <input type="email" [(ngModel)]="form.email"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="contacto@empresa.com"/>
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" [(ngModel)]="form.phone"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="+57 300 000 0000"/>
            </div>
          </div>

          <div class="form-group">
            <label>Dirección</label>
            <input type="text" [(ngModel)]="form.address"
                   [disabled]="!canManage()" class="form-control"
                   [class.form-control--disabled]="!canManage()"
                   placeholder="Calle 123 # 45-67"/>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Ciudad</label>
              <input type="text" [(ngModel)]="form.city"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="Bogotá"/>
            </div>
            <div class="form-group">
              <label>Departamento</label>
              <input type="text" [(ngModel)]="form.department"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="Cundinamarca"/>
            </div>
          </div>
        }
      </div>

      @if (!canManage()) {
        <div class="info-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
          </svg>
          Solo los administradores y gerentes pueden modificar los datos de la empresa.
        </div>
      }
    </div>
  `,
  styles: [`
    .section-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .section-title { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .section-sub { font-size:13px; color:#9ca3af; margin:0; }

    .readonly-badge {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 13px; border-radius:8px;
      background:#f8fafc; border:1px solid #dce6f0;
      font-size:12.5px; font-weight:600; color:#9ca3af;
    }

    .form-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:20px 24px; }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .form-group { margin-bottom:16px; }
    .form-group:last-child { margin-bottom:0; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }

    .form-control {
      width:100%; padding:9px 12px; border:1px solid #dce6f0;
      border-radius:8px; font-size:14px; outline:none;
      box-sizing:border-box; color:#0c1c35; transition:border-color .15s;
    }
    .form-control:focus:not(:disabled) { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control--disabled, .form-control:disabled { background:#f8fafc; color:#9ca3af; cursor:default; }

    .info-banner {
      display:flex; align-items:center; gap:8px;
      margin-top:14px; padding:10px 14px;
      background:#eff6ff; border:1px solid #bfdbfe;
      border-radius:10px; font-size:13px; color:#1e40af;
    }

    .skeleton-row { margin-bottom:16px; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; display:block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }

    @media (max-width:540px) { .form-row { grid-template-columns:1fr; } }
  `]
})
export class SettingsCompanyComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/companies/me`;
  private auth = inject(AuthService);

  loading = signal(true);
  saving  = signal(false);
  nit     = '';
  form    = { name:'', razonSocial:'', email:'', phone:'', address:'', city:'', department:'' };

  private userRoles = computed(() => this.auth.user()?.roles ?? []);
  canManage = computed(() => this.userRoles().some(r => r === 'ADMIN' || r === 'MANAGER'));

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.http.get<any>(this.API).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.nit = d.nit ?? '';
        this.form = { name:d.name??'', razonSocial:d.razonSocial??'', email:d.email??'', phone:d.phone??'', address:d.address??'', city:d.city??'', department:d.department??'' };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save() {
    if (!this.canManage()) return;
    this.saving.set(true);
    this.http.put<any>(this.API, this.form).subscribe({
      next: () => { this.notify.success('Datos actualizados'); this.saving.set(false); },
      error: () => { this.notify.error('Error al guardar'); this.saving.set(false); },
    });
  }
}