import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature { key: string; value: string; }
interface Plan { id:string; name:string; displayName:string; price:number; description:string; features:PlanFeature[]; }

@Component({
  selector: 'app-settings-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div class="section-header">
        <div>
          <h3 class="section-title">Plan y facturación</h3>
          <p class="section-sub">Gestiona tu suscripción y límites de uso</p>
        </div>

        @if (!canManage()) {
          <div class="readonly-badge">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
            </svg>
            Solo lectura
          </div>
        }
      </div>

      <!-- Plan activo -->
      <div class="current-plan-card">
        @if (loading()) {
          <div class="sk" style="width:140px;height:20px;margin-bottom:6px"></div>
          <div class="sk" style="width:80px;height:13px"></div>
        } @else {
          <div class="cp-header">
            <div>
              <div class="cp-name">{{ auth.currentPlan()?.displayName ?? 'Sin plan activo' }}</div>
              <div class="cp-sub">Plan actual de tu empresa</div>
            </div>
            <span class="status-active">ACTIVO</span>
          </div>
        }
      </div>

      <!-- Planes disponibles -->
      <h4 class="plans-heading">Planes disponibles</h4>
      <div class="plans-grid">
        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="plan-card">
              <div class="sk" style="width:80px;height:18px;margin-bottom:10px"></div>
              <div class="sk" style="width:110px;height:28px;margin-bottom:8px"></div>
              <div class="sk" style="width:100%;height:36px;border-radius:8px;margin-top:16px"></div>
            </div>
          }
        } @else {
          @for (plan of plans(); track plan.id) {
            <div class="plan-card" [class.plan-card--current]="plan.name === auth.currentPlan()?.name">
              @if (plan.name === auth.currentPlan()?.name) {
                <div class="current-badge">Plan actual</div>
              }
              <div class="plan-title">{{ plan.displayName }}</div>
              <div class="plan-price">
                {{ plan.price | currency:'COP':'symbol':'1.0-0' }}<span>/mes</span>
              </div>
              @if (plan.description) {
                <div class="plan-desc">{{ plan.description }}</div>
              }
              @if (plan.name !== auth.currentPlan()?.name) {
                @if (canManage()) {
                  <button class="btn btn-primary btn--full">Actualizar a este plan</button>
                } @else {
                  <div class="locked-action">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                      <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/>
                    </svg>
                    Requiere Administrador
                  </div>
                }
              }
            </div>
          }
        }
      </div>

      @if (!canManage()) {
        <div class="info-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
          </svg>
          Solo los administradores y gerentes pueden cambiar el plan de la empresa.
        </div>
      }
    </div>
  `,
  styles: [`
    .section-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .section-title { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .section-sub { font-size:13px; color:#9ca3af; margin:0; }

    .readonly-badge {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 13px; border-radius:8px;
      background:#f8fafc; border:1px solid #dce6f0;
      font-size:12.5px; font-weight:600; color:#9ca3af;
    }

    .current-plan-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:20px 24px; margin-bottom:8px; }
    .cp-header { display:flex; align-items:center; justify-content:space-between; }
    .cp-name { font-size:18px; font-weight:700; color:#0c1c35; }
    .cp-sub { font-size:13px; color:#64748b; margin-top:4px; }
    .status-active { background:#dcfce7; color:#166534; padding:4px 12px; border-radius:9999px; font-size:12px; font-weight:700; }

    .plans-heading { font-size:15px; font-weight:700; color:#0c1c35; margin:24px 0 14px; }
    .plans-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; }

    .plan-card { background:#fff; border:2px solid #dce6f0; border-radius:12px; padding:24px; position:relative; }
    .plan-card--current { border-color:#3b82f6; }
    .current-badge { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#3b82f6; color:#fff; padding:3px 12px; border-radius:9999px; font-size:12px; font-weight:700; white-space:nowrap; }
    .plan-title { font-size:16px; font-weight:700; color:#0c1c35; margin-bottom:8px; }
    .plan-price { font-size:24px; font-weight:800; color:#0f172a; margin-bottom:8px; }
    .plan-price span { font-size:14px; font-weight:500; color:#64748b; }
    .plan-desc { font-size:13px; color:#64748b; margin-bottom:16px; }

    .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover { background:#15336a; }
    .btn--full { width:100%; }
    .locked-action {
      display:flex; align-items:center; justify-content:center; gap:6px;
      padding:9px; border-radius:8px;
      background:#f8fafc; border:1px solid #dce6f0;
      font-size:12.5px; font-weight:600; color:#9ca3af;
    }

    .info-banner {
      display:flex; align-items:center; gap:8px;
      margin-top:14px; padding:10px 14px;
      background:#eff6ff; border:1px solid #bfdbfe;
      border-radius:10px; font-size:13px; color:#1e40af;
    }

    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; display:block; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  `]
})
export class SettingsBillingComponent implements OnInit {
  protected auth = inject(AuthService);
  private http   = inject(HttpClient);

  plans   = signal<Plan[]>([]);
  loading = signal(true);

  private userRoles = computed(() => this.auth.user()?.roles ?? []);
  canManage = computed(() => this.userRoles().some(r => r === 'ADMIN' || r === 'MANAGER'));

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/plans/public`).subscribe({
      next: res => { this.plans.set(res.data ?? res ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}