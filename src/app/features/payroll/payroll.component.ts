import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';

// ── Interfaces matching backend English field names ──────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  position: string;          // was "cargo"
  baseSalary: number;        // was "salarioBase"
  contractType: string;      // was "tipoContrato"
  hireDate: string;          // was "fechaIngreso"
  email?: string;
  phone?: string;
  city?: string;             // was "ciudad"
  isActive: boolean;
}

interface PayrollRecord {
  id: string;
  period: string;             // was "periodo"
  payDate: string;            // was "fechaPago"
  status: string;
  cune?: string;
  baseSalary: number;
  daysWorked: number;         // was "diasTrabajados"
  overtimeHours: number;      // was "horasExtras"
  bonuses: number;            // was "bonificaciones"
  commissions: number;        // was "comisiones"
  transportAllowance: number; // was "auxTransporte"
  vacationPay: number;        // was "vacaciones"
  healthEmployee: number;     // was "saludEmpleado"
  pensionEmployee: number;    // was "pensionEmpleado"
  sickLeave: number;          // was "incapacidades"
  loans: number;              // was "prestamos"
  otherDeductions: number;    // was "otrosDescuentos"
  healthEmployer: number;     // was "saludEmpleador"
  pensionEmployer: number;    // was "pensionEmpleador"
  arl: number;
  compensationFund: number;   // was "cajaCompensacion"
  totalEarnings: number;      // was "totalDevengado"
  totalDeductions: number;    // was "totalDeducciones"
  netPay: number;             // was "netoAPagar"
  totalEmployerCost: number;  // was "costoEmpresa"
  notes?: string;
  employee: Pick<Employee,'id'|'firstName'|'lastName'|'documentNumber'|'position'>;
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

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    <div class="py">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-header__title">Nómina Electrónica</h1>
          <p class="page-header__sub">Liquidación y transmisión DIAN de nómina electrónica</p>
        </div>
        <div class="page-header__actions">
          @if (activeTab() === 'records' && canCreatePayroll()) {
            <button class="btn btn--primary btn--sm" (click)="openPayrollModal()">
              <span class="material-symbols-outlined">add</span>
              Nueva liquidación
            </button>
          }
          @if (activeTab() === 'employees' && canManageEmployees()) {
            <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">
              <span class="material-symbols-outlined">person_add</span>
              Nuevo empleado
            </button>
          }
        </div>
      </div>

      <!-- Tabs -->
      <div class="py__tabs">
        <button class="py__tab" [class.py__tab--active]="activeTab()==='records'"
                (click)="activeTab.set('records')">
          <span class="material-symbols-outlined">receipt_long</span>
          Liquidaciones
        </button>
        <button class="py__tab" [class.py__tab--active]="activeTab()==='employees'"
                (click)="activeTab.set('employees'); loadEmployees()">
          <span class="material-symbols-outlined">groups</span>
          Empleados
        </button>
      </div>

