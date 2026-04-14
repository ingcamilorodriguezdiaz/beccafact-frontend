import { Component, signal, HostListener, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { GlobalLoaderComponent } from '../../shared/components/global-loader/global-loader.component';

interface SANavItem {
  label: string;
  route: string;
  iconId: string;
  section: string;
  caption: string;
}

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, NgTemplateOutlet, ToastComponent, GlobalLoaderComponent],
  template: `
    <div class="sa-layout">
      <app-global-loader />

      @if (mobileOpen()) {
        <div class="sa-overlay" (click)="closeMobile()"></div>
      }

      <aside class="sa-sidebar" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">
        <div class="sa-sidebar-glow"></div>

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
              <div class="sa-brand-badge">SUPER ADMIN CONTROL</div>
            </div>
          }
          <button class="sa-collapse-btn" (click)="toggleCollapse()" type="button" [title]="collapsed() ? 'Expandir' : 'Colapsar'">
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

        @if (!collapsed()) {
          <div class="sa-command-card">
            <span class="command-kicker">Vista global</span>
            <strong>{{ currentPageMeta().title }}</strong>
            <small>{{ currentPageMeta().subtitle }}</small>
          </div>
        }

        <nav class="sa-nav">
          @for (section of navSections(); track section.label) {
            @if (section.items.length > 0) {
              @if (!collapsed()) {
                <div class="sa-nav-section">{{ section.label }}</div>
              } @else {
                <div class="sa-nav-divider"></div>
              }

              @for (item of section.items; track item.route) {
                <a [routerLink]="item.route"
                   routerLinkActive="sa-active"
                   class="sa-nav-item"
                   [class.collapsed-item]="collapsed()"
                   (click)="closeMobile()">
                  <span class="sa-nav-icon">
                    <ng-container *ngTemplateOutlet="iconTpl; context: { id: item.iconId }"/>
                  </span>
                  @if (!collapsed()) {
                    <span class="sa-nav-copy">
                      <strong>{{ item.label }}</strong>
                      <small>{{ item.caption }}</small>
                    </span>
                  } @else {
                    <span class="sa-nav-tooltip">{{ item.label }}</span>
                  }
                </a>
              }
            }
          }
        </nav>

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

            <div class="sa-status-card">
              <span>Operacion</span>
              <strong>Supervision activa</strong>
              <small>{{ todayShort }}</small>
            </div>
          } @else {
            <div class="sa-user-avatar sa-user-avatar--center" [title]="(auth.user()?.firstName ?? '') + ' ' + (auth.user()?.lastName ?? '')">
              {{ (auth.user()?.firstName?.[0] ?? '') + (auth.user()?.lastName?.[0] ?? '') }}
            </div>
          }

          <button (click)="auth.logout()" class="sa-logout" [class.logout-collapsed]="collapsed()" type="button" [title]="collapsed() ? 'Cerrar sesión' : ''">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/>
            </svg>
            @if (!collapsed()) { <span>Cerrar sesión</span> }
          </button>
        </div>
      </aside>

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
          @case ('dian-tests') {
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z"/>
            </svg>
          }
        }
      </ng-template>

      <main class="sa-main">
        <div class="sa-topbar">
          <div class="sa-topbar-left">
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

        <section class="sa-hero">
          <div class="sa-hero-copy">
            <p class="hero-kicker">Panel ejecutivo</p>
            <div class="sa-hero-headline">
              <h1>{{ currentPageMeta().title }}</h1>
              <span class="hero-pill">{{ currentPageMeta().badge }}</span>
            </div>
            <p>{{ currentPageMeta().subtitle }}</p>
          </div>

          <div class="sa-hero-stats">
            <div class="hero-stat">
              <span>Modulo</span>
              <strong>{{ currentPageMeta().badge }}</strong>
            </div>
            <div class="hero-stat hero-stat--accent">
              <span>Sesion</span>
              <strong>Super Admin</strong>
            </div>
            <div class="hero-stat">
              <span>Fecha</span>
              <strong>{{ todayShort }}</strong>
            </div>
          </div>
        </section>

        <div class="sa-content">
          <div class="sa-content-shell">
            <router-outlet />
          </div>
        </div>
      </main>

      <app-toast />
    </div>
  `,
  styles: [`
    :host { display:block; height:100%; }

    .sa-layout {
      display:flex;
      min-height:100vh;
      height:100vh;
      overflow:hidden;
      background:
        radial-gradient(circle at top left, rgba(0, 198, 160, 0.07), transparent 22%),
        radial-gradient(circle at top right, rgba(26, 64, 126, 0.08), transparent 26%),
        #f4f8fc;
    }

    .sa-overlay {
      position:fixed;
      inset:0;
      background:rgba(12, 28, 53, 0.55);
      z-index:299;
      backdrop-filter:blur(2px);
      animation:fadeIn .2s ease;
    }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }

    .sa-sidebar {
      position:relative;
      width:292px;
      min-width:292px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.12), transparent 30%),
        linear-gradient(180deg, #0b1b33 0%, #102746 50%, #0e2340 100%);
      display:flex;
      flex-direction:column;
      overflow:hidden;
      flex-shrink:0;
      z-index:300;
      transition:width .24s cubic-bezier(.4, 0, .2, 1);
      border-right:1px solid rgba(255, 255, 255, 0.06);
      box-shadow:20px 0 40px rgba(12, 28, 53, 0.12);
    }
    .sa-sidebar.collapsed { width:84px; min-width:84px; }

    .sa-sidebar-glow {
      position:absolute;
      inset:auto -40px 30% auto;
      width:180px;
      height:180px;
      border-radius:50%;
      background:radial-gradient(circle, rgba(0, 198, 160, 0.12) 0%, transparent 70%);
      pointer-events:none;
    }

    .sa-brand {
      display:flex;
      align-items:center;
      gap:12px;
      padding:16px 16px 14px;
      border-bottom:1px solid rgba(255, 255, 255, 0.07);
      flex-shrink:0;
    }
    .sa-sidebar.collapsed .sa-brand { justify-content:center; padding:16px 10px 14px; }

    .sa-logo {
      width:40px;
      height:40px;
      border-radius:12px;
      flex-shrink:0;
      background:rgba(0, 198, 160, 0.12);
      border:1px solid rgba(0, 198, 160, 0.25);
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 12px 24px rgba(0, 198, 160, 0.08);
    }

    .sa-brand-name {
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:16px;
      font-weight:800;
      color:#fff;
      letter-spacing:-.03em;
    }

    .sa-brand-badge {
      display:inline-block;
      margin-top:4px;
      padding:3px 8px;
      border-radius:999px;
      font-size:9px;
      font-weight:800;
      letter-spacing:.12em;
      color:#8bf3cb;
      background:rgba(0, 198, 160, 0.14);
      border:1px solid rgba(0, 198, 160, 0.16);
    }

    .sa-collapse-btn {
      display:flex;
      align-items:center;
      justify-content:center;
      width:32px;
      height:32px;
      margin-left:auto;
      background:none;
      border:none;
      border-radius:10px;
      color:#5f87b1;
      cursor:pointer;
      transition:background .15s, color .15s;
      flex-shrink:0;
    }
    .sa-collapse-btn:hover { background:rgba(255, 255, 255, 0.08); color:#d4e4f7; }
    .sa-sidebar.collapsed .sa-collapse-btn {
      margin:0;
      width:38px;
      height:38px;
      border-radius:12px;
      border:1px solid rgba(0, 198, 160, 0.22);
      background:rgba(0, 198, 160, 0.08);
      color:#00c6a0;
    }

    .sa-command-card {
      margin:16px;
      padding:16px;
      border-radius:20px;
      background:rgba(255, 255, 255, 0.08);
      border:1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter:blur(12px);
      display:grid;
      gap:4px;
    }

    .command-kicker {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#7ef4d8;
    }

    .sa-command-card strong {
      font-size:16px;
      line-height:1.2;
      font-weight:800;
      color:#fff;
    }

    .sa-command-card small {
      font-size:12px;
      line-height:1.55;
      color:#8ca8c4;
    }

    .sa-nav {
      flex:1;
      padding:8px 10px 14px;
      overflow-y:auto;
      overflow-x:hidden;
    }
    .sa-nav::-webkit-scrollbar { width:4px; }
    .sa-nav::-webkit-scrollbar-thumb { background:rgba(255, 255, 255, 0.08); border-radius:999px; }

    .sa-nav-section {
      padding:10px 12px 6px;
      font-size:10px;
      font-weight:800;
      color:#426488;
      letter-spacing:.14em;
      text-transform:uppercase;
    }

    .sa-nav-divider {
      height:1px;
      margin:10px 12px;
      background:rgba(255, 255, 255, 0.06);
    }

    .sa-nav-item {
      display:flex;
      align-items:center;
      gap:12px;
      padding:12px;
      margin-bottom:6px;
      border-radius:16px;
      color:#7ea3cc;
      text-decoration:none;
      min-height:48px;
      transition:all .16s ease;
      position:relative;
    }
    .sa-nav-item:hover {
      background:rgba(255, 255, 255, 0.07);
      color:#e5f0fb;
      transform:translateX(2px);
    }
    .sa-nav-item.sa-active {
      background:linear-gradient(135deg, rgba(0, 198, 160, 0.14), rgba(26, 64, 126, 0.2));
      color:#8bf3cb;
      border:1px solid rgba(0, 198, 160, 0.18);
      box-shadow:0 12px 22px rgba(0, 0, 0, 0.12);
    }

    .sa-nav-item.collapsed-item {
      justify-content:center;
      width:52px;
      height:52px;
      margin:4px auto;
      padding:0;
      border-radius:16px;
    }

    .sa-nav-icon {
      width:20px;
      height:20px;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      color:inherit;
    }
    .sa-nav-icon svg { width:18px; height:18px; color:inherit; }

    .sa-nav-copy {
      display:grid;
      gap:2px;
      min-width:0;
    }

    .sa-nav-copy strong {
      font-size:14px;
      font-weight:700;
      color:inherit;
    }

    .sa-nav-copy small {
      font-size:11px;
      line-height:1.45;
      color:#5f87b1;
    }
    .sa-nav-item.sa-active .sa-nav-copy small { color:#9ee7d7; }

    .sa-nav-tooltip {
      display:none;
      position:absolute;
      left:calc(100% + 12px);
      top:50%;
      transform:translateY(-50%);
      background:#1e2d47;
      color:#d4e4f7;
      font-size:12px;
      font-weight:600;
      white-space:nowrap;
      padding:6px 10px;
      border-radius:8px;
      border:1px solid rgba(255, 255, 255, 0.1);
      box-shadow:0 8px 20px rgba(0, 0, 0, 0.3);
      pointer-events:none;
      z-index:400;
    }
    .sa-nav-item.collapsed-item:hover .sa-nav-tooltip { display:block; }

    .sa-sidebar-footer {
      padding:14px;
      border-top:1px solid rgba(255, 255, 255, 0.07);
      display:flex;
      flex-direction:column;
      gap:12px;
      flex-shrink:0;
      background:rgba(0, 0, 0, 0.08);
    }
    .sa-sidebar-footer.footer-collapsed { padding:12px 10px; align-items:center; }

    .sa-user-row {
      display:flex;
      align-items:center;
      gap:10px;
    }

    .sa-user-avatar {
      width:36px;
      height:36px;
      border-radius:12px;
      flex-shrink:0;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:12px;
      font-weight:800;
      display:flex;
      align-items:center;
      justify-content:center;
      text-transform:uppercase;
      box-shadow:0 12px 20px rgba(26, 64, 126, 0.18);
    }

    .sa-user-avatar--center { margin:0 auto; }
    .sa-user-name { font-size:12.5px; font-weight:700; color:#e5f0fb; }
    .sa-user-role { font-size:11px; color:#6f92b8; }

    .sa-status-card {
      display:grid;
      gap:2px;
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255, 255, 255, 0.05);
      border:1px solid rgba(255, 255, 255, 0.07);
    }

    .sa-status-card span {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:#5f87b1;
    }

    .sa-status-card strong {
      font-size:13px;
      font-weight:800;
      color:#fff;
    }

    .sa-status-card small {
      font-size:11px;
      color:#7ea3cc;
    }

    .sa-logout {
      display:flex;
      align-items:center;
      gap:8px;
      width:100%;
      background:rgba(255, 255, 255, 0.04);
      border:1px solid rgba(255, 255, 255, 0.08);
      color:#7ea3cc;
      padding:10px 12px;
      border-radius:14px;
      cursor:pointer;
      font-size:13px;
      font-weight:700;
      transition:all .15s;
    }
    .sa-logout.logout-collapsed { justify-content:center; padding:10px; }
    .sa-logout:hover {
      background:rgba(239, 68, 68, 0.12);
      color:#fca5a5;
      border-color:rgba(239, 68, 68, 0.2);
    }

    .sa-main {
      flex:1;
      display:flex;
      flex-direction:column;
      overflow:visible;
      min-width:0;
    }

    .sa-topbar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:0 20px;
      background:rgba(255, 255, 255, 0.78);
      backdrop-filter:blur(12px);
      border-bottom:1px solid #dce6f0;
      height:58px;
      min-height:58px;
      box-shadow:0 8px 22px rgba(12, 28, 53, 0.04);
      flex-shrink:0;
    }

    .sa-topbar-left { display:flex; align-items:center; gap:12px; }

    .sa-hamburger {
      display:none;
      align-items:center;
      justify-content:center;
      width:38px;
      height:38px;
      background:#f0f4f9;
      border:1px solid #dce6f0;
      border-radius:12px;
      color:#374151;
      cursor:pointer;
      transition:all .15s;
    }
    .sa-hamburger:hover { background:#e8eef8; color:#1a407e; }

    .sa-mode-badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      background:#f8fbff;
      color:#3d5a80;
      padding:7px 12px;
      border-radius:999px;
      font-size:12px;
      font-weight:800;
      border:1px solid #dce6f0;
    }

    .sa-topbar-date {
      font-size:12px;
      font-weight:600;
      color:#8aa0b8;
      white-space:nowrap;
    }

    .sa-hero {
      margin:20px 20px 0;
      padding:18px 20px;
      border-radius:24px;
      background:
        radial-gradient(circle at top right, rgba(0, 198, 160, 0.18), transparent 30%),
        radial-gradient(circle at bottom left, rgba(26, 64, 126, 0.18), transparent 35%),
        linear-gradient(135deg, #0d2344 0%, #173d74 55%, #0c8f79 100%);
      color:#fff;
      display:grid;
      grid-template-columns:minmax(0, 1.4fr) minmax(320px, .9fr);
      gap:14px;
      align-items:center;
      box-shadow:0 18px 34px rgba(12, 28, 53, 0.1);
      flex-shrink:0;
    }

    .hero-kicker {
      margin:0 0 8px;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#8bf3cb;
    }

    .sa-hero-headline {
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
    }

    .sa-hero-copy h1 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:28px;
      line-height:1.04;
      letter-spacing:-.06em;
    }

    .sa-hero-copy p:last-child {
      margin:8px 0 0;
      max-width:62ch;
      font-size:13px;
      line-height:1.55;
      color:rgba(236, 244, 255, 0.8);
    }

    .hero-pill {
      display:inline-flex;
      align-items:center;
      padding:5px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.16);
      color:#d7f7ec;
      font-size:10px;
      font-weight:800;
      letter-spacing:.12em;
      text-transform:uppercase;
      white-space:nowrap;
    }

    .sa-hero-stats {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:10px;
    }

    .hero-stat {
      display:grid;
      gap:2px;
      min-height:72px;
      padding:10px 12px;
      border-radius:16px;
      background:rgba(255, 255, 255, 0.1);
      border:1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter:blur(12px);
    }

    .hero-stat span {
      font-size:9px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.12em;
      color:rgba(236, 244, 255, 0.66);
    }

    .hero-stat strong {
      font-size:15px;
      font-weight:800;
      color:#fff;
      line-height:1.25;
    }

    .hero-stat--accent {
      background:rgba(0, 198, 160, 0.15);
      border-color:rgba(138, 243, 203, 0.22);
    }

    .sa-content {
      flex:1;
      overflow-y:auto;
      padding:20px;
      position:relative;
      z-index:1;
    }
    .sa-content::-webkit-scrollbar { width:6px; }
    .sa-content::-webkit-scrollbar-thumb { background:#dce6f0; border-radius:999px; }

    .sa-content-shell {
      min-height:100%;
      padding:22px;
      border-radius:28px;
      background:rgba(255, 255, 255, 0.72);
      border:1px solid #dce6f0;
      box-shadow:0 20px 38px rgba(12, 28, 53, 0.06);
      position:relative;
      overflow:visible;
    }

    @media (max-width: 1180px) {
      .sa-hero {
        grid-template-columns:1fr;
      }
      .sa-hero-stats {
        grid-template-columns:repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 768px) {
      .sa-sidebar {
        position:fixed;
        top:0;
        left:0;
        height:100dvh;
        transform:translateX(-100%);
        transition:transform .25s cubic-bezier(.4, 0, .2, 1);
        width:280px !important;
        min-width:280px !important;
      }
      .sa-sidebar.mobile-open { transform:translateX(0); }
      .sa-sidebar.collapsed { width:280px !important; min-width:280px !important; }
      .sa-sidebar .sa-collapse-btn { display:none; }
      .sa-sidebar .sa-brand { padding:16px; justify-content:flex-start; }
      .sa-sidebar .sa-command-card,
      .sa-sidebar .sa-nav-section,
      .sa-sidebar .sa-nav-copy,
      .sa-sidebar .sa-user-row,
      .sa-sidebar .sa-status-card,
      .sa-sidebar .sa-logout span { display:initial; }
      .sa-sidebar .sa-nav-item {
        justify-content:flex-start !important;
        width:auto !important;
        height:auto !important;
        margin:0 0 6px !important;
        padding:12px !important;
      }
      .sa-sidebar .sa-nav-divider { display:none; }

      .sa-main { width:100%; }
      .sa-hamburger { display:flex; }
      .sa-topbar { padding:0 14px; }
      .badge-text { display:none; }
      .sa-hero {
        margin:14px 14px 0;
        padding:16px;
        border-radius:22px;
      }
      .sa-hero-copy h1 { font-size:24px; }
      .sa-hero-stats { grid-template-columns:1fr; }
      .hero-stat { min-height:auto; }
      .sa-content { padding:14px; }
      .sa-content-shell { padding:16px; border-radius:22px; }
    }

    @media (max-width: 480px) {
      .sa-topbar-date { display:none; }
      .sa-content { padding:12px; }
      .sa-hero { margin:12px 12px 0; }
    }
  `],
})
export class SuperAdminLayoutComponent {
  private router = inject(Router);

