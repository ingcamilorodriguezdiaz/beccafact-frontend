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

      <!-- ══ 1. HEADER ═══════════════════════════════════════════════════════ -->
      <div class="db__header">
        <div class="db__header-left">
          <p class="db__greeting">{{ greeting() }}</p>
          <h1 class="db__name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</h1>
          <div class="db__meta">
            <span>{{ auth.user()?.company?.name ?? 'Tu empresa' }}</span>
            <span class="db__dot">·</span>
            <span class="db__role">{{ roleLabel() }}</span>
            <span class="db__dot">·</span>
            <span>{{ currentPeriod }}</span>
          </div>
        </div>
        <div class="db__header-right">
          <span class="db__plan plan-{{ planSlug() }}">
            <span class="db__plan-dot"></span>
            {{ auth.currentPlan()?.displayName ?? 'Sin plan' }}
          </span>
          @if (showUpgrade()) {
            <a routerLink="/settings/billing" class="db__upgrade">⚡ Actualizar</a>
          }
        </div>
      </div>

      <!-- ══ 2. FRANJA DE MÉTRICAS GLOBALES + USO ═══════════════════════════ -->
      <div class="db__strip">

        <!-- Clientes activos — único KPI sin módulo propio visible -->
        <a routerLink="/customers" class="db__strip-kpi db__strip-kpi--link">
          <div class="db__strip-icon db__strip-icon--blue">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
            </svg>
          </div>
          <div>
            <div class="db__strip-val">{{ reportData().activeCustomers }}</div>
            <div class="db__strip-lbl">Clientes activos</div>
          </div>
        </a>

        <div class="db__strip-sep"></div>

        <!-- Docs usados / límite del plan -->
        <div class="db__strip-meter">
          <div class="db__strip-meter-top">
            <span class="db__strip-lbl">Documentos del mes</span>
            <span class="db__strip-val db__strip-val--sm" [class.high]="docUsagePercent() > 80">
              {{ usageData().docsUsed }} / {{ docLimit() }}
            </span>
          </div>
          <div class="db__track">
            <div class="db__fill" [style.width.%]="docUsagePercent()" [class.danger]="docUsagePercent() > 80"></div>
          </div>
        </div>

        @if (hasInventory()) {
          <div class="db__strip-sep"></div>
          <div class="db__strip-meter">
            <div class="db__strip-meter-top">
              <span class="db__strip-lbl">Productos registrados</span>
              <span class="db__strip-val db__strip-val--sm">{{ usageData().productsUsed }} / {{ productLimit() }}</span>
            </div>
            <div class="db__track">
              <div class="db__fill" [style.width.%]="productUsagePercent()"></div>
            </div>
          </div>
        }

        <div class="db__strip-sep"></div>

        <!-- Acciones secundarias únicas (no cubiertas por los módulos) -->
        <div class="db__strip-actions">
          <a routerLink="/customers" class="db__sact">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>
            Nuevo cliente
          </a>
          @if (hasFeature('has_reports')) {
            <a routerLink="/reports" class="db__sact">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
              Reportes
            </a>
          }
          @if (hasFeature('bulk_import') && isAdminOrManager()) {
            <a routerLink="/import" class="db__sact">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>
              Importar
            </a>
          }
        </div>

      </div>

      <!-- ══ 3. MÓDULOS ══════════════════════════════════════════════════════ -->
      <div class="db__modules">

        <!-- FACTURACIÓN -->
        @if (hasInvoices()) {
          <div class="db__mod db__mod--blue">
            <div class="db__mod-head">
              <div class="db__mod-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <span class="db__mod-name">Facturación</span>
              <span class="db__mod-status">Activo</span>
            </div>
            <div class="db__mod-kpis">
              <div class="db__kpi">
                <div class="db__kpi-val">{{ reportData().invoicesThisMonth }}</div>
                <div class="db__kpi-lbl">Facturas emitidas</div>
              </div>
              <div class="db__kpi">
                <div class="db__kpi-val">{{ reportData().revenue | currency:'COP':'$':'1.0-0' }}</div>
                <div class="db__kpi-lbl">Ingresos del mes</div>
              </div>
            </div>
            <div class="db__mod-foot">
              @if (canCreateInvoice()) {
                <a routerLink="/invoices" class="db__mod-btn db__mod-btn--blue">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                  Nueva factura
                </a>
              }
              <a routerLink="/invoices" class="db__mod-lnk">Historial →</a>
            </div>
          </div>
        }

        <!-- POS -->
        @if (hasPos()) {
          <div class="db__mod db__mod--teal">
            <div class="db__mod-head">
              <div class="db__mod-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <span class="db__mod-name">Punto de Venta</span>
              <span class="db__mod-status">Activo</span>
            </div>
            <div class="db__mod-kpis">
              <div class="db__kpi">
                <div class="db__kpi-val">{{ posData().totalSales | currency:'COP':'$':'1.0-0' }}</div>
                <div class="db__kpi-lbl">Ventas hoy</div>
              </div>
              <div class="db__kpi">
                <div class="db__kpi-val">{{ posData().totalTransactions }}</div>
                <div class="db__kpi-lbl">Transacciones</div>
              </div>
            </div>
            <div class="db__mod-foot">
              <a routerLink="/pos" class="db__mod-btn db__mod-btn--teal">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Abrir POS
              </a>
              <a routerLink="/pos" class="db__mod-lnk">Ver sesiones →</a>
            </div>
          </div>
        }

        <!-- NÓMINA -->
        @if (hasPayroll()) {
          <div class="db__mod db__mod--purple">
            <div class="db__mod-head">
              <div class="db__mod-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <span class="db__mod-name">Nómina</span>
              <span class="db__mod-status">Activo</span>
            </div>
            <div class="db__mod-kpis">
              <div class="db__kpi">
                <div class="db__kpi-val">{{ payrollData().totalNet | currency:'COP':'$':'1.0-0' }}</div>
                <div class="db__kpi-lbl">Neto a pagar</div>
              </div>
              <div class="db__kpi">
                <div class="db__kpi-val">{{ payrollData().employeeCount }}</div>
                <div class="db__kpi-lbl">Empleados activos</div>
              </div>
            </div>
            <div class="db__mod-foot">
              @if (canManagePayroll()) {
                <a routerLink="/payroll" class="db__mod-btn db__mod-btn--purple">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                  Liquidar nómina
                </a>
              }
              <a routerLink="/payroll" class="db__mod-lnk">Ver nóminas →</a>
            </div>
          </div>
        }

        <!-- CARTERA -->
        @if (hasCartera()) {
          <div class="db__mod db__mod--amber">
            <div class="db__mod-head">
              <div class="db__mod-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <span class="db__mod-name">Cartera</span>
              <span class="db__mod-status">Activo</span>
            </div>
            <div class="db__mod-kpis">
              <div class="db__kpi">
                <div class="db__kpi-val">{{ carteraData().totalCartera | currency:'COP':'$':'1.0-0' }}</div>
                <div class="db__kpi-lbl">Total cartera</div>
              </div>
              <div class="db__kpi">
                <div class="db__kpi-val db__kpi-val--warn">{{ carteraData().totalOverdue | currency:'COP':'$':'1.0-0' }}</div>
                <div class="db__kpi-lbl">Saldo vencido</div>
              </div>
            </div>
            <div class="db__mod-foot">
              <a routerLink="/cartera" class="db__mod-btn db__mod-btn--amber">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/></svg>
                Ver cartera
              </a>
              <a routerLink="/cartera" class="db__mod-lnk">Aging →</a>
            </div>
          </div>
        }

        <!-- INVENTARIO -->
        @if (hasInventory()) {
          <div class="db__mod db__mod--violet">
            <div class="db__mod-head">
              <div class="db__mod-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <span class="db__mod-name">Inventario</span>
              <span class="db__mod-status">Activo</span>
            </div>
            <div class="db__mod-kpis">
              <div class="db__kpi">
                <div class="db__kpi-val">{{ reportData().activeCatalog }}</div>
                <div class="db__kpi-lbl">Productos activos</div>
              </div>
              <div class="db__kpi">
                <div class="db__kpi-val" [class.db__kpi-val--warn]="reportData().lowStock > 0">
                  {{ reportData().lowStock }}
                </div>
                <div class="db__kpi-lbl">Bajo stock mínimo</div>
              </div>
            </div>
            <div class="db__mod-foot">
              <a routerLink="/inventory" class="db__mod-btn db__mod-btn--violet">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                Nuevo producto
              </a>
              <a routerLink="/inventory" class="db__mod-lnk">Ver catálogo →</a>
            </div>
          </div>
        }

        <!-- Módulos bloqueados — solo visibles para ADMIN -->
        @if (!hasPos() && canSeeLockedModules()) {
          <a routerLink="/settings/billing" class="db__mod db__mod--locked">
            <div class="db__mod-lock">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" class="db__lock-ico">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
              </svg>
              <span class="db__lock-name">Punto de Venta</span>
              <span class="db__lock-plan">No incluido en tu plan</span>
              <span class="db__lock-cta">Ver planes →</span>
            </div>
          </a>
        }

        @if (!hasPayroll() && canSeeLockedModules()) {
          <a routerLink="/settings/billing" class="db__mod db__mod--locked">
            <div class="db__mod-lock">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" class="db__lock-ico">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
              </svg>
              <span class="db__lock-name">Nómina</span>
              <span class="db__lock-plan">No incluido en tu plan</span>
              <span class="db__lock-cta">Ver planes →</span>
            </div>
          </a>
        }

      </div>

    </div>
  `,
  styles: [`
    .db { max-width: 1100px; }

    /* ── 1. HEADER ──────────────────────────────────────────────── */
    .db__header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 18px;
      animation: dbUp .28s ease both;
    }
    .db__greeting  { font-size: 12px; font-weight: 700; color: var(--accent,#00c6a0); text-transform: uppercase; letter-spacing: .06em; margin: 0 0 3px; }
    .db__name      { font-family: var(--font-d,'Sora',sans-serif); font-size: 22px; font-weight: 700; color: var(--text,#0c1c35); margin: 0 0 5px; letter-spacing: -.02em; }
    .db__meta      { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3,#7ea3cc); flex-wrap: wrap; }
    .db__dot       { color: #c8d8ec; }
    .db__role      { font-weight: 600; color: #5a7db5; }
    .db__header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
    .db__plan { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .db__plan-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .plan-basic, .plan-integración_básica { background: #dbeafe; color: #1e40af; }
    .plan-empresarial { background: #e0faf4; color: #00a084; }
    .plan-corporativo { background: #fef3c7; color: #92400e; }
    .db__upgrade { background: #1a407e; color: #fff; padding: 6px 13px; border-radius: 8px; font-size: 12px; font-weight: 700; text-decoration: none; transition: background .15s; }
    .db__upgrade:hover { background: #122f5c; }

    /* ── 2. STRIP ───────────────────────────────────────────────── */
    .db__strip {
      display: flex; align-items: center; gap: 0;
      background: #fff; border: 1px solid #dce6f0; border-radius: 12px;
      padding: 14px 20px; margin-bottom: 20px; flex-wrap: wrap;
      animation: dbUp .28s ease both; animation-delay: .05s;
    }
    .db__strip-sep { width: 1px; background: #e8eef8; align-self: stretch; margin: 0 18px; flex-shrink: 0; }

    .db__strip-kpi { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .db__strip-kpi--link { text-decoration: none; color: inherit; transition: opacity .15s; }
    .db__strip-kpi--link:hover { opacity: .75; }
    .db__strip-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .db__strip-icon--blue { background: #dbeafe; color: #1e40af; }
    .db__strip-val { font-family: var(--font-d,'Sora',sans-serif); font-size: 18px; font-weight: 800; color: #0c1c35; line-height: 1; }
    .db__strip-val--sm { font-size: 13px; font-weight: 700; }
    .db__strip-val.high { color: #ef4444; }
    .db__strip-lbl { font-size: 11.5px; color: #94a3b8; margin-top: 2px; }

    .db__strip-meter { flex: 1; min-width: 160px; }
    .db__strip-meter-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .db__track { height: 5px; background: #f0f4f8; border-radius: 99px; overflow: hidden; }
    .db__fill  { height: 100%; background: linear-gradient(90deg,#1a407e,#00c6a0); border-radius: 99px; transition: width .5s ease; }
    .db__fill.danger { background: linear-gradient(90deg,#f59e0b,#ef4444); }

    .db__strip-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
    .db__sact {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 7px; border: 1px solid #dce6f0;
      background: #f8fafc; font-size: 12.5px; font-weight: 600; color: #374151;
      text-decoration: none; transition: all .15s; white-space: nowrap;
    }
    .db__sact:hover { background: #e8eef8; border-color: #b8d0ea; color: #1a407e; }

    /* ── 3. MÓDULOS ─────────────────────────────────────────────── */
    .db__modules {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 14px;
    }

    .db__mod {
      background: #fff; border: 1px solid #e2ecf6; border-radius: 14px;
      padding: 18px; display: flex; flex-direction: column; gap: 14px;
      position: relative; overflow: hidden;
      animation: dbUp .28s ease both;
      transition: transform .18s, box-shadow .18s;
    }
    .db__mod:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(12,28,53,.09); }

    /* Color top bar */
    .db__mod::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 14px 14px 0 0;
    }
    .db__mod--blue::after   { background: linear-gradient(90deg,#1a407e,#3b82f6); }
    .db__mod--teal::after   { background: linear-gradient(90deg,#0f766e,#2dd4bf); }
    .db__mod--purple::after { background: linear-gradient(90deg,#6d28d9,#a78bfa); }
    .db__mod--amber::after  { background: linear-gradient(90deg,#b45309,#fbbf24); }
    .db__mod--violet::after { background: linear-gradient(90deg,#5b21b6,#8b5cf6); }
    .db__mod--locked { background: #f9fafc; border-style: dashed; border-color: #d1dde8; text-decoration: none; }
    .db__mod--locked::after { display: none; }
    .db__mod--locked:hover  { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(12,28,53,.06); }

    /* Module header */
    .db__mod-head { display: flex; align-items: center; gap: 10px; }
    .db__mod-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .db__mod--blue   .db__mod-icon { background: #dbeafe; color: #1e40af; }
    .db__mod--teal   .db__mod-icon { background: #ccfbf1; color: #0f766e; }
    .db__mod--purple .db__mod-icon { background: #ede9fe; color: #6d28d9; }
    .db__mod--amber  .db__mod-icon { background: #fef3c7; color: #92400e; }
    .db__mod--violet .db__mod-icon { background: #ede9fe; color: #5b21b6; }

    .db__mod-name   { flex: 1; font-family: var(--font-d,'Sora',sans-serif); font-size: 13.5px; font-weight: 700; color: #0c1c35; }
    .db__mod-status { font-size: 10px; font-weight: 700; background: #dcfce7; color: #16a34a; padding: 2px 7px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }

    /* KPIs */
    .db__mod-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .db__kpi { background: #f8fafc; border-radius: 8px; padding: 9px 11px; }
    .db__kpi-val { font-family: var(--font-d,'Sora',sans-serif); font-size: 15px; font-weight: 800; color: #0c1c35; line-height: 1.1; }
    .db__kpi-val--warn { color: #dc2626; }
    .db__kpi-lbl { font-size: 10.5px; color: #94a3b8; margin-top: 3px; }

    /* Footer */
    .db__mod-foot { display: flex; align-items: center; gap: 10px; margin-top: auto; }
    .db__mod-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 700;
      text-decoration: none; transition: all .15s; flex-shrink: 0; white-space: nowrap;
    }
    .db__mod-btn--blue   { background: #1a407e; color: #fff; }
    .db__mod-btn--blue:hover   { background: #122f5c; }
    .db__mod-btn--teal   { background: #0f766e; color: #fff; }
    .db__mod-btn--teal:hover   { background: #0a5c56; }
    .db__mod-btn--purple { background: #6d28d9; color: #fff; }
    .db__mod-btn--purple:hover { background: #5b21b6; }
    .db__mod-btn--amber  { background: #b45309; color: #fff; }
    .db__mod-btn--amber:hover  { background: #92400e; }
    .db__mod-btn--violet { background: #5b21b6; color: #fff; }
    .db__mod-btn--violet:hover { background: #4c1d95; }
    .db__mod-lnk { font-size: 12px; font-weight: 600; color: #64748b; text-decoration: none; transition: color .15s; }
    .db__mod-lnk:hover { color: #1a407e; }

    /* Locked card */
    .db__mod-lock { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 0; width: 100%; text-align: center; }
    .db__lock-ico  { color: #cbd5e1; }
    .db__lock-name { font-size: 13px; font-weight: 700; color: #94a3b8; }
    .db__lock-plan { font-size: 11.5px; color: #b0bec5; }
    .db__lock-cta  { font-size: 12px; font-weight: 700; color: #1a407e; margin-top: 2px; }

    @keyframes dbUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 900px) { .db__modules { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) {
      .db__strip { flex-direction: column; align-items: stretch; gap: 14px; }
      .db__strip-sep { width: 100%; height: 1px; margin: 0; }
      .db__strip-meter { min-width: 0; }
      .db__header { flex-direction: column; }
    }
    @media (max-width: 560px) {
      .db__modules { grid-template-columns: 1fr; }
      .db__strip-actions { flex-wrap: wrap; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  protected auth = inject(AuthService);
  private   http = inject(HttpClient);

  currentPeriod = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  usageData   = signal({ docsUsed: 0, productsUsed: 0 });
  reportData  = signal({ invoicesThisMonth: 0, activeCustomers: 0, activeCatalog: 0, lowStock: 0, revenue: 0 });
  carteraData = signal({ totalCartera: 0, totalOverdue: 0 });
  posData     = signal({ totalSales: 0, totalTransactions: 0 });
  payrollData = signal({ totalNet: 0, employeeCount: 0 });

  // ── Permisos por módulo ──────────────────────────────────────────────────

  hasInvoices  = computed(() => this.auth.hasFeature('has_invoices')());
  hasPos       = computed(() => this.auth.hasFeature('has_pos')()     && this.auth.hasAnyRole(['ADMIN','MANAGER','OPERATOR'])());
  hasPayroll   = computed(() => this.auth.hasFeature('has_payroll')() && this.auth.hasAnyRole(['ADMIN','MANAGER','CONTADOR'])());
  hasCartera   = computed(() => this.auth.hasFeature('has_cartera')() && this.auth.hasAnyRole(['ADMIN','MANAGER','CONTADOR'])());
  hasInventory = computed(() => this.auth.hasFeature('has_inventory')());

  canCreateInvoice    = computed(() => this.auth.hasAnyRole(['ADMIN','MANAGER','OPERATOR'])());
  canManagePayroll    = computed(() => this.auth.hasAnyRole(['ADMIN','MANAGER'])());
  isAdminOrManager    = computed(() => this.auth.hasAnyRole(['ADMIN','MANAGER'])());
  canSeeLockedModules = computed(() => this.auth.hasAnyRole(['ADMIN'])());

  hasFeature(key: string) { return this.auth.hasFeature(key)(); }

  // ── Plan / uso ───────────────────────────────────────────────────────────

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
    return Math.min(100, Math.round((this.usageData().docsUsed / parseInt(lim)) * 100));
  });
  productUsagePercent = computed(() => {
    const lim = this.auth.planFeatures()['max_products'];
    if (!lim || lim === 'unlimited') return 0;
    return Math.min(100, Math.round((this.usageData().productsUsed / parseInt(lim)) * 100));
  });
  showUpgrade = computed(() =>
    ['BASIC','basic','integración_básica'].includes(this.auth.currentPlan()?.name ?? '')
  );
  planSlug = computed(() => (this.auth.currentPlan()?.name ?? '').toLowerCase().replace(/\s+/g,'_'));

  // ── Labels dinámicos ─────────────────────────────────────────────────────

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Buenos días';
    if (h < 18) return '🌤 Buenas tardes';
    return '🌙 Buenas noches';
  }

  roleLabel = computed(() => {
    const r = this.auth.user()?.roles ?? [];
    if (r.includes('ADMIN'))    return 'Administrador';
    if (r.includes('MANAGER'))  return 'Gerente';
    if (r.includes('CONTADOR')) return 'Contador';
    if (r.includes('OPERATOR')) return 'Operador';
    return r[0] ?? 'Usuario';
  });

  // ── Ciclo de vida ────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadUsage();
    this.loadReports();
    if (this.hasCartera()) this.loadCartera();
    if (this.hasPos())     this.loadPos();
    if (this.hasPayroll()) this.loadPayroll();
  }

  // ── Carga de datos ───────────────────────────────────────────────────────

  private loadUsage() {
    this.http.get<any>(`${environment.apiUrl}/companies/me/usage`).subscribe({
      next: res => {
        const u = res?.data ?? res;
        this.usageData.set({ docsUsed: u?.documents?.used ?? 0, productsUsed: u?.products?.used ?? 0 });
      },
      error: () => {},
    });
  }

  private loadReports() {
    this.http.get<any>(`${environment.apiUrl}/reports/dashboard`).subscribe({
      next: m => {
        const d = m?.data ?? m;
        this.reportData.set({
          invoicesThisMonth: d?.invoices?.current  ?? 0,
          activeCustomers:   d?.activeCustomers    ?? 0,
          activeCatalog:     d?.activeCatalog      ?? 0,
          lowStock:          d?.productCount       ?? 0,
          revenue:           d?.revenue?.current   ?? 0,
        });
      },
      error: () => {},
    });
  }

  private loadCartera() {
    this.http.get<any>(`${environment.apiUrl}/cartera/dashboard`).subscribe({
      next: res => {
        const s = (res?.data ?? res)?.summary ?? (res?.data ?? res)?.resumen ?? {};
        this.carteraData.set({ totalCartera: s.totalCartera ?? 0, totalOverdue: s.totalOverdue ?? s.totalVencido ?? 0 });
      },
      error: () => {},
    });
  }

  private loadPos() {
    const today = new Date().toISOString().split('T')[0];
    this.http.get<any>(`${environment.apiUrl}/reports/pos`, { params: { from: today, to: today } }).subscribe({
      next: res => {
        const d = res?.data ?? res;
        this.posData.set({ totalSales: d?.summary?.totalSales ?? 0, totalTransactions: d?.summary?.totalTransactions ?? 0 });
      },
      error: () => {},
    });
  }

  private loadPayroll() {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to   = now.toISOString().split('T')[0];
    this.http.get<any>(`${environment.apiUrl}/reports/payroll`, { params: { from, to } }).subscribe({
      next: res => {
        const d = res?.data ?? res;
        this.payrollData.set({
          totalNet:      d?.summary?.totalNet       ?? 0,
          employeeCount: d?.summary?.employeeCount  ?? d?.summary?.totalEmployees ?? 0,
        });
      },
      error: () => {},
    });
  }
}
