import { Component, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { GlobalLoaderComponent } from '../../shared/components/global-loader/global-loader.component';

interface SANavItem { label: string; route: string; iconId: string; }

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, NgTemplateOutlet, ToastComponent, GlobalLoaderComponent],
  template: `
    <div class="sa-layout">
      <app-global-loader />

      <!-- ── Mobile overlay ───────────────────────────────────────── -->
      @if (mobileOpen()) {
        <div class="sa-overlay" (click)="closeMobile()"></div>
      }

      <!-- ── Sidebar ──────────────────────────────────────────────── -->
      <aside class="sa-sidebar"
             [class.collapsed]="collapsed()"
             [class.mobile-open]="mobileOpen()">

        <!-- Brand -->
        <div class="sa-brand">
          <div class="sa-logo">
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <path d="M3 17L8 10L13 14L17 8L21 12"
                    stroke="#00c6a0" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          @if (!collapsed()) {
            <div class="sa-brand-info">
              <div class="sa-brand-name">BeccaFact</div>
              <div class="sa-brand-badge">SUPER ADMIN</div>
            </div>
          }
          <button class="sa-collapse-btn" (click)="toggleCollapse()" type="button"
                  [title]="collapsed() ? 'Expandir' : 'Colapsar'">
            @if (collapsed()) {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
              </svg>
            } @else {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
              </svg>
            }
          </button>
        </div>

        <!-- Nav -->
        <nav class="sa-nav">
          @if (!collapsed()) {
            <div class="sa-nav-label">PANEL GLOBAL</div>
          }
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route"
               routerLinkActive="sa-active"
               class="sa-nav-item"
               [class.collapsed-item]="collapsed()"
               (click)="closeMobile()">
              <span class="sa-nav-icon">
                <ng-container *ngTemplateOutlet="iconTpl; context: { id: item.iconId }"/>
              </span>
              @if (!collapsed()) {
                <span class="sa-nav-label-text">{{ item.label }}</span>
              } @else {
                <span class="sa-nav-tooltip">{{ item.label }}</span>
              }
            </a>
          }
        </nav>

        <!-- Footer -->
        <div class="sa-sidebar-footer" [class.footer-collapsed]="collapsed()">
          @if (!collapsed()) {
            <div class="sa-user-row">
              <div class="sa-user-avatar">
                {{ (auth.user()?.firstName?.[0] ?? '') + (auth.user()?.lastName?.[0] ?? '') }}
              </div>
              <div class="sa-user-info">
                <div class="sa-user-name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</div>
                <div class="sa-user-role">Super Administrador</div>
              </div>
            </div>
          } @else {
            <div class="sa-user-avatar sa-user-avatar--center"
                 [title]="(auth.user()?.firstName ?? '') + ' ' + (auth.user()?.lastName ?? '')">
              {{ (auth.user()?.firstName?.[0] ?? '') + (auth.user()?.lastName?.[0] ?? '') }}
            </div>
          }
          <button (click)="auth.logout()" class="sa-logout"
                  [class.logout-collapsed]="collapsed()" type="button"
                  [title]="collapsed() ? 'Cerrar sesión' : ''">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/>
            </svg>
            @if (!collapsed()) { <span>Cerrar sesión</span> }
          </button>
        </div>
      </aside>

      <!-- ── Icon templates ──────────────────────────────────────── -->
      <ng-template #iconTpl let-id="id">
        @switch (id) {
          @case ('dashboard') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
            </svg>
          }
          @case ('companies') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
            </svg>
          }
          @case ('plans') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
              <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
            </svg>
          }
          @case ('audit') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
            </svg>
          }
          @case ('template') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/>
            </svg>
          }
          @case ('users') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
            </svg>
          }
          @case ('banks') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/>
            </svg>
          }
          @case ('parameters') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
            </svg>
          }
          @case ('integrations') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"/>
            </svg>
          }
        }
      </ng-template>

      <!-- ── Main ─────────────────────────────────────────────────── -->
      <main class="sa-main">

        <!-- Topbar -->
        <div class="sa-topbar">
          <div class="sa-topbar-left">
            <!-- Hamburger (mobile only) -->
            <button class="sa-hamburger" (click)="openMobile()" type="button" aria-label="Abrir menú">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20">
                <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
              </svg>
            </button>
            <div class="sa-mode-badge">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12">
                <path fill-rule="evenodd" d="M5 4a1 1 0 011-1h4a1 1 0 011 1v1h1a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2h1V4zm3 5a1 1 0 100 2 1 1 0 000-2z"/>
              </svg>
              <span class="badge-text">Modo Super Admin</span>
            </div>
          </div>
          <div class="sa-topbar-right">
            <span class="sa-topbar-date">{{ today }}</span>
          </div>
        </div>

        <!-- Content -->
        <div class="sa-content">
          <router-outlet />
        </div>
      </main>

      <app-toast />
    </div>
  `,
  styles: [`
    /* ── Layout shell ────────────────────────────────────────────── */
    .sa-layout {
      display: flex; height: 100vh; overflow: hidden; background: #f0f4f9;
    }

    /* ── Mobile overlay ──────────────────────────────────────────── */
    .sa-overlay {
      position: fixed; inset: 0; background: rgba(12,28,53,.55);
      z-index: 299; backdrop-filter: blur(2px);
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    /* ── Sidebar ─────────────────────────────────────────────────── */
    .sa-sidebar {
      width: 240px; min-width: 240px; background: #0c1c35;
      display: flex; flex-direction: column; overflow: hidden;
      flex-shrink: 0; z-index: 300;
      transition: width .22s cubic-bezier(.4,0,.2,1);
    }
    .sa-sidebar.collapsed { width: 64px; min-width: 64px; }

    /* Brand */
    .sa-brand {
      display: flex; align-items: center; gap: 10px;
      padding: 0 12px; height: 64px; min-height: 64px;
      border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0;
    }
    .sa-sidebar.collapsed .sa-brand { justify-content: center; padding: 0; }
    .sa-logo {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      background: rgba(0,198,160,.12); border: 1px solid rgba(0,198,160,.22);
      display: flex; align-items: center; justify-content: center;
    }
    .sa-brand-name { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#fff; }
    .sa-brand-badge {
      font-size:9px; font-weight:800; letter-spacing:.12em; color:#00c6a0;
      background:rgba(0,198,160,.15); padding:2px 7px; border-radius:4px;
      margin-top:3px; display:inline-block;
    }
    .sa-collapse-btn {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; background: none; border: none;
      border-radius: 6px; color: #4d7ab3; cursor: pointer;
      transition: background .15s, color .15s; flex-shrink: 0; margin-left: auto;
    }
    .sa-collapse-btn:hover { background: rgba(255,255,255,.08); color: #7ea3cc; }
    .sa-sidebar.collapsed .sa-collapse-btn {
      margin: 0; width: 36px; height: 36px; border-radius: 8px;
      border: 1px solid rgba(0,198,160,.25);
      background: rgba(0,198,160,.08); color: #00c6a0;
    }
    .sa-sidebar.collapsed .sa-collapse-btn:hover { background: rgba(0,198,160,.18); }

    /* Nav */
    .sa-nav { flex: 1; padding: 10px 8px; overflow-y: auto; overflow-x: hidden; }
    .sa-nav::-webkit-scrollbar { width: 3px; }
    .sa-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }
    .sa-nav-label {
      padding: 8px 10px 4px; font-size:9.5px; font-weight:800;
      color: #2e4a6e; letter-spacing:.14em;
    }
    .sa-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; margin-bottom: 2px; border-radius: 8px;
      color: #5a80a8; text-decoration: none; min-height: 40px;
      font-size: 13.5px; font-weight: 500;
      transition: background .15s, color .15s;
    }
    .sa-nav-item.collapsed-item {
      justify-content: center; padding: 10px 0; gap: 0;
      position: relative;
    }
    .sa-nav-item:hover { background: rgba(255,255,255,.06); color: #d4e4f7; }
    .sa-nav-item.sa-active {
      background: rgba(0,198,160,.15); color: #00c6a0;
      box-shadow: inset 3px 0 0 #00c6a0;
    }
    .sa-nav-item.sa-active.collapsed-item { box-shadow: none; border: 1px solid rgba(0,198,160,.3); }

    /* Icon wrapper — SVG inline, hereda color del padre */
    .sa-nav-icon {
      width: 18px; height: 18px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; color: inherit;
    }
    .sa-nav-icon svg { width: 18px; height: 18px; color: inherit; }

    /* Collapsed icon button area — bigger hit target */
    .sa-sidebar.collapsed .sa-nav-item {
      width: 44px; height: 44px; margin: 2px auto; padding: 0;
      justify-content: center; align-items: center; border-radius: 10px;
    }

    /* Tooltip label shown on hover when collapsed */
    .sa-nav-item.collapsed-item .sa-nav-tooltip {
      display: none;
      position: absolute; left: calc(100% + 12px); top: 50%;
      transform: translateY(-50%);
      background: #1e2d47; color: #d4e4f7;
      font-size: 12px; font-weight: 600; white-space: nowrap;
      padding: 5px 10px; border-radius: 7px;
      border: 1px solid rgba(255,255,255,.1);
      box-shadow: 0 4px 14px rgba(0,0,0,.3);
      pointer-events: none; z-index: 400;
    }
    .sa-nav-item.collapsed-item .sa-nav-tooltip::before {
      content: ''; position: absolute; right: 100%; top: 50%;
      transform: translateY(-50%);
      border: 5px solid transparent;
      border-right-color: #1e2d47;
    }
    .sa-nav-item.collapsed-item:hover .sa-nav-tooltip { display: block; }

    /* Footer */
    .sa-sidebar-footer {
      padding: 14px; border-top: 1px solid rgba(255,255,255,.07);
      display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;
    }
    .sa-sidebar-footer.footer-collapsed { padding: 12px 8px; align-items: center; }
    .sa-user-row { display: flex; align-items: center; gap: 10px; }
    .sa-user-avatar {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      background: linear-gradient(135deg,#1a407e,#00c6a0);
      color: #fff; font-family:'Sora',sans-serif; font-size:12px; font-weight:700;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }
    .sa-user-avatar--center { margin: 0 auto; }
    .sa-user-name { font-size:12.5px; font-weight:600; color:#d4e4f7; }
    .sa-user-role { font-size:11px; color:#4d7ab3; }
    .sa-logout {
      display: flex; align-items: center; gap: 8px; width: 100%;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      color: #5a80a8; padding: 8px 12px; border-radius: 8px;
      cursor: pointer; font-size:13px; font-weight:600; transition: all .15s;
    }
    .sa-logout.logout-collapsed { justify-content: center; padding: 8px; }
    .sa-logout:hover { background: rgba(239,68,68,.12); color: #f87171; border-color: rgba(239,68,68,.2); }

    /* ── Main ────────────────────────────────────────────────────── */
    .sa-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

    /* Topbar */
    .sa-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; background: #fff; border-bottom: 1px solid #dce6f0;
      height: 56px; min-height: 56px; box-shadow: 0 1px 4px rgba(12,28,53,.05);
      flex-shrink: 0;
    }
    .sa-topbar-left { display: flex; align-items: center; gap: 12px; }
    .sa-hamburger {
      display: none; /* hidden on desktop */
      align-items: center; justify-content: center;
      width: 36px; height: 36px; background: #f0f4f9; border: 1px solid #dce6f0;
      border-radius: 8px; color: #374151; cursor: pointer; transition: all .15s;
    }
    .sa-hamburger:hover { background: #e8eef8; color: #1a407e; }
    .sa-mode-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #f0f4f9; color: #3d5a80;
      padding: 5px 12px; border-radius: 9999px;
      font-size: 12.5px; font-weight: 700; border: 1px solid #dce6f0;
    }
    .sa-topbar-date { font-size:12px; color:#9ab5cc; white-space: nowrap; }

    /* Content */
    .sa-content { flex: 1; overflow-y: auto; padding: 28px; }
    .sa-content::-webkit-scrollbar { width: 5px; }
    .sa-content::-webkit-scrollbar-thumb { background: #dce6f0; border-radius: 3px; }

    /* ── Responsive ──────────────────────────────────────────────── */
    @media (max-width: 768px) {
      /* Sidebar becomes off-canvas drawer */
      .sa-sidebar {
        position: fixed; top: 0; left: 0; height: 100dvh;
        transform: translateX(-100%);
        transition: transform .25s cubic-bezier(.4,0,.2,1);
        width: 260px !important; min-width: 260px !important;
      }
      .sa-sidebar.mobile-open { transform: translateX(0); }
      .sa-sidebar.collapsed { width: 260px !important; min-width: 260px !important; }

      /* Always show full content in mobile drawer */
      .sa-sidebar .sa-collapse-btn { display: none; }
      .sa-sidebar .sa-brand { padding: 0 16px; justify-content: flex-start; }
      .sa-sidebar .sa-logo { display: flex !important; }
      .sa-sidebar .sa-brand-info { display: block !important; }
      .sa-sidebar .sa-nav-label { display: block !important; }
      .sa-sidebar .sa-nav-item { justify-content: flex-start !important; padding: 10px 12px !important; gap: 10px !important; }
      .sa-sidebar .sa-nav-item span:last-child { display: inline !important; }
      .sa-sidebar .sa-user-row { display: flex !important; }
      .sa-sidebar .sa-user-info { display: block !important; }
      .sa-sidebar .sa-logout { justify-content: flex-start !important; padding: 8px 12px !important; }
      .sa-sidebar .sa-logout span { display: inline !important; }
      .sa-sidebar .footer-collapsed { align-items: stretch !important; }
      .sa-sidebar .sa-user-avatar--center { margin: 0 !important; }
      .sa-sidebar .sa-nav-item { box-shadow: none !important; }
      .sa-sidebar .sa-nav-item.sa-active { box-shadow: inset 3px 0 0 #00c6a0 !important; }

      /* Main takes full width */
      .sa-main { width: 100%; }
      .sa-hamburger { display: flex; }
      .sa-content { padding: 16px; }
      .sa-topbar { padding: 0 14px; height: 52px; min-height: 52px; }
      .badge-text { display: none; }
      .sa-topbar-date { font-size: 11px; }
    }
    @media (max-width: 480px) {
      .sa-content { padding: 12px; }
      .sa-topbar-date { display: none; }
    }
  `],
})
export class SuperAdminLayoutComponent {
  today = new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  collapsed  = signal(false);
  mobileOpen = signal(false);

  toggleCollapse() { this.collapsed.update(v => !v); }
  openMobile()     { this.mobileOpen.set(true); }
  closeMobile()    { this.mobileOpen.set(false); }

  // Close drawer on Escape key
  @HostListener('document:keydown.escape')
  onEscape() { this.mobileOpen.set(false); }

  navItems: SANavItem[] = [
    { label: 'Dashboard',    route: 'dashboard',    iconId: 'dashboard'    },
    { label: 'Empresas',     route: 'companies',    iconId: 'companies'    },
    { label: 'Planes',       route: 'plans',        iconId: 'plans'        },
    { label: 'Integraciones',route: 'integrations', iconId: 'integrations' },
    { label: 'Usuarios',     route: 'users',        iconId: 'users'        },
    { label: 'Bancos',       route: 'banks',        iconId: 'banks'        },
    { label: 'Parámetros',   route: 'parameters',   iconId: 'parameters'   },
    { label: 'Auditoría',    route: 'audit',        iconId: 'audit'        },
    { label: 'Plantilla',    route: 'template',     iconId: 'template'     },
  ];

  constructor(protected auth: AuthService) {}
}