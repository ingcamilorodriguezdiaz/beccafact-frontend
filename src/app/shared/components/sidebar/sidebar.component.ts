import {
  Component, Input, Output, EventEmitter, signal, inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { User, AuthService } from '../../../core/auth/auth.service';
export interface NavItem {
  label: string;
  iconId: string;
  route: string;
  feature?: string;
  roles?: string[];
  section?: string;   // ← agregar esto
}
export type PlanInfo = {
  id: string;
  name: string;
  displayName: string;
  features: Array<{ key: string; value: string; label?: string }>;
} | null;

const NAV_ITEMS: NavItem[] = [

  // ── VISIÓN GENERAL ──────────────────────────────────────────
  { label: 'Dashboard',      iconId: 'dashboard', route: '/dashboard',    section: 'VISIÓN GENERAL' },

  // ── OPERACIÓN ───────────────────────────────────────────────
  { label: 'Punto de Venta', iconId: 'pos',       route: '/pos',          feature: 'has_pos',       roles: ['ADMIN','MANAGER','OPERATOR','CAJERO'],               section: 'OPERACIÓN' },
  { label: 'Facturación',    iconId: 'invoice',   route: '/invoices',     feature: 'has_invoices',  roles: ['ADMIN','MANAGER','OPERATOR','CAJERO','CONTADOR'],    section: 'OPERACIÓN' },
  { label: 'Clientes',       iconId: 'customers', route: '/customers',                              roles: ['ADMIN','MANAGER','OPERATOR','CAJERO','CONTADOR'],    section: 'OPERACIÓN' },
  { label: 'Cartera',        iconId: 'cartera',   route: '/cartera',      feature: 'has_cartera',   roles: ['ADMIN','MANAGER','OPERATOR','CONTADOR'],             section: 'OPERACIÓN' },

  // ── INVENTARIO ──────────────────────────────────────────────
  { label: 'Inventario',     iconId: 'inventory', route: '/inventory',    feature: 'has_inventory', roles: ['ADMIN','MANAGER','OPERATOR'],                        section: 'INVENTARIO' },
  { label: 'Sucursales',     iconId: 'branches',  route: '/sucursales',                             roles: ['ADMIN','MANAGER','OPERATOR','CAJERO'],               section: 'INVENTARIO' },

  // ── GESTIÓN ─────────────────────────────────────────────────
  { label: 'Nómina',         iconId: 'payroll',   route: '/payroll',      feature: 'has_payroll',   roles: ['ADMIN','MANAGER','CONTADOR'],                        section: 'GESTIÓN' },
  { label: 'Reportes',       iconId: 'reports',   route: '/reports',      feature: 'has_reports',   roles: ['ADMIN','MANAGER','OPERATOR','CONTADOR'],             section: 'GESTIÓN' },
  { label: 'Importar',       iconId: 'import',    route: '/import',       feature: 'bulk_import',   roles: ['ADMIN','MANAGER'],                          section: 'GESTIÓN' },

  // ── ADMIN ───────────────────────────────────────────────────
  { label: 'Configuración',  iconId: 'settings',  route: '/settings',                               roles: ['ADMIN'],                                    section: 'ADMIN' },
];

const FEATURE_LABELS: Record<string, string> = {
  has_pos:                 'Punto de Venta (POS)',
  has_invoices:            'Facturación electrónica',
  has_inventory:           'Inventario',
  has_cartera:             'Cartera y cobros',
  has_payroll:             'Nómina electrónica',
  has_reports:             'Reportes avanzados',
  has_branch:               'Multisede',
  priority_support:        'Soporte prioritario',
  has_integrations:        'Integraciones',
  bulk_import:             'Importación masiva',
  dian_enabled:            'Facturación DIAN',
  max_documents_per_month: 'Documentos / mes',
  max_products:            'Productos',
  max_customers:           'Clientes',
  max_users:               'Usuarios',
  max_support_tickets:     'Tickets soporte / mes',
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" id="tour-sidebar" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen">

      <!-- Brand -->
      <div class="sidebar-brand">
        @if (!collapsed()) {
          <div class="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M3 17L8 10L13 14L17 8L21 12"
                    stroke="#00c6a0" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">BeccaFact</span>
            <span class="brand-sub">ERP Cloud</span>
          </div>
        }
        <button class="mobile-close-btn" (click)="mobileClose.emit()" type="button" aria-label="Cerrar menú">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
        <button class="collapse-btn" (click)="toggleCollapse()" type="button"
                [title]="collapsed() ? 'Expandir sidebar' : 'Colapsar sidebar'">
          @if (collapsed()) {
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
            </svg>
          } @else {
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
            </svg>
          }
        </button>
      </div>

      <!-- Company info -->
      <div class="company-info" [class.company-info--center]="collapsed()">
        <div class="company-avatar" [title]="user.company?.name ">
          {{ companyInitials() }}
        </div>
        @if (!collapsed()) {
          <div class="company-details">
            <div class="company-name">{{ user.company?.name ?? 'Mi Empresa' }}</div>
            @if (plan) {
              <span class="plan-badge plan-{{ plan.name.toLowerCase() }}">{{ plan.displayName }}</span>
            } @else {
              <span class="plan-badge plan-free">Sin plan</span>
            }
          </div>
        }
      </div>

      <!-- Nav -->
    <nav class="sidebar-nav">
  @for (section of navSections(); track section.label) {
    @if (section.items.length > 0) {
      @if (!collapsed()) {
        <div class="nav-section-label">{{ section.label }}</div>
      } @else {
        <div class="nav-section-divider"></div>
      }
      @for (item of section.items; track item.route) {
        @if (isItemEnabled(item)) {
          <a [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
             class="nav-item"
             [class.nav-item--collapsed]="collapsed()"
             [title]="collapsed() ? item.label : ''"
             [id]="'tour-' + item.iconId"
             (click)="mobileClose.emit()">
            <span class="nav-icon">
              <ng-container *ngTemplateOutlet="iconTpl; context: { id: item.iconId }"/>
            </span>
            @if (!collapsed()) {
              <span class="nav-label">{{ item.label }}</span>
            }
          </a>
        } @else {
          <div class="nav-item nav-item--locked"
               [class.nav-item--collapsed]="collapsed()"
               (click)="onLockedClick(item)"
               [title]="collapsed() ? (item.label + ' — Plan requerido') : ''">
            <span class="nav-icon nav-icon--locked">
              <ng-container *ngTemplateOutlet="iconTpl; context: { id: item.iconId }"/>
            </span>
            @if (!collapsed()) {
              <span class="nav-label">{{ item.label }}</span>
              <span class="lock-chip">
                <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
                  <path d="M8 1a3 3 0 00-3 3v1H4a1 1 0 00-1 1v7a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1V4a3 3 0 00-3-3zm0 2a1 1 0 011 1v1H7V4a1 1 0 011-1z"/>
                </svg>
                Upgrade
              </span>
            }
          </div>
        }
      }
    }
  }
</nav>

      <!-- Plan features -->
      @if (!collapsed() && plan && planFeatureList().length > 0) {
        <div class="plan-section">
          <div class="plan-section-header">
            <svg viewBox="0 0 16 16" fill="currentColor" width="11">
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
              <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
            </svg>
            MÓDULOS DEL PLAN
          </div>
          <div class="plan-features-list">
            @for (f of planFeatureList(); track f.key) {
              <div class="plan-feat-row" [class.feat-off]="!f.enabled">
                <span class="feat-dot" [class.feat-dot--on]="f.enabled" [class.feat-dot--off]="!f.enabled"></span>
                <span class="feat-name">{{ f.label }}</span>
                @if (!f.isBoolean) {
                  <span class="feat-limit">{{ f.value === '-1' ? '∞' : f.value }}</span>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Usage meter -->
      @if (!collapsed() && plan && usagePercent > 0) {
        <div class="usage-section">
          <div class="usage-header">
            <span class="usage-label">Uso mensual</span>
            <span class="usage-pct" [class.high]="usagePercent > 80">{{ usagePercent }}%</span>
          </div>
          <div class="usage-track">
            <div class="usage-fill" [style.width.%]="usagePercent" [class.high]="usagePercent > 80"></div>
          </div>
          @if (usagePercent > 80) {
            <div class="usage-warn">Considera actualizar tu plan</div>
          }
        </div>
      }
      @if (collapsed() && plan && usagePercent > 80) {
        <div class="usage-dot-wrap" [title]="'Uso al ' + usagePercent + '%'">
          <div class="usage-dot"></div>
        </div>
      }
    </aside>

    <!-- Upgrade toast -->
    @if (showUpgradeToast()) {
      <div class="upgrade-toast" (click)="showUpgradeToast.set(false)">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
        </svg>
        <div>
          <strong>Módulo no disponible</strong>
          <span>Actualiza tu plan para acceder a <em>{{ lockedItemLabel() }}</em></span>
        </div>
        <a routerLink="/settings/billing" class="upgrade-btn" (click)="showUpgradeToast.set(false)">Ver planes</a>
      </div>
    }

    <!-- Icon templates -->
    <ng-template #iconTpl let-id="id">
      @switch (id) {
        @case ('dashboard') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
          </svg>
        }
        @case ('invoice') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
          </svg>
        }
        @case ('inventory') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
          </svg>
        }
        @case ('customers') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
          </svg>
        }
        @case ('cartera') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
            <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
          </svg>
        }
        @case ('payroll') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
          </svg>
        }
        @case ('reports') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
          </svg>
        }
        @case ('import') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/>
          </svg>
        }
        @case ('pos') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
          </svg>
        }
        @case ('branches') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
          </svg>
        }
        @case ('settings') {
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
          </svg>
        }
      }
    </ng-template>
  `,
  styles: [`
    :host { display: flex; height: 100%; position: relative; }

    .sidebar {
      width: 256px; height: 100%;
      background:
        radial-gradient(circle at top left, rgba(0,198,160,0.14), transparent 24%),
        radial-gradient(circle at bottom right, rgba(59,130,246,0.12), transparent 28%),
        linear-gradient(180deg, #08172c 0%, #0c1c35 48%, #0f2341 100%);
      display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
      transition: width 0.24s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease;
      box-shadow: inset -1px 0 0 rgba(255,255,255,0.04);
    }
    .sidebar.collapsed { width: 64px; }

    .sidebar-brand {
      display: flex; align-items: center; gap: 10px;
      position: relative;
      padding: 0 14px; height: 72px; min-height: 72px;
      border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
    }
    .sidebar.collapsed .sidebar-brand { justify-content: center; padding: 0; }
    .sidebar-brand::after {
      content: '';
      position: absolute;
      inset: auto 14px 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    }
    .brand-logo {
      width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, rgba(0,198,160,0.18), rgba(59,130,246,0.18));
      border: 1px solid rgba(125,211,252,0.24);
      box-shadow: 0 10px 24px rgba(0,0,0,0.18);
      display: flex; align-items: center; justify-content: center;
    }
    .brand-text { flex: 1; min-width: 0; }
    .brand-name { display: block; font-family: 'Sora',sans-serif; font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; letter-spacing: -.02em; }
    .brand-sub  { display: block; font-size: 10px; color: #6ea6dd; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 2px; }

    .collapse-btn {
      display: flex; align-items: center; justify-content: center;
      width: 30px; height: 30px; background: rgba(255,255,255,0.04); border: none;
      border-radius: 8px; color: #6ea6dd; cursor: pointer;
      transition: background 0.15s, color 0.15s, transform 0.15s; flex-shrink: 0; margin-left: auto;
    }
    .collapse-btn:hover { background: rgba(255,255,255,0.1); color: #d4e4f7; transform: translateY(-1px); }
    .sidebar.collapsed .collapse-btn {
      margin: 0; width: 36px; height: 36px; border-radius: 8px;
      border: 1px solid rgba(0,198,160,0.25);
      background: rgba(0,198,160,0.08); color: #00c6a0;
    }
    .sidebar.collapsed .collapse-btn:hover { background: rgba(0,198,160,0.18); }

    .company-info {
      display: flex; align-items: center; gap: 12px; padding: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
    }
    .company-info--center { justify-content: center; padding: 12px 0; }
    .company-avatar {
      width: 38px; height: 38px; min-width: 38px; border-radius: 12px;
      background: linear-gradient(135deg,#1a407e,#00c6a0);
      color: #fff; font-family: 'Sora',sans-serif; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 10px 24px rgba(0,0,0,0.18);
    }
    .company-details {
      min-width: 0; flex: 1;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
    }
    .company-name { font-size: 13px; font-weight: 600; color: #d4e4f7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .plan-badge { display: inline-block; margin-top: 3px; padding: 1px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; }
    .plan-basic       { background: rgba(59,130,246,0.2);  color: #93c5fd; }
    .plan-empresarial { background: rgba(0,198,160,0.2);   color: #5eead4; }
    .plan-corporativo { background: rgba(245,158,11,0.2);  color: #fcd34d; }
    .plan-free        { background: rgba(100,116,139,0.2); color: #94a3b8; }
    .plan-starter  { background: rgba(59,130,246,0.2);  color: #93c5fd; }
    .plan-pro      { background: rgba(0,198,160,0.2);   color: #5eead4; }
    .plan-business { background: rgba(245,158,11,0.2);  color: #fcd34d; }
    .plan-free     { background: rgba(156,163,175,0.2); color: #9ca3af; }

    .sidebar-nav { flex: 1; padding: 10px 8px; overflow-y: auto; overflow-x: hidden; }
    .sidebar-nav::-webkit-scrollbar { width: 3px; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .nav-section-label {
      padding: 10px 10px 6px;
      font-size: 10px; font-weight: 800; color: #4f77a4; letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .nav-item {
      position: relative;
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; margin-bottom: 4px; border-radius: 12px;
      color: #7ea3cc; text-decoration: none; min-height: 40px;
      transition: background 0.15s, color 0.15s, transform 0.15s, border-color 0.15s;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .nav-item.nav-item--collapsed { justify-content: center; padding: 9px 0; gap: 0; }
    .nav-item:hover   { background: rgba(255,255,255,0.06); color: #d4e4f7; transform: translateX(2px); }
    .nav-item.active  {
      background: linear-gradient(135deg, rgba(0,198,160,0.16), rgba(59,130,246,0.12));
      color: #9ef7df;
      border-color: rgba(0,198,160,0.22);
      box-shadow: inset 3px 0 0 #00c6a0, 0 10px 22px rgba(0,0,0,0.12);
    }
    .nav-item.active.nav-item--collapsed { box-shadow: none; border: 1px solid rgba(0,198,160,0.3); }

    .nav-item--locked { opacity: 0.45; cursor: pointer; transition: opacity 0.15s, background 0.15s; }
    .nav-item--locked:hover { opacity: 0.7; background: rgba(245,158,11,0.07); color: #fcd34d; }
    .nav-icon--locked { color: #64748b; }
    .lock-chip {
      display: inline-flex; align-items: center; gap: 3px; margin-left: auto;
      font-size: 9.5px; font-weight: 700; background: rgba(245,158,11,0.15);
      color: #f59e0b; padding: 2px 7px; border-radius: 99px; white-space: nowrap;
    }

    .nav-icon {
      display: flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; min-width: 18px; flex-shrink: 0; color: inherit;
      transition: transform 0.15s ease;
    }
    .nav-item:hover .nav-icon { transform: scale(1.05); }
    .nav-label { flex: 1; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .plan-section {
      margin: 0 8px 6px; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px;
      overflow: hidden; background: rgba(255,255,255,0.03); flex-shrink: 0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    }
    .plan-section-header {
      display: flex; align-items: center; gap: 6px; padding: 10px 12px;
      font-size: 10px; font-weight: 800; color: #4f77a4; letter-spacing: 0.12em;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .plan-features-list { padding: 6px 10px 8px; }
    .plan-feat-row { display: flex; align-items: center; gap: 7px; padding: 3px 0; font-size: 12px; color: #7ea3cc; }
    .plan-feat-row.feat-off { opacity: 0.4; }
    .feat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .feat-dot--on  { background: #00c6a0; box-shadow: 0 0 6px rgba(0,198,160,0.5); }
    .feat-dot--off { background: #ef4444; }
    .feat-name  { flex: 1; font-size: 11.5px; }
    .feat-limit { font-size: 11px; font-weight: 700; color: #00c6a0; background: rgba(0,198,160,0.12); padding: 1px 6px; border-radius: 4px; }

    .usage-section {
      margin: 0 8px 8px;
      padding: 12px 14px 14px;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      flex-shrink: 0;
    }
    .usage-header  { display: flex; justify-content: space-between; margin-bottom: 7px; }
    .usage-label   { font-size: 11px; color: #4d7ab3; font-weight: 600; }
    .usage-pct     { font-size: 11px; color: #4d7ab3; font-weight: 700; }
    .usage-pct.high { color: #f87171; }
    .usage-track { background: rgba(255,255,255,0.07); border-radius: 9999px; height: 5px; overflow: hidden; }
    .usage-fill  { height: 100%; border-radius: 9999px; background: linear-gradient(90deg,#1a407e,#00c6a0); transition: width 0.5s ease; }
    .usage-fill.high { background: linear-gradient(90deg,#f59e0b,#ef4444); }
    .usage-warn  { font-size: 11px; color: #f87171; margin-top: 6px; }
    .usage-dot-wrap { display: flex; justify-content: center; padding: 8px 0 12px; }
    .usage-dot { width: 8px; height: 8px; border-radius: 50%; background: #f87171; animation: pulse-dot 2s ease infinite; }
    @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

    .mobile-close-btn {
      display: none; align-items: center; justify-content: center;
      width: 34px; height: 34px; background: rgba(255,255,255,0.08);
      border: none; border-radius: 7px; color: #7ea3cc; cursor: pointer;
      margin-left: auto; flex-shrink: 0; transition: background 0.15s;
    }
    .mobile-close-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }

    @media (max-width: 768px) {
      :host { position: fixed; top: 0; left: 0; height: 100%; z-index: 200; }
      .sidebar {
        position: fixed; top: 0; left: 0; height: 100%;
        transform: translateX(-100%);
        transition: transform 0.27s cubic-bezier(0.4,0,0.2,1);
        width: 260px !important;
        box-shadow: 4px 0 32px rgba(0,0,0,0.35);
      }
      .sidebar.mobile-open { transform: translateX(0); }
      .sidebar.collapsed   { width: 260px !important; }
      .collapse-btn        { display: none; }
      .mobile-close-btn    { display: flex; }
      .nav-item.nav-item--collapsed { justify-content: flex-start !important; padding: 9px 10px !important; gap: 10px !important; }
      .sidebar.collapsed .sidebar-brand  { justify-content: flex-start; padding: 0 12px; }
      .sidebar.collapsed .company-info   { justify-content: flex-start; padding: 12px 14px; }
    }

    .upgrade-toast {
      position: fixed; bottom: 24px; left: 64px; z-index: 9999;
      display: flex; align-items: center; gap: 12px;
      background: #1e2d47; border: 1px solid rgba(245,158,11,0.3);
      border-radius: 12px; padding: 12px 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: slideUp 0.25s ease; max-width: 340px;
    }
    @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .upgrade-toast svg  { color: #f59e0b; flex-shrink: 0; }
    .upgrade-toast div  { flex: 1; }
    .upgrade-toast strong { display: block; font-size: 13px; color: #f0f7ff; font-weight: 700; margin-bottom: 2px; }
    .upgrade-toast span   { font-size: 12px; color: #7ea3cc; }
    .upgrade-toast em     { font-style: normal; color: #fcd34d; font-weight: 600; }
    .upgrade-btn {
      display: inline-block; padding: 6px 12px; border-radius: 8px;
      background: rgba(245,158,11,0.2); color: #f59e0b;
      font-size: 12px; font-weight: 700; text-decoration: none;
      border: 1px solid rgba(245,158,11,0.3); white-space: nowrap; transition: background 0.15s;
    }
    .upgrade-btn:hover { background: rgba(245,158,11,0.35); }
    .nav-section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
      margin: 8px 8px;
    }
  `],
})
export class SidebarComponent {
  @Input() user!: User;
  @Input() plan: PlanInfo = null;
  @Input() isSuperAdmin  = false;
  @Input() usagePercent  = 0;
  @Input() mobileOpen    = false;
  @Output() mobileClose  = new EventEmitter<void>();

  collapsed        = signal(false);
  showUpgradeToast = signal(false);
  lockedItemLabel  = signal('');

  private auth = inject(AuthService);
  private get featureMap(): Record<string, string> { return this.auth.planFeatures(); }
  private toastTimer: any;

  toggleCollapse(): void { this.collapsed.update(v => !v); }

  companyInitials(): string {
    const name = this.user?.company?.name ?? '';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'BF';
  }

  navItems(): NavItem[] {
  return NAV_ITEMS.filter(item => {
    if (!item.roles) return true;
    if (this.isSuperAdmin) return true;
    const userRoles = this.user?.roles ?? [];
    return item.roles.some(r => userRoles.includes(r));
  });
}

  isItemEnabled(item: NavItem): boolean {
    if (!item.feature) return true;
    if (this.isSuperAdmin) return true;
    const val = this.featureMap[item.feature];
    return val !== undefined && val !== 'false' && val !== '0';
  }

  onLockedClick(item: NavItem): void {
    this.lockedItemLabel.set(item.label);
    this.showUpgradeToast.set(true);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.showUpgradeToast.set(false), 4000);
  }

  planFeatureList(): Array<{ key: string; label: string; enabled: boolean; isBoolean: boolean; value: string }> {
    if (!this.plan) return [];
    const BOOL_KEYS = ['has_invoices','has_inventory','has_cartera','has_payroll','has_pos','has_reports','has_integrations','bulk_import','dian_enabled','priority_support'];
    const NUM_KEYS  = ['max_products','max_customers','max_users','max_support_tickets'];
    return [...BOOL_KEYS, ...NUM_KEYS]
      .filter(k => FEATURE_LABELS[k] && this.featureMap[k] !== undefined)
      .map(k => {
        const val       = this.featureMap[k] ?? 'false';
        const isBoolean = BOOL_KEYS.includes(k);
        const enabled   = isBoolean ? (val === 'true') : (val !== '0');
        return { key: k, label: FEATURE_LABELS[k], enabled, isBoolean, value: val };
      });
  }


navSections(): Array<{ label: string; items: NavItem[] }> {
  const items = this.navItems();
  const sections: Array<{ label: string; items: NavItem[] }> = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = item.section ?? 'MENÚ PRINCIPAL';
    if (!seen.has(key)) {
      seen.add(key);
      sections.push({ label: key, items: [] });
    }
    sections.find(s => s.label === key)!.items.push(item);
  }
  return sections;
}
}
