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
  venta: {
    resolucion: string;
    prefijo: string;
    rangoDesde: number | null;
    rangoHasta: number | null;
    vigenciaDesde: string;
    vigenciaHasta: string;
  };
  pos: {
    resolucion: string;
    prefijo: string;
    rangoDesde: number | null;
    rangoHasta: number | null;
    vigenciaDesde: string;
    vigenciaHasta: string;
  };
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
    <div class="settings-page">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Integraciones</p>
          <h2>Estado de tus conexiones con la DIAN</h2>
          <p>Consulta de forma clara que servicios estan activos, en que ambiente operan y si la base de certificacion ya esta lista.</p>
        </div>

        <div class="managed-badge">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13">
            <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
          Administrado por BeccaFact
        </div>
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Integraciones activas</span>
          <strong>{{ activeIntegrationsCount() }}</strong>
          <small>Servicios habilitados para tu empresa</small>
        </div>
        <div class="stat-card stat-card--accent">
          <span>Certificado</span>
          <strong>{{ certificate().hasCertificate ? 'Listo' : 'Pendiente' }}</strong>
          <small>Estado del certificado digital DIAN</small>
        </div>
        <div class="stat-card">
          <span>Ambiente</span>
          <strong>{{ facturacion().ambiente === 'produccion' ? 'Produccion' : 'Habilitacion' }}</strong>
          <small>Solo aplica si facturacion esta activa</small>
        </div>
      </div>

      @if (loading()) {
        <div class="cards-grid">
          @for (i of [1, 2]; track i) {
            <div class="integration-card">
              <div class="skeleton-head">
                <div class="sk sk-logo"></div>
                <div class="sk sk-title"></div>
              </div>
              <div class="sk sk-text"></div>
              <div class="sk sk-chip-row"></div>
            </div>
          }
        </div>
      } @else if (!facturacion().enabled && !nomina().enabled) {
        <div class="empty-state">
          <svg viewBox="0 0 48 48" fill="none" width="44" height="44">
            <rect width="48" height="48" rx="12" fill="#f0f4f8"/>
            <path d="M24 14v10M24 30v2" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <p>No hay integraciones DIAN activas para tu empresa.</p>
          <span>Contacta al administrador de BeccaFact para habilitarlas.</span>
        </div>
      } @else {
        <div class="cards-grid">
          @if (facturacion().enabled) {
            <article class="integration-card integration-card--primary">
              <div class="integration-head">
                <div class="intg-logo">
                  <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                    <rect width="48" height="48" rx="10" fill="#003366"/>
                    <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
                          fill="#FFD700" font-size="13" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
                  </svg>
                </div>
                <div class="integration-title-wrap">
                  <div class="integration-title">Facturacion Electronica</div>
                  <div class="integration-sub">Emision de venta y documento equivalente POS con numeraciones independientes</div>
                </div>
                <div class="status-stack">
                  <span class="connected-badge">Activa</span>
                  <span class="env-badge env-{{ facturacion().ambiente }}">
                    {{ facturacion().ambiente === 'produccion' ? 'Produccion' : 'Habilitacion' }}
                  </span>
                </div>
              </div>

              <div class="meta-grid">
                @if (facturacion().venta.resolucion) {
                  <div class="meta-item">Venta <strong>{{ facturacion().venta.prefijo || 'Sin prefijo' }}</strong></div>
                }
                @if (facturacion().venta.rangoDesde && facturacion().venta.rangoHasta) {
                  <div class="meta-item">Rango venta <strong>{{ facturacion().venta.rangoDesde }} - {{ facturacion().venta.rangoHasta }}</strong></div>
                }
                @if (facturacion().pos.resolucion) {
                  <div class="meta-item">POS <strong>{{ facturacion().pos.prefijo || 'Sin prefijo' }}</strong></div>
                }
                @if (facturacion().pos.rangoDesde && facturacion().pos.rangoHasta) {
                  <div class="meta-item">Rango POS <strong>{{ facturacion().pos.rangoDesde }} - {{ facturacion().pos.rangoHasta }}</strong></div>
                }
                @if (facturacion().venta.vigenciaHasta || facturacion().pos.vigenciaHasta) {
                  <div class="meta-item">Vigencias <strong>{{ facturacion().venta.vigenciaHasta || '—' }} / {{ facturacion().pos.vigenciaHasta || '—' }}</strong></div>
                }
                @if (certificate().hasCertificate) {
                  <div class="meta-item">Certificado <strong>Configurado</strong></div>
                }
              </div>
            </article>
          }

          @if (nomina().enabled) {
            <article class="integration-card">
              <div class="integration-head">
                <div class="intg-logo">
                  <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
                    <rect width="48" height="48" rx="10" fill="#1a407e"/>
                    <text x="50%" y="42%" dominant-baseline="middle" text-anchor="middle"
                          fill="#FFD700" font-size="9" font-weight="800" font-family="Arial,sans-serif">DIAN</text>
                    <text x="50%" y="68%" dominant-baseline="middle" text-anchor="middle"
                          fill="#ffffff" font-size="8" font-weight="700" font-family="Arial,sans-serif">NOM</text>
                  </svg>
                </div>
                <div class="integration-title-wrap">
                  <div class="integration-title">Nomina Electronica</div>
                  <div class="integration-sub">Transmision de eventos y comprobantes de nomina</div>
                </div>
                <span class="connected-badge">Activa</span>
              </div>

              <div class="meta-grid">
                @if (nomina().softwareId) {
                  <div class="meta-item">Software <strong>Registrado</strong></div>
                }
                @if (certificate().hasCertificate) {
                  <div class="meta-item">Certificado <strong>Configurado</strong></div>
                }
              </div>
            </article>
          }
        </div>
      }

      <div class="info-banner">
        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
        </svg>
        La configuracion de integraciones DIAN es gestionada por el equipo de BeccaFact. Para modificarla, contacta al soporte.
      </div>
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
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.16), transparent 30%),
        linear-gradient(135deg, #0d2344 0%, #163a6f 54%, #0d8b74 100%);
      color:#fff;
      box-shadow:0 22px 38px rgba(12, 28, 53, 0.14);
    }

    .page-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#8bf3cb;
    }

    .page-hero h2 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:28px;
      line-height:1.04;
      letter-spacing:-.05em;
      color:#fff;
      max-width:16ch;
    }

    .page-hero p:last-child {
      margin:10px 0 0;
      max-width:58ch;
      line-height:1.7;
      color:rgba(236, 244, 255, 0.8);
      font-size:13px;
    }

    .managed-badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding:8px 12px;
      border-radius:999px;
      background:rgba(255, 255, 255, 0.12);
      border:1px solid rgba(255, 255, 255, 0.12);
      font-size:11.5px;
      font-weight:700;
      color:#d1fae5;
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

    .cards-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));
      gap:16px;
    }

    .integration-card {
      display:grid;
      gap:16px;
      padding:20px;
      border-radius:24px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 18px 32px rgba(12, 28, 53, 0.06);
    }

    .integration-card--primary {
      background:linear-gradient(180deg, #fbfdff 0%, #f5fbff 100%);
      border-color:#bfdbfe;
    }

    .integration-head {
      display:grid;
      grid-template-columns:auto minmax(0, 1fr) auto;
      gap:12px;
      align-items:start;
    }

    .intg-logo { flex-shrink:0; }

    .integration-title {
      font-size:18px;
      font-weight:800;
      color:#0c1c35;
    }

    .integration-sub {
      margin-top:4px;
      font-size:12px;
      line-height:1.6;
      color:#6f859f;
    }

    .status-stack {
      display:grid;
      gap:6px;
      justify-items:end;
    }

    .connected-badge,
    .env-badge {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      white-space:nowrap;
    }

    .connected-badge {
      background:#dcfce7;
      color:#166534;
    }

    .env-produccion { background:#dbeafe; color:#1d4ed8; }
    .env-habilitacion { background:#fef3c7; color:#92400e; }

    .meta-grid {
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }

    .meta-item {
      padding:8px 10px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      font-size:12px;
      color:#475569;
    }

    .meta-item strong {
      color:#0c1c35;
      font-weight:800;
    }

    .empty-state {
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:8px;
      text-align:center;
      padding:40px 20px;
      border-radius:24px;
      background:#fff;
      border:1px solid #dce6f0;
      box-shadow:0 16px 28px rgba(12, 28, 53, 0.05);
    }

    .empty-state p {
      margin:0;
      font-size:15px;
      font-weight:700;
      color:#374151;
    }

    .empty-state span {
      font-size:12.5px;
      color:#9ca3af;
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

    .skeleton-head {
      display:flex;
      align-items:center;
      gap:12px;
    }

    .sk {
      display:block;
      border-radius:8px;
      background:linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%);
      background-size:200% 100%;
      animation:shimmer 1.5s infinite;
    }
    .sk-logo { width:36px; height:36px; border-radius:12px; }
    .sk-title { width:180px; height:16px; }
    .sk-text { width:100%; height:44px; }
    .sk-chip-row { width:75%; height:36px; border-radius:14px; }
    @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

    @media (max-width: 980px) {
      .page-hero { flex-direction:column; align-items:flex-start; }
      .stats-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 640px) {
      .page-hero,
      .integration-card,
      .empty-state { padding:18px; }
      .integration-head {
        grid-template-columns:auto 1fr;
      }
      .status-stack {
        grid-column:1 / -1;
        justify-items:start;
      }
    }
  `]
})
export class SettingsIntegrationsComponent implements OnInit {
  private readonly API_FACT = `${environment.apiUrl}/integrations/dian`;
  private readonly API_NOM  = `${environment.apiUrl}/integrations/dian/nomina`;
  private readonly API_CERT = `${environment.apiUrl}/integrations/dian/certificate`;

  auth    = inject(AuthService);
  private http = inject(HttpClient);

  loading      = signal(true);
  facturacion  = signal<DianFacturacionConfig>({
    enabled: false,
    ambiente: 'habilitacion',
    softwareId: '',
    venta: { resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null, vigenciaDesde: '', vigenciaHasta: '' },
    pos: { resolucion: '', prefijo: '', rangoDesde: null, rangoHasta: null, vigenciaDesde: '', vigenciaHasta: '' },
    hasCertificate: false,
  });
  nomina       = signal<DianNominaConfig>({ enabled: false, softwareId: '' });
  certificate  = signal<DianCertificateConfig>({ hasCertificate: false });

  activeIntegrationsCount(): number {
    let total = 0;
    if (this.facturacion().enabled) total += 1;
    if (this.nomina().enabled) total += 1;
    return total;
  }

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
