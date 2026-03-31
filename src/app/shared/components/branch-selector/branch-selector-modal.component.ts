import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, UserBranch } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-branch-selector-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Full-screen blocking overlay -->
    <div class="bsm-backdrop">
      <div class="bsm-dialog">

        <!-- Header -->
        <div class="bsm-header">
          <div class="bsm-logo">
            <svg viewBox="0 0 28 28" fill="none" width="22" height="22">
              <path d="M4 20L10 9L16 15L20 9L25 18" stroke="#00c6a0" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 class="bsm-title">Selecciona tu sucursal</h2>
            <p class="bsm-subtitle">Elige la sucursal con la que deseas trabajar</p>
          </div>
        </div>

        <!-- Branch cards -->
        <div class="bsm-list">
          @for (ub of branches(); track ub.id) {
            <button
              class="bsm-card"
              [class.bsm-card--main]="ub.branch.isMain"
              [class.bsm-card--inactive]="!ub.branch.isActive"
              [class.bsm-card--active]="ub.branch.id === activeBranchId()"
              (click)="select(ub)">

              <div class="bsm-card-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                  <path fill-rule="evenodd"
                    d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
                </svg>
              </div>

              <div class="bsm-card-body">
                <span class="bsm-card-name">{{ ub.branch.name }}</span>
                <div class="bsm-card-badges">
                  @if (ub.branch.id === activeBranchId()) {
                    <span class="bsm-badge bsm-badge--active">Activa</span>
                  }
                  @if (ub.branch.isMain) {
                    <span class="bsm-badge bsm-badge--main">Principal</span>
                  }
                  @if (!ub.branch.isActive) {
                    <span class="bsm-badge bsm-badge--inactive">Inactiva</span>
                  }
                </div>
              </div>

              @if (ub.branch.id === activeBranchId()) {
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" class="bsm-check">
                  <path fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                </svg>
              } @else {
                <svg class="bsm-arrow" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                </svg>
              }
            </button>
          }
        </div>

        <!-- Footer -->
        <p class="bsm-footer">
          Podrás cambiar de sucursal en cualquier momento desde la barra superior.
        </p>

      </div>
    </div>
  `,
  styles: [`
    .bsm-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(12, 28, 53, 0.72);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: bsm-fade-in 0.2s ease;
    }

    @keyframes bsm-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .bsm-dialog {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(12,28,53,0.3);
      width: 100%;
      max-width: 440px;
      padding: 32px;
      animation: bsm-slide-up 0.25s ease;
    }

    @keyframes bsm-slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* ── Header ── */
    .bsm-header {
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 28px;
    }
    .bsm-logo {
      width: 44px; height: 44px; border-radius: 12px;
      background: #0c1c35; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .bsm-title {
      font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
      color: #0c1c35; margin: 0 0 3px;
    }
    .bsm-subtitle {
      font-size: 13px; color: #7ea3cc; margin: 0;
    }

    /* ── Branch list ── */
    .bsm-list {
      display: flex; flex-direction: column; gap: 10px;
      margin-bottom: 20px;
    }

    .bsm-card {
      display: flex; align-items: center; gap: 14px;
      width: 100%; padding: 14px 16px;
      background: #f8fafc; border: 1.5px solid #dce6f0;
      border-radius: 12px; cursor: pointer;
      text-align: left; transition: all 0.15s ease;
    }
    .bsm-card:hover {
      background: #eef4fb; border-color: #1a407e;
      box-shadow: 0 4px 16px rgba(26,64,126,0.12);
      transform: translateY(-1px);
    }
    .bsm-card--main {
      border-color: #1a407e;
    }
    .bsm-card--inactive {
      opacity: 0.55;
    }
    .bsm-card--active {
      background: #eef4fb;
      border-color: #1a407e;
      box-shadow: 0 2px 12px rgba(26,64,126,0.1);
    }

    .bsm-card-icon {
      width: 38px; height: 38px; border-radius: 10px;
      background: linear-gradient(135deg, #1a407e, #2563eb);
      color: #fff; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .bsm-card--main .bsm-card-icon {
      background: linear-gradient(135deg, #0c1c35, #1a407e);
    }

    .bsm-card-body { flex: 1; min-width: 0; }
    .bsm-card-name {
      display: block; font-size: 14.5px; font-weight: 600;
      color: #0c1c35; margin-bottom: 4px;
    }
    .bsm-card-badges { display: flex; gap: 6px; }

    .bsm-badge {
      font-size: 10.5px; font-weight: 700; padding: 2px 8px;
      border-radius: 9999px; letter-spacing: 0.03em;
    }
    .bsm-badge--main     { background: #e8eef8; color: #1a407e; }
    .bsm-badge--inactive { background: #fee2e2; color: #991b1b; }
    .bsm-badge--active   { background: #dcfce7; color: #166534; }

    .bsm-arrow { color: #9ab5cc; flex-shrink: 0; transition: color 0.15s; }
    .bsm-card:hover .bsm-arrow { color: #1a407e; }
    .bsm-check { color: #16a34a; flex-shrink: 0; }

    /* ── Footer ── */
    .bsm-footer {
      font-size: 12px; color: #9ab5cc;
      text-align: center; margin: 0;
      line-height: 1.5;
    }

    @media (max-width: 480px) {
      .bsm-dialog { padding: 24px 18px; }
    }
  `],
})
export class BranchSelectorModalComponent {
  private auth = inject(AuthService);

  activeBranchId = this.auth.activeBranchId;

  branches() {
    return this.auth.user()?.userBranches ?? [];
  }

  select(ub: UserBranch): void {
    if (!ub.branch.isActive) return;
    this.auth.selectBranch(ub.branch.id);
  }
}
