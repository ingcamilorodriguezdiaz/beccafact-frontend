import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface GlobalMetrics {
  companies: { total: number; active: number; suspended: number; trial: number };
  users: { total: number };
  invoices: { total: number };
  products: { total: number };
  byPlan: Array<{ plan: string; count: number }>;
  usage: { monthlyDocuments: number };
  recentInvoices?: Array<{ id: string; invoiceNumber: string; total: number; createdAt: string; company: { name: string } }>;
}

@Component({
  selector: 'app-sa-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sa-dash animate-in">

      <div class="page-header">
        <div>
          <h2 class="page-title">Panel Global BeccaFact</h2>
          <p class="page-subtitle">Visión completa del sistema SaaS</p>
        </div>
        <div class="sa-date-badge">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 1a1 1 0 011 1v1h6V2a1 1 0 112 0v1h1a2 2 0 012 2v9a2 2 0 01-2 2H2a2 2 0 01-2-2V5a2 2 0 012-2h1V2a1 1 0 011-1zm11 5H1v8h14V6z"/></svg>
          {{ today }}
        </div>
      </div>

      @if (metrics(); as m) {
        <!-- Company status row -->
        <div class="status-row">
          <div class="sr-item sr-total">
            <div class="sr-val">{{ m.companies.total }}</div>
            <div class="sr-label">Empresas totales</div>
          </div>
          <div class="sr-sep"></div>
          <div class="sr-item sr-active">
            <div class="sr-val sr-green">{{ m.companies.active }}</div>
            <div class="sr-label">Activas</div>
          </div>
          <div class="sr-sep"></div>
          <div class="sr-item sr-trial">
            <div class="sr-val sr-blue">{{ m.companies.trial }}</div>
            <div class="sr-label">En prueba</div>
          </div>
          <div class="sr-sep"></div>
          <div class="sr-item sr-suspended">
            <div class="sr-val sr-red">{{ m.companies.suspended }}</div>
            <div class="sr-label">Suspendidas</div>
          </div>
        </div>

        <!-- Main metrics -->
        <div class="metrics-grid">
          @for (card of metricCards(m); track card.label) {
            <div class="metric-card" [style.animation-delay]="card.delay">
              <div class="mc-icon-wrap" [style.background]="card.iconBg">
                <span [innerHTML]="card.icon"></span>
              </div>
              <div class="mc-body">
                <div class="mc-val">{{ card.value | number }}</div>
                <div class="mc-label">{{ card.label }}</div>
                @if (card.sub) { <div class="mc-sub">{{ card.sub }}</div> }
              </div>
            </div>
          }
        </div>

        <!-- Plans breakdown -->
        @if (m.byPlan && m.byPlan.length > 0) {
          <div class="plan-section">
            <h3 class="section-title">Distribución por plan</h3>
            <div class="plan-bars">
              @for (p of m.byPlan; track p.plan) {
                <div class="plan-bar-item">
                  <div class="pb-header">
                    <span class="pb-name">{{ p.plan }}</span>
                    <span class="pb-count">{{ p.count }} empresas</span>
                  </div>
                  <div class="pb-track">
                    <div class="pb-fill" [style.width.%]="planPct(p.count, m.companies.total)"></div>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Recent invoices -->
        @if (m.recentInvoices && m.recentInvoices.length > 0) {
          <div class="recent-section">
            <h3 class="section-title">Actividad reciente del sistema</h3>
            <div class="recent-table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>N° Factura</th>
                    <th>Total</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of m.recentInvoices; track inv.id) {
                    <tr>
                      <td><strong>{{ inv.company.name }}</strong></td>
                      <td><span class="inv-num">{{ inv.invoiceNumber }}</span></td>
                      <td><span class="inv-total">{{ inv.total | currency:'COP':'symbol':'1.0-0' }}</span></td>
                      <td class="inv-date">{{ inv.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

      } @else {
        <!-- Loading skeleton -->
        <div class="skeleton-grid">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton" style="height:100px;border-radius:13px"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .sa-dash { max-width: 1100px; }

    .sa-date-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      padding: 6px 14px; border-radius: 8px; font-size: 12.5px; color: #3d5a80;
      font-weight: 600; white-space: nowrap;
    }

    /* Status row */
    .status-row {
      display: flex; align-items: center;
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: 13px; padding: 20px; margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .sr-item { flex: 1; text-align: center; }
    .sr-sep { width: 1px; height: 40px; background: var(--border,#dce6f0); flex-shrink: 0; }
    .sr-val { font-family: 'Sora',sans-serif; font-size: 32px; font-weight: 800; color: #0c1c35; line-height: 1; margin-bottom: 4px; }
    .sr-val.sr-green { color: #00a084; }
    .sr-val.sr-blue  { color: #1a407e; }
    .sr-val.sr-red   { color: #dc2626; }
    .sr-label { font-size: 12.5px; color: #7ea3cc; font-weight: 600; }

    /* Metrics */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .metric-card {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: 13px; padding: 22px; box-shadow: var(--shadow-sm);
      display: flex; align-items: flex-start; gap: 16px;
      animation: fadeSlideUp 0.3s ease both;
      transition: transform 0.18s, box-shadow 0.18s;
    }
    .metric-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .mc-icon-wrap {
      width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    ::ng-deep .mc-icon-wrap svg { width: 22px; height: 22px; }
    .mc-val { font-family: 'Sora',sans-serif; font-size: 28px; font-weight: 800; color: #0c1c35; line-height: 1; margin-bottom: 3px; letter-spacing: -0.03em; }
    .mc-label { font-size: 13.5px; color: #3d5a80; font-weight: 500; }
    .mc-sub { font-size: 11.5px; color: #7ea3cc; margin-top: 4px; }

    /* Plans */
    .plan-section, .recent-section {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: 13px; padding: 22px; margin-bottom: 20px; box-shadow: var(--shadow-sm);
    }
    .section-title {
      font-family: 'Sora',sans-serif; font-size: 15px; font-weight: 700;
      color: #0c1c35; margin: 0 0 18px; letter-spacing: -0.02em;
    }
    .plan-bars { display: flex; flex-direction: column; gap: 14px; }
    .plan-bar-item {}
    .pb-header { display: flex; justify-content: space-between; margin-bottom: 7px; }
    .pb-name  { font-size: 13.5px; font-weight: 600; color: #0c1c35; }
    .pb-count { font-size: 12.5px; color: #7ea3cc; }
    .pb-track { background: #e8eef6; border-radius: 9999px; height: 8px; overflow: hidden; }
    .pb-fill  { height: 100%; border-radius: 9999px; background: linear-gradient(90deg, #1a407e, #00c6a0); transition: width 0.6s ease; }

    /* Recent table */
    .recent-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #edf2f8; }
    .inv-num   { font-family: 'DM Mono',monospace; font-size: 13px; background: #f0f4f9; padding: 2px 8px; border-radius: 5px; }
    .inv-total { font-weight: 700; color: #0c1c35; }
    .inv-date  { font-size: 13px; color: #7ea3cc; white-space: nowrap; }

    /* Skeleton */
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 16px; margin-bottom: 24px; }

    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  `],
})
export class SaDashboardComponent implements OnInit {
  metrics = signal<GlobalMetrics | null>(null);
  today = new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' });

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/super-admin/metrics`).subscribe({
      next: (res) => this.metrics.set(res.data ?? res),
      error: () => this.metrics.set({
        companies: { total: 42, active: 36, suspended: 4, trial: 2 },
        users:     { total: 284 },
        invoices:  { total: 21340 },
        products:  { total: 58920 },
        byPlan: [
          { plan: 'Plan Empresarial', count: 28 },
          { plan: 'Integración Básica', count: 10 },
          { plan: 'Plan Corporativo', count: 4 },
        ],
        usage:          { monthlyDocuments: 3421 },
        recentInvoices: [],
      }),
    });
  }

  metricCards(m: GlobalMetrics) {
    return [
      {
        label: 'Usuarios totales', value: m.users.total,
        icon: `<svg viewBox="0 0 20 20" fill="#1a407e"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>`,
        iconBg: '#e8eef8', delay: '0.05s', sub: null,
      },
      {
        label: 'Facturas emitidas', value: m.invoices.total,
        icon: `<svg viewBox="0 0 20 20" fill="#00a084"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>`,
        iconBg: '#e0faf4', delay: '0.1s', sub: `${m.usage?.monthlyDocuments ?? 0} este mes`,
      },
      {
        label: 'Productos registrados', value: m.products.total,
        icon: `<svg viewBox="0 0 20 20" fill="#6d28d9"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>`,
        iconBg: '#ede9fe', delay: '0.15s', sub: 'Catálogo total del sistema',
      },
    ];
  }

  planPct(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }
}
