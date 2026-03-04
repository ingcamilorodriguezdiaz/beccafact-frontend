import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

interface DianConfig {
  enabled: boolean;
  ambiente: 'habilitacion' | 'produccion';
  resolucion: string;
  prefijo: string;
  rangoDesde: number | null;
  rangoHasta: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  softwareId: string;
  softwarePin: string;
}

@Component({
  selector: 'app-settings-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="section-header">
        <div>
          <h3 class="section-title">Integraciones</h3>
          <p class="section-sub">Configura la conexión con la DIAN para facturación electrónica</p>
        </div>
        @if (!canManage()) {
          <div class="readonly-badge">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
            </svg>
            Solo lectura
          </div>
        }
      </div>

      <!-- Tarjeta DIAN -->
      <div class="intg-list">
        <div class="intg-row">
          <!-- Logo DIAN -->
          <div class="intg-logo">
            <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
              <rect width="48" height="48" rx="10" fill="#003366"/>
              <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
                    fill="#FFD700" font-size="13" font-weight="800"
                    font-family="Arial,sans-serif">DIAN</text>
            </svg>
          </div>

          <div class="intg-info">
            <div class="intg-name">
              DIAN — Facturación Electrónica
              @if (config().enabled) {
                <span class="connected-badge">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                  </svg>
                  Activa
                </span>
              } @else {
                <span class="inactive-badge">Inactiva</span>
              }
              @if (config().enabled) {
                <span class="env-badge env-{{ config().ambiente }}">
                  {{ config().ambiente === 'produccion' ? 'Producción' : 'Habilitación' }}
                </span>
              }
            </div>
            <div class="intg-desc">
              Emite, envía y valida facturas electrónicas ante la DIAN según la resolución 000042 de 2020
            </div>
          </div>

          <div class="intg-actions">
            @if (canManage()) {
              <button class="btn" [class.btn-primary]="!config().enabled"
                      [class.btn-secondary]="config().enabled"
                      (click)="togglePanel()">
                {{ panelOpen() ? 'Cerrar' : (config().enabled ? 'Configurar' : 'Configurar') }}
              </button>
            } @else {
              <button class="btn btn-ghost" (click)="togglePanel()">
                Ver configuración
              </button>
            }
          </div>
        </div>

        <!-- Panel de configuración expandible -->
        @if (panelOpen()) {
          <div class="config-panel">

            @if (loading()) {
              <div class="config-loading">
                @for (i of [1,2,3,4]; track i) {
                  <div class="sk" style="height:38px;border-radius:8px;margin-bottom:12px"></div>
                }
              </div>
            } @else {

              <!-- Toggle habilitar -->
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">Facturación electrónica DIAN</div>
                  <div class="toggle-sub">
                    {{ config().enabled ? 'Actualmente habilitada para este RUT' : 'Activa para comenzar a emitir facturas electrónicas' }}
                  </div>
                </div>
                <button class="toggle-btn" [class.toggle-btn--on]="config().enabled"
                        [disabled]="!canManage()" (click)="toggleEnabled()">
                  <span class="toggle-knob"></span>
                </button>
              </div>

              <div class="divider"></div>

              <!-- Ambiente -->
              <div class="form-row">
                <div class="form-group form-group--full">
                  <label>Ambiente</label>
                  <div class="radio-group">
                    <label class="radio-option" [class.radio-option--active]="config().ambiente === 'habilitacion'">
                      <input type="radio" [(ngModel)]="draftConfig.ambiente" value="habilitacion"
                             [disabled]="!canManage()"/>
                      <div>
                        <div class="radio-label">Habilitación</div>
                        <div class="radio-sub">Pruebas y certificación ante la DIAN</div>
                      </div>
                    </label>
                    <label class="radio-option" [class.radio-option--active]="config().ambiente === 'produccion'">
                      <input type="radio" [(ngModel)]="draftConfig.ambiente" value="produccion"
                             [disabled]="!canManage()"/>
                      <div>
                        <div class="radio-label">Producción</div>
                        <div class="radio-sub">Facturas con validez legal</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Resolución y prefijo -->
              <div class="form-row">
                <div class="form-group">
                  <label>Número de resolución *</label>
                  <input type="text" [(ngModel)]="draftConfig.resolucion"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="Ej: 18760000001"/>
                </div>
                <div class="form-group">
                  <label>Prefijo de factura</label>
                  <input type="text" [(ngModel)]="draftConfig.prefijo"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="Ej: SETT"/>
                </div>
              </div>

              <!-- Rango de numeración -->
              <div class="form-row">
                <div class="form-group">
                  <label>Rango desde *</label>
                  <input type="number" [(ngModel)]="draftConfig.rangoDesde"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="1"/>
                </div>
                <div class="form-group">
                  <label>Rango hasta *</label>
                  <input type="number" [(ngModel)]="draftConfig.rangoHasta"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="1000"/>
                </div>
              </div>

              <!-- Vigencia -->
              <div class="form-row">
                <div class="form-group">
                  <label>Vigencia desde *</label>
                  <input type="date" [(ngModel)]="draftConfig.vigenciaDesde"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"/>
                </div>
                <div class="form-group">
                  <label>Vigencia hasta *</label>
                  <input type="date" [(ngModel)]="draftConfig.vigenciaHasta"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"/>
                </div>
              </div>

              <!-- Software DIAN -->
              <div class="form-row">
                <div class="form-group">
                  <label>Software ID</label>
                  <input type="text" [(ngModel)]="draftConfig.softwareId"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="UUID del software registrado"/>
                </div>
                <div class="form-group">
                  <label>PIN del software</label>
                  <input type="password" [(ngModel)]="draftConfig.softwarePin"
                         [disabled]="!canManage()" class="form-control"
                         [class.form-control--disabled]="!canManage()"
                         placeholder="••••••"/>
                </div>
              </div>

              <!-- Footer del panel -->
              @if (canManage()) {
                <div class="panel-footer">
                  <a class="help-link" href="https://www.dian.gov.co/fizcalizacioncontrol/herramientsautoservicio/FacturaElectronica" target="_blank" rel="noopener">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                    </svg>
                    Guía de habilitación DIAN
                  </a>
                  <div class="panel-btns">
                    <button class="btn btn-secondary" (click)="cancelEdit()">Cancelar</button>
                    <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                      {{ saving() ? 'Guardando...' : 'Guardar configuración' }}
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>

      @if (!canManage()) {
        <div class="info-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
          </svg>
          Solo los administradores y gerentes pueden configurar la integración con la DIAN.
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

    /* Fila principal */
    .intg-list { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .intg-row { display:flex; align-items:center; gap:14px; padding:16px 20px; }
    .intg-logo { flex-shrink:0; }
    .intg-info { flex:1; min-width:0; }
    .intg-name {
      font-size:14px; font-weight:700; color:#0c1c35;
      display:flex; align-items:center; gap:7px; flex-wrap:wrap;
    }
    .intg-desc { font-size:12px; color:#9ca3af; margin-top:3px; }
    .intg-actions { flex-shrink:0; }

    /* Badges estado */
    .connected-badge {
      display:inline-flex; align-items:center; gap:4px;
      font-size:10px; font-weight:700; background:#dcfce7; color:#166534;
      padding:2px 8px; border-radius:99px;
    }
    .inactive-badge {
      font-size:10px; font-weight:700; background:#f1f5f9; color:#94a3b8;
      padding:2px 8px; border-radius:99px;
    }
    .env-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
    .env-produccion  { background:#dbeafe; color:#1d4ed8; }
    .env-habilitacion { background:#fef3c7; color:#92400e; }

    /* Panel expandible */
    .config-panel {
      border-top:1px solid #f0f4f8; padding:20px 24px;
      background:#fafbfc;
      animation: slideDown .2s ease;
    }
    @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

    /* Toggle switch */
    .toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; }
    .toggle-label { font-size:14px; font-weight:600; color:#0c1c35; }
    .toggle-sub { font-size:12px; color:#9ca3af; margin-top:2px; }
    .toggle-btn {
      width:44px; height:24px; border-radius:99px; border:none; cursor:pointer;
      background:#dce6f0; position:relative; transition:background .2s; flex-shrink:0;
      padding:0;
    }
    .toggle-btn--on { background:#1a407e; }
    .toggle-btn:disabled { opacity:.5; cursor:default; }
    .toggle-knob {
      display:block; width:18px; height:18px; border-radius:50%; background:#fff;
      position:absolute; top:3px; left:3px; transition:left .2s;
      box-shadow:0 1px 3px rgba(0,0,0,.2);
    }
    .toggle-btn--on .toggle-knob { left:23px; }

    .divider { border:none; border-top:1px solid #e2e8f0; margin:0 0 16px; }

    /* Formulario */
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:4px; }
    .form-group { margin-bottom:14px; }
    .form-group--full { grid-column:span 2; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control {
      width:100%; padding:9px 12px; border:1px solid #dce6f0;
      border-radius:8px; font-size:14px; outline:none;
      box-sizing:border-box; color:#0c1c35; background:#fff;
      transition:border-color .15s;
    }
    .form-control:focus:not(:disabled) { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control--disabled, .form-control:disabled { background:#f8fafc; color:#9ca3af; cursor:default; }

    /* Radio ambiente */
    .radio-group { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .radio-option {
      display:flex; align-items:flex-start; gap:10px;
      padding:12px 14px; border:1.5px solid #dce6f0; border-radius:10px;
      cursor:pointer; transition:border-color .15s, background .15s;
    }
    .radio-option input[type=radio] { margin-top:2px; accent-color:#1a407e; flex-shrink:0; }
    .radio-option--active { border-color:#1a407e; background:#f0f4ff; }
    .radio-label { font-size:13px; font-weight:600; color:#0c1c35; }
    .radio-sub { font-size:11.5px; color:#9ca3af; margin-top:2px; }

    /* Footer panel */
    .panel-footer { display:flex; align-items:center; justify-content:space-between; margin-top:8px; flex-wrap:wrap; gap:12px; }
    .panel-btns { display:flex; gap:10px; }
    .help-link {
      display:inline-flex; align-items:center; gap:5px;
      font-size:12.5px; color:#1a407e; text-decoration:none; font-weight:600;
    }
    .help-link:hover { text-decoration:underline; }

    /* Btns */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:background .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-ghost { background:transparent; color:#1a407e; border:1px solid #dce6f0; }
    .btn-ghost:hover { background:#f0f4f9; }

    /* Info banner */
    .info-banner {
      display:flex; align-items:center; gap:8px;
      margin-top:14px; padding:10px 14px;
      background:#eff6ff; border:1px solid #bfdbfe;
      border-radius:10px; font-size:13px; color:#1e40af;
    }

    /* Skeleton */
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; display:block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ── Responsive ──────────────────────────────────────────── */

    /* Tablet: colapsar a 1 columna los campos del formulario */
    @media (max-width: 700px) {
      .form-row { grid-template-columns: 1fr; }
      .form-group--full { grid-column: span 1; }
      .radio-group { grid-template-columns: 1fr; }
    }

    /* Móvil medio: reorganizar la tarjeta DIAN y el panel */
    @media (max-width: 580px) {
      /* Header: stack vertical */
      .section-header { flex-direction: column; align-items: stretch; }
      .readonly-badge { align-self: flex-start; }

      /* Tarjeta: logo + info apilados, botón abajo */
      .intg-row {
        flex-wrap: wrap;
        gap: 12px;
        padding: 14px 16px;
      }
      .intg-logo { align-self: flex-start; }
      .intg-info { flex: 1 1 calc(100% - 52px); min-width: 0; }
      .intg-actions {
        width: 100%;
        order: 3;
      }
      .intg-actions .btn {
        width: 100%;
        justify-content: center;
      }

      /* Panel: padding reducido */
      .config-panel { padding: 16px; }

      /* Toggle: texto más compacto */
      .toggle-row { gap: 12px; }
      .toggle-label { font-size: 13px; }

      /* Botones del footer: columna completa */
      .panel-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .panel-btns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .help-link { justify-content: center; }
    }

    /* Móvil pequeño */
    @media (max-width: 400px) {
      .intg-name { flex-direction: column; align-items: flex-start; gap: 4px; }
      .panel-btns { grid-template-columns: 1fr; }
      .config-panel { padding: 12px; }
    }
  `]
})
export class SettingsIntegrationsComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/integrations/dian`;
  private auth  = inject(AuthService);
  private http  = inject(HttpClient);
  private notify = inject(NotificationService);

  private userRoles = computed(() => this.auth.user()?.roles ?? []);
  canManage = computed(() => this.userRoles().some(r => r === 'ADMIN' || r === 'MANAGER'));

  loading   = signal(true);
  saving    = signal(false);
  panelOpen = signal(false);

  config = signal<DianConfig>({
    enabled: false, ambiente: 'habilitacion',
    resolucion: '', prefijo: '',
    rangoDesde: null, rangoHasta: null,
    vigenciaDesde: '', vigenciaHasta: '',
    softwareId: '', softwarePin: '',
  });

  // copia editable mientras el panel está abierto
  draftConfig: DianConfig = { ...this.config() };

  ngOnInit() {
    this.http.get<any>(this.API).subscribe({
      next: res => {
        const d = res.data ?? res;
        this.config.set({ ...this.config(), ...d });
        this.draftConfig = { ...this.config() };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  togglePanel() {
    if (!this.panelOpen()) this.draftConfig = { ...this.config() };
    this.panelOpen.update(v => !v);
  }

  toggleEnabled() {
    if (!this.canManage()) return;
    this.draftConfig = { ...this.draftConfig, enabled: !this.draftConfig.enabled };
  }

  cancelEdit() {
    this.draftConfig = { ...this.config() };
    this.panelOpen.set(false);
  }

  save() {
    if (!this.canManage()) return;
    this.saving.set(true);
    this.http.put<any>(this.API, this.draftConfig).subscribe({
      next: res => {
        this.config.set({ ...this.draftConfig });
        this.notify.success('Configuración DIAN guardada');
        this.saving.set(false);
        this.panelOpen.set(false);
      },
      error: e => {
        this.notify.error(e?.error?.message ?? 'Error al guardar');
        this.saving.set(false);
      },
    });
  }
}