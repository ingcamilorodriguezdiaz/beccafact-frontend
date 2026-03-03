import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature {
  key: string;
  value: string;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  description: string;
  features: PlanFeature[];
}

@Component({
  selector: 'app-settings-billing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h3 style="font-size:16px;font-weight:600;margin:0 0 16px">Plan y facturación</h3>
    <div class="current-plan">
      <div class="plan-header">
        <div>
          <div class="plan-name">{{ auth.currentPlan()?.displayName ?? 'Sin plan activo' }}</div>
          <div class="plan-sub">Plan actual de tu empresa</div>
        </div>
        <span class="plan-status">ACTIVO</span>
      </div>
    </div>

    <h4 style="font-size:15px;font-weight:600;margin:24px 0 16px">Planes disponibles</h4>
    <div class="plans-grid">
      @for (plan of plans(); track plan.id) {
        <div class="plan-card" [class.current]="plan.name === auth.currentPlan()?.name">
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
            <button class="btn-upgrade">Actualizar a este plan</button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .current-plan { background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 8px; }
    .plan-header { display: flex; align-items: center; justify-content: space-between; }
    .plan-name { font-size: 18px; font-weight: 700; color: #0f172a; }
    .plan-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .plan-status { background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; }
    .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .plan-card { background: white; border-radius: 12px; padding: 24px; border: 2px solid #e2e8f0; position: relative; }
    .plan-card.current { border-color: #3b82f6; }
    .current-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 3px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .plan-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .plan-price { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .plan-price span { font-size: 14px; font-weight: 500; color: #64748b; }
    .plan-desc { font-size: 13px; color: #64748b; margin-bottom: 16px; }
    .btn-upgrade { width: 100%; background: #1d4ed8; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
    @media (max-width: 640px) {
      .plans-grid { grid-template-columns: 1fr !important; }
    }
  `],
})
export class SettingsBillingComponent implements OnInit {
  plans = signal<Plan[]>([]);
  constructor(protected auth: AuthService, private http: HttpClient) {}
  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/plans/public`).subscribe({
      next: (res) => this.plans.set(res.data ?? res ?? []),
    });
  }
}
