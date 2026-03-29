import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

type SettingsNavItem = {
  label: string;
  route: string;
  icon: string;
  kicker: string;
  description: string;
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="settings-shell">
      <section class="settings-hero">
        <div class="hero-copy">
          <p class="hero-kicker">Centro de configuracion</p>
          <h1>Ajusta tu cuenta, tu empresa y el acceso del equipo</h1>
          <p class="hero-sub">
            Administra identidad, datos legales, usuarios, plan e integraciones desde un mismo espacio con una experiencia mas clara.
          </p>
        </div>

        <div class="hero-summary">
          <div class="summary-card">
            <span>Empresa</span>
            <strong>{{ auth.user()?.company?.name ?? 'Mi empresa' }}</strong>
            <small>Configuracion centralizada</small>
          </div>
          <div class="summary-card summary-card--accent">
            <span>Plan</span>
            <strong>{{ auth.currentPlan()?.displayName ?? 'Sin plan' }}</strong>
            <small>Modulos y limites activos</small>
          </div>
          <div class="summary-card">
            <span>Acceso</span>
            <strong>{{ auth.user()?.roles?.join(', ') || 'Usuario' }}</strong>
            <small>Permisos de la sesion actual</small>
          </div>
        </div>
      </section>

      <div class="settings-layout">
        <aside class="settings-sidebar" id="tour-settings-menu">
          <div class="sidebar-card">
            <div class="sidebar-head">
              <div class="company-badge">{{ companyInitials() }}</div>
              <div>
                <div class="sidebar-title">Modulo de ajustes</div>
                <div class="sidebar-sub">Configuracion operativa</div>
              </div>
            </div>

            <nav class="settings-nav">
              @for (item of navItems; track item.route) {
                @if (item.route !== 'integrations' || !auth.isSuperAdmin()) {
                  <a
                    [routerLink]="item.route"
                    routerLinkActive="active"
                    class="settings-link"
                    [routerLinkActiveOptions]="{ exact: true }">
                    <span class="settings-link-icon">{{ item.icon }}</span>
                    <span class="settings-link-copy">
                      <strong>{{ item.label }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                    <span class="settings-link-kicker">{{ item.kicker }}</span>
                  </a>
                }
              }
            </nav>

            <div class="sidebar-foot">
              <span>Espacio unificado para perfil, empresa, usuarios, plan e integraciones.</span>
            </div>
          </div>
        </aside>

        <div class="settings-content">
          <div class="settings-content-card">
            <router-outlet />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display:block;
      min-height:100%;
    }

    .settings-shell {
      display:grid;
      gap:20px;
      padding:4px 0 12px;
    }

    .settings-hero {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .95fr);
      gap:18px;
      padding:24px;
      border-radius:28px;
      border:1px solid #d9e7f3;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.16), transparent 30%),
        radial-gradient(circle at bottom left, rgba(26, 64, 126, 0.16), transparent 32%),
        linear-gradient(135deg, #0d2344 0%, #15386d 54%, #0d8b74 100%);
      color:#fff;
      box-shadow:0 24px 44px rgba(12, 28, 53, 0.14);
    }

    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#8bf3cb;
    }

    .hero-copy h1 {
      margin:0;
      max-width:14ch;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:34px;
      line-height:1.02;
      letter-spacing:-.06em;
    }

    .hero-sub {
      margin:14px 0 0;
      max-width:62ch;
      font-size:14px;
      line-height:1.7;
      color:rgba(236, 244, 255, 0.8);
    }

    .hero-summary {
      display:grid;
      gap:12px;
      align-content:stretch;
    }

    .summary-card {
      display:grid;
      gap:4px;
      padding:16px 18px;
      border-radius:18px;
      background:rgba(255, 255, 255, 0.1);
      border:1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter:blur(12px);
    }

    .summary-card span {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:rgba(236, 244, 255, 0.66);
    }

    .summary-card strong {
      font-size:17px;
      font-weight:800;
      color:#fff;
      line-height:1.2;
    }

    .summary-card small {
      font-size:12px;
      color:rgba(236, 244, 255, 0.72);
    }

    .summary-card--accent {
      background:rgba(0, 198, 160, 0.16);
      border-color:rgba(138, 243, 203, 0.26);
    }

    .settings-layout {
      display:grid;
      grid-template-columns:minmax(260px, 300px) minmax(0, 1fr);
      gap:20px;
      align-items:start;
    }

    .settings-sidebar {
      position:sticky;
      top:16px;
    }

    .sidebar-card {
      display:grid;
      gap:18px;
      padding:18px;
      border-radius:24px;
      background:rgba(255, 255, 255, 0.82);
      border:1px solid #dce6f0;
      box-shadow:0 18px 34px rgba(12, 28, 53, 0.08);
      backdrop-filter:blur(12px);
    }

    .sidebar-head {
      display:flex;
      align-items:center;
      gap:12px;
    }

    .company-badge {
      width:46px;
      height:46px;
      border-radius:15px;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:15px;
      font-weight:800;
      flex-shrink:0;
      box-shadow:0 12px 20px rgba(26, 64, 126, 0.2);
    }

    .sidebar-title {
      font-size:15px;
      font-weight:800;
      color:#0c1c35;
    }

    .sidebar-sub {
      margin-top:2px;
      font-size:12px;
      color:#7a90aa;
    }

    .settings-nav {
      display:grid;
      gap:8px;
    }

    .settings-link {
      display:grid;
      grid-template-columns:auto minmax(0, 1fr) auto;
      align-items:center;
      gap:12px;
      padding:14px;
      border-radius:18px;
      border:1px solid transparent;
      text-decoration:none;
      background:#f8fbff;
      transition:all .16s ease;
    }

    .settings-link:hover {
      transform:translateY(-1px);
      border-color:#c9ddf0;
      background:#ffffff;
      box-shadow:0 14px 24px rgba(12, 28, 53, 0.06);
    }

    .settings-link.active {
      background:linear-gradient(135deg, #eff6ff, #f3fffb);
      border-color:#bfdbfe;
      box-shadow:0 16px 28px rgba(26, 64, 126, 0.1);
    }

    .settings-link-icon {
      width:38px;
      height:38px;
      border-radius:12px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#ffffff;
      border:1px solid #dce6f0;
      font-size:18px;
      flex-shrink:0;
    }

    .settings-link.active .settings-link-icon {
      background:linear-gradient(135deg, #1a407e, #00a88a);
      border-color:transparent;
      box-shadow:0 12px 20px rgba(26, 64, 126, 0.18);
    }

    .settings-link-copy {
      display:grid;
      gap:2px;
      min-width:0;
    }

    .settings-link-copy strong {
      font-size:14px;
      font-weight:700;
      color:#0c1c35;
    }

    .settings-link-copy small {
      font-size:11.5px;
      color:#7a90aa;
      line-height:1.45;
    }

    .settings-link-kicker {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#8aa0b8;
    }

    .settings-link.active .settings-link-kicker {
      color:#00a084;
    }

    .sidebar-foot {
      padding:14px 16px;
      border-radius:18px;
      background:#f7fbff;
      border:1px dashed #c9d7e6;
      font-size:12px;
      line-height:1.65;
      color:#6f859f;
    }

    .settings-content {
      min-width:0;
    }

    .settings-content-card {
      min-height:100%;
      padding:22px;
      border-radius:28px;
      background:rgba(255, 255, 255, 0.72);
      border:1px solid #dce6f0;
      box-shadow:0 22px 40px rgba(12, 28, 53, 0.07);
      backdrop-filter:blur(12px);
    }

    @media (max-width: 1080px) {
      .settings-hero {
        grid-template-columns:1fr;
      }
    }

    @media (max-width: 940px) {
      .settings-layout {
        grid-template-columns:1fr;
      }

      .settings-sidebar {
        position:static;
      }
    }

    @media (max-width: 640px) {
      .settings-shell {
        gap:14px;
      }

      .settings-hero {
        padding:18px;
        border-radius:22px;
      }

      .hero-copy h1 {
        font-size:28px;
      }

      .settings-content-card {
        padding:16px;
        border-radius:22px;
      }

      .settings-link {
        grid-template-columns:auto minmax(0, 1fr);
      }

      .settings-link-kicker {
        display:none;
      }
    }
  `],
})
export class SettingsComponent {
  navItems: SettingsNavItem[] = [
    { label: 'Mi perfil', route: 'profile', icon: '👤', kicker: 'Cuenta', description: 'Datos personales y seguridad de acceso' },
    { label: 'Mi empresa', route: 'company', icon: '🏢', kicker: 'Empresa', description: 'Identidad legal, contacto y datos fiscales' },
    { label: 'Usuarios', route: 'users', icon: '👥', kicker: 'Equipo', description: 'Permisos, roles y control de accesos' },
    { label: 'Plan y facturacion', route: 'billing', icon: '💳', kicker: 'Plan', description: 'Suscripcion, limites y escalamiento' },
    { label: 'Integraciones', route: 'integrations', icon: '🔌', kicker: 'DIAN', description: 'Servicios externos y estado de conexion' },
  ];

  constructor(protected auth: AuthService) {}

  companyInitials(): string {
    const name = this.auth.user()?.company?.name ?? 'BeccaFact';
    return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
}
