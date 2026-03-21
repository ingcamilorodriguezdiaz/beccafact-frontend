import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

interface KpiData {
  revenue: { current: number; previous: number; change: number };
  invoices: { current: number; previous: number };
  taxes: { current: number };
  topCustomers: Array<{ id: string; name: string; revenue: number; invoiceCount: number }>;
  topProducts: Array<{ productId: string; _sum: { total: number; quantity: number } }>;
}

interface MonthlyData {
  month: number; year: number; revenue: number; taxes: number; invoiceCount: number;
}

interface CarteraData {
  totalOutstanding: number;
  aging: { current: number; days1_30: number; days31_60: number; days61_90: number; over90: number };
  byCustomer: Array<{ customer: { name: string }; total: number; invoices: any[] }>;
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Reportes y Análisis</h2>
          <p class="page-subtitle">Métricas de negocio en tiempo real</p>
        </div>
        <div class="header-actions">
          <select [(ngModel)]="selectedYear" (ngModelChange)="loadAll()" class="filter-select">
            @for (y of years; track y) { <option [value]="y">{{ y }}</option> }
          </select>
          <select [(ngModel)]="selectedMonth" (ngModelChange)="loadKpis()" class="filter-select">
            @for (m of monthOptions; track m.value) { <option [value]="m.value">{{ m.label }}</option> }
          </select>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-green">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/></svg>
          </div>
          <div class="kpi-content">
            <div class="kpi-value">{{ fmtCOP(kpi()?.revenue?.current ?? 0) }}</div>
            <div class="kpi-label">Ingresos del mes</div>
            <div class="kpi-change" [class.up]="(kpi()?.revenue?.change ?? 0) >= 0" [class.down]="(kpi()?.revenue?.change ?? 0) < 0">
              {{ (kpi()?.revenue?.change ?? 0) >= 0 ? '▲' : '▼' }}
              {{ abs(kpi()?.revenue?.change ?? 0).toFixed(1) }}% vs mes anterior
            </div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-blue">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
          </div>
          <div class="kpi-content">
            <div class="kpi-value">{{ kpi()?.invoices?.current ?? 0 }}</div>
            <div class="kpi-label">Facturas emitidas</div>
            <div class="kpi-sub">{{ kpi()?.invoices?.previous ?? 0 }} el mes pasado</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon-purple">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3z"/></svg>
          </div>
          <div class="kpi-content">
            <div class="kpi-value">{{ fmtCOP(kpi()?.taxes?.current ?? 0) }}</div>
            <div class="kpi-label">IVA generado</div>
            <div class="kpi-sub">Mes {{ monthName(selectedMonth) }}</div>
          </div>
        </div>
        @if (auth.hasFeature('has_cartera')()) {
          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-orange">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ fmtCOP(cartera()?.totalOutstanding ?? 0) }}</div>
              <div class="kpi-label">Cartera total</div>
              <div class="kpi-sub kpi-sub-warn">Por cobrar</div>
            </div>
          </div>
        }
      </div>

      <!-- Charts row -->
      <div class="charts-row">
        <!-- Monthly revenue bar chart -->
        <div class="chart-card chart-wide">
          <div class="chart-header">
            <h3>Ingresos mensuales {{ selectedYear }}</h3>
          </div>
          @if (loadingMonthly()) {
            <div class="chart-skeleton"></div>
          } @else {
            <div class="bar-chart">
              @for (m of monthly(); track m.month) {
                <div class="bar-col">
                  <div class="bar-wrap" [title]="fmtCOP(m.revenue)">
                    <div class="bar" [style.height.%]="barHeight(m.revenue)" [class.bar-current]="m.month === selectedMonth"></div>
                  </div>
                  <div class="bar-label">{{ MONTHS[m.month-1] }}</div>
                </div>
              }
            </div>
          }
        </div>

