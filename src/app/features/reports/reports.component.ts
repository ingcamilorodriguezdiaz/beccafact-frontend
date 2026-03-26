import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface KpiData {
  revenue: { current: number; previous: number; change: number };
  invoices: { current: number; previous: number };
  taxes: { current: number };
  topCustomers: Array<{ id: string; name: string; revenue: number; invoiceCount: number }>;
  topProducts: Array<{ productId: string; _sum: { total: number; quantity: number } }>;
}

interface MonthlyData {
  month: number;
  year: number;
  revenue: number;
  taxes: number;
  invoiceCount: number;
}

interface CollectionsDashData {
  totalOutstanding: number;
  aging: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    over90: number;
  };
  byCustomer: Array<{ customer: { name: string }; total: number; invoices: any[] }>;
}

interface InvoicesReport {
  summary: {
    total: number;
    subtotal: number;
    taxes: number;
    count: number;
  };
  items: Array<{
    id: string;
    number: string;
    date: string;
    customer: { name: string };
    subtotal: number;
    taxes: number;
    total: number;
    status: string;
    dianStatus: string;
  }>;
}

interface PayrollReport {
  summary: {
    count: number;
    totalEarnings: number;
    totalDeductions: number;
    totalNet: number;
  };
  items: Array<{
    id: string;
    period: string;
    employeeName: string;
    document: string;
    type: string;
    baseSalary: number;
    totalEarnings: number;
    totalDeductions: number;
    totalNet: number;
    status: string;
  }>;
}

interface PosReport {
  summary: {
    sessions: number;
    transactions: number;
    totalSales: number;
  };
  items: Array<{
    id: string;
    date: string;
    cashierName: string;
    status: string;
    openingCash: number;
    closingCash: number;
    totalSales: number;
    transactionCount: number;
  }>;
}

interface CollectionsReport {
  summary: {
    totalBalance: number;
    current: number;
    overdue1_30: number;
    overdue31_60: number;
    overdue61_90: number;
    overdueOver90: number;
  };
  items: Array<{
    id: string;
    number: string;
    customerName: string;
    customerDocument: string;
    issueDate: string;
    dueDate: string;
    daysOverdue: number;
    total: number;
    aging: string;
  }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type TabId = 'dashboard' | 'invoices' | 'payroll' | 'pos' | 'collections';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Page header ─────────────────────────────────────────────── -->
      <div class="page-header" id="tour-reports-header">
        <div>
          <h2 class="page-title">Reportes y Análisis</h2>
          <p class="page-subtitle">Métricas de negocio en tiempo real</p>
        </div>
        @if (activeTab() === 'dashboard') {
          <div class="header-actions">
            <select [(ngModel)]="selectedYear" (ngModelChange)="loadAll()" class="filter-select">
              @for (y of years; track y) { <option [value]="y">{{ y }}</option> }
            </select>
            <select [(ngModel)]="selectedMonth" (ngModelChange)="loadKpis()" class="filter-select">
              @for (m of monthOptions; track m.value) {
                <option [value]="m.value">{{ m.label }}</option>
              }
            </select>
          </div>
        }
      </div>

