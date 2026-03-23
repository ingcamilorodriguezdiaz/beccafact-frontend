import { Component, computed, inject, signal, HostListener, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { ToastComponent } from '../toast/toast.component';
import { GlobalLoaderComponent } from '../global-loader/global-loader.component';
import { TourService } from '../../../core/services/tour.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

interface UsageData {
  documentsUsedThisMonth: number;
  totalProducts: number;
  totalCustomers: number;
  month: number;
  year: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, NavbarComponent, ToastComponent, GlobalLoaderComponent],
  template: `
    <div class="layout">
      <app-global-loader />
      @if (auth.user()) {
        <!-- Overlay para cerrar sidebar en móvil -->
        @if (mobileSidebarOpen()) {
          <div class="sidebar-overlay" (click)="mobileSidebarOpen.set(false)"></div>
        }

        <app-sidebar
          [isSuperAdmin]="auth.isSuperAdmin()"
          [user]="auth.user()!"
          [plan]="auth.currentPlan()"
          [usagePercent]="usagePercent()"
          [mobileOpen]="mobileSidebarOpen()"
          (mobileClose)="mobileSidebarOpen.set(false)"
        />
        <div class="main-area">
          <app-navbar
            [user]="auth.user()!"
            (toggleMobileSidebar)="toggleMobileSidebar()"
          />
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
      flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;
    }
    .content {
      flex: 1; overflow-y: auto; padding: 28px;
    }
    /* Overlay móvil */
    .sidebar-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      z-index: 199; display: none;
    }
    @media (max-width: 768px) {
      .content { padding: 16px 14px; }
      .sidebar-overlay { display: block; }
    }
    @media (max-width: 480px) {
      .content { padding: 12px 10px; }
    }
  `],
})
export class LayoutComponent {
  mobileSidebarOpen = signal(false);

  private http        = inject(HttpClient);
  protected auth      = inject(AuthService);
  private tourService = inject(TourService);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      console.log("validar usuarios:",user);
      if (user && !user.isSuperAdmin && !user.hasSeenTour) {
        this.tourService.start(user.firstName);
      }
    });
  }
  /**
   * Calcula el porcentaje de uso mensual de documentos comparando
   * los documentos emitidos este mes contra el límite del plan.
   * Si no hay datos de uso o el plan es ilimitado, retorna 0.
   */
  readonly usagePercent = computed(() => {
    const features = this.auth.planFeatures();
    const maxDocs = features['max_documents_per_month'];
    if (!maxDocs || maxDocs === '-1' || maxDocs === 'unlimited') return 0;

    const limit = parseInt(maxDocs, 10);
    if (isNaN(limit) || limit <= 0) return 0;

    // usageData es opcionalmente cargado; si no está disponible usamos 0
    const used = this.usageData()?.documentsUsedThisMonth ?? 0;
    return Math.min(100, Math.round((used / limit) * 100));
  });

  private readonly usageData = toSignal(
    this.http.get<UsageData>(`${environment.apiUrl}/reports/usage-summary`).pipe(
      catchError(() => of(null)),
    ),
  );

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update(value => !value);
  }

}