        @if (auth.hasFeature('has_cartera')()) {
          <!-- Aging pie -->
          <div class="chart-card">
            <div class="chart-header"><h3>Cartera por vencimiento</h3></div>
            @if (loadingCartera()) {
              <div class="chart-skeleton"></div>
            } @else {
              <div class="aging-chart">
                @for (seg of agingSegments(); track seg.label) {
                  <div class="aging-row">
                    <div class="aging-dot" [style.background]="seg.color"></div>
                    <div class="aging-info">
                      <span class="aging-label">{{ seg.label }}</span>
                      <span class="aging-value">{{ fmtCOP(seg.value) }}</span>
                    </div>
                    <div class="aging-bar-wrap">
                      <div class="aging-bar-fill" [style.width.%]="seg.pct" [style.background]="seg.color"></div>
                    </div>
                    <span class="aging-pct">{{ seg.pct.toFixed(0) }}%</span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Tables row -->
      <div class="tables-row">
        <!-- Top customers -->
        <div class="rank-card">
          <div class="rank-header"><h3>Top clientes</h3><span class="rank-sub">Por ingresos este mes</span></div>
          @if (kpi()?.topCustomers?.length) {
            @for (c of kpi()!.topCustomers; track c.id; let i = $index) {
              <div class="rank-row">
                <span class="rank-num">{{ i + 1 }}</span>
                <div class="rank-avatar">{{ (c.name )[0].toUpperCase() }}</div>
                <div class="rank-info">
                  <div class="rank-name">{{ c.name }}</div>
                  <div class="rank-meta">{{ c.invoiceCount }} facturas</div>
                </div>
                <div class="rank-value">{{ fmtCOP(c.revenue) }}</div>
              </div>
            }
          } @else {
            <div class="rank-empty">Sin datos para el período</div>
          }
        </div>

        @if (auth.hasFeature('has_cartera')()) {
          <!-- Cartera por cliente -->
          <div class="rank-card">
            <div class="rank-header"><h3>Cartera por cliente</h3><span class="rank-sub">Saldo pendiente</span></div>
            @if (cartera()?.byCustomer?.length) {
              @for (c of cartera()!.byCustomer.slice(0,5); track c.customer.name) {
                <div class="rank-row">
                  <div class="rank-avatar rank-avatar-orange">{{ c.customer.name[0].toUpperCase() }}</div>
                  <div class="rank-info">
                    <div class="rank-name">{{ c.customer.name }}</div>
                    <div class="rank-meta">{{ c.invoices.length }} docs</div>
                  </div>
                  <div class="rank-bar-wrap">
                    <div class="rank-bar" [style.width.%]="carteraPct(c.total)"></div>
                  </div>
                  <div class="rank-value rank-value-orange">{{ fmtCOP(c.total) }}</div>
                </div>
              }
            } @else {
              <div class="rank-empty">Sin cartera pendiente 🎉</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width:1200px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }
    .header-actions { display:flex; gap:10px; }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; background:#fff; }

    /* KPI */
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
    .kpi-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:18px; display:flex; align-items:flex-start; gap:14px; }
    .kpi-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .kpi-icon-green { background:#d1fae5; color:#065f46; }
    .kpi-icon-blue { background:#dbeafe; color:#1e40af; }
    .kpi-icon-purple { background:#ede9fe; color:#5b21b6; }
    .kpi-icon-orange { background:#fef3c7; color:#92400e; }
    .kpi-content { min-width:0; }
    .kpi-value { font-family:'Sora',sans-serif; font-size:19px; font-weight:700; color:#0c1c35; }
    .kpi-label { font-size:12px; color:#9ca3af; margin-top:2px; }
    .kpi-change { font-size:12px; margin-top:4px; font-weight:600; }
    .kpi-change.up { color:#065f46; }
    .kpi-change.down { color:#dc2626; }
    .kpi-sub { font-size:12px; color:#9ca3af; margin-top:4px; }
    .kpi-sub-warn { color:#d97706 !important; }

    /* Charts */
    .charts-row { display:grid; grid-template-columns:1fr 380px; gap:14px; margin-bottom:20px; }
    .chart-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:18px; }
    .chart-header h3 { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0 0 16px; }
    .chart-skeleton { height:140px; background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:8px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* Bar chart */
    .bar-chart { display:flex; align-items:flex-end; gap:6px; height:140px; padding-bottom:24px; position:relative; }
    .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; }
    .bar-wrap { flex:1; width:100%; display:flex; align-items:flex-end; }
    .bar { width:100%; min-height:2px; background:#dbe8fa; border-radius:4px 4px 0 0; transition:height .3s ease; }
    .bar.bar-current { background:#1a407e; }
    .bar-label { font-size:10px; color:#9ca3af; font-weight:600; }

    /* Aging */
    .aging-chart { display:flex; flex-direction:column; gap:12px; }
    .aging-row { display:flex; align-items:center; gap:10px; }
    .aging-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .aging-info { min-width:0; flex-shrink:0; width:130px; }
    .aging-label { font-size:12px; color:#374151; display:block; }
    .aging-value { font-size:12px; font-weight:700; color:#0c1c35; }
    .aging-bar-wrap { flex:1; height:6px; background:#f0f4f8; border-radius:9999px; overflow:hidden; }
    .aging-bar-fill { height:100%; border-radius:9999px; transition:width .4s ease; }
    .aging-pct { font-size:11px; color:#9ca3af; width:32px; text-align:right; flex-shrink:0; }

    /* Tables */
    .tables-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .rank-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:18px; }
    .rank-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .rank-header h3 { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0; }
    .rank-sub { font-size:12px; color:#9ca3af; }
    .rank-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f8fafc; }
    .rank-row:last-child { border:none; }
    .rank-num { width:18px; font-size:13px; font-weight:700; color:#9ca3af; text-align:center; flex-shrink:0; }
    .rank-avatar { width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .rank-avatar-orange { background:linear-gradient(135deg,#f59e0b,#ef4444); }
    .rank-info { flex:1; min-width:0; }
    .rank-name { font-size:13.5px; font-weight:600; color:#0c1c35; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .rank-meta { font-size:11.5px; color:#9ca3af; }
    .rank-bar-wrap { flex:1; height:5px; background:#f0f4f8; border-radius:9999px; overflow:hidden; }
    .rank-bar { height:100%; background:linear-gradient(90deg,#f59e0b,#ef4444); border-radius:9999px; }
    .rank-value { font-size:13px; font-weight:700; color:#0c1c35; flex-shrink:0; }
    .rank-value-orange { color:#d97706; }
    .rank-empty { padding:24px; text-align:center; color:#9ca3af; font-size:13px; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .charts-row { grid-template-columns: 1fr !important; }
      .bottom-row { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 640px) {
      .page-header { flex-direction: column; align-items: stretch; gap: 10px; }
      .period-selector { flex-wrap: wrap; gap: 8px; }
      .period-selector select,
      .period-selector input { flex: 1; min-width: 110px; }
      .kpi-grid { grid-template-columns: 1fr 1fr !important; gap: 10px; }
      .kpi-val { font-size: 22px !important; }
    }
    @media (max-width: 480px) {
      .kpi-grid { grid-template-columns: 1fr 1fr !important; }
    }`]
})
export class ReportsComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/reports`;

  kpi = signal<KpiData | null>(null);
  monthly = signal<MonthlyData[]>([]);
  cartera = signal<CarteraData | null>(null);
  loadingMonthly = signal(true);
  loadingCartera = signal(true);

  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth() + 1;

  readonly MONTHS = MONTHS;

  years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  monthOptions = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

  constructor(private http: HttpClient, public auth: AuthService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loadKpis();
    this.loadMonthly();
    if (this.auth.hasFeature('has_cartera')()) {
      this.loadCartera();
    }
  }

  loadKpis() {
    this.http.get<KpiData>(`${this.API}/dashboard?year=${this.selectedYear}&month=${this.selectedMonth}`).subscribe({
      next: r => this.kpi.set(r),
      error: () => {}
    });
  }

  loadMonthly() {
    this.loadingMonthly.set(true);
    this.http.get<MonthlyData[]>(`${this.API}/revenue/monthly?year=${this.selectedYear}`).subscribe({
      next: r => { this.monthly.set(r); this.loadingMonthly.set(false); },
      error: () => this.loadingMonthly.set(false)
    });
  }

  loadCartera() {
    this.loadingCartera.set(true);
    this.http.get<CarteraData>(`${this.API}/cartera`).subscribe({
      next: r => { this.cartera.set(r); this.loadingCartera.set(false); },
      error: () => this.loadingCartera.set(false)
    });
  }

  barHeight(value: number): number {
    const max = Math.max(...this.monthly().map(m => Number(m.revenue)), 1);
    return (Number(value) / max) * 100;
  }

  agingSegments() {
    const a = this.cartera()?.aging;
    if (!a) return [];
    const total = Object.values(a).reduce((s: number, v: any) => s + Number(v), 0) || 1;
    return [
      { label: 'Al día', value: Number(a.current), color: '#10b981', pct: (Number(a.current) / total) * 100 },
      { label: '1–30 días', value: Number(a.days1_30), color: '#f59e0b', pct: (Number(a.days1_30) / total) * 100 },
      { label: '31–60 días', value: Number(a.days31_60), color: '#ef4444', pct: (Number(a.days31_60) / total) * 100 },
      { label: '61–90 días', value: Number(a.days61_90), color: '#dc2626', pct: (Number(a.days61_90) / total) * 100 },
      { label: '> 90 días', value: Number(a.over90), color: '#991b1b', pct: (Number(a.over90) / total) * 100 },
    ];
  }

  carteraPct(value: number): number {
    const max = Math.max(...(this.cartera()?.byCustomer ?? []).map(c => c.total), 1);
    return (value / max) * 100;
  }

  monthName(m: number): string { return MONTHS[m - 1] ?? ''; }

  fmtCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v));
  }

  abs(n: number) { return Math.abs(n); }
}