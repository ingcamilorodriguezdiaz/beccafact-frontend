import { Component, Input, OnChanges, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { User } from '../../../core/auth/auth.service';

export type PlanInfo = {
  id: string; name: string; displayName: string;
  features: Array<{ key: string; value: string }>;
} | null;

export interface NavItem {
  label: string;
  iconId: string;
  route: string;
  feature?: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     iconId: 'dashboard', route: '/dashboard' },
  { label: 'Facturación',   iconId: 'invoice',   route: '/invoices',  feature: 'has_invoices' },
  { label: 'Inventario',    iconId: 'inventory', route: '/inventory', feature: 'has_inventory' },
  { label: 'Clientes',      iconId: 'customers', route: '/customers' },
  { label: 'Reportes',      iconId: 'reports',   route: '/reports' },
  { label: 'Importar',      iconId: 'import',    route: '/import', feature: 'bulk_import', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Configuración', iconId: 'settings',  route: '/settings', roles: ['ADMIN'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">

      <!-- ── Brand ────────────────────────────────────────── -->
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
        <button class="collapse-btn" (click)="toggleCollapse()" type="button"
                [title]="collapsed() ? 'Expandir' : 'Colapsar'">
          @if (collapsed()) {
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
            </svg>
          } @else {
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
            </svg>
          }
        </button>
      </div>

      <!-- ── Company info ──────────────────────────────────── -->
      <div class="company-info" [class.company-info--center]="collapsed()">
        <div class="company-avatar" [title]="user.company?.name ?? 'Mi Empresa'">
          {{ companyInitials() }}
        </div>
        @if (!collapsed()) {
          <div class="company-details">
            <div class="company-name">{{ user.company?.name ?? 'Mi Empresa' }}</div>
            @if (plan) {
              <span class="plan-badge plan-{{ plan.name.toLowerCase() }}">
                {{ plan.displayName }}
              </span>
            }
          </div>
        }
      </div>

      <!-- ── Nav ──────────────────────────────────────────── -->
      <nav class="sidebar-nav">
        @if (!collapsed()) {
          <div class="nav-section-label">MENÚ PRINCIPAL</div>
        }

        @for (item of visibleItems(); track item.route) {
          <a [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
             class="nav-item"
             [class.nav-item--collapsed]="collapsed()"
             [class.locked]="!hasFeature(item.feature)"
             [title]="collapsed() ? item.label : (!hasFeature(item.feature) ? 'Requiere plan superior' : '')">

            <!-- ✅ SVGs inline con @switch — nunca [innerHTML] -->
            <span class="nav-icon">
              @switch (item.iconId) {
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
                @case ('settings') {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
                  </svg>
                }
              }
            </span>

            @if (!collapsed()) {
              <span class="nav-label">{{ item.label }}</span>
              @if (!hasFeature(item.feature)) {
                <svg class="lock-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                  <path d="M8 1a3 3 0 00-3 3v1H4a1 1 0 00-1 1v7a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1h-1V4a3 3 0 00-3-3zm0 2a1 1 0 011 1v1H7V4a1 1 0 011-1z"/>
                </svg>
              }
            }
          </a>
        }
      </nav>

      <!-- ── Usage meter (expandido) ──────────────────────── -->
      @if (!collapsed() && plan) {
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

      <!-- ── Usage dot (colapsado + uso alto) ─────────────── -->
      @if (collapsed() && plan && usagePercent > 80) {
        <div class="usage-dot-wrap" [title]="'Uso al ' + usagePercent + '%'">
          <div class="usage-dot"></div>
        </div>
      }

    </aside>
  `,
  styles: [`
    /* ── Contenedor ─────────────────────────────────────────── */
    :host { display: flex; height: 100%; }

    .sidebar {
      width: 248px;
      height: 100%;
      background: #0c1c35;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
      transition: width 0.24s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar.collapsed { width: 64px; }

    /* ── Brand ──────────────────────────────────────────────── */
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 12px;
      height: 64px;
      min-height: 64px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .sidebar.collapsed .sidebar-brand {
      justify-content: center;
      padding: 0;
    }

    .brand-logo {
      width: 36px; height: 36px;
      border-radius: 9px;
      background: rgba(0,198,160,0.12);
      border: 1px solid rgba(0,198,160,0.22);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .brand-text { flex: 1; min-width: 0; }

    .brand-name {
      display: block;
      font-family: 'Sora', sans-serif;
      font-size: 15px; font-weight: 700;
      color: #fff; white-space: nowrap;
    }

    .brand-sub {
      display: block; font-size: 10px; color: #4d7ab3;
      letter-spacing: 0.1em; text-transform: uppercase;
    }

    .collapse-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      background: none; border: none; border-radius: 6px;
      color: #4d7ab3; cursor: pointer;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
      margin-left: auto;
    }

    .collapse-btn:hover { background: rgba(255,255,255,0.08); color: #7ea3cc; }

    .sidebar.collapsed .collapse-btn {
      margin: 0;
      width: 36px; height: 36px;
      border-radius: 8px;
      border: 1px solid rgba(0,198,160,0.25);
      background: rgba(0,198,160,0.08);
      color: #00c6a0;
    }

    .sidebar.collapsed .collapse-btn:hover { background: rgba(0,198,160,0.18); }

    /* ── Company info ───────────────────────────────────────── */
    .company-info {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .company-info--center { justify-content: center; padding: 12px 0; }

    .company-avatar {
      width: 34px; height: 34px; min-width: 34px;
      border-radius: 8px;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      color: #fff; font-family: 'Sora', sans-serif;
      font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    .company-details { min-width: 0; flex: 1; }

    .company-name {
      font-size: 13px; font-weight: 600; color: #d4e4f7;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .plan-badge {
      display: inline-block; margin-top: 3px;
      padding: 1px 8px; border-radius: 9999px;
      font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    }

    .plan-basic               { background: rgba(59,130,246,0.2);  color: #93c5fd; }
    .plan-empresarial         { background: rgba(0,198,160,0.2);   color: #5eead4; }
    .plan-corporativo         { background: rgba(245,158,11,0.2);  color: #fcd34d; }

    /* ── Nav ────────────────────────────────────────────────── */
    .sidebar-nav {
      flex: 1;
      padding: 8px;
      overflow-y: auto; overflow-x: hidden;
    }

    .sidebar-nav::-webkit-scrollbar { width: 3px; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

    .nav-section-label {
      padding: 8px 10px 4px;
      font-size: 10px; font-weight: 700;
      color: #2e4a6e; letter-spacing: 0.12em;
    }

    /* ── Nav item ───────────────────────────────────────────── */
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 10px;
      margin-bottom: 2px;
      border-radius: 8px;
      color: #7ea3cc;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
      min-height: 40px;
      /* SIN overflow:hidden aquí — es lo que ocultaba los iconos */
    }

    /* Colapsado: centrar icono con padding simétrico */
    .nav-item.nav-item--collapsed {
      justify-content: center;
      padding: 9px 0;
      gap: 0;
    }

    .nav-item:hover                       { background: rgba(255,255,255,0.06); color: #d4e4f7; }
    .nav-item.active                      { background: rgba(0,198,160,0.16); color: #00c6a0; box-shadow: inset 3px 0 0 #00c6a0; }
    .nav-item.active.nav-item--collapsed  { box-shadow: none; border: 1px solid rgba(0,198,160,0.3); }
    .nav-item.locked                      { opacity: 0.4; pointer-events: none; }

    /* ── Icono ──────────────────────────────────────────────────
       min-width garantiza que flex nunca lo comprima a 0.
       Los SVGs son inline en el template, no [innerHTML],
       por eso siempre se renderizan correctamente.
    ─────────────────────────────────────────────────────────── */
    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      min-width: 18px;
      flex-shrink: 0;
      color: inherit;
    }

    .nav-label {
      flex: 1;
      font-size: 14px; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .lock-icon { flex-shrink: 0; opacity: 0.5; }

    /* ── Usage ──────────────────────────────────────────────── */
    .usage-section {
      padding: 12px 14px 16px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }

    .usage-header { display: flex; justify-content: space-between; margin-bottom: 7px; }
    .usage-label  { font-size: 11px; color: #4d7ab3; font-weight: 600; }
    .usage-pct    { font-size: 11px; color: #4d7ab3; font-weight: 700; }
    .usage-pct.high { color: #f87171; }

    .usage-track { background: rgba(255,255,255,0.07); border-radius: 9999px; height: 5px; overflow: hidden; }
    .usage-fill  { height: 100%; border-radius: 9999px; background: linear-gradient(90deg, #1a407e, #00c6a0); transition: width 0.5s ease; }
    .usage-fill.high { background: linear-gradient(90deg, #f59e0b, #ef4444); }
    .usage-warn  { font-size: 11px; color: #f87171; margin-top: 6px; }

    .usage-dot-wrap { display: flex; justify-content: center; padding: 10px 0 14px; }
    .usage-dot { width: 8px; height: 8px; border-radius: 50%; background: #f87171; animation: pulse-dot 2s ease infinite; }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.8); }
    }
  `],
})
export class SidebarComponent implements OnChanges {
  @Input() user!: User;
  @Input() plan: PlanInfo = null;
  @Input() isSuperAdmin = false;
  @Input() usagePercent = 0;

  collapsed = signal(false);
  private featureMap: Record<string, string> = {};

  ngOnChanges(): void {
    this.featureMap = {};
    if (this.plan?.features) {
      for (const f of this.plan.features) {
        this.featureMap[f.key] = f.value;
      }
    }
  }

  toggleCollapse(): void {
    this.collapsed.update(v => !v);
  }

  companyInitials(): string {
    const name = this.user?.company?.name ?? '';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'BF';
  }

  visibleItems(): NavItem[] {
    console.log("edfsdf",NAV_ITEMS);
    return NAV_ITEMS.filter(item => {
      if (!item.roles) return true;
      if (this.isSuperAdmin) return true;
      const userRoles = this.user?.roles ?? [];
      return item.roles.some(r => userRoles.includes(r));
    });
  }

  hasFeature(featureKey?: string): boolean {
    if (!featureKey) return true;
    if (this.isSuperAdmin) return true;
    const val = this.featureMap[featureKey];
    return val !== undefined && val !== 'false' && val !== '0';
  }
}