import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.component';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface GeoCountry  { code: string; name: string; }
interface Department  { code: string; name: string; countryCode: string; }
interface Municipality { code: string; name: string; departmentCode: string; }

interface Bank {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Branch {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
}

interface Employee {
  id: string;
  branchId?: string;
  branch?: { id: string; name: string; isMain: boolean };
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  position: string;
  baseSalary: number;
  contractType: string;
  hireDate: string;
  email?: string;
  phone?: string;
  city?: string;
  cityCode?: string;
  departmentCode?: string;
  country?: string;
  isActive: boolean;
  bankCode?: string;
  bankName?: string;
  bankAccount?: string;
}

interface PayrollRecord {
  id: string;
  branchId?: string;
  period: string;
  payDate: string;
  status: string;
  cune?: string;
  payrollNumber?: string;
  cuneHash?:      string;
  dianZipKey?:    string;
  dianStatusCode?: string;
  dianStatusMsg?:  string;
  dianErrors?:     string;
  dianAttempts?:   number;
  xmlSigned?:      string;   // XML firmado guardado tras transmisión DIAN
  payrollType?:    string;   // NOMINA_ELECTRONICA | NOMINA_AJUSTE
  cuneRef?:        string;   // CUNE del doc original (para NIAE)
  payrollNumberRef?: string; // Número del doc original (para NIAE)
  fechaGenRef?:    string;   // Fecha emisión del doc original (para NIAE)
  tipoAjuste?:      string;   // Reemplazar | Eliminar
  originalNieId?:   string;   // FK al NIE raíz de la cadena
  predecessorId?:   string;   // FK al predecesor directo
  isAnulado?:       boolean;  // true = período anulado por NIAE-Eliminar ACCEPTED
  baseSalary: number;
  daysWorked: number;
  overtimeHours: number;
  bonuses: number;
  commissions: number;
  transportAllowance: number;
  vacationPay: number;
  healthEmployee: number;
  pensionEmployee: number;
  sickLeave: number;
  loans: number;
  otherDeductions: number;
  healthEmployer: number;
  pensionEmployer: number;
  arl: number;
  compensationFund: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  totalEmployerCost: number;
  notes?: string;
  employees: Pick<Employee,'id'|'firstName'|'lastName'|'documentNumber'|'position'>;
}

interface PeriodSummary {
  period: string;
  totalEmployees: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerCost: number;
  submitted: number;
  drafts: number;
}

type ActiveTab = 'records' | 'employees';
type ViewMode  = 'table' | 'grid';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    <div class="py">

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <section class="hero-shell">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Gestion laboral</p>
            <h1 class="page-header__title">Nómina Electrónica</h1>
            <p class="page-header__sub">Liquida, monitorea y transmite novedades de nómina a la DIAN desde una vista más clara y operativa.</p>
          </div>
          <div class="page-header__actions">
            @if (activeTab() === 'records' && canCreatePayroll()) {
              <button class="btn btn--primary btn--sm" (click)="openPayrollModal()">
                <span class="material-symbols-outlined">add</span> Nueva liquidación
              </button>
            }
            @if (activeTab() === 'employees' && canManageEmployees()) {
              <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">
                <span class="material-symbols-outlined">person_add</span> Nuevo empleado
              </button>
            }
          </div>
        </div>

