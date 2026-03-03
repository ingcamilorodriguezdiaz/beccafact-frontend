import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { DashboardMetrics } from '../../model/dashboard-metrics.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard animate-in">

      <!-- Welcome bar -->
      <div class="welcome-bar">
        <div class="welcome-left">
          <div class="greeting-tag">{{ greetingEmoji() }} Bienvenido</div>
          <h1 class="welcome-name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</h1>
          <p class="welcome-company">{{ auth.user()?.company?.name ?? 'Tu empresa' }} · {{ currentPeriod }}</p>
        </div>
        @if (showUpgrade()) {
          <div class="upgrade-banner">
            <div class="ub-icon">⚡</div>
            <div class="ub-content">
              <strong>Actualiza a Empresarial</strong>
              <span>Desbloquea inventario, nómina y más funciones</span>
            </div>
            <a routerLink="/settings" class="ub-btn">Ver planes</a>
          </div>
        }
      </div>

      <!-- Usage meters -->
      <div class="usage-card">
        <div class="uc-header">
          <div class="uc-title-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" class="uc-icon">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            Uso del mes
          </div>
          <span class="plan-chip plan-{{ planSlug() }}">
            {{ auth.currentPlan()?.displayName ?? 'Sin plan' }}
          </span>
        </div>
        <div class="uc-meters">
          <div class="meter">
            <div class="meter-top">
              <span class="meter-label">Documentos emitidos</span>
              <span class="meter-val" [class.high]="docUsagePercent() > 80">
                {{ usageData().docsUsed }} / {{ docLimit() }}
              </span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" [style.width.%]="docUsagePercent()"
                   [class.danger]="docUsagePercent() > 80"></div>
            </div>
          </div>
          @if (auth.hasFeature('has_inventory')()) {
            <div class="meter">
              <div class="meter-top">
                <span class="meter-label">Productos registrados</span>
                <span class="meter-val">{{ usageData().productsUsed }} / {{ productLimit() }}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="productUsagePercent()"></div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Stats grid -->
      <div class="stats-grid">
        <div class="stat-card" style="animation-delay:0.05s">
          <div class="sc-top">
            <div class="sc-icon-wrap sc-blue">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
            </div>
            <a routerLink="/invoices" class="sc-link">Ver todas →</a>
          </div>
          <div class="sc-val">{{ stats().invoicesThisMonth }}</div>
          <div class="sc-label">Facturas este mes</div>
          <div class="sc-delta up">+12% vs mes anterior</div>
        </div>

        <div class="stat-card" style="animation-delay:0.1s">
          <div class="sc-top">
            <div class="sc-icon-wrap sc-green">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
            </div>
            <a routerLink="/customers" class="sc-link">Gestionar →</a>
          </div>
          <div class="sc-val">{{ stats().activeCustomers }}</div>
          <div class="sc-label">Clientes activos</div>
          <div class="sc-delta up">+5 este mes</div>
        </div>

        @if (auth.hasFeature('has_inventory')()) {
          <div class="stat-card" style="animation-delay:0.15s">
            <div class="sc-top">
              <div class="sc-icon-wrap sc-purple">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>
              </div>
              <a routerLink="/inventory" class="sc-link">Ver inventario →</a>
            </div>
            <div class="sc-val">{{ stats().activeCatalog }}</div>
            <div class="sc-label">Productos en catálogo</div>
            <div class="sc-delta neutral">Catálogo activo</div>
          </div>

          <div class="stat-card" [class.sc-alert]="stats().lowStock > 0" style="animation-delay:0.2s">
            <div class="sc-top">
              <div class="sc-icon-wrap" [class.sc-red]="stats().lowStock > 0" [class.sc-gray]="stats().lowStock === 0">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
              </div>
              <a routerLink="/inventory" class="sc-link">Revisar →</a>
            </div>
            <div class="sc-val" [class.text-danger]="stats().lowStock > 0">{{ stats().lowStock }}</div>
            <div class="sc-label">Bajo stock mínimo</div>
            <div class="sc-delta" [class.down]="stats().lowStock > 0" [class.neutral]="stats().lowStock === 0">
              {{ stats().lowStock > 0 ? 'Requiere atención' : 'Todo en orden' }}
            </div>
          </div>
        }
      </div>

      <!-- Quick actions -->
      <div class="quick-section">
        <div class="qs-header">
          <h3 class="qs-title">Acciones rápidas</h3>
        </div>
        <div class="qs-grid">
          <a routerLink="/invoices" class="qa-card qa-primary">
            <div class="qa-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
            </div>
            <div class="qa-text">
              <div class="qa-label">Nueva factura</div>
              <div class="qa-desc">Emitir documento DIAN</div>
            </div>
          </a>

          @if (auth.hasFeature('has_inventory')()) {
            <a routerLink="/inventory" class="qa-card">
              <div class="qa-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>
              </div>
              <div class="qa-text">
                <div class="qa-label">Nuevo producto</div>
                <div class="qa-desc">Agregar al inventario</div>
              </div>
            </a>
          }

          @if (auth.hasFeature('bulk_import')() && 
          auth.hasAnyRole(['SUPER_ADMIN','ADMIN'])()) {
            <a routerLink="/import" class="qa-card">
              <div class="qa-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>
              </div>
              <div class="qa-text">
                <div class="qa-label">Importar inventario</div>
                <div class="qa-desc">CSV o Excel masivo</div>
              </div>
            </a>
          }

          <a routerLink="/customers" class="qa-card">
            <div class="qa-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>
            </div>
            <div class="qa-text">
              <div class="qa-label">Nuevo cliente</div>
              <div class="qa-desc">Registrar tercero</div>
            </div>
          </a>

          @if (auth.hasFeature('has_reports')()) {
            <a routerLink="/reports" class="qa-card">
              <div class="qa-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
              </div>
              <div class="qa-text">
                <div class="qa-label">Ver reportes</div>
                <div class="qa-desc">Análisis y resúmenes</div>
              </div>
            </a>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1140px; }

    /* Welcome */
    .welcome-bar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
      animation: fadeSlideUp 0.3s ease both;
    }
    .greeting-tag {
      font-size: 13px; color: var(--accent, #00c6a0); font-weight: 700;
      letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px;
    }
    .welcome-name {
      font-family: var(--font-d,'Sora',sans-serif);
      font-size: 26px; font-weight: 700; color: var(--text, #0c1c35);
      margin: 0 0 3px; letter-spacing: -0.025em;
    }
    .welcome-company { font-size: 14px; color: var(--text-3, #7ea3cc); margin: 0; }

    .upgrade-banner {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(135deg, #e8eef8, #e0faf4);
      border: 1px solid #c0d8f0; border-radius: 12px;
      padding: 14px 18px; max-width: 380px;
    }
    .ub-icon { font-size: 22px; }
    .ub-content { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .ub-content strong { font-size: 13.5px; color: #0c1c35; }
    .ub-content span { font-size: 12px; color: #3d5a80; }
    .ub-btn {
      background: var(--brand, #1a407e); color: #fff; border: none;
      padding: 7px 16px; border-radius: 7px; font-size: 13px; font-weight: 700;
      cursor: pointer; text-decoration: none; white-space: nowrap;
    }
    .ub-btn:hover { background: #122f5c; color: #fff; }

    /* Usage card */
    .usage-card {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: var(--r-lg,13px); padding: 22px;
      margin-bottom: 24px; box-shadow: var(--shadow-sm);
      animation: fadeSlideUp 0.3s ease both; animation-delay: 0.05s;
    }
    .uc-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px;
    }
    .uc-title-wrap {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 600; color: var(--text-2,#3d5a80);
    }
    .uc-icon { color: var(--brand, #1a407e); }
    .plan-chip {
      padding: 3px 12px; border-radius: 9999px;
      font-size: 12px; font-weight: 700; letter-spacing: 0.03em;
    }
    .plan-basic, .plan-integración_básica { background: #dbeafe; color: #1e40af; }
    .plan-empresarial                     { background: var(--accent-light,#e0faf4); color: var(--accent-dark,#00a084); }
    .plan-corporativo                     { background: #fef3c7; color: #92400e; }

    .uc-meters { display: flex; gap: 40px; flex-wrap: wrap; }
    .meter { flex: 1; min-width: 200px; }
    .meter-top {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-bottom: 8px;
    }
    .meter-label { font-size: 13px; color: var(--text-3, #7ea3cc); font-weight: 500; }
    .meter-val { font-size: 13px; font-weight: 700; color: var(--text, #0c1c35); }
    .meter-val.high { color: var(--danger, #ef4444); }

    /* Stats */
    .stats-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 18px; margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: var(--r-lg,13px); padding: 22px; box-shadow: var(--shadow-sm);
      position: relative; overflow: hidden;
      transition: transform 0.18s, box-shadow 0.18s;
      animation: fadeSlideUp 0.3s ease both;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .stat-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--brand,#1a407e), var(--accent,#00c6a0));
    }
    .stat-card.sc-alert::before { background: linear-gradient(90deg, #f59e0b, #ef4444); }

    .sc-top {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px;
    }
    .sc-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .sc-blue   { background: #dbeafe; color: #1e40af; }
    .sc-green  { background: var(--accent-light,#e0faf4); color: var(--accent-dark,#00a084); }
    .sc-purple { background: #ede9fe; color: #6d28d9; }
    .sc-red    { background: #fee2e2; color: #dc2626; }
    .sc-gray   { background: #f0f4f9; color: #7ea3cc; }
    .sc-link {
      font-size: 12.5px; color: var(--brand,#1a407e); font-weight: 600;
      text-decoration: none; transition: color 0.15s;
    }
    .sc-link:hover { color: var(--accent-dark,#00a084); }
    .sc-val {
      font-family: var(--font-d,'Sora',sans-serif);
      font-size: 34px; font-weight: 800; color: var(--text,#0c1c35);
      letter-spacing: -0.04em; line-height: 1;
      margin-bottom: 4px;
    }
    .sc-label { font-size: 13.5px; color: var(--text-2,#3d5a80); font-weight: 500; margin-bottom: 8px; }
    .sc-delta { font-size: 12px; font-weight: 600; }
    .sc-delta.up     { color: var(--accent-dark,#00a084); }
    .sc-delta.down   { color: var(--danger,#ef4444); }
    .sc-delta.neutral { color: var(--text-3,#7ea3cc); }

    /* Quick actions */
    .quick-section {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: var(--r-lg,13px); padding: 22px; box-shadow: var(--shadow-sm);
      animation: fadeSlideUp 0.3s ease both; animation-delay: 0.25s;
    }
    .qs-header { margin-bottom: 16px; }
    .qs-title {
      font-family: var(--font-d,'Sora',sans-serif);
      font-size: 15px; font-weight: 700; color: var(--text,#0c1c35);
      margin: 0; letter-spacing: -0.015em;
    }
    .qs-grid { display: flex; gap: 12px; flex-wrap: wrap; }

    .qa-card {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; border-radius: 10px;
      border: 1px solid var(--border,#dce6f0);
      background: var(--surface-2, #f9fafb);
      text-decoration: none; color: var(--text,#0c1c35);
      transition: all 0.15s; cursor: pointer;
    }
    .qa-card:hover {
      background: var(--brand-light,#e8eef8);
      border-color: #b8d0ea;
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    .qa-card.qa-primary {
      background: linear-gradient(135deg, #1a407e, #1e4d94);
      border-color: transparent; color: #fff;
      box-shadow: 0 4px 16px rgba(26,64,126,0.25);
    }
    .qa-card.qa-primary:hover {
      background: linear-gradient(135deg, #122f5c, #1a407e);
      transform: translateY(-2px);
      box-shadow: 0 6px 22px rgba(26,64,126,0.35);
    }
    .qa-icon {
      width: 38px; height: 38px; border-radius: 9px;
      background: rgba(26,64,126,0.1);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      color: var(--brand,#1a407e);
    }
    .qa-card.qa-primary .qa-icon { background: rgba(255,255,255,0.15); color: #fff; }
    .qa-label { font-size: 13.5px; font-weight: 700; }
    .qa-desc  { font-size: 12px; color: var(--text-3,#7ea3cc); margin-top: 1px; }
    .qa-card.qa-primary .qa-desc { color: rgba(255,255,255,0.65); }

    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ─────────────────────────────────────────── */
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .welcome-bar { flex-direction: column; align-items: stretch; }
      .upgrade-banner { max-width: 100%; }
      .uc-meters { flex-direction: column; gap: 16px; }
      .meter { min-width: 0; }
    }
    @media (max-width: 640px) {
      .welcome-name { font-size: 20px; }
      .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
      .stat-card { padding: 14px; }
      .sc-val { font-size: 26px; }
      .qs-grid { flex-direction: column; }
      .qa-card { flex-direction: row; }
    }
    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
      .kpi-strip { grid-template-columns: 1fr 1fr; gap: 8px; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  currentPeriod = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  usageData   = signal({ docsUsed: 0, productsUsed: 0 });
  stats       = signal({ invoicesThisMonth: 0, totalCustomers: 0, totalProducts: 0, lowStock: 0 ,activeCatalog:0,activeCustomers:0});

  docLimit = computed(() => {
    const v = this.auth.planFeatures()['max_documents_per_month'];
    return v === 'unlimited' ? '∞' : (v ?? '300');
  });
  productLimit = computed(() => {
    const v = this.auth.planFeatures()['max_products'];
    return v === 'unlimited' ? '∞' : (v ?? '500');
  });
  docUsagePercent = computed(() => {
    const limit = this.auth.planFeatures()['max_documents_per_month'];
    if (!limit || limit === 'unlimited') return 0;
    return Math.min(100, Math.round((this.usageData().docsUsed / parseInt(limit)) * 100));
  });
  productUsagePercent = computed(() => {
    const limit = this.auth.planFeatures()['max_products'];
    if (!limit || limit === 'unlimited') return 0;
    return Math.min(100, Math.round((this.usageData().productsUsed / parseInt(limit)) * 100));
  });
  showUpgrade = computed(() =>
    this.auth.currentPlan()?.name === 'BASIC' || this.auth.currentPlan()?.name === 'basic'
  );
  planSlug = computed(() => (this.auth.currentPlan()?.name ?? '').toLowerCase());

  greetingEmoji(): string {
    const h = new Date().getHours();
    if (h < 12) return '🌤';
    if (h < 18) return '☀️';
    return '🌙';
  }

  constructor(protected auth: AuthService, private http: HttpClient) {}

  ngOnInit() { this.loadStats();}

  private loadStats() {
    this.http.get<any>(`${environment.apiUrl}/companies/me/usage`).subscribe({
      next: (res) => {
        const u = res?.data;
        if (u) this.usageData.set({ docsUsed: u.documents?.used ?? 0, productsUsed: u.products?.used ?? 0 });
      },
      error: () => this.usageData.set({ docsUsed: 127, productsUsed: 234 }),
    });

    this.http.get<DashboardMetrics>(`${environment.apiUrl}/reports/dashboard`).subscribe({
      next: (metricts) => {
        if (metricts) this.stats.set({
          invoicesThisMonth: metricts.invoices?.current ?? 0,
          totalCustomers: metricts.topCustomers.length ?? 0,
          totalProducts: metricts.topProducts.length ?? 0,
          lowStock: metricts.productCount ?? 0,
          activeCatalog: metricts.activeCatalog ?? 0,
          activeCustomers: metricts.activeCustomers ?? 0,
        });
      },
      error: () => this.stats.set({ invoicesThisMonth: 127, totalCustomers: 48, totalProducts: 234, lowStock: 3,activeCatalog:5,activeCustomers:6 }),
    });
  }
}
