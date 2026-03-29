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
    <div class="settings-page">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Empresa</p>
          <h2>Identidad legal y datos operativos</h2>
          <p>Mantén alineados los datos comerciales, tributarios y de contacto que usa tu operacion diaria.</p>
        </div>

        <div class="hero-actions">
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
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <span>NIT</span>
          <strong>{{ nit || 'Pendiente' }}</strong>
          <small>Identificador tributario principal</small>
        </div>
        <div class="stat-card stat-card--accent">
          <span>Contacto</span>
          <strong>{{ form.email || 'Sin correo' }}</strong>
          <small>Canal central de relacion con clientes</small>
        </div>
        <div class="stat-card">
          <span>Ubicacion</span>
          <strong>{{ form.city || 'Sin ciudad' }}</strong>
          <small>{{ form.department || 'Completa tu cobertura geografica' }}</small>
        </div>
      </div>

      <section class="panel-card">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Ficha empresarial</p>
            <h3>Datos principales</h3>
          </div>
          <span class="panel-note">{{ canManage() ? 'Editable por administracion' : 'Visible para consulta' }}</span>
        </div>

        @if (loading()) {
          <div class="skeleton-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="skeleton-row">
                <div class="sk sk-label"></div>
                <div class="sk sk-input"></div>
              </div>
            }
          </div>
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
            <label>Razon social</label>
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
              <label>Telefono</label>
              <input type="tel" [(ngModel)]="form.phone"
                     [disabled]="!canManage()" class="form-control"
                     [class.form-control--disabled]="!canManage()"
                     placeholder="+57 300 000 0000"/>
            </div>
          </div>

          <div class="form-group">
            <label>Direccion</label>
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
                     placeholder="Bogota"/>
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
      </section>

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
    .settings-page { display:grid; gap:18px; }

    .page-hero {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding:22px;
      border-radius:24px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.12), transparent 30%),
        linear-gradient(135deg, #ffffff 0%, #f5fbff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 16px 30px rgba(12, 28, 53, 0.06);
    }

    .page-kicker,
    .panel-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#00a084;
    }

    .page-hero h2,
    .panel-head h3 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      letter-spacing:-.04em;
      color:#0c1c35;
    }

    .page-hero h2 { font-size:28px; line-height:1.04; max-width:16ch; }
    .page-hero p:last-child { margin:10px 0 0; max-width:58ch; line-height:1.7; color:#6f859f; font-size:13px; }

    .hero-actions { display:flex; align-items:center; }

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
      line-height:1.25;
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

    .panel-card {
      padding:22px;
      border-radius:24px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 18px 32px rgba(12, 28, 53, 0.06);
    }

    .panel-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:18px;
    }

    .panel-head h3 { font-size:20px; }

    .panel-note,
    .readonly-badge {
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

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .form-group { margin-bottom:16px; }
    .form-group:last-child { margin-bottom:0; }
    .form-group label { display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px; }

    .form-control {
      width:100%;
      padding:11px 13px;
      border:1px solid #d4deea;
      border-radius:12px;
      font-size:14px;
      outline:none;
      box-sizing:border-box;
      color:#0c1c35;
      background:#fff;
      transition:border-color .15s, box-shadow .15s;
    }

    .form-control:focus:not(:disabled) {
      border-color:#1a407e;
      box-shadow:0 0 0 4px rgba(26, 64, 126, 0.09);
    }

    .form-control--disabled,
    .form-control:disabled {
      background:#f8fbff;
      color:#94a3b8;
      cursor:default;
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

    .skeleton-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:16px;
    }

    .skeleton-row { display:grid; gap:8px; }
    .sk {
      display:block;
      border-radius:8px;
      background:linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%);
      background-size:200% 100%;
      animation:shimmer 1.5s infinite;
    }
    .sk-label { width:96px; height:12px; }
    .sk-input { width:100%; height:44px; border-radius:12px; }
    @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

    .btn {
      display:inline-flex;
      align-items:center;
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

    .btn-primary:hover:not(:disabled) { transform:translateY(-1px); }
    .btn-primary:disabled { opacity:.6; cursor:default; }

    @media (max-width: 980px) {
      .page-hero,
      .panel-head { flex-direction:column; align-items:flex-start; }
      .stats-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 640px) {
      .page-hero,
      .panel-card { padding:18px; }
      .form-row,
      .skeleton-grid { grid-template-columns:1fr; }
      .hero-actions,
      .btn.btn-primary { width:100%; }
      .btn.btn-primary { justify-content:center; }
    }
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