      <!-- ── Tab navigation ──────────────────────────────────────────── -->
      <div class="report-tabs">
        <button class="tab-btn" [class.active]="activeTab() === 'dashboard'" (click)="setTab('dashboard')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
          </svg>
          Dashboard
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'invoices'" (click)="setTab('invoices')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
          </svg>
          Facturación
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'payroll'" (click)="setTab('payroll')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
          </svg>
          Nómina
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'pos'" (click)="setTab('pos')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
            <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
          </svg>
          POS
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'collections'" (click)="setTab('collections')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/>
          </svg>
          Cartera
        </button>
      </div>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- TAB: DASHBOARD                                              -->
      <!-- ════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'dashboard') {

        <!-- KPI Cards -->
        <div class="kpi-grid" id="tour-kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-green">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ fmtCOP(kpi()?.revenue?.current ?? 0) }}</div>
              <div class="kpi-label">Ingresos del mes</div>
              <div class="kpi-change"
                   [class.up]="(kpi()?.revenue?.change ?? 0) >= 0"
                   [class.down]="(kpi()?.revenue?.change ?? 0) < 0">
                {{ (kpi()?.revenue?.change ?? 0) >= 0 ? '▲' : '▼' }}
                {{ abs(kpi()?.revenue?.change ?? 0).toFixed(1) }}% vs mes anterior
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-blue">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
              </svg>
            </div>
            <div class="kpi-content">
              <div class="kpi-value">{{ kpi()?.invoices?.current ?? 0 }}</div>
              <div class="kpi-label">Facturas emitidas</div>
              <div class="kpi-sub">{{ kpi()?.invoices?.previous ?? 0 }} el mes pasado</div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon kpi-icon-purple">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20">
                <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3z"/>
              </svg>
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
                <svg viewBox="0 0 20 20" fill="currentColor" width="20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                </svg>
              </div>
              <div class="kpi-content">
                <div class="kpi-value">{{ fmtCOP(collectionsDash()?.totalOutstanding ?? 0) }}</div>
                <div class="kpi-label">Cartera total</div>
                <div class="kpi-sub kpi-sub-warn">Por cobrar</div>
              </div>
            </div>
          }
        </div>

        <!-- Charts row -->
        <div class="charts-row" id="tour-charts">
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
                      <div class="bar"
                           [style.height.%]="barHeight(m.revenue)"
                           [class.bar-current]="m.month === selectedMonth">
                      </div>
                    </div>
                    <div class="bar-label">{{ MONTHS[m.month - 1] }}</div>
                  </div>
                }
              </div>
            }
          </div>

          @if (auth.hasFeature('has_cartera')()) {
            <!-- Aging pie -->
            <div class="chart-card">
              <div class="chart-header"><h3>Cartera por vencimiento</h3></div>
              @if (loadingCollectionsDash()) {
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
                        <div class="aging-bar-fill"
                             [style.width.%]="seg.pct"
                             [style.background]="seg.color">
                        </div>
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
            <div class="rank-header">
              <h3>Top clientes</h3>
              <span class="rank-sub">Por ingresos este mes</span>
            </div>
            @if (kpi()?.topCustomers?.length) {
              @for (c of kpi()!.topCustomers; track c.id; let i = $index) {
                <div class="rank-row">
                  <span class="rank-num">{{ i + 1 }}</span>
                  <div class="rank-avatar">{{ c.name[0].toUpperCase() }}</div>
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
              <div class="rank-header">
                <h3>Cartera por cliente</h3>
                <span class="rank-sub">Saldo pendiente</span>
              </div>
              @if (collectionsDash()?.byCustomer?.length) {
                @for (c of collectionsDash()!.byCustomer.slice(0, 5); track c.customer.name) {
                  <div class="rank-row">
                    <div class="rank-avatar rank-avatar-orange">{{ c.customer.name[0].toUpperCase() }}</div>
                    <div class="rank-info">
                      <div class="rank-name">{{ c.customer.name }}</div>
                      <div class="rank-meta">{{ c.invoices.length }} docs</div>
                    </div>
                    <div class="rank-bar-wrap">
                      <div class="rank-bar" [style.width.%]="collectionsPct(c.total)"></div>
                    </div>
                    <div class="rank-value rank-value-orange">{{ fmtCOP(c.total) }}</div>
                  </div>
                }
              } @else {
                <div class="rank-empty">Sin cartera pendiente</div>
              }
            </div>
          }
        </div>
      }

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- TAB: FACTURACIÓN                                            -->
      <!-- ════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'invoices') {
        <div class="tab-content">

          <!-- Filters -->
          <div class="report-filters">
            <div class="filter-group">
              <label class="filter-label">Desde</label>
              <input type="date" class="filter-input" [(ngModel)]="invoicesFromVal"
                     (ngModelChange)="invoicesFrom.set($event)">
            </div>
            <div class="filter-group">
              <label class="filter-label">Hasta</label>
              <input type="date" class="filter-input" [(ngModel)]="invoicesToVal"
                     (ngModelChange)="invoicesTo.set($event)">
            </div>
            <div class="filter-group">
              <label class="filter-label">Estado</label>
              <select class="filter-input" [(ngModel)]="invoicesStatusVal"
                      (ngModelChange)="invoicesStatus.set($event)">
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="ISSUED">Emitida</option>
                <option value="ACCEPTED_DIAN">Aceptado DIAN</option>
                <option value="REJECTED_DIAN">Rechazado DIAN</option>
                <option value="CANCELLED">Anulada</option>
              </select>
            </div>
            <button class="btn-consultar" (click)="loadInvoices()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              Consultar
            </button>
            <div class="export-btns">
              <button class="btn-excel" (click)="downloadXlsx('invoices')"
                      [disabled]="downloadingXlsx()" [class.loading]="downloadingXlsx()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                </svg>
                {{ downloadingXlsx() ? 'Descargando...' : 'Excel' }}
              </button>
              <button class="btn-pdf" (click)="printReport()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v-1h1v1zm7 0h1v-1h-1v1zm-7 2v-1h8v1H6z"/>
                </svg>
                PDF
              </button>
            </div>
          </div>

          <!-- Summary cards -->
          @if (invoicesData()) {
            <div class="summary-row">
              <div class="summary-mini-card">
                <div class="smc-value">{{ invoicesData()!.summary.count }}</div>
                <div class="smc-label">Total Facturas</div>
              </div>
              <div class="summary-mini-card">
                <div class="smc-value">{{ fmtCOP(invoicesData()!.summary.subtotal) }}</div>
                <div class="smc-label">Subtotal</div>
              </div>
              <div class="summary-mini-card smc-accent">
                <div class="smc-value">{{ fmtCOP(invoicesData()!.summary.taxes) }}</div>
                <div class="smc-label">IVA</div>
              </div>
              <div class="summary-mini-card smc-primary">
                <div class="smc-value">{{ fmtCOP(invoicesData()!.summary.total) }}</div>
                <div class="smc-label">Total</div>
              </div>
            </div>
          }

          <!-- Loading skeleton -->
          @if (invoicesLoading()) {
            <div class="table-skeleton">
              @for (i of skeletonRows; track i) {
                <div class="skeleton-row">
                  <div class="skeleton-cell sk-sm"></div>
                  <div class="skeleton-cell sk-md"></div>
                  <div class="skeleton-cell sk-sm"></div>
                  <div class="skeleton-cell sk-lg"></div>
                  <div class="skeleton-cell sk-md"></div>
                  <div class="skeleton-cell sk-md"></div>
                  <div class="skeleton-cell sk-md"></div>
                  <div class="skeleton-cell sk-sm"></div>
                  <div class="skeleton-cell sk-sm"></div>
                </div>
              }
            </div>
          }

          <!-- Data table -->
          @if (!invoicesLoading() && invoicesData()) {
            <div class="report-table-wrap printable">
              <div class="print-header">
                <h3>Reporte de Facturación</h3>
                <p>Período: {{ invoicesFrom() }} – {{ invoicesTo() }}</p>
              </div>
              @if (invoicesData()!.items.length === 0) {
                <div class="empty-state">
                  <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                    <circle cx="24" cy="24" r="20" stroke="#dce6f0" stroke-width="2"/>
                    <path d="M16 24h16M24 16v16" stroke="#dce6f0" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <p>No se encontraron facturas para el período seleccionado.</p>
                </div>
              } @else {
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th class="text-right">Subtotal</th>
                      <th class="text-right">IVA</th>
                      <th class="text-right">Total</th>
                      <th>Estado</th>
                      <th>Estado DIAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of invoicesData()!.items; track item.id; let i = $index) {
                      <tr>
                        <td class="td-num">{{ i + 1 }}</td>
                        <td class="td-mono">{{ item.number }}</td>
                        <td class="td-date">{{ fmtDate(item.date) }}</td>
                        <td>{{ item?.customer?.name }}</td>
                        <td class="text-right">{{ fmtCOP(item.subtotal) }}</td>
                        <td class="text-right">{{ fmtCOP(item.taxes) }}</td>
                        <td class="text-right td-bold">{{ fmtCOP(item.total) }}</td>
                        <td>
                          <span class="badge" [class]="statusClass(item.status)">
                            {{ fmtStatus(item.status) }}
                          </span>
                        </td>
                        <td>
                          <span class="badge" [class]="dianStatusClass(item.dianStatus)">
                            {{ fmtDianStatus(item.dianStatus) }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }

          <!-- Not loaded yet -->
          @if (!invoicesLoading() && !invoicesData()) {
            <div class="empty-state empty-state-idle">
              <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                <circle cx="24" cy="24" r="20" stroke="#dce6f0" stroke-width="2"/>
                <path d="M16 24h4l4-8 4 12 4-8h4" stroke="#7ea3cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>Selecciona un rango de fechas y haz clic en <strong>Consultar</strong>.</p>
            </div>
          }
        </div>
      }

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- TAB: NÓMINA                                                 -->
      <!-- ════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'payroll') {
        <div class="tab-content">

          <div class="report-filters">
            <div class="filter-group">
              <label class="filter-label">Desde</label>
              <input type="date" class="filter-input" [(ngModel)]="payrollFromVal"
                     (ngModelChange)="payrollFrom.set($event)">
            </div>
            <div class="filter-group">
              <label class="filter-label">Hasta</label>
              <input type="date" class="filter-input" [(ngModel)]="payrollToVal"
                     (ngModelChange)="payrollTo.set($event)">
            </div>
            <button class="btn-consultar" (click)="loadPayroll()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              Consultar
            </button>
            <div class="export-btns">
              <button class="btn-excel" (click)="downloadXlsx('payroll')"
                      [disabled]="downloadingXlsx()" [class.loading]="downloadingXlsx()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                </svg>
                {{ downloadingXlsx() ? 'Descargando...' : 'Excel' }}
              </button>
              <button class="btn-pdf" (click)="printReport()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v-1h1v1zm7 0h1v-1h-1v1zm-7 2v-1h8v1H6z"/>
                </svg>
                PDF
              </button>
            </div>
          </div>

          @if (payrollData()) {
            <div class="summary-row">
              <div class="summary-mini-card">
                <div class="smc-value">{{ payrollData()!.summary.count }}</div>
                <div class="smc-label">Registros</div>
              </div>
              <div class="summary-mini-card smc-green">
                <div class="smc-value">{{ fmtCOP(payrollData()!.summary.totalEarnings) }}</div>
                <div class="smc-label">Total Devengado</div>
              </div>
              <div class="summary-mini-card smc-red">
                <div class="smc-value">{{ fmtCOP(payrollData()!.summary.totalDeductions) }}</div>
                <div class="smc-label">Total Deducciones</div>
              </div>
              <div class="summary-mini-card smc-primary">
                <div class="smc-value">{{ fmtCOP(payrollData()!.summary.totalNet) }}</div>
                <div class="smc-label">Total Neto</div>
              </div>
            </div>
          }

          @if (payrollLoading()) {
            <div class="table-skeleton">
              @for (i of skeletonRows; track i) {
                <div class="skeleton-row">
                  @for (j of [1,2,3,4,5,6,7,8,9,10]; track j) {
                    <div class="skeleton-cell sk-md"></div>
                  }
                </div>
              }
            </div>
          }

          @if (!payrollLoading() && payrollData()) {
            <div class="report-table-wrap printable">
              <div class="print-header">
                <h3>Reporte de Nómina</h3>
                <p>Período: {{ payrollFrom() }} – {{ payrollTo() }}</p>
              </div>
              @if (payrollData()!.items.length === 0) {
                <div class="empty-state">
                  <p>No se encontraron registros de nómina para el período seleccionado.</p>
                </div>
              } @else {
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Período</th>
                      <th>Empleado</th>
                      <th>Documento</th>
                      <th>Tipo</th>
                      <th class="text-right">Salario Base</th>
                      <th class="text-right">Devengado</th>
                      <th class="text-right">Deducciones</th>
                      <th class="text-right">Neto a Pagar</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of payrollData()!.items; track item.id; let i = $index) {
                      <tr>
                        <td class="td-num">{{ i + 1 }}</td>
                        <td class="td-date">{{ item.period }}</td>
                        <td>{{ item.employeeName }}</td>
                        <td class="td-mono">{{ item.document }}</td>
                        <td>{{ item.type }}</td>
                        <td class="text-right">{{ fmtCOP(item.baseSalary) }}</td>
                        <td class="text-right td-green">{{ fmtCOP(item.totalEarnings) }}</td>
                        <td class="text-right td-red">{{ fmtCOP(item.totalDeductions) }}</td>
                        <td class="text-right td-bold">{{ fmtCOP(item.totalNet) }}</td>
                        <td>
                          <span class="badge" [class]="nominaStatusClass(item.status)">
                            {{ fmtNominaStatus(item.status) }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }

          @if (!payrollLoading() && !payrollData()) {
            <div class="empty-state empty-state-idle">
              <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                <circle cx="24" cy="24" r="20" stroke="#dce6f0" stroke-width="2"/>
                <path d="M16 24h4l4-8 4 12 4-8h4" stroke="#7ea3cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>Selecciona un rango de fechas y haz clic en <strong>Consultar</strong>.</p>
            </div>
          }
        </div>
      }

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- TAB: POS                                                    -->
      <!-- ════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'pos') {
        <div class="tab-content">

          <div class="report-filters">
            <div class="filter-group">
              <label class="filter-label">Desde</label>
              <input type="date" class="filter-input" [(ngModel)]="posFromVal"
                     (ngModelChange)="posFrom.set($event)">
            </div>
            <div class="filter-group">
              <label class="filter-label">Hasta</label>
              <input type="date" class="filter-input" [(ngModel)]="posToVal"
                     (ngModelChange)="posTo.set($event)">
            </div>
            <button class="btn-consultar" (click)="loadPos()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              Consultar
            </button>
            <div class="export-btns">
              <button class="btn-excel" (click)="downloadXlsx('pos')"
                      [disabled]="downloadingXlsx()" [class.loading]="downloadingXlsx()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                </svg>
                {{ downloadingXlsx() ? 'Descargando...' : 'Excel' }}
              </button>
              <button class="btn-pdf" (click)="printReport()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v-1h1v1zm7 0h1v-1h-1v1zm-7 2v-1h8v1H6z"/>
                </svg>
                PDF
              </button>
            </div>
          </div>

          @if (posData()) {
            <div class="summary-row">
              <div class="summary-mini-card">
                <div class="smc-value">{{ posData()!.summary.sessions }}</div>
                <div class="smc-label">Sesiones POS</div>
              </div>
              <div class="summary-mini-card smc-accent">
                <div class="smc-value">{{ posData()!.summary.transactions }}</div>
                <div class="smc-label">Transacciones</div>
              </div>
              <div class="summary-mini-card smc-primary">
                <div class="smc-value">{{ fmtCOP(posData()!.summary.totalSales) }}</div>
                <div class="smc-label">Total Ventas</div>
              </div>
            </div>
          }

          @if (posLoading()) {
            <div class="table-skeleton">
              @for (i of skeletonRows; track i) {
                <div class="skeleton-row">
                  @for (j of [1,2,3,4,5,6,7,8]; track j) {
                    <div class="skeleton-cell sk-md"></div>
                  }
                </div>
              }
            </div>
          }

          @if (!posLoading() && posData()) {
            <div class="report-table-wrap printable">
              <div class="print-header">
                <h3>Reporte POS</h3>
                <p>Período: {{ posFrom() }} – {{ posTo() }}</p>
              </div>
              @if (posData()!.items.length === 0) {
                <div class="empty-state">
                  <p>No se encontraron sesiones POS para el período seleccionado.</p>
                </div>
              } @else {
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Cajero</th>
                      <th>Estado</th>
                      <th class="text-right">Ef. Inicial</th>
                      <th class="text-right">Ef. Final</th>
                      <th class="text-right">Total Ventas</th>
                      <th class="text-right"># Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of posData()!.items; track item.id; let i = $index) {
                      <tr>
                        <td class="td-num">{{ i + 1 }}</td>
                        <td class="td-date">{{ fmtDate(item.date) }}</td>
                        <td>{{ item.cashierName }}</td>
                        <td>
                          <span class="badge" [class]="posStatusClass(item.status)">
                            {{ fmtPosStatus(item.status) }}
                          </span>
                        </td>
                        <td class="text-right">{{ fmtCOP(item.openingCash) }}</td>
                        <td class="text-right">{{ fmtCOP(item.closingCash) }}</td>
                        <td class="text-right td-bold">{{ fmtCOP(item.totalSales) }}</td>
                        <td class="text-right">{{ item.transactionCount }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }

          @if (!posLoading() && !posData()) {
            <div class="empty-state empty-state-idle">
              <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                <circle cx="24" cy="24" r="20" stroke="#dce6f0" stroke-width="2"/>
                <path d="M16 24h4l4-8 4 12 4-8h4" stroke="#7ea3cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>Selecciona un rango de fechas y haz clic en <strong>Consultar</strong>.</p>
            </div>
          }
        </div>
      }

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- TAB: CARTERA                                                -->
      <!-- ════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'collections') {
        <div class="tab-content">

          <div class="report-filters">
            <div class="filter-group">
              <label class="filter-label">Corte al día</label>
              <input type="date" class="filter-input" [(ngModel)]="collectionsAsOfVal"
                     (ngModelChange)="collectionsAsOf.set($event)">
            </div>
            <button class="btn-consultar" (click)="loadCollections()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              Consultar
            </button>
            <div class="export-btns">
              <button class="btn-excel" (click)="downloadXlsx('collections/detail')"
                      [disabled]="downloadingXlsx()" [class.loading]="downloadingXlsx()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
                </svg>
                {{ downloadingXlsx() ? 'Descargando...' : 'Excel' }}
              </button>
              <button class="btn-pdf" (click)="printReport()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v-1h1v1zm7 0h1v-1h-1v1zm-7 2v-1h8v1H6z"/>
                </svg>
                PDF
              </button>
            </div>
          </div>

          @if (collectionsData()) {
            <div class="summary-row summary-row-5">
              <div class="summary-mini-card smc-primary">
                <div class="smc-value">{{ fmtCOP(collectionsData()!.summary.totalBalance) }}</div>
                <div class="smc-label">Total Cartera</div>
              </div>
              <div class="summary-mini-card smc-green">
                <div class="smc-value">{{ fmtCOP(collectionsData()!.summary.current) }}</div>
                <div class="smc-label">Al Día</div>
              </div>
              <div class="summary-mini-card smc-yellow">
                <div class="smc-value">{{ fmtCOP(collectionsData()!.summary.overdue1_30) }}</div>
                <div class="smc-label">Vencido 1–30 días</div>
              </div>
              <div class="summary-mini-card smc-orange">
                <div class="smc-value">{{ fmtCOP(collectionsData()!.summary.overdue31_60) }}</div>
                <div class="smc-label">Vencido 31–60 días</div>
              </div>
              <div class="summary-mini-card smc-red">
                <div class="smc-value">{{ fmtCOP(collectionsData()!.summary.overdueOver90) }}</div>
                <div class="smc-label">Vencido +90 días</div>
              </div>
            </div>
          }

          @if (collectionsLoading()) {
            <div class="table-skeleton">
              @for (i of skeletonRows; track i) {
                <div class="skeleton-row">
                  @for (j of [1,2,3,4,5,6,7,8,9]; track j) {
                    <div class="skeleton-cell sk-md"></div>
                  }
                </div>
              }
            </div>
          }

          @if (!collectionsLoading() && collectionsData()) {
            <div class="report-table-wrap printable">
              <div class="print-header">
                <h3>Reporte de Cartera</h3>
                <p>Corte al: {{ collectionsAsOf() }}</p>
              </div>
              @if (collectionsData()!.items.length === 0) {
                <div class="empty-state">
                  <p>No se encontró cartera pendiente al corte seleccionado.</p>
                </div>
              } @else {
                <table class="report-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Número</th>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>F. Emisión</th>
                      <th>F. Vencimiento</th>
                      <th class="text-right">Días Vencido</th>
                      <th class="text-right">Total</th>
                      <th>Antigüedad</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of collectionsData()!.items; track item.id; let i = $index) {
                      <tr>
                        <td class="td-num">{{ i + 1 }}</td>
                        <td class="td-mono">{{ item.number }}</td>
                        <td>{{ item.customerName }}</td>
                        <td class="td-mono">{{ item.customerDocument }}</td>
                        <td class="td-date">{{ fmtDate(item.issueDate) }}</td>
                        <td class="td-date">{{ fmtDate(item.dueDate) }}</td>
                        <td class="text-right" [class.td-red]="item.daysOverdue > 0">
                          {{ item.daysOverdue > 0 ? item.daysOverdue : '—' }}
                        </td>
                        <td class="text-right td-bold">{{ fmtCOP(item.total) }}</td>
                        <td>
                          <span class="badge" [class]="agingClass(item.aging)">
                            {{ fmtAging(item.aging) }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }

          @if (!collectionsLoading() && !collectionsData()) {
            <div class="empty-state empty-state-idle">
              <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                <circle cx="24" cy="24" r="20" stroke="#dce6f0" stroke-width="2"/>
                <path d="M16 24h4l4-8 4 12 4-8h4" stroke="#7ea3cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p>Selecciona la fecha de corte y haz clic en <strong>Consultar</strong>.</p>
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    /* ── Base ──────────────────────────────────────────────────────── */
    .page { max-width: 1280px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
    .page-title { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 700; color: #0c1c35; margin: 0 0 4px; }
    .page-subtitle { font-size: 13px; color: #7ea3cc; margin: 0; }
    .header-actions { display: flex; gap: 10px; }
    .filter-select { padding: 8px 12px; border: 1px solid #dce6f0; border-radius: 8px; font-size: 13.5px; outline: none; background: #fff; }

    /* ── KPI ───────────────────────────────────────────────────────── */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
    .kpi-card { background: #fff; border: 1px solid #dce6f0; border-radius: 12px; padding: 18px; display: flex; align-items: flex-start; gap: 14px; }
    .kpi-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .kpi-icon-green { background: #d1fae5; color: #065f46; }
    .kpi-icon-blue { background: #dbeafe; color: #1e40af; }
    .kpi-icon-purple { background: #ede9fe; color: #5b21b6; }
    .kpi-icon-orange { background: #fef3c7; color: #92400e; }
    .kpi-content { min-width: 0; }
    .kpi-value { font-family: 'Sora', sans-serif; font-size: 19px; font-weight: 700; color: #0c1c35; }
    .kpi-label { font-size: 12px; color: #9ca3af; margin-top: 2px; }
    .kpi-change { font-size: 12px; margin-top: 4px; font-weight: 600; }
    .kpi-change.up { color: #065f46; }
    .kpi-change.down { color: #dc2626; }
    .kpi-sub { font-size: 12px; color: #9ca3af; margin-top: 4px; }
    .kpi-sub-warn { color: #d97706 !important; }

    /* ── Charts ────────────────────────────────────────────────────── */
    .charts-row { display: grid; grid-template-columns: 1fr 380px; gap: 14px; margin-bottom: 20px; }
    .chart-card { background: #fff; border: 1px solid #dce6f0; border-radius: 12px; padding: 18px; }
    .chart-header h3 { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: #0c1c35; margin: 0 0 16px; }
    .chart-skeleton { height: 140px; background: linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
    @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

    /* ── Bar chart ─────────────────────────────────────────────────── */
    .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-bottom: 24px; position: relative; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
    .bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
    .bar { width: 100%; min-height: 2px; background: #dbe8fa; border-radius: 4px 4px 0 0; transition: height .3s ease; }
    .bar.bar-current { background: #1a407e; }
    .bar-label { font-size: 10px; color: #9ca3af; font-weight: 600; }

    /* ── Aging ─────────────────────────────────────────────────────── */
    .aging-chart { display: flex; flex-direction: column; gap: 12px; }
    .aging-row { display: flex; align-items: center; gap: 10px; }
    .aging-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .aging-info { min-width: 0; flex-shrink: 0; width: 130px; }
    .aging-label { font-size: 12px; color: #374151; display: block; }
    .aging-value { font-size: 12px; font-weight: 700; color: #0c1c35; }
    .aging-bar-wrap { flex: 1; height: 6px; background: #f0f4f8; border-radius: 9999px; overflow: hidden; }
    .aging-bar-fill { height: 100%; border-radius: 9999px; transition: width .4s ease; }
    .aging-pct { font-size: 11px; color: #9ca3af; width: 32px; text-align: right; flex-shrink: 0; }

    /* ── Tables (dashboard) ────────────────────────────────────────── */
    .tables-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .rank-card { background: #fff; border: 1px solid #dce6f0; border-radius: 12px; padding: 18px; }
    .rank-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .rank-header h3 { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: #0c1c35; margin: 0; }
    .rank-sub { font-size: 12px; color: #9ca3af; }
    .rank-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f8fafc; }
    .rank-row:last-child { border: none; }
    .rank-num { width: 18px; font-size: 13px; font-weight: 700; color: #9ca3af; text-align: center; flex-shrink: 0; }
    .rank-avatar { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #1a407e, #00c6a0); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .rank-avatar-orange { background: linear-gradient(135deg, #f59e0b, #ef4444); }
    .rank-info { flex: 1; min-width: 0; }
    .rank-name { font-size: 13.5px; font-weight: 600; color: #0c1c35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rank-meta { font-size: 11.5px; color: #9ca3af; }
    .rank-bar-wrap { flex: 1; height: 5px; background: #f0f4f8; border-radius: 9999px; overflow: hidden; }
    .rank-bar { height: 100%; background: linear-gradient(90deg, #f59e0b, #ef4444); border-radius: 9999px; }
    .rank-value { font-size: 13px; font-weight: 700; color: #0c1c35; flex-shrink: 0; }
    .rank-value-orange { color: #d97706; }
    .rank-empty { padding: 24px; text-align: center; color: #9ca3af; font-size: 13px; }

    /* ── Tab navigation ────────────────────────────────────────────── */
    .report-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 20px;
      background: #f4f7fb;
      border-radius: 12px;
      padding: 4px;
      border: 1px solid #dce6f0;
      flex-wrap: wrap;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 9px;
      background: transparent;
      font-size: 13.5px;
      font-weight: 500;
      color: #7ea3cc;
      cursor: pointer;
      transition: all .15s ease;
      white-space: nowrap;
    }
    .tab-btn:hover { background: #e8eef8; color: #1a407e; }
    .tab-btn.active {
      background: #fff;
      color: #1a407e;
      font-weight: 700;
      box-shadow: 0 1px 4px rgba(26,64,126,.12);
    }

    /* ── Tab content ───────────────────────────────────────────────── */
    .tab-content { display: flex; flex-direction: column; gap: 16px; }

    /* ── Report filters ────────────────────────────────────────────── */
    .report-filters {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      background: #fff;
      border: 1px solid #dce6f0;
      border-radius: 12px;
      padding: 16px 20px;
      flex-wrap: wrap;
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-label { font-size: 11.5px; font-weight: 600; color: #7ea3cc; text-transform: uppercase; letter-spacing: .4px; }
    .filter-input {
      padding: 8px 12px;
      border: 1px solid #dce6f0;
      border-radius: 8px;
      font-size: 13.5px;
      outline: none;
      background: #f9fbfd;
      color: #0c1c35;
      transition: border-color .15s;
    }
    .filter-input:focus { border-color: #1a407e; background: #fff; }

    .btn-consultar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: #1a407e;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s;
      margin-top: auto;
    }
    .btn-consultar:hover { background: #153469; }

    .export-btns { display: flex; gap: 8px; margin-left: auto; align-items: flex-end; }

    .btn-excel {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      background: #166534;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s, opacity .15s;
    }
    .btn-excel:hover:not(:disabled) { background: #14532d; }
    .btn-excel:disabled, .btn-excel.loading { opacity: .65; cursor: not-allowed; }

    .btn-pdf {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 14px;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background .15s;
    }
    .btn-pdf:hover { background: #6d28d9; }

    /* ── Summary mini-cards ────────────────────────────────────────── */
    .summary-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .summary-row-5 { grid-template-columns: repeat(5, 1fr); }

    .summary-mini-card {
      background: #fff;
      border: 1px solid #dce6f0;
      border-radius: 10px;
      padding: 14px 16px;
      border-left: 4px solid #dce6f0;
    }
    .summary-mini-card.smc-primary { border-left-color: #1a407e; }
    .summary-mini-card.smc-accent { border-left-color: #00c6a0; }
    .summary-mini-card.smc-green { border-left-color: #10b981; }
    .summary-mini-card.smc-red { border-left-color: #ef4444; }
    .summary-mini-card.smc-yellow { border-left-color: #f59e0b; }
    .summary-mini-card.smc-orange { border-left-color: #f97316; }

    .smc-value { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; color: #0c1c35; }
    .smc-label { font-size: 11.5px; color: #9ca3af; margin-top: 3px; }

    /* ── Loading skeleton ──────────────────────────────────────────── */
    .table-skeleton {
      background: #fff;
      border: 1px solid #dce6f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .skeleton-row { display: flex; gap: 10px; align-items: center; }
    .skeleton-cell {
      height: 14px;
      border-radius: 6px;
      background: linear-gradient(90deg, #f0f4f8 25%, #e8eef8 50%, #f0f4f8 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      flex-shrink: 0;
    }
    .sk-sm { width: 60px; }
    .sk-md { width: 110px; }
    .sk-lg { width: 180px; }

    /* ── Report table wrap ─────────────────────────────────────────── */
    .report-table-wrap {
      background: #fff;
      border: 1px solid #dce6f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .print-header { display: none; padding: 16px 20px 0; }
    .print-header h3 { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; color: #0c1c35; margin: 0 0 4px; }
    .print-header p { font-size: 12px; color: #6b7280; margin: 0 0 12px; }

    /* ── Report table ──────────────────────────────────────────────── */
    .report-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .report-table thead tr { background: #f4f7fb; }
    .report-table th {
      padding: 10px 14px;
      text-align: left;
      font-size: 11.5px;
      font-weight: 700;
      color: #7ea3cc;
      text-transform: uppercase;
      letter-spacing: .4px;
      white-space: nowrap;
      border-bottom: 1px solid #dce6f0;
    }
    .report-table td {
      padding: 10px 14px;
      color: #374151;
      border-bottom: 1px solid #f4f7fb;
      white-space: nowrap;
    }
    .report-table tbody tr:last-child td { border-bottom: none; }
    .report-table tbody tr:hover { background: #f9fbfd; }

    .text-right { text-align: right !important; }
    .td-num { color: #9ca3af; font-size: 12px; width: 32px; text-align: center; }
    .td-mono { font-family: 'Courier New', monospace; font-size: 12.5px; }
    .td-date { color: #6b7280; }
    .td-bold { font-weight: 700; color: #0c1c35; }
    .td-green { color: #065f46; font-weight: 600; }
    .td-red { color: #dc2626; font-weight: 600; }

    /* ── Badges ────────────────────────────────────────────────────── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-gray { background: #f3f4f6; color: #6b7280; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .badge-yellow { background: #fef3c7; color: #92400e; }
    .badge-orange { background: #ffedd5; color: #c2410c; }
    .badge-purple { background: #ede9fe; color: #5b21b6; }

    /* ── Empty state ───────────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      gap: 12px;
      color: #9ca3af;
      font-size: 13.5px;
      text-align: center;
    }
    .empty-state p { margin: 0; }
    .empty-state strong { color: #1a407e; }

    .empty-state-idle {
      background: #fff;
      border: 1px solid #dce6f0;
      border-radius: 12px;
    }

    /* ── Responsive ────────────────────────────────────────────────── */
    @media (max-width: 1100px) {
      .summary-row-5 { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .charts-row { grid-template-columns: 1fr !important; }
      .tables-row { grid-template-columns: 1fr !important; }
      .summary-row { grid-template-columns: repeat(2, 1fr); }
      .summary-row-5 { grid-template-columns: repeat(2, 1fr); }
      .report-table-wrap { overflow-x: auto; }
    }
    @media (max-width: 640px) {
      .page-header { flex-direction: column; align-items: stretch; gap: 10px; }
      .kpi-grid { grid-template-columns: 1fr 1fr !important; gap: 10px; }
      .report-filters { flex-direction: column; align-items: stretch; }
      .export-btns { margin-left: 0; }
      .summary-row { grid-template-columns: 1fr 1fr; }
      .report-tabs { gap: 2px; }
      .tab-btn { padding: 7px 10px; font-size: 12.5px; }
    }
    @media (max-width: 480px) {
      .kpi-grid { grid-template-columns: 1fr 1fr !important; }
      .summary-row { grid-template-columns: 1fr 1fr; }
    }

    /* ── Print styles ──────────────────────────────────────────────── */
    @media print {
      :host { display: block; }
      .report-tabs,
      .report-filters,
      .export-btns,
      .page-header,
      .kpi-grid,
      .charts-row,
      .tables-row,
      .summary-row,
      .btn-consultar,
      .empty-state-idle { display: none !important; }
      .printable { display: block !important; }
      .print-header { display: block !important; }
      body { background: white; }
      .report-table-wrap {
        border: none;
        border-radius: 0;
        overflow: visible;
      }
      .report-table th,
      .report-table td { font-size: 11px; padding: 6px 8px; }
    }
  `],
})
export class ReportsComponent implements OnInit {
  // ── DI ──────────────────────────────────────────────────────────────
  private readonly http = inject(HttpClient);
  public readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly API = `${environment.apiUrl}/reports`;

  // ── Constants ────────────────────────────────────────────────────────
  readonly MONTHS = MONTHS;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6, 7, 8];

  // ── Shared state ─────────────────────────────────────────────────────
  activeTab = signal<TabId>('dashboard');
  downloadingXlsx = signal(false);

  // ── Dashboard state (existing) ───────────────────────────────────────
  kpi = signal<KpiData | null>(null);
  monthly = signal<MonthlyData[]>([]);
  collectionsDash = signal<CollectionsDashData | null>(null);
  loadingMonthly = signal(true);
  loadingCollectionsDash = signal(true);

  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth() + 1;
  years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
  monthOptions = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

  // ── Invoices state ───────────────────────────────────────────────────
  invoicesData = signal<InvoicesReport | null>(null);
  invoicesLoading = signal(false);
  invoicesFrom = signal(this.firstDayOfMonth());
  invoicesTo = signal(this.today());
  invoicesStatus = signal('');

  // Two-way binding helpers (ngModel requires plain properties, not signals)
  invoicesFromVal = this.firstDayOfMonth();
  invoicesToVal = this.today();
  invoicesStatusVal = '';

  // ── Payroll state ─────────────────────────────────────────────────────
  payrollData = signal<PayrollReport | null>(null);
  payrollLoading = signal(false);
  payrollFrom = signal(this.firstDayOfMonth());
  payrollTo = signal(this.today());

  payrollFromVal = this.firstDayOfMonth();
  payrollToVal = this.today();

  // ── POS state ────────────────────────────────────────────────────────
  posData = signal<PosReport | null>(null);
  posLoading = signal(false);
  posFrom = signal(this.firstDayOfMonth());
  posTo = signal(this.today());

  posFromVal = this.firstDayOfMonth();
  posToVal = this.today();

  // ── Collections state ────────────────────────────────────────────────
  collectionsData = signal<CollectionsReport | null>(null);
  collectionsLoading = signal(false);
  collectionsAsOf = signal(this.today());

  collectionsAsOfVal = this.today();

  // ── Lifecycle ────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.loadAll();
  }

  // ── Tab control ──────────────────────────────────────────────────────

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
    // Carga automática en la primera visita al tab
    if (tab === 'invoices' && !this.invoicesData()) {
      this.loadInvoices();
    } else if (tab === 'payroll' && !this.payrollData()) {
      this.loadPayroll();
    } else if (tab === 'pos' && !this.posData()) {
      this.loadPos();
    } else if (tab === 'collections' && !this.collectionsData()) {
      this.loadCollections();
    }
  }

  // ── Dashboard loaders ────────────────────────────────────────────────

  loadAll(): void {
    this.loadKpis();
    this.loadMonthly();
    if (this.auth.hasFeature('has_cartera')()) {
      this.loadCollectionsDash();
    }
  }

  loadKpis(): void {
    this.http
      .get<KpiData>(`${this.API}/dashboard?year=${this.selectedYear}&month=${this.selectedMonth}`)
      .subscribe({
        next: (r) => { this.kpi.set(r); this.cdr.markForCheck(); },
        error: () => {},
      });
  }

  loadMonthly(): void {
    this.loadingMonthly.set(true);
    this.http
      .get<MonthlyData[]>(`${this.API}/revenue/monthly?year=${this.selectedYear}`)
      .subscribe({
        next: (r) => {
          this.monthly.set(r);
          this.loadingMonthly.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.loadingMonthly.set(false); this.cdr.markForCheck(); },
      });
  }

  loadCollectionsDash(): void {
    this.loadingCollectionsDash.set(true);
    this.http.get<CollectionsDashData>(`${this.API}/collections`).subscribe({
      next: (r) => {
        this.collectionsDash.set(r);
        this.loadingCollectionsDash.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.loadingCollectionsDash.set(false); this.cdr.markForCheck(); },
    });
  }

  // ── Report loaders ───────────────────────────────────────────────────

  loadInvoices(): void {
    this.invoicesLoading.set(true);
    const params = new URLSearchParams();
    params.set('from', this.invoicesFrom());
    params.set('to', this.invoicesTo());
    if (this.invoicesStatus()) params.set('status', this.invoicesStatus());

    this.http
      .get<InvoicesReport>(`${this.API}/invoice?${params.toString()}`)
      .subscribe({
        next: (r) => {
          this.invoicesData.set(r);
          this.invoicesLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.invoicesLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  loadPayroll(): void {
    this.payrollLoading.set(true);
    const params = new URLSearchParams();
    params.set('from', this.payrollFrom());
    params.set('to', this.payrollTo());

    this.http
      .get<PayrollReport>(`${this.API}/payroll?${params.toString()}`)
      .subscribe({
        next: (r) => {
          this.payrollData.set(r);
          this.payrollLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.payrollLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  loadPos(): void {
    this.posLoading.set(true);
    const params = new URLSearchParams();
    params.set('from', this.posFrom());
    params.set('to', this.posTo());

    this.http
      .get<PosReport>(`${this.API}/pos?${params.toString()}`)
      .subscribe({
        next: (r) => {
          this.posData.set(r);
          this.posLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.posLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  loadCollections(): void {
    this.collectionsLoading.set(true);
    const params = new URLSearchParams();
    params.set('asOf', this.collectionsAsOf());

    this.http
      .get<CollectionsReport>(`${this.API}/collections/detail?${params.toString()}`)
      .subscribe({
        next: (r) => {
          this.collectionsData.set(r);
          this.collectionsLoading.set(false);
          this.cdr.markForCheck();
        },
        error: () => { this.collectionsLoading.set(false); this.cdr.markForCheck(); },
      });
  }

  // ── Export actions ───────────────────────────────────────────────────

  downloadXlsx(type: string): void {
    this.downloadingXlsx.set(true);

    const params = new URLSearchParams();

    if (type === 'invoices') {
      params.set('from', this.invoicesFrom());
      params.set('to', this.invoicesTo());
      if (this.invoicesStatus()) params.set('status', this.invoicesStatus());
    } else if (type === 'payroll') {
      params.set('from', this.payrollFrom());
      params.set('to', this.payrollTo());
    } else if (type === 'pos') {
      params.set('from', this.posFrom());
      params.set('to', this.posTo());
    } else if (type === 'collections/detail') {
      params.set('asOf', this.collectionsAsOf());
    }

    const url = `${this.API}/${type}/xlsx?${params.toString()}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `report-${type.replace('/', '-')}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingXlsx.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.downloadingXlsx.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  printReport(): void {
    window.print();
  }

  // ── Dashboard helpers ─────────────────────────────────────────────────

  barHeight(value: number): number {
    const max = Math.max(...this.monthly().map((m) => Number(m.revenue)), 1);
    return (Number(value) / max) * 100;
  }

  agingSegments() {
    const a = this.collectionsDash()?.aging;
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

  collectionsPct(value: number): number {
    const max = Math.max(...(this.collectionsDash()?.byCustomer ?? []).map((c) => c.total), 1);
    return (value / max) * 100;
  }

  monthName(m: number): string {
    return MONTHS[m - 1] ?? '';
  }

  // ── Formatting helpers ────────────────────────────────────────────────

  fmtCOP(v: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(v ?? 0));
  }

  fmtDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  fmtStatus(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Borrador',
      ISSUED: 'Emitida',
      ACCEPTED_DIAN: 'Aceptado DIAN',
      REJECTED_DIAN: 'Rechazado DIAN',
      CANCELLED: 'Anulada',
      PENDING: 'Pendiente',
      PAID: 'Pagada',
    };
    return map[status] ?? status ?? '—';
  }

  fmtDianStatus(status: string): string {
    const map: Record<string, string> = {
      ACCEPTED_DIAN: 'Aceptado',
      REJECTED_DIAN: 'Rechazado',
      PENDING: 'Pendiente',
      NOT_SENT: 'No enviado',
      PROCESSING: 'En proceso',
    };
    return map[status] ?? status ?? '—';
  }

  fmtNominaStatus(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Borrador',
      APPROVED: 'Aprobada',
      PAID: 'Pagada',
      CANCELLED: 'Anulada',
      TRANSMITTED: 'Transmitida',
    };
    return map[status] ?? status ?? '—';
  }

  fmtPosStatus(status: string): string {
    const map: Record<string, string> = {
      OPEN: 'Abierta',
      CLOSED: 'Cerrada',
      CANCELLED: 'Anulada',
    };
    return map[status] ?? status ?? '—';
  }

  fmtAging(aging: string): string {
    const map: Record<string, string> = {
      CURRENT: 'Al día',
      DAYS_1_30: '1–30 días',
      DAYS_31_60: '31–60 días',
      DAYS_61_90: '61–90 días',
      OVER_90: '+90 días',
    };
    return map[aging] ?? aging ?? '—';
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'badge-gray',
      ISSUED: 'badge-blue',
      ACCEPTED_DIAN: 'badge-green',
      REJECTED_DIAN: 'badge-red',
      CANCELLED: 'badge-gray',
      PENDING: 'badge-yellow',
      PAID: 'badge-green',
    };
    return map[status] ?? 'badge-gray';
  }

  dianStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACCEPTED_DIAN: 'badge-green',
      REJECTED_DIAN: 'badge-red',
      PENDING: 'badge-yellow',
      NOT_SENT: 'badge-gray',
      PROCESSING: 'badge-blue',
    };
    return map[status] ?? 'badge-gray';
  }

  nominaStatusClass(status: string): string {
    const map: Record<string, string> = {
      DRAFT: 'badge-gray',
      APPROVED: 'badge-blue',
      PAID: 'badge-green',
      CANCELLED: 'badge-red',
      TRANSMITTED: 'badge-purple',
    };
    return map[status] ?? 'badge-gray';
  }

  posStatusClass(status: string): string {
    const map: Record<string, string> = {
      OPEN: 'badge-green',
      CLOSED: 'badge-blue',
      CANCELLED: 'badge-red',
    };
    return map[status] ?? 'badge-gray';
  }

  agingClass(aging: string): string {
    const map: Record<string, string> = {
      CURRENT: 'badge-green',
      DAYS_1_30: 'badge-yellow',
      DAYS_31_60: 'badge-orange',
      DAYS_61_90: 'badge-red',
      OVER_90: 'badge-red',
    };
    return map[aging] ?? 'badge-gray';
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private firstDayOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
