import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { ToastComponent } from '../toast/toast.component';
import { GlobalLoaderComponent } from '../global-loader/global-loader.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, NavbarComponent, ToastComponent, GlobalLoaderComponent],
  template: `
    <div class="layout">
      <app-global-loader />
      @if (auth.user()) {
        <app-sidebar
          [isSuperAdmin]="auth.isSuperAdmin()"
          [user]="auth.user()!"
          [plan]="auth.currentPlan()"
        />
        <div class="main-area">
          <app-navbar [user]="auth.user()!" />
          <main class="content">
            <router-outlet />
          </main>
        </div>
      }
      <app-toast />
    </div>
  `,
  styles: [`
    .layout {
      display: flex; height: 100vh; overflow: hidden;
      background: var(--bg, #f0f4f9);
    }
    .main-area {
      flex: 1; display: flex; flex-direction: column; overflow: hidden;
    }
    .content {
      flex: 1; overflow-y: auto; padding: 28px 28px;
    }
    @media (max-width: 768px) {
      .content { padding: 16px; }
    }
  `],
})
export class LayoutComponent {
  constructor(protected auth: AuthService) {}
}
