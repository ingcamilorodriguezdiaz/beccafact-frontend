import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { GlobalLoaderComponent } from '../../shared/components/global-loader/global-loader.component';

interface SANavItem { label: string; route: string; icon: string; }

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ToastComponent, GlobalLoaderComponent],
  template: `
    <div class="sa-layout">
      <app-global-loader />

      <!-- SA Sidebar -->
      <aside class="sa-sidebar">
        <div class="sa-brand">
          <div class="sa-logo">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 17L8 10L13 14L17 8L21 12" stroke="#00c6a0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="sa-brand-info">
            <div class="sa-brand-name">BeccaFact</div>
            <div class="sa-brand-badge">SUPER ADMIN</div>
          </div>
        </div>

        <nav class="sa-nav">
          <div class="sa-nav-label">PANEL GLOBAL</div>
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="sa-active" class="sa-nav-item">
              <span class="sa-nav-icon" [innerHTML]="item.icon"></span>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="sa-sidebar-footer">
          <div class="sa-user-row">
            <div class="sa-user-avatar">
              {{ (auth.user()?.firstName?.[0] ?? '') + (auth.user()?.lastName?.[0] ?? '') }}
            </div>
            <div class="sa-user-info">
              <div class="sa-user-name">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</div>
              <div class="sa-user-role">Super Administrador</div>
            </div>
          </div>
          <button (click)="auth.logout()" class="sa-logout" type="button">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/></svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Main -->
      <main class="sa-main">
        <!-- Topbar -->
        <div class="sa-topbar">
          <div class="sa-topbar-left">
            <div class="sa-mode-badge">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M5 4a1 1 0 011-1h4a1 1 0 011 1v1h1a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2h1V4zm3 5a1 1 0 100 2 1 1 0 000-2z"/></svg>
              Modo Super Admin
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
    .sa-layout { display: flex; height: 100vh; overflow: hidden; background: #f0f4f9; }

    /* Sidebar */
    .sa-sidebar {
      width: 240px; min-width: 240px; background: #0c1c35;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .sa-brand {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .sa-logo {
      width: 38px; height: 38px; border-radius: 10px;
      background: rgba(0,198,160,0.12); border: 1px solid rgba(0,198,160,0.2);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sa-logo svg { width: 22px; height: 22px; }
    .sa-brand-name {
      font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: #fff;
    }
    .sa-brand-badge {
      font-size: 9px; font-weight: 800; letter-spacing: 0.12em;
      color: #00c6a0; background: rgba(0,198,160,0.15);
      padding: 2px 7px; border-radius: 4px; margin-top: 3px;
      display: inline-block;
    }

    .sa-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
    .sa-nav-label {
      padding: 8px 8px 4px; font-size: 9.5px; font-weight: 800;
      color: #2e4a6e; letter-spacing: 0.14em;
    }
    .sa-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; margin-bottom: 2px;
      color: #5a80a8; text-decoration: none; border-radius: 8px;
      font-size: 13.5px; font-weight: 500; transition: all 0.15s;
    }
    .sa-nav-item:hover { background: rgba(255,255,255,0.055); color: #d4e4f7; }
    .sa-nav-item.sa-active {
      background: rgba(0,198,160,0.15); color: #00c6a0;
      box-shadow: inset 3px 0 0 #00c6a0;
    }
    .sa-nav-icon {
      width: 17px; height: 17px; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
    }
    ::ng-deep .sa-nav-icon svg { width: 17px; height: 17px; }

    /* Footer */
    .sa-sidebar-footer {
      padding: 16px; border-top: 1px solid rgba(255,255,255,0.07);
      display: flex; flex-direction: column; gap: 10px;
    }
    .sa-user-row { display: flex; align-items: center; gap: 10px; }
    .sa-user-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      color: #fff; font-family: 'Sora', sans-serif;
      font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      text-transform: uppercase;
    }
    .sa-user-name { font-size: 12.5px; font-weight: 600; color: #d4e4f7; }
    .sa-user-role { font-size: 11px; color: #4d7ab3; }
    .sa-logout {
      display: flex; align-items: center; gap: 8px; width: 100%;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      color: #5a80a8; padding: 8px 12px; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s;
    }
    .sa-logout:hover { background: rgba(239,68,68,0.12); color: #f87171; border-color: rgba(239,68,68,0.2); }

    /* Main */
    .sa-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .sa-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; background: #fff; border-bottom: 1px solid #dce6f0;
      height: 50px; box-shadow: 0 1px 4px rgba(12,28,53,0.05);
    }
    .sa-mode-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #f0f4f9; color: #3d5a80;
      padding: 4px 12px; border-radius: 9999px;
      font-size: 12.5px; font-weight: 700; border: 1px solid #dce6f0;
    }
    .sa-topbar-date { font-size: 12px; color: #9ab5cc; }

    .sa-content { flex: 1; overflow-y: auto; padding: 28px; }
  `],
})
export class SuperAdminLayoutComponent {
  today = new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  navItems: SANavItem[] = [
    { label: 'Dashboard',   route: 'dashboard',  icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/></svg>` },
    { label: 'Empresas',    route: 'companies',  icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/></svg>` },
    { label: 'Planes',      route: 'plans',      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>` },
    { label: 'Auditoría',   route: 'audit',      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>` },
    { label: 'Plantilla',   route: 'template',   icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/></svg>` },
  ];

  constructor(protected auth: AuthService) {}
}