        <div class="hero-insights">
          <div class="hero-stat hero-stat--primary">
            <span class="hero-stat__label">{{ activeTab() === 'records' ? 'Liquidaciones visibles' : 'Empleados visibles' }}</span>
            <strong class="hero-stat__value">{{ activeTab() === 'records' ? records().length : employees().length }}</strong>
            <small class="hero-stat__hint">{{ activeTab() === 'records' ? 'Vista operativa del periodo actual' : 'Base laboral disponible para liquidar' }}</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Aceptadas</span>
              <strong>{{ acceptedPayrollCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Pendientes</span>
              <strong>{{ pendingPayrollCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Activos</span>
              <strong>{{ activeEmployees().length }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- ── KPI strip ──────────────────────────────────────────────────── -->
      <section class="kpi-strip">
        <article class="kpi-card">
          <div class="kpi-card__icon"><span class="material-symbols-outlined">payments</span></div>
          <div>
            <span class="kpi-card__label">Neto del período</span>
            <strong class="kpi-card__value">{{ currentNetPay() | currency:'COP':'symbol':'1.0-0' }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon"><span class="material-symbols-outlined">account_balance</span></div>
          <div>
            <span class="kpi-card__label">Costo empresa</span>
            <strong class="kpi-card__value">{{ currentEmployerCost() | currency:'COP':'symbol':'1.0-0' }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon"><span class="material-symbols-outlined">receipt_long</span></div>
          <div>
            <span class="kpi-card__label">Transmitidas</span>
            <strong class="kpi-card__value">{{ submittedPayrollCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon"><span class="material-symbols-outlined">groups</span></div>
          <div>
            <span class="kpi-card__label">Colaboradores activos</span>
            <strong class="kpi-card__value">{{ activeEmployees().length }}</strong>
          </div>
        </article>
      </section>

      <!-- ── Tabs ────────────────────────────────────────────────────────── -->
      <div class="tab-shell">
        <div class="py__tabs">
          <button class="py__tab" [class.py__tab--active]="activeTab()==='records'"
                  (click)="activeTab.set('records')">
            <span class="material-symbols-outlined">receipt_long</span> Liquidaciones
          </button>
          <button class="py__tab" [class.py__tab--active]="activeTab()==='employees'"
                  (click)="activeTab.set('employees'); loadEmployees()">
            <span class="material-symbols-outlined">groups</span> Empleados
          </button>
        </div>
      </div>

      <!-- ══ TAB: RECORDS ══════════════════════════════════════════════════ -->
      @if (activeTab() === 'records') {

        <!-- Filters + View Toggle -->
        <section class="filters-shell">
        <div class="filters-bar">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input type="text" class="search-input" placeholder="Buscar empleado…"
                   [(ngModel)]="recordSearch" (ngModelChange)="onRecordSearch()" />
          </div>
          <div class="filters-bar__controls">
            <div class="form-group-inline">
              <label class="form-label-sm">Período</label>
              <input type="month" class="filter-select" [(ngModel)]="periodFilter" (ngModelChange)="loadRecords()" />
            </div>
            <div class="form-group-inline">
              <label class="form-label-sm">Estado</label>
              <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="loadRecords()">
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="SUBMITTED">Transmitida</option>
                <option value="ACCEPTED">Aceptada</option>
                <option value="REJECTED">Rechazada</option>
                <option value="VOIDED">Anulada</option>
              </select>
            </div>
          </div>
          <div class="view-toggle">
            <button [class.active]="recordView() === 'table'" (click)="recordView.set('table')" title="Vista tabla">
              <span class="material-symbols-outlined">table_rows</span>
            </button>
            <button [class.active]="recordView() === 'grid'" (click)="recordView.set('grid')" title="Vista cuadrícula">
              <span class="material-symbols-outlined">grid_view</span>
            </button>
          </div>
        </div>
        </section>

        <!-- Period summary -->
        @if (periodFilter && summary()) {
          <div class="py__resumen">
            <div class="py__res-item">
              <span class="py__res-label">Liquidados</span>
              <span class="py__res-val">{{ summary()!.totalEmployees }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Total devengado</span>
              <span class="py__res-val">{{ summary()!.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Neto a pagar</span>
              <span class="py__res-val py__res-val--hl">{{ summary()!.totalNetPay | currency:'COP':'symbol':'1.0-0' }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Costo empresa</span>
              <span class="py__res-val">{{ summary()!.totalEmployerCost | currency:'COP':'symbol':'1.0-0' }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Transmitidas</span>
              <span class="py__res-val">{{ summary()!.submitted }} / {{ summary()!.totalEmployees }}</span>
            </div>
          </div>
        }

        <!-- ── TABLE VIEW ───────────────────────────────────────────────── -->
        @if (recordView() === 'table') {
          <section class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Liquidaciones</p>
              <h3>{{ periodFilter || 'Periodo actual' }}</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ records().length }} registros</span>
              <span class="content-chip content-chip--soft">{{ statusFilter || 'Todos los estados' }}</span>
            </div>
          </div>
          <div class="table-card">
            @if (loadingRecords()) {
              <div class="table-loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="sk-row">
                    <div class="sk sk-av"></div>
                    <div class="sk sk-ln" style="width:160px"></div>
                    <div class="sk sk-ln" style="width:80px"></div>
                    <div class="sk sk-ln" style="width:110px"></div>
                    <div class="sk sk-ln" style="width:110px"></div>
                    <div class="sk sk-ln" style="width:70px"></div>
                  </div>
                }
              </div>
            } @else if (records().length === 0) {
              <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">receipt_long</span>
                <p>No hay liquidaciones con los filtros seleccionados</p>
                @if (canCreatePayroll()) {
                  <button class="btn btn--primary btn--sm" (click)="openPayrollModal()">Nueva liquidación</button>
                }
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th><th>Período</th><th>Devengado</th>
                    <th>Deducciones</th><th>Neto a pagar</th><th>Estado</th><th>DIAN</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of records(); track r.id) {
                    <tr>
                      <td>
                        <div class="emp-cell">
                          <div class="emp-av">{{ r?.employees?.firstName?.[0] }}{{ r?.employees?.lastName?.[0] }}</div>
                          <div>
                            <div class="emp-name">{{ r?.employees?.firstName }} {{ r?.employees?.lastName }}</div>
                            <div class="emp-sub">{{ r?.employees?.position }}</div>
                          </div>
                        </div>
                      </td>
                      <td><span class="period-badge">{{ r.period }}</span></td>
                      <td class="td-cur">{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-cur text-danger">-{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-cur td-net">{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
                      <td>
                        @if (r.payrollNumber) {
                          <div class="dian-num">{{ r.payrollNumber }}</div>
                        }
                        @if (r.payrollType === 'NOMINA_AJUSTE') {
                          <span class="badge badge--niae">{{ r.tipoAjuste === 'Eliminar' ? 'NIAE Elim.' : 'NIAE Reempl.' }}</span>
                        }
                        @if (r.dianStatusCode) {
                          <span class="dian-st" [class.dian-ok]="r.dianStatusCode==='00'" [class.dian-err]="r.dianStatusCode==='99'">
                            {{ r.dianStatusCode === '00' ? '✓ Aceptada' : r.dianStatusCode === '99' ? '✗ Rechazada' : 'Cód ' + r.dianStatusCode }}
                          </span>
                        }
                      </td>
                      <td class="actions-cell">
                        <div class="row-actions">
                          <button class="btn-icon" title="Ver detalle" (click)="viewRecord(r)">
                            <span class="material-symbols-outlined">visibility</span>
                          </button>
                          @if (canSubmit() && r.status === 'DRAFT') {
                            <button class="btn-icon btn-icon--primary" title="Transmitir a DIAN"
                                    [disabled]="transmitting()" (click)="submitRecord(r)">
                              <span class="material-symbols-outlined">send</span>
                            </button>
                          }
                          @if (canSubmit() && (r.dianZipKey || r.cuneHash) && r.status !== 'DRAFT' && r.status !== 'VOIDED') {
                            <button class="btn-icon" title="Consultar estado DIAN"
                                    [disabled]="transmitting()" (click)="checkStatus(r)">
                              <span class="material-symbols-outlined">refresh</span>
                            </button>
                          }
                          @if (canVoid() && r.status !== 'VOIDED' && r.status !== 'ACCEPTED') {
                            <button class="btn-icon btn-icon--danger" title="Anular" (click)="confirmVoid(r)">
                              <span class="material-symbols-outlined">cancel</span>
                            </button>
                          }
                          @if (canSubmit() && r.status === 'ACCEPTED' && !r.isAnulado
                               && (r.payrollType === 'NOMINA_ELECTRONICA' || r.tipoAjuste === 'Reemplazar')) {
                            <button class="btn-icon btn-icon--ajuste" title="Nota de Ajuste — Reemplazar"
                                    (click)="openAjusteModal(r, 'Reemplazar')">
                              <span class="material-symbols-outlined">edit_document</span>
                            </button>
                          }
                          @if (canSubmit() && r.status === 'ACCEPTED' && !r.isAnulado
                               && (r.payrollType === 'NOMINA_ELECTRONICA' || r.tipoAjuste === 'Reemplazar')) {
                            <button class="btn-icon btn-icon--void" title="Nota de Ajuste — Eliminar"
                                    (click)="openAjusteModal(r, 'Eliminar')">
                              <span class="material-symbols-outlined">remove_circle</span>
                            </button>
                          }
                          @if (r.isAnulado) {
                            <span class="badge badge--anulado" title="Período anulado por NIAE-Eliminar">Anulado</span>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          </section>
        }

        <!-- ── GRID VIEW ────────────────────────────────────────────────── -->
        @if (recordView() === 'grid') {
          @if (loadingRecords()) {
            <div class="record-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="record-card record-card--sk">
                  <div class="sk rc-sk-av"></div>
                  <div class="sk sk-ln" style="width:70%;margin:10px auto 6px"></div>
                  <div class="sk sk-ln" style="width:50%;margin:0 auto 14px"></div>
                  <div class="sk sk-ln" style="width:90%"></div>
                  <div class="sk sk-ln" style="width:80%;margin-top:6px"></div>
                </div>
              }
            </div>
          } @else if (records().length === 0) {
            <div class="empty-state-grid">
              <span class="material-symbols-outlined empty-icon">receipt_long</span>
              <p>No hay liquidaciones con los filtros seleccionados</p>
              @if (canCreatePayroll()) {
                <button class="btn btn--primary btn--sm" (click)="openPayrollModal()">Nueva liquidación</button>
              }
            </div>
          } @else {
            <div class="record-grid">
              @for (r of records(); track r.id) {
                <div class="record-card" [class.record-card--voided]="r.status==='VOIDED'" [class.record-card--anulado]="r.isAnulado">
                  <span class="rc-status badge" [ngClass]="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
                  <div class="rc-top">
                    <div class="rc-av">{{ r?.employees?.firstName?.[0] }}{{ r?.employees?.lastName?.[0] }}</div>
                    <div class="rc-name">{{ r?.employees?.firstName }} {{ r?.employees?.lastName }}</div>
                    <div class="rc-sub">{{ r?.employees?.position }}</div>
                    <span class="period-badge" style="margin-top:6px">{{ r.period }}</span>
                  </div>
                  <div class="rc-amounts">
                    <div class="rc-amount-row">
                      <span class="rc-lbl">Devengado</span>
                      <span class="td-cur">{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span>
                    </div>
                    <div class="rc-amount-row">
                      <span class="rc-lbl">Deducciones</span>
                      <span class="td-cur text-danger">-{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span>
                    </div>
                    <div class="rc-amount-row rc-amount-row--neto">
                      <span class="rc-lbl">Neto a pagar</span>
                      <strong class="td-cur rc-neto">{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</strong>
                    </div>
                  </div>
                  @if (r.payrollNumber || r.dianStatusCode || r.payrollType === 'NOMINA_AJUSTE') {
                    <div class="rc-dian">
                      @if (r.payrollNumber) { <span class="dian-num">{{ r.payrollNumber }}</span> }
                      @if (r.payrollType === 'NOMINA_AJUSTE') {
                        <span class="badge badge--niae" style="font-size:10px">{{ r.tipoAjuste === 'Eliminar' ? 'NIAE Elim.' : 'NIAE Reempl.' }}</span>
                      }
                      @if (r.dianStatusCode) {
                        <span class="dian-st" [class.dian-ok]="r.dianStatusCode==='00'" [class.dian-err]="r.dianStatusCode==='99'">
                          {{ r.dianStatusCode === '00' ? '✓ Aceptada' : r.dianStatusCode === '99' ? '✗ Rechazada' : 'Cód ' + r.dianStatusCode }}
                        </span>
                      }
                    </div>
                  }
                  <div class="rc-actions">
                    <button class="btn btn--sm btn--secondary" style="flex:1;justify-content:center" (click)="viewRecord(r)">
                      <span class="material-symbols-outlined" style="font-size:15px">visibility</span> Ver
                    </button>
                    @if (canSubmit() && r.status === 'DRAFT') {
                      <button class="btn btn--sm btn--primary" [disabled]="transmitting()" (click)="submitRecord(r)">
                        <span class="material-symbols-outlined" style="font-size:15px">send</span> Transmitir
                      </button>
                    }
                    @if (canSubmit() && (r.dianZipKey || r.cuneHash) && r.status !== 'DRAFT' && r.status !== 'VOIDED') {
                      <button class="btn-icon" title="Consultar DIAN" [disabled]="transmitting()" (click)="checkStatus(r)">
                        <span class="material-symbols-outlined">refresh</span>
                      </button>
                    }
                    @if (canVoid() && r.status !== 'VOIDED' && r.status !== 'ACCEPTED') {
                      <button class="btn-icon btn-icon--danger" title="Anular" (click)="confirmVoid(r)">
                        <span class="material-symbols-outlined">cancel</span>
                      </button>
                    }
                    @if (canSubmit() && r.status === 'ACCEPTED' && !r.isAnulado
                         && (r.payrollType === 'NOMINA_ELECTRONICA' || r.tipoAjuste === 'Reemplazar')) {
                      <button class="btn-icon btn-icon--ajuste" title="Nota de Ajuste — Reemplazar"
                              (click)="openAjusteModal(r, 'Reemplazar')">
                        <span class="material-symbols-outlined">edit_document</span>
                      </button>
                      <button class="btn-icon btn-icon--void" title="Nota de Ajuste — Eliminar"
                              (click)="openAjusteModal(r, 'Eliminar')">
                        <span class="material-symbols-outlined">remove_circle</span>
                      </button>
                    }
                    @if (r.isAnulado) {
                      <span class="badge badge--anulado" style="font-size:10px">Anulado</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }
      }

      <!-- ══ TAB: EMPLOYEES ════════════════════════════════════════════════ -->
      @if (activeTab() === 'employees') {

        <!-- Filters + View Toggle -->
        <section class="filters-shell">
        <div class="filters-bar">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input type="text" class="search-input" placeholder="Buscar por nombre, documento o cargo…"
                   [(ngModel)]="empSearch" (ngModelChange)="onEmpSearch()" />
          </div>
          <div class="filters-bar__controls">
            <div class="form-group-inline">
              <label class="form-label-sm">Sucursal</label>
              <select class="filter-select" [ngModel]="empBranchFilter()" (ngModelChange)="empBranchFilter.set($event); loadEmployees()">
                <option value="">Todas</option>
                @for (branch of branches(); track branch.id) {
                  <option [value]="branch.id">{{ branch.name }}{{ branch.isMain ? ' (Principal)' : '' }}</option>
                }
              </select>
            </div>
            <div class="filter-chips">
              <button class="chip" [class.chip--active]="empActive()===undefined" (click)="empActive.set(undefined);loadEmployees()">Todos</button>
              <button class="chip" [class.chip--active]="empActive()===true"      (click)="empActive.set(true);loadEmployees()">Activos</button>
              <button class="chip" [class.chip--active]="empActive()===false"     (click)="empActive.set(false);loadEmployees()">Inactivos</button>
            </div>
          </div>
          <div class="view-toggle">
            <button [class.active]="empView() === 'table'" (click)="empView.set('table')" title="Vista tabla">
              <span class="material-symbols-outlined">table_rows</span>
            </button>
            <button [class.active]="empView() === 'grid'" (click)="empView.set('grid')" title="Vista cuadrícula">
              <span class="material-symbols-outlined">grid_view</span>
            </button>
          </div>
        </div>
        </section>

        <!-- ── TABLE VIEW ───────────────────────────────────────────────── -->
        @if (empView() === 'table') {
          <section class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Equipo</p>
              <h3>Directorio de empleados</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ employees().length }} colaboradores</span>
              <span class="content-chip content-chip--soft">{{ empActive() === undefined ? 'Todos' : empActive() ? 'Activos' : 'Inactivos' }}</span>
              <span class="content-chip content-chip--soft">{{ selectedEmployeeBranchLabel() }}</span>
            </div>
          </div>
          <div class="table-card">
            @if (loadingEmployees()) {
              <div class="table-loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="sk-row">
                    <div class="sk sk-av"></div>
                    <div class="sk sk-ln" style="width:150px"></div>
                    <div class="sk sk-ln" style="width:100px"></div>
                    <div class="sk sk-ln" style="width:120px"></div>
                    <div class="sk sk-ln" style="width:90px"></div>
                    <div class="sk sk-ln" style="width:60px"></div>
                  </div>
                }
              </div>
            } @else if (employees().length === 0) {
              <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">group_off</span>
                <p>No hay empleados registrados</p>
                @if (canManageEmployees()) {
                  <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">Agregar primer empleado</button>
                }
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Empleado</th><th>Documento</th><th>Cargo</th>
                    <th>Contrato</th><th>Salario base</th><th>Ingreso</th><th>Estado</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of employees(); track e.id) {
                    <tr [class.row--inactive]="!e.isActive">
                      <td>
                        <div class="emp-cell">
                          <div class="emp-av" [class.emp-av--inactive]="!e.isActive">
                            {{ e.firstName[0] }}{{ e.lastName[0] }}
                          </div>
                          <div>
                            <div class="emp-name">{{ e.firstName }} {{ e.lastName }}</div>
                            @if (e.email) { <div class="emp-sub">{{ e.email }}</div> }
                            @if (e.branch?.name) { <div class="emp-sub">Sucursal: {{ e.branch?.name }}</div> }
                          </div>
                        </div>
                      </td>
                      <td><span class="doc-badge">{{ e.documentType }}</span><span class="doc-num">{{ e.documentNumber }}</span></td>
                      <td class="text-muted">{{ e.position }}</td>
                      <td><span class="badge badge--neutral">{{ contractLabel(e.contractType) }}</span></td>
                      <td class="td-cur">{{ e.baseSalary | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="text-muted">{{ e.hireDate | date:'dd/MM/yyyy' }}</td>
                      <td>
                        <span class="status-badge" [class.status-badge--on]="e.isActive" [class.status-badge--off]="!e.isActive">
                          {{ e.isActive ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td class="actions-cell">
                        <div class="row-actions">
                          <button class="btn-icon btn-icon--primary" title="Crear liquidación"
                                  [disabled]="!canCreatePayroll() || !e.isActive"
                                  (click)="preselectEmployee(e)">
                            <span class="material-symbols-outlined">add_circle</span>
                          </button>
                          @if (canManageEmployees()) {
                            <button class="btn-icon" title="Editar" (click)="openEmployeeModal(e)">
                              <span class="material-symbols-outlined">edit</span>
                            </button>
                          }
                          @if (canDeactivateEmployee() && e.isActive) {
                            <button class="btn-icon btn-icon--danger" title="Desactivar" (click)="deactivateEmployee(e)">
                              <span class="material-symbols-outlined">person_off</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          </section>
        }

        <!-- ── GRID VIEW ────────────────────────────────────────────────── -->
        @if (empView() === 'grid') {
          @if (loadingEmployees()) {
            <div class="employee-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="employee-card employee-card--sk">
                  <div class="sk ec-sk-av"></div>
                  <div class="sk sk-ln" style="width:70%;margin:10px auto 6px"></div>
                  <div class="sk sk-ln" style="width:50%;margin:0 auto 14px"></div>
                  <div class="sk sk-ln" style="width:90%"></div>
                  <div class="sk sk-ln" style="width:80%;margin-top:6px"></div>
                </div>
              }
            </div>
          } @else if (employees().length === 0) {
            <div class="empty-state-grid">
              <span class="material-symbols-outlined empty-icon">group_off</span>
              <p>No hay empleados registrados</p>
              @if (canManageEmployees()) {
                <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">Agregar primer empleado</button>
              }
            </div>
          } @else {
            <div class="employee-grid">
              @for (e of employees(); track e.id) {
                <div class="employee-card" [class.employee-card--off]="!e.isActive">
                  <span class="ec-status status-badge" [class.status-badge--on]="e.isActive" [class.status-badge--off]="!e.isActive">
                    {{ e.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                  <div class="ec-top">
                    <div class="ec-av" [class.ec-av--off]="!e.isActive">{{ e.firstName[0] }}{{ e.lastName[0] }}</div>
                    <div class="ec-name">{{ e.firstName }} {{ e.lastName }}</div>
                    <div class="ec-pos">{{ e.position }}</div>
                    @if (e.branch?.name) {
                      <div class="ec-pos">Sucursal: {{ e.branch?.name }}</div>
                    }
                    <span class="badge badge--neutral" style="margin-top:6px">{{ contractLabel(e.contractType) }}</span>
                  </div>
                  <div class="ec-info">
                    <div class="ec-row">
                      <span class="material-symbols-outlined">badge</span>
                      <span><span class="doc-badge">{{ e.documentType }}</span>{{ e.documentNumber }}</span>
                    </div>
                    <div class="ec-row ec-salary">
                      <span class="material-symbols-outlined">payments</span>
                      <span>{{ e.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span>
                    </div>
                    @if (e.email) {
                      <div class="ec-row">
                        <span class="material-symbols-outlined">mail</span>
                        <span>{{ e.email }}</span>
                      </div>
                    }
                    @if (e.phone) {
                      <div class="ec-row">
                        <span class="material-symbols-outlined">phone</span>
                        <span>{{ e.phone }}</span>
                      </div>
                    }
                    @if (e.city) {
                      <div class="ec-row">
                        <span class="material-symbols-outlined">location_on</span>
                        <span>{{ e.city }}</span>
                      </div>
                    }
                    <div class="ec-row">
                      <span class="material-symbols-outlined">calendar_today</span>
                      <span>{{ e.hireDate | date:'dd/MM/yyyy' }}</span>
                    </div>
                  </div>
                  <div class="ec-actions">
                    <button class="btn btn--sm btn--primary" style="flex:1;justify-content:center"
                            [disabled]="!canCreatePayroll() || !e.isActive"
                            (click)="preselectEmployee(e)">
                      <span class="material-symbols-outlined" style="font-size:15px">add_circle</span> Liquidar
                    </button>
                    @if (canManageEmployees()) {
                      <button class="btn-icon" title="Editar" (click)="openEmployeeModal(e)">
                        <span class="material-symbols-outlined">edit</span>
                      </button>
                    }
                    @if (canDeactivateEmployee() && e.isActive) {
                      <button class="btn-icon btn-icon--danger" title="Desactivar" (click)="deactivateEmployee(e)">
                        <span class="material-symbols-outlined">person_off</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }
      }
    </div><!-- /.py -->

    <!-- ══ MODAL: RESULTADO DIAN ══════════════════════════════════════════ -->
    @if (showDianResult()) {
      <div class="modal-overlay">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="material-symbols-outlined" style="font-size:22px;color:#1a407e">receipt_long</span>
            <h3>Resultado transmisión DIAN</h3>
            <button class="modal-close" (click)="showDianResult.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          @if (dianResult(); as d) {
            <div class="modal-body">
              <div class="dian-banner" [class.dian-banner--ok]="d.success" [class.dian-banner--err]="!d.success">
                <span class="material-symbols-outlined">{{ d.success ? 'check_circle' : 'error' }}</span>
                <div>
                  <div class="dian-banner__title">{{ d.success ? 'Documento enviado correctamente' : 'Error en el envío' }}</div>
                  <div class="dian-banner__sub">{{ d.isTestMode ? 'Ambiente de Habilitación — Set de Pruebas' : 'Ambiente de Producción' }}</div>
                </div>
              </div>
              <div class="dian-grid">
                <div class="dian-item"><span class="dian-lbl">N° Nómina</span><strong class="dian-val">{{ d.payrollNumber }}</strong></div>
                <div class="dian-item"><span class="dian-lbl">ZipKey DIAN</span><code class="dian-code">{{ d.zipKey || '—' }}</code></div>
                <div class="dian-item" style="grid-column:1/-1">
                  <span class="dian-lbl">CUNE (SHA-384)</span>
                  <code class="dian-code dian-code--sm">{{ d.cuneHash }}</code>
                </div>
              </div>
              @if (d.errors?.length) {
                <div class="dian-errors">
                  <div class="dian-errors__title"><span class="material-symbols-outlined">warning</span>Errores reportados por la DIAN</div>
                  @for (err of d.errors; track err) { <div class="dian-errors__item">{{ err }}</div> }
                </div>
              }
              @if (d.zipKey && d.success) {
                <div class="dian-hint">
                  <span class="material-symbols-outlined">info</span>
                  Usa el botón <strong>Consultar estado</strong> (ícono refresh) para verificar la aceptación. ZipKey: <code>{{ d.zipKey }}</code>
                </div>
              }
            </div>
          }
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="showDianResult.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    }

    <!-- ══ MODAL: DETALLE LIQUIDACIÓN ═════════════════════════════════════ -->
    @if (showRecordDetail()) {
      <div class="drawer-overlay" (click)="showRecordDetail.set(false)">
        <div class="drawer" (click)="$event.stopPropagation()">

          <!-- ── Drawer header ─────────────────────────────────────────────── -->
          <div class="drawer-header">
            <div class="drawer-header-left">
              <div class="drawer-emp-name">
                {{ selectedRecord()?.employees?.firstName }} {{ selectedRecord()?.employees?.lastName }}
              </div>
              <div class="drawer-inv-meta">
                @if (selectedRecord()?.payrollType === 'NOMINA_AJUSTE') {
                  <span class="badge badge--niae" style="font-size:10px">
                    {{ selectedRecord()?.tipoAjuste === 'Eliminar' ? 'NIAE — Eliminar' : 'NIAE — Reemplazar' }}
                  </span>
                  <span class="drawer-dot">·</span>
                }
                <span class="drawer-date">Período {{ selectedRecord()?.period }}</span>
                @if (selectedRecord()?.payDate) {
                  <span class="drawer-dot">·</span>
                  <span class="drawer-date">Pago: {{ selectedRecord()?.payDate | date:'dd/MM/yyyy' }}</span>
                }
              </div>
            </div>
            <div class="drawer-header-right">
              <span class="badge" [ngClass]="statusClass(selectedRecord()?.status ?? '')">
                {{ statusLabel(selectedRecord()?.status ?? '') }}
              </span>
              @if (selectedRecord()?.isAnulado) {
                <span class="badge badge--anulado" style="font-size:10px;padding:3px 8px">Anulado</span>
              }
              <button class="drawer-close" (click)="showRecordDetail.set(false)" title="Cerrar">
                <svg viewBox="0 0 20 20" fill="currentColor" width="17"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>

          @if (selectedRecord(); as r) {

            <!-- ── Drawer body ──────────────────────────────────────────────── -->
            <div class="drawer-body">

              <!-- Empleado -->
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                  Empleado
                </div>
                <div class="dw-card">
                  <div class="dw-client-name">{{ r?.employees?.firstName }} {{ r?.employees?.lastName }}</div>
                  <div class="dw-client-doc">{{ r?.employees?.documentNumber }}</div>
                  @if (r?.employees?.position) {
                    <div class="dw-client-extra">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                      {{ r?.employees?.position }}
                    </div>
                  }
                </div>
              </div>

              <!-- Devengados -->
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/></svg>
                  Devengados
                </div>
                <div class="dw-pay-table">
                  <div class="dw-pay-row"><span>Salario base ({{ r.daysWorked }} días)</span><span>{{ r.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.transportAllowance > 0) { <div class="dw-pay-row"><span>Aux. transporte</span><span>{{ r.transportAllowance | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.overtimeHours > 0)      { <div class="dw-pay-row"><span>Horas extra ({{ r.overtimeHours }}h)</span><span>—</span></div> }
                  @if (+r.bonuses > 0)            { <div class="dw-pay-row"><span>Bonificaciones</span><span>{{ r.bonuses | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.commissions > 0)        { <div class="dw-pay-row"><span>Comisiones</span><span>{{ r.commissions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.vacationPay > 0)        { <div class="dw-pay-row"><span>Vacaciones</span><span>{{ r.vacationPay | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="dw-pay-row dw-pay-total"><span>Total devengado</span><span>{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>

              <!-- Deducciones -->
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
                  Deducciones empleado
                </div>
                <div class="dw-pay-table">
                  <div class="dw-pay-row"><span>Salud (4%)</span><span>{{ r.healthEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Pensión (4%)</span><span>{{ r.pensionEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.sickLeave > 0)       { <div class="dw-pay-row"><span>Incapacidades</span><span>{{ r.sickLeave | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.loans > 0)           { <div class="dw-pay-row"><span>Préstamos</span><span>{{ r.loans | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.otherDeductions > 0) { <div class="dw-pay-row"><span>Otros descuentos</span><span>{{ r.otherDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="dw-pay-row dw-pay-total dw-pay-total--ded"><span>Total deducciones</span><span>{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>

              <!-- Aportes empleador -->
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/></svg>
                  Aportes empleador
                </div>
                <div class="dw-pay-table">
                  <div class="dw-pay-row"><span>Salud (8.5%)</span><span>{{ r.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Pensión (12%)</span><span>{{ r.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>ARL (0.522%)</span><span>{{ r.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Caja comp. (4%)</span><span>{{ r.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>

              <!-- Liquidación -->
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/></svg>
                  Liquidación
                </div>
                <div class="dw-summary-grid">
                  <div class="dw-summary-card dw-summary-card--neto">
                    <span class="dw-summary-lbl">Neto a pagar</span>
                    <span class="dw-summary-val">{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="dw-summary-card">
                    <span class="dw-summary-lbl">Costo empresa</span>
                    <span class="dw-summary-val dw-summary-val--sec">{{ r.totalEmployerCost | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                </div>
              </div>

              <!-- DIAN -->
              @if (r.payrollNumber || r.cuneHash || r.dianZipKey || r.dianStatusCode) {
                <div class="dw-section">
                  <div class="dw-section-title">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                    DIAN — Nómina electrónica
                  </div>
                  <div class="dw-card dw-dian-card">
                    @if (r.payrollNumber) {
                      <div class="dw-dian-row">
                        <span class="dw-dian-lbl">N° Nómina</span>
                        <span style="font-size:13px;font-family:monospace;font-weight:700;color:#0c1c35">{{ r.payrollNumber }}</span>
                      </div>
                    }
                    @if (r.payrollType === 'NOMINA_AJUSTE') {
                      <div class="dw-dian-row" style="margin-top:6px">
                        <span class="dw-dian-lbl">Tipo ajuste</span>
                        <span class="badge badge--niae" style="font-size:10px">{{ r.tipoAjuste === 'Eliminar' ? 'Nota Eliminar' : 'Nota Reemplazar' }}</span>
                      </div>
                      @if (r.payrollNumberRef) {
                        <div class="dw-dian-row" style="margin-top:4px">
                          <span class="dw-dian-lbl">Predecesor</span>
                          <span style="font-size:12px;color:#374151;font-family:monospace">{{ r.payrollNumberRef }}</span>
                        </div>
                      }
                    }
                    @if (r.isAnulado) {
                      <div style="margin-top:8px;display:flex;align-items:center;gap:6px;background:#fef3c7;border-radius:6px;padding:8px 10px;font-size:12px;font-weight:700;color:#92400e">
                        <span class="material-symbols-outlined" style="font-size:15px">cancel</span>
                        Período anulado por Nota de Eliminar
                      </div>
                    }
                    @if (r.dianStatusCode) {
                      <div class="dw-dian-row" style="margin-top:8px">
                        <span class="dw-dian-lbl">Estado DIAN</span>
                        <span class="dian-st" [class.dian-ok]="r.dianStatusCode==='00'" [class.dian-err]="r.dianStatusCode==='99'">
                          {{ r.dianStatusCode === '00' ? '✓ Aceptada' : r.dianStatusCode === '99' ? '✗ Rechazada' : 'Cód ' + r.dianStatusCode }}
                        </span>
                      </div>
                    }
                    @if (r.dianStatusMsg) {
                      <div class="dian-msg-block" style="margin-top:6px"
                           [class.dian-msg-ok]="r.dianStatusCode === '00'"
                           [class.dian-msg-err]="r.dianStatusCode === '99'">
                        {{ r.dianStatusMsg }}
                      </div>
                    }
                    @if (r.dianErrors) {
                      <div class="dian-errors-block" style="margin-top:8px">
                        <div class="dian-errors-header">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="13" style="flex-shrink:0"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                          <span>Errores DIAN ({{ parseDianErrors(r.dianErrors).length }})</span>
                        </div>
                        <ul class="dian-errors-list">
                          @for (err of parseDianErrors(r.dianErrors); track $index) {
                            <li class="dian-error-item dian-error-rechazo">
                              <span class="dian-error-badge">Rechazo</span>
                              <span class="dian-error-text">{{ err }}</span>
                            </li>
                          }
                        </ul>
                      </div>
                    }
                    @if (r.cuneHash) {
                      <div class="dw-dian-cufe" style="margin-top:10px">
                        <div class="dw-dian-lbl">CUNE</div>
                        <code class="dw-cufe-code">{{ r.cuneHash }}</code>
                      </div>
                    }
                    @if (r.dianZipKey) {
                      <div class="dw-dian-row" style="margin-top:8px">
                        <span class="dw-dian-lbl">ZipKey</span>
                        <span style="font-size:11px;color:#374151;font-family:monospace">{{ r.dianZipKey.slice(0,24) }}…</span>
                      </div>
                    }
                    @if (r.dianAttempts) {
                      <div class="dw-dian-row" style="margin-top:4px">
                        <span class="dw-dian-lbl">Intentos envío</span>
                        <span style="font-size:12px;color:#374151">{{ r.dianAttempts }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Notas -->
              @if (r.notes) {
                <div class="dw-section">
                  <div class="dw-section-title">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"/></svg>
                    Notas
                  </div>
                  <div class="dw-notes">{{ r.notes }}</div>
                </div>
              }

            </div><!-- /drawer-body -->

            <!-- ── Drawer footer ──────────────────────────────────────────── -->
            <div class="drawer-footer">
              @if (r.status === 'SUBMITTED' || r.status === 'ACCEPTED' || r.status === 'REJECTED') {
                <button class="btn btn--sm btn--dl-xml" [disabled]="downloading()" (click)="downloadPayrollFile(r, 'xml')" title="Descargar XML firmado">
                  <span class="material-symbols-outlined" style="font-size:14px">code</span>
                  XML
                </button>
                <button class="btn btn--sm btn--dl-zip" [disabled]="downloading()" (click)="downloadPayrollFile(r, 'zip')" title="Descargar ZIP DIAN">
                  <span class="material-symbols-outlined" style="font-size:14px">folder_zip</span>
                  ZIP
                </button>
              }
              @if (canSubmit() && (r.dianZipKey || r.cuneHash) && r.status !== 'DRAFT' && r.status !== 'VOIDED') {
                <button class="btn btn--sm btn--secondary" [disabled]="transmitting()" (click)="checkStatus(r)">
                  <span class="material-symbols-outlined" style="font-size:14px">refresh</span>
                  Consultar DIAN
                </button>
              }
              @if (r.status === 'ACCEPTED' && canSubmit() && !r.isAnulado
                   && (r.payrollType === 'NOMINA_ELECTRONICA' || r.tipoAjuste === 'Reemplazar')) {
                <button class="btn btn--sm btn--ajuste-reemplazar" (click)="openAjusteModal(r, 'Reemplazar')">
                  <span class="material-symbols-outlined" style="font-size:14px">edit_document</span>
                  Reemplazar
                </button>
                <button class="btn btn--sm btn--ajuste-eliminar" (click)="openAjusteModal(r, 'Eliminar')">
                  <span class="material-symbols-outlined" style="font-size:14px">remove_circle</span>
                  Eliminar
                </button>
              }
              <button class="btn btn--sm btn--secondary" style="margin-left:auto" (click)="showRecordDetail.set(false)">Cerrar</button>
            </div>

          }

        </div><!-- /drawer -->
      </div><!-- /drawer-overlay -->
    }

    <!-- ══ MODAL: NUEVA LIQUIDACIÓN ═══════════════════════════════════════ -->
    @if (showPayrollModal()) {
      <div class="modal-overlay">
        <div class="modal modal--xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nueva liquidación de nómina</h3>
            <button class="modal-close" (click)="closePayrollModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="py__form-grid">
              <div>
                <div class="form-section-title">Datos básicos</div>
                <div class="form-group">
                  <label class="form-label">Empleado *</label>
                  <select class="form-control" [(ngModel)]="payrollForm.employeeId" (ngModelChange)="onEmployeeSelected()">
                    <option value="">Seleccionar empleado…</option>
                    @for (e of activeEmployees(); track e.id) {
                      <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} — {{ e.position }}</option>
                    }
                  </select>
                </div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Período *</label>
                    <input type="month" class="form-control" [(ngModel)]="payrollForm.period" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fecha de pago *</label>
                    <input type="date" class="form-control" [(ngModel)]="payrollForm.payDate" />
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Salario base</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.baseSalary" (ngModelChange)="recalculate()" min="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Días trabajados</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.daysWorked" (ngModelChange)="recalculate()" min="0" max="30" />
                  </div>
                </div>
                <div class="form-section-title">Ingresos adicionales</div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Horas extra</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.overtimeHours" (ngModelChange)="recalculate()" min="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Aux. transporte (auto)</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.transportAllowance" (ngModelChange)="recalculate()" min="0" placeholder="Auto-calculado" />
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Bonificaciones</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.bonuses" (ngModelChange)="recalculate()" min="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Comisiones</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.commissions" (ngModelChange)="recalculate()" min="0" />
                  </div>
                </div>
                <div class="form-section-title">Descuentos adicionales</div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Préstamos</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.loans" (ngModelChange)="recalculate()" min="0" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Otros descuentos</label>
                    <input type="number" class="form-control" [(ngModel)]="payrollForm.otherDeductions" (ngModelChange)="recalculate()" min="0" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Notas</label>
                  <textarea class="form-control" [(ngModel)]="payrollForm.notes" rows="2"></textarea>
                </div>
              </div>
              <!-- Preview lateral -->
              <div class="py__preview">
                <div class="py__preview-title">
                  <span class="material-symbols-outlined">calculate</span> Vista previa del cálculo
                </div>
                @if (preview()) {
                  <div class="py__preview-rows">
                    <div class="py__pr py__pr--head">Devengados</div>
                    <div class="py__pr"><span>Total devengado</span><span>{{ preview()!.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--head">Deducciones empleado</div>
                    <div class="py__pr"><span>Salud 4%</span><span>{{ preview()!.healthEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Pensión 4%</span><span>{{ preview()!.pensionEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--sub"><span>Total deducciones</span><span class="text-danger">{{ preview()!.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--head">Aportes empleador</div>
                    <div class="py__pr"><span>Salud 8.5%</span><span>{{ preview()!.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Pensión 12%</span><span>{{ preview()!.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>ARL 0.522%</span><span>{{ preview()!.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Caja comp. 4%</span><span>{{ preview()!.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--neto"><span>Neto a pagar</span><strong>{{ preview()!.netPay | currency:'COP':'symbol':'1.0-0' }}</strong></div>
                    <div class="py__pr py__pr--costo"><span>Costo empresa</span><strong>{{ preview()!.totalEmployerCost | currency:'COP':'symbol':'1.0-0' }}</strong></div>
                  </div>
                } @else {
                  <div class="py__preview-empty">Selecciona un empleado y completa los datos para ver el cálculo</div>
                }
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closePayrollModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="savePayroll()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar borrador' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══ MODAL: NOTA DE AJUSTE (NominaIndividualDeAjuste) ═══════════════ -->
    @if (showAjusteModal()) {
      <div class="modal-overlay">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header" [class.modal-header--eliminar]="ajusteType() === 'Eliminar'">
            <span class="material-symbols-outlined nae-header-icon">
              {{ ajusteType() === 'Eliminar' ? 'remove_circle' : 'edit_document' }}
            </span>
            <div style="flex:1">
              <h3>Nota de Ajuste — {{ ajusteType() }}</h3>
              <div class="nae-sub">
                {{ ajusteType() === 'Eliminar'
                   ? 'Anula el documento original sin reemplazo (Art. 17 último párrafo)'
                   : 'Corrige errores aritméticos o de contenido (Art. 17 párrafos 4-6, 11)' }}
              </div>
            </div>
            <button class="modal-close" (click)="closeAjusteModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">

            <!-- Referencia al documento original -->
            @if (ajusteSource(); as src) {
              <div class="nae-ref-box">
                <div class="nae-ref-title">
                  <span class="material-symbols-outlined">link</span>
                  Documento original referenciado
                </div>
                <div class="nae-ref-grid">
                  <div><span class="nae-ref-lbl">N° Nómina</span><code>{{ src.payrollNumber }}</code></div>
                  <div><span class="nae-ref-lbl">Período</span><code>{{ src.period }}</code></div>
                  <div><span class="nae-ref-lbl">Empleado</span><span>{{ src?.employees?.firstName }} {{ src?.employees?.lastName }}</span></div>
                  <div><span class="nae-ref-lbl">Neto original</span><span>{{ src.netPay | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                @if (src.cuneHash) {
                  <div class="nae-ref-cune"><span class="nae-ref-lbl">CUNE referenciado:</span> <code>{{ src.cuneHash }}</code></div>
                }
              </div>
            }

            <!-- Tipo de ajuste -->
            <div class="nae-tipo-bar">
              <button class="nae-tipo-btn" [class.nae-tipo-btn--active]="ajusteType()==='Reemplazar'"
                      (click)="ajusteType.set('Reemplazar'); ajusteForm.tipoAjuste='Reemplazar'">
                <span class="material-symbols-outlined">edit_document</span>
                Reemplazar
                <span class="nae-tipo-hint">Corrige el contenido</span>
              </button>
              <button class="nae-tipo-btn nae-tipo-btn--eliminar" [class.nae-tipo-btn--active]="ajusteType()==='Eliminar'"
                      (click)="ajusteType.set('Eliminar'); ajusteForm.tipoAjuste='Eliminar'">
                <span class="material-symbols-outlined">remove_circle</span>
                Eliminar
                <span class="nae-tipo-hint">Anula sin reemplazo</span>
              </button>
            </div>

            <!-- Campos de nómina corregida (solo Reemplazar) -->
            @if (ajusteType() === 'Reemplazar') {
              <div class="form-section-title">Datos corregidos de la liquidación</div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Fecha de pago *</label>
                  <input type="date" class="form-control" [(ngModel)]="ajusteForm.payDate" />
                </div>
                <div class="form-group">
                  <label class="form-label">Días trabajados</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.daysWorked" min="0" max="30" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Salario base</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.baseSalary" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Aux. transporte</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.transportAllowance" min="0" placeholder="Auto-calculado" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Horas extra</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.overtimeHours" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Bonificaciones</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.bonuses" min="0" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Comisiones</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.commissions" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Vacaciones</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.vacationPay" min="0" />
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Incapacidades</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.sickLeave" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Préstamos / Embargos</label>
                  <input type="number" class="form-control" [(ngModel)]="ajusteForm.loans" min="0" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Otros descuentos</label>
                <input type="number" class="form-control" [(ngModel)]="ajusteForm.otherDeductions" min="0" />
              </div>
            }

            @if (ajusteType() === 'Eliminar') {
              <div class="nae-eliminar-info">
                <span class="material-symbols-outlined">info</span>
                <div>
                  <strong>Nota de Eliminación</strong>
                  <p>Este tipo de nota no incluye datos de nómina (Art. 17 último párrafo). Solo se referencia el documento original. Una vez transmitida y aceptada por la DIAN, el documento original quedará anulado.</p>
                </div>
              </div>
            }

            <!-- Notas / Motivo -->
            <div class="form-group">
              <label class="form-label">Motivo / Notas</label>
              <textarea class="form-control" [(ngModel)]="ajusteForm.notes" rows="2"
                        [placeholder]="ajusteType()==='Eliminar' ? 'Motivo de la eliminación…' : 'Describe la corrección realizada…'"></textarea>
            </div>

            <!-- Advertencia -->
            <div class="nae-warning">
              <span class="material-symbols-outlined">warning</span>
              <span>Se creará un borrador NIAE. Verifica todos los datos antes de transmitir a la DIAN. El número correlativo NIAE se asigna automáticamente.</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeAjusteModal()">Cancelar</button>
            <button class="btn"
                    [class.btn--ajuste-reemplazar]="ajusteType()==='Reemplazar'"
                    [class.btn--ajuste-eliminar]="ajusteType()==='Eliminar'"
                    [disabled]="submittingAjuste()"
                    (click)="submitAjuste()">
              <span class="material-symbols-outlined" style="font-size:16px">
                {{ ajusteType() === 'Eliminar' ? 'remove_circle' : 'edit_document' }}
              </span>
              {{ submittingAjuste() ? 'Creando…' : 'Crear borrador NIAE — ' + ajusteType() }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Diálogo de confirmación global -->
    <app-confirm-dialog />

    <!-- ══ MODAL: EMPLEADO ════════════════════════════════════════════════ -->
    @if (showEmployeeModal()) {
      <div class="modal-overlay">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editEmployeeId() ? 'Editar empleado' : 'Nuevo empleado' }}</h3>
            <button class="modal-close" (click)="closeEmployeeModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Nombres *</label><input type="text" class="form-control" [(ngModel)]="empForm.firstName" /></div>
              <div class="form-group"><label class="form-label">Apellidos *</label><input type="text" class="form-control" [(ngModel)]="empForm.lastName" /></div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Tipo documento</label>
                <select class="form-control" [(ngModel)]="empForm.documentType">
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula extranjería</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
              </div>
              <div class="form-group"><label class="form-label">N° Documento *</label><input type="text" class="form-control" [(ngModel)]="empForm.documentNumber" /></div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Cargo *</label><input type="text" class="form-control" [(ngModel)]="empForm.position" placeholder="Ej: Contador, Vendedor…" /></div>
              <div class="form-group">
                <label class="form-label">Tipo contrato</label>
                <select class="form-control" [(ngModel)]="empForm.contractType">
                  <option value="INDEFINITE">Indefinido</option>
                  <option value="FIXED">Término fijo</option>
                  <option value="PROJECT">Obra o labor</option>
                  <option value="APPRENTICE">Aprendizaje</option>
                </select>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Salario base *</label><input type="number" class="form-control" [(ngModel)]="empForm.baseSalary" min="0" /></div>
              <div class="form-group"><label class="form-label">Fecha de ingreso *</label><input type="date" class="form-control" [(ngModel)]="empForm.hireDate" /></div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Sucursal</label>
                <select class="form-control" [(ngModel)]="empForm.branchId">
                  <option value="">Sucursal principal (por defecto)</option>
                  @for (branch of branches(); track branch.id) {
                    <option [value]="branch.id">{{ branch.name }}{{ branch.isMain ? ' (Principal)' : '' }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Correo electrónico</label>
                <input type="email" class="form-control" [(ngModel)]="empForm.email" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-control" [(ngModel)]="empForm.phone" /></div>
              <div class="form-group"></div>
            </div>
            <!-- País y Departamento -->
            <div class="form-section-title">Ubicación</div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">País</label>
                <select class="form-control" [(ngModel)]="empForm.country" (ngModelChange)="onCountryChange($event)">
                  <option value="">— Seleccionar país —</option>
                  @for (c of countries(); track c.code) {
                    <option [value]="c.code">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Departamento</label>
                @if (empForm.country === 'CO') {
                  <select class="form-control" [(ngModel)]="empForm.departmentCode" (ngModelChange)="onDepartmentChange($event)" [disabled]="!empForm.country">
                    <option value="">— Seleccionar departamento —</option>
                    @for (d of departments(); track d.code) {
                      <option [value]="d.code">{{ d.name }}</option>
                    }
                  </select>
                } @else {
                  <input type="text" class="form-control" [(ngModel)]="empForm.departmentCode" placeholder="Estado / Provincia" />
                }
              </div>
            </div>
            <!-- Municipio / Ciudad -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">
                  @if (empForm.country === 'CO') { Municipio (DIVIPOLA) } @else { Ciudad }
                </label>
                @if (empForm.country === 'CO') {
                  <div class="muni-search-wrap">
                    <input type="text"
                           [value]="muniSearchText()"
                           (input)="onMuniSearch($any($event.target).value)"
                           (focus)="muniDropdownOpen.set(true)"
                           class="form-control"
                           [placeholder]="empForm.departmentCode ? 'Buscar municipio...' : 'Selecciona primero el departamento'"
                           [disabled]="!empForm.departmentCode"
                           autocomplete="off" />
                    @if (muniDropdownOpen() && filteredMunicipalities().length > 0) {
                      <div class="muni-dropdown">
                        @for (m of filteredMunicipalities(); track m.code) {
                          <div class="muni-option" (mousedown)="selectMunicipality(m)">
                            {{ m.name }} <span class="muni-code">{{ m.code }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <input type="text" class="form-control" [(ngModel)]="empForm.cityCode" placeholder="Ciudad" />
                }
              </div>
              <div class="form-group">
                <label class="form-label">Banco</label>
                <select class="form-control" [(ngModel)]="empForm.bankCode" (change)="onBankChange()">
                  <option value="">-- Selecciona banco --</option>
                  @for (bank of banks(); track bank.code) {
                    <option [value]="bank.code">{{ bank.code }} - {{ bank.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-group"><label class="form-label">N° Cuenta bancaria</label><input type="text" class="form-control" [(ngModel)]="empForm.bankAccount" /></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeEmployeeModal()">Cancelar</button>
            <button class="btn btn--primary" (click)="saveEmployee()" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : (editEmployeeId() ? 'Guardar cambios' : 'Crear empleado') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Layout ──────────────────────────────────────────────────────────── */
    .py { max-width:1320px; padding-bottom:22px; }
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.3fr) minmax(280px, .7fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.16), transparent 26%),
        radial-gradient(circle at bottom right, rgba(59,130,246,.16), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0f7a72 100%);
      box-shadow:0 24px 48px rgba(12,28,53,.16);
      color:#fff;
    }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; }
    .hero-copy { max-width:680px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#89f3d1;
    }
    .page-header__title { font-family:'Sora',sans-serif; font-size:32px; line-height:1.02; font-weight:800; color:#fff; margin:0 0 10px; letter-spacing:-.05em; }
    .page-header__sub   { font-size:14px; color:rgba(236,244,255,.8); margin:0; line-height:1.6; max-width:58ch; }
    .page-header__actions { display:flex; gap:8px; flex-shrink:0; }
    .hero-insights { display:grid; gap:12px; align-content:start; }
    .hero-stat {
      padding:18px;
      border-radius:20px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.16);
      backdrop-filter:blur(10px);
    }
    .hero-stat__label {
      display:block;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#a7f3d0;
      margin-bottom:8px;
    }
    .hero-stat__value {
      display:block;
      font-family:'Sora',sans-serif;
      font-size:38px;
      line-height:1;
      letter-spacing:-.06em;
      margin-bottom:8px;
    }
    .hero-stat__hint {
      display:block;
      font-size:12px;
      line-height:1.5;
      color:rgba(236,244,255,.72);
    }
    .hero-mini-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:10px;
    }
    .hero-mini-card {
      padding:12px 14px;
      border-radius:16px;
      background:rgba(255,255,255,.1);
      border:1px solid rgba(255,255,255,.12);
    }
    .hero-mini-card__label {
      display:block;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:rgba(236,244,255,.7);
      margin-bottom:5px;
    }
    .hero-mini-card strong {
      font-family:'Sora',sans-serif;
      font-size:20px;
      color:#fff;
      letter-spacing:-.04em;
    }

    /* ── KPI strip ─────────────────────────────────────────────────────── */
    .kpi-strip {
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:14px;
      margin-bottom:18px;
    }
    .kpi-card {
      display:flex;
      align-items:flex-start;
      gap:14px;
      padding:16px 18px;
      border-radius:20px;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      box-shadow:0 16px 28px rgba(12,28,53,.05);
    }
    .kpi-card__icon {
      width:44px;
      height:44px;
      border-radius:14px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg, #e0efff, #eefbf7);
      color:#1a407e;
      flex-shrink:0;
    }
    .kpi-card__icon .material-symbols-outlined { font-size:22px; }
    .kpi-card__label {
      display:block;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.08em;
      color:#7b8fa8;
      margin-bottom:6px;
    }
    .kpi-card__value {
      font-family:'Sora',sans-serif;
      font-size:22px;
      line-height:1.1;
      letter-spacing:-.05em;
      color:#0c1c35;
    }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */
    .tab-shell {
      margin-bottom:18px;
      padding:8px;
      border-radius:20px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 12px 26px rgba(12,28,53,.05);
    }
    .py__tabs { display:flex; gap:6px; overflow-x:auto; }
    .py__tab  { display:flex; align-items:center; gap:6px; padding:10px 18px; border:none; background:transparent;
                font-size:13.5px; font-weight:600; color:#64748b; cursor:pointer; white-space:nowrap;
                transition:all .15s; border-radius:14px; }
    .py__tab .material-symbols-outlined { font-size:18px; }
    .py__tab:hover { color:#1a407e; background:#f8fafc; }
    .py__tab--active { color:#1a407e; background:#eff6ff; box-shadow:inset 0 0 0 1px #bfdbfe; }

    /* ── Filters bar ─────────────────────────────────────────────────────── */
    .filters-shell {
      margin-bottom:14px;
      padding:16px;
      border-radius:22px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 12px 28px rgba(12,28,53,.05);
    }
    .filters-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .filters-bar__controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .search-wrap  { flex:1; position:relative; min-width:180px; max-width:300px; }
    .search-icon  { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px;
                    font-size:13.5px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-group-inline { display:flex; align-items:center; gap:6px; }
    .form-label-sm { font-size:12px; font-weight:600; color:#64748b; white-space:nowrap; }
    .filter-select { padding:7px 10px; border:1px solid #dce6f0; border-radius:8px; font-size:13px; outline:none; background:#fff; color:#374151; }

    /* ── View toggle ─────────────────────────────────────────────────────── */
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-left:auto; flex-shrink:0; background:#fff; box-shadow:0 8px 18px rgba(12,28,53,.03); }
    .view-toggle button { padding:7px 10px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; display:flex; align-items:center; }
    .view-toggle button .material-symbols-outlined { font-size:18px; }
    .view-toggle button:hover  { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }

    /* ── Filter chips ────────────────────────────────────────────────────── */
    .filter-chips { display:flex; gap:6px; flex-wrap:wrap; }
    .chip          { padding:5px 12px; border:1px solid #dce6f0; border-radius:20px; background:#fff;
                     font-size:12.5px; font-weight:600; color:#64748b; cursor:pointer; transition:all .15s; }
    .chip:hover    { border-color:#1a407e; color:#1a407e; background:#f0f4f9; }
    .chip--active  { background:#1a407e; border-color:#1a407e; color:#fff; }

    /* ── Period summary ──────────────────────────────────────────────────── */
    .py__resumen { display:flex; background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; border-radius:20px; overflow:hidden; margin-bottom:16px; flex-wrap:wrap; box-shadow:0 14px 26px rgba(12,28,53,.05); }
    .py__res-item { flex:1; min-width:120px; padding:14px 16px; border-right:1px solid #f0f4f8; }
    .py__res-item:last-child { border-right:none; }
    .py__res-label  { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; font-weight:600; display:block; }
    .py__res-val    { font-family:'Sora',sans-serif; font-size:15px; font-weight:800; color:#0c1c35; margin-top:4px; display:block; }
    .py__res-val--hl { color:#1a407e; }

    /* ── Content shells ─────────────────────────────────────────────────── */
    .content-shell {
      border-radius:24px;
      background:rgba(255,255,255,.78);
      border:1px solid #dce6f0;
      box-shadow:0 16px 32px rgba(12,28,53,.05);
      overflow:hidden;
      margin-bottom:12px;
    }
    .content-shell__head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:14px;
      padding:18px 20px 16px;
      border-bottom:1px solid #e9eef5;
      background:
        radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 24%),
        linear-gradient(180deg, #fbfdff 0%, #f6faff 100%);
    }
    .content-shell__kicker {
      margin:0 0 5px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .content-shell__head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .content-shell__meta {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      align-items:center;
    }
    .content-chip {
      padding:7px 11px;
      border-radius:999px;
      background:#0f274b;
      color:#fff;
      font-size:11px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .content-chip--soft {
      background:#edf5ff;
      color:#1a407e;
      border:1px solid #bfdbfe;
    }

    /* ── Table card ──────────────────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; margin-bottom:12px; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; text-align:left; font-size:11px; font-weight:800; color:#8aa0b8;
                     text-transform:uppercase; letter-spacing:.08em; background:#f8fbff; border-bottom:1px solid #f0f4f8; white-space:nowrap; }
    .data-table td { padding:14px 16px; font-size:13px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .row--inactive td { opacity:.55; }
    .actions-cell { text-align:right; white-space:nowrap; }

    /* ── Employee cell ───────────────────────────────────────────────────── */
    .emp-cell { display:flex; align-items:center; gap:10px; }
    .emp-av   { width:34px; height:34px; border-radius:8px; flex-shrink:0;
                background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff;
                font-size:12px; font-weight:700; display:flex; align-items:center;
                justify-content:center; font-family:'Sora',sans-serif; text-transform:uppercase; }
    .emp-av--inactive { background:linear-gradient(135deg,#94a3b8,#cbd5e1); }
    .emp-name { font-weight:600; color:#0c1c35; font-size:13.5px; }
    .emp-sub  { font-size:11.5px; color:#94a3b8; margin-top:1px; }

    /* ── Misc table ──────────────────────────────────────────────────────── */
    .td-cur     { font-family:'Sora',sans-serif; font-size:13px; white-space:nowrap; }
    .td-net     { font-weight:700; color:#0c1c35; }
    .text-muted { color:#94a3b8; }
    .text-danger{ color:#dc2626; }
    .period-badge { background:#e8eef8; color:#1a407e; font-size:11.5px; font-weight:700;
                    padding:3px 8px; border-radius:6px; font-family:'Sora',sans-serif; }
    .doc-badge { background:#e8eef8; color:#1a407e; font-size:10px; font-weight:700;
                 padding:2px 6px; border-radius:4px; margin-right:4px; }
    .doc-num   { font-family:monospace; font-size:12.5px; color:#374151; }

    /* ── Badges ──────────────────────────────────────────────────────────── */
    .badge          { display:inline-block; padding:3px 9px; border-radius:20px; font-size:11px; font-weight:700; }
    .badge--draft   { background:#f3f4f6; color:#6b7280; }
    .badge--submit  { background:#dbeafe; color:#1e40af; }
    .badge--accept  { background:#d1fae5; color:#065f46; }
    .badge--reject  { background:#fee2e2; color:#991b1b; }
    .badge--void    { background:#fef3c7; color:#92400e; }
    .badge--neutral { background:#f1f5f9; color:#475569; }
    .badge--niae    { background:#f0f6ff; color:#1a407e; border:1px solid #c7dbf7; }
    .badge--anulado { background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; }
    .status-badge       { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge--on   { background:#d1fae5; color:#065f46; }
    .status-badge--off  { background:#fee2e2; color:#991b1b; }

    /* ── DIAN ────────────────────────────────────────────────────────────── */
    .dian-num { font-family:monospace; font-size:11px; color:#1a407e; font-weight:700; }
    .dian-st  { font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; }
    .dian-ok  { background:#d1fae5; color:#065f46; }
    .dian-err { background:#fee2e2; color:#991b1b; }

    /* ── Row actions ─────────────────────────────────────────────────────── */
    .row-actions { display:flex; align-items:center; gap:4px; justify-content:flex-end; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer;
                color:#94a3b8; transition:all .14s; display:flex; align-items:center; box-shadow:0 6px 16px rgba(12,28,53,.03); }
    .btn-icon .material-symbols-outlined { font-size:18px; }
    .btn-icon:hover          { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
    .btn-icon:disabled       { opacity:.4; cursor:default; }
    .btn-icon--primary:hover { background:#e8eef8; color:#1a407e; }
    .btn-icon--danger:hover  { background:#fee2e2; color:#dc2626; }

    /* ── Buscador de municipios ───────────────────────────────────────────── */
    .muni-search-wrap { position:relative; }
    .muni-dropdown    { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff;
                        border:1px solid #dce6f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.12);
                        z-index:300; max-height:220px; overflow-y:auto; }
    .muni-option      { padding:8px 12px; cursor:pointer; font-size:13px;
                        display:flex; justify-content:space-between; align-items:center; }
    .muni-option:hover { background:#f0f4f9; }
    .muni-code        { color:#8fa3c0; font-size:11px; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;
                          color:#1a407e; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

    /* ── Skeleton ────────────────────────────────────────────────────────── */
    .table-loading { padding:12px 16px; }
    .sk-row  { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk      { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%);
               background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-av   { width:34px; height:34px; border-radius:8px; flex-shrink:0; }
    .sk-ln   { flex-shrink:0; }
    .rc-sk-av { width:48px; height:48px; border-radius:10px; display:block; margin:0 auto 10px; }
    .ec-sk-av { width:52px; height:52px; border-radius:12px; display:block; margin:0 auto 10px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ── Empty states ────────────────────────────────────────────────────── */
    .empty-icon { font-size:48px; color:#dce6f0; }
    .empty-state      { padding:56px 24px; text-align:center; color:#94a3b8; }
    .empty-state p    { margin:12px 0 18px; font-size:14px; }
    .empty-state-grid { grid-column:1/-1; padding:56px 24px; text-align:center; color:#94a3b8;
                        background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .empty-state-grid p { margin:12px 0 18px; font-size:14px; }

    /* ══ RECORD GRID ══════════════════════════════════════════════════════ */
    .record-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; margin-bottom:12px; }
    .record-card { background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; border-radius:20px;
                   padding:18px 16px 14px; position:relative; display:flex; flex-direction:column;
                   transition:box-shadow .18s, transform .18s, border-color .18s; box-shadow:0 12px 26px rgba(12,28,53,.04); }
    .record-card:hover     { box-shadow:0 18px 32px rgba(26,64,126,.1); transform:translateY(-3px); border-color:#93c5fd; }
    .record-card--voided   { opacity:.65; border-color:#fde8c7; background:#fffbf5; }
    .record-card--anulado  { border-color:#fde68a; background:#fffbeb; }
    .record-card--sk       { pointer-events:none; }
    .rc-status { position:absolute; top:12px; right:12px; }
    .rc-top    { display:flex; flex-direction:column; align-items:center; text-align:center; padding:4px 0 14px; }
    .rc-av     { width:48px; height:48px; border-radius:10px; flex-shrink:0;
                 background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff;
                 font-size:16px; font-weight:700; display:flex; align-items:center;
                 justify-content:center; font-family:'Sora',sans-serif; text-transform:uppercase; margin-bottom:10px; }
    .rc-name   { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:3px; }
    .rc-sub    { font-size:12px; color:#94a3b8; }
    .rc-amounts { border-top:1px solid #f0f4f8; padding-top:12px; margin-bottom:12px; display:flex; flex-direction:column; gap:6px; }
    .rc-amount-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; }
    .rc-amount-row--neto { border-top:1px dashed #f0f4f8; padding-top:6px; margin-top:2px; }
    .rc-lbl    { color:#64748b; }
    .rc-neto   { color:#0c1c35; font-size:14px; }
    .rc-dian   { display:flex; flex-direction:column; gap:4px; margin-bottom:10px;
                 background:#f8fafc; border:1px solid #f0f4f8; border-radius:8px; padding:8px 10px; font-size:11.5px; }
    .rc-actions { display:flex; gap:6px; align-items:center; border-top:1px solid #f0f4f8; padding-top:10px; }

    /* ══ EMPLOYEE GRID ════════════════════════════════════════════════════ */
    .employee-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:14px; margin-bottom:12px; }
    .employee-card { background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; border-radius:20px;
                     padding:18px 16px 14px; position:relative; display:flex; flex-direction:column;
                     transition:box-shadow .18s, transform .18s, border-color .18s; box-shadow:0 12px 26px rgba(12,28,53,.04); }
    .employee-card:hover  { box-shadow:0 18px 32px rgba(26,64,126,.1); transform:translateY(-3px); border-color:#93c5fd; }
    .employee-card--off   { opacity:.7; border-color:#f0d4d4; background:#fdfafa; }
    .employee-card--sk    { pointer-events:none; }
    .ec-status { position:absolute; top:12px; right:12px; }
    .ec-top    { display:flex; flex-direction:column; align-items:center; text-align:center; padding:4px 0 12px; }
    .ec-av     { width:52px; height:52px; border-radius:12px; flex-shrink:0;
                 background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff;
                 font-size:17px; font-weight:700; display:flex; align-items:center;
                 justify-content:center; font-family:'Sora',sans-serif; text-transform:uppercase; margin-bottom:10px; }
    .ec-av--off { background:linear-gradient(135deg,#94a3b8,#cbd5e1); }
    .ec-name   { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:3px; }
    .ec-pos    { font-size:12px; color:#94a3b8; }
    .ec-info   { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px;
                 display:flex; flex-direction:column; gap:5px; flex:1; }
    .ec-row    { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; }
    .ec-row .material-symbols-outlined { font-size:14px; color:#94a3b8; flex-shrink:0; }
    .ec-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ec-salary { color:#065f46; font-weight:600; }
    .ec-salary .material-symbols-outlined { color:#059669; }
    .ec-actions { display:flex; gap:6px; align-items:center; border-top:1px solid #f0f4f8; padding-top:10px; }

    /* ══ DRAWER (panel detalle derecho) ══════════════════════════════════ */
    .drawer-overlay { position:fixed; inset:0; background:rgba(12,28,53,.45); z-index:200; display:flex; justify-content:flex-end; backdrop-filter:blur(2px); }
    .drawer { width:480px; max-width:100vw; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-8px 0 40px rgba(12,28,53,.15); }
    .drawer-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #f0f4f8; flex-shrink:0; gap:12px; }
    .drawer-header-left { flex:1; min-width:0; }
    .drawer-emp-name { font-family:'Sora',sans-serif; font-size:18px; font-weight:800; color:#0c1c35; letter-spacing:.3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .drawer-inv-meta { display:flex; align-items:center; gap:6px; margin-top:5px; flex-wrap:wrap; }
    .drawer-dot { color:#cbd5e1; font-size:12px; }
    .drawer-date { font-size:12px; color:#94a3b8; }
    .drawer-header-right { display:flex; align-items:center; gap:8px; flex-shrink:0; padding-top:2px; }
    .drawer-close { background:none; border:none; cursor:pointer; color:#94a3b8; padding:5px; border-radius:7px; transition:all .15s; }
    .drawer-close:hover { background:#f1f5f9; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:0; scrollbar-width:thin; scrollbar-color:#e2e8f0 transparent; }
    .drawer-body::-webkit-scrollbar { width:4px; }
    .drawer-body::-webkit-scrollbar-track { background:transparent; }
    .drawer-body::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }
    .drawer-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; gap:8px; flex-shrink:0; flex-wrap:wrap; align-items:center; }
    .dw-section { padding:16px 22px; border-bottom:1px solid #f8fafc; }
    .dw-section:last-child { border-bottom:none; }
    .dw-section-title { display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; margin-bottom:10px; }
    .dw-section-title svg { flex-shrink:0; }
    .dw-card { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; padding:12px 14px; }
    .dw-client-name { font-size:14px; font-weight:700; color:#0c1c35; margin-bottom:2px; }
    .dw-client-doc { font-size:12px; color:#64748b; font-family:monospace; margin-bottom:4px; }
    .dw-client-extra { display:flex; align-items:center; gap:5px; font-size:12px; color:#64748b; margin-top:4px; }
    .dw-client-extra svg { color:#94a3b8; flex-shrink:0; }
    .dw-pay-table { border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .dw-pay-row { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border-bottom:1px solid #f8fafc; font-size:12.5px; color:#374151; }
    .dw-pay-row:last-child { border-bottom:none; }
    .dw-pay-row span:last-child { font-weight:600; color:#0c1c35; font-family:monospace; }
    .dw-pay-total { background:#f8fafc; border-top:1px solid #e8eef8 !important; font-weight:700; }
    .dw-pay-total span:last-child { font-family:'Sora',sans-serif; font-size:13.5px; color:#1a407e !important; }
    .dw-pay-total--ded span:last-child { color:#dc2626 !important; }
    .dw-summary-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .dw-summary-card { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; padding:12px 14px; }
    .dw-summary-card--neto { background:#f0f6ff; border-color:#c7dbf7; }
    .dw-summary-lbl { display:block; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-bottom:5px; }
    .dw-summary-val { font-family:'Sora',sans-serif; font-size:17px; font-weight:800; color:#1a407e; }
    .dw-summary-val--sec { font-size:15px; color:#64748b; }
    .dw-summary-card--neto .dw-summary-lbl { color:#1a407e; }
    .dw-dian-card { padding:10px 14px; }
    .dw-dian-row { display:flex; align-items:center; justify-content:space-between; }
    .dw-dian-lbl { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; }
    .dw-dian-cufe { margin-top:4px; }
    .dw-cufe-code { display:block; font-size:10px; color:#475569; font-family:monospace; word-break:break-all; margin-top:4px; background:#f1f5f9; padding:6px 8px; border-radius:6px; line-height:1.5; }
    .dian-msg-block { padding:8px 10px; background:#f8fafc; border-radius:7px; border-left:3px solid #94a3b8; font-size:12px; color:#374151; line-height:1.5; }
    .dian-msg-ok { border-left-color:#10b981; background:#f0fdf4; color:#065f46; }
    .dian-msg-err { border-left-color:#dc2626; background:#fef2f2; color:#991b1b; }
    .dian-errors-block { border:1px solid #fca5a5; border-radius:8px; overflow:hidden; }
    .dian-errors-header { display:flex; align-items:center; gap:6px; padding:7px 10px; background:#fef2f2; font-size:11.5px; font-weight:600; color:#b91c1c; border-bottom:1px solid #fca5a5; }
    .dian-errors-list { list-style:none; margin:0; padding:0; }
    .dian-error-item { display:flex; align-items:flex-start; gap:6px; padding:7px 10px; font-size:11.5px; line-height:1.45; border-bottom:1px solid #fee2e2; }
    .dian-error-item:last-child { border-bottom:none; }
    .dian-error-rechazo { background:#fff5f5; }
    .dian-error-notif { background:#fafafa; }
    .dian-error-badge { flex-shrink:0; margin-top:1px; padding:1px 5px; border-radius:3px; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; }
    .dian-error-rechazo .dian-error-badge { background:#fee2e2; color:#b91c1c; }
    .dian-error-notif .dian-error-badge { background:#e0f2fe; color:#0369a1; }
    .dian-error-text { color:#374151; }
    .dw-notes { font-size:13px; color:#475569; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; line-height:1.5; }

    /* ══ MODALS ═══════════════════════════════════════════════════════════ */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200;
                     display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal      { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh;
                  display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.18); overflow:hidden; }
    .modal--lg  { max-width:680px; }
    .modal--xl  { max-width:860px; }
    .modal-header { display:flex; align-items:center; gap:10px; padding:18px 22px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0; flex:1; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; display:flex; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body   { flex:1; overflow-y:auto; padding:20px 22px; }
    .modal-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; justify-content:flex-end; gap:10px; flex-shrink:0; }

    /* Payroll form grid */
    .py__form-grid { display:grid; grid-template-columns:1fr 300px; gap:24px; }
    .py__preview   { background:#f8fafc; border:1px solid #e8eef8; border-radius:12px; padding:16px; height:fit-content; position:sticky; top:0; }
    .py__preview-title { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#1a407e; margin-bottom:12px; }
    .py__preview-title .material-symbols-outlined { font-size:18px; }
    .py__preview-rows  { display:flex; flex-direction:column; }
    .py__preview-empty { font-size:13px; color:#94a3b8; text-align:center; padding:24px 0; }
    .py__pr        { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f4f8; font-size:12.5px; color:#374151; }
    .py__pr--head  { background:#eef2f8; color:#1a407e; font-weight:700; font-size:11px; text-transform:uppercase;
                     letter-spacing:.05em; padding:5px 8px; border-radius:4px; margin:6px 0 2px; border:none; }
    .py__pr--sub   { color:#64748b; font-weight:600; }
    .py__pr--neto  { border-top:2px solid #1a407e; font-weight:700; color:#0c1c35; font-size:14px; padding-top:8px; margin-top:4px; border-bottom:none; }
    .py__pr--costo { color:#64748b; font-size:12px; border-bottom:none; }

    /* Form helpers */
    .form-group         { margin-bottom:12px; }
    .form-row-2         { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-label         { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;
                          color:#1a407e; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8eef8; }
    .form-control       { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px;
                          font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    textarea.form-control { resize:vertical; min-height:52px; }

    /* Buttons */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px;
           font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn--primary   { background:#1a407e; color:#fff; }
    .btn--primary:hover:not(:disabled) { background:#133265; }
    .btn--primary:disabled { opacity:.6; cursor:default; }
    .btn--secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn--secondary:hover { background:#e8eef8; }
    .btn--sm { padding:7px 14px; font-size:12.5px; }

    /* Download buttons (still used in drawer footer) */
    .btn--dl-xml { background:#fff; color:#1a407e; border:1.5px solid #1a407e; }
    .btn--dl-xml:hover:not(:disabled) { background:#e8eef8; }
    .btn--dl-zip { background:#1a407e; color:#fff; border:1.5px solid #1a407e; }
    .btn--dl-zip:hover:not(:disabled) { background:#133265; }
    .btn--dl-xml:disabled, .btn--dl-zip:disabled { opacity:.55; cursor:default; }

    /* DIAN result modal */
    .dian-banner { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:10px; margin-bottom:16px; }
    .dian-banner .material-symbols-outlined { font-size:28px; flex-shrink:0; }
    .dian-banner--ok  { background:#d1fae5; color:#065f46; }
    .dian-banner--err { background:#fee2e2; color:#991b1b; }
    .dian-banner__title { font-weight:700; font-size:14px; }
    .dian-banner__sub   { font-size:12px; opacity:.8; margin-top:2px; }
    .dian-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
    .dian-item { background:#f8fafc; border-radius:8px; padding:10px 12px; }
    .dian-lbl  { display:block; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
    .dian-val  { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; }
    .dian-code { font-family:monospace; font-size:12.5px; color:#1a407e; word-break:break-all; }
    .dian-code--sm { font-size:10px; }
    .dian-hint  { display:flex; align-items:flex-start; gap:8px; background:#eff6ff; border-radius:8px;
                  padding:10px 12px; font-size:12.5px; color:#1e40af; }
    .dian-hint .material-symbols-outlined { font-size:18px; flex-shrink:0; margin-top:1px; }

    /* ══ NOTA DE AJUSTE ════════════════════════════════════════════════════ */
    .modal-header--eliminar { background:#fff8f8; border-bottom-color:#fee2e2; }
    .nae-header-icon { font-size:22px; flex-shrink:0; color:#dc2626; }
    .modal-header:not(.modal-header--eliminar) .nae-header-icon { color:#1a407e; }
    .nae-sub { font-size:11.5px; color:#94a3b8; margin-top:2px; }

    /* Ref box */
    .nae-ref-box { background:#f0f6ff; border:1px solid #c7dbf7; border-radius:10px; padding:14px; margin-bottom:16px; }
    .nae-ref-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px; }
    .nae-ref-title .material-symbols-outlined { font-size:15px; }
    .nae-ref-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; font-size:12.5px; }
    .nae-ref-lbl  { display:block; font-size:10.5px; color:#94a3b8; font-weight:700; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px; }
    .nae-ref-cune { font-size:11px; color:#374151; word-break:break-all; margin-top:6px; border-top:1px solid #dce6f0; padding-top:8px; }

    /* Tipo bar */
    .nae-tipo-bar { display:flex; gap:8px; margin-bottom:18px; }
    .nae-tipo-btn { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 10px; border:2px solid #dce6f0; border-radius:10px; background:#fff; cursor:pointer; transition:all .15s; }
    .nae-tipo-btn .material-symbols-outlined { font-size:22px; color:#94a3b8; }
    .nae-tipo-btn { font-size:13.5px; font-weight:700; color:#374151; }
    .nae-tipo-hint { font-size:11px; color:#94a3b8; font-weight:400; }
    .nae-tipo-btn:hover { border-color:#1a407e; background:#f0f6ff; }
    .nae-tipo-btn:hover .material-symbols-outlined { color:#1a407e; }
    .nae-tipo-btn--active { border-color:#1a407e; background:#f0f6ff; }
    .nae-tipo-btn--active .material-symbols-outlined { color:#1a407e; }
    .nae-tipo-btn--eliminar:hover, .nae-tipo-btn--eliminar.nae-tipo-btn--active { border-color:#dc2626; background:#fff8f8; }
    .nae-tipo-btn--eliminar:hover .material-symbols-outlined, .nae-tipo-btn--eliminar.nae-tipo-btn--active .material-symbols-outlined { color:#dc2626; }

    /* Info eliminar */
    .nae-eliminar-info { display:flex; gap:10px; background:#fff8f8; border:1px solid #fecaca; border-radius:10px; padding:14px; margin-bottom:14px; color:#991b1b; font-size:13px; }
    .nae-eliminar-info .material-symbols-outlined { font-size:22px; flex-shrink:0; margin-top:1px; }
    .nae-eliminar-info strong { display:block; margin-bottom:4px; font-size:13.5px; }
    .nae-eliminar-info p { margin:0; font-size:12.5px; line-height:1.5; }

    /* Warning */
    .nae-warning { display:flex; align-items:flex-start; gap:8px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; font-size:12px; color:#92400e; margin-top:12px; }
    .nae-warning .material-symbols-outlined { font-size:18px; flex-shrink:0; }

    /* Botones ajuste */
    .btn--ajuste-reemplazar { background:#1a407e; color:#fff; }
    .btn--ajuste-reemplazar:hover:not(:disabled) { background:#133265; }
    .btn--ajuste-eliminar   { background:#dc2626; color:#fff; }
    .btn--ajuste-eliminar:hover:not(:disabled)   { background:#b91c1c; }
    .btn-icon--ajuste:hover { background:#e0f0ff; color:#1a407e; }
    .btn-icon--void:hover   { background:#fff0f0; color:#dc2626; }

    /* ══ RESPONSIVE ═══════════════════════════════════════════════════════ */
    @media (max-width: 900px) {
      .hero-shell { grid-template-columns:1fr; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .py__resumen { flex-wrap:wrap; }
      .py__res-item { flex:1 1 45%; }
      .py__form-grid { grid-template-columns:1fr; }
      .drawer { width:100vw; }
      .py__preview { order:-1; position:static; }
      .record-grid   { grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
      .employee-grid { grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); }
      .dian-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 768px) {
      .hero-shell { padding:18px; border-radius:24px; }
      .page-header__title { font-size:26px; }
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header__actions { justify-content:flex-end; }
      .content-shell__head { flex-direction:column; align-items:flex-start; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .filters-bar__controls { flex:1 1 100%; }
      .view-toggle { margin-left:0; }
    }

    @media (max-width: 640px) {
      .hero-shell { padding:16px; gap:14px; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:1fr; }
      .page-header__actions { width:100%; }
      .page-header__actions .btn { width:100%; justify-content:center; }
      .tab-shell,
      .filters-shell { padding:12px; }
      .py__resumen { flex-direction:column; }
      .py__res-item { border-right:none; border-bottom:1px solid #f0f4f8; }
      .py__res-item:last-child { border-bottom:none; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:620px; }
      .record-grid   { grid-template-columns:repeat(2,1fr); gap:10px; }
      .employee-grid { grid-template-columns:repeat(2,1fr); gap:10px; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal, .modal--lg, .modal--xl { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .form-row-2 { grid-template-columns:1fr; }
    }

    @media (max-width: 400px) {
      .record-grid   { grid-template-columns:1fr; }
      .employee-grid { grid-template-columns:1fr; }
    }
  `],
})
export class PayrollComponent implements OnInit {
  private http   = inject(HttpClient);
  private notify = inject(NotificationService);
  private auth   = inject(AuthService);
  private dialog = inject(ConfirmDialogService);

  private readonly api = `${environment.apiUrl}/payroll`;

  activeTab         = signal<ActiveTab>('records');
  recordView        = signal<ViewMode>('table');
  empView           = signal<ViewMode>('table');
  records           = signal<PayrollRecord[]>([]);
  employees         = signal<Employee[]>([]);
  loadingRecords    = signal(true);
  loadingEmployees  = signal(true);
  saving            = signal(false);

  recordSearch  = '';
  periodFilter  = new Date().toISOString().slice(0, 7);
  statusFilter  = '';
  empSearch     = '';
  empActive     = signal<boolean | undefined>(true);

  summary           = signal<PeriodSummary | null>(null);
  transmitting      = signal(false);
  downloading       = signal(false);   // descarga XML/ZIP en curso
  showAjusteModal   = signal(false);
  ajusteSource      = signal<PayrollRecord | null>(null);  // NIE original
  ajusteType        = signal<'Reemplazar' | 'Eliminar'>('Reemplazar');
  submittingAjuste  = signal(false);
  showDianResult    = signal(false);
  dianResult        = signal<any | null>(null);
  preview           = signal<any | null>(null);
  showRecordDetail  = signal(false);
  selectedRecord    = signal<PayrollRecord | null>(null);
  showPayrollModal  = signal(false);
  showEmployeeModal = signal(false);
  editEmployeeId    = signal<string | null>(null);
  banks             = signal<Bank[]>([]);
  branches          = signal<Branch[]>([]);
  empBranchFilter   = signal('');

  private readonly GEO_API = `${environment.apiUrl}/location`;
  countries      = signal<GeoCountry[]>([]);
  departments    = signal<Department[]>([]);
  municipalities = signal<Municipality[]>([]);
  muniSearchText   = signal('');
  muniDropdownOpen = signal(false);
  loadingMunis     = signal(false);
  private muniSearch$ = new Subject<{ q: string; dept: string }>();
  filteredMunicipalities = computed(() => {
    const text = this.muniSearchText().toLowerCase().trim();
    const deptCode = this.empForm?.departmentCode;
    return this.municipalities().filter(m =>
      (!deptCode || m.departmentCode === deptCode) &&
      (text.length < 2 || m.name.toLowerCase().includes(text))
    ).slice(0, 40);
  });

  canCreatePayroll      = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER') || this.hasRole('OPERATOR'));
  canSubmit             = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canVoid               = computed(() => this.hasRole('ADMIN'));
  canManageEmployees    = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canDeactivateEmployee = computed(() => this.hasRole('ADMIN'));
  activeEmployees       = computed(() => this.employees().filter(e => e.isActive));
  acceptedPayrollCount  = computed(() => this.records().filter(r => r.status === 'ACCEPTED').length);
  pendingPayrollCount   = computed(() => this.records().filter(r => ['DRAFT', 'SUBMITTED'].includes(r.status)).length);
  submittedPayrollCount = computed(() => this.records().filter(r => r.status === 'SUBMITTED' || r.status === 'ACCEPTED').length);
  currentNetPay         = computed(() => this.summary()?.totalNetPay ?? this.records().reduce((sum, r) => sum + Number(r.netPay || 0), 0));
  currentEmployerCost   = computed(() => this.summary()?.totalEmployerCost ?? this.records().reduce((sum, r) => sum + Number(r.totalEmployerCost || 0), 0));
  selectedEmployeeBranchLabel = computed(() => {
    const branchId = this.empBranchFilter();
    if (!branchId) return 'Todas las sucursales';
    const branch = this.branches().find(item => item.id === branchId);
    return branch ? branch.name : 'Sucursal';
  });

  payrollForm: any = this.emptyPayrollForm();
  empForm: any     = this.emptyEmpForm();
  ajusteForm: any  = this.emptyAjusteForm();

  ngOnInit() {
    this.loadRecords();
    this.loadEmployees();
    this.loadBranches();
    this.loadCountries();
    this.loadDepartments();
    this.muniSearch$.pipe(
      debounceTime(300),
      switchMap(({ q, dept }) => {
        const params: any = {};
        if (q.length >= 2) params.q = q;
        if (dept) params.departmentCode = dept;
        return this.http.get<Municipality[]>(`${this.GEO_API}/municipalities/search`, { params });
      }),
    ).subscribe({ next: data => this.municipalities.set(data), error: () => {} });
  }

  // ── Payroll records ──────────────────────────────────────────────────────

  loadRecords() {
    this.loadingRecords.set(true);
    const params: any = {};
    if (this.recordSearch) params.search = this.recordSearch;
    if (this.periodFilter) params.period = this.periodFilter;
    if (this.statusFilter) params.status = this.statusFilter;
    this.http.get<any>(`${this.api}/records`, { params }).subscribe({
      next: r => { const res = r.data ?? r; this.records.set(res.data ?? res); this.loadingRecords.set(false); },
      error: () => { this.loadingRecords.set(false); this.notify.error('Error al cargar liquidaciones'); },
    });
    if (this.periodFilter) {
      this.http.get<any>(`${this.api}/records/summary/${this.periodFilter}`).subscribe({
        next: r => this.summary.set(r.data ?? r),
        error: () => {},
      });
    }
  }

  private recordSearchTimer: any;
  onRecordSearch() { clearTimeout(this.recordSearchTimer); this.recordSearchTimer = setTimeout(() => this.loadRecords(), 350); }

  viewRecord(r: PayrollRecord) { this.selectedRecord.set(r); this.showRecordDetail.set(true); }

  openPayrollModal()  { this.payrollForm = this.emptyPayrollForm(); this.preview.set(null); this.showPayrollModal.set(true); }
  closePayrollModal() { this.showPayrollModal.set(false); }

  preselectEmployee(e: Employee) {
    this.payrollForm = { ...this.emptyPayrollForm(), employeeId: e.id, baseSalary: e.baseSalary };
    this.recalculate();
    this.activeTab.set('records');
    this.showPayrollModal.set(true);
  }

  onEmployeeSelected() {
    const emp = this.activeEmployees().find(e => e.id === this.payrollForm.employeeId);
    if (emp) { this.payrollForm.baseSalary = emp.baseSalary; this.recalculate(); }
  }

  recalculate() {
    if (!this.payrollForm.employeeId || !this.payrollForm.baseSalary) { this.preview.set(null); return; }
    const f = this.payrollForm;
    const SMMLV    = 1_300_000;
    const daily    = f.baseSalary / 30;
    const prop     = daily * (f.daysWorked || 30);
    const transport = (f.transportAllowance !== undefined && f.transportAllowance !== null && f.transportAllowance !== '')
      ? Number(f.transportAllowance)
      : (f.baseSalary <= SMMLV * 2 ? 162_000 : 0);
    const overtime = (f.overtimeHours || 0) * (f.baseSalary / 240) * 1.25;
    const earnings = prop + transport + overtime + (f.bonuses || 0) + (f.commissions || 0) + (f.vacationPay || 0);
    const base     = prop + overtime + (f.bonuses || 0);
    const hEmp = base * 0.04;  const pEmp = base * 0.04;
    const hEmpr= base * 0.085; const pEmpr= base * 0.12;
    const arl  = base * 0.00522; const cf = base * 0.04;
    const deductions = hEmp + pEmp + (f.sickLeave || 0) + (f.loans || 0) + (f.otherDeductions || 0);
    this.preview.set({
      totalEarnings:    Math.round(earnings),
      healthEmployee:   Math.round(hEmp),   pensionEmployee:  Math.round(pEmp),
      totalDeductions:  Math.round(deductions),
      healthEmployer:   Math.round(hEmpr),  pensionEmployer:  Math.round(pEmpr),
      arl:              Math.round(arl),    compensationFund: Math.round(cf),
      netPay:           Math.round(earnings - deductions),
      totalEmployerCost:Math.round(earnings + hEmpr + pEmpr + arl + cf),
    });
  }

  savePayroll() {
    if (!this.payrollForm.employeeId || !this.payrollForm.period) { this.notify.error('Selecciona empleado y período'); return; }
    this.saving.set(true);
    this.http.post<any>(`${this.api}/records`, this.payrollForm).subscribe({
      next: () => { this.saving.set(false); this.closePayrollModal(); this.notify.success('Nómina guardada como borrador'); this.loadRecords(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  async submitRecord(r: PayrollRecord) {
    const ok = await this.dialog.confirm({
      title: '¿Transmitir nómina a la DIAN?',
      message: `${r?.employees?.firstName} ${r?.employees?.lastName} — Período: ${r.period}`,
      detail:  r.payrollNumber ? `Número: ${r.payrollNumber}` : 'El número se asignará al transmitir.',
      confirmLabel: 'Transmitir', icon: 'send',
    });
    if (!ok) return;
    this.transmitting.set(true);
    this.http.post<any>(`${this.api}/records/${r.id}/submit`, {}).subscribe({
      next: res => {
        this.transmitting.set(false);
        const d = res?.data ?? res;
        this.dianResult.set(d?.dian ?? { success: true, payrollNumber: r.payrollNumber });
        this.showDianResult.set(true);
        if (d?.dian?.success) {
          this.notify.success(`Nómina ${d?.dian?.payrollNumber} enviada — ZipKey: ${d?.dian?.zipKey ?? '?'}`);
        } else if (d?.dian?.errors?.length) {
          this.notify.error(`DIAN: ${d?.dian?.errors[0]}`);
        } else {
          this.notify.success('Nómina transmitida');
        }
        this.loadRecords();
      },
      error: e => { this.transmitting.set(false); this.notify.error(e?.error?.message ?? 'Error al transmitir'); },
    });
  }

  checkStatus(r: PayrollRecord) {
    this.transmitting.set(true);
    this.http.post<any>(`${this.api}/records/${r.id}/check-status`, {}).subscribe({
      next: res => {
        this.transmitting.set(false);
        const dian = (res?.data ?? res)?.dian;
        if (dian?.isValid) {
          this.notify.success(`DIAN aceptó la nómina ${r.payrollNumber} (código ${dian.statusCode})`);
        } else if (dian?.errors?.length) {
          const firstErr = dian.errors[0];
          this.notify.error(`DIAN (${dian.statusCode}): ${firstErr}`);
        } else if (dian?.statusCode) {
          this.notify.error(`DIAN: ${dian.statusDesc ?? dian.statusMsg ?? 'Error ' + dian.statusCode}`);
        } else {
          this.notify.info?.('Estado DIAN actualizado');
        }
        this.loadRecords();
      },
      error: e => { this.transmitting.set(false); this.notify.error(e?.error?.message ?? 'Error consultando DIAN'); },
    });
  }

  // ── Descarga XML / ZIP ───────────────────────────────────────────────────

  downloadPayrollFile(r: PayrollRecord, type: 'xml' | 'zip') {
    this.downloading.set(true);
    this.http.get<any>(`${this.api}/records/${r.id}/download`).subscribe({
      next: (res) => {
        this.downloading.set(false);
        const data = res?.data ?? res;
        const file = type === 'xml' ? data.xml : data.zip;
        if (!file?.base64) {
          this.notify.error('El archivo no está disponible. Transmite primero la nómina a la DIAN.');
          return;
        }
        // Convertir base64 → Blob y disparar descarga
        const byteChars  = atob(file.base64);
        const byteArrays = [];
        for (let i = 0; i < byteChars.length; i += 512) {
          const slice = byteChars.slice(i, i + 512);
          byteArrays.push(new Uint8Array(slice.split('').map(c => c.charCodeAt(0))));
        }
        const blob = new Blob(byteArrays, { type: file.contentType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: (e) => {
        this.downloading.set(false);
        this.notify.error(e?.error?.message ?? 'Error al descargar el archivo');
      },
    });
  }

  async confirmVoid(r: PayrollRecord) {
    const reason = await this.dialog.prompt({
      title: 'Anular nómina',
      message: `${r.employees.firstName} ${r.employees.lastName} — Período: ${r.period}`,
      inputLabel: 'Motivo de anulación *', placeholder: 'Escribe el motivo para continuar…',
      confirmLabel: 'Anular', cancelLabel: 'Cancelar', danger: true, icon: 'cancel',
    });
    if (!reason) return;
    this.http.patch<any>(`${this.api}/records/${r.id}/void`, { reason }).subscribe({
      next: () => { this.notify.success('Nómina anulada'); this.loadRecords(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error al anular'),
    });
  }

  // ── Employees ────────────────────────────────────────────────────────────

  loadEmployees() {
    this.loadingEmployees.set(true);
    const params: any = {};
    if (this.empSearch) params.search = this.empSearch;
    if (this.empActive() !== undefined) params.active = this.empActive();
    if (this.empBranchFilter()) params.branchId = this.empBranchFilter();
    this.http.get<any>(`${this.api}/employees`, { params }).subscribe({
      next: r => { const res = r.data ?? r; this.employees.set(res.data ?? res); this.loadingEmployees.set(false); },
      error: () => { this.loadingEmployees.set(false); this.notify.error('Error al cargar empleados'); },
    });
  }

  loadBranches() {
    this.http.get<any>(`${environment.apiUrl}/branches`).subscribe({
      next: res => {
        const data = res.data ?? res;
        this.branches.set((data ?? []).filter((branch: Branch) => branch.isActive));
      },
      error: () => this.notify.error('Error al cargar sucursales'),
    });
  }

  private empSearchTimer: any;
  onEmpSearch() { clearTimeout(this.empSearchTimer); this.empSearchTimer = setTimeout(() => this.loadEmployees(), 350); }

  openEmployeeModal(emp?: Employee) {
    this.loadBanks();
    this.loadBranches();
    if (emp) {
      this.editEmployeeId.set(emp.id);
      this.empForm = {
        branchId: emp.branchId ?? '',
        firstName: emp.firstName, lastName: emp.lastName,
        documentType: emp.documentType, documentNumber: emp.documentNumber,
        position: emp.position, contractType: emp.contractType,
        baseSalary: emp.baseSalary, hireDate: emp.hireDate?.split('T')[0] ?? '',
        email: emp.email ?? '', phone: emp.phone ?? '',
        cityCode: emp.cityCode ?? '', departmentCode: emp.departmentCode ?? '', country: emp.country ?? 'CO',
        bankCode: emp.bankCode ?? '', bankName: emp.bankName ?? '', bankAccount: emp.bankAccount ?? '',
      };
      if (emp.departmentCode) this.loadMunicipalitiesByDept(emp.departmentCode);
      this.muniSearchText.set(emp.city ?? '');
    } else {
      this.editEmployeeId.set(null);
      this.empForm = this.emptyEmpForm();
    }
    this.showEmployeeModal.set(true);
  }

  private loadCountries() {
    this.http.get<GeoCountry[]>(`${this.GEO_API}/countries`).subscribe({
      next: data => this.countries.set(data), error: () => {},
    });
  }

  private loadDepartments(countryCode = 'CO') {
    this.http.get<Department[]>(`${this.GEO_API}/departments`, { params: { countryCode } }).subscribe({
      next: data => this.departments.set(data), error: () => {},
    });
  }

  private loadMunicipalitiesByDept(departmentCode: string) {
    this.loadingMunis.set(true);
    this.http.get<Municipality[]>(`${this.GEO_API}/departments/${departmentCode}/municipalities`).subscribe({
      next: data => { this.municipalities.set(data); this.loadingMunis.set(false); },
      error: () => this.loadingMunis.set(false),
    });
  }

  onCountryChange(code: string) {
    this.empForm.departmentCode = '';
    this.empForm.cityCode       = '';
    this.muniSearchText.set('');
    this.municipalities.set([]);
    if (code) this.loadDepartments(code);
  }

  onDepartmentChange(deptCode: string) {
    this.empForm.cityCode = '';
    this.muniSearchText.set('');
    if (deptCode) this.loadMunicipalitiesByDept(deptCode);
  }

  onMuniSearch(q: string) {
    this.muniSearchText.set(q);
    this.muniDropdownOpen.set(true);
    this.muniSearch$.next({ q, dept: this.empForm.departmentCode });
  }

  selectMunicipality(m: Municipality) {
    this.empForm.cityCode       = m.code;
    this.empForm.departmentCode = m.departmentCode;
    this.muniSearchText.set(m.name);
    this.muniDropdownOpen.set(false);
  }

  loadBanks() {
    if (this.banks().length > 0) return;
    this.http.get<any>(`${environment.apiUrl}/banks`).subscribe({
      next: res => this.banks.set(res.data ?? res),
      error: () => this.notify.error('Error al cargar el catálogo de bancos'),
    });
  }

  onBankChange() {
    const bank = this.banks().find(b => b.code === this.empForm.bankCode);
    this.empForm.bankName = bank ? bank.name : '';
  }
  closeEmployeeModal() { this.showEmployeeModal.set(false); }

  saveEmployee() {
    if (!this.empForm.firstName || !this.empForm.documentNumber || !this.empForm.position || !this.empForm.hireDate) {
      this.notify.error('Completa los campos obligatorios (nombre, documento, cargo, fecha de ingreso)'); return;
    }
    this.saving.set(true);
    const body = { ...this.empForm, branchId: this.empForm.branchId || undefined };
    const req = this.editEmployeeId()
      ? this.http.put<any>(`${this.api}/employees/${this.editEmployeeId()}`, body)
      : this.http.post<any>(`${this.api}/employees`, body);
    req.subscribe({
      next: () => { this.saving.set(false); this.closeEmployeeModal(); this.notify.success(this.editEmployeeId() ? 'Empleado actualizado' : 'Empleado creado'); this.loadEmployees(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() { /* Escape no cierra modales — solo el botón X */ }

  async deactivateEmployee(e: Employee) {
    const ok = await this.dialog.confirm({
      title: '¿Desactivar empleado?', message: `${e.firstName} ${e.lastName}`,
      detail: 'El empleado no podrá incluirse en nuevas liquidaciones.',
      confirmLabel: 'Desactivar', danger: true, icon: 'person_off',
    });
    if (!ok) return;
    this.http.patch<any>(`${this.api}/employees/${e.id}/deactivate`, {}).subscribe({
      next: () => { this.notify.success('Empleado desactivado'); this.loadEmployees(); },
      error: err => this.notify.error(err?.error?.message ?? 'Error'),
    });
  }

  // ── Nota de Ajuste ───────────────────────────────────────────────────────

  openAjusteModal(r: PayrollRecord, tipo: 'Reemplazar' | 'Eliminar') {
    // Bloqueamos la apertura si el período está anulado
    if (r.isAnulado) {
      this.notify.error('Este período ya fue anulado. No se pueden crear más ajustes.');
      return;
    }
    this.ajusteSource.set(r);
    this.ajusteType.set(tipo);
    // Pre-rellenar con los datos del documento (el backend resolverá el predecesor real)
    this.ajusteForm = {
      tipoAjuste:         tipo,
      payDate:            r.payDate ? String(r.payDate).slice(0, 10) : new Date().toISOString().split('T')[0],
      baseSalary:         r.baseSalary,
      daysWorked:         r.daysWorked,
      overtimeHours:      r.overtimeHours       ?? 0,
      bonuses:            r.bonuses             ?? 0,
      commissions:        r.commissions         ?? 0,
      transportAllowance: r.transportAllowance  ?? null,
      vacationPay:        r.vacationPay         ?? 0,
      sickLeave:          r.sickLeave           ?? 0,
      loans:              r.loans               ?? 0,
      otherDeductions:    r.otherDeductions     ?? 0,
      notes: tipo === 'Eliminar'
        ? `Eliminación por error del documento ${r.payrollNumber}`
        : `Corrección del documento ${r.payrollNumber ?? r.payrollNumberRef ?? ''}`,
    };
    this.showAjusteModal.set(true);
  }

  closeAjusteModal() {
    this.showAjusteModal.set(false);
    this.ajusteSource.set(null);
  }

  submitAjuste() {
    const original = this.ajusteSource();
    if (!original) return;
    this.submittingAjuste.set(true);
    this.http.post<any>(`${this.api}/records/${original.id}/nota-ajuste`, this.ajusteForm).subscribe({
      next: (res) => {
        this.submittingAjuste.set(false);
        this.closeAjusteModal();
        this.showRecordDetail.set(false);
        const tipo = this.ajusteForm.tipoAjuste;
        const num  = res?.nota?.payrollNumber ?? '';
        this.notify.success(`Nota de Ajuste ${tipo} creada: ${num}. Revisa y transmite a la DIAN.`);
        this.loadRecords();
      },
      error: (e) => {
        this.submittingAjuste.set(false);
        this.notify.error(e?.error?.message ?? 'Error al crear la Nota de Ajuste');
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  parseDianErrors(raw?: string): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return [raw]; }
  }

  statusClass(s: string) {
    return { 'badge--draft': s==='DRAFT', 'badge--submit': s==='SUBMITTED',
             'badge--accept': s==='ACCEPTED', 'badge--reject': s==='REJECTED', 'badge--void': s==='VOIDED' };
  }
  statusLabel(s: string) {
    const m: Record<string,string> = { DRAFT:'Borrador', SUBMITTED:'Transmitida', ACCEPTED:'Aceptada', REJECTED:'Rechazada', VOIDED:'Anulada' };
    return m[s] ?? s;
  }

  payrollTypeLabel(r: PayrollRecord): string {
    if (r.payrollType === 'NOMINA_AJUSTE') {
      return r.tipoAjuste === 'Eliminar' ? 'NIAE — Eliminar' : 'NIAE — Reemplazar';
    }
    return 'NIE';
  }
  contractLabel(t: string) {
    const m: Record<string,string> = { INDEFINITE:'Indefinido', FIXED:'Término fijo', PROJECT:'Obra/labor', APPRENTICE:'Aprendizaje' };
    return m[t] ?? t;
  }
  private hasRole(r: string) { return (this.auth.user()?.roles ?? []).includes(r); }

  private emptyPayrollForm() {
    return {
      employeeId: '', period: new Date().toISOString().slice(0,7),
      payDate: new Date().toISOString().split('T')[0],
      baseSalary: 0, daysWorked: 30, overtimeHours: 0, bonuses: 0, commissions: 0,
      transportAllowance: null, vacationPay: 0, sickLeave: 0, loans: 0, otherDeductions: 0, notes: '',
    };
  }
  private emptyEmpForm() {
    return {
      branchId: '',
      firstName: '', lastName: '', documentType: 'CC', documentNumber: '',
      position: '', contractType: 'INDEFINITE', baseSalary: 1_300_000,
      hireDate: '', email: '', phone: '',
      cityCode: '', departmentCode: '', country: 'CO',
      bankCode: '', bankName: '', bankAccount: '',
    };
  }

  private emptyAjusteForm() {
    return {
      tipoAjuste: 'Reemplazar' as 'Reemplazar' | 'Eliminar',
      payDate: new Date().toISOString().split('T')[0],
      baseSalary: 0, daysWorked: 30, overtimeHours: 0,
      bonuses: 0, commissions: 0, transportAllowance: null,
      vacationPay: 0, sickLeave: 0, loans: 0, otherDeductions: 0,
      notes: '',
    };
  }
}
