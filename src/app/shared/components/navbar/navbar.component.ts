import { Component, Input, Output, EventEmitter, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, User, UserBranch } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="navbar">
      <div class="navbar-left">
        <button class="hamburger-btn" (click)="toggleMobileSidebar.emit()" type="button" aria-label="Abrir menú">
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
          </svg>
        </button>

        <div class="breadcrumb-shell">
          <div class="workspace-chip hide-mobile-sm">
            <span class="workspace-dot"></span>
            <span>BeccaFact ERP</span>
          </div>

          <div class="breadcrumb">
            <span class="breadcrumb-page">{{ getPageTitle() }}</span>
            <small class="breadcrumb-sub hide-mobile-sm">{{ getPageSubtitle() }}</small>
          </div>
        </div>
      </div>

      <div class="navbar-right">
        @if (activeBranch) {
          <button class="branch-chip" (click)="switchBranch()" type="button" [title]="'Sucursal activa: ' + activeBranch.branch.name">
            <span class="branch-chip-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                <path fill-rule="evenodd"
                  d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
              </svg>
            </span>
            <span class="branch-chip-copy">
              <strong>{{ activeBranch.branch.name }}</strong>
              <small>Cambiar sucursal</small>
            </span>
            <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12" class="branch-chip-arrow">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
            </svg>
          </button>
        }

        @if (showUpgradeBanner()) {
          <a routerLink="/settings/billing" class="upgrade-pill">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13">
              <path d="M8 1.5a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5a.5.5 0 01.5-.5z"/>
            </svg>
            <span class="upgrade-text">Actualizar plan</span>
          </a>
        }

        <button class="icon-btn" title="Notificaciones" type="button">
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
          </svg>
          <span class="notif-dot"></span>
        </button>

        <!-- ✅ FIX: stopPropagation en el user-menu para evitar que el click burbujee al document -->
        <div class="user-menu" (click)="toggleMenu($event)" >
          <div class="user-avatar">{{ userInitials() }}</div>
          <div class="user-info hide-mobile">
            <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
            <span class="user-role">{{ roleLabel() }}</span>
          </div>
          <svg class="chevron hide-mobile" viewBox="0 0 20 20" fill="currentColor" width="14">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
          </svg>

          @if (menuOpen()) {
            <!-- ✅ FIX: stopPropagation en el dropdown también -->
            <div class="dropdown" (click)="$event.stopPropagation()">
              <div class="dropdown-header">
                <div class="dropdown-user-row">
                  <div class="dropdown-avatar">{{ userInitials() }}</div>
                  <div>
                    <div class="dh-name">{{ user.firstName }} {{ user.lastName }}</div>
                    <div class="dh-email">{{ user.email }}</div>
                  </div>
                </div>
              </div>

              <div class="dropdown-divider"></div>

              <a class="dropdown-item" routerLink="/settings/profile" (click)="menuOpen.set(false)">
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
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      padding:0 22px;
      height:66px;
      position:sticky;
      top:0;
      z-index:100;
      background:rgba(255, 255, 255, 0.78);
      backdrop-filter:blur(14px);
      border-bottom:1px solid rgba(220, 230, 240, 0.9);
      box-shadow:0 10px 22px rgba(12, 28, 53, 0.04);
    }

    .navbar-left {
      display:flex;
      align-items:center;
      gap:12px;
      flex:1;
      min-width:0;
    }

    .hamburger-btn {
      display:none;
      align-items:center;
      justify-content:center;
      width:40px;
      height:40px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      border-radius:12px;
      cursor:pointer;
      color:#3d5a80;
      flex-shrink:0;
      transition:all .15s;
    }
    .hamburger-btn:hover { background:#eef4fb; color:#1a407e; }

    .breadcrumb-shell {
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .workspace-chip {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      background:#f7fbff;
      border:1px solid #dce6f0;
      color:#456789;
      font-size:11.5px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.1em;
      white-space:nowrap;
    }

    .workspace-dot {
      width:8px;
      height:8px;
      border-radius:50%;
      background:#00c6a0;
      box-shadow:0 0 0 4px rgba(0, 198, 160, 0.12);
    }

    .breadcrumb {
      display:grid;
      gap:2px;
      min-width:0;
    }

    .breadcrumb-page {
      font-family:var(--font-d, 'Sora', sans-serif);
      font-weight:700;
      color:#0c1c35;
      font-size:17px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      letter-spacing:-.03em;
    }

    .breadcrumb-sub {
      color:#8aa0b8;
      font-size:12px;
      line-height:1.4;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .navbar-right {
      display:flex;
      align-items:center;
      gap:10px;
      flex-shrink:0;
    }

    .branch-chip {
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:7px 10px 7px 8px;
      border-radius:16px;
      background:#f7fbff;
      border:1px solid #dce6f0;
      color:#1a407e;
      cursor:pointer;
      transition:all .15s;
      white-space:nowrap;
      max-width:250px;
    }
    .branch-chip:hover {
      background:#eef4fb;
      border-color:#bfd7ee;
      transform:translateY(-1px);
    }

    .branch-chip-icon {
      width:28px;
      height:28px;
      border-radius:10px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#e3effb;
      color:#1a407e;
      flex-shrink:0;
    }

    .branch-chip-copy {
      display:grid;
      min-width:0;
    }

    .branch-chip-copy strong {
      font-size:12.5px;
      font-weight:700;
      color:#1a407e;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .branch-chip-copy small {
      font-size:10.5px;
      color:#7ea3cc;
      white-space:nowrap;
    }

    .branch-chip-arrow {
      opacity:.65;
      flex-shrink:0;
    }

    .upgrade-pill {
      display:inline-flex;
      align-items:center;
      gap:6px;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      padding:8px 14px;
      border-radius:999px;
      font-size:12.5px;
      font-weight:800;
      text-decoration:none;
      transition:transform .15s, opacity .15s;
      white-space:nowrap;
      box-shadow:0 14px 24px rgba(26, 64, 126, 0.18);
    }
    .upgrade-pill:hover { opacity:.94; transform:translateY(-1px); color:#fff; }

    .icon-btn {
      width:40px;
      height:40px;
      border-radius:12px;
      background:#f8fbff;
      border:1px solid #dce6f0;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#7ea3cc;
      position:relative;
      transition:all .15s;
      flex-shrink:0;
    }
    .icon-btn:hover {
      background:#eef4fb;
      color:#1a407e;
      border-color:#c0d4e8;
    }

    .notif-dot {
      position:absolute;
      top:7px;
      right:7px;
      width:8px;
      height:8px;
      border-radius:50%;
      background:#00c6a0;
      border:2px solid #fff;
      box-shadow:0 0 0 3px rgba(0, 198, 160, 0.12);
    }

    .user-menu {
      display:flex;
      align-items:center;
      gap:10px;
      cursor:pointer;
      padding:6px 10px 6px 6px;
      border-radius:16px;
      border:1px solid transparent;
      position:relative;
      user-select:none;
      transition:all .15s;
      background:rgba(255, 255, 255, 0.35);
    }
    .user-menu:hover {
      background:#f8fbff;
      border-color:#dce6f0;
    }

    .user-avatar {
      width:38px;
      height:38px;
      border-radius:13px;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:13px;
      font-weight:800;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 12px 20px rgba(26, 64, 126, 0.16);
    }

    .user-info {
      display:flex;
      flex-direction:column;
      min-width:0;
    }

    .user-name {
      font-size:13.5px;
      font-weight:700;
      color:#0c1c35;
      white-space:nowrap;
    }

    .user-role {
      font-size:11px;
      color:#7ea3cc;
      white-space:nowrap;
    }

    .chevron { color:#9ab5cc; flex-shrink:0; }

    .dropdown {
      position:absolute;
      top:calc(100% + 8px);
      right:0;
      min-width:250px;
      padding:8px;
      background:rgba(255, 255, 255, 0.96);
      border:1px solid #dce6f0;
      border-radius:18px;
      box-shadow:0 18px 38px rgba(12, 28, 53, 0.14);
      backdrop-filter:blur(14px);
      z-index:300;
      animation:fadeSlideUp .15s ease;
    }

    @keyframes fadeSlideUp {
      from { opacity:0; transform:translateY(-6px); }
      to { opacity:1; transform:translateY(0); }
    }

    .dropdown-header {
      padding:8px;
    }

    .dropdown-user-row {
      display:flex;
      align-items:center;
      gap:10px;
    }

    .dropdown-avatar {
      width:42px;
      height:42px;
      border-radius:14px;
      background:linear-gradient(135deg, #1a407e, #00c6a0);
      color:#fff;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:14px;
      font-weight:800;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
    }

    .dh-name {
      font-size:13px;
      font-weight:800;
      color:#0c1c35;
    }

    .dh-email {
      font-size:12px;
      color:#7ea3cc;
      margin-top:2px;
    }

    .dropdown-divider {
      border:none;
      border-top:1px solid #edf2f8;
      margin:6px 0;
    }

    .dropdown-item {
      display:flex;
      align-items:center;
      gap:10px;
      padding:10px 12px;
      border-radius:12px;
      font-size:13.5px;
      font-weight:600;
      color:#3d5a80;
      text-decoration:none;
      border:none;
      background:none;
      width:100%;
      cursor:pointer;
      text-align:left;
      transition:all .12s;
    }
    .dropdown-item:hover {
      background:#f0f4f9;
      color:#0c1c35;
    }
    .dropdown-item.danger { color:#dc2626; }
    .dropdown-item.danger:hover { background:#fee2e2; }

    .hide-mobile { display:flex; flex-direction:column; }

    .hide-mobile-sm { display:initial; }

    @media (max-width: 768px) {
      .navbar { padding:0 14px; height:60px; }
      .hamburger-btn { display:flex; }
      .branch-chip-copy small { display:none; }
    }

    @media (max-width: 640px) {
      .hide-mobile { display:none !important; }
      .upgrade-text { display:none; }
      .upgrade-pill { padding:9px 11px; }
      .branch-chip {
        max-width:170px;
        padding:7px 8px;
      }
      .branch-chip-copy strong {
        max-width:80px;
      }
    }

    @media (max-width: 480px) {
      .navbar { padding:0 10px; height:56px; gap:8px; }
      .breadcrumb-page { font-size:15px; }
      .breadcrumb-sub,
      .hide-mobile-sm { display:none; }
      .workspace-chip { display:none; }
      .branch-chip-copy { display:none; }
      .branch-chip { padding:7px; }
      .dropdown {
        right:-6px;
        min-width:220px;
      }
    }
  `],
})
export class NavbarComponent {
  @Input() user!: User;
  @Input() activeBranch: UserBranch | null = null;
  @Output() toggleMobileSidebar = new EventEmitter<void>();

  menuOpen = signal(false);

  private auth = inject(AuthService);

  @HostListener('document:click')
  closeMenuFromOutside() {
    // ✅ Ahora sí cierra correctamente porque el click del user-menu
    // ya no llega aquí gracias al stopPropagation
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }

  switchBranch(): void {
    const branches = this.auth.user()?.userBranches ?? [];
    if (branches.length > 1) {
      this.auth.clearBranchSelection();
    }
  }

  // ✅ FIX: recibe el evento y detiene la propagación
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  logout() { this.menuOpen.set(false); this.auth.logout(); }

  userInitials(): string {
    if (!this.user) return '?';
    return ((this.user.firstName?.[0] ?? '') + (this.user.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  showUpgradeBanner(): boolean {
    const plan = this.auth.currentPlan()?.name?.toLowerCase();
    return plan === 'basic' || plan === 'starter';
  }

  roleLabel(): string {
    const r = this.user?.roles?.[0] ?? '';
    return { ADMIN: 'Administrador', USER: 'Usuario', SUPER_ADMIN: 'Super Admin', MANAGER: 'Gerente', OPERATOR: 'Operador', CONTADOR: 'Contador', CAJERO: 'Cajero' }[r] ?? r;
  }

  getPageTitle(): string {
    const url = window.location.pathname;
    const map: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/invoices': 'Facturación',
      '/inventory': 'Inventario',
      '/customers': 'Clientes',
      '/reports': 'Reportes',
      '/import': 'Importación',
      '/settings': 'Configuración',
      '/payroll': 'Nómina',
      '/cartera': 'Cartera',
      '/pos': 'Punto de Venta',
      '/sucursales': 'Sucursales',
      '/super-admin': 'Super Admin',
    };
    return map[url] ?? 'Panel';
  }

  getPageSubtitle(): string {
    const url = window.location.pathname;
    const map: Record<string, string> = {
      '/dashboard': 'Resumen ejecutivo del negocio',
      '/invoices': 'Emisión y seguimiento documental',
      '/inventory': 'Stock, catálogo y movimientos',
      '/customers': 'Base comercial y relacionamiento',
      '/reports': 'Analítica y desempeño',
      '/import': 'Carga masiva y validación',
      '/settings': 'Ajustes de cuenta y empresa',
      '/payroll': 'Liquidaciones y empleados',
      '/cartera': 'Cobro y vencimientos',
      '/pos': 'Caja y ventas rápidas',
      '/sucursales': 'Operación multisede',
      '/super-admin': 'Control global de plataforma',
    };
    return map[url] ?? 'Espacio principal de gestión';
  }
}
