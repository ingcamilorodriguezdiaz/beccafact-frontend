import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener, ElementRef, ViewChild } from '@angular/core';
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

interface AccountingAccountOption {
  id: string;
  code: string;
  name: string;
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
  contractEndDate?: string;
  payrollContracts?: PayrollContractHistory[];
  employmentEvents?: PayrollEmploymentEvent[];
}

interface PayrollContractHistory {
  id: string;
  version: number;
  contractType: string;
  position: string;
  baseSalary: number;
  startDate: string;
  endDate?: string | null;
  status: string;
  changeReason?: string | null;
  notes?: string | null;
  branch?: { id: string; name: string };
  payrollPolicy?: { id: string; name: string };
  payrollTypeConfig?: { id: string; name: string; category?: string };
}

interface PayrollEmploymentEvent {
  id: string;
  eventType: string;
  effectiveDate: string;
  description?: string | null;
  payload?: any;
  branch?: { id: string; name: string };
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
  senaEmployer: number;
  icbfEmployer: number;
  healthBase: number;
  pensionBase: number;
  arlBase: number;
  compensationBase: number;
  senaBase: number;
  icbfBase: number;
  socialSecuritySnapshot?: {
    warnings?: string[];
    bases?: Record<string, number>;
  };
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  totalEmployerCost: number;
  notes?: string;
  invoiceId?: string;
  invoice?: {
    id: string;
    invoiceNumber?: string;
    dianCufe?: string;
    dianQrCode?: string;
  };
  payrollCalendar?: { id: string; name: string; code?: string };
  payrollPolicy?: { id: string; name: string };
  payrollTypeConfig?: { id: string; name: string; category?: string };
  conceptLines?: PayrollRecordConceptLine[];
  novelties?: PayrollNovelty[];
  employees: Pick<Employee,'id'|'firstName'|'lastName'|'documentNumber'|'position'>;
}

interface PayrollConcept {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  nature: 'EARNING' | 'DEDUCTION';
  formulaType: 'MANUAL' | 'FIXED_AMOUNT' | 'BASE_SALARY_PERCENT' | 'PROPORTIONAL_SALARY_PERCENT' | 'OVERTIME_FACTOR';
  defaultAmount?: number | null;
  defaultRate?: number | null;
  quantityDefault?: number | null;
  appliesByDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface PayrollCalendar {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' | 'SPECIAL';
  cutoffDay?: number | null;
  paymentDay?: number | null;
  startDay?: number | null;
  endDay?: number | null;
  isDefault: boolean;
  isActive: boolean;
}

interface PayrollPolicy {
  id: string;
  branchId?: string | null;
  name: string;
  description?: string | null;
  applyAutoTransport: boolean;
  transportAllowanceAmount: number;
  transportCapMultiplier: number;
  minimumWageValue: number;
  healthEmployeeRate: number;
  pensionEmployeeRate: number;
  healthEmployerRate: number;
  pensionEmployerRate: number;
  arlRate: number;
  compensationFundRate: number;
  senaRate: number;
  icbfRate: number;
  healthCapSmmlv: number;
  pensionCapSmmlv: number;
  parafiscalCapSmmlv: number;
  applySena: boolean;
  applyIcbf: boolean;
  overtimeFactor: number;
  isDefault: boolean;
  isActive: boolean;
}

interface PayrollTypeConfig {
  id: string;
  branchId?: string | null;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  calendarId?: string | null;
  policyId?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface PayrollAppliedConceptLine {
  conceptId?: string;
  quantity?: number | null;
  rate?: number | null;
  amount?: number | null;
}

interface PayrollRecordConceptLine {
  id: string;
  code: string;
  name: string;
  nature: 'EARNING' | 'DEDUCTION';
  formulaType: string;
  quantity?: number | null;
  rate?: number | null;
  amount: number;
  source?: string | null;
}

interface PayrollNovelty {
  id: string;
  employeeId: string;
  branchId?: string | null;
  payrollRecordId?: string | null;
  type:
    | 'OVERTIME'
    | 'SURCHARGE'
    | 'SICK_LEAVE'
    | 'LICENSE'
    | 'VACATION'
    | 'LOAN'
    | 'GARNISHMENT'
    | 'ADMISSION'
    | 'TERMINATION'
    | 'SALARY_CHANGE'
    | 'OTHER_EARNING'
    | 'OTHER_DEDUCTION';
  status: 'PENDING' | 'APPLIED' | 'CANCELLED';
  period?: string | null;
  effectiveDate: string;
  startDate?: string | null;
  endDate?: string | null;
  hours?: number | null;
  days?: number | null;
  quantity?: number | null;
  rate?: number | null;
  amount?: number | null;
  description?: string | null;
  notes?: string | null;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  employee?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'documentNumber' | 'position'>;
  branch?: { id: string; name: string };
  payrollRecord?: { id: string; payrollNumber?: string; period?: string };
}

interface PeriodSummary {
  period: string;
  totalEmployees: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerCost: number;
  totalHealthEmployer?: number;
  totalPensionEmployer?: number;
  totalArl?: number;
  totalCompensationFund?: number;
  totalSena?: number;
  totalIcbf?: number;
  submitted: number;
  drafts: number;
}

interface PayrollSocialSecuritySummary {
  period: string;
  totals: {
    healthBase: number;
    pensionBase: number;
    arlBase: number;
    compensationBase: number;
    senaBase: number;
    icbfBase: number;
    healthEmployee: number;
    pensionEmployee: number;
    healthEmployer: number;
    pensionEmployer: number;
    arl: number;
    compensationFund: number;
    senaEmployer: number;
    icbfEmployer: number;
  };
  byBranch: Array<{
    branchId?: string | null;
    branchName: string;
    employees: number;
    totalEmployerContribution: number;
  }>;
  records: Array<{
    payrollRecordId: string;
    payrollNumber?: string;
    employeeName: string;
    employeeDocument?: string | null;
    branchName: string;
    warnings?: string[];
  }>;
  pilaReadyRecords: number;
}

interface PayrollSocialSecurityReconciliation {
  period: string;
  reconciliation: {
    employeeDeductions: number;
    employerContributions: number;
    grandTotalToSettle: number;
  };
  warnings: Array<{
    payrollRecordId: string;
    payrollNumber?: string;
    employeeName: string;
    warnings: string[];
  }>;
}

interface PayrollBatch {
  id: string;
  period: string;
  name: string;
  status: 'DRAFT' | 'GENERATED' | 'CLOSED';
  totalEmployees: number;
  generatedRecords: number;
  totalNetPay: number;
  totalEmployerCost: number;
  notes?: string | null;
}

interface PayrollApprovalRequest {
  id: string;
  payrollRecordId?: string | null;
  payrollBatchId?: string | null;
  actionType: 'SUBMIT' | 'VOID' | 'PREPAYROLL';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  consumedAt?: string | null;
  requestedById?: string | null;
  approvedById?: string | null;
  requestedByName?: string | null;
  approvedByName?: string | null;
}

interface PayrollAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  category?: string | null;
  notes?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
  uploadedBy?: { id: string; firstName?: string; lastName?: string; email?: string };
}

interface PayrollAuditTrail {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  createdAt: string;
  userId?: string | null;
  userName?: string | null;
  before?: any;
  after?: any;
}

interface PayrollPeriodDashboard {
  control: {
    id?: string;
    period: string;
    status: 'OPEN' | 'CLOSED';
    notes?: string | null;
  };
  batches: PayrollBatch[];
}

interface PayrollAccrualSummary {
  period: string;
  totals: {
    prima: number;
    cesantias: number;
    interests: number;
    vacations: number;
    total: number;
  };
  balances: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeDocument?: string | null;
    branchName: string;
    primaAccrued: number;
    cesantiasAccrued: number;
    interestsAccrued: number;
    vacationAccrued: number;
    totalAccrued: number;
  }>;
  runs: Array<{
    id: string;
    period: string;
    branchName: string;
    totalPrima: number;
    totalCesantias: number;
    totalInterests: number;
    totalVacations: number;
    totalAmount: number;
    journalEntry?: { id: string; number: string; date?: string; status: string } | null;
    createdAt: string;
  }>;
}

interface PayrollPortalSummary {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    documentNumber: string;
    documentType: string;
    position: string;
    email?: string | null;
    phone?: string | null;
    hireDate: string;
    contractType: string;
    baseSalary: number;
    branch?: { id: string; name: string } | null;
  };
  stats: {
    totalPayments: number;
    acceptedPayments: number;
    totalNetPaid: number;
    pendingRequests: number;
  };
  paymentHistory: PayrollRecord[];
  requests: PayrollNovelty[];
}

interface PayrollAnalyticsSummary {
  period: string;
  headline: {
    totalLaborCost: number;
    totalNetPay: number;
    activeEmployees: number;
    averageEmployerCost: number;
    overtimeHours: number;
    absentDays: number;
    turnoverRate: number;
    productivityIndex: number;
  };
  costByBranch: Array<{
    branchId?: string | null;
    branchName: string;
    employees: number;
    totalLaborCost: number;
    totalNetPay: number;
  }>;
  costByArea: Array<{
    area: string;
    employees: number;
    totalLaborCost: number;
    averageNetPay: number;
  }>;
  costByCostCenter: Array<{
    costCenter: string;
    totalLaborCost: number;
    records: number;
  }>;
  overtime: {
    hours: number;
    incidents: number;
    employees: number;
  };
  absenteeism: {
    incidents: number;
    days: number;
    sickLeaves: number;
    licenses: number;
    vacations: number;
  };
  rotation: {
    admissions: number;
    terminations: number;
    netChange: number;
    turnoverRate: number;
  };
  trends: Array<{
    period: string;
    totalLaborCost: number;
    totalNetPay: number;
    overtimeHours: number;
    absentDays: number;
    headcount: number;
  }>;
}

interface PayrollDianProcessingJob {
  id: string;
  actionType: 'SUBMIT_DIAN' | 'QUERY_DIAN_STATUS';
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  attempts: number;
  responseCode?: string | null;
  responseMessage?: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  payrollRecord?: { id: string; payrollNumber?: string | null; period?: string; status?: string } | null;
  payrollBatch?: { id: string; name: string; period: string; status: string } | null;
}

interface PayrollOperationsMonitor {
  queue: {
    pending: number;
    failed: number;
    success: number;
    recent: PayrollDianProcessingJob[];
  };
  batches: Array<{
    id: string;
    name: string;
    period: string;
    status: string;
    totalEmployees: number;
    generatedRecords: number;
    pendingJobs: number;
    failedJobs: number;
    successJobs: number;
  }>;
}

interface PayrollEnterpriseRule {
  id: string;
  branchId?: string | null;
  processArea: 'HR' | 'PAYROLL' | 'ACCOUNTING' | 'SHARED';
  actionType: string;
  policyName: string;
  allowedRoles?: string[] | null;
  requireDifferentActors: boolean;
  requireBranchScope: boolean;
  requireAccountingReview: boolean;
  sharedWithAreas?: string[] | null;
  isActive: boolean;
  notes?: string | null;
  branch?: { id: string; name: string };
}

interface PayrollEnterpriseOverview {
  rules: PayrollEnterpriseRule[];
  branchCoverage: Array<{
    branchId: string;
    branchName: string;
    hasRules: boolean;
    usesCompanyDefaults: boolean;
  }>;
  segregationSummary: {
    totalRules: number;
    activeRules: number;
    segregatedRules: number;
    accountingReviewedRules: number;
  };
  sharedBoard: Array<{
    area: 'HR' | 'PAYROLL' | 'ACCOUNTING' | 'SHARED';
    title: string;
    count: number;
    status: string;
    actionHint: string;
  }>;
  metrics: {
    pendingNovelties: number;
    pendingBatchApprovals: number;
    pendingRecordApprovals: number;
    pendingDianJobs: number;
    failedDianJobs: number;
    accountingPending: number;
    accountingFailed: number;
  };
}

