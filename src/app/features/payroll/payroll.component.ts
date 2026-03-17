import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.component';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface Employee {
  id: string;
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
  isActive: boolean;
}

interface PayrollRecord {
  id: string;
  period: string;
  payDate: string;
  status: string;
  cune?: string;
  payrollNumber?: string;
  payrollType?:   string;
  cuneHash?:      string;
  dianZipKey?:    string;
  dianStatusCode?: string;
  dianStatusMsg?:  string;
  dianErrors?:     string;
  dianAttempts?:   number;
  xmlSigned?:      string;   // XML firmado guardado tras transmisión DIAN
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
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Nómina Electrónica</h1>
          <p class="page-header__sub">Liquidación y transmisión DIAN de nómina electrónica</p>
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

      <!-- ── Tabs ────────────────────────────────────────────────────────── -->
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

      <!-- ══ TAB: RECORDS ══════════════════════════════════════════════════ -->
      @if (activeTab() === 'records') {

        <!-- Filters + View Toggle -->
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
                        @if (r.payrollNumber) { <div class="dian-num">{{ r.payrollNumber }}</div> }
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
                          @if (canSubmit() && r.status === 'SUBMITTED' && r.dianZipKey) {
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
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
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
                <div class="record-card" [class.record-card--voided]="r.status==='VOIDED'">
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
                  @if (r.payrollNumber || r.dianStatusCode) {
                    <div class="rc-dian">
                      @if (r.payrollNumber) { <span class="dian-num">{{ r.payrollNumber }}</span> }
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
                    @if (canSubmit() && r.status === 'SUBMITTED' && r.dianZipKey) {
                      <button class="btn-icon" title="Consultar DIAN" [disabled]="transmitting()" (click)="checkStatus(r)">
                        <span class="material-symbols-outlined">refresh</span>
                      </button>
                    }
                    @if (canVoid() && r.status !== 'VOIDED' && r.status !== 'ACCEPTED') {
                      <button class="btn-icon btn-icon--danger" title="Anular" (click)="confirmVoid(r)">
                        <span class="material-symbols-outlined">cancel</span>
                      </button>
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
        <div class="filters-bar">
          <div class="search-wrap">
            <span class="material-symbols-outlined search-icon">search</span>
            <input type="text" class="search-input" placeholder="Buscar por nombre, documento o cargo…"
                   [(ngModel)]="empSearch" (ngModelChange)="onEmpSearch()" />
          </div>
          <div class="filters-bar__controls">
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

        <!-- ── TABLE VIEW ───────────────────────────────────────────────── -->
        @if (empView() === 'table') {
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
      <div class="modal-overlay">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Liquidación — {{ selectedRecord()?.employees?.firstName }} {{ selectedRecord()?.employees?.lastName }} · {{ selectedRecord()?.period }}</h3>
            <button class="modal-close" (click)="showRecordDetail.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          @if (selectedRecord(); as r) {
            <div class="modal-body">
              <div class="det-cols">
                <div class="det-section">
                  <div class="det-title">Devengados</div>
                  <div class="det-row"><span>Salario base ({{ r.daysWorked }}d)</span><span>{{ r.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.transportAllowance > 0) { <div class="det-row"><span>Aux. transporte</span><span>{{ r.transportAllowance | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.overtimeHours > 0)      { <div class="det-row"><span>Horas extra ({{ r.overtimeHours }}h)</span><span>—</span></div> }
                  @if (+r.bonuses > 0)            { <div class="det-row"><span>Bonificaciones</span><span>{{ r.bonuses | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.commissions > 0)        { <div class="det-row"><span>Comisiones</span><span>{{ r.commissions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.vacationPay > 0)        { <div class="det-row"><span>Vacaciones</span><span>{{ r.vacationPay | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="det-row det-total"><span>Total devengado</span><span>{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                <div class="det-section">
                  <div class="det-title">Deducciones empleado</div>
                  <div class="det-row"><span>Salud (4%)</span><span>{{ r.healthEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="det-row"><span>Pensión (4%)</span><span>{{ r.pensionEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.sickLeave > 0)       { <div class="det-row"><span>Incapacidades</span><span>{{ r.sickLeave | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.loans > 0)           { <div class="det-row"><span>Préstamos</span><span>{{ r.loans | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.otherDeductions > 0) { <div class="det-row"><span>Otros descuentos</span><span>{{ r.otherDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="det-row det-total text-danger"><span>Total deducciones</span><span>{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                <div class="det-section">
                  <div class="det-title">Aportes empleador</div>
                  <div class="det-row"><span>Salud (8.5%)</span><span>{{ r.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="det-row"><span>Pensión (12%)</span><span>{{ r.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="det-row"><span>ARL (0.522%)</span><span>{{ r.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="det-row"><span>Caja comp. (4%)</span><span>{{ r.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>
              <div class="det-footer">
                <div class="det-neto"><span>Neto a pagar</span><strong>{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</strong></div>
                <div class="det-costo"><span>Costo empresa</span><strong>{{ r.totalEmployerCost | currency:'COP':'symbol':'1.0-0' }}</strong></div>
              </div>
              @if (r.payrollNumber || r.cuneHash || r.dianZipKey) {
                <div class="det-dian">
                  <div class="det-dian__title"><span class="material-symbols-outlined">verified</span>Información DIAN</div>
                  @if (r.payrollNumber) { <div><strong>N° Nómina:</strong> <code>{{ r.payrollNumber }}</code></div> }
                  @if (r.cuneHash)      { <div style="word-break:break-all"><strong>CUNE:</strong> <code style="font-size:10px">{{ r.cuneHash }}</code></div> }
                  @if (r.dianZipKey)    { <div><strong>ZipKey:</strong> <code>{{ r.dianZipKey }}</code></div> }
                  @if (r.dianStatusCode) {
                    <div><strong>Estado DIAN:</strong>
                      <span class="dian-st" style="margin-left:6px"
                            [class.dian-ok]="r.dianStatusCode==='00'" [class.dian-err]="r.dianStatusCode==='99'">
                        {{ r.dianStatusCode === '00' ? '✓ Aceptada' : r.dianStatusCode === '99' ? '✗ Rechazada' : 'Cód ' + r.dianStatusCode }}
                      </span>
                    </div>
                  }
                  @if (r.dianAttempts) { <div style="font-size:11px;color:#94a3b8">Intentos de envío: {{ r.dianAttempts }}</div> }

                  <!-- Descarga XML / ZIP — solo si la nómina fue transmitida -->
                  @if (r.status === 'SUBMITTED' || r.status === 'ACCEPTED' || r.status === 'REJECTED') {
                    <div class="det-dian__downloads">
                      <div class="det-dian__dl-label">
                        <span class="material-symbols-outlined">download</span>
                        Archivos del documento
                      </div>
                      <div class="det-dian__dl-buttons">
                        <button class="btn btn--sm btn--dl-xml"
                                [disabled]="downloading()"
                                (click)="downloadPayrollFile(r, 'xml')"
                                title="Descargar XML firmado">
                          <span class="material-symbols-outlined">code</span>
                          {{ downloading() ? 'Descargando…' : 'Descargar XML' }}
                        </button>
                        <button class="btn btn--sm btn--dl-zip"
                                [disabled]="downloading()"
                                (click)="downloadPayrollFile(r, 'zip')"
                                title="Descargar ZIP para DIAN">
                          <span class="material-symbols-outlined">folder_zip</span>
                          {{ downloading() ? 'Descargando…' : 'Descargar ZIP' }}
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="showRecordDetail.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
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
              <div class="form-group"><label class="form-label">Correo electrónico</label><input type="email" class="form-control" [(ngModel)]="empForm.email" /></div>
              <div class="form-group"><label class="form-label">Teléfono</label><input type="text" class="form-control" [(ngModel)]="empForm.phone" /></div>
            </div>
            <div class="form-row-2">
              <div class="form-group"><label class="form-label">Ciudad</label><input type="text" class="form-control" [(ngModel)]="empForm.city" /></div>
              <div class="form-group"><label class="form-label">Banco</label><input type="text" class="form-control" [(ngModel)]="empForm.bankName" placeholder="Bancolombia, Davivienda…" /></div>
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
    .py { max-width:1280px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-header__title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-header__sub   { font-size:13px; color:#64748b; margin:0; }
    .page-header__actions { display:flex; gap:8px; flex-shrink:0; }

    /* ── Tabs ─────────────────────────────────────────────────────────────── */
    .py__tabs { display:flex; gap:4px; margin-bottom:18px; border-bottom:2px solid #f0f4f8; overflow-x:auto; }
    .py__tab  { display:flex; align-items:center; gap:6px; padding:10px 18px; border:none; background:transparent;
                font-size:13.5px; font-weight:600; color:#64748b; cursor:pointer; white-space:nowrap;
                border-bottom:2px solid transparent; margin-bottom:-2px; transition:all .15s; border-radius:6px 6px 0 0; }
    .py__tab .material-symbols-outlined { font-size:18px; }
    .py__tab:hover { color:#1a407e; background:#f8fafc; }
    .py__tab--active { color:#1a407e; border-bottom-color:#1a407e; }

    /* ── Filters bar ─────────────────────────────────────────────────────── */
    .filters-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap;
                   background:#fff; border:1px solid #dce6f0; border-radius:12px;
                   padding:12px 16px; margin-bottom:14px; }
    .filters-bar__controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .search-wrap  { flex:1; position:relative; min-width:180px; max-width:280px; }
    .search-icon  { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94a3b8; pointer-events:none; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px;
                    font-size:13.5px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-group-inline { display:flex; align-items:center; gap:6px; }
    .form-label-sm { font-size:12px; font-weight:600; color:#64748b; white-space:nowrap; }
    .filter-select { padding:7px 10px; border:1px solid #dce6f0; border-radius:8px; font-size:13px; outline:none; background:#fff; color:#374151; }

    /* ── View toggle ─────────────────────────────────────────────────────── */
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:8px; overflow:hidden; margin-left:auto; flex-shrink:0; }
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
    .py__resumen { display:flex; background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-bottom:16px; flex-wrap:wrap; }
    .py__res-item { flex:1; min-width:120px; padding:14px 16px; border-right:1px solid #f0f4f8; }
    .py__res-item:last-child { border-right:none; }
    .py__res-label  { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; font-weight:600; display:block; }
    .py__res-val    { font-family:'Sora',sans-serif; font-size:15px; font-weight:800; color:#0c1c35; margin-top:4px; display:block; }
    .py__res-val--hl { color:#1a407e; }

    /* ── Table card ──────────────────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-bottom:12px; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#94a3b8;
                     text-transform:uppercase; letter-spacing:.05em; background:#f8fafc; border-bottom:1px solid #f0f4f8; white-space:nowrap; }
    .data-table td { padding:12px 14px; font-size:13px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
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
    .btn-icon { background:none; border:none; padding:6px; border-radius:7px; cursor:pointer;
                color:#94a3b8; transition:all .14s; display:flex; align-items:center; }
    .btn-icon .material-symbols-outlined { font-size:18px; }
    .btn-icon:hover          { background:#f0f4f9; color:#1a407e; }
    .btn-icon:disabled       { opacity:.4; cursor:default; }
    .btn-icon--primary:hover { background:#e8eef8; color:#1a407e; }
    .btn-icon--danger:hover  { background:#fee2e2; color:#dc2626; }

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
    .record-card { background:#fff; border:1px solid #dce6f0; border-radius:14px;
                   padding:18px 16px 14px; position:relative; display:flex; flex-direction:column;
                   transition:box-shadow .18s, transform .18s; }
    .record-card:hover     { box-shadow:0 4px 20px rgba(26,64,126,.1); transform:translateY(-2px); }
    .record-card--voided   { opacity:.65; border-color:#fde8c7; background:#fffbf5; }
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
    .employee-card { background:#fff; border:1px solid #dce6f0; border-radius:14px;
                     padding:18px 16px 14px; position:relative; display:flex; flex-direction:column;
                     transition:box-shadow .18s, transform .18s; }
    .employee-card:hover  { box-shadow:0 4px 20px rgba(26,64,126,.1); transform:translateY(-2px); }
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

    /* Detail modal content */
    .det-cols   { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
    .det-title  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
                  color:#94a3b8; padding-bottom:6px; border-bottom:1px solid #f0f4f8; margin-bottom:8px; }
    .det-row    { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f8fafc; font-size:12.5px; color:#374151; }
    .det-total  { font-weight:700; border-top:1px solid #e8eef8; border-bottom:none; margin-top:4px; padding-top:6px; }
    .det-footer { display:flex; gap:16px; margin-top:16px; padding-top:16px; border-top:2px solid #f0f4f8; }
    .det-neto, .det-costo { flex:1; background:#f8fafc; border-radius:10px; padding:12px 14px; }
    .det-neto span, .det-costo span { display:block; font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
    .det-neto strong  { font-family:'Sora',sans-serif; font-size:18px; font-weight:800; color:#0c1c35; }
    .det-costo strong { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#64748b; }
    .det-dian { background:#f0f6ff; border:1px solid #c7dbf7; border-radius:10px; padding:14px;
                margin-top:16px; font-size:12.5px; color:#374151; display:flex; flex-direction:column; gap:6px; }
    .det-dian__title { display:flex; align-items:center; gap:6px; font-weight:700; color:#1a407e; font-size:13px; }
    .det-dian__title .material-symbols-outlined { font-size:18px; }
    /* Descarga */
    .det-dian__downloads { margin-top:10px; padding-top:10px; border-top:1px solid #c7dbf7; }
    .det-dian__dl-label  { display:flex; align-items:center; gap:5px; font-size:11.5px; font-weight:700;
                           color:#1a407e; text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px; }
    .det-dian__dl-label .material-symbols-outlined { font-size:15px; }
    .det-dian__dl-buttons { display:flex; gap:8px; flex-wrap:wrap; }
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
    .dian-errors { background:#fff8f8; border:1px solid #fecaca; border-radius:8px; padding:12px; margin-bottom:12px; }
    .dian-errors__title { display:flex; align-items:center; gap:6px; font-weight:700; color:#991b1b; font-size:13px; margin-bottom:8px; }
    .dian-errors__item  { font-size:12.5px; color:#7f1d1d; padding:4px 0; border-bottom:1px solid #fee2e2; }
    .dian-errors__item:last-child { border-bottom:none; }
    .dian-hint  { display:flex; align-items:flex-start; gap:8px; background:#eff6ff; border-radius:8px;
                  padding:10px 12px; font-size:12.5px; color:#1e40af; }
    .dian-hint .material-symbols-outlined { font-size:18px; flex-shrink:0; margin-top:1px; }

    /* ══ RESPONSIVE ═══════════════════════════════════════════════════════ */
    @media (max-width: 900px) {
      .py__resumen { flex-wrap:wrap; }
      .py__res-item { flex:1 1 45%; }
      .det-cols { grid-template-columns:1fr 1fr; }
      .det-footer { flex-direction:column; }
      .py__form-grid { grid-template-columns:1fr; }
      .py__preview { order:-1; position:static; }
      .record-grid   { grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); }
      .employee-grid { grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); }
      .dian-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header__actions { justify-content:flex-end; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .filters-bar__controls { flex:1 1 100%; }
      .view-toggle { margin-left:0; }
    }

    @media (max-width: 640px) {
      .py__resumen { flex-direction:column; }
      .py__res-item { border-right:none; border-bottom:1px solid #f0f4f8; }
      .py__res-item:last-child { border-bottom:none; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:620px; }
      .det-cols { grid-template-columns:1fr; }
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
  showDianResult    = signal(false);
  dianResult        = signal<any | null>(null);
  preview           = signal<any | null>(null);
  showRecordDetail  = signal(false);
  selectedRecord    = signal<PayrollRecord | null>(null);
  showPayrollModal  = signal(false);
  showEmployeeModal = signal(false);
  editEmployeeId    = signal<string | null>(null);

  canCreatePayroll      = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER') || this.hasRole('OPERATOR'));
  canSubmit             = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canVoid               = computed(() => this.hasRole('ADMIN'));
  canManageEmployees    = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canDeactivateEmployee = computed(() => this.hasRole('ADMIN'));
  activeEmployees       = computed(() => this.employees().filter(e => e.isActive));

  payrollForm: any = this.emptyPayrollForm();
  empForm: any     = this.emptyEmpForm();

  ngOnInit() { this.loadRecords(); this.loadEmployees(); }

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
        if (dian?.isValid)      { this.notify.success(`DIAN aceptó la nómina ${r.payrollNumber} (código ${dian.statusCode})`); }
        else if (dian?.statusCode) { this.notify.error(`DIAN: ${dian.statusDesc ?? dian.statusMsg ?? 'Error ' + dian.statusCode}`); }
        else                    { this.notify.info?.('Estado DIAN actualizado'); }
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
    this.http.get<any>(`${this.api}/employees`, { params }).subscribe({
      next: r => { const res = r.data ?? r; this.employees.set(res.data ?? res); this.loadingEmployees.set(false); },
      error: () => { this.loadingEmployees.set(false); this.notify.error('Error al cargar empleados'); },
    });
  }

  private empSearchTimer: any;
  onEmpSearch() { clearTimeout(this.empSearchTimer); this.empSearchTimer = setTimeout(() => this.loadEmployees(), 350); }

  openEmployeeModal(emp?: Employee) {
    if (emp) {
      this.editEmployeeId.set(emp.id);
      this.empForm = {
        firstName: emp.firstName, lastName: emp.lastName,
        documentType: emp.documentType, documentNumber: emp.documentNumber,
        position: emp.position, contractType: emp.contractType,
        baseSalary: emp.baseSalary, hireDate: emp.hireDate?.split('T')[0] ?? '',
        email: emp.email ?? '', phone: emp.phone ?? '', city: emp.city ?? '',
        bankName: '', bankAccount: '',
      };
    } else {
      this.editEmployeeId.set(null);
      this.empForm = this.emptyEmpForm();
    }
    this.showEmployeeModal.set(true);
  }
  closeEmployeeModal() { this.showEmployeeModal.set(false); }

  saveEmployee() {
    if (!this.empForm.firstName || !this.empForm.documentNumber || !this.empForm.position) {
      this.notify.error('Completa los campos obligatorios'); return;
    }
    this.saving.set(true);
    const req = this.editEmployeeId()
      ? this.http.put<any>(`${this.api}/employees/${this.editEmployeeId()}`, this.empForm)
      : this.http.post<any>(`${this.api}/employees`, this.empForm);
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

  // ── Helpers ──────────────────────────────────────────────────────────────

  statusClass(s: string) {
    return { 'badge--draft': s==='DRAFT', 'badge--submit': s==='SUBMITTED',
             'badge--accept': s==='ACCEPTED', 'badge--reject': s==='REJECTED', 'badge--void': s==='VOIDED' };
  }
  statusLabel(s: string) {
    const m: Record<string,string> = { DRAFT:'Borrador', SUBMITTED:'Transmitida', ACCEPTED:'Aceptada', REJECTED:'Rechazada', VOIDED:'Anulada' };
    return m[s] ?? s;
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
      firstName: '', lastName: '', documentType: 'CC', documentNumber: '',
      position: '', contractType: 'INDEFINITE', baseSalary: 1_300_000,
      hireDate: '', email: '', phone: '', city: '', bankName: '', bankAccount: '',
    };
  }
}