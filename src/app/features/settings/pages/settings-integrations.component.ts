import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

interface DianFacturacionConfig {
  enabled: boolean;
  ambiente: 'habilitacion' | 'produccion';
  softwareId: string;
  resolucion: string;
  prefijo: string;
  rangoDesde: number | null;
  rangoHasta: number | null;
  vigenciaDesde: string;
  vigenciaHasta: string;
  hasCertificate: boolean;
}

interface DianNominaConfig {
  enabled: boolean;
  softwareId: string;
}

interface DianCertificateConfig {
  hasCertificate: boolean;
}

@Component({
  selector: 'app-settings-integrations',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div class="section-header">
        <div>
          <h3 class="section-title">Integraciones DIAN</h3>
          <p class="section-sub">Estado de las integraciones con la DIAN configuradas para tu empresa</p>
        </div>
        <div class="managed-badge">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
          Administrado por BeccaFact
        </div>
      </div>

      @if (loading()) {
        <div class="intg-list">
          @for (i of [1, 2]; track i) {
            <div class="intg-row">
              <div class="sk" style="width:36px;height:36px;border-radius:10px;flex-shrink:0"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                <div class="sk" style="height:14px;width:200px;border-radius:6px"></div>
                <div class="sk" style="height:12px;width:280px;border-radius:6px"></div>
              </div>
            </div>
          }
        </div>
      } @else {
        @if (!facturacion().enabled && !nomina().enabled) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44" height="44">
              <rect width="48" height="48" rx="12" fill="#f0f4f8"/>
              <path d="M24 14v10M24 30v2" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <p>No hay integraciones DIAN activas para tu empresa.</p>
            <span>Contacta al administrador de BeccaFact para habilitarlas.</span>
          </div>
        } @else {
          <div class="intg-list">

            <!-- DIAN Facturación Electrónica -->
            @if (facturacion().enabled) {
              <div class="intg-row">
                <div class="intg-logo">
                  <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                    <rect width="48" height="48" rx="10" fill="#003366"/>
                    <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
                          fill="#FFD700" font-size="13" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
                  </svg>
                </div>
                <div class="intg-info">
                  <div class="intg-name">
                    DIAN — Facturación Electrónica
                    <span class="connected-badge">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                      Activa
                    </span>
                    <span class="env-badge env-{{ facturacion().ambiente }}">
                      {{ facturacion().ambiente === 'produccion' ? 'Producción' : 'Habilitación' }}
                    </span>
                  </div>
                  <div class="intg-desc">Emisión de facturas electrónicas ante la DIAN — Resolución 000042 de 2020</div>
                  <div class="intg-meta">
                    @if (facturacion().resolucion) {
                      <span class="meta-item">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
                        Res. {{ facturacion().resolucion }}
                      </span>
                    }
                    @if (facturacion().prefijo) {
                      <span class="meta-item">Prefijo: <strong>{{ facturacion().prefijo }}</strong></span>
                    }
                    @if (facturacion().rangoDesde && facturacion().rangoHasta) {
                      <span class="meta-item">Rango: {{ facturacion().rangoDesde }} – {{ facturacion().rangoHasta }}</span>
                    }
                    @if (facturacion().vigenciaHasta) {
                      <span class="meta-item">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg>
                        Vigente hasta {{ facturacion().vigenciaHasta }}
                      </span>
                    }
                    @if (certificate().hasCertificate) {
                      <span class="meta-item">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/></svg>
                        Certificado configurado
                      </span>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- DIAN Nómina Electrónica -->
            @if (nomina().enabled) {
              @if (facturacion().enabled) {
                <div class="intg-divider"></div>
              }
              <div class="intg-row">
                <div class="intg-logo">
                  <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                    <rect width="48" height="48" rx="10" fill="#1a407e"/>
                    <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle"
                          fill="#FFD700" font-size="9" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
                    <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle"
                          fill="#ffffff" font-size="8" font-weight="700" font-family="Arial,sans-serif">NÓM</text>
                  </svg>
                </div>
                <div class="intg-info">
                  <div class="intg-name">
                    DIAN — Nómina Electrónica
                    <span class="connected-badge">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="10">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                      Activa
                    </span>
                  </div>
                  <div class="intg-desc">Transmisión de nómina electrónica ante la DIAN — Resolución 000013 de 2021</div>
                  <div class="intg-meta">
                    @if (nomina().softwareId) {
                      <span class="meta-item">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z"/></svg>
                        Software registrado
                      </span>
                    }
                    @if (certificate().hasCertificate) {
                      <span class="meta-item">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/></svg>
                        Certificado configurado
                      </span>
                    }
                  </div>
                </div>
              </div>
            }

          </div>
        }
      }

      <div class="info-banner">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
        </svg>
        La configuración de integraciones DIAN es gestionada por el equipo de BeccaFact. Para modificarla, contacta al soporte.
      </div>
    </div>
  `,
  styles: [`
    .section-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .section-title { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .section-sub { font-size:13px; color:#9ca3af; margin:0; }
    .managed-badge { display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:8px; background:#f0fdf4; border:1px solid #bbf7d0; font-size:12.5px; font-weight:600; color:#166534; }

    .intg-list { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .intg-divider { border:none; border-top:1px solid #f0f4f8; margin:0; }
    .intg-row { display:flex; align-items:flex-start; gap:14px; padding:16px 20px; }
    .intg-logo { flex-shrink:0; }
    .intg-info { flex:1; min-width:0; }
    .intg-name { font-size:14px; font-weight:700; color:#0c1c35; display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:3px; }
    .intg-desc { font-size:12px; color:#9ca3af; }
    .intg-meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
    .meta-item { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:#374151; background:#f8fafc; border:1px solid #e2e8f0; padding:3px 9px; border-radius:6px; }
    .meta-item strong { font-weight:700; color:#0c1c35; }

    .connected-badge { display:inline-flex; align-items:center; gap:4px; font-size:10px; font-weight:700; background:#dcfce7; color:#166534; padding:2px 8px; border-radius:99px; }
    .env-badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
    .env-produccion  { background:#dbeafe; color:#1d4ed8; }
    .env-habilitacion { background:#fef3c7; color:#92400e; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:40px 20px; text-align:center; background:#fff; border:1px solid #dce6f0; border-radius:12px; gap:8px; }
    .empty-state p { font-size:14px; font-weight:600; color:#374151; margin:0; }
    .empty-state span { font-size:12.5px; color:#9ca3af; }

    .info-banner { display:flex; align-items:center; gap:8px; margin-top:14px; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; font-size:13px; color:#1e40af; }

    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; display:block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  `]
})
export class SettingsIntegrationsComponent implements OnInit {
  private readonly API_FACT = `${environment.apiUrl}/integrations/dian`;
  private readonly API_NOM  = `${environment.apiUrl}/integrations/dian/nomina`;
  private readonly API_CERT = `${environment.apiUrl}/integrations/dian/certificate`;

  auth    = inject(AuthService);
  private http = inject(HttpClient);

  loading      = signal(true);
  facturacion  = signal<DianFacturacionConfig>({ enabled: false, ambiente: 'habilitacion', softwareId: '', resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null, vigenciaDesde: '', vigenciaHasta: '', hasCertificate: false });
  nomina       = signal<DianNominaConfig>({ enabled: false, softwareId: '' });
  certificate  = signal<DianCertificateConfig>({ hasCertificate: false });

  ngOnInit() {
    Promise.all([
      firstValueFrom(this.http.get<DianFacturacionConfig>(this.API_FACT)).catch(() => null),
      this.auth.hasFeature('has_payroll')()
        ? firstValueFrom(this.http.get<DianNominaConfig>(this.API_NOM)).catch(() => null)
        : Promise.resolve(null),
      firstValueFrom(this.http.get<DianCertificateConfig>(this.API_CERT)).catch(() => null),
    ]).then(([fact, nom, cert]) => {
      if (fact) this.facturacion.set(fact);
      if (nom)  this.nomina.set(nom);
      if (cert) this.certificate.set(cert);
      this.loading.set(false);
    });
  }
}