      <!-- ══ TAB: PAYROLL RECORDS ══ -->
      @if (activeTab() === 'records') {

        <div class="py__filters card card--sm card--flat">
          <div class="search-box" style="flex:1;max-width:260px">
            <span class="search-box__icon material-symbols-outlined">search</span>
            <input type="text" class="search-box__input" placeholder="Buscar empleado…"
                   [(ngModel)]="recordSearch" (ngModelChange)="onRecordSearch()" />
          </div>
          <div class="form-group-inline">
            <label class="form-label-sm">Período</label>
            <input type="month" class="form-control form-control--sm"
                   [(ngModel)]="periodFilter" (ngModelChange)="loadRecords()" />
          </div>
          <div class="form-group-inline">
            <label class="form-label-sm">Estado</label>
            <select class="form-control form-control--sm" [(ngModel)]="statusFilter" (ngModelChange)="loadRecords()">
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="SUBMITTED">Transmitida</option>
              <option value="ACCEPTED">Aceptada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="VOIDED">Anulada</option>
            </select>
          </div>
        </div>

        <!-- Period summary -->
        @if (periodFilter && summary()) {
          <div class="py__resumen">
            <div class="py__res-item">
              <span class="py__res-label">Empleados liquidados</span>
              <span class="py__res-val">{{ summary()!.totalEmployees }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Total devengado</span>
              <span class="py__res-val">{{ summary()!.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Total neto a pagar</span>
              <span class="py__res-val py__res-val--highlight">{{ summary()!.totalNetPay | currency:'COP':'symbol':'1.0-0' }}</span>
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

        <div class="table-wrapper">
          <div class="table-scroll">
            @if (loadingRecords()) {
              <div class="py__loading"><div class="spinner"></div></div>
            } @else if (records().length === 0) {
              <div class="py__empty">
                <span class="material-symbols-outlined">receipt_long</span>
                <p>No hay liquidaciones con los filtros seleccionados</p>
              </div>
            } @else {
              <table class="bf-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Período</th>
                    <th>Devengado</th>
                    <th>Deducciones</th>
                    <th>Neto a pagar</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of records(); track r.id) {
                    <tr>
                      <td>
                        <div class="py__emp-cell">
                          <div class="py__emp-avatar">{{ r.employee.firstName[0] }}{{ r.employee.lastName[0] }}</div>
                          <div>
                            <div class="py__emp-name">{{ r.employee.firstName }} {{ r.employee.lastName }}</div>
                            <div class="py__emp-pos">{{ r.employee.position }}</div>
                          </div>
                        </div>
                      </td>
                      <td><span class="py__period">{{ r.period }}</span></td>
                      <td class="td-currency">{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-currency text-danger">-{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-currency td-net">{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(r.status)">{{ statusLabel(r.status) }}</span></td>
                      <td>
                        <div class="py__row-actions">
                          <button class="btn-icon" title="Ver detalle" (click)="viewRecord(r)">
                            <span class="material-symbols-outlined">visibility</span>
                          </button>
                          @if (canSubmit() && r.status === 'DRAFT') {
                            <button class="btn-icon btn-icon--primary" title="Transmitir a DIAN"
                                    (click)="submitRecord(r)">
                              <span class="material-symbols-outlined">send</span>
                            </button>
                          }
                          @if (canVoid() && r.status !== 'VOIDED' && r.status !== 'ACCEPTED') {
                            <button class="btn-icon btn-icon--danger" title="Anular"
                                    (click)="confirmVoid(r)">
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
        </div>
      }

      <!-- ══ TAB: EMPLOYEES ══ -->
      @if (activeTab() === 'employees') {
        <div class="py__filters card card--sm card--flat">
          <div class="search-box" style="flex:1;max-width:300px">
            <span class="search-box__icon material-symbols-outlined">search</span>
            <input type="text" class="search-box__input" placeholder="Buscar por nombre, documento o cargo…"
                   [(ngModel)]="empSearch" (ngModelChange)="onEmpSearch()" />
          </div>
          <div class="ct__filter-chips">
            <button class="chip" [class.chip--active]="empActive()===undefined" (click)="empActive.set(undefined);loadEmployees()">Todos</button>
            <button class="chip" [class.chip--active]="empActive()===true"      (click)="empActive.set(true);loadEmployees()">Activos</button>
            <button class="chip" [class.chip--active]="empActive()===false"     (click)="empActive.set(false);loadEmployees()">Inactivos</button>
          </div>
        </div>

        <div class="table-wrapper">
          <div class="table-scroll">
            @if (loadingEmployees()) {
              <div class="py__loading"><div class="spinner"></div></div>
            } @else if (employees().length === 0) {
              <div class="py__empty">
                <span class="material-symbols-outlined">group_off</span>
                <p>No hay empleados registrados</p>
                @if (canManageEmployees()) {
                  <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">Agregar primer empleado</button>
                }
              </div>
            } @else {
              <table class="bf-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Documento</th>
                    <th>Cargo</th>
                    <th>Contrato</th>
                    <th>Salario base</th>
                    <th>Ingreso</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of employees(); track e.id) {
                    <tr [class.py__row--inactive]="!e.isActive">
                      <td>
                        <div class="py__emp-cell">
                          <div class="py__emp-avatar" [class.py__emp-avatar--inactive]="!e.isActive">
                            {{ e.firstName[0] }}{{ e.lastName[0] }}
                          </div>
                          <div>
                            <div class="py__emp-name">{{ e.firstName }} {{ e.lastName }}</div>
                            @if (e.email) { <div class="py__emp-pos">{{ e.email }}</div> }
                          </div>
                        </div>
                      </td>
                      <td><span class="py__doc">{{ e.documentType }} {{ e.documentNumber }}</span></td>
                      <td>{{ e.position }}</td>
                      <td><span class="badge badge--neutral">{{ contractLabel(e.contractType) }}</span></td>
                      <td class="td-currency">{{ e.baseSalary | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td class="td-date">{{ e.hireDate | date:'dd/MM/yyyy' }}</td>
                      <td>
                        <span class="badge" [class.badge--success]="e.isActive" [class.badge--muted]="!e.isActive">
                          {{ e.isActive ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td>
                        <div class="py__row-actions">
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
                            <button class="btn-icon btn-icon--danger" title="Desactivar"
                                    (click)="deactivateEmployee(e)">
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
        </div>
      }
    </div>

    <!-- ══ MODAL: RECORD DETAIL ══ -->
    @if (showRecordDetail()) {
      <div class="modal-overlay" (click)="showRecordDetail.set(false)">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Liquidación — {{ selectedRecord()?.employee?.firstName }} {{ selectedRecord()?.employee?.lastName }} · {{ selectedRecord()?.period }}</h3>
            <button class="modal-close" (click)="showRecordDetail.set(false)">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          @if (selectedRecord(); as r) {
            <div class="modal-body">
              <div class="py__det-cols">
                <div class="py__det-section">
                  <div class="py__det-title">Devengados</div>
                  <div class="py__det-row"><span>Salario base ({{ r.daysWorked }}d)</span><span>{{ r.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.transportAllowance > 0) { <div class="py__det-row"><span>Aux. transporte</span><span>{{ r.transportAllowance | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.overtimeHours > 0)      { <div class="py__det-row"><span>Horas extra ({{ r.overtimeHours }}h)</span><span>—</span></div> }
                  @if (+r.bonuses > 0)            { <div class="py__det-row"><span>Bonificaciones</span><span>{{ r.bonuses | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.commissions > 0)        { <div class="py__det-row"><span>Comisiones</span><span>{{ r.commissions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.vacationPay > 0)        { <div class="py__det-row"><span>Vacaciones</span><span>{{ r.vacationPay | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="py__det-row py__det-total"><span>Total devengado</span><span>{{ r.totalEarnings | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                <div class="py__det-section">
                  <div class="py__det-title">Deducciones empleado</div>
                  <div class="py__det-row"><span>Salud (4%)</span><span>{{ r.healthEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="py__det-row"><span>Pensión (4%)</span><span>{{ r.pensionEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  @if (+r.sickLeave > 0)         { <div class="py__det-row"><span>Incapacidades</span><span>{{ r.sickLeave | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.loans > 0)             { <div class="py__det-row"><span>Préstamos</span><span>{{ r.loans | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  @if (+r.otherDeductions > 0)   { <div class="py__det-row"><span>Otros descuentos</span><span>{{ r.otherDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div> }
                  <div class="py__det-row py__det-total text-danger"><span>Total deducciones</span><span>{{ r.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                <div class="py__det-section">
                  <div class="py__det-title">Aportes empleador</div>
                  <div class="py__det-row"><span>Salud (8.5%)</span><span>{{ r.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="py__det-row"><span>Pensión (12%)</span><span>{{ r.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="py__det-row"><span>ARL (0.522%)</span><span>{{ r.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="py__det-row"><span>Caja comp. (4%)</span><span>{{ r.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>
              <div class="py__det-footer">
                <div class="py__det-neto">
                  <span>Neto a pagar</span>
                  <strong>{{ r.netPay | currency:'COP':'symbol':'1.0-0' }}</strong>
                </div>
                <div class="py__det-costo">
                  <span>Costo empresa</span>
                  <strong>{{ r.totalEmployerCost | currency:'COP':'symbol':'1.0-0' }}</strong>
                </div>
              </div>
              @if (r.cune) {
                <div class="py__cune">
                  <span class="material-symbols-outlined">verified</span>
                  CUNE: <code>{{ r.cune }}</code>
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

    <!-- ══ MODAL: CREATE PAYROLL ══ -->
    @if (showPayrollModal()) {
      <div class="modal-overlay" (click)="closePayrollModal()">
        <div class="modal modal--lg" (click)="$event.stopPropagation()">
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
                  <select class="form-control" [(ngModel)]="payrollForm.employeeId"
                          (ngModelChange)="onEmployeeSelected()">
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

              <!-- Preview -->
              <div class="py__preview">
                <div class="py__preview-title">
                  <span class="material-symbols-outlined">calculate</span>
                  Vista previa del cálculo
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

    <!-- ══ MODAL: EMPLOYEE FORM ══ -->
    @if (showEmployeeModal()) {
      <div class="modal-overlay" (click)="closeEmployeeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editEmployeeId() ? 'Editar empleado' : 'Nuevo empleado' }}</h3>
            <button class="modal-close" (click)="closeEmployeeModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Nombres *</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.firstName" />
              </div>
              <div class="form-group">
                <label class="form-label">Apellidos *</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.lastName" />
              </div>
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
              <div class="form-group">
                <label class="form-label">N° Documento *</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.documentNumber" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Cargo *</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.position" placeholder="Ej: Contador, Vendedor…" />
              </div>
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
              <div class="form-group">
                <label class="form-label">Salario base *</label>
                <input type="number" class="form-control" [(ngModel)]="empForm.baseSalary" min="0" />
              </div>
              <div class="form-group">
                <label class="form-label">Fecha de ingreso *</label>
                <input type="date" class="form-control" [(ngModel)]="empForm.hireDate" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Correo electrónico</label>
                <input type="email" class="form-control" [(ngModel)]="empForm.email" />
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.phone" />
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Ciudad</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.city" />
              </div>
              <div class="form-group">
                <label class="form-label">Banco</label>
                <input type="text" class="form-control" [(ngModel)]="empForm.bankName" placeholder="Bancolombia, Davivienda…" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">N° Cuenta bancaria</label>
              <input type="text" class="form-control" [(ngModel)]="empForm.bankAccount" />
            </div>
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
    .py { max-width: 1280px; }
    .py__tabs { display:flex; gap:4px; margin-bottom:18px; border-bottom:2px solid #f0f4f8; }
    .py__tab  { display:flex; align-items:center; gap:6px; padding:10px 18px; border:none; background:transparent; font-size:13.5px; font-weight:600; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all .15s; border-radius:6px 6px 0 0; }
    .py__tab .material-symbols-outlined { font-size:18px; }
    .py__tab:hover { color:#1a407e; background:#f8fafc; }
    .py__tab--active { color:#1a407e; border-bottom-color:#1a407e; }
    .py__resumen { display:flex; background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-bottom:16px; }
    .py__res-item { flex:1; padding:14px 16px; border-right:1px solid #f0f4f8; }
    .py__res-item:last-child { border-right:none; }
    .py__res-label { font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
    .py__res-val   { font-family:'Sora',sans-serif; font-size:15px; font-weight:800; color:#0c1c35; margin-top:4px; }
    .py__res-val--highlight { color:#1a407e; }
    .table-wrapper { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-bottom:12px; }
    .table-scroll { overflow-x:auto; }
    .bf-table { width:100%; border-collapse:collapse; font-size:13px; }
    .bf-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; background:#f8fafc; border-bottom:1px solid #f0f4f8; white-space:nowrap; }
    .bf-table td { padding:11px 14px; border-bottom:1px solid #f8fafc; color:#374151; vertical-align:middle; }
    .bf-table tr:last-child td { border-bottom:none; }
    .bf-table tbody tr:hover td { background:#fafcff; }
    .py__row--inactive td { opacity:.55; }
    .py__emp-cell   { display:flex; align-items:center; gap:10px; }
    .py__emp-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .py__emp-avatar--inactive { background:#cbd5e1; }
    .py__emp-name { font-weight:600; color:#0c1c35; font-size:13px; }
    .py__emp-pos  { font-size:11px; color:#94a3b8; }
    .py__doc      { font-size:12px; color:#64748b; }
    .py__period   { background:#f0f4f9; padding:2px 8px; border-radius:4px; font-size:12px; font-family:'Sora',sans-serif; font-weight:600; color:#1a407e; }
    .td-currency  { font-weight:700; font-family:'Sora',sans-serif; font-size:13px; color:#0c1c35; white-space:nowrap; }
    .td-net       { color:#1a407e; }
    .td-date      { font-size:12.5px; color:#64748b; white-space:nowrap; }
    .text-danger  { color:#ef4444; }
    .badge { font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:6px; white-space:nowrap; }
    .badge--success { background:#dcfce7; color:#16a34a; }
    .badge--muted   { background:#f0f4f9; color:#64748b; }
    .badge--neutral { background:#f0f4f9; color:#475569; }
    .badge--draft   { background:#f0f4f9; color:#64748b; }
    .badge--submit  { background:#dbeafe; color:#2563eb; }
    .badge--accept  { background:#dcfce7; color:#16a34a; }
    .badge--reject  { background:#fee2e2; color:#dc2626; }
    .badge--void    { background:#f0f4f9; color:#94a3b8; }
    .py__row-actions { display:flex; gap:4px; }
    .btn-icon { width:28px; height:28px; border-radius:7px; border:1px solid #dce6f0; background:#f8fafc; color:#475569; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .15s; }
    .btn-icon:disabled { opacity:.35; cursor:default; }
    .btn-icon .material-symbols-outlined { font-size:15px; }
    .btn-icon:not(:disabled):hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-icon--primary:not(:disabled):hover { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-icon--danger:not(:disabled):hover  { background:#ef4444; border-color:#ef4444; color:#fff; }
    .py__filters { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
    .form-group-inline { display:flex; align-items:center; gap:6px; }
    .form-label-sm { font-size:12px; font-weight:600; color:#64748b; white-space:nowrap; }
    .form-control--sm { padding:5px 9px; font-size:12.5px; }
    .ct__filter-chips { display:flex; gap:6px; }
    .chip { padding:5px 12px; border-radius:99px; border:1px solid #dce6f0; background:#f8fafc; font-size:12.5px; font-weight:500; color:#64748b; cursor:pointer; transition:all .15s; }
    .chip:hover { border-color:#1a407e; color:#1a407e; }
    .chip--active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .py__empty   { display:flex; flex-direction:column; align-items:center; padding:48px 24px; gap:10px; color:#94a3b8; }
    .py__empty .material-symbols-outlined { font-size:40px; }
    .py__loading { display:flex; justify-content:center; padding:40px; }
    .spinner { width:32px; height:32px; border:3px solid #f0f4f8; border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .py__det-cols { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:18px; }
    .py__det-section { background:#f8fafc; border-radius:10px; padding:14px; }
    .py__det-title { font-size:11px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
    .py__det-row { display:flex; justify-content:space-between; font-size:12.5px; color:#374151; padding:3px 0; }
    .py__det-total { border-top:1px solid #e8eef8; margin-top:6px; padding-top:6px; font-weight:700; }
    .py__det-footer { display:flex; gap:12px; }
    .py__det-neto  { flex:1; background:#eff6ff; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center; }
    .py__det-costo { flex:1; background:#f0fdf4; border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center; }
    .py__det-neto strong, .py__det-costo strong { font-family:'Sora',sans-serif; font-size:16px; font-weight:800; color:#1a407e; }
    .py__cune { display:flex; align-items:center; gap:6px; margin-top:14px; background:#f0fdf4; border-radius:8px; padding:8px 12px; font-size:12px; color:#16a34a; }
    .py__cune .material-symbols-outlined { font-size:16px; }
    .py__form-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
    .form-section-title { font-size:11px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.08em; margin:14px 0 10px; padding-bottom:6px; border-bottom:1px solid #f0f4f8; }
    .form-section-title:first-child { margin-top:0; }
    .py__preview { background:#f8fafc; border-radius:12px; padding:16px; border:1px solid #e8eef8; }
    .py__preview-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.06em; margin-bottom:14px; }
    .py__preview-title .material-symbols-outlined { font-size:16px; }
    .py__preview-empty { font-size:12.5px; color:#94a3b8; text-align:center; padding:20px 0; }
    .py__preview-rows  { display:flex; flex-direction:column; gap:3px; }
    .py__pr { display:flex; justify-content:space-between; font-size:12.5px; color:#374151; padding:3px 0; }
    .py__pr--head { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-top:8px; padding-bottom:4px; border-bottom:1px solid #e8eef8; }
    .py__pr--sub  { font-weight:600; padding-top:4px; }
    .py__pr--neto  { background:#eff6ff; border-radius:6px; padding:6px 8px; margin-top:8px; font-weight:700; color:#1a407e; }
    .py__pr--neto strong { font-family:'Sora',sans-serif; font-size:14px; }
    .py__pr--costo { background:#f0fdf4; border-radius:6px; padding:5px 8px; margin-top:4px; font-weight:600; color:#16a34a; font-size:12px; }
    .modal-overlay { position:fixed; inset:0; background:rgba(12,28,53,.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; backdrop-filter:blur(2px); }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(12,28,53,.25); }
    .modal--lg { max-width:900px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; display:flex; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 22px; }
    .modal-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; justify-content:flex-end; gap:10px; }
    .form-group { margin-bottom:12px; }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    textarea.form-control { resize:vertical; min-height:52px; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn--primary   { background:#1a407e; color:#fff; }
    .btn--primary:hover:not(:disabled) { background:#133265; }
    .btn--primary:disabled { opacity:.6; cursor:default; }
    .btn--secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn--secondary:hover { background:#e8eef8; }
    .btn--sm { padding:7px 14px; font-size:12.5px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-header__title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-header__sub { font-size:13px; color:#64748b; margin:0; }
    .page-header__actions { display:flex; gap:8px; }
    .card { background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .card--sm { padding:12px 16px; }
    .card--flat { box-shadow:none; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid #dce6f0; border-radius:8px; padding:7px 11px; background:#fff; }
    .search-box__icon { font-size:16px; color:#94a3b8; }
    .search-box__input { border:none; outline:none; font-size:13.5px; color:#0c1c35; width:100%; background:transparent; }
    @media (max-width: 900px) {
      .py__resumen { flex-wrap:wrap; }
      .py__res-item { flex:1 1 45%; }
      .py__det-cols { grid-template-columns:1fr; }
    }
    @media (max-width: 640px) {
      .py__form-grid { grid-template-columns:1fr; }
      .form-row-2 { grid-template-columns:1fr; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; }
      .py__det-footer { flex-direction:column; }
    }
  `],
})
export class PayrollComponent implements OnInit {
  private http   = inject(HttpClient);
  private notify = inject(NotificationService);
  private auth   = inject(AuthService);

  private readonly api = `${environment.apiUrl}/payroll`;

  activeTab         = signal<ActiveTab>('records');
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

  summary         = signal<PeriodSummary | null>(null);
  preview         = signal<any | null>(null);
  showRecordDetail  = signal(false);
  selectedRecord    = signal<PayrollRecord | null>(null);
  showPayrollModal  = signal(false);
  showEmployeeModal = signal(false);
  editEmployeeId    = signal<string | null>(null);

  // Role-based permissions
  canCreatePayroll     = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER') || this.hasRole('OPERATOR'));
  canSubmit            = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canVoid              = computed(() => this.hasRole('ADMIN'));
  canManageEmployees   = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER'));
  canDeactivateEmployee = computed(() => this.hasRole('ADMIN'));
  activeEmployees      = computed(() => this.employees().filter(e => e.isActive));

  payrollForm: any  = this.emptyPayrollForm();
  empForm: any      = this.emptyEmpForm();

  ngOnInit() {
    this.loadRecords();
    this.loadEmployees();
  }

  // ── Payroll records ──────────────────────────────────────────────────────

  loadRecords() {
    this.loadingRecords.set(true);
    const params: any = {};
    if (this.recordSearch) params.search = this.recordSearch;
    if (this.periodFilter) params.period = this.periodFilter;
    if (this.statusFilter) params.status = this.statusFilter;

    this.http.get<any>(`${this.api}/records`, { params }).subscribe({
      next: r => {
        const res = r.data ?? r;
        this.records.set(res.data ?? res);
        this.loadingRecords.set(false);
      },
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

  openPayrollModal() { this.payrollForm = this.emptyPayrollForm(); this.preview.set(null); this.showPayrollModal.set(true); }
  closePayrollModal() { this.showPayrollModal.set(false); }

  preselectEmployee(e: Employee) {
    this.payrollForm = { ...this.emptyPayrollForm(), employeeId: e.id, baseSalary: e.baseSalary };
    this.recalculate();
    this.showPayrollModal.set(true);
  }

  onEmployeeSelected() {
    const emp = this.activeEmployees().find(e => e.id === this.payrollForm.employeeId);
    if (emp) { this.payrollForm.baseSalary = emp.baseSalary; this.recalculate(); }
  }

  recalculate() {
    if (!this.payrollForm.employeeId || !this.payrollForm.baseSalary) { this.preview.set(null); return; }
    const f = this.payrollForm;
    const SMMLV = 1_300_000;
    const daily     = f.baseSalary / 30;
    const prop      = daily * (f.daysWorked || 30);
    const transport = (f.transportAllowance !== undefined && f.transportAllowance !== null && f.transportAllowance !== '')
      ? Number(f.transportAllowance)
      : (f.baseSalary <= SMMLV * 2 ? 162_000 : 0);
    const overtime  = (f.overtimeHours || 0) * (f.baseSalary / 240) * 1.25;
    const earnings  = prop + transport + overtime + (f.bonuses || 0) + (f.commissions || 0) + (f.vacationPay || 0);
    const base      = prop + overtime + (f.bonuses || 0);
    const hEmp = base * 0.04; const pEmp = base * 0.04;
    const hEmpr = base * 0.085; const pEmpr = base * 0.12;
    const arl = base * 0.00522; const cf = base * 0.04;
    const deductions = hEmp + pEmp + (f.sickLeave || 0) + (f.loans || 0) + (f.otherDeductions || 0);
    this.preview.set({
      totalEarnings:    Math.round(earnings),
      healthEmployee:   Math.round(hEmp),
      pensionEmployee:  Math.round(pEmp),
      totalDeductions:  Math.round(deductions),
      healthEmployer:   Math.round(hEmpr),
      pensionEmployer:  Math.round(pEmpr),
      arl:              Math.round(arl),
      compensationFund: Math.round(cf),
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

  submitRecord(r: PayrollRecord) {
    if (!confirm(`¿Transmitir la nómina de ${r.employee.firstName} ${r.employee.lastName} a la DIAN?`)) return;
    this.http.post<any>(`${this.api}/records/${r.id}/submit`, {}).subscribe({
      next: () => { this.notify.success('Nómina transmitida a la DIAN'); this.loadRecords(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error al transmitir'),
    });
  }

  confirmVoid(r: PayrollRecord) {
    const reason = prompt(`¿Motivo de anulación para ${r.employee.firstName} ${r.employee.lastName}?`);
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

  deactivateEmployee(e: Employee) {
    if (!confirm(`¿Desactivar a ${e.firstName} ${e.lastName}?`)) return;
    this.http.patch<any>(`${this.api}/employees/${e.id}/deactivate`, {}).subscribe({
      next: () => { this.notify.success('Empleado desactivado'); this.loadEmployees(); },
      error: err => this.notify.error(err?.error?.message ?? 'Error'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  statusClass(s: string) {
    return {
      'badge--draft':  s === 'DRAFT',
      'badge--submit': s === 'SUBMITTED',
      'badge--accept': s === 'ACCEPTED',
      'badge--reject': s === 'REJECTED',
      'badge--void':   s === 'VOIDED',
    };
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
      baseSalary: 0, daysWorked: 30,
      overtimeHours: 0, bonuses: 0, commissions: 0,
      transportAllowance: null, vacationPay: 0,
      sickLeave: 0, loans: 0, otherDeductions: 0, notes: '',
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