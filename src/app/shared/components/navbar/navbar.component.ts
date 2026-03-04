import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="navbar">
      <div class="navbar-left">
        <!-- Hamburger (solo móvil) -->
        <button class="hamburger-btn" (click)="toggleMobileSidebar.emit()" type="button" aria-label="Abrir menú">
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
          </svg>
        </button>
        <div class="breadcrumb">
          <span class="breadcrumb-app hide-mobile-sm">BeccaFact</span>
          <svg class="hide-mobile-sm" viewBox="0 0 6 10" fill="none" width="6"><path d="M1 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="breadcrumb-page">{{ getPageTitle() }}</span>
        </div>
      </div>

      <div class="navbar-right">
        <!-- Upgrade pill -->
        @if (showUpgradeBanner()) {
          <a routerLink="/settings/billing" class="upgrade-pill">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13">
              <path d="M8 1.5a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5a.5.5 0 01.5-.5z"/>
            </svg>
            <span class="upgrade-text">Actualizar plan</span>
          </a>
        }

        <!-- Notifications -->
        <button class="icon-btn" title="Notificaciones" type="button">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
          </svg>
          <span class="notif-dot"></span>
        </button>

        <!-- User menu -->
        <div class="user-menu" (click)="toggleMenu()">
          <div class="user-avatar">{{ userInitials() }}</div>
          <div class="user-info hide-mobile">
            <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
            <span class="user-role">{{ roleLabel() }}</span>
          </div>
          <svg class="chevron hide-mobile" viewBox="0 0 20 20" fill="currentColor" width="14">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
          </svg>

          @if (menuOpen()) {
            <div class="dropdown" (click)="$event.stopPropagation()">
              <div class="dropdown-header">
                <div class="dh-name">{{ user.firstName }} {{ user.lastName }}</div>
                <div class="dh-email">{{ user.email }}</div>
              </div>
              <div class="dropdown-divider"></div>
              <a class="dropdown-item" routerLink="/settings" (click)="menuOpen.set(false)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                Mi perfil
              </a>
              <a class="dropdown-item" routerLink="/settings" (click)="menuOpen.set(false)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/></svg>
                Configuración
              </a>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" (click)="logout()" type="button">
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/></svg>
                Cerrar sesión
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .navbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; background: #fff; border-bottom: 1px solid #dce6f0;
      height: 58px; position: sticky; top: 0; z-index: 100;
      box-shadow: 0 1px 4px rgba(12,28,53,0.05); gap: 12px;
    }

    /* Hamburger (oculto en desktop) */
    .hamburger-btn {
      display: none; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: none; border: 1px solid #dce6f0;
      border-radius: 8px; cursor: pointer; color: #3d5a80; flex-shrink: 0;
      transition: all 0.15s;
    }
    .hamburger-btn:hover { background: #f0f4f9; color: #1a407e; }

    /* Breadcrumb */
    .navbar-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .breadcrumb {
      display: flex; align-items: center; gap: 8px;
      color: #9ab5cc; font-size: 14px; min-width: 0;
    }
    .breadcrumb svg { opacity: 0.5; flex-shrink: 0; }
    .breadcrumb-app { color: #3d5a80; font-weight: 600; white-space: nowrap; }
    .breadcrumb-page {
      font-family: var(--font-d, 'Sora', sans-serif);
      font-weight: 600; color: #0c1c35; font-size: 15px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Right */
    .navbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

    /* Upgrade pill */
    .upgrade-pill {
      display: inline-flex; align-items: center; gap: 5px;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      color: #fff; padding: 6px 14px; border-radius: 9999px;
      font-size: 12.5px; font-weight: 700; text-decoration: none;
      transition: opacity 0.15s, transform 0.15s;
      white-space: nowrap;
    }
    .upgrade-pill:hover { opacity: 0.9; transform: translateY(-1px); color: #fff; }

    /* Icon btn */
    .icon-btn {
      width: 36px; height: 36px; border-radius: 9px;
      background: none; border: 1px solid #dce6f0;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #7ea3cc; position: relative; transition: all 0.15s; flex-shrink: 0;
    }
    .icon-btn:hover { background: #f0f4f9; color: #1a407e; border-color: #c0d4e8; }
    .notif-dot {
      position: absolute; top: 7px; right: 7px;
      width: 7px; height: 7px; border-radius: 50%;
      background: #00c6a0; border: 2px solid #fff;
    }

    /* User menu */
    .user-menu {
      display: flex; align-items: center; gap: 9px; cursor: pointer;
      padding: 5px 10px 5px 6px; border-radius: 10px; border: 1px solid transparent;
      position: relative; user-select: none; transition: all 0.15s;
    }
    .user-menu:hover { background: #f0f4f9; border-color: #dce6f0; }
    .user-avatar {
      width: 34px; height: 34px; border-radius: 9px;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      color: #fff; font-family: var(--font-d,'Sora',sans-serif);
      font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; }
    .user-name { font-size: 13.5px; font-weight: 600; color: #0c1c35; white-space: nowrap; }
    .user-role { font-size: 11px; color: #7ea3cc; }
    .chevron { color: #9ab5cc; }

    /* Dropdown */
    .dropdown {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: #fff; border: 1px solid #dce6f0; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(12,28,53,0.13); min-width: 200px; padding: 6px;
      z-index: 300; animation: fadeSlideUp 0.15s ease;
    }
    @keyframes fadeSlideUp {
      from { opacity:0; transform:translateY(-6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .dropdown-header { padding: 10px 12px 8px; }
    .dh-name { font-size: 13px; font-weight: 700; color: #0c1c35; }
    .dh-email { font-size: 12px; color: #7ea3cc; margin-top: 1px; }
    .dropdown-divider { border: none; border-top: 1px solid #edf2f8; margin: 4px 0; }
    .dropdown-item {
      display: flex; align-items: center; gap: 9px; padding: 8px 12px;
      border-radius: 7px; font-size: 13.5px; color: #3d5a80; text-decoration: none;
      border: none; background: none; width: 100%; cursor: pointer; text-align: left;
      transition: all 0.12s;
    }
    .dropdown-item:hover { background: #f0f4f9; color: #0c1c35; }
    .dropdown-item.danger { color: #dc2626; }
    .dropdown-item.danger:hover { background: #fee2e2; }

    .hide-mobile { display: flex; flex-direction: column; }

    /* ── Responsive ──────────────────────────────────── */
    @media (max-width: 768px) {
      .navbar { padding: 0 14px; }
      .hamburger-btn { display: flex; }
    }
    @media (max-width: 640px) {
      .hide-mobile { display: none !important; }
      .upgrade-text { display: none; }
      .upgrade-pill { padding: 7px 10px; }
    }
    @media (max-width: 480px) {
      .navbar { padding: 0 10px; height: 52px; gap: 8px; }
      .breadcrumb-page { font-size: 14px; }
    }
    .hide-mobile-sm { display: initial; }
    @media (max-width: 480px) {
      .hide-mobile-sm { display: none; }
    }
  `],
})
export class NavbarComponent {
  @Input() user!: User;
  @Output() toggleMobileSidebar = new EventEmitter<void>();
  menuOpen = signal(false);

  constructor(private auth: AuthService) {}

  toggleMenu() { this.menuOpen.update(v => !v); }

  logout() { this.menuOpen.set(false); this.auth.logout(); }

  userInitials(): string {
    if (!this.user) return '?';
    return ((this.user.firstName?.[0] ?? '') + (this.user.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  showUpgradeBanner(): boolean {
    return this.auth.currentPlan()?.name === 'BASIC' || this.auth.currentPlan()?.name === 'basic';
  }

  roleLabel(): string {
    const r = this.user?.roles?.[0] ?? '';
    return { ADMIN: 'Administrador', USER: 'Usuario', SUPER_ADMIN: 'Super Admin' }[r] ?? r;
  }

  getPageTitle(): string {
    const url = window.location.pathname;
    const map: Record<string, string> = {
      '/dashboard': 'Dashboard', '/invoices': 'Facturación',
      '/inventory': 'Inventario', '/customers': 'Clientes',
      '/reports': 'Reportes', '/import': 'Importación',
      '/settings': 'Configuración',
    };
    return map[url] ?? 'Panel';
  }
}