  today = new Date().toLocaleDateString('es-CO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  todayShort = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });

  collapsed  = signal(false);
  mobileOpen = signal(false);
  currentUrl = signal('');

  navItems: SANavItem[] = [
    { label: 'Dashboard', route: 'dashboard', iconId: 'dashboard', section: 'RESUMEN', caption: 'Vista consolidada del SaaS' },
    { label: 'Empresas', route: 'companies', iconId: 'companies', section: 'NEGOCIO', caption: 'Clientes, estados y operación' },
    { label: 'Planes', route: 'plans', iconId: 'plans', section: 'NEGOCIO', caption: 'Oferta comercial y catálogo' },
    { label: 'Integraciones', route: 'integrations', iconId: 'integrations', section: 'OPERACION', caption: 'Conectores y salud técnica' },
    { label: 'Usuarios', route: 'users', iconId: 'users', section: 'OPERACION', caption: 'Acceso global de la plataforma' },
    { label: 'Bancos', route: 'banks', iconId: 'banks', section: 'CONFIG', caption: 'Entidades financieras del sistema' },
    { label: 'Parámetros', route: 'parameters', iconId: 'parameters', section: 'CONFIG', caption: 'Variables maestras del ERP' },
    { label: 'Auditoría', route: 'audit', iconId: 'audit', section: 'CONTROL', caption: 'Rastreo y trazabilidad global' },
    { label: 'Plantilla', route: 'template', iconId: 'template', section: 'CONTROL', caption: 'Base visual y componentes SA' },
    { label: 'Sets DIAN', route: 'dian-tests', iconId: 'dian-tests', section: 'CONTROL', caption: 'Pruebas y sincronización DIAN' },
  ];

  pageMeta: Record<string, { title: string; subtitle: string; badge: string }> = {
    dashboard: { title: 'Centro de control global', subtitle: 'Monitorea el comportamiento general de la plataforma, crecimiento de empresas y actividad reciente desde una sola vista.', badge: 'Resumen' },
    companies: { title: 'Gestión de empresas', subtitle: 'Administra clientes, estados operativos, suscripciones y usuarios asociados a cada empresa registrada.', badge: 'Empresas' },
    plans: { title: 'Catálogo de planes', subtitle: 'Controla la oferta comercial del SaaS, límites por plan y características que definen cada suscripción.', badge: 'Planes' },
    integrations: { title: 'Integraciones globales', subtitle: 'Supervisa conectores, relaciones externas y dependencias críticas del ecosistema BeccaFact.', badge: 'Integraciones' },
    users: { title: 'Usuarios de plataforma', subtitle: 'Consulta el universo de usuarios, su empresa asociada y el estado de acceso dentro del sistema.', badge: 'Usuarios' },
    banks: { title: 'Bancos y entidades', subtitle: 'Mantén depurada la configuración de entidades financieras disponibles para todos los tenants.', badge: 'Bancos' },
    parameters: { title: 'Parámetros maestros', subtitle: 'Administra variables globales que impactan procesos transversales del ERP y del ecosistema administrativo.', badge: 'Config' },
    audit: { title: 'Auditoría y trazabilidad', subtitle: 'Revisa eventos críticos, movimientos relevantes y la trazabilidad administrativa del sistema completo.', badge: 'Auditoría' },
    template: { title: 'Plantillas del sistema', subtitle: 'Organiza y valida la base visual o documental que soporta procesos estándar del super admin.', badge: 'Plantilla' },
    'dian-tests': { title: 'Sets DIAN y pruebas', subtitle: 'Gestiona escenarios de prueba, sincronizaciones y seguimiento técnico de configuraciones DIAN.', badge: 'DIAN' },
  };

  currentPageMeta = computed(() => {
    const segment = this.currentUrl().split('/').filter(Boolean).pop() || 'dashboard';
    return this.pageMeta[segment] ?? this.pageMeta['dashboard'];
  });

  constructor(protected auth: AuthService) {
    this.currentUrl.set(this.router.url);
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set((event as NavigationEnd).urlAfterRedirects);
      this.mobileOpen.set(false);
    });
  }

  navSections(): Array<{ label: string; items: SANavItem[] }> {
    const map = new Map<string, SANavItem[]>();
    for (const item of this.navItems) {
      const current = map.get(item.section) ?? [];
      current.push(item);
      map.set(item.section, current);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }

  toggleCollapse() { this.collapsed.update(v => !v); }
  openMobile()     { this.collapsed.set(false); this.mobileOpen.set(true); }
  closeMobile()    { this.mobileOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { this.mobileOpen.set(false); }
}
