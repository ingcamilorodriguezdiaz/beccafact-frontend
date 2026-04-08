import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="db">
      <section class="db__hero">
        <div class="db__hero-copy">
          <div class="db__eyebrow">
            <span class="db__eyebrow-dot"></span>
            {{ greeting() }}
          </div>

          <h1 class="db__title">
            {{ auth.user()?.firstName }} {{ auth.user()?.lastName }}
          </h1>

          <p class="db__subtitle">
            {{ momentumMessage() }}
          </p>

          <div class="db__meta">
            <span>{{ auth.user()?.company?.name ?? 'Tu empresa' }}</span>
            <span class="db__meta-sep"></span>
            <span>{{ roleLabel() }}</span>
            <span class="db__meta-sep"></span>
            <span>{{ currentPeriod }}</span>
          </div>

          <div class="db__hero-actions">
            @for (action of heroActions(); track action.label) {
              <a [routerLink]="action.route" class="db__hero-btn" [class.db__hero-btn--ghost]="action.ghost">
                <span>{{ action.label }}</span>
                <small>{{ action.caption }}</small>
              </a>
            }
          </div>
        </div>

        <div class="db__hero-side">
          <div class="db__plan-card">
            <div class="db__plan-top">
              <div>
                <p class="db__plan-label">Plan activo</p>
                <h2 class="db__plan-name">{{ auth.currentPlan()?.displayName ?? 'Sin plan' }}</h2>
              </div>
              <span class="db__plan-badge plan-{{ planSlug() }}">
                <span class="db__plan-badge-dot"></span>
                {{ usageToneLabel() }}
              </span>
            </div>

            <div class="db__plan-meters">
              <div class="db__meter-card">
                <div class="db__meter-head">
                  <span>Documentos</span>
                  <strong>{{ usageData().docsUsed }} / {{ docLimit() }}</strong>
                </div>
                <div class="db__meter-track">
                  <div
                    class="db__meter-fill"
                    [class.db__meter-fill--warn]="docUsagePercent() > 80"
                    [style.width.%]="docUsagePercent()"
                  ></div>
                </div>
                <small>{{ docUsagePercent() }}% usado</small>
              </div>

              @if (hasInventory()) {
                <div class="db__meter-card">
                  <div class="db__meter-head">
                    <span>Catálogo</span>
                    <strong>{{ usageData().productsUsed }} / {{ productLimit() }}</strong>
                  </div>
                  <div class="db__meter-track">
                    <div class="db__meter-fill db__meter-fill--teal" [style.width.%]="productUsagePercent()"></div>
                  </div>
                  <small>{{ productUsagePercent() }}% ocupado</small>
                </div>
              }
            </div>

            @if (showUpgrade()) {
              <a routerLink="/settings/billing" class="db__upgrade">
                <span>Explorar plan superior</span>
                <small>Desbloquea más documentos y módulos</small>
              </a>
            }
          </div>
        </div>
      </section>

      <section class="db__stats">
        @for (stat of heroStats(); track stat.label) {
          <article class="db__stat-card" [class.db__stat-card--accent]="stat.accent" [class.db__stat-card--warning]="stat.warning">
            <div class="db__stat-top">
              <span class="db__stat-label">{{ stat.label }}</span>
              <span class="db__stat-chip">{{ stat.caption }}</span>
            </div>
            <strong class="db__stat-value">{{ stat.value }}</strong>
            <p class="db__stat-note">{{ stat.note }}</p>
          </article>
        }
      </section>

      <section class="db__workspace">
        <div class="db__main">
          <div class="db__section-head">
            <div>
              <p class="db__section-kicker">Vista operativa</p>
              <h2 class="db__section-title">Módulos con actividad</h2>
            </div>
            <p class="db__section-copy">Tus áreas más activas reunidas en una sola vista.</p>
          </div>

          <div class="db__module-grid">
            @if (hasInvoices()) {
              <article class="db__module db__module--blue">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Facturación</span>
                </div>

                <div class="db__module-value">{{ reportData().revenue | currency:'COP':'$':'1.0-0' }}</div>
                <p class="db__module-copy">Ingresos del mes con {{ reportData().invoicesThisMonth }} facturas emitidas.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Documentos</small>
                    <strong>{{ reportData().invoicesThisMonth }}</strong>
                  </div>
                  <div>
                    <small>Clientes activos</small>
                    <strong>{{ reportData().activeCustomers }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  @if (canCreateInvoice()) {
                    <a routerLink="/invoices" class="db__module-btn">Nueva factura</a>
                  }
                  <a routerLink="/invoices" class="db__module-link">Ver historial</a>
                </div>
              </article>
            }

            @if (hasQuotes()) {
              <article class="db__module db__module--cyan">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 3 14 8 19 8"/>
                      <path d="M9 13h6"/>
                      <path d="M9 17h4"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Cotizaciones</span>
                </div>

                <div class="db__module-value">{{ quotesData().totalQuotes }}</div>
                <p class="db__module-copy">Embudo comercial activo con seguimiento y aprobaciones en curso.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Pendientes</small>
                    <strong [class.db__module-pairs--warn]="quotesData().pendingApprovals > 0">{{ quotesData().pendingApprovals }}</strong>
                  </div>
                  <div>
                    <small>Conversión</small>
                    <strong>{{ quotesData().conversionRate }}%</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  @if (canCreateQuote()) {
                    <a routerLink="/quotes" class="db__module-btn">Nueva cotización</a>
                  }
                  <a routerLink="/quotes" class="db__module-link">Ver pipeline</a>
                </div>
              </article>
            }

            @if (hasPos()) {
              <article class="db__module db__module--teal">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Punto de venta</span>
                </div>

                <div class="db__module-value">{{ posData().totalSales | currency:'COP':'$':'1.0-0' }}</div>
                <p class="db__module-copy">Ventas registradas hoy con ritmo comercial activo.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Transacciones</small>
                    <strong>{{ posData().totalTransactions }}</strong>
                  </div>
                  <div>
                    <small>Promedio</small>
                    <strong>{{ averageTicket() | currency:'COP':'$':'1.0-0' }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  <a routerLink="/pos" class="db__module-btn">Abrir POS</a>
                  <a routerLink="/pos" class="db__module-link">Ver sesiones</a>
                </div>
              </article>
            }

            @if (hasPayroll()) {
              <article class="db__module db__module--purple">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Nómina</span>
                </div>

                <div class="db__module-value">{{ payrollData().totalNet | currency:'COP':'$':'1.0-0' }}</div>
                <p class="db__module-copy">Valor neto a pagar en el periodo actual.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Empleados</small>
                    <strong>{{ payrollData().employeeCount }}</strong>
                  </div>
                  <div>
                    <small>Estado</small>
                    <strong>{{ payrollStatus() }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  @if (canManagePayroll()) {
                    <a routerLink="/payroll" class="db__module-btn">Liquidar nómina</a>
                  }
                  <a routerLink="/payroll" class="db__module-link">Ver registros</a>
                </div>
              </article>
            }

            @if (hasCartera()) {
              <article class="db__module db__module--amber">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Cartera</span>
                </div>

                <div class="db__module-value">{{ carteraData().totalCartera | currency:'COP':'$':'1.0-0' }}</div>
                <p class="db__module-copy">Saldo total por cobrar con foco en recuperación.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Vencido</small>
                    <strong class="db__module-pairs--warn">{{ carteraData().totalOverdue | currency:'COP':'$':'1.0-0' }}</strong>
                  </div>
                  <div>
                    <small>Salud</small>
                    <strong>{{ carteraHealth() }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  <a routerLink="/cartera" class="db__module-btn">Gestionar cartera</a>
                  <a routerLink="/cartera" class="db__module-link">Ver aging</a>
                </div>
              </article>
            }

            @if (hasPurchasing()) {
              <article class="db__module db__module--emerald">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M6 7h15l-1.5 8h-12z"/>
                      <path d="M6 7 5 4H2"/>
                      <circle cx="9" cy="20" r="1.5"/>
                      <circle cx="18" cy="20" r="1.5"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Compras</span>
                </div>

                <div class="db__module-value">{{ purchasingData().ordersTotal | currency:'COP':'$':'1.0-0' }}</div>
                <p class="db__module-copy">Abastecimiento del periodo con órdenes, recepciones y control operativo.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Órdenes</small>
                    <strong>{{ purchasingData().ordersCount }}</strong>
                  </div>
                  <div>
                    <small>Recibidas</small>
                    <strong>{{ purchasingData().receivedCount }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  <a routerLink="/purchasing" class="db__module-btn">Gestionar compras</a>
                  <a routerLink="/purchasing" class="db__module-link">Ver trazabilidad</a>
                </div>
              </article>
            }

            @if (hasInventory()) {
              <article class="db__module db__module--violet">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Inventario</span>
                </div>

                <div class="db__module-value">{{ reportData().activeCatalog }}</div>
                <p class="db__module-copy">Productos activos en catálogo con vigilancia de stock.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Bajo stock</small>
                    <strong [class.db__module-pairs--warn]="reportData().lowStock > 0">{{ reportData().lowStock }}</strong>
                  </div>
                  <div>
                    <small>Capacidad</small>
                    <strong>{{ productUsagePercent() }}%</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  <a routerLink="/inventory" class="db__module-btn">Administrar catálogo</a>
                  <a routerLink="/inventory" class="db__module-link">Ver inventario</a>
                </div>
              </article>
            }

            @if (hasAccounting()) {
              <article class="db__module db__module--slate">
                <div class="db__module-top">
                  <div class="db__module-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                      <path d="M4 5h16"/>
                      <path d="M4 12h16"/>
                      <path d="M4 19h16"/>
                      <path d="M9 5v14"/>
                    </svg>
                  </div>
                  <span class="db__module-badge">Contabilidad</span>
                </div>

                <div class="db__module-value">{{ accountingData().entriesCount }}</div>
                <p class="db__module-copy">Comprobantes y estructura contable listos para cierre y control.</p>

                <div class="db__module-pairs">
                  <div>
                    <small>Borradores</small>
                    <strong [class.db__module-pairs--warn]="accountingData().draftEntries > 0">{{ accountingData().draftEntries }}</strong>
                  </div>
                  <div>
                    <small>PUC</small>
                    <strong>{{ accountingData().accountsCount }}</strong>
                  </div>
                </div>

                <div class="db__module-actions">
                  @if (canCreateAccountingEntry()) {
                    <a routerLink="/accounting" class="db__module-btn">Nuevo comprobante</a>
                  }
                  <a routerLink="/accounting" class="db__module-link">Ver reportes</a>
                </div>
              </article>
            }

            @for (module of lockedModules(); track module.name) {
              <a routerLink="/settings/billing" class="db__module db__module--locked">
                <div class="db__locked-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
                  </svg>
                </div>
                <strong>{{ module.name }}</strong>
                <p>{{ module.copy }}</p>
                <span>Desbloquear módulo</span>
              </a>
            }
          </div>
        </div>

        <aside class="db__sidebar">
          <div class="db__panel">
            <div class="db__section-head db__section-head--compact">
              <div>
                <p class="db__section-kicker">Enfoque del día</p>
                <h2 class="db__section-title">Insights rápidos</h2>
              </div>
            </div>

            <div class="db__insights">
              @for (insight of insights(); track insight.title) {
                <div class="db__insight" [class.db__insight--warn]="insight.tone === 'warn'" [class.db__insight--good]="insight.tone === 'good'">
                  <div class="db__insight-dot"></div>
                  <div>
                    <strong>{{ insight.title }}</strong>
                    <p>{{ insight.description }}</p>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="db__panel">
            <div class="db__section-head db__section-head--compact">
              <div>
                <p class="db__section-kicker">Acciones rápidas</p>
                <h2 class="db__section-title">Siguientes pasos</h2>
              </div>
            </div>

            <div class="db__action-list">
              @for (action of quickActions(); track action.label) {
                <a [routerLink]="action.route" class="db__action-card">
                  <div>
                    <strong>{{ action.label }}</strong>
                    <p>{{ action.copy }}</p>
                  </div>
                  <span>{{ action.short }}</span>
                </a>
              }
            </div>
          </div>
        </aside>
      </section>
    </div>
  `,
  styles: [`
    .db {
      --hero-bg: radial-gradient(circle at top left, rgba(0, 198, 160, 0.22), transparent 38%),
                 radial-gradient(circle at 85% 15%, rgba(59, 130, 246, 0.18), transparent 30%),
                 linear-gradient(135deg, #0d2344 0%, #15386b 54%, #0b8b77 100%);
      --panel-border: rgba(160, 184, 211, 0.22);
      max-width: 1280px;
      display: grid;
      gap: 22px;
      color: var(--text);
    }

    .db__hero {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.95fr);
      gap: 18px;
      padding: 30px;
      border-radius: 28px;
      background: var(--hero-bg);
      color: #f8fbff;
      position: relative;
      overflow: hidden;
      box-shadow: 0 28px 60px rgba(8, 22, 42, 0.22);
      animation: dbUp 0.42s ease both;
    }

    .db__hero::after {
      content: '';
      position: absolute;
      inset: auto -8% -36% auto;
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.24), transparent 68%);
      pointer-events: none;
    }

    .db__hero-copy,
    .db__hero-side {
      position: relative;
      z-index: 1;
    }

    .db__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.13);
      border: 1px solid rgba(255, 255, 255, 0.16);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }

    .db__eyebrow-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #7ef4d8;
      box-shadow: 0 0 0 6px rgba(126, 244, 216, 0.15);
    }

    .db__title {
      margin: 0;
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 0.95;
      letter-spacing: -0.045em;
    }

    .db__subtitle {
      margin: 16px 0 0;
      max-width: 58ch;
      font-size: 15px;
      line-height: 1.75;
      color: rgba(238, 246, 255, 0.82);
    }

    .db__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
      color: rgba(236, 244, 255, 0.72);
      font-size: 13px;
    }

    .db__meta-sep {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.36);
    }

    .db__hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 26px;
    }

    .db__hero-btn {
      min-width: 170px;
      display: grid;
      gap: 2px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.14);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #fff;
      transition: transform var(--t), background var(--t), border-color var(--t);
    }

    .db__hero-btn span {
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .db__hero-btn small {
      color: rgba(238, 246, 255, 0.72);
      font-size: 12px;
    }

    .db__hero-btn:hover {
      color: #fff;
      transform: translateY(-2px);
      background: rgba(255, 255, 255, 0.19);
      border-color: rgba(255, 255, 255, 0.28);
    }

    .db__hero-btn--ghost {
      background: rgba(12, 28, 53, 0.24);
    }

    .db__plan-card {
      height: 100%;
      display: grid;
      gap: 16px;
      padding: 22px;
      border-radius: 24px;
      background: rgba(7, 18, 37, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.13);
      backdrop-filter: blur(14px);
    }

    .db__plan-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .db__plan-label {
      margin: 0 0 6px;
      color: rgba(236, 244, 255, 0.68);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .db__plan-name {
      margin: 0;
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: 1.45rem;
      letter-spacing: -0.03em;
    }

    .db__plan-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .db__plan-badge-dot,
    .plan-basic .db__plan-badge-dot,
    .plan-integración_básica .db__plan-badge-dot,
    .plan-empresarial .db__plan-badge-dot,
    .plan-corporativo .db__plan-badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }

    .plan-basic,
    .plan-integración_básica {
      background: rgba(219, 234, 254, 0.16);
      color: #bfdbfe;
    }

    .plan-empresarial {
      background: rgba(167, 243, 208, 0.16);
      color: #86efac;
    }

    .plan-corporativo {
      background: rgba(254, 243, 199, 0.16);
      color: #fde68a;
    }

    .db__plan-meters {
      display: grid;
      gap: 12px;
    }

    .db__meter-card {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.09);
    }

    .db__meter-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      color: rgba(239, 246, 255, 0.9);
      font-size: 13px;
    }

    .db__meter-head strong {
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: 1rem;
    }

    .db__meter-track {
      height: 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.11);
      overflow: hidden;
    }

    .db__meter-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #7fb7ff 0%, #91f2dc 100%);
      transition: width 0.45s ease;
    }

    .db__meter-fill--warn {
      background: linear-gradient(90deg, #fbbf24 0%, #fb7185 100%);
    }

    .db__meter-fill--teal {
      background: linear-gradient(90deg, #2dd4bf 0%, #7dd3fc 100%);
    }

    .db__meter-card small {
      display: block;
      margin-top: 9px;
      color: rgba(236, 244, 255, 0.66);
      font-size: 12px;
    }

    .db__upgrade {
      display: grid;
      gap: 2px;
      padding: 14px 16px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.08));
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      transition: transform var(--t), border-color var(--t);
    }

    .db__upgrade span {
      font-weight: 700;
    }

    .db__upgrade small {
      color: rgba(236, 244, 255, 0.72);
      font-size: 12px;
    }

    .db__upgrade:hover {
      color: #fff;
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.22);
    }

    .db__stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      animation: dbUp 0.42s ease both;
      animation-delay: 0.06s;
    }

    .db__stat-card {
      position: relative;
      overflow: hidden;
      padding: 20px;
      border-radius: 22px;
      background: linear-gradient(180deg, #ffffff 0%, #f9fbfe 100%);
      border: 1px solid #dfe8f1;
      box-shadow: 0 14px 30px rgba(12, 28, 53, 0.07);
    }

    .db__stat-card::before {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, #1a407e, #00c6a0);
    }

    .db__stat-card--accent::before {
      background: linear-gradient(90deg, #0f766e, #2dd4bf);
    }

    .db__stat-card--warning::before {
      background: linear-gradient(90deg, #d97706, #f59e0b);
    }

    .db__stat-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }

    .db__stat-label {
      color: var(--text-2);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .db__stat-chip {
      padding: 5px 10px;
      border-radius: 999px;
      background: var(--bg);
      color: var(--text-3);
      font-size: 11px;
      font-weight: 700;
    }

    .db__stat-value {
      display: block;
      margin-top: 18px;
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: clamp(1.5rem, 2vw, 2rem);
      letter-spacing: -0.05em;
      color: var(--text);
    }

    .db__stat-note {
      margin: 10px 0 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.6;
    }

    .db__workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.75fr) minmax(280px, 0.95fr);
      gap: 18px;
      align-items: start;
    }

    .db__main,
    .db__sidebar {
      display: grid;
      gap: 18px;
    }

    .db__section-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: end;
      margin-bottom: 2px;
    }

    .db__section-head--compact {
      align-items: start;
    }

    .db__section-kicker {
      margin: 0 0 5px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }

    .db__section-title {
      margin: 0;
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: 1.35rem;
      letter-spacing: -0.04em;
    }

    .db__section-copy {
      margin: 0;
      max-width: 36ch;
      color: var(--text-3);
      font-size: 13px;
      line-height: 1.6;
      text-align: right;
    }

    .db__module-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .db__module {
      min-height: 265px;
      display: grid;
      gap: 16px;
      padding: 22px;
      border-radius: 24px;
      background: #fff;
      border: 1px solid #e2ebf3;
      box-shadow: 0 18px 34px rgba(12, 28, 53, 0.08);
      position: relative;
      overflow: hidden;
      transition: transform var(--t), box-shadow var(--t), border-color var(--t);
      animation: dbUp 0.42s ease both;
    }

    .db__module::before {
      content: '';
      position: absolute;
      inset: auto auto 0 -10%;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      opacity: 0.14;
      filter: blur(8px);
    }

    .db__module:hover {
      transform: translateY(-4px);
      box-shadow: 0 24px 44px rgba(12, 28, 53, 0.12);
    }

    .db__module--blue::before {
      background: radial-gradient(circle, #60a5fa 0%, transparent 65%);
    }

    .db__module--cyan::before {
      background: radial-gradient(circle, #22d3ee 0%, transparent 65%);
    }

    .db__module--teal::before {
      background: radial-gradient(circle, #2dd4bf 0%, transparent 65%);
    }

    .db__module--emerald::before {
      background: radial-gradient(circle, #34d399 0%, transparent 65%);
    }

    .db__module--purple::before {
      background: radial-gradient(circle, #a78bfa 0%, transparent 65%);
    }

    .db__module--amber::before {
      background: radial-gradient(circle, #fbbf24 0%, transparent 65%);
    }

    .db__module--violet::before {
      background: radial-gradient(circle, #8b5cf6 0%, transparent 65%);
    }

    .db__module--slate::before {
      background: radial-gradient(circle, #64748b 0%, transparent 65%);
    }

    .db__module-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .db__module-icon {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 16px;
      border: 1px solid transparent;
    }

    .db__module--blue .db__module-icon {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .db__module--cyan .db__module-icon {
      background: #cffafe;
      color: #0f766e;
    }

    .db__module--teal .db__module-icon {
      background: #ccfbf1;
      color: #0f766e;
    }

    .db__module--emerald .db__module-icon {
      background: #d1fae5;
      color: #047857;
    }

    .db__module--purple .db__module-icon {
      background: #ede9fe;
      color: #6d28d9;
    }

    .db__module--amber .db__module-icon {
      background: #fef3c7;
      color: #b45309;
    }

    .db__module--violet .db__module-icon {
      background: #ede9fe;
      color: #5b21b6;
    }

    .db__module--slate .db__module-icon {
      background: #e2e8f0;
      color: #334155;
    }

    .db__module-badge {
      padding: 6px 11px;
      border-radius: 999px;
      background: rgba(12, 28, 53, 0.05);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .db__module-value {
      position: relative;
      z-index: 1;
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: clamp(1.55rem, 3vw, 2.3rem);
      line-height: 1;
      letter-spacing: -0.06em;
      color: var(--text);
    }

    .db__module-copy {
      position: relative;
      z-index: 1;
      margin: -4px 0 0;
      color: var(--text-2);
      font-size: 14px;
      line-height: 1.7;
    }

    .db__module-pairs {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .db__module-pairs > div {
      padding: 13px 14px;
      border-radius: 16px;
      background: #f7fafc;
      border: 1px solid #e7eff6;
    }

    .db__module-pairs small {
      display: block;
      color: var(--text-3);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .db__module-pairs strong {
      font-size: 1rem;
      color: var(--text);
    }

    .db__module-pairs--warn {
      color: var(--danger) !important;
    }

    .db__module-actions {
      position: relative;
      z-index: 1;
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .db__module-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 14px;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      letter-spacing: -0.02em;
      box-shadow: 0 12px 24px rgba(26, 64, 126, 0.18);
    }

    .db__module-btn:hover {
      color: #fff;
      background: var(--brand-dark);
    }

    .db__module-link {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-2);
    }

    .db__module-link:hover {
      color: var(--brand);
    }

    .db__module--locked {
      min-height: 220px;
      place-items: center;
      text-align: center;
      background:
        linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9)),
        repeating-linear-gradient(135deg, rgba(201, 214, 227, 0.18) 0 12px, transparent 12px 24px);
      border-style: dashed;
      border-color: #cbd8e6;
      box-shadow: none;
    }

    .db__module--locked::before {
      display: none;
    }

    .db__module--locked strong {
      font-family: var(--font-d, 'Sora', sans-serif);
      font-size: 1.2rem;
      color: var(--text);
    }

    .db__module--locked p {
      margin: 0;
      max-width: 26ch;
      color: var(--text-2);
      line-height: 1.7;
      font-size: 14px;
    }

    .db__module--locked span {
      color: var(--brand);
      font-weight: 700;
      font-size: 13px;
    }

    .db__locked-icon {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: #fff;
      color: #9fb3c8;
      border: 1px solid #dbe5ef;
    }

    .db__panel {
      display: grid;
      gap: 16px;
      padding: 22px;
      border-radius: 24px;
      background: linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
      border: 1px solid #e2ebf3;
      box-shadow: 0 18px 34px rgba(12, 28, 53, 0.07);
      animation: dbUp 0.42s ease both;
      animation-delay: 0.1s;
    }

    .db__insights,
    .db__action-list {
      display: grid;
      gap: 12px;
    }

    .db__insight {
      display: grid;
      grid-template-columns: 12px 1fr;
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid #edf2f7;
    }

    .db__insight:first-child {
      border-top: none;
      padding-top: 0;
    }

    .db__insight strong {
      display: block;
      font-size: 14px;
      color: var(--text);
      margin-bottom: 4px;
    }

    .db__insight p {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.65;
    }

    .db__insight-dot {
      width: 10px;
      height: 10px;
      margin-top: 5px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      box-shadow: 0 0 0 5px rgba(26, 64, 126, 0.08);
    }

    .db__insight--warn .db__insight-dot {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.1);
    }

    .db__insight--good .db__insight-dot {
      background: linear-gradient(135deg, #14b8a6, #22c55e);
      box-shadow: 0 0 0 5px rgba(20, 184, 166, 0.1);
    }

    .db__action-card {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      padding: 16px;
      border-radius: 18px;
      background: #f7fafc;
      border: 1px solid #e7eff6;
      transition: transform var(--t), border-color var(--t), background var(--t);
    }

    .db__action-card strong {
      display: block;
      margin-bottom: 4px;
      color: var(--text);
      font-size: 14px;
    }

    .db__action-card p {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.6;
    }

    .db__action-card span {
      flex-shrink: 0;
      padding: 7px 10px;
      border-radius: 999px;
      background: #fff;
      color: var(--brand);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid #dbe5ef;
    }

    .db__action-card:hover {
      transform: translateY(-2px);
      background: #fff;
      border-color: #cdddec;
    }

    @keyframes dbUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 1180px) {
      .db__hero,
      .db__workspace {
        grid-template-columns: 1fr;
      }

      .db__stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 860px) {
      .db__module-grid {
        grid-template-columns: 1fr;
      }

      .db__section-head {
        flex-direction: column;
        align-items: start;
      }

      .db__section-copy {
        text-align: left;
      }
    }

    @media (max-width: 640px) {
      .db {
        gap: 16px;
      }

      .db__hero {
        padding: 22px;
        border-radius: 24px;
      }

      .db__hero-actions,
      .db__module-actions {
        grid-template-columns: 1fr;
      }

      .db__hero-btn,
      .db__module-btn {
        width: 100%;
      }

      .db__stats {
        grid-template-columns: 1fr;
      }

      .db__plan-top,
      .db__module-top,
      .db__stat-top {
        flex-direction: column;
        align-items: start;
      }

      .db__module-pairs {
        grid-template-columns: 1fr;
      }

      .db__panel,
      .db__module {
        padding: 18px;
        border-radius: 20px;
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  protected auth = inject(AuthService);
  private http = inject(HttpClient);

  currentPeriod = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  usageData = signal({ docsUsed: 0, productsUsed: 0 });
  reportData = signal({ invoicesThisMonth: 0, activeCustomers: 0, activeCatalog: 0, lowStock: 0, revenue: 0 });
  carteraData = signal({ totalCartera: 0, totalOverdue: 0 });
  posData = signal({ totalSales: 0, totalTransactions: 0 });
  payrollData = signal({ totalNet: 0, employeeCount: 0 });
  quotesData = signal({ totalQuotes: 0, pendingApprovals: 0, conversionRate: 0, followUpCount: 0 });
  purchasingData = signal({ ordersCount: 0, ordersTotal: 0, receivedCount: 0, partialCount: 0 });
  accountingData = signal({ accountsCount: 0, entriesCount: 0, draftEntries: 0, postedEntries: 0 });

  hasInvoices = computed(() => this.auth.hasFeature('has_invoices')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CAJERO', 'CONTADOR'])());
  hasQuotes = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CONTADOR'])());
  hasPos = computed(() => this.auth.hasFeature('has_pos')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CAJERO'])());
  hasPayroll = computed(() => this.auth.hasFeature('has_payroll')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'CONTADOR'])());
  hasCartera = computed(() => this.auth.hasFeature('has_cartera')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CONTADOR'])());
  hasPurchasing = computed(() => this.auth.hasFeature('has_purchasing')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CONTADOR'])());
  hasAccounting = computed(() => this.auth.hasFeature('has_accounting')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'CONTADOR'])());
  hasInventory = computed(() => this.auth.hasFeature('has_inventory')() && this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR'])());

  canCreateInvoice = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR', 'CAJERO', 'CONTADOR'])());
  canCreateQuote = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'OPERATOR'])());
  canCreateAccountingEntry = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER', 'CONTADOR'])());
  canManagePayroll = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER'])());
  isAdminOrManager = computed(() => this.auth.hasAnyRole(['ADMIN', 'MANAGER'])());
  canSeeLockedModules = computed(() => this.auth.hasAnyRole(['ADMIN'])());

  docLimit = computed(() => {
    const v = this.auth.planFeatures()['max_documents_per_month'];
    return v === 'unlimited' ? '∞' : (v ?? '300');
  });

  productLimit = computed(() => {
    const v = this.auth.planFeatures()['max_products'];
    return v === 'unlimited' ? '∞' : (v ?? '500');
  });

  docUsagePercent = computed(() => {
    const lim = this.auth.planFeatures()['max_documents_per_month'];
    if (!lim || lim === 'unlimited') return 0;
    return Math.min(100, Math.round((this.usageData().docsUsed / parseInt(lim, 10)) * 100));
  });

  productUsagePercent = computed(() => {
    const lim = this.auth.planFeatures()['max_products'];
    if (!lim || lim === 'unlimited') return 0;
    return Math.min(100, Math.round((this.usageData().productsUsed / parseInt(lim, 10)) * 100));
  });

  showUpgrade = computed(() =>
    ['BASIC', 'basic', 'integración_básica'].includes(this.auth.currentPlan()?.name ?? ''),
  );

  planSlug = computed(() => (this.auth.currentPlan()?.name ?? '').toLowerCase().replace(/\s+/g, '_'));

  roleLabel = computed(() => {
    const r = this.auth.user()?.roles ?? [];
    if (r.includes('ADMIN')) return 'Administrador';
    if (r.includes('MANAGER')) return 'Gerente';
    if (r.includes('CONTADOR')) return 'Contador';
    if (r.includes('OPERATOR')) return 'Operador';
    return r[0] ?? 'Usuario';
  });

  heroStats = computed(() => [
    {
      label: 'Ingresos',
      value: this.money(this.reportData().revenue),
      caption: 'Mes actual',
      note: `${this.reportData().invoicesThisMonth} facturas emitidas en el periodo.`,
      accent: false,
      warning: false,
    },
    {
      label: 'Clientes',
      value: this.number(this.reportData().activeCustomers),
      caption: 'Base activa',
      note: 'Clientes con movimiento reciente y relación comercial vigente.',
      accent: true,
      warning: false,
    },
    {
      label: 'Inventario',
      value: this.number(this.reportData().activeCatalog),
      caption: 'Catálogo vivo',
      note: this.reportData().lowStock > 0
        ? `${this.reportData().lowStock} referencias requieren atención por bajo stock.`
        : 'Catálogo sin alertas críticas de reposición.',
      accent: false,
      warning: this.reportData().lowStock > 0,
    },
    {
      label: 'Cartera',
      value: this.hasCartera() ? this.money(this.carteraData().totalCartera) : this.money(0),
      caption: this.hasCartera() ? 'Saldo total' : 'Módulo inactivo',
      note: this.hasCartera()
        ? `Vencido actual: ${this.money(this.carteraData().totalOverdue)}.`
        : 'Activa tu módulo de cartera para seguir cobros y vencimientos.',
      accent: false,
      warning: this.hasCartera() && this.carteraData().totalOverdue > 0,
    },
  ]);

  heroActions = computed(() => {
    const actions: Array<{ label: string; caption: string; route: string; ghost?: boolean }> = [];

    if (this.canCreateInvoice()) {
      actions.push({ label: 'Emitir factura', caption: 'Comienza una venta', route: '/invoices' });
    }

    if (this.hasQuotes()) {
      actions.push({
        label: this.canCreateQuote() ? 'Nueva cotización' : 'Ver cotizaciones',
        caption: 'Seguimiento comercial activo',
        route: '/quotes',
        ghost: true,
      });
    }

    if (this.hasPos()) {
      actions.push({ label: 'Abrir POS', caption: 'Venta rápida en caja', route: '/pos', ghost: true });
    } else if (this.hasInventory()) {
      actions.push({ label: 'Revisar inventario', caption: 'Catálogo y stock', route: '/inventory', ghost: true });
    }

    if (this.hasPurchasing()) {
      actions.push({ label: 'Abrir compras', caption: 'Solicitudes y órdenes', route: '/purchasing', ghost: true });
    }

    return actions.slice(0, 4);
  });

  insights = computed(() => {
    const items: Array<{ title: string; description: string; tone: 'info' | 'warn' | 'good' }> = [];

    items.push({
      title: this.docUsagePercent() > 80 ? 'Consumo alto del plan' : 'Uso del plan bajo control',
      description: this.docUsagePercent() > 80
        ? `Ya consumiste ${this.docUsagePercent()}% del cupo mensual de documentos.`
        : `Has utilizado ${this.docUsagePercent()}% del cupo mensual disponible.`,
      tone: this.docUsagePercent() > 80 ? 'warn' : 'good',
    });

    if (this.hasInventory()) {
      items.push({
        title: this.reportData().lowStock > 0 ? 'Reposición recomendada' : 'Inventario estable',
        description: this.reportData().lowStock > 0
          ? `${this.reportData().lowStock} productos están bajo stock mínimo.`
          : 'No hay referencias críticas de inventario en este momento.',
        tone: this.reportData().lowStock > 0 ? 'warn' : 'good',
      });
    }

    if (this.hasCartera()) {
      items.push({
        title: 'Seguimiento de recaudo',
        description: this.carteraData().totalOverdue > 0
          ? `Hay ${this.money(this.carteraData().totalOverdue)} vencidos que conviene priorizar hoy.`
          : 'La cartera vencida está controlada y sin alertas críticas.',
        tone: this.carteraData().totalOverdue > 0 ? 'warn' : 'good',
      });
    }

    if (this.hasQuotes()) {
      items.push({
        title: this.quotesData().pendingApprovals > 0 ? 'Aprobaciones comerciales pendientes' : 'Embudo comercial estable',
        description: this.quotesData().pendingApprovals > 0
          ? `${this.quotesData().pendingApprovals} cotizaciones requieren revisión o aprobación.`
          : `${this.quotesData().totalQuotes} cotizaciones activas con conversión de ${this.quotesData().conversionRate}%.`,
        tone: this.quotesData().pendingApprovals > 0 ? 'warn' : 'good',
      });
    }

    if (this.hasPurchasing()) {
      items.push({
        title: this.purchasingData().partialCount > 0 ? 'Recepciones pendientes' : 'Compras en curso',
        description: this.purchasingData().partialCount > 0
          ? `${this.purchasingData().partialCount} órdenes siguen con recepción parcial.`
          : `${this.purchasingData().ordersCount} órdenes por ${this.money(this.purchasingData().ordersTotal)} en el periodo.`,
        tone: this.purchasingData().partialCount > 0 ? 'warn' : 'info',
      });
    }

    if (this.hasAccounting()) {
      items.push({
        title: this.accountingData().draftEntries > 0 ? 'Comprobantes por contabilizar' : 'Contabilidad al día',
        description: this.accountingData().draftEntries > 0
          ? `${this.accountingData().draftEntries} comprobantes siguen en borrador y ${this.accountingData().postedEntries} ya están contabilizados.`
          : `${this.accountingData().postedEntries} comprobantes contabilizados con ${this.accountingData().accountsCount} cuentas activas en el PUC.`,
        tone: this.accountingData().draftEntries > 0 ? 'warn' : 'good',
      });
    }

    if (this.hasPayroll()) {
      items.push({
        title: 'Pulso de nómina',
        description: this.payrollData().employeeCount > 0
          ? `${this.payrollData().employeeCount} empleados activos con neto estimado de ${this.money(this.payrollData().totalNet)}.`
          : 'Aún no hay resumen de nómina disponible para este periodo.',
        tone: this.payrollData().employeeCount > 0 ? 'info' : 'warn',
      });
    }

    return items.slice(0, 4);
  });

  quickActions = computed(() => {
    const items: Array<{ label: string; copy: string; short: string; route: string }> = [
      {
        label: 'Gestionar clientes',
        copy: 'Actualiza datos comerciales, contactos y seguimiento.',
        short: 'CRM',
        route: '/customers',
      },
    ];

    if (this.hasQuotes()) {
      items.push({
        label: 'Seguimiento comercial',
        copy: 'Consulta aprobaciones, pipeline y actividad de cotizaciones.',
        short: 'QTS',
        route: '/quotes',
      });
    }

    if (this.hasPurchasing()) {
      items.push({
        label: 'Controlar compras',
        copy: 'Monitorea solicitudes, órdenes y recepciones del abastecimiento.',
        short: 'BUY',
        route: '/purchasing',
      });
    }

    if (this.hasAccounting()) {
      items.push({
        label: 'Revisar contabilidad',
        copy: 'Consulta comprobantes, PUC y reportes contables clave.',
        short: 'ACC',
        route: '/accounting',
      });
    }

    if (this.hasFeature('has_reports')) {
      items.push({
        label: 'Abrir reportes',
        copy: 'Consulta desempeño por periodos, ventas y tendencias.',
        short: 'BI',
        route: '/reports',
      });
    }

    if (this.hasFeature('bulk_import') && this.isAdminOrManager()) {
      items.push({
        label: 'Importación masiva',
        copy: 'Carga productos o datos operativos en lote.',
        short: 'CSV',
        route: '/import',
      });
    }

    if (this.hasInventory()) {
      items.push({
        label: 'Revisar sucursales',
        copy: 'Valida distribución operativa y stock por sede.',
        short: 'OPS',
        route: '/sucursales',
      });
    }

    return items.slice(0, 4);
  });

  lockedModules = computed(() => {
    if (!this.canSeeLockedModules()) return [];

    const items: Array<{ name: string; copy: string }> = [];

    if (!this.hasPos()) {
      items.push({
        name: 'Punto de Venta',
        copy: 'Activa ventas presenciales y control de caja para una operación más ágil.',
      });
    }

    if (!this.hasPayroll()) {
      items.push({
        name: 'Nómina',
        copy: 'Centraliza liquidación, cálculo y seguimiento del equipo.',
      });
    }

    if (!this.hasPurchasing()) {
      items.push({
        name: 'Compras',
        copy: 'Activa abastecimiento con solicitudes, órdenes, recepciones y control de proveedores.',
      });
    }

    if (!this.hasAccounting()) {
      items.push({
        name: 'Contabilidad',
        copy: 'Desbloquea PUC, comprobantes, períodos y reportes financieros del ERP.',
      });
    }

    return items;
  });

  averageTicket = computed(() => {
    const { totalSales, totalTransactions } = this.posData();
    if (!totalTransactions) return 0;
    return totalSales / totalTransactions;
  });

  hasFeature(key: string) {
    return this.auth.hasFeature(key)();
  }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  momentumMessage(): string {
    if (this.reportData().revenue > 0) {
      return `Tu operación en ${this.currentPeriod} ya suma ${this.money(this.reportData().revenue)}. Aquí tienes una vista clara para priorizar ventas, cobros y ejecución diaria.`;
    }

    return 'Organiza tu operación diaria con un panel más claro, visual y listo para actuar sobre ventas, inventario y seguimiento comercial.';
  }

  usageToneLabel(): string {
    if (this.docUsagePercent() > 80) return 'Atención';
    if (this.docUsagePercent() > 45) return 'En ritmo';
    return 'Estable';
  }

  payrollStatus(): string {
    if (this.payrollData().employeeCount === 0) return 'Sin corte';
    if (this.payrollData().totalNet > 0) return 'En curso';
    return 'Pendiente';
  }

  carteraHealth(): string {
    if (this.carteraData().totalCartera <= 0) return 'Limpia';
    const ratio = this.carteraData().totalOverdue / this.carteraData().totalCartera;
    if (ratio > 0.35) return 'Crítica';
    if (ratio > 0.15) return 'Moderada';
    return 'Saludable';
  }

  ngOnInit() {
    this.loadUsage();
    this.loadReports();
    if (this.hasQuotes()) this.loadQuotes();
    if (this.hasCartera()) this.loadCartera();
    if (this.hasPurchasing()) this.loadPurchasing();
    if (this.hasAccounting()) this.loadAccounting();
    if (this.hasPos()) this.loadPos();
    if (this.hasPayroll()) this.loadPayroll();
  }

  private loadUsage() {
    this.http.get<any>(`${environment.apiUrl}/companies/me/usage`).subscribe({
      next: (res) => {
        const u = res?.data ?? res;
        this.usageData.set({ docsUsed: u?.documents?.used ?? 0, productsUsed: u?.products?.used ?? 0 });
      },
      error: () => {},
    });
  }

  private loadReports() {
    this.http.get<any>(`${environment.apiUrl}/reports/dashboard`).subscribe({
      next: (m) => {
        const d = m?.data ?? m;
        this.reportData.set({
          invoicesThisMonth: d?.invoices?.current ?? 0,
          activeCustomers: d?.activeCustomers ?? 0,
          activeCatalog: d?.activeCatalog ?? 0,
          lowStock: d?.productCount ?? 0,
          revenue: d?.revenue?.current ?? 0,
        });
      },
      error: () => {},
    });
  }

  private loadCartera() {
    this.http.get<any>(`${environment.apiUrl}/cartera/dashboard`).subscribe({
      next: (res) => {
        const s = (res?.data ?? res)?.summary ?? (res?.data ?? res)?.resumen ?? {};
        this.carteraData.set({ totalCartera: s.totalCartera ?? 0, totalOverdue: s.totalOverdue ?? s.totalVencido ?? 0 });
      },
      error: () => {},
    });
  }

  private loadQuotes() {
    this.http.get<any>(`${environment.apiUrl}/quotes/analytics/summary`).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.quotesData.set({
          totalQuotes: d?.totalQuotes ?? 0,
          pendingApprovals: d?.pendingApprovals ?? 0,
          conversionRate: d?.conversionRate ?? 0,
          followUpCount: d?.followUpCount ?? 0,
        });
      },
      error: () => {},
    });
  }

  private loadPurchasing() {
    this.http.get<any>(`${environment.apiUrl}/purchasing/reports/analytics`).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        const kpi = d?.kpis ?? d?.summary ?? d ?? {};
        this.purchasingData.set({
          ordersCount: kpi?.ordersCount ?? 0,
          ordersTotal: kpi?.ordersTotal ?? 0,
          receivedCount: kpi?.receivedCount ?? 0,
          partialCount: kpi?.partialCount ?? 0,
        });
      },
      error: () => {},
    });
  }

  private loadAccounting() {
    this.http.get<any>(`${environment.apiUrl}/accounting/accounts`, { params: { page: 1, limit: 1 } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.accountingData.update((state) => ({
          ...state,
          accountsCount: d?.total ?? 0,
        }));
      },
      error: () => {},
    });

    this.http.get<any>(`${environment.apiUrl}/accounting/journal-entries`, { params: { page: 1, limit: 1 } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.accountingData.update((state) => ({
          ...state,
          entriesCount: d?.total ?? 0,
        }));
      },
      error: () => {},
    });

    this.http.get<any>(`${environment.apiUrl}/accounting/journal-entries`, { params: { page: 1, limit: 1, status: 'DRAFT' } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.accountingData.update((state) => ({
          ...state,
          draftEntries: d?.total ?? 0,
        }));
      },
      error: () => {},
    });

    this.http.get<any>(`${environment.apiUrl}/accounting/journal-entries`, { params: { page: 1, limit: 1, status: 'POSTED' } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.accountingData.update((state) => ({
          ...state,
          postedEntries: d?.total ?? 0,
        }));
      },
      error: () => {},
    });
  }

  private loadPos() {
    const today = new Date().toISOString().split('T')[0];
    this.http.get<any>(`${environment.apiUrl}/reports/pos`, { params: { from: today, to: today } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.posData.set({ totalSales: d?.summary?.totalSales ?? 0, totalTransactions: d?.summary?.totalTransactions ?? 0 });
      },
      error: () => {},
    });
  }

  private loadPayroll() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    this.http.get<any>(`${environment.apiUrl}/reports/payroll`, { params: { from, to } }).subscribe({
      next: (res) => {
        const d = res?.data ?? res;
        this.payrollData.set({
          totalNet: d?.summary?.totalNet ?? 0,
          employeeCount: d?.summary?.employeeCount ?? d?.summary?.totalEmployees ?? 0,
        });
      },
      error: () => {},
    });
  }

  private money(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  }

  private number(value: number): string {
    return new Intl.NumberFormat('es-CO').format(value ?? 0);
  }
}
