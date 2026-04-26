import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature { key: string; label?: string; value: string; }
interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency?: string;
  isActive?: boolean;
  features: PlanFeature[];
}

interface FeatureDef {
  key: string;
  label: string;
  description: string;
  type: 'bool' | 'number' | 'months';
  defaultValue: string;
  icon: string;
  group: 'limits' | 'modules' | 'support';
}

const CARD_PRIORITY = [
  'max_documents_per_month', 'max_users', 'max_products',
  'has_invoices', 'has_inventory', 'has_reports', 'dian_enabled',
  'has_accounting', 'has_purchasing', 'priority_support',
];

@Component({
  selector: 'app-settings-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-page">
      <section class="page-hero">
        <div>
          <p class="page-kicker">Plan y facturacion</p>
          <h2>Gestiona tu suscripcion y escala tu operacion</h2>
          <p>Compara planes, revisa el estado actual de tu empresa y prepara el siguiente nivel de crecimiento.</p>
        </div>

        @if (!canManage()) {
          <div class="readonly-badge">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
            </svg>
            Solo lectura
          </div>
        }
      </section>

      <div class="stats-grid">
        <div class="stat-card">
          <span>Plan actual</span>
          <strong>{{ auth.currentPlan()?.displayName ?? 'Sin plan activo' }}</strong>
          <small>Base actual de modulos disponibles</small>
        </div>
        <div class="stat-card stat-card--accent">
          <span>Planes</span>
          <strong>{{ loading() ? '...' : plans().length }}</strong>
          <small>Opciones visibles para tu empresa</small>
        </div>
        <div class="stat-card">
          <span>Gestion</span>
          <strong>{{ canManage() ? 'Habilitada' : 'Restringida' }}</strong>
          <small>Cambio de plan segun permisos del usuario</small>
        </div>
      </div>

      <section class="current-plan-card">
        @if (loading()) {
          <div class="sk sk-title"></div>
          <div class="sk sk-sub"></div>
        } @else {
          <div class="cp-header">
            <div>
              <p class="section-kicker">Suscripcion activa</p>
              <div class="cp-name">{{ auth.currentPlan()?.displayName ?? 'Sin plan activo' }}</div>
              <div class="cp-sub">Plan actualmente asignado a tu empresa</div>
            </div>
            <span class="status-active">Activo</span>
          </div>
        }
      </section>

      <section class="plans-section">
        <div class="section-head">
          <div>
            <p class="section-kicker">Escalamiento</p>
            <h3>Planes disponibles</h3>
          </div>
          <span class="section-note">Comparativo visual de suscripcion</span>
        </div>

        <div class="plans-grid">
          @if (loading()) {
            @for (i of [1,2,3]; track i) {
              <div class="plan-card">
                <div class="sk sk-line"></div>
                <div class="sk sk-price"></div>
                <div class="sk sk-box"></div>
              </div>
            }
          } @else {
            @for (plan of plans(); track plan.id) {
              <div class="plan-card" [class.plan-card--current]="plan.name === auth.currentPlan()?.name">
                @if (plan.name === auth.currentPlan()?.name) {
                  <div class="current-badge">Plan actual</div>
                }

                <div class="plan-head">
                  <div>
                    <div class="plan-title">{{ plan.displayName }}</div>
                    <code class="plan-slug">{{ plan.name }}</code>
                  </div>
                  @if (plan.isActive === false) {
                    <span class="plan-status">Inactivo</span>
                  }
                </div>

                <div class="plan-price">
                  {{ plan.price | currency:(plan.currency || 'COP'):'symbol':'1.0-0' }}<span>/mes</span>
                </div>

                @if (plan.description) {
                  <div class="plan-desc">{{ plan.description }}</div>
                }

                @if (cardFeatures(plan).length > 0) {
                  <div class="plan-features">
                    @for (feature of cardFeatures(plan); track feature.key) {
                      <div class="feat-row">
                        <div class="feat-row-left">
                          @if (featDef(feature.key); as def) {
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13" class="feat-icon">
                              <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="def.icon"/>
                            </svg>
                            <span class="feat-label">{{ def.label }}</span>
                          } @else {
                            <span class="feat-label">{{ feature.label || feature.key }}</span>
                          }
                        </div>
                        <span class="feat-val">
                          @if (feature.value === 'true') {
                            <span class="feat-check">✓</span>
                          } @else if (feature.value === 'false') {
                            <span class="feat-x">✗</span>
                          } @else {
                            {{ feature.value === '-1' ? '∞' : feature.value }}{{ featDef(feature.key)?.type === 'months' ? ' meses' : '' }}
                          }
                        </span>
                      </div>
                    }
                  </div>
                  @if (plan.features.length > 6) {
                    <div class="feat-more">+{{ plan.features.length - 6 }} caracteristicas mas</div>
                  }
                }

                @if (plan.name !== auth.currentPlan()?.name) {
                  @if (canManage()) {
                    <button class="btn btn-primary btn--full">Actualizar a este plan</button>
                  } @else {
                    <div class="locked-action">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                        <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
                      </svg>
                      Requiere administrador
                    </div>
                  }
                }
              </div>
            }
          }
        </div>
      </section>

      @if (!canManage()) {
        <div class="info-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
          </svg>
          Solo los administradores y gerentes pueden cambiar el plan de la empresa.
        </div>
      }
    </div>
  `,
  styles: [`
    .settings-page { display:grid; gap:18px; }

    .page-hero,
    .current-plan-card,
    .plans-section {
      border-radius:24px;
      border:1px solid #dce6f0;
      background:#fff;
      box-shadow:0 18px 32px rgba(12, 28, 53, 0.06);
    }

    .page-hero {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      padding:22px;
      background:
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 34%),
        radial-gradient(circle at bottom left, rgba(0, 198, 160, 0.12), transparent 30%),
        linear-gradient(135deg, #ffffff 0%, #f6fbff 100%);
    }

    .page-kicker,
    .section-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#00a084;
    }

    .page-hero h2,
    .section-head h3 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:28px;
      line-height:1.04;
      letter-spacing:-.05em;
      color:#0c1c35;
      max-width:15ch;
    }

    .page-hero p:last-child {
      margin:10px 0 0;
      max-width:58ch;
      line-height:1.7;
      color:#6f859f;
      font-size:13px;
    }

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
      line-height:1.5;
    }

    .stat-card--accent {
      background:linear-gradient(135deg, #eef9ff, #f2fffb);
      border-color:#bfe4f0;
    }

    .current-plan-card {
      padding:22px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.12), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #153a70 52%, #0d8b74 100%);
      color:#fff;
      border-color:transparent;
      box-shadow:0 24px 40px rgba(12, 28, 53, 0.14);
    }

    .cp-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
    }

    .cp-name {
      font-size:28px;
      font-weight:800;
      line-height:1.05;
      letter-spacing:-.06em;
      color:#fff;
      font-family:var(--font-d, 'Sora', sans-serif);
    }

    .cp-sub {
      margin-top:8px;
      font-size:13px;
      color:rgba(236, 244, 255, 0.78);
    }

    .status-active {
      padding:6px 12px;
      border-radius:999px;
      background:rgba(255, 255, 255, 0.14);
      border:1px solid rgba(255, 255, 255, 0.12);
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#8bf3cb;
      white-space:nowrap;
    }

    .plans-section { padding:22px; }

    .section-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:18px;
    }

    .section-head h3 {
      font-size:20px;
      max-width:none;
    }

    .section-note {
      padding:7px 11px;
      border-radius:999px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      font-size:11px;
      font-weight:700;
      color:#6f859f;
      white-space:nowrap;
    }

    .plans-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));
      gap:16px;
    }

    .plan-card {
      position:relative;
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:22px;
      border-radius:22px;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 14px 26px rgba(12, 28, 53, 0.05);
    }

    .plan-card--current {
      border-color:#93c5fd;
      box-shadow:0 20px 30px rgba(37, 99, 235, 0.12);
      background:linear-gradient(180deg, #f8fbff 0%, #f2fffb 100%);
    }

    .current-badge {
      position:absolute;
      top:14px;
      right:14px;
      padding:5px 10px;
      border-radius:999px;
      background:#dbeafe;
      color:#1d4ed8;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
    }

    .plan-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
      margin-top:8px;
    }

    .plan-title {
      font-size:18px;
      font-weight:800;
      color:#0c1c35;
    }

    .plan-slug {
      display:inline-block;
      margin-top:6px;
      padding:3px 7px;
      border-radius:999px;
      background:#f0f4f9;
      color:#6b7f95;
      font-size:10px;
    }

    .plan-status {
      padding:5px 9px;
      border-radius:999px;
      background:#fff1f2;
      border:1px solid #fecdd3;
      color:#be123c;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      white-space:nowrap;
    }

    .plan-price {
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:30px;
      font-weight:800;
      line-height:1;
      letter-spacing:-.06em;
      color:#0f172a;
    }

    .plan-price span {
      margin-left:4px;
      font-size:13px;
      font-weight:600;
      color:#64748b;
      letter-spacing:0;
    }

    .plan-desc {
      font-size:13px;
      line-height:1.65;
      color:#64748b;
      min-height:42px;
    }

    .plan-features {
      border-top:1px solid #edf2f7;
      padding-top:12px;
      margin-top:2px;
      display:grid;
      gap:8px;
      flex:1;
    }

    .feat-row {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
    }

    .feat-row-left {
      display:flex;
      align-items:center;
      gap:6px;
      min-width:0;
      flex:1;
    }

    .feat-icon {
      color:#94a3b8;
      flex-shrink:0;
    }

    .feat-label {
      font-size:12.5px;
      color:#64748b;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .feat-val {
      font-size:12px;
      font-weight:700;
      color:#334155;
      flex-shrink:0;
    }

    .feat-check {
      color:#10b981;
      font-size:13px;
    }

    .feat-x {
      color:#ef4444;
      font-size:13px;
    }

    .feat-more {
      margin-top:8px;
      font-size:11px;
      color:#94a3b8;
      text-align:right;
      font-style:italic;
    }

    .btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
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

    .btn--full { width:100%; }

    .locked-action {
      display:flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      padding:11px;
      border-radius:14px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      font-size:12px;
      font-weight:700;
      color:#6f859f;
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

    .sk {
      display:block;
      border-radius:8px;
      background:linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%);
      background-size:200% 100%;
      animation:shimmer 1.5s infinite;
    }
    .sk-title { width:160px; height:20px; }
    .sk-sub { width:96px; height:14px; margin-top:8px; }
    .sk-line { width:90px; height:16px; }
    .sk-price { width:120px; height:30px; }
    .sk-box { width:100%; height:42px; margin-top:8px; border-radius:14px; }
    @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

    @media (max-width: 980px) {
      .page-hero,
      .cp-header,
      .section-head { flex-direction:column; align-items:flex-start; }
      .stats-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 640px) {
      .page-hero,
      .current-plan-card,
      .plans-section,
      .plan-card { padding:18px; }
      .page-hero h2,
      .cp-name { font-size:24px; }
    }
  `]
})
export class SettingsBillingComponent implements OnInit {
  protected auth = inject(AuthService);
  private http   = inject(HttpClient);
  private notify = inject(NotificationService);

  plans   = signal<Plan[]>([]);
  catalog = signal<FeatureDef[]>([]);
  loading = signal(true);

  private catalogMap = computed(() => new Map(this.catalog().map((feature) => [feature.key, feature])));
  private userRoles = computed(() => this.auth.user()?.roles ?? []);
  canManage = computed(() => this.userRoles().some(r => r === 'ADMIN' || r === 'MANAGER'));

  ngOnInit() {
    this.loadCatalog();
    this.loadPlans();
  }

  private loadCatalog() {
    this.http.get<FeatureDef[]>(`${environment.apiUrl}/plans/feature-catalog`).subscribe({
      next: (catalog) => this.catalog.set(catalog ?? []),
      error: () => this.notify.error('Error al cargar catalogo de caracteristicas'),
    });
  }

  private loadPlans() {
    this.http.get<any>(`${environment.apiUrl}/plans/public`).subscribe({
      next: res => { this.plans.set(res.data ?? res ?? []); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error al cargar planes');
      },
    });
  }

  featDef(key: string): FeatureDef | undefined {
    return this.catalogMap().get(key);
  }

  cardFeatures(plan: Plan): PlanFeature[] {
    const sorted = [...(plan.features ?? [])].sort((a, b) => {
      const ia = CARD_PRIORITY.indexOf(a.key);
      const ib = CARD_PRIORITY.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return sorted.slice(0, 6);
  }
}
