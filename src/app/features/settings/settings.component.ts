import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <h3>Configuración</h3>
        <nav>
          <a routerLink="profile" routerLinkActive="active" class="settings-link">👤 Mi perfil</a>
          <a routerLink="company" routerLinkActive="active" class="settings-link">🏢 Mi empresa</a>
          <a routerLink="users" routerLinkActive="active" class="settings-link">👥 Usuarios</a>
          <a routerLink="billing" routerLinkActive="active" class="settings-link">💳 Plan y facturación</a>
          <a routerLink="integrations" routerLinkActive="active" class="settings-link">🔌 Integraciones</a>
        </nav>
      </aside>
      <div class="settings-content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .settings-layout { display: flex; gap: 24px; max-width: 1000px; }
    .settings-sidebar { width: 200px; flex-shrink: 0; }
    .settings-sidebar h3 { font-size: 14px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    .settings-link { padding: 9px 12px; border-radius: 8px; text-decoration: none; color: #374151; font-size: 14px; font-weight: 500; }
    .settings-link:hover { background: #f1f5f9; }
    .settings-link.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
    .settings-content { flex: 1; }
  `],
})
export class SettingsComponent {
  constructor(protected auth: AuthService) {}
}