type ActiveTab = 'records' | 'employees' | 'masters' | 'novelties' | 'portal' | 'analytics' | 'enterprise';
type ViewMode  = 'table' | 'grid';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    <div class="py">

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <section class="hero-shell" id="tour-payroll-header">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Gestion laboral</p>
            <h1 class="page-header__title">Nómina Electrónica</h1>
            <p class="page-header__sub">Liquida, monitorea y transmite novedades de nómina a la DIAN desde una vista más clara y operativa.</p>
          </div>
          <div class="page-header__actions">
            @if (activeTab() === 'records' && canCreatePayroll()) {
              <button class="btn btn--primary btn--sm" [disabled]="periodClosed()" (click)="openPayrollModal()">
                <span class="material-symbols-outlined">add</span> Nueva liquidación
              </button>
            }
            @if (activeTab() === 'records' && canSubmit()) {
              <button class="btn btn--secondary btn--sm" id="tour-payroll-operations" (click)="openOperationsModal()">
                <span class="material-symbols-outlined">developer_board</span> Operación DIAN
              </button>
            }
            @if (activeTab() === 'employees' && canManageEmployees()) {
              <button class="btn btn--primary btn--sm" (click)="openEmployeeModal()">
                <span class="material-symbols-outlined">person_add</span> Nuevo empleado
              </button>
            }
            @if (activeTab() === 'portal' && portalSelectedEmployeeId()) {
              <button class="btn btn--primary btn--sm" (click)="downloadEmploymentCertificate()">
                <span class="material-symbols-outlined">description</span> Certificado
              </button>
            }
          </div>
        </div>

        <div class="hero-insights">
          <div class="hero-stat hero-stat--primary">
            <span class="hero-stat__label">{{ activeTab() === 'records' ? 'Liquidaciones visibles' : activeTab() === 'employees' ? 'Empleados visibles' : activeTab() === 'masters' ? 'Conceptos activos' : activeTab() === 'novelties' ? 'Novedades visibles' : activeTab() === 'portal' ? 'Desprendibles visibles' : activeTab() === 'analytics' ? 'Cortes analíticos' : 'Reglas enterprise' }}</span>
            <strong class="hero-stat__value">{{ activeTab() === 'records' ? records().length : activeTab() === 'employees' ? employees().length : activeTab() === 'masters' ? activePayrollConceptCount() : activeTab() === 'novelties' ? payrollNovelties().length : activeTab() === 'portal' ? (portalSummary()?.paymentHistory?.length ?? 0) : activeTab() === 'analytics' ? (analyticsSummary()?.trends?.length ?? 0) : (enterpriseOverview()?.segregationSummary?.activeRules ?? 0) }}</strong>
            <small class="hero-stat__hint">{{ activeTab() === 'records' ? 'Vista operativa del periodo actual' : activeTab() === 'employees' ? 'Base laboral disponible para liquidar' : activeTab() === 'masters' ? 'Catálogo laboral parametrizable por empresa y sucursal' : activeTab() === 'novelties' ? 'Incidencias que impactan la liquidación y el ciclo laboral' : activeTab() === 'portal' ? 'Autoservicio del colaborador con pagos, certificados y solicitudes' : activeTab() === 'analytics' ? 'Costo laboral, ausentismo, rotación y tendencias gerenciales' : 'Reglas por empresa, segregación y tablero compartido entre RRHH, nómina y contabilidad' }}</small>
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

      <section class="tabs-shell" id="tour-payroll-nav">
        <div class="tabs-shell__head">
          <div>
            <span class="tabs-shell__eyebrow">Navegación del módulo</span>
            <h3>Áreas de Nómina</h3>
          </div>
          <p>Organiza la operación laboral entre liquidación, talento humano, autoservicio, analítica y gobierno enterprise.</p>
        </div>

        <div class="tabs-groups">
          <section class="tab-group">
            <div class="tab-group__header">
              <div>
                <span class="tab-group__label">Operación diaria</span>
                <small>Trabajo recurrente de liquidación, empleados y novedades del período.</small>
              </div>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='records'" (click)="activeTab.set('records')">
                <span class="material-symbols-outlined">receipt_long</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Liquidaciones</span>
                  <span class="tab-btn__meta">Gestiona el período, lotes, transmisión DIAN y detalle operativo.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='employees'" (click)="activeTab.set('employees'); loadEmployees()">
                <span class="material-symbols-outlined">groups</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Empleados</span>
                  <span class="tab-btn__meta">Administra la base laboral, contratos y ciclo de vida del colaborador.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='novelties'" (click)="activeTab.set('novelties'); loadPayrollNovelties()">
                <span class="material-symbols-outlined">event_note</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Novedades</span>
                  <span class="tab-btn__meta">Controla incidencias, ausencias, horas extra y cambios del período.</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group">
            <div class="tab-group__header">
              <div>
                <span class="tab-group__label">Gestión laboral</span>
                <small>Parametrización, portal del empleado y lectura gerencial del módulo.</small>
              </div>
            </div>
            <div class="tab-grid">
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='masters'" (click)="activeTab.set('masters'); loadPayrollMasters()">
                <span class="material-symbols-outlined">tune</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Parametrización</span>
                  <span class="tab-btn__meta">Conceptos, calendarios, políticas y tipos de nómina por empresa y sucursal.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='portal'" (click)="activeTab.set('portal'); loadPortalSummary()">
                <span class="material-symbols-outlined">badge</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Portal empleado</span>
                  <span class="tab-btn__meta">Desprendibles, certificados e interacción del colaborador con RRHH.</span>
                </span>
              </button>
              <button class="tab-btn" [class.tab-btn--active]="activeTab()==='analytics'" (click)="activeTab.set('analytics'); loadPayrollAnalyticsSummary()">
                <span class="material-symbols-outlined">monitoring</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Analítica</span>
                  <span class="tab-btn__meta">Costo laboral, ausentismo, rotación, productividad y tendencias.</span>
                </span>
              </button>
            </div>
          </section>

          <section class="tab-group tab-group--utility">
            <div class="tab-group__header">
              <div>
                <span class="tab-group__label">Gobierno y cumplimiento</span>
                <small>Control enterprise, operación DIAN y segregación compartida con contabilidad.</small>
              </div>
            </div>
            <div class="tab-grid tab-grid--compact">
              <button class="tab-btn tab-btn--utility" [class.tab-btn--active]="activeTab()==='enterprise' && !showOperationsModal()" (click)="activeTab.set('enterprise'); loadPayrollEnterpriseOverview()">
                <span class="material-symbols-outlined">policy</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Gobierno enterprise</span>
                  <span class="tab-btn__meta">Reglas por empresa, sucursal, segregación de funciones y tablero compartido.</span>
                </span>
              </button>
              <button class="tab-btn tab-btn--utility" [class.tab-btn--active]="showOperationsModal()" (click)="openOperationsModal()">
                <span class="material-symbols-outlined">developer_board</span>
                <span class="tab-btn__content">
                  <span class="tab-btn__title">Operación DIAN</span>
                  <span class="tab-btn__meta">Cola técnica, reprocesos y monitoreo documental de nómina electrónica.</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </section>

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
            <div class="filter-chips">
              <button class="chip chip--active" type="button" (click)="generateBatch()">Pre-nómina</button>
              @if (!periodClosed()) {
                <button class="chip" type="button" (click)="closePayrollPeriodAction()">Cerrar período</button>
              } @else {
                <button class="chip chip--warn" type="button" (click)="reopenPayrollPeriodAction()">Reabrir período</button>
              }
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
            <div class="py__res-item">
              <span class="py__res-label">Estado período</span>
              <span class="py__res-val">{{ periodClosed() ? 'Cerrado' : 'Abierto' }}</span>
            </div>
          </div>
        }

        @if (periodFilter && socialSecuritySummary() && socialSecurityReconciliation()) {
          <section class="content-shell" style="margin-top:14px">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Seguridad social y parafiscales</p>
                <h3>Resumen operativo y conciliación del período</h3>
              </div>
              <div class="content-shell__meta">
                <span class="content-chip">{{ socialSecuritySummary()!.pilaReadyRecords }} registros listos</span>
                <button class="btn btn--secondary btn--sm" type="button" (click)="downloadPilaExport()">
                  <span class="material-symbols-outlined" style="font-size:15px">download</span>
                  Exportar PILA
                </button>
              </div>
            </div>
            <div class="py__resumen" style="margin:0 0 14px 0">
              <div class="py__res-item">
                <span class="py__res-label">Salud empresa</span>
                <span class="py__res-val">{{ socialSecuritySummary()!.totals.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Pensión empresa</span>
                <span class="py__res-val">{{ socialSecuritySummary()!.totals.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">ARL</span>
                <span class="py__res-val">{{ socialSecuritySummary()!.totals.arl | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Caja + SENA + ICBF</span>
                <span class="py__res-val">{{ currentParafiscalTotal() | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Aportes empleados</span>
                <span class="py__res-val">{{ socialSecurityReconciliation()!.reconciliation.employeeDeductions | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Total a conciliar</span>
                <span class="py__res-val py__res-val--hl">{{ socialSecurityReconciliation()!.reconciliation.grandTotalToSettle | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead>
                  <tr><th>Sucursal</th><th>Empleados</th><th>Aporte empresa</th></tr>
                </thead>
                <tbody>
                  @for (row of socialSecuritySummary()!.byBranch; track row.branchName) {
                    <tr>
                      <td>{{ row.branchName }}</td>
                      <td>{{ row.employees }}</td>
                      <td>{{ row.totalEmployerContribution | currency:'COP':'symbol':'1.0-0' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (socialSecurityReconciliation()!.warnings.length) {
              <div class="dw-card" style="margin-top:12px">
                <div class="dw-section-title" style="margin-bottom:8px">Validaciones y topes detectados</div>
                @for (warning of socialSecurityReconciliation()!.warnings; track warning.payrollRecordId) {
                  <div class="dw-pay-row">
                    <span>{{ warning.employeeName }} · {{ warning.payrollNumber || 'Sin número' }}</span>
                    <span>{{ warning.warnings.join(', ') }}</span>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (periodFilter && accrualSummary()) {
          <section class="content-shell" style="margin-top:14px">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Provisiones y acumulados</p>
                <h3>Prima, cesantías, intereses y vacaciones causadas</h3>
              </div>
              <div class="content-shell__meta">
                <span class="content-chip">{{ accrualSummary()!.balances.length }} empleados</span>
                <button class="btn btn--secondary btn--sm" type="button" (click)="runPayrollProvisions()">
                  <span class="material-symbols-outlined" style="font-size:15px">account_balance</span>
                  Ejecutar provisiones
                </button>
              </div>
            </div>
            <div class="py__resumen" style="margin:0 0 14px 0">
              <div class="py__res-item">
                <span class="py__res-label">Prima</span>
                <span class="py__res-val">{{ accrualSummary()!.totals.prima | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Cesantías</span>
                <span class="py__res-val">{{ accrualSummary()!.totals.cesantias | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Intereses</span>
                <span class="py__res-val">{{ accrualSummary()!.totals.interests | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Vacaciones causadas</span>
                <span class="py__res-val">{{ accrualSummary()!.totals.vacations | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
              <div class="py__res-item">
                <span class="py__res-label">Total acumulado</span>
                <span class="py__res-val py__res-val--hl">{{ accrualSummary()!.totals.total | currency:'COP':'symbol':'1.0-0' }}</span>
              </div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead><tr><th>Empleado</th><th>Sucursal</th><th>Prima</th><th>Cesantías</th><th>Intereses</th><th>Vacaciones</th><th>Total</th></tr></thead>
                <tbody>
                  @for (row of accrualSummary()!.balances.slice(0, 12); track row.id) {
                    <tr>
                      <td>{{ row.employeeName }}</td>
                      <td>{{ row.branchName }}</td>
                      <td>{{ row.primaAccrued | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td>{{ row.cesantiasAccrued | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td>{{ row.interestsAccrued | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td>{{ row.vacationAccrued | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td>{{ row.totalAccrued | currency:'COP':'symbol':'1.0-0' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (accrualSummary()!.runs.length) {
              <div class="dw-card" style="margin-top:12px">
                <div class="dw-section-title" style="margin-bottom:8px">Corridas contables del período</div>
                @for (run of accrualSummary()!.runs; track run.id) {
                  <div class="dw-pay-row">
                    <span>{{ run.branchName }} · {{ run.journalEntry?.number || 'Sin comprobante' }}</span>
                    <span>{{ run.totalAmount | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (payrollBatches().length) {
          <section class="content-shell" style="margin-top:14px">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Pre-nómina</p>
                <h3>Lotes del período</h3>
              </div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead><tr><th>Lote</th><th>Estado</th><th>Empleados</th><th>Generados</th><th>Neto</th><th>Aprobación</th><th></th></tr></thead>
                <tbody>
                  @for (batch of payrollBatches(); track batch.id) {
                    <tr>
                      <td>{{ batch.name }}</td>
                      <td><span class="badge badge--neutral">{{ batch.status }}</span></td>
                      <td>{{ batch.totalEmployees }}</td>
                      <td>{{ batch.generatedRecords }}</td>
                      <td>{{ batch.totalNetPay | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td>
                        @if (latestBatchApproval(batch.id); as approval) {
                          <div style="display:flex;flex-direction:column;gap:4px">
                            <span class="badge" [ngClass]="{
                              'badge--submit': approval.status === 'PENDING',
                              'badge--accept': approval.status === 'APPROVED',
                              'badge--reject': approval.status === 'REJECTED'
                            }">{{ approvalStatusLabel(approval.status) }}</span>
                            <small style="color:#64748b">{{ approval.requestedByName || 'Sin solicitante' }}</small>
                          </div>
                        } @else {
                          <span class="badge badge--neutral">Sin flujo</span>
                        }
                      </td>
                      <td class="actions-cell">
                        <div class="row-actions">
                          @if (canSubmit()) {
                            <button class="btn-icon" title="Solicitar aprobación" (click)="requestBatchApproval(batch)">
                              <span class="material-symbols-outlined">fact_check</span>
                            </button>
                          }
                          @if (canSubmit() && latestBatchApproval(batch.id)?.status === 'PENDING') {
                            <button class="btn-icon btn-icon--primary" title="Aprobar pre-nómina" (click)="approveBatchApproval(batch)">
                              <span class="material-symbols-outlined">approval</span>
                            </button>
                            <button class="btn-icon btn-icon--danger" title="Rechazar pre-nómina" (click)="rejectBatchApproval(batch)">
                              <span class="material-symbols-outlined">gpp_bad</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
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
                  <button class="btn btn--primary btn--sm" [disabled]="periodClosed()" (click)="openPayrollModal()">Nueva liquidación</button>
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
                                    [disabled]="transmitting() || !periodClosed()" (click)="submitRecord(r)">
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
                <button class="btn btn--primary btn--sm" [disabled]="periodClosed()" (click)="openPayrollModal()">Nueva liquidación</button>
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
                      <button class="btn btn--sm btn--primary" [disabled]="transmitting() || !periodClosed()" (click)="submitRecord(r)">
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
                          <button class="btn-icon" title="Historial laboral" (click)="viewEmployeeDetail(e)">
                            <span class="material-symbols-outlined">history</span>
                          </button>
                          <button class="btn-icon btn-icon--primary" title="Crear liquidación"
                                  [disabled]="!canCreatePayroll() || !e.isActive || periodClosed()"
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
                            [disabled]="!canCreatePayroll() || !e.isActive || periodClosed()"
                            (click)="preselectEmployee(e)">
                      <span class="material-symbols-outlined" style="font-size:15px">add_circle</span> Liquidar
                    </button>
                    <button class="btn-icon" title="Historial laboral" (click)="viewEmployeeDetail(e)">
                      <span class="material-symbols-outlined">history</span>
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

      <!-- ══ TAB: MASTERS ═════════════════════════════════════════════════ -->
      @if (activeTab() === 'masters') {
        <section class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Parametrización laboral</p>
              <h3>Maestros de nómina por empresa y sucursal</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ masterSummaryCount() }} registros</span>
              <span class="content-chip content-chip--soft">Tipos, políticas, calendarios y conceptos</span>
            </div>
          </div>

          <div class="employee-grid">
            <div class="employee-card" style="grid-column:span 2">
              <div class="ec-top">
                <div class="ec-name">Conceptos parametrizables</div>
                <div class="ec-pos">Devengados y deducciones con fórmula o valor manual</div>
              </div>
              <div class="form-grid" style="margin-top:12px">
                <div><label class="form-label">Código</label><input class="form-control" [(ngModel)]="conceptForm.code" /></div>
                <div><label class="form-label">Nombre</label><input class="form-control" [(ngModel)]="conceptForm.name" /></div>
                <div><label class="form-label">Naturaleza</label><select class="form-control" [(ngModel)]="conceptForm.nature"><option value="EARNING">Devengado</option><option value="DEDUCTION">Deducción</option></select></div>
                <div><label class="form-label">Fórmula</label><select class="form-control" [(ngModel)]="conceptForm.formulaType"><option value="MANUAL">Manual</option><option value="FIXED_AMOUNT">Monto fijo</option><option value="BASE_SALARY_PERCENT">% salario base</option><option value="PROPORTIONAL_SALARY_PERCENT">% salario proporcional</option><option value="OVERTIME_FACTOR">Factor hora extra</option></select></div>
                <div><label class="form-label">Monto base</label><input type="number" class="form-control" [(ngModel)]="conceptForm.defaultAmount" /></div>
                <div><label class="form-label">Tasa base</label><input type="number" class="form-control" [(ngModel)]="conceptForm.defaultRate" /></div>
                <div>
                  <label class="form-label">Cuenta contable</label>
                  <select class="form-control" [(ngModel)]="conceptForm.accountingAccountId">
                    <option value="">Usar perfil de nómina</option>
                    @for (acc of accountingAccounts(); track acc.id) {
                      <option [value]="acc.id">{{ acc.code }} · {{ acc.name }}</option>
                    }
                  </select>
                </div>
                <div><label class="form-label">Centro de costo</label><input class="form-control" [(ngModel)]="conceptForm.costCenter" placeholder="ADM-001" /></div>
                <div><label class="form-label">Proyecto</label><input class="form-control" [(ngModel)]="conceptForm.projectCode" placeholder="PRJ-NOMINA" /></div>
              </div>
              <div class="filters-bar__controls" style="margin-top:12px">
                <label class="chip"><input type="checkbox" [(ngModel)]="conceptForm.appliesByDefault" /> Aplicar por defecto</label>
                <label class="chip"><input type="checkbox" [(ngModel)]="conceptForm.affectsSocialSecurity" /> Afecta seguridad social</label>
              </div>
              <div class="ec-actions" style="margin-top:12px">
                <button class="btn btn--primary btn--sm" (click)="saveConcept()">Guardar concepto</button>
              </div>
              <div class="table-card" style="margin-top:14px">
                <table class="data-table">
                  <thead><tr><th>Código</th><th>Concepto</th><th>Naturaleza</th><th>Fórmula</th><th>Default</th></tr></thead>
                  <tbody>
                    @for (concept of payrollConcepts(); track concept.id) {
                      <tr>
                        <td><code>{{ concept.code }}</code></td>
                        <td>{{ concept.name }}</td>
                        <td>{{ concept.nature === 'EARNING' ? 'Devengado' : 'Deducción' }}</td>
                        <td>{{ concept.formulaType }}</td>
                        <td>{{ concept.defaultAmount || concept.defaultRate || 0 }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Calendarios</div><div class="ec-pos">Cortes, pago y frecuencia</div></div>
              <div class="form-grid" style="margin-top:12px">
                <div><label class="form-label">Código</label><input class="form-control" [(ngModel)]="calendarForm.code" /></div>
                <div><label class="form-label">Nombre</label><input class="form-control" [(ngModel)]="calendarForm.name" /></div>
                <div><label class="form-label">Frecuencia</label><select class="form-control" [(ngModel)]="calendarForm.frequency"><option value="MONTHLY">Mensual</option><option value="BIWEEKLY">Quincenal</option><option value="WEEKLY">Semanal</option><option value="SPECIAL">Especial</option></select></div>
                <div><label class="form-label">Día pago</label><input type="number" class="form-control" [(ngModel)]="calendarForm.paymentDay" /></div>
              </div>
              <div class="ec-actions" style="margin-top:12px"><button class="btn btn--primary btn--sm" (click)="saveCalendar()">Guardar calendario</button></div>
              <div class="ec-info" style="margin-top:12px">
                @for (calendar of payrollCalendars(); track calendar.id) {
                  <div class="ec-row"><span class="material-symbols-outlined">calendar_month</span><span>{{ calendar.name }} · {{ calendar.frequency }}</span></div>
                }
              </div>
            </div>

            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Políticas laborales</div><div class="ec-pos">Tasas y reglas por empresa o sucursal</div></div>
              <div class="form-grid" style="margin-top:12px">
                <div><label class="form-label">Nombre</label><input class="form-control" [(ngModel)]="policyForm.name" /></div>
                <div><label class="form-label">Aux. transporte</label><input type="number" class="form-control" [(ngModel)]="policyForm.transportAllowanceAmount" /></div>
                <div><label class="form-label">SMMLV</label><input type="number" class="form-control" [(ngModel)]="policyForm.minimumWageValue" /></div>
                <div><label class="form-label">Salud emp.</label><input type="number" class="form-control" [(ngModel)]="policyForm.healthEmployeeRate" /></div>
                <div><label class="form-label">Pensión emp.</label><input type="number" class="form-control" [(ngModel)]="policyForm.pensionEmployeeRate" /></div>
                <div><label class="form-label">Salud empresa</label><input type="number" class="form-control" [(ngModel)]="policyForm.healthEmployerRate" /></div>
                <div><label class="form-label">Pensión empresa</label><input type="number" class="form-control" [(ngModel)]="policyForm.pensionEmployerRate" /></div>
                <div><label class="form-label">ARL</label><input type="number" class="form-control" [(ngModel)]="policyForm.arlRate" /></div>
                <div><label class="form-label">Caja compensación</label><input type="number" class="form-control" [(ngModel)]="policyForm.compensationFundRate" /></div>
                <div><label class="form-label">SENA</label><input type="number" class="form-control" [(ngModel)]="policyForm.senaRate" /></div>
                <div><label class="form-label">ICBF</label><input type="number" class="form-control" [(ngModel)]="policyForm.icbfRate" /></div>
                <div><label class="form-label">Tope salud (SMMLV)</label><input type="number" class="form-control" [(ngModel)]="policyForm.healthCapSmmlv" /></div>
                <div><label class="form-label">Tope pensión (SMMLV)</label><input type="number" class="form-control" [(ngModel)]="policyForm.pensionCapSmmlv" /></div>
                <div><label class="form-label">Tope parafiscal (SMMLV)</label><input type="number" class="form-control" [(ngModel)]="policyForm.parafiscalCapSmmlv" /></div>
              </div>
              <div class="filters-bar__controls" style="margin-top:12px">
                <label class="chip"><input type="checkbox" [(ngModel)]="policyForm.applySena" /> Liquidar SENA</label>
                <label class="chip"><input type="checkbox" [(ngModel)]="policyForm.applyIcbf" /> Liquidar ICBF</label>
              </div>
              <div class="ec-actions" style="margin-top:12px"><button class="btn btn--primary btn--sm" (click)="savePolicy()">Guardar política</button></div>
              <div class="ec-info" style="margin-top:12px">
                @for (policy of payrollPolicies(); track policy.id) {
                  <div class="ec-row"><span class="material-symbols-outlined">policy</span><span>{{ policy.name }} · Caja {{ policy.compensationFundRate }} · SENA {{ policy.senaRate }} · ICBF {{ policy.icbfRate }}</span></div>
                }
              </div>
            </div>

            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Tipos de nómina</div><div class="ec-pos">Operación por categoría, política y calendario</div></div>
              <div class="form-grid" style="margin-top:12px">
                <div><label class="form-label">Código</label><input class="form-control" [(ngModel)]="payrollTypeForm.code" /></div>
                <div><label class="form-label">Nombre</label><input class="form-control" [(ngModel)]="payrollTypeForm.name" /></div>
                <div><label class="form-label">Categoría</label><input class="form-control" [(ngModel)]="payrollTypeForm.category" /></div>
                <div>
                  <label class="form-label">Calendario</label>
                  <select class="form-control" [(ngModel)]="payrollTypeForm.calendarId">
                    <option value="">Sin calendario</option>
                    @for (calendar of payrollCalendars(); track calendar.id) {
                      <option [value]="calendar.id">{{ calendar.name }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="form-label">Política</label>
                  <select class="form-control" [(ngModel)]="payrollTypeForm.policyId">
                    <option value="">Sin política</option>
                    @for (policy of payrollPolicies(); track policy.id) {
                      <option [value]="policy.id">{{ policy.name }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="ec-actions" style="margin-top:12px"><button class="btn btn--primary btn--sm" (click)="savePayrollType()">Guardar tipo</button></div>
              <div class="ec-info" style="margin-top:12px">
                @for (type of payrollTypeConfigs(); track type.id) {
                  <div class="ec-row"><span class="material-symbols-outlined">badge</span><span>{{ type.name }} · {{ type.category }}</span></div>
                }
              </div>
            </div>
          </div>
        </section>
      }

      @if (activeTab() === 'novelties') {
        <section class="content-shell">
          <div class="content-shell__head">
            <div>
              <p class="content-shell__kicker">Novedades e incidencias</p>
              <h3>Operación laboral del período</h3>
            </div>
            <div class="content-shell__meta">
              <span class="content-chip">{{ payrollNovelties().length }} registros</span>
              <span class="content-chip content-chip--soft">Horas extra, licencias, vacaciones, préstamos y más</span>
            </div>
          </div>

          <div class="employee-grid">
            <div class="employee-card" style="grid-column:span 2">
              <div class="ec-top">
                <div class="ec-name">Registrar novedad</div>
                <div class="ec-pos">Impacta automáticamente la liquidación del período y el ciclo laboral del empleado</div>
              </div>
              <div class="form-grid" style="margin-top:12px">
                <div>
                  <label class="form-label">Empleado</label>
                  <select class="form-control" [(ngModel)]="noveltyForm.employeeId">
                    <option value="">Seleccionar…</option>
                    @for (e of employees(); track e.id) {
                      <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} — {{ e.position }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="form-label">Tipo</label>
                  <select class="form-control" [(ngModel)]="noveltyForm.type">
                    <option value="OVERTIME">Horas extra</option>
                    <option value="SURCHARGE">Recargos</option>
                    <option value="SICK_LEAVE">Incapacidad</option>
                    <option value="LICENSE">Licencia</option>
                    <option value="VACATION">Vacaciones</option>
                    <option value="LOAN">Préstamo</option>
                    <option value="GARNISHMENT">Embargo</option>
                    <option value="ADMISSION">Ingreso</option>
                    <option value="TERMINATION">Retiro</option>
                    <option value="SALARY_CHANGE">Cambio salarial</option>
                    <option value="OTHER_EARNING">Otro devengado</option>
                    <option value="OTHER_DEDUCTION">Otra deducción</option>
                  </select>
                </div>
                <div><label class="form-label">Período</label><input type="month" class="form-control" [(ngModel)]="noveltyForm.period" /></div>
                <div><label class="form-label">Fecha efectiva</label><input type="date" class="form-control" [(ngModel)]="noveltyForm.effectiveDate" /></div>
                <div><label class="form-label">Horas</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.hours" /></div>
                <div><label class="form-label">Días</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.days" /></div>
                <div><label class="form-label">Monto</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.amount" /></div>
                <div><label class="form-label">Tasa</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.rate" /></div>
                <div><label class="form-label">Salario anterior</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.salaryFrom" /></div>
                <div><label class="form-label">Salario nuevo</label><input type="number" class="form-control" [(ngModel)]="noveltyForm.salaryTo" /></div>
                <div style="grid-column:1/-1"><label class="form-label">Descripción</label><input class="form-control" [(ngModel)]="noveltyForm.description" /></div>
              </div>
              <div class="ec-actions" style="margin-top:12px">
                <button class="btn btn--primary btn--sm" (click)="saveNovelty()">Guardar novedad</button>
              </div>
            </div>

            <div class="employee-card" style="grid-column:span 2">
              <div class="ec-top">
                <div class="ec-name">Novedades registradas</div>
                <div class="ec-pos">Las pendientes se aplican automáticamente al liquidar el período</div>
              </div>
              <div class="table-card" style="margin-top:12px">
                <table class="data-table">
                  <thead>
                    <tr><th>Empleado</th><th>Tipo</th><th>Período</th><th>Fecha</th><th>Monto/Horas</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    @for (novelty of payrollNovelties(); track novelty.id) {
                      <tr>
                        <td>{{ novelty.employee?.firstName }} {{ novelty.employee?.lastName }}</td>
                        <td>{{ noveltyTypeLabel(novelty.type) }}</td>
                        <td>{{ novelty.period || '—' }}</td>
                        <td>{{ novelty.effectiveDate | date:'dd/MM/yyyy' }}</td>
                        <td>
                          @if (novelty.amount) {
                            <span>{{ novelty.amount | currency:'COP':'symbol':'1.0-0' }}</span>
                          } @else {
                            <span>{{ novelty.hours || novelty.days || novelty.quantity || 0 }}</span>
                          }
                        </td>
                        <td><span class="badge badge--neutral">{{ noveltyStatusLabel(novelty.status) }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      }

      @if (activeTab() === 'portal') {
        <section class="filters-shell">
          <div class="filters-bar">
            <div class="filters-bar__controls">
              <div class="form-group-inline">
                <label class="form-label-sm">Colaborador</label>
                <select class="filter-select" [ngModel]="portalSelectedEmployeeId()" (ngModelChange)="portalSelectedEmployeeId.set($event); loadPortalSummary()">
                  <option value="">Seleccionar…</option>
                  @for (e of activeEmployees(); track e.id) {
                    <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} · {{ e.position }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="filter-chips">
              <button class="chip" type="button" (click)="loadPortalSummary()">Actualizar</button>
              @if (portalSelectedEmployeeId()) {
                <button class="chip chip--active" type="button" (click)="downloadEmploymentCertificate()">Certificado laboral</button>
              }
            </div>
          </div>
        </section>

        @if (portalSummary(); as portal) {
          <div class="py__resumen">
            <div class="py__res-item">
              <span class="py__res-label">Pagos registrados</span>
              <span class="py__res-val">{{ portal.stats.totalPayments }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Pagos aceptados</span>
              <span class="py__res-val">{{ portal.stats.acceptedPayments }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Neto histórico</span>
              <span class="py__res-val py__res-val--hl">{{ portal.stats.totalNetPaid | currency:'COP':'symbol':'1.0-0' }}</span>
            </div>
            <div class="py__res-item">
              <span class="py__res-label">Solicitudes pendientes</span>
              <span class="py__res-val">{{ portal.stats.pendingRequests }}</span>
            </div>
          </div>

          <div class="employee-grid">
            <div class="employee-card">
              <div class="ec-top">
                <div class="ec-name">{{ portal.employee.firstName }} {{ portal.employee.lastName }}</div>
                <div class="ec-pos">{{ portal.employee.position }}</div>
                @if (portal.employee.branch?.name) {
                  <div class="ec-pos">Sucursal: {{ portal.employee.branch?.name }}</div>
                }
              </div>
              <div class="ec-info">
                <div class="ec-row"><span class="material-symbols-outlined">badge</span><span>{{ portal.employee.documentType }} {{ portal.employee.documentNumber }}</span></div>
                <div class="ec-row"><span class="material-symbols-outlined">calendar_today</span><span>Ingreso: {{ portal.employee.hireDate | date:'dd/MM/yyyy' }}</span></div>
                <div class="ec-row ec-salary"><span class="material-symbols-outlined">payments</span><span>{{ portal.employee.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span></div>
                @if (portal.employee.email) {
                  <div class="ec-row"><span class="material-symbols-outlined">mail</span><span>{{ portal.employee.email }}</span></div>
                }
              </div>
            </div>

            <div class="employee-card" style="grid-column:span 2">
              <div class="ec-top">
                <div class="ec-name">Solicitar vacaciones o licencia</div>
                <div class="ec-pos">Las solicitudes quedan como novedad pendiente para aprobación y liquidación</div>
              </div>
              <div class="form-grid" style="margin-top:12px">
                <div>
                  <label class="form-label">Tipo</label>
                  <select class="form-control" [(ngModel)]="portalRequestForm.requestType">
                    <option value="VACATION">Vacaciones</option>
                    <option value="LICENSE">Licencia</option>
                  </select>
                </div>
                <div><label class="form-label">Período</label><input type="month" class="form-control" [(ngModel)]="portalRequestForm.period" /></div>
                <div><label class="form-label">Inicio</label><input type="date" class="form-control" [(ngModel)]="portalRequestForm.startDate" /></div>
                <div><label class="form-label">Fin</label><input type="date" class="form-control" [(ngModel)]="portalRequestForm.endDate" /></div>
                <div><label class="form-label">Días</label><input type="number" class="form-control" [(ngModel)]="portalRequestForm.days" /></div>
                <div style="grid-column:1/-1"><label class="form-label">Descripción</label><input class="form-control" [(ngModel)]="portalRequestForm.description" /></div>
              </div>
              <div class="ec-actions" style="margin-top:12px">
                <button class="btn btn--primary btn--sm" (click)="submitPortalRequest()">Registrar solicitud</button>
              </div>
            </div>
          </div>

          <section class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Portal del empleado</p>
                <h3>Historial de pagos y desprendibles</h3>
              </div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead><tr><th>Período</th><th>Número</th><th>Fecha pago</th><th>Neto</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  @for (payment of portal.paymentHistory; track payment.id) {
                    <tr>
                      <td>{{ payment.period }}</td>
                      <td>{{ payment.payrollNumber || 'Sin número' }}</td>
                      <td>{{ payment.payDate | date:'dd/MM/yyyy' }}</td>
                      <td>{{ payment.netPay | currency:'COP':'symbol':'1.0-0' }}</td>
                      <td><span class="badge" [ngClass]="statusClass(payment.status)">{{ statusLabel(payment.status) }}</span></td>
                      <td class="actions-cell">
                        <button class="btn btn--secondary btn--sm" (click)="openPayrollReceipt(payment)">Desprendible</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="content-shell">
            <div class="content-shell__head">
              <div>
                <p class="content-shell__kicker">Autoservicio</p>
                <h3>Solicitudes y novedades del colaborador</h3>
              </div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead><tr><th>Tipo</th><th>Período</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (request of portal.requests; track request.id) {
                    <tr>
                      <td>{{ noveltyTypeLabel(request.type) }}</td>
                      <td>{{ request.period || '—' }}</td>
                      <td>{{ request.startDate ? (request.startDate | date:'dd/MM/yyyy') : (request.effectiveDate | date:'dd/MM/yyyy') }}</td>
                      <td>{{ request.endDate ? (request.endDate | date:'dd/MM/yyyy') : '—' }}</td>
                      <td>{{ request.days || request.quantity || 0 }}</td>
                      <td><span class="badge badge--neutral">{{ noveltyStatusLabel(request.status) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }

      @if (activeTab() === 'analytics' && analyticsSummary(); as analytics) {
        <section class="filters-shell">
          <div class="filters-bar">
            <div class="filters-bar__controls">
              <div class="form-group-inline">
                <label class="form-label-sm">Período</label>
                <input type="month" class="filter-select" [ngModel]="analyticsPeriod()" (ngModelChange)="analyticsPeriod.set($event); loadPayrollAnalyticsSummary()" />
              </div>
              <div class="form-group-inline">
                <label class="form-label-sm">Sucursal</label>
                <select class="filter-select" [ngModel]="analyticsBranchId()" (ngModelChange)="analyticsBranchId.set($event); loadPayrollAnalyticsSummary()">
                  <option value="">Todas</option>
                  @for (branch of branches(); track branch.id) {
                    <option [value]="branch.id">{{ branch.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="filter-chips">
              <button class="chip chip--active" type="button" (click)="loadPayrollAnalyticsSummary()">Actualizar</button>
            </div>
          </div>
        </section>

        <div class="py__resumen">
          <div class="py__res-item"><span class="py__res-label">Costo laboral</span><span class="py__res-val py__res-val--hl">{{ analytics.headline.totalLaborCost | currency:'COP':'symbol':'1.0-0' }}</span></div>
          <div class="py__res-item"><span class="py__res-label">Neto pagado</span><span class="py__res-val">{{ analytics.headline.totalNetPay | currency:'COP':'symbol':'1.0-0' }}</span></div>
          <div class="py__res-item"><span class="py__res-label">Horas extra</span><span class="py__res-val">{{ analytics.headline.overtimeHours }}</span></div>
          <div class="py__res-item"><span class="py__res-label">Ausentismo</span><span class="py__res-val">{{ analytics.headline.absentDays }} días</span></div>
          <div class="py__res-item"><span class="py__res-label">Rotación</span><span class="py__res-val">{{ analytics.headline.turnoverRate }}%</span></div>
          <div class="py__res-item"><span class="py__res-label">Productividad</span><span class="py__res-val">{{ analytics.headline.productivityIndex }}%</span></div>
        </div>

        <div class="employee-grid">
          <div class="employee-card">
            <div class="ec-top"><div class="ec-name">Horas extra</div><div class="ec-pos">Carga adicional del período</div></div>
            <div class="ec-info">
              <div class="ec-row"><span class="material-symbols-outlined">schedule</span><span>{{ analytics.overtime.hours }} horas</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">groups</span><span>{{ analytics.overtime.employees }} empleados</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">assignment</span><span>{{ analytics.overtime.incidents }} incidencias</span></div>
            </div>
          </div>
          <div class="employee-card">
            <div class="ec-top"><div class="ec-name">Ausentismo</div><div class="ec-pos">Licencias, incapacidades y vacaciones</div></div>
            <div class="ec-info">
              <div class="ec-row"><span class="material-symbols-outlined">event_busy</span><span>{{ analytics.absenteeism.days }} días</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">medical_services</span><span>{{ analytics.absenteeism.sickLeaves }} incapacidades</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">beach_access</span><span>{{ analytics.absenteeism.vacations }} vacaciones</span></div>
            </div>
          </div>
          <div class="employee-card">
            <div class="ec-top"><div class="ec-name">Rotación</div><div class="ec-pos">Ingresos y retiros del período</div></div>
            <div class="ec-info">
              <div class="ec-row"><span class="material-symbols-outlined">person_add</span><span>{{ analytics.rotation.admissions }} ingresos</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">person_remove</span><span>{{ analytics.rotation.terminations }} retiros</span></div>
              <div class="ec-row"><span class="material-symbols-outlined">moving</span><span>{{ analytics.rotation.netChange }} variación neta</span></div>
            </div>
          </div>
        </div>

        <section class="content-shell">
          <div class="content-shell__head">
            <div><p class="content-shell__kicker">Costo laboral</p><h3>Sede, área y centro de costo</h3></div>
          </div>
          <div class="employee-grid">
            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Por sucursal</div></div>
              <div class="table-card" style="margin-top:12px">
                <table class="data-table">
                  <thead><tr><th>Sucursal</th><th>Empleados</th><th>Costo</th></tr></thead>
                  <tbody>
                    @for (row of analytics.costByBranch; track row.branchName) {
                      <tr><td>{{ row.branchName }}</td><td>{{ row.employees }}</td><td>{{ row.totalLaborCost | currency:'COP':'symbol':'1.0-0' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Por área / cargo</div></div>
              <div class="table-card" style="margin-top:12px">
                <table class="data-table">
                  <thead><tr><th>Área</th><th>Empleados</th><th>Costo</th></tr></thead>
                  <tbody>
                    @for (row of analytics.costByArea; track row.area) {
                      <tr><td>{{ row.area }}</td><td>{{ row.employees }}</td><td>{{ row.totalLaborCost | currency:'COP':'symbol':'1.0-0' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="employee-card">
              <div class="ec-top"><div class="ec-name">Por centro de costo</div></div>
              <div class="table-card" style="margin-top:12px">
                <table class="data-table">
                  <thead><tr><th>Centro</th><th>Registros</th><th>Costo</th></tr></thead>
                  <tbody>
                    @for (row of analytics.costByCostCenter; track row.costCenter) {
                      <tr><td>{{ row.costCenter }}</td><td>{{ row.records }}</td><td>{{ row.totalLaborCost | currency:'COP':'symbol':'1.0-0' }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section class="content-shell">
          <div class="content-shell__head">
            <div><p class="content-shell__kicker">Tendencias</p><h3>Evolución de costo, neto, ausentismo y headcount</h3></div>
          </div>
          <div class="table-card">
            <table class="data-table">
              <thead><tr><th>Período</th><th>Costo laboral</th><th>Neto</th><th>Horas extra</th><th>Ausentismo</th><th>Headcount</th></tr></thead>
              <tbody>
                @for (row of analytics.trends; track row.period) {
                  <tr>
                    <td>{{ row.period }}</td>
                    <td>{{ row.totalLaborCost | currency:'COP':'symbol':'1.0-0' }}</td>
                    <td>{{ row.totalNetPay | currency:'COP':'symbol':'1.0-0' }}</td>
                    <td>{{ row.overtimeHours }}</td>
                    <td>{{ row.absentDays }}</td>
                    <td>{{ row.headcount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (activeTab() === 'enterprise') {
        <section class="filters-shell">
          <div class="filters-bar">
            <div class="filters-bar__controls">
              <div class="form-group-inline">
                <label class="form-label-sm">Gobierno enterprise</label>
                <span class="badge badge--soft">RRHH + Nómina + Contabilidad</span>
              </div>
            </div>
            <div class="filter-chips">
              <button class="chip chip--active" type="button" [disabled]="loadingEnterprise()" (click)="refreshPayrollEnterpriseOverview()">
                {{ loadingEnterprise() ? 'Actualizando...' : 'Actualizar' }}
              </button>
              <button class="chip" type="button" (click)="startNewEnterpriseRule()">Nueva regla</button>
            </div>
          </div>
        </section>

        @if (enterpriseOverview(); as enterprise) {
          <div class="py__resumen">
            <div class="py__res-item"><span class="py__res-label">Reglas activas</span><span class="py__res-val py__res-val--hl">{{ enterprise.segregationSummary.activeRules }}</span></div>
            <div class="py__res-item"><span class="py__res-label">Segregadas</span><span class="py__res-val">{{ enterprise.segregationSummary.segregatedRules }}</span></div>
            <div class="py__res-item"><span class="py__res-label">Revisión contable</span><span class="py__res-val">{{ enterprise.segregationSummary.accountingReviewedRules }}</span></div>
            <div class="py__res-item"><span class="py__res-label">Cola DIAN</span><span class="py__res-val">{{ enterprise.metrics.pendingDianJobs + enterprise.metrics.failedDianJobs }}</span></div>
            <div class="py__res-item"><span class="py__res-label">Aprobaciones</span><span class="py__res-val">{{ enterprise.metrics.pendingBatchApprovals + enterprise.metrics.pendingRecordApprovals }}</span></div>
            <div class="py__res-item"><span class="py__res-label">Integración contable</span><span class="py__res-val">{{ enterprise.metrics.accountingPending + enterprise.metrics.accountingFailed }}</span></div>
          </div>

          <section class="content-shell">
            <div class="content-shell__head">
              <div><p class="content-shell__kicker">Reglas por empresa y sucursal</p><h3>Segregación de funciones y operación compartida</h3></div>
            </div>
            <div class="employee-grid">
              <div #enterpriseFormCard class="employee-card enterprise-form-card">
                <div class="ec-top"><div class="ec-name">{{ editingEnterpriseRuleId() ? 'Editar regla enterprise' : 'Nueva regla enterprise' }}</div><div class="ec-pos">Controla quién puede aprobar, cerrar, transmitir y provisionar</div></div>
                <div class="enterprise-form-grid" style="margin-top:12px">
                  <div class="field"><label>Área</label><select [(ngModel)]="enterpriseForm.processArea"><option value="HR">RRHH</option><option value="PAYROLL">Nómina</option><option value="ACCOUNTING">Contabilidad</option><option value="SHARED">Compartida</option></select></div>
                  <div class="field"><label>Acción</label><input #enterpriseActionInput [(ngModel)]="enterpriseForm.actionType" placeholder="SUBMIT_DIAN" /></div>
                  <div class="field field--span-2"><label>Política</label><input [(ngModel)]="enterpriseForm.policyName" placeholder="Segregación envío DIAN" /></div>
                  <div class="field"><label>Sucursal</label><select [(ngModel)]="enterpriseForm.branchId"><option value="">Empresa completa</option>@for (branch of branches(); track branch.id) {<option [value]="branch.id">{{ branch.name }}</option>}</select></div>
                  <div class="field"><label>Roles permitidos</label><input [(ngModel)]="enterpriseForm.allowedRolesText" placeholder="ADMIN, MANAGER, CONTADOR" /></div>
                  <div class="field"><label>Áreas compartidas</label><input [(ngModel)]="enterpriseForm.sharedWithAreasText" placeholder="HR, ACCOUNTING" /></div>
                  <div class="field field--span-2"><label>Notas</label><input [(ngModel)]="enterpriseForm.notes" placeholder="Observaciones operativas o de control interno" /></div>
                </div>
                <div class="enterprise-toggle-grid" style="margin-top:12px">
                  <label class="toggle-chip"><input type="checkbox" [(ngModel)]="enterpriseForm.requireDifferentActors" /> Segregación de actores</label>
                  <label class="toggle-chip"><input type="checkbox" [(ngModel)]="enterpriseForm.requireBranchScope" /> Exigir sucursal</label>
                  <label class="toggle-chip"><input type="checkbox" [(ngModel)]="enterpriseForm.requireAccountingReview" /> Exigir revisión contable</label>
                  <label class="toggle-chip"><input type="checkbox" [(ngModel)]="enterpriseForm.isActive" /> Regla activa</label>
                </div>
                <div class="enterprise-form-actions" style="margin-top:12px">
                  <button class="btn btn--primary" type="button" [disabled]="savingEnterprise()" (click)="saveEnterpriseRule()">{{ editingEnterpriseRuleId() ? 'Actualizar regla' : 'Guardar regla' }}</button>
                  <button class="btn btn--secondary" type="button" (click)="startNewEnterpriseRule()">Limpiar</button>
                </div>
              </div>

              <div class="employee-card">
                <div class="ec-top"><div class="ec-name">Cobertura por sucursal</div><div class="ec-pos">Qué sedes usan reglas propias y cuáles heredan defaults</div></div>
                <div class="table-card" style="margin-top:12px">
                  <table class="data-table">
                    <thead><tr><th>Sucursal</th><th>Reglas propias</th><th>Usa defaults</th></tr></thead>
                    <tbody>
                      @for (row of enterprise.branchCoverage; track row.branchId) {
                        <tr><td>{{ row.branchName }}</td><td>{{ row.hasRules ? 'Sí' : 'No' }}</td><td>{{ row.usesCompanyDefaults ? 'Sí' : 'No' }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section class="content-shell">
            <div class="content-shell__head">
              <div><p class="content-shell__kicker">Operación compartida</p><h3>Tablero entre RRHH, nómina y contabilidad</h3></div>
            </div>
            <div class="employee-grid">
              @for (item of enterprise.sharedBoard; track item.title) {
                <div class="employee-card">
                  <div class="ec-top"><div class="ec-name">{{ item.title }}</div><div class="ec-pos">{{ item.area }}</div></div>
                  <div class="ec-info">
                    <div class="ec-row"><span class="material-symbols-outlined">assignment</span><span>{{ item.count }} pendientes</span></div>
                    <div class="ec-row"><span class="material-symbols-outlined">hub</span><span>{{ item.actionHint }}</span></div>
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="content-shell">
            <div class="content-shell__head">
              <div><p class="content-shell__kicker">Matriz de control</p><h3>Reglas enterprise activas</h3></div>
            </div>
            <div class="table-card">
              <table class="data-table">
                <thead><tr><th>Área</th><th>Acción</th><th>Política</th><th>Sucursal</th><th>Roles</th><th>Controles</th><th></th></tr></thead>
                <tbody>
                  @for (rule of enterprise.rules; track rule.id) {
                    <tr>
                      <td>{{ rule.processArea }}</td>
                      <td>{{ rule.actionType }}</td>
                      <td>{{ rule.policyName }}</td>
                      <td>{{ rule.branch?.name ?? 'Empresa' }}</td>
                      <td>{{ (rule.allowedRoles ?? []).join(', ') || 'Sin restricción' }}</td>
                      <td>
                        {{ rule.requireDifferentActors ? 'Segregación' : 'Sin segregación' }}
                        @if (rule.requireAccountingReview) { · Revisión contable }
                        @if (rule.requireBranchScope) { · Sucursal obligatoria }
                      </td>
                      <td><button class="btn-icon btn-icon--primary" type="button" title="Editar regla" (click)="editEnterpriseRule(rule)"><span class="material-symbols-outlined">edit</span></button></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </div><!-- /.py -->

    @if (showOperationsModal()) {
      <div class="modal-overlay" (click)="closeOperationsModal()">
        <div class="modal modal--xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Resiliencia operativa de nómina electrónica</h3>
            <button class="modal-close" (click)="closeOperationsModal()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <div class="invoice-inline-banner">
              Monitorea cola técnica DIAN, reprocesos por documento o lote y trazabilidad operativa de la nómina electrónica.
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">Acción masiva</label>
                <select [(ngModel)]="operationsForm.actionType" class="form-control">
                  <option value="SUBMIT_DIAN">Enviar a DIAN</option>
                  <option value="QUERY_DIAN_STATUS">Consultar estado DIAN</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Lote</label>
                <select [(ngModel)]="operationsForm.payrollBatchId" class="form-control">
                  <option value="">Periodo actual / automático</option>
                  @for (batch of payrollBatches(); track batch.id) {
                    <option [value]="batch.id">{{ batch.name }} · {{ batch.period }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">&nbsp;</label>
                <button class="btn btn--secondary" style="width:100%" [disabled]="savingOperations()" (click)="queueBulkPayrollReprocess()">
                  {{ savingOperations() ? 'Procesando...' : 'Colar reproceso masivo' }}
                </button>
              </div>
            </div>

            @if (operationsMonitor()) {
              <div class="invoice-collection-grid">
                <div class="invoice-collection-kpi"><span>Cola pendiente</span><strong>{{ operationsMonitor()!.queue.pending }}</strong></div>
                <div class="invoice-collection-kpi"><span>Fallidos</span><strong>{{ operationsMonitor()!.queue.failed }}</strong></div>
                <div class="invoice-collection-kpi"><span>Procesados</span><strong>{{ operationsMonitor()!.queue.success }}</strong></div>
                <div class="invoice-collection-kpi"><span>Lotes monitoreados</span><strong>{{ operationsMonitor()!.batches.length }}</strong></div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Cola técnica por documento</div>
                <div class="dw-card">
                  <div class="form-row-3" style="margin-bottom:12px">
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn--secondary" style="width:100%" [disabled]="loadingOperations() || savingOperations()" (click)="loadPayrollOperationsMonitor()">
                        {{ loadingOperations() ? 'Actualizando...' : 'Actualizar monitor' }}
                      </button>
                    </div>
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn--secondary" style="width:100%" [disabled]="savingOperations()" (click)="processQueuedPayrollOperations()">
                        Ejecutar cola pendiente
                      </button>
                    </div>
                    <div class="form-group">
                      <label>&nbsp;</label>
                      <button class="btn btn--secondary" style="width:100%" [disabled]="savingOperations() || !selectedRecord()" (click)="queueSinglePayrollReprocess('QUERY_DIAN_STATUS')">
                        Reprocesar documento abierto
                      </button>
                    </div>
                  </div>
                  <div class="invoice-mini-list">
                    @for (job of operationsMonitor()!.queue.recent.slice(0, 10); track job.id) {
                      <div class="invoice-mini-row">
                        <span>{{ payrollDianActionLabel(job.actionType) }} · {{ job.payrollRecord?.payrollNumber || 'Sin número' }} · {{ job.payrollBatch?.name || 'Sin lote' }}</span>
                        <strong>{{ payrollDianJobStatusLabel(job.status) }}</strong>
                      </div>
                    }
                    @if (operationsMonitor()!.queue.recent.length === 0) {
                      <div class="dw-items-empty">No hay movimientos recientes en la cola DIAN de nómina.</div>
                    }
                  </div>
                </div>
              </div>

              <div class="dw-section" style="padding:0">
                <div class="dw-section-title">Lotes y monitoreo técnico</div>
                <div class="table-card">
                  <table class="data-table">
                    <thead><tr><th>Lote</th><th>Estado</th><th>Generados</th><th>Pendientes</th><th>Fallidos</th><th>Procesados</th></tr></thead>
                    <tbody>
                      @for (batch of operationsMonitor()!.batches; track batch.id) {
                        <tr>
                          <td>{{ batch.name }}</td>
                          <td><span class="badge badge--neutral">{{ batch.status }}</span></td>
                          <td>{{ batch.generatedRecords }}</td>
                          <td>{{ batch.pendingJobs }}</td>
                          <td>{{ batch.failedJobs }}</td>
                          <td>{{ batch.successJobs }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary" (click)="closeOperationsModal()">Cerrar</button>
          </div>
        </div>
      </div>
    }

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
                  <div class="dw-pay-row"><span>Salud</span><span>{{ r.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Pensión</span><span>{{ r.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>ARL</span><span>{{ r.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Caja comp.</span><span>{{ r.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>SENA</span><span>{{ r.senaEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>ICBF</span><span>{{ r.icbfEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
              </div>

              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 2a1 1 0 011 1v1.07A7.002 7.002 0 0117 11a7 7 0 11-8-6.93V3a1 1 0 011-1z"/></svg>
                  Bases y conciliación social
                </div>
                <div class="dw-pay-table">
                  <div class="dw-pay-row"><span>Base salud</span><span>{{ r.healthBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Base pensión</span><span>{{ r.pensionBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Base ARL</span><span>{{ r.arlBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Base caja</span><span>{{ r.compensationBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Base SENA</span><span>{{ r.senaBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                  <div class="dw-pay-row"><span>Base ICBF</span><span>{{ r.icbfBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                </div>
                @if (r.socialSecuritySnapshot?.warnings?.length) {
                  <div class="nae-warning" style="margin-top:10px">
                    <span class="material-symbols-outlined">warning</span>
                    <div>{{ r.socialSecuritySnapshot?.warnings?.join('. ') }}</div>
                  </div>
                }
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

              @if (r.payrollPolicy || r.payrollCalendar || r.payrollTypeConfig || r.conceptLines?.length) {
                <div class="dw-section">
                  <div class="dw-section-title">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M4 5a2 2 0 012-2h8a2 2 0 012 2v2H4V5zm0 4h12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"/></svg>
                    Parametrización aplicada
                  </div>
                  <div class="dw-card">
                    @if (r.payrollTypeConfig?.name) { <div class="dw-pay-row"><span>Tipo</span><span>{{ r.payrollTypeConfig?.name }}</span></div> }
                    @if (r.payrollCalendar?.name) { <div class="dw-pay-row"><span>Calendario</span><span>{{ r.payrollCalendar?.name }}</span></div> }
                    @if (r.payrollPolicy?.name) { <div class="dw-pay-row"><span>Política</span><span>{{ r.payrollPolicy?.name }}</span></div> }
                    @if (r.conceptLines?.length) {
                      <div class="dw-pay-row dw-pay-total"><span>Conceptos aplicados</span><span>{{ r.conceptLines?.length }}</span></div>
                      @for (line of r.conceptLines ?? []; track line.id) {
                        <div class="dw-pay-row"><span>{{ line.name }}</span><span>{{ line.amount | currency:'COP':'symbol':'1.0-0' }}</span></div>
                      }
                    }
                  </div>
                </div>
              }

              @if (r.novelties?.length) {
                <div class="dw-section">
                  <div class="dw-section-title">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V8l-5-5H5z"/></svg>
                    Novedades aplicadas
                  </div>
                  <div class="dw-card">
                    @for (novelty of r.novelties ?? []; track novelty.id) {
                      <div class="dw-pay-row">
                        <span>{{ noveltyTypeLabel(novelty.type) }}</span>
                        <span>{{ novelty.amount ? (novelty.amount | currency:'COP':'symbol':'1.0-0') : (novelty.hours || novelty.days || novelty.quantity || 0) }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 2 3 5v5c0 4.42 2.99 8.52 7 9 4.01-.48 7-4.58 7-9V5l-7-3z"/></svg>
                  Gobierno y aprobaciones
                </div>
                <div class="dw-card">
                  @if (loadingRecordGovernance()) {
                    <div class="dw-pay-row"><span>Cargando flujo de control interno…</span><span>…</span></div>
                  } @else {
                    @if (recordApprovalFlow().length) {
                      @for (approval of recordApprovalFlow(); track approval.id) {
                        <div class="dw-pay-row" style="align-items:flex-start">
                          <div style="display:flex;flex-direction:column;gap:4px">
                            <strong style="font-size:12px;color:#0f172a">{{ approvalActionLabel(approval.actionType) }}</strong>
                            <span style="font-size:11px;color:#64748b">{{ approval.requestedByName || 'Sin solicitante' }} · {{ approval.requestedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                            @if (approval.reason) { <span style="font-size:11px;color:#475569">{{ approval.reason }}</span> }
                            @if (approval.rejectedReason) { <span style="font-size:11px;color:#b91c1c">{{ approval.rejectedReason }}</span> }
                          </div>
                          <span class="badge" [ngClass]="{
                            'badge--submit': approval.status === 'PENDING',
                            'badge--accept': approval.status === 'APPROVED',
                            'badge--reject': approval.status === 'REJECTED'
                          }">{{ approvalStatusLabel(approval.status) }}</span>
                        </div>
                      }
                    } @else {
                      <div class="dw-pay-row"><span>Sin aprobaciones registradas</span><span>—</span></div>
                    }
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                      @if (canSubmit() && r.status === 'DRAFT') {
                        <button class="btn btn--sm btn--secondary" (click)="requestRecordApproval(r, 'SUBMIT')">Solicitar envío</button>
                      }
                      @if (canVoid() && r.status !== 'VOIDED' && r.status !== 'ACCEPTED') {
                        <button class="btn btn--sm btn--secondary" (click)="requestRecordApproval(r, 'VOID')">Solicitar anulación</button>
                      }
                      @if (canSubmit() && latestRecordApproval()?.status === 'PENDING') {
                        <button class="btn btn--sm btn--primary" (click)="approveRecordApproval(r)">Aprobar</button>
                        <button class="btn btn--sm btn--danger" (click)="rejectRecordApproval(r)">Rechazar</button>
                      }
                    </div>
                  }
                </div>
              </div>

              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-5-5H4z"/></svg>
                  Adjuntos y soportes
                </div>
                <div class="dw-card">
                  @if (recordAttachments().length) {
                    @for (attachment of recordAttachments(); track attachment.id) {
                      <div class="dw-pay-row" style="align-items:flex-start">
                        <div style="display:flex;flex-direction:column;gap:4px">
                          <strong style="font-size:12px;color:#0f172a">{{ attachment.fileName }}</strong>
                          <span style="font-size:11px;color:#64748b">{{ attachment.category || 'SOPORTE' }} · {{ attachment.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                          @if (attachment.notes) { <span style="font-size:11px;color:#475569">{{ attachment.notes }}</span> }
                        </div>
                        <a class="btn btn--sm btn--secondary" [href]="attachment.fileUrl" target="_blank" rel="noopener">Abrir</a>
                      </div>
                    }
                  } @else {
                    <div class="dw-pay-row"><span>Sin soportes adjuntos</span><span>—</span></div>
                  }
                  <div style="margin-top:10px">
                    <button class="btn btn--sm btn--secondary" (click)="addRecordAttachment(r)">Adjuntar soporte</button>
                  </div>
                </div>
              </div>

              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M4 4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"/></svg>
                  Bitácora visible
                </div>
                <div class="dw-card">
                  @if (recordAuditTrail().length) {
                    @for (item of recordAuditTrail(); track item.id) {
                      <div class="dw-pay-row" style="align-items:flex-start">
                        <div style="display:flex;flex-direction:column;gap:4px">
                          <strong style="font-size:12px;color:#0f172a">{{ item.action }}</strong>
                          <span style="font-size:11px;color:#64748b">{{ item.userName || 'Sistema' }} · {{ item.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                        </div>
                        <span class="badge badge--neutral">{{ item.resource }}</span>
                      </div>
                    }
                  } @else {
                    <div class="dw-pay-row"><span>Sin eventos registrados</span><span>—</span></div>
                  }
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
              <button class="btn btn--sm btn--secondary" (click)="openPayrollReceipt(r)" title="Imprimir comprobante de pago">
                <span class="material-symbols-outlined" style="font-size:14px">receipt</span>
                Comprobante
              </button>
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
                <button class="btn btn--sm btn--secondary" (click)="reversePayrollControlled(r, 'Reemplazar')">
                  <span class="material-symbols-outlined" style="font-size:14px">shield_lock</span>
                  Reverso ctrl.
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
                    <label class="form-label">Sucursal</label>
                    <select class="form-control" [(ngModel)]="payrollForm.branchId" (ngModelChange)="recalculate()">
                      <option value="">Automática por empleado</option>
                      @for (branch of branches(); track branch.id) {
                        <option [value]="branch.id">{{ branch.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tipo de nómina</label>
                    <select class="form-control" [(ngModel)]="payrollForm.payrollTypeConfigId" (ngModelChange)="recalculate()">
                      <option value="">Default</option>
                      @for (type of payrollTypeConfigs(); track type.id) {
                        <option [value]="type.id">{{ type.name }} · {{ type.category }}</option>
                      }
                    </select>
                  </div>
                </div>
                <div class="form-row-2">
                  <div class="form-group">
                    <label class="form-label">Calendario</label>
                    <select class="form-control" [(ngModel)]="payrollForm.payrollCalendarId">
                      <option value="">Default</option>
                      @for (calendar of payrollCalendars(); track calendar.id) {
                        <option [value]="calendar.id">{{ calendar.name }} · {{ calendar.frequency }}</option>
                      }
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Política laboral</label>
                    <select class="form-control" [(ngModel)]="payrollForm.payrollPolicyId" (ngModelChange)="recalculate()">
                      <option value="">Default</option>
                      @for (policy of payrollPolicies(); track policy.id) {
                        <option [value]="policy.id">{{ policy.name }}</option>
                      }
                    </select>
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

                <div class="form-section-title">Conceptos parametrizables</div>
                <div class="ec-info" style="margin-bottom:10px">
                  @for (line of payrollForm.conceptLines; track $index) {
                    <div class="form-grid" style="margin-bottom:10px">
                      <div>
                        <label class="form-label">Concepto</label>
                        <select class="form-control" [(ngModel)]="line.conceptId" (ngModelChange)="onConceptSelected($index)">
                          <option value="">Seleccionar…</option>
                          @for (concept of payrollConcepts(); track concept.id) {
                            <option [value]="concept.id">{{ concept.code }} · {{ concept.name }}</option>
                          }
                        </select>
                      </div>
                      <div>
                        <label class="form-label">Cantidad</label>
                        <input type="number" class="form-control" [(ngModel)]="line.quantity" (ngModelChange)="recalculate()" />
                      </div>
                      <div>
                        <label class="form-label">Tasa</label>
                        <input type="number" class="form-control" [(ngModel)]="line.rate" (ngModelChange)="recalculate()" />
                      </div>
                      <div>
                        <label class="form-label">Monto</label>
                        <input type="number" class="form-control" [(ngModel)]="line.amount" (ngModelChange)="recalculate()" />
                      </div>
                    </div>
                    <button class="btn btn--ghost btn--sm" type="button" (click)="removeConceptLine($index)">Quitar concepto</button>
                  }
                </div>
                <button class="btn btn--secondary btn--sm" type="button" (click)="addConceptLine()">Agregar concepto</button>
                @if (pendingNoveltiesForForm().length) {
                  <div class="dw-card" style="margin-top:12px">
                    <div class="dw-section-title" style="margin-bottom:8px">Novedades pendientes del período</div>
                    @for (novelty of pendingNoveltiesForForm(); track novelty.id) {
                      <div class="dw-pay-row">
                        <span>{{ noveltyTypeLabel(novelty.type) }}</span>
                        <span>{{ novelty.amount ? (novelty.amount | currency:'COP':'symbol':'1.0-0') : (novelty.hours || novelty.days || novelty.quantity || 0) }}</span>
                      </div>
                    }
                  </div>
                }
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
                    @if (preview()!.conceptLines?.length) {
                      <div class="py__pr py__pr--head">Conceptos</div>
                      @for (line of preview()!.conceptLines; track line.code + '-' + $index) {
                        <div class="py__pr"><span>{{ line.name }}</span><span>{{ line.amount | currency:'COP':'symbol':'1.0-0' }}</span></div>
                      }
                    }
                    <div class="py__pr py__pr--head">Deducciones empleado</div>
                    <div class="py__pr"><span>Salud 4%</span><span>{{ preview()!.healthEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Pensión 4%</span><span>{{ preview()!.pensionEmployee | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--sub"><span>Total deducciones</span><span class="text-danger">{{ preview()!.totalDeductions | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--head">Aportes empleador</div>
                    <div class="py__pr"><span>Salud</span><span>{{ preview()!.healthEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Pensión</span><span>{{ preview()!.pensionEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>ARL</span><span>{{ preview()!.arl | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Caja comp.</span><span>{{ preview()!.compensationFund | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>SENA</span><span>{{ preview()!.senaEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>ICBF</span><span>{{ preview()!.icbfEmployer | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr py__pr--head">Bases de liquidación</div>
                    <div class="py__pr"><span>Base salud</span><span>{{ preview()!.healthBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Base pensión</span><span>{{ preview()!.pensionBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    <div class="py__pr"><span>Base parafiscal</span><span>{{ preview()!.compensationBase | currency:'COP':'symbol':'1.0-0' }}</span></div>
                    @if (preview()!.warnings?.length) {
                      <div class="nae-warning" style="margin-top:8px">
                        <span class="material-symbols-outlined">warning</span>
                        <div>{{ preview()!.warnings.join('. ') }}</div>
                      </div>
                    }
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

    @if (showEmployeeDetail() && selectedEmployee(); as emp) {
      <div class="drawer-overlay" (click)="showEmployeeDetail.set(false)">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-header-left">
              <div class="drawer-emp-name">{{ emp.firstName }} {{ emp.lastName }}</div>
              <div class="drawer-inv-meta">
                <span class="drawer-date">{{ contractLabel(emp.contractType) }}</span>
                <span class="drawer-dot">·</span>
                <span class="drawer-date">{{ emp.position }}</span>
              </div>
            </div>
            <div class="drawer-header-right">
              <button class="drawer-close" (click)="showEmployeeDetail.set(false)" title="Cerrar">
                <svg viewBox="0 0 20 20" fill="currentColor" width="17"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          </div>
          <div class="drawer-body">
            <div class="dw-section">
              <div class="dw-section-title">Resumen laboral actual</div>
              <div class="dw-card">
                <div class="dw-pay-row"><span>Salario base</span><span>{{ emp.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span></div>
                <div class="dw-pay-row"><span>Fecha ingreso</span><span>{{ emp.hireDate | date:'dd/MM/yyyy' }}</span></div>
                <div class="dw-pay-row"><span>Fecha fin</span><span>{{ activeContractEndDate(emp) ? (activeContractEndDate(emp)! | date:'dd/MM/yyyy') : 'Abierto' }}</span></div>
              </div>
              <div class="ec-actions" style="margin-top:12px">
                <button class="btn btn--secondary btn--sm" type="button" (click)="extendEmployeeContract(emp)">Prórroga</button>
                <button class="btn btn--secondary btn--sm" type="button" (click)="registerEmploymentChange(emp)">Cambio laboral</button>
                <button class="btn btn--primary btn--sm" type="button" (click)="createEmployeeFinalSettlement(emp)">Liquidación final</button>
              </div>
            </div>
            <div class="dw-section">
              <div class="dw-section-title">Historial contractual</div>
              <div class="dw-card">
                @for (contract of emp.payrollContracts ?? []; track contract.id) {
                  <div class="dw-pay-row">
                    <span>V{{ contract.version }} · {{ contractLabel(contract.contractType) }} · {{ contract.position }}</span>
                    <span>{{ contract.baseSalary | currency:'COP':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="dw-pay-row" style="font-size:12px;color:#64748b">
                    <span>{{ contract.startDate | date:'dd/MM/yyyy' }} - {{ contract.endDate ? (contract.endDate | date:'dd/MM/yyyy') : 'Abierto' }}</span>
                    <span>{{ contract.status }}</span>
                  </div>
                }
              </div>
            </div>
            <div class="dw-section">
              <div class="dw-section-title">Eventos laborales</div>
              <div class="dw-card">
                @for (event of emp.employmentEvents ?? []; track event.id) {
                  <div class="dw-pay-row">
                    <span>{{ employmentEventLabel(event.eventType) }}</span>
                    <span>{{ event.effectiveDate | date:'dd/MM/yyyy' }}</span>
                  </div>
                  @if (event.description) {
                    <div class="dw-pay-row" style="font-size:12px;color:#64748b">
                      <span>{{ event.description }}</span><span>{{ event.branch?.name || 'General' }}</span>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }

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
              <div class="form-group"><label class="form-label">Fecha fin contrato</label><input type="date" class="form-control" [(ngModel)]="empForm.contractEndDate" /></div>
              <div class="form-group"></div>
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

    /* ── Module Navigation ─────────────────────────────────────────────── */
    .tabs-shell {
      margin-bottom:18px;
      border-radius:28px;
      padding:20px;
      background:linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(247,251,255,.96) 100%);
      border:1px solid #dce6f0;
      box-shadow:0 20px 36px rgba(12,28,53,.06);
    }
    .tabs-shell__head {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:18px;
      margin-bottom:18px;
    }
    .tabs-shell__eyebrow {
      display:block;
      margin-bottom:6px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#00a084;
    }
    .tabs-shell__head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:22px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .tabs-shell__head p {
      margin:0;
      max-width:56ch;
      font-size:13px;
      line-height:1.6;
      color:#6b7f96;
      text-align:right;
    }
    .tabs-groups {
      display:grid;
      gap:16px;
    }
    .tab-group {
      padding:16px;
      border-radius:22px;
      border:1px solid #e3ecf5;
      background:linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(246,250,255,.95) 100%);
    }
    .tab-group--utility {
      background:linear-gradient(180deg, #f7fffc 0%, #effbf7 100%);
      border-color:#cfeee3;
    }
    .tab-group__header {
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .tab-group__label {
      display:block;
      font-size:11px;
      font-weight:800;
      letter-spacing:.12em;
      text-transform:uppercase;
      color:#1a407e;
      margin-bottom:4px;
    }
    .tab-group__header small {
      color:#7a8ea7;
      font-size:12px;
      line-height:1.5;
      text-align:right;
    }
    .tab-grid {
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:12px;
    }
    .tab-grid--compact {
      grid-template-columns:repeat(2, minmax(0, 1fr));
    }
    .tab-btn {
      display:flex;
      align-items:flex-start;
      gap:12px;
      min-height:78px;
      width:100%;
      padding:16px;
      border-radius:18px;
      border:1px solid #dbe5ef;
      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      color:#0c1c35;
      cursor:pointer;
      text-align:left;
      transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
      box-shadow:0 12px 22px rgba(12,28,53,.05);
    }
    .tab-btn .material-symbols-outlined {
      font-size:20px;
      flex-shrink:0;
      color:#1a407e;
      margin-top:2px;
      transition:color .18s ease, transform .18s ease;
    }
    .tab-btn__content {
      display:flex;
      flex-direction:column;
      gap:4px;
      min-width:0;
    }
    .tab-btn__title {
      font-size:14px;
      font-weight:800;
      color:#0c1c35;
      letter-spacing:-.02em;
    }
    .tab-btn__meta {
      font-size:12px;
      line-height:1.5;
      color:#6f8399;
    }
    .tab-btn:hover {
      transform:translateY(-2px);
      border-color:#93c5fd;
      box-shadow:0 18px 30px rgba(26,64,126,.1);
      background:linear-gradient(180deg, #ffffff 0%, #eef6ff 100%);
    }
    .tab-btn:hover .material-symbols-outlined {
      color:#123f7b;
      transform:scale(1.05);
    }
    .tab-btn--active {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 24px 36px rgba(15,39,75,.24);
    }
    .tab-btn--active .tab-btn__title,
    .tab-btn--active .tab-btn__meta {
      color:#f8fbff;
    }
    .tab-btn--active .material-symbols-outlined {
      color:#dffef5;
    }
    .tab-btn--active .tab-btn__meta {
      color:rgba(236,244,255,.82);
    }
    .tab-btn--active:hover {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 28px 40px rgba(15,39,75,.28);
    }
    .tab-btn--utility {
      background:linear-gradient(180deg, #f7fffc 0%, #eefbf6 100%);
    }
    .tab-btn--utility.tab-btn--active,
    .tab-btn--utility.tab-btn--active:hover {
      border-color:#0f274b;
      background:linear-gradient(135deg, #102a4f 0%, #163d73 58%, #00a084 100%);
      box-shadow:0 24px 36px rgba(15,39,75,.24);
    }

    .enterprise-form-card {
      background:linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
      border-color:#d6e4f1;
    }
    .enterprise-form-card .ec-top {
      align-items:flex-start;
      text-align:left;
      padding-bottom:14px;
    }
    .enterprise-form-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:14px;
      padding:16px;
      border-radius:18px;
      border:1px solid #e2ebf3;
      background:linear-gradient(180deg, #fbfdff 0%, #f3f8fd 100%);
    }
    .field {
      display:flex;
      flex-direction:column;
      gap:7px;
      min-width:0;
    }
    .field--span-2 {
      grid-column:span 2;
    }
    .field label {
      font-size:11px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
      color:#60748b;
    }
    .field input,
    .field select {
      width:100%;
      min-height:44px;
      padding:11px 13px;
      border:1px solid #d6e3ef;
      border-radius:12px;
      background:#fff;
      color:#0c1c35;
      font-size:13px;
      outline:none;
      transition:border-color .15s ease, box-shadow .15s ease, background .15s ease;
      box-sizing:border-box;
    }
    .field input:focus,
    .field select:focus {
      border-color:#1a407e;
      box-shadow:0 0 0 3px rgba(26,64,126,.08);
      background:#fcfeff;
    }
    .enterprise-toggle-grid {
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:10px;
    }
    .toggle-chip {
      display:flex;
      align-items:center;
      gap:9px;
      min-height:46px;
      padding:12px 14px;
      border:1px solid #dce6f0;
      border-radius:14px;
      background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      color:#1f3349;
      font-size:12.5px;
      font-weight:600;
      cursor:pointer;
      box-shadow:0 8px 18px rgba(12,28,53,.03);
    }
    .toggle-chip input {
      width:16px;
      height:16px;
      accent-color:#1a407e;
      flex-shrink:0;
    }
    .enterprise-form-actions {
      display:flex;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      padding-top:2px;
    }

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
      .tabs-shell__head { flex-direction:column; align-items:flex-start; }
      .tabs-shell__head p { text-align:left; }
      .tab-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
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
      .tabs-shell,
      .filters-shell { padding:12px; }
      .tab-grid,
      .tab-grid--compact { grid-template-columns:1fr; }
      .enterprise-form-grid,
      .enterprise-toggle-grid { grid-template-columns:1fr; }
      .field--span-2 { grid-column:auto; }
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
  @ViewChild('enterpriseFormCard') private enterpriseFormCardRef?: ElementRef<HTMLElement>;
  @ViewChild('enterpriseActionInput') private enterpriseActionInputRef?: ElementRef<HTMLInputElement>;

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
  showEmployeeDetail = signal(false);
  selectedEmployee = signal<Employee | null>(null);
  banks             = signal<Bank[]>([]);
  branches          = signal<Branch[]>([]);
  accountingAccounts = signal<AccountingAccountOption[]>([]);
  empBranchFilter   = signal('');
  payrollConcepts   = signal<PayrollConcept[]>([]);
  payrollCalendars  = signal<PayrollCalendar[]>([]);
  payrollPolicies   = signal<PayrollPolicy[]>([]);
  payrollTypeConfigs = signal<PayrollTypeConfig[]>([]);
  payrollNovelties   = signal<PayrollNovelty[]>([]);
  payrollBatches     = signal<PayrollBatch[]>([]);
  batchApprovalFlows = signal<Record<string, PayrollApprovalRequest[]>>({});
  periodDashboard    = signal<PayrollPeriodDashboard | null>(null);
  socialSecuritySummary = signal<PayrollSocialSecuritySummary | null>(null);
  socialSecurityReconciliation = signal<PayrollSocialSecurityReconciliation | null>(null);
  accrualSummary = signal<PayrollAccrualSummary | null>(null);
  portalSummary = signal<PayrollPortalSummary | null>(null);
  analyticsSummary = signal<PayrollAnalyticsSummary | null>(null);
  operationsMonitor = signal<PayrollOperationsMonitor | null>(null);
  enterpriseOverview = signal<PayrollEnterpriseOverview | null>(null);
  portalSelectedEmployeeId = signal('');
  analyticsPeriod = signal(new Date().toISOString().slice(0, 7));
  analyticsBranchId = signal('');
  recordApprovalFlow = signal<PayrollApprovalRequest[]>([]);
  recordAttachments = signal<PayrollAttachment[]>([]);
  recordAuditTrail = signal<PayrollAuditTrail[]>([]);
  loadingRecordGovernance = signal(false);
  loadingMasters    = signal(false);
  loadingNovelties  = signal(false);
  loadingOperations = signal(false);
  loadingEnterprise = signal(false);
  savingOperations = signal(false);
  savingEnterprise = signal(false);
  showOperationsModal = signal(false);
  editingEnterpriseRuleId = signal<string | null>(null);

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
  canManageEnterprise   = computed(() => this.hasRole('ADMIN') || this.hasRole('MANAGER') || this.hasRole('CONTADOR'));
  canDeactivateEmployee = computed(() => this.hasRole('ADMIN'));
  activeEmployees       = computed(() => this.employees().filter(e => e.isActive));
  activePayrollConceptCount = computed(() => this.payrollConcepts().filter(item => item.isActive).length);
  acceptedPayrollCount  = computed(() => this.records().filter(r => r.status === 'ACCEPTED').length);
  pendingPayrollCount   = computed(() => this.records().filter(r => ['DRAFT', 'SUBMITTED'].includes(r.status)).length);
  submittedPayrollCount = computed(() => this.records().filter(r => r.status === 'SUBMITTED' || r.status === 'ACCEPTED').length);
  currentNetPay         = computed(() => this.summary()?.totalNetPay ?? this.records().reduce((sum, r) => sum + Number(r.netPay || 0), 0));
  currentEmployerCost   = computed(() => this.summary()?.totalEmployerCost ?? this.records().reduce((sum, r) => sum + Number(r.totalEmployerCost || 0), 0));
  currentParafiscalTotal = computed(() =>
    Number(this.socialSecuritySummary()?.totals.compensationFund ?? this.summary()?.totalCompensationFund ?? 0) +
    Number(this.socialSecuritySummary()?.totals.senaEmployer ?? this.summary()?.totalSena ?? 0) +
    Number(this.socialSecuritySummary()?.totals.icbfEmployer ?? this.summary()?.totalIcbf ?? 0),
  );
  periodClosed          = computed(() => this.periodDashboard()?.control?.status === 'CLOSED');
  masterSummaryCount    = computed(() => this.payrollConcepts().length + this.payrollCalendars().length + this.payrollPolicies().length + this.payrollTypeConfigs().length);
  selectedEmployeeBranchLabel = computed(() => {
    const branchId = this.empBranchFilter();
    if (!branchId) return 'Todas las sucursales';
    const branch = this.branches().find(item => item.id === branchId);
    return branch ? branch.name : 'Sucursal';
  });
  portalSelectedEmployee = computed(() => this.activeEmployees().find(item => item.id === this.portalSelectedEmployeeId()) ?? null);

  payrollForm: any = this.emptyPayrollForm();
  empForm: any     = this.emptyEmpForm();
  ajusteForm: any  = this.emptyAjusteForm();
  conceptForm: any = this.emptyConceptForm();
  calendarForm: any = this.emptyCalendarForm();
  policyForm: any = this.emptyPolicyForm();
  payrollTypeForm: any = this.emptyPayrollTypeForm();
  noveltyForm: any = this.emptyNoveltyForm();
  portalRequestForm: any = this.emptyPortalRequestForm();
  operationsForm: any = this.emptyOperationsForm();
  enterpriseForm: any = this.emptyEnterpriseForm();

  ngOnInit() {
    this.loadRecords();
    this.loadEmployees();
    this.loadBranches();
    this.loadAccountingAccounts();
    this.loadPayrollMasters();
    this.loadPayrollNovelties();
    this.loadPeriodDashboard();
    this.loadSocialSecuritySummary();
    this.loadSocialSecurityReconciliation();
    this.loadAccrualSummary();
    this.loadPortalSummary();
    this.loadPayrollAnalyticsSummary();
    this.loadPayrollEnterpriseOverview();
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

  loadPayrollMasters() {
    this.loadingMasters.set(true);
    this.http.get<any>(`${this.api}/masters`).subscribe({
      next: res => {
        const data = res?.data ?? res ?? {};
        this.payrollConcepts.set(data.concepts ?? []);
        this.payrollCalendars.set(data.calendars ?? []);
        this.payrollPolicies.set(data.policies ?? []);
        this.payrollTypeConfigs.set(data.payrollTypes ?? []);
        this.loadingMasters.set(false);
      },
      error: () => {
        this.loadingMasters.set(false);
        this.notify.error('Error al cargar los maestros de nómina');
      },
    });
  }

  loadPayrollNovelties() {
    this.loadingNovelties.set(true);
    const params: any = {};
    if (this.periodFilter) params.period = this.periodFilter;
    this.http.get<any>(`${this.api}/novelties`, { params }).subscribe({
      next: res => {
        const data = res?.data ?? res;
        this.payrollNovelties.set(data?.data ?? data ?? []);
        this.loadingNovelties.set(false);
      },
      error: () => {
        this.loadingNovelties.set(false);
        this.notify.error('Error al cargar novedades de nómina');
      },
    });
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
      this.loadPeriodDashboard();
      this.loadPayrollBatches();
      this.loadSocialSecuritySummary();
      this.loadSocialSecurityReconciliation();
      this.loadAccrualSummary();
    }
  }

  loadPayrollBatches() {
    const params: any = {};
    if (this.periodFilter) params.period = this.periodFilter;
    this.http.get<any>(`${this.api}/batches`, { params }).subscribe({
      next: res => {
        const batches = res?.data ?? res ?? [];
        this.payrollBatches.set(batches);
        this.loadBatchApprovalFlows(batches);
      },
      error: () => {},
    });
  }

  loadPeriodDashboard() {
    if (!this.periodFilter) return;
    this.http.get<any>(`${this.api}/period-dashboard/${this.periodFilter}`).subscribe({
      next: res => this.periodDashboard.set(res?.data ?? res),
      error: () => {},
    });
  }

  loadSocialSecuritySummary() {
    if (!this.periodFilter) return;
    this.http.get<any>(`${this.api}/social-security/summary/${this.periodFilter}`).subscribe({
      next: res => this.socialSecuritySummary.set(res?.data ?? res),
      error: () => {},
    });
  }

  loadSocialSecurityReconciliation() {
    if (!this.periodFilter) return;
    this.http.get<any>(`${this.api}/social-security/reconciliation/${this.periodFilter}`).subscribe({
      next: res => this.socialSecurityReconciliation.set(res?.data ?? res),
      error: () => {},
    });
  }

  loadAccrualSummary() {
    if (!this.periodFilter) return;
    this.http.get<any>(`${this.api}/accruals/${this.periodFilter}`).subscribe({
      next: res => this.accrualSummary.set(res?.data ?? res),
      error: () => {},
    });
  }

  loadPortalSummary() {
    const employeeId = this.portalSelectedEmployeeId() || this.activeEmployees()[0]?.id;
    if (!employeeId) return;
    if (!this.portalSelectedEmployeeId()) this.portalSelectedEmployeeId.set(employeeId);
    this.http.get<any>(`${this.api}/portal/employee/${employeeId}`, { params: { period: this.periodFilter } }).subscribe({
      next: res => this.portalSummary.set(res?.data ?? res),
      error: () => this.notify.error('Error cargando portal del empleado'),
    });
  }

  submitPortalRequest() {
    const employeeId = this.portalSelectedEmployeeId();
    if (!employeeId || !this.portalRequestForm.startDate) {
      this.notify.error('Selecciona colaborador y fecha de inicio');
      return;
    }
    this.http.post<any>(`${this.api}/portal/employee/${employeeId}/requests`, this.portalRequestForm).subscribe({
      next: (res) => {
        this.portalSummary.set(res?.data ?? res);
        this.portalRequestForm = this.emptyPortalRequestForm();
        this.notify.success('Solicitud registrada en el portal');
        this.loadPayrollNovelties();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error registrando solicitud'),
    });
  }

  downloadEmploymentCertificate() {
    const employeeId = this.portalSelectedEmployeeId();
    if (!employeeId) return;
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${this.api}/portal/employee/${employeeId}/certificate`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: blob => {
        const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
        const win = window.open(objectUrl, '_blank', 'width=900,height=700,scrollbars=yes');
        if (!win) {
          this.notify.error('No se pudo abrir el certificado. Verifica los pop-ups.');
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error generando certificado'),
    });
  }

  loadPayrollAnalyticsSummary() {
    const params: any = { period: this.analyticsPeriod() };
    if (this.analyticsBranchId()) params.branchId = this.analyticsBranchId();
    this.http.get<any>(`${this.api}/analytics/summary`, { params }).subscribe({
      next: res => this.analyticsSummary.set(res?.data ?? res),
      error: () => this.notify.error('Error cargando analítica de nómina'),
    });
  }

  loadPayrollEnterpriseOverview(showSuccessToast = false) {
    this.loadingEnterprise.set(true);
    this.http.get<any>(`${this.api}/enterprise/overview`).subscribe({
      next: res => {
        this.enterpriseOverview.set(res?.data ?? res);
        this.loadingEnterprise.set(false);
        if (showSuccessToast) {
          this.notify.success('Gobierno enterprise actualizado');
        }
      },
      error: () => {
        this.loadingEnterprise.set(false);
        this.notify.error('Error cargando el gobierno enterprise de nómina');
      },
    });
  }

  refreshPayrollEnterpriseOverview() {
    this.loadPayrollEnterpriseOverview(true);
  }

  editEnterpriseRule(rule: PayrollEnterpriseRule) {
    this.editingEnterpriseRuleId.set(rule.id);
    this.enterpriseForm = {
      processArea: rule.processArea,
      actionType: rule.actionType,
      policyName: rule.policyName,
      branchId: rule.branchId ?? '',
      allowedRolesText: (rule.allowedRoles ?? []).join(', '),
      sharedWithAreasText: (rule.sharedWithAreas ?? []).join(', '),
      requireDifferentActors: !!rule.requireDifferentActors,
      requireBranchScope: !!rule.requireBranchScope,
      requireAccountingReview: !!rule.requireAccountingReview,
      isActive: !!rule.isActive,
      notes: rule.notes ?? '',
    };
    setTimeout(() => {
      this.enterpriseFormCardRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.enterpriseActionInputRef?.nativeElement.focus();
      this.enterpriseActionInputRef?.nativeElement.select();
    }, 0);
  }

  resetEnterpriseForm() {
    this.editingEnterpriseRuleId.set(null);
    this.enterpriseForm = this.emptyEnterpriseForm();
  }

  startNewEnterpriseRule() {
    this.resetEnterpriseForm();
    setTimeout(() => {
      this.enterpriseFormCardRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.enterpriseActionInputRef?.nativeElement.focus();
      this.notify.success('Formulario listo para una nueva regla enterprise');
    }, 0);
  }

  saveEnterpriseRule() {
    const actionType = String(this.enterpriseForm.actionType ?? '').trim().toUpperCase();
    const policyName = String(this.enterpriseForm.policyName ?? '').trim();
    if (!actionType || !policyName) {
      this.notify.error('Define acción y nombre de política');
      return;
    }
    const body: any = {
      processArea: this.enterpriseForm.processArea,
      actionType,
      policyName,
      branchId: this.enterpriseForm.branchId || undefined,
      allowedRoles: this.parseCommaList(this.enterpriseForm.allowedRolesText),
      sharedWithAreas: this.parseCommaList(this.enterpriseForm.sharedWithAreasText),
      requireDifferentActors: !!this.enterpriseForm.requireDifferentActors,
      requireBranchScope: !!this.enterpriseForm.requireBranchScope,
      requireAccountingReview: !!this.enterpriseForm.requireAccountingReview,
      isActive: !!this.enterpriseForm.isActive,
      notes: String(this.enterpriseForm.notes ?? '').trim() || undefined,
    };
    const id = this.editingEnterpriseRuleId();
    const request = id
      ? this.http.put<any>(`${this.api}/enterprise/rules/${id}`, body)
      : this.http.post<any>(`${this.api}/enterprise/rules`, body);
    this.savingEnterprise.set(true);
    request.subscribe({
      next: () => {
        this.savingEnterprise.set(false);
        this.notify.success(id ? 'Regla enterprise actualizada' : 'Regla enterprise creada');
        this.resetEnterpriseForm();
        this.loadPayrollEnterpriseOverview();
      },
      error: e => {
        this.savingEnterprise.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible guardar la regla enterprise');
      },
    });
  }

  openOperationsModal() {
    this.activeTab.set('enterprise');
    this.showOperationsModal.set(true);
    this.loadPayrollOperationsMonitor();
  }

  closeOperationsModal() {
    this.showOperationsModal.set(false);
  }

  loadPayrollOperationsMonitor() {
    this.loadingOperations.set(true);
    const params: any = {};
    if (this.periodFilter) params.period = this.periodFilter;
    this.http.get<any>(`${this.api}/operations/monitor`, { params }).subscribe({
      next: res => {
        this.operationsMonitor.set(res?.data ?? res);
        this.loadingOperations.set(false);
      },
      error: () => {
        this.loadingOperations.set(false);
        this.notify.error('Error cargando el monitor técnico de nómina');
      },
    });
  }

  queueBulkPayrollReprocess() {
    this.savingOperations.set(true);
    const body: any = { actionType: this.operationsForm.actionType };
    if (this.operationsForm.payrollBatchId) body.payrollBatchId = this.operationsForm.payrollBatchId;
    this.http.post<any>(`${this.api}/operations/reprocess`, body).subscribe({
      next: (res) => {
        this.savingOperations.set(false);
        this.notify.success(`Se encolaron ${res?.queued ?? res?.data?.queued ?? 0} reprocesos de nómina`);
        this.loadPayrollOperationsMonitor();
      },
      error: e => {
        this.savingOperations.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible encolar el reproceso masivo');
      },
    });
  }

  processQueuedPayrollOperations() {
    this.savingOperations.set(true);
    this.http.post<any>(`${this.api}/operations/process-queue`, {}).subscribe({
      next: (res) => {
        this.savingOperations.set(false);
        this.notify.success(`Se procesaron ${res?.processed ?? res?.data?.processed ?? 0} trabajos DIAN`);
        this.loadPayrollOperationsMonitor();
        this.loadRecords();
      },
      error: e => {
        this.savingOperations.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible ejecutar la cola técnica');
      },
    });
  }

  queueSinglePayrollReprocess(actionType: 'SUBMIT_DIAN' | 'QUERY_DIAN_STATUS') {
    const record = this.selectedRecord();
    if (!record) {
      this.notify.error('Abre una liquidación para reprocesarla');
      return;
    }
    this.savingOperations.set(true);
    this.http.post<any>(`${this.api}/records/${record.id}/queue-reprocess`, { actionType }).subscribe({
      next: () => {
        this.savingOperations.set(false);
        this.notify.success('Documento encolado para reproceso DIAN');
        this.loadPayrollOperationsMonitor();
      },
      error: e => {
        this.savingOperations.set(false);
        this.notify.error(e?.error?.message ?? 'No fue posible encolar el documento');
      },
    });
  }

  private recordSearchTimer: any;
  private payrollPreviewTimer: any;
  onRecordSearch() { clearTimeout(this.recordSearchTimer); this.recordSearchTimer = setTimeout(() => this.loadRecords(), 350); }

  viewRecord(r: PayrollRecord) {
    this.selectedRecord.set(r);
    this.showRecordDetail.set(true);
    this.loadRecordGovernance(r.id);
  }

  openPayrollModal()  { this.payrollForm = this.emptyPayrollForm(); this.preview.set(null); this.showPayrollModal.set(true); }
  closePayrollModal() { this.showPayrollModal.set(false); }

  preselectEmployee(e: Employee) {
    this.payrollForm = { ...this.emptyPayrollForm(), employeeId: e.id, baseSalary: e.baseSalary, branchId: e.branchId ?? '' };
    this.recalculate();
    this.activeTab.set('records');
    this.showPayrollModal.set(true);
  }

  onEmployeeSelected() {
    const emp = this.activeEmployees().find(e => e.id === this.payrollForm.employeeId);
    if (emp) {
      this.payrollForm.baseSalary = emp.baseSalary;
      this.payrollForm.branchId = emp.branchId ?? '';
      this.recalculate();
    }
  }

  recalculate() {
    if (!this.payrollForm.employeeId || !this.payrollForm.baseSalary) { this.preview.set(null); return; }
    const f = this.payrollForm;
    const selectedPolicy = this.payrollPolicies().find(item => item.id === f.payrollPolicyId)
      ?? this.payrollPolicies().find(item => item.isDefault)
      ?? null;
    const SMMLV    = Number(selectedPolicy?.minimumWageValue ?? 1_300_000);
    const daily    = f.baseSalary / 30;
    const prop     = daily * (f.daysWorked || 30);
    const overtimeFactor = Number(selectedPolicy?.overtimeFactor ?? 1.25);
    const transport = (f.transportAllowance !== undefined && f.transportAllowance !== null && f.transportAllowance !== '')
      ? Number(f.transportAllowance)
      : ((selectedPolicy?.applyAutoTransport ?? true) && f.baseSalary <= SMMLV * Number(selectedPolicy?.transportCapMultiplier ?? 2)
        ? Number(selectedPolicy?.transportAllowanceAmount ?? 162_000)
        : 0);
    const overtime = (f.overtimeHours || 0) * (f.baseSalary / 240) * overtimeFactor;
    const conceptPreview = this.resolvePreviewConceptLines();
    const conceptEarnings = conceptPreview.filter(item => item.nature === 'EARNING').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const conceptDeductions = conceptPreview.filter(item => item.nature === 'DEDUCTION').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const earnings = prop + transport + overtime + (f.bonuses || 0) + (f.commissions || 0) + (f.vacationPay || 0) + conceptEarnings;
    const base     = prop + overtime + (f.bonuses || 0) + (f.commissions || 0) + conceptEarnings;
    const healthBase = Math.min(base, SMMLV * Number(selectedPolicy?.healthCapSmmlv ?? 25));
    const pensionBase = Math.min(base, SMMLV * Number(selectedPolicy?.pensionCapSmmlv ?? 25));
    const parafiscalBase = Math.min(base, SMMLV * Number(selectedPolicy?.parafiscalCapSmmlv ?? 25));
    const hEmp = healthBase * Number(selectedPolicy?.healthEmployeeRate ?? 0.04);
    const pEmp = pensionBase * Number(selectedPolicy?.pensionEmployeeRate ?? 0.04);
    const hEmpr= healthBase * Number(selectedPolicy?.healthEmployerRate ?? 0.085);
    const pEmpr= pensionBase * Number(selectedPolicy?.pensionEmployerRate ?? 0.12);
    const arl  = base * Number(selectedPolicy?.arlRate ?? 0.00522);
    const cf = parafiscalBase * Number(selectedPolicy?.compensationFundRate ?? 0.04);
    const sena = (selectedPolicy?.applySena ?? true) ? parafiscalBase * Number(selectedPolicy?.senaRate ?? 0.02) : 0;
    const icbf = (selectedPolicy?.applyIcbf ?? true) ? parafiscalBase * Number(selectedPolicy?.icbfRate ?? 0.03) : 0;
    const deductions = hEmp + pEmp + (f.sickLeave || 0) + (f.loans || 0) + (f.otherDeductions || 0) + conceptDeductions;
    this.preview.set({
      totalEarnings:    Math.round(earnings),
      healthEmployee:   Math.round(hEmp),   pensionEmployee:  Math.round(pEmp),
      totalDeductions:  Math.round(deductions),
      healthEmployer:   Math.round(hEmpr),  pensionEmployer:  Math.round(pEmpr),
      arl:              Math.round(arl),    compensationFund: Math.round(cf),
      senaEmployer:     Math.round(sena),   icbfEmployer:     Math.round(icbf),
      healthBase:       Math.round(healthBase),
      pensionBase:      Math.round(pensionBase),
      arlBase:          Math.round(base),
      compensationBase: Math.round(parafiscalBase),
      senaBase:         Math.round(parafiscalBase),
      icbfBase:         Math.round(parafiscalBase),
      warnings: [
        ...(base > healthBase ? ['La base de salud fue topada'] : []),
        ...(base > pensionBase ? ['La base de pensión fue topada'] : []),
        ...(base > parafiscalBase ? ['La base parafiscal fue topada'] : []),
      ],
      netPay:           Math.round(earnings - deductions),
      totalEmployerCost:Math.round(earnings + hEmpr + pEmpr + arl + cf + sena + icbf),
      conceptLines: conceptPreview,
      autoTransport: Math.round(transport),
    });
    clearTimeout(this.payrollPreviewTimer);
    this.payrollPreviewTimer = setTimeout(() => {
      this.http.post<any>(`${this.api}/preview`, this.payrollForm).subscribe({
        next: res => this.preview.set(res?.data ?? res),
        error: () => {},
      });
    }, 220);
  }

  downloadPilaExport() {
    if (!this.periodFilter) return;
    this.http.get<any>(`${this.api}/social-security/pila-export/${this.periodFilter}`).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        const blob = new Blob([data?.csv ?? ''], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data?.filename ?? `pila_${this.periodFilter}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.notify.success('Exportación PILA generada');
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error exportando PILA'),
    });
  }

  runPayrollProvisions() {
    if (!this.periodFilter) return;
    this.http.post<any>(`${this.api}/provisions/run`, { period: this.periodFilter }).subscribe({
      next: () => {
        this.notify.success('Provisiones de nómina ejecutadas');
        this.loadAccrualSummary();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error ejecutando provisiones'),
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

  private resolvePreviewConceptLines(): PayrollRecordConceptLine[] {
    const lines: PayrollRecordConceptLine[] = [];
    for (const item of this.payrollForm.conceptLines ?? []) {
      const concept = this.payrollConcepts().find(entry => entry.id === item.conceptId);
      if (!concept) continue;
      const quantity = Number(item.quantity ?? concept.quantityDefault ?? 1);
      const rate = Number(item.rate ?? concept.defaultRate ?? 0);
      let amount = Number(item.amount ?? concept.defaultAmount ?? 0);
      const proportional = Number(this.payrollForm.baseSalary || 0) / 30 * Number(this.payrollForm.daysWorked || 30);
      const overtimeBase = Number(this.payrollForm.baseSalary || 0) / 240;
      switch (concept.formulaType) {
        case 'BASE_SALARY_PERCENT':
          amount = Number(this.payrollForm.baseSalary || 0) * (rate / 100);
          break;
        case 'PROPORTIONAL_SALARY_PERCENT':
          amount = proportional * (rate / 100);
          break;
        case 'OVERTIME_FACTOR':
          amount = Number(item.quantity ?? this.payrollForm.overtimeHours ?? 0) * overtimeBase * Number(item.rate ?? 1.25);
          break;
        default:
          amount = Number(item.amount ?? concept.defaultAmount ?? 0);
      }
      if (!amount) continue;
      lines.push({
        id: concept.id,
        code: concept.code,
        name: concept.name,
        nature: concept.nature,
        formulaType: concept.formulaType,
        quantity,
        rate,
        amount,
        source: 'PREVIEW',
      });
    }
    return lines;
  }

  addConceptLine() {
    this.payrollForm.conceptLines = [...(this.payrollForm.conceptLines ?? []), { conceptId: '', quantity: 1, rate: null, amount: null }];
  }

  removeConceptLine(index: number) {
    this.payrollForm.conceptLines = (this.payrollForm.conceptLines ?? []).filter((_: any, idx: number) => idx !== index);
    this.recalculate();
  }

  onConceptSelected(index: number) {
    const row = this.payrollForm.conceptLines?.[index];
    const concept = this.payrollConcepts().find(item => item.id === row?.conceptId);
    if (!concept || !row) return;
    row.quantity = row.quantity ?? concept.quantityDefault ?? 1;
    row.rate = row.rate ?? concept.defaultRate ?? null;
    row.amount = row.amount ?? concept.defaultAmount ?? null;
    this.recalculate();
  }

  saveConcept() {
    if (!this.conceptForm.code || !this.conceptForm.name) { this.notify.error('Completa código y nombre del concepto'); return; }
    this.http.post<any>(`${this.api}/concepts`, this.conceptForm).subscribe({
      next: () => { this.notify.success('Concepto guardado'); this.conceptForm = this.emptyConceptForm(); this.loadPayrollMasters(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error guardando concepto'),
    });
  }

  saveCalendar() {
    if (!this.calendarForm.code || !this.calendarForm.name) { this.notify.error('Completa código y nombre del calendario'); return; }
    this.http.post<any>(`${this.api}/calendars`, this.calendarForm).subscribe({
      next: () => { this.notify.success('Calendario guardado'); this.calendarForm = this.emptyCalendarForm(); this.loadPayrollMasters(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error guardando calendario'),
    });
  }

  savePolicy() {
    if (!this.policyForm.name) { this.notify.error('Completa el nombre de la política'); return; }
    this.http.post<any>(`${this.api}/policies`, this.policyForm).subscribe({
      next: () => { this.notify.success('Política guardada'); this.policyForm = this.emptyPolicyForm(); this.loadPayrollMasters(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error guardando política'),
    });
  }

  savePayrollType() {
    if (!this.payrollTypeForm.code || !this.payrollTypeForm.name) { this.notify.error('Completa código y nombre del tipo'); return; }
    this.http.post<any>(`${this.api}/types`, this.payrollTypeForm).subscribe({
      next: () => { this.notify.success('Tipo de nómina guardado'); this.payrollTypeForm = this.emptyPayrollTypeForm(); this.loadPayrollMasters(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error guardando tipo de nómina'),
    });
  }

  saveNovelty() {
    if (!this.noveltyForm.employeeId || !this.noveltyForm.type || !this.noveltyForm.effectiveDate) {
      this.notify.error('Selecciona empleado, tipo y fecha efectiva');
      return;
    }
    this.http.post<any>(`${this.api}/novelties`, this.noveltyForm).subscribe({
      next: () => {
        this.notify.success('Novedad guardada');
        this.noveltyForm = this.emptyNoveltyForm();
        this.loadPayrollNovelties();
        this.loadEmployees();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error guardando novedad'),
    });
  }

  async generateBatch() {
    if (!this.periodFilter) return;
    const ok = await this.dialog.confirm({
      title: 'Generar pre-nómina',
      message: `Se generarán borradores masivos para el período ${this.periodFilter}.`,
      detail: 'Solo se crearán empleados activos que todavía no tengan nómina electrónica en ese período.',
      confirmLabel: 'Generar lote',
      icon: 'playlist_add_check',
    });
    if (!ok) return;
    this.http.post<any>(`${this.api}/batches`, { period: this.periodFilter }).subscribe({
      next: () => {
        this.notify.success('Lote de pre-nómina generado');
        this.loadRecords();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error generando lote'),
    });
  }

  async closePayrollPeriodAction() {
    if (!this.periodFilter) return;
    const notes = await this.dialog.prompt({
      title: 'Cerrar período de nómina',
      message: `Periodo ${this.periodFilter}`,
      inputLabel: 'Observación de cierre',
      placeholder: 'Cierre operativo del período…',
      confirmLabel: 'Cerrar período',
      icon: 'lock',
    });
    if (notes === null) return;
    this.http.post<any>(`${this.api}/periods/close`, { period: this.periodFilter, notes }).subscribe({
      next: () => {
        this.notify.success('Período cerrado');
        this.loadPeriodDashboard();
        this.loadPayrollBatches();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error cerrando período'),
    });
  }

  async reopenPayrollPeriodAction() {
    if (!this.periodFilter) return;
    const notes = await this.dialog.prompt({
      title: 'Reabrir período de nómina',
      message: `Periodo ${this.periodFilter}`,
      inputLabel: 'Motivo de reapertura',
      placeholder: 'Ajuste de liquidación o novedad tardía…',
      confirmLabel: 'Reabrir período',
      icon: 'lock_open',
    });
    if (notes === null) return;
    this.http.post<any>(`${this.api}/periods/reopen`, { period: this.periodFilter, notes }).subscribe({
      next: () => {
        this.notify.success('Período reabierto');
        this.loadPeriodDashboard();
        this.loadPayrollBatches();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error reabriendo período'),
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

  openPayrollReceipt(r: PayrollRecord) {
    const token = localStorage.getItem('access_token') ?? '';
    this.http.get(`${this.api}/records/${r.id}/receipt`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: blob => {
        const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
        const win = window.open(objectUrl, '_blank', 'width=900,height=700,scrollbars=yes');
        if (!win) {
          this.notify.error('No se pudo abrir el comprobante. Verifica los pop-ups.');
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error al generar el comprobante'),
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

  private loadBatchApprovalFlows(batches: PayrollBatch[]) {
    if (!batches.length) {
      this.batchApprovalFlows.set({});
      return;
    }
    const requests = batches.map((batch) =>
      this.http.get<any>(`${this.api}/batches/${batch.id}/approvals`),
    );
    Promise.all(requests.map((request) => request.toPromise().catch(() => [] as any[]))).then((responses) => {
      const map: Record<string, PayrollApprovalRequest[]> = {};
      batches.forEach((batch, index) => {
        const data = responses[index] as any;
        map[batch.id] = data?.data ?? data ?? [];
      });
      this.batchApprovalFlows.set(map);
    });
  }

  latestBatchApproval(batchId: string): PayrollApprovalRequest | null {
    return this.batchApprovalFlows()[batchId]?.[0] ?? null;
  }

  async requestBatchApproval(batch: PayrollBatch) {
    const reason = await this.dialog.prompt({
      title: 'Solicitar aprobación de pre-nómina',
      message: batch.name,
      inputLabel: 'Motivo o comentario',
      placeholder: 'Validación previa al cierre del período…',
      confirmLabel: 'Solicitar aprobación',
      icon: 'fact_check',
    });
    if (reason === null) return;
    this.http.post<any>(`${this.api}/batches/${batch.id}/approvals`, { actionType: 'PREPAYROLL', reason }).subscribe({
      next: (res) => {
        this.batchApprovalFlows.set({ ...this.batchApprovalFlows(), [batch.id]: res?.data ?? res ?? [] });
        this.notify.success('Solicitud de aprobación registrada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error solicitando aprobación'),
    });
  }

  approveBatchApproval(batch: PayrollBatch) {
    this.http.post<any>(`${this.api}/batches/${batch.id}/approvals/approve`, {}).subscribe({
      next: (res) => {
        this.batchApprovalFlows.set({ ...this.batchApprovalFlows(), [batch.id]: res?.data ?? res ?? [] });
        this.notify.success('Pre-nómina aprobada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error aprobando pre-nómina'),
    });
  }

  async rejectBatchApproval(batch: PayrollBatch) {
    const reason = await this.dialog.prompt({
      title: 'Rechazar pre-nómina',
      message: batch.name,
      inputLabel: 'Motivo del rechazo',
      placeholder: 'Novedades pendientes o inconsistencia detectada…',
      confirmLabel: 'Rechazar',
      danger: true,
      icon: 'gpp_bad',
    });
    if (reason === null) return;
    this.http.post<any>(`${this.api}/batches/${batch.id}/approvals/reject`, { reason }).subscribe({
      next: (res) => {
        this.batchApprovalFlows.set({ ...this.batchApprovalFlows(), [batch.id]: res?.data ?? res ?? [] });
        this.notify.success('Pre-nómina rechazada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error rechazando pre-nómina'),
    });
  }

  loadRecordGovernance(payrollRecordId: string) {
    this.loadingRecordGovernance.set(true);
    Promise.all([
      this.http.get<any>(`${this.api}/records/${payrollRecordId}/approvals`).toPromise().catch(() => [] as any[]),
      this.http.get<any>(`${this.api}/records/${payrollRecordId}/attachments`).toPromise().catch(() => [] as any[]),
      this.http.get<any>(`${this.api}/records/${payrollRecordId}/audit-trail`).toPromise().catch(() => [] as any[]),
    ]).then(([approvals, attachments, auditTrail]) => {
      this.recordApprovalFlow.set((approvals as any)?.data ?? approvals ?? []);
      this.recordAttachments.set((attachments as any)?.data ?? attachments ?? []);
      this.recordAuditTrail.set((auditTrail as any)?.data ?? auditTrail ?? []);
      this.loadingRecordGovernance.set(false);
    }).catch(() => {
      this.loadingRecordGovernance.set(false);
    });
  }

  latestRecordApproval(): PayrollApprovalRequest | null {
    return this.recordApprovalFlow()[0] ?? null;
  }

  approvalActionLabel(actionType?: string | null) {
    return ({ SUBMIT: 'Enviar a DIAN', VOID: 'Anular', PREPAYROLL: 'Pre-nómina' } as Record<string, string>)[actionType ?? ''] ?? (actionType ?? 'Aprobación');
  }

  approvalStatusLabel(status?: string | null) {
    return ({ PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' } as Record<string, string>)[status ?? ''] ?? (status ?? 'Estado');
  }

  async requestRecordApproval(record: PayrollRecord, actionType: 'SUBMIT' | 'VOID') {
    const reason = await this.dialog.prompt({
      title: `Solicitar aprobación para ${actionType === 'SUBMIT' ? 'envío' : 'anulación'}`,
      message: `${record.employees?.firstName} ${record.employees?.lastName} · ${record.period}`,
      inputLabel: 'Motivo o soporte',
      placeholder: actionType === 'SUBMIT' ? 'Validación previa al envío DIAN…' : 'Motivo de anulación controlada…',
      confirmLabel: 'Solicitar aprobación',
      icon: 'approval_delegation',
    });
    if (reason === null) return;
    this.http.post<any>(`${this.api}/records/${record.id}/approvals`, { actionType, reason }).subscribe({
      next: (res) => {
        this.recordApprovalFlow.set(res?.data ?? res ?? []);
        this.notify.success('Solicitud de aprobación registrada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error solicitando aprobación'),
    });
  }

  approveRecordApproval(record: PayrollRecord) {
    this.http.post<any>(`${this.api}/records/${record.id}/approvals/approve`, {}).subscribe({
      next: (res) => {
        this.recordApprovalFlow.set(res?.data ?? res ?? []);
        this.notify.success('Aprobación registrada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error aprobando solicitud'),
    });
  }

  async rejectRecordApproval(record: PayrollRecord) {
    const reason = await this.dialog.prompt({
      title: 'Rechazar aprobación',
      message: `${record.employees?.firstName} ${record.employees?.lastName} · ${record.period}`,
      inputLabel: 'Motivo del rechazo',
      placeholder: 'Inconsistencia detectada…',
      confirmLabel: 'Rechazar',
      danger: true,
      icon: 'gpp_bad',
    });
    if (reason === null) return;
    this.http.post<any>(`${this.api}/records/${record.id}/approvals/reject`, { reason }).subscribe({
      next: (res) => {
        this.recordApprovalFlow.set(res?.data ?? res ?? []);
        this.notify.success('Solicitud rechazada');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error rechazando solicitud'),
    });
  }

  async addRecordAttachment(record: PayrollRecord) {
    const fileName = await this.dialog.prompt({
      title: 'Adjuntar soporte',
      message: `${record.employees?.firstName} ${record.employees?.lastName} · ${record.period}`,
      inputLabel: 'Nombre del archivo',
      placeholder: 'soporte_pre_nomina.pdf',
      confirmLabel: 'Continuar',
      icon: 'attach_file',
    });
    if (!fileName) return;
    const fileUrl = await this.dialog.prompt({
      title: 'URL o ruta del soporte',
      message: fileName,
      inputLabel: 'Ruta del archivo',
      placeholder: 'https://... o /uploads/payroll/soporte.pdf',
      confirmLabel: 'Guardar soporte',
      icon: 'link',
    });
    if (!fileUrl) return;
    this.http.post<any>(`${this.api}/records/${record.id}/attachments`, {
      fileName,
      fileUrl,
      category: 'SOPORTE',
    }).subscribe({
      next: (res) => {
        this.recordAttachments.set(res?.data ?? res ?? []);
        this.notify.success('Soporte adjuntado');
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error adjuntando soporte'),
    });
  }

  async reversePayrollControlled(record: PayrollRecord, tipoAjuste: 'Reemplazar' | 'Eliminar') {
    const notes = await this.dialog.prompt({
      title: `Reverso controlado: ${tipoAjuste}`,
      message: `${record.employees?.firstName} ${record.employees?.lastName} · ${record.payrollNumber ?? record.period}`,
      inputLabel: 'Observación',
      placeholder: 'Motivo del reverso controlado…',
      confirmLabel: 'Generar reverso',
      danger: tipoAjuste === 'Eliminar',
      icon: 'shield_lock',
    });
    if (notes === null) return;
    this.http.post<any>(`${this.api}/records/${record.id}/reverse`, { tipoAjuste, notes }).subscribe({
      next: () => {
        this.notify.success(`Reverso controlado ${tipoAjuste.toLowerCase()} generado`);
        this.loadRecords();
        if (this.selectedRecord()?.id === record.id) this.showRecordDetail.set(false);
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error generando reverso controlado'),
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
      next: r => {
        const res = r.data ?? r;
        const rows = res.data ?? res;
        this.employees.set(rows);
        if (!this.portalSelectedEmployeeId() && rows?.length) {
          const firstActive = rows.find((item: Employee) => item.isActive) ?? rows[0];
          this.portalSelectedEmployeeId.set(firstActive.id);
        }
        this.loadingEmployees.set(false);
      },
      error: () => { this.loadingEmployees.set(false); this.notify.error('Error al cargar empleados'); },
    });
  }

  loadBranches() {
    this.http.get<any>(`${environment.apiUrl}/payroll/branches`).subscribe({
      next: res => {
        const data = res.data ?? res;
        this.branches.set((data ?? []).filter((branch: Branch) => branch.isActive));
      },
      error: () => this.notify.error('Error al cargar sucursales'),
    });
  }

  loadAccountingAccounts() {
    this.http.get<any>(`${environment.apiUrl}/accounting/accounts`, { params: { limit: '1000' } }).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.accountingAccounts.set(data?.data ?? data ?? []);
      },
      error: () => this.accountingAccounts.set([]),
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
        contractEndDate: emp.contractEndDate ? emp.contractEndDate.split('T')[0] : '',
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

  viewEmployeeDetail(emp: Employee) {
    this.http.get<any>(`${this.api}/employees/${emp.id}`).subscribe({
      next: (res) => {
        this.selectedEmployee.set(res?.data ?? res);
        this.showEmployeeDetail.set(true);
      },
      error: () => this.notify.error('Error cargando historial laboral'),
    });
  }

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

  async extendEmployeeContract(emp: Employee) {
    const newEndDate = await this.dialog.prompt({
      title: 'Prórroga contractual',
      message: `${emp.firstName} ${emp.lastName}`,
      inputLabel: 'Nueva fecha fin (YYYY-MM-DD)',
      placeholder: '2026-12-31',
      confirmLabel: 'Registrar prórroga',
      icon: 'event_repeat',
    });
    if (!newEndDate) return;
    this.http.post<any>(`${this.api}/employees/${emp.id}/contracts/extension`, { newEndDate }).subscribe({
      next: () => {
        this.notify.success('Prórroga registrada');
        this.viewEmployeeDetail(emp);
        this.loadEmployees();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error registrando prórroga'),
    });
  }

  async registerEmploymentChange(emp: Employee) {
    const position = await this.dialog.prompt({
      title: 'Cambio laboral',
      message: `${emp.firstName} ${emp.lastName}`,
      inputLabel: 'Nuevo cargo',
      placeholder: emp.position,
      confirmLabel: 'Continuar',
      icon: 'work_history',
    });
    if (position === null) return;
    const salaryRaw = await this.dialog.prompt({
      title: 'Cambio salarial',
      message: `${emp.firstName} ${emp.lastName}`,
      inputLabel: 'Nuevo salario',
      placeholder: String(emp.baseSalary ?? ''),
      confirmLabel: 'Registrar cambio',
      icon: 'payments',
    });
    if (salaryRaw === null) return;
    this.http.post<any>(`${this.api}/employees/${emp.id}/contracts/change`, {
      effectiveDate: new Date().toISOString().slice(0, 10),
      position: position || emp.position,
      baseSalary: salaryRaw ? Number(salaryRaw) : emp.baseSalary,
    }).subscribe({
      next: () => {
        this.notify.success('Cambio laboral registrado');
        this.viewEmployeeDetail(emp);
        this.loadEmployees();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error registrando cambio laboral'),
    });
  }

  async createEmployeeFinalSettlement(emp: Employee) {
    const ok = await this.dialog.confirm({
      title: 'Liquidación final',
      message: `${emp.firstName} ${emp.lastName}`,
      detail: 'Se generará una liquidación final y el empleado quedará inactivo.',
      confirmLabel: 'Generar liquidación',
      danger: true,
      icon: 'assignment_turned_in',
    });
    if (!ok) return;
    this.http.post<any>(`${this.api}/employees/${emp.id}/final-settlement`, {
      period: this.periodFilter || new Date().toISOString().slice(0, 7),
      payDate: new Date().toISOString().slice(0, 10),
      terminationDate: new Date().toISOString().slice(0, 10),
      daysWorked: 30,
      notes: 'Liquidación final generada desde historial laboral',
    }).subscribe({
      next: () => {
        this.notify.success('Liquidación final generada');
        this.showEmployeeDetail.set(false);
        this.loadEmployees();
        this.loadRecords();
      },
      error: e => this.notify.error(e?.error?.message ?? 'Error generando liquidación final'),
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
  noveltyTypeLabel(type: PayrollNovelty['type']) {
    const map: Record<PayrollNovelty['type'], string> = {
      OVERTIME: 'Horas extra',
      SURCHARGE: 'Recargos',
      SICK_LEAVE: 'Incapacidad',
      LICENSE: 'Licencia',
      VACATION: 'Vacaciones',
      LOAN: 'Préstamo',
      GARNISHMENT: 'Embargo',
      ADMISSION: 'Ingreso',
      TERMINATION: 'Retiro',
      SALARY_CHANGE: 'Cambio salarial',
      OTHER_EARNING: 'Otro devengado',
      OTHER_DEDUCTION: 'Otra deducción',
    };
    return map[type] ?? type;
  }
  noveltyStatusLabel(status: PayrollNovelty['status']) {
    return ({ PENDING: 'Pendiente', APPLIED: 'Aplicada', CANCELLED: 'Cancelada' } as Record<string, string>)[status] ?? status;
  }
  employmentEventLabel(type: string) {
    const map: Record<string, string> = {
      ADMISSION: 'Ingreso',
      TERMINATION: 'Retiro',
      SALARY_CHANGE: 'Cambio salarial',
      POSITION_CHANGE: 'Cambio de cargo',
      CONTRACT_CHANGE: 'Cambio contractual',
      CONTRACT_EXTENSION: 'Prórroga',
      BRANCH_CHANGE: 'Cambio de sucursal',
      EMPLOYMENT_CHANGE: 'Cambio laboral',
      FINAL_SETTLEMENT: 'Liquidación final',
      CONTRACT_UPDATE: 'Actualización contractual',
    };
    return map[type] ?? type;
  }
  payrollDianActionLabel(action?: string | null) {
    return ({ SUBMIT_DIAN: 'Enviar DIAN', QUERY_DIAN_STATUS: 'Consultar DIAN' } as Record<string, string>)[action ?? ''] ?? (action ?? 'Operación');
  }
  payrollDianJobStatusLabel(status?: string | null) {
    return ({ PENDING: 'Pendiente', PROCESSING: 'Procesando', SUCCESS: 'Éxito', FAILED: 'Falló' } as Record<string, string>)[status ?? ''] ?? (status ?? 'Estado');
  }
  activeContractEndDate(employee: Employee) {
    return employee.payrollContracts?.find(item => item.status === 'ACTIVE')?.endDate ?? employee.contractEndDate ?? null;
  }
  pendingNoveltiesForForm() {
    return this.payrollNovelties().filter(item =>
      item.status === 'PENDING'
      && item.employeeId === this.payrollForm.employeeId
      && (!item.period || item.period === this.payrollForm.period),
    );
  }
  private hasRole(r: string) { return (this.auth.user()?.roles ?? []).includes(r); }

  private emptyPayrollForm() {
    return {
      employeeId: '', period: new Date().toISOString().slice(0,7),
      payDate: new Date().toISOString().split('T')[0],
      branchId: '',
      payrollCalendarId: '',
      payrollPolicyId: '',
      payrollTypeConfigId: '',
      payrollCategory: 'ORDINARIA',
      baseSalary: 0, daysWorked: 30, overtimeHours: 0, bonuses: 0, commissions: 0,
      transportAllowance: null, vacationPay: 0, sickLeave: 0, loans: 0, otherDeductions: 0, notes: '',
      conceptLines: [] as PayrollAppliedConceptLine[],
    };
  }
  private emptyEmpForm() {
    return {
      branchId: '',
      firstName: '', lastName: '', documentType: 'CC', documentNumber: '',
      position: '', contractType: 'INDEFINITE', baseSalary: 1_300_000,
      hireDate: '', contractEndDate: '', email: '', phone: '',
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

  private emptyConceptForm() {
    return {
      branchId: '',
      code: '',
      name: '',
      description: '',
      nature: 'EARNING',
      formulaType: 'MANUAL',
      defaultAmount: null,
      defaultRate: null,
      accountingAccountId: '',
      costCenter: '',
      projectCode: '',
      quantityDefault: 1,
      appliesByDefault: false,
      affectsSocialSecurity: false,
      affectsParafiscals: false,
      displayOrder: 0,
      isActive: true,
    };
  }

  private emptyCalendarForm() {
    return {
      branchId: '',
      code: '',
      name: '',
      frequency: 'MONTHLY',
      cutoffDay: 30,
      paymentDay: 30,
      startDay: 1,
      endDay: 30,
      isDefault: false,
      isActive: true,
    };
  }

  private emptyPolicyForm() {
    return {
      branchId: '',
      name: '',
      description: '',
      applyAutoTransport: true,
      transportAllowanceAmount: 162000,
      transportCapMultiplier: 2,
      minimumWageValue: 1300000,
      healthEmployeeRate: 0.04,
      pensionEmployeeRate: 0.04,
      healthEmployerRate: 0.085,
      pensionEmployerRate: 0.12,
      arlRate: 0.00522,
      compensationFundRate: 0.04,
      senaRate: 0.02,
      icbfRate: 0.03,
      healthCapSmmlv: 25,
      pensionCapSmmlv: 25,
      parafiscalCapSmmlv: 25,
      applySena: true,
      applyIcbf: true,
      overtimeFactor: 1.25,
      isDefault: false,
      isActive: true,
    };
  }

  private emptyPayrollTypeForm() {
    return {
      branchId: '',
      code: '',
      name: '',
      category: 'ORDINARIA',
      description: '',
      calendarId: '',
      policyId: '',
      isDefault: false,
      isActive: true,
    };
  }

  private emptyNoveltyForm() {
    return {
      employeeId: '',
      branchId: '',
      type: 'OVERTIME',
      period: new Date().toISOString().slice(0, 7),
      effectiveDate: new Date().toISOString().split('T')[0],
      startDate: '',
      endDate: '',
      hours: null,
      days: null,
      quantity: null,
      rate: null,
      amount: null,
      description: '',
      notes: '',
      salaryFrom: null,
      salaryTo: null,
    };
  }

  private emptyPortalRequestForm() {
    return {
      requestType: 'VACATION',
      period: new Date().toISOString().slice(0, 7),
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      days: 1,
      description: '',
      notes: '',
    };
  }

  private emptyOperationsForm() {
    return {
      actionType: 'QUERY_DIAN_STATUS',
      payrollBatchId: '',
    };
  }

  private emptyEnterpriseForm() {
    return {
      processArea: 'PAYROLL',
      actionType: 'SUBMIT_DIAN',
      policyName: '',
      branchId: '',
      allowedRolesText: 'ADMIN, MANAGER, CONTADOR',
      sharedWithAreasText: 'HR, ACCOUNTING',
      requireDifferentActors: true,
      requireBranchScope: false,
      requireAccountingReview: false,
      isActive: true,
      notes: '',
    };
  }

  private parseCommaList(value: string): string[] {
    return String(value ?? '')
      .split(',')
      .map(item => item.trim().toUpperCase())
      .filter(Boolean);
  }
}
