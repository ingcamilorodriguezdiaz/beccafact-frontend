import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';

// ── Interfaces de dominio ─────────────────────────────────────────────────────

type AccountLevel = 1 | 2 | 3 | 4;
type AccountNature = 'DEBIT' | 'CREDIT';
type JournalStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
type PeriodStatus = 'OPEN' | 'CLOSED';
type DeleteJournalTarget = { id: string; number: string };
type AccountingTab = 'accounts' | 'journals' | 'periods';

interface Account {
  id: string;
  code: string;
  name: string;
  level: AccountLevel;
  nature: AccountNature;
  isActive: boolean;
  parentId?: string;
  parent?: { code: string; name: string };
  createdAt: string;
}

interface JournalLine {
  id?: string;
  accountId: string;
  account?: { code: string; name: string };
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  number: string;
  date: string;
  description: string;
  reference?: string;
  status: JournalStatus;
  lines?: JournalLine[];
  totalDebit?: number;
  totalCredit?: number;
  createdAt: string;
}

interface AccountingPeriod {
  id: string;
  name: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  isLocked: boolean;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  level: number;
  nature: AccountNature;
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

interface TrialBalanceResponse {
  data: TrialBalanceRow[];
  totals: {
    debit: number;
    credit: number;
    balance: number;
  };
  dateFrom: string;
  dateTo: string;
}

interface GeneralLedgerRow {
  accountId: string;
  code: string;
  name: string;
  level: number;
  nature: AccountNature;
  openingBalance: number;
  periodDebit: number;
  periodCredit: number;
  endingBalance: number;
}

interface GeneralLedgerResponse {
  data: GeneralLedgerRow[];
  totals: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    endingBalance: number;
  };
  dateFrom: string;
  dateTo: string;
}

interface AccountAuxiliaryMovement {
  entryId: string;
  number: string;
  date: string;
  description: string;
  reference?: string | null;
  lineDescription?: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountAuxiliaryResponse {
  account: {
    id: string;
    code: string;
    name: string;
    level: number;
    nature: AccountNature;
  };
  openingBalance: number;
  totals: {
    debit: number;
    credit: number;
    endingBalance: number;
  };
  data: AccountAuxiliaryMovement[];
  dateFrom: string;
  dateTo: string;
}

interface FinancialStatementRow {
  accountId: string;
  code: string;
  name: string;
  level: number;
  amount: number;
}

interface FinancialStatementSection {
  key: string;
  label: string;
  total: number;
  rows: FinancialStatementRow[];
}

interface FinancialStatementsResponse {
  balanceSheet: {
    sections: FinancialStatementSection[];
    totals: {
      assets: number;
      liabilities: number;
      equity: number;
      liabilitiesPlusEquity: number;
    };
  };
  incomeStatement: {
    sections: FinancialStatementSection[];
    totals: {
      revenues: number;
      expenses: number;
      netIncome: number;
    };
  };
  dateFrom: string;
  dateTo: string;
}

interface AccountForm {
  code: string;
  name: string;
  level: AccountLevel | '';
  parentId: string;
  nature: AccountNature | '';
}

interface JournalForm {
  date: string;
  description: string;
  reference: string;
  lines: JournalLineForm[];
}

interface JournalLineForm {
  accountId: string;
  description: string;
  debit: number | null;
  credit: number | null;
}

interface PeriodForm {
  year: number | null;
  month: number | null;
  name: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
}

// ── Nivel de cuenta: etiqueta descriptiva ─────────────────────────────────────
const LEVEL_LABELS: Record<number, string> = {
  1: 'Clase',
  2: 'Grupo',
  3: 'Cuenta',
  4: 'Subcuenta',
};

@Component({
  selector: 'app-accounting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Hero header ──────────────────────────────────────────────────── -->
      <section class="hero-shell">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Módulo financiero</p>
            <h2 class="page-title">Contabilidad</h2>
            <p class="page-subtitle">Gestiona el plan de cuentas PUC y los comprobantes contables con trazabilidad completa.</p>
          </div>
          <button class="btn btn-primary" (click)="openPrimaryAction()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            {{ activeTab() === 'accounts' ? 'Nueva Cuenta' : activeTab() === 'journals' ? 'Nuevo Comprobante' : 'Nuevo Período' }}
          </button>
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">{{ activeTab() === 'accounts' ? 'Cuentas visibles' : activeTab() === 'journals' ? 'Comprobantes' : 'Períodos configurados' }}</span>
            <strong>{{ activeTab() === 'accounts' ? totalAccounts() : activeTab() === 'journals' ? totalJournals() : periods().length }}</strong>
            <small>{{ activeTab() === 'accounts' ? 'Plan de cuentas PUC activo' : activeTab() === 'journals' ? 'Registros del período' : 'Control de cierre y bloqueo contable' }}</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Cuentas</span>
              <strong>{{ totalAccounts() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Contabilizados</span>
              <strong>{{ postedCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Borradores</span>
              <strong>{{ draftCount() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Pestañas ──────────────────────────────────────────────────────── -->
      <div class="tabs-bar">
        <button class="tab-btn" [class.active]="activeTab() === 'accounts'" (click)="switchTab('accounts')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
          </svg>
          Plan de Cuentas
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'journals'" (click)="switchTab('journals')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
          </svg>
          Comprobantes
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'periods'" (click)="switchTab('periods')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v9a3 3 0 003 3h10a3 3 0 003-3V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm9 7H5v6a1 1 0 001 1h8a1 1 0 001-1V9z" clip-rule="evenodd"/>
          </svg>
          Períodos y Reportes
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════
           PESTAÑA: PLAN DE CUENTAS
           ══════════════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'accounts') {

        <!-- Filtros de cuentas -->
        <section class="filters-shell">
          <div class="filters-head">
            <div>
              <p class="filters-kicker">Plan de cuentas PUC</p>
              <h3>Busca y filtra cuentas contables</h3>
            </div>
            <div class="results-pill">{{ totalAccounts() }} cuentas</div>
          </div>
          <div class="filters-bar">
            <div class="search-wrap">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              <input type="text" placeholder="Buscar por código o nombre..."
                     [(ngModel)]="accountSearch" (ngModelChange)="onAccountSearch()" class="search-input"/>
            </div>
            <select [(ngModel)]="filterLevel" (ngModelChange)="loadAccounts()" class="filter-select">
              <option value="">Todos los niveles</option>
              <option value="1">Nivel 1 — Clase</option>
              <option value="2">Nivel 2 — Grupo</option>
              <option value="3">Nivel 3 — Cuenta</option>
              <option value="4">Nivel 4 — Subcuenta</option>
            </select>
            <select [(ngModel)]="filterAccountActive" (ngModelChange)="loadAccounts()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </section>

        <!-- Tabla de cuentas -->
        <div class="table-card">
          @if (loadingAccounts()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:200px"></div>
                  <div class="sk sk-line" style="width:70px"></div>
                  <div class="sk sk-line" style="width:90px"></div>
                  <div class="sk sk-line" style="width:60px"></div>
                </div>
              }
            </div>
          } @else if (accounts().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>
              </svg>
              <p>{{ accountSearch ? 'Sin resultados para "' + accountSearch + '"' : 'No hay cuentas registradas aún' }}</p>
              @if (!accountSearch) {
                <button class="btn btn-primary btn-sm" (click)="openAccountModal()">Crear primera cuenta</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código PUC</th>
                  <th>Nombre</th>
                  <th>Nivel</th>
                  <th>Naturaleza</th>
                  <th>Cuenta Padre</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (acc of accounts(); track acc.id) {
                  <tr>
                    <td>
                      <span class="code-badge" [class]="'code-level-' + acc.level">{{ acc.code }}</span>
                    </td>
                    <td>
                      <div class="acc-name" [style.padding-left.px]="(acc.level - 1) * 14">
                        {{ acc.name }}
                      </div>
                    </td>
                    <td>
                      <span class="level-badge level-{{ acc.level }}">N{{ acc.level }} — {{ levelLabel(acc.level) }}</span>
                    </td>
                    <td>
                      <span class="nature-badge" [class.debit]="acc.nature === 'DEBIT'" [class.credit]="acc.nature === 'CREDIT'">
                        {{ acc.nature === 'DEBIT' ? 'Débito' : 'Crédito' }}
                      </span>
                    </td>
                    <td class="text-muted">
                      @if (acc.parent) {
                        <span class="parent-ref">{{ acc.parent.code }} — {{ acc.parent.name }}</span>
                      } @else { — }
                    </td>
                    <td>
                      <span class="status-badge" [class.active]="acc.isActive" [class.inactive]="!acc.isActive">
                        {{ acc.isActive ? 'Activa' : 'Inactiva' }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Editar" (click)="openAccountModal(acc)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                      <button class="btn-icon" [title]="acc.isActive ? 'Desactivar' : 'Activar'" (click)="toggleAccount(acc)">
                        @if (acc.isActive) {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/>
                          </svg>
                        } @else {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                          </svg>
                        }
                      </button>
                      <button class="btn-icon btn-icon-danger" title="Eliminar cuenta" (click)="confirmDeleteAccount(acc)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (accountTotalPages() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (accountPage()-1)*limit + 1 }}–{{ min(accountPage()*limit, totalAccounts()) }} de {{ totalAccounts() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="accountPage() === 1" (click)="setAccountPage(accountPage()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of accountPageRange(); track p) {
                    <button class="btn-page" [class.active]="p === accountPage()" (click)="setAccountPage(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="accountPage() === accountTotalPages()" (click)="setAccountPage(accountPage()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ══════════════════════════════════════════════════════════════════════
           PESTAÑA: COMPROBANTES
           ══════════════════════════════════════════════════════════════════════ -->
      @if (activeTab() === 'journals') {

        <!-- Filtros de comprobantes -->
        <section class="filters-shell">
          <div class="filters-head">
            <div>
              <p class="filters-kicker">Comprobantes contables</p>
              <h3>Filtra y consulta los asientos</h3>
            </div>
            <div class="results-pill">{{ totalJournals() }} registros</div>
          </div>
          <div class="filters-bar">
            <div class="search-wrap">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
              </svg>
              <input type="text" placeholder="Buscar por número, descripción o referencia..."
                     [(ngModel)]="journalSearch" (ngModelChange)="onJournalSearch()" class="search-input"/>
            </div>
            <select [(ngModel)]="filterJournalStatus" (ngModelChange)="loadJournals()" class="filter-select">
              <option value="">Todos los estados</option>
              <option value="DRAFT">Borrador</option>
              <option value="POSTED">Contabilizado</option>
              <option value="CANCELLED">Anulado</option>
            </select>
            <input type="date" [(ngModel)]="filterDateFrom" (ngModelChange)="loadJournals()" class="filter-select" placeholder="Desde"/>
            <input type="date" [(ngModel)]="filterDateTo"   (ngModelChange)="loadJournals()" class="filter-select" placeholder="Hasta"/>
          </div>
        </section>

        <!-- Tabla de comprobantes -->
        <div class="table-card">
          @if (loadingJournals()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:90px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:200px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                  <div class="sk sk-line" style="width:70px"></div>
                </div>
              }
            </div>
          } @else if (journals().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
              <p>{{ journalSearch ? 'Sin resultados para "' + journalSearch + '"' : 'No hay comprobantes registrados aún' }}</p>
              @if (!journalSearch) {
                <button class="btn btn-primary btn-sm" (click)="openJournalModal()">Crear primer comprobante</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (je of journals(); track je.id) {
                  <tr>
                    <td>
                      <span class="journal-number">{{ je.number }}</span>
                    </td>
                    <td class="text-muted">{{ formatDate(je.date) }}</td>
                    <td>
                      <div class="journal-desc">{{ je.description }}</div>
                    </td>
                    <td class="text-muted">{{ je.reference || '—' }}</td>
                    <td>
                      <span class="journal-badge journal-{{ je.status.toLowerCase() }}">
                        {{ statusLabel(je.status) }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Ver detalle" (click)="openDetail(je)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                          <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                        </svg>
                      </button>
                      @if (je.status === 'DRAFT') {
                        <button class="btn-icon" title="Editar" (click)="openJournalModal(je)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                          </svg>
                        </button>
                        <button class="btn-icon btn-icon-success" title="Contabilizar" (click)="postJournal(je)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                          </svg>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDeleteJournal(je)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                          </svg>
                        </button>
                      }
                      @if (je.status === 'POSTED') {
                        <button class="btn-icon btn-icon-danger" title="Anular" (click)="confirmCancel(je)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                          </svg>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (journalTotalPages() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (journalPage()-1)*limit + 1 }}–{{ min(journalPage()*limit, totalJournals()) }} de {{ totalJournals() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="journalPage() === 1" (click)="setJournalPage(journalPage()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of journalPageRange(); track p) {
                    <button class="btn-page" [class.active]="p === journalPage()" (click)="setJournalPage(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="journalPage() === journalTotalPages()" (click)="setJournalPage(journalPage()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }

      @if (activeTab() === 'periods') {
        <section class="panel-grid">
          <div class="table-card panel-card">
            <div class="panel-card__header">
              <div>
                <p class="filters-kicker">Períodos contables</p>
                <h3>Control de apertura, cierre y bloqueo</h3>
              </div>
              <div class="panel-card__filters">
                <select [(ngModel)]="periodFilterYear" (ngModelChange)="loadPeriods()" class="filter-select">
                  <option value="">Todos los años</option>
                  @for (year of periodYearOptions(); track year) {
                    <option [value]="year">{{ year }}</option>
                  }
                </select>
                <select [(ngModel)]="periodFilterStatus" (ngModelChange)="loadPeriods()" class="filter-select">
                  <option value="">Todos los estados</option>
                  <option value="OPEN">Abiertos</option>
                  <option value="CLOSED">Cerrados</option>
                </select>
              </div>
            </div>

            @if (loadingPeriods()) {
              <div class="table-loading">
                @for (i of [1,2,3,4]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:140px"></div>
                    <div class="sk sk-line" style="width:90px"></div>
                    <div class="sk sk-line" style="width:110px"></div>
                    <div class="sk sk-line" style="width:90px"></div>
                  </div>
                }
              </div>
            } @else if (periods().length === 0) {
              <div class="empty-state">
                <p>No hay períodos contables configurados aún</p>
                <button class="btn btn-primary btn-sm" (click)="openPeriodModal()">Crear primer período</button>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Rango</th>
                    <th>Estado</th>
                    <th>Bloqueo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (period of periods(); track period.id) {
                    <tr>
                      <td>
                        <div class="journal-desc">{{ period.name }}</div>
                        <div class="text-muted">{{ period.year }}-{{ padMonth(period.month) }}</div>
                      </td>
                      <td class="text-muted">{{ formatDate(period.startDate) }} - {{ formatDate(period.endDate) }}</td>
                      <td>
                        <span class="journal-badge journal-{{ period.status === 'OPEN' ? 'draft' : 'cancelled' }}">
                          {{ period.status === 'OPEN' ? 'Abierto' : 'Cerrado' }}
                        </span>
                      </td>
                      <td>
                        <span class="status-badge" [class.active]="!period.isLocked" [class.inactive]="period.isLocked">
                          {{ period.isLocked ? 'Bloqueado' : 'Disponible' }}
                        </span>
                      </td>
                      <td class="actions-cell">
                        @if (period.status === 'OPEN' && !period.isLocked) {
                          <button class="btn-icon" title="Bloquear" (click)="lockPeriod(period)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path fill-rule="evenodd" d="M5 8V6a5 5 0 1110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2a3 3 0 10-6 0v2h6V6z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                        }
                        @if (period.status === 'OPEN' && period.isLocked) {
                          <button class="btn-icon" title="Desbloquear" (click)="unlockPeriod(period)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path d="M13 7V6a3 3 0 10-6 0v2h6z"/>
                              <path fill-rule="evenodd" d="M5 8a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2h-1V6a5 5 0 10-10 0v2H5z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                        }
                        @if (period.status === 'OPEN') {
                          <button class="btn-icon btn-icon-danger" title="Cerrar período" (click)="closePeriod(period)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.707a1 1 0 00-1.414-1.414L10 8.172 7.707 5.879a1 1 0 00-1.414 1.414L8.586 9.586l-2.293 2.293a1 1 0 101.414 1.414L10 11l2.293 2.293a1 1 0 001.414-1.414L11.414 9.586l2.293-2.293z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                        }
                        @if (period.status === 'CLOSED') {
                          <button class="btn-icon btn-icon-success" title="Reabrir período" (click)="reopenPeriod(period)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="15">
                              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3a1 1 0 00.293.707l2 2a1 1 0 101.414-1.414L11 9.586V7z" clip-rule="evenodd"/>
                            </svg>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          <div class="table-card panel-card">
            <div class="panel-card__header">
              <div>
                <p class="filters-kicker">Balance de prueba</p>
                <h3>Reporte por rango de fechas</h3>
              </div>
            </div>

            <div class="filters-bar panel-card__report-filters">
              <input type="date" [(ngModel)]="trialBalanceDateFrom" class="filter-select"/>
              <input type="date" [(ngModel)]="trialBalanceDateTo" class="filter-select"/>
              <select [(ngModel)]="trialBalanceLevel" class="filter-select">
                <option value="">Todos los niveles</option>
                <option value="1">Nivel 1</option>
                <option value="2">Nivel 2</option>
                <option value="3">Nivel 3</option>
                <option value="4">Nivel 4</option>
              </select>
              <input type="text" [(ngModel)]="trialBalanceSearch" class="search-input search-input--compact" placeholder="Buscar cuenta o nombre"/>
              <label class="check-inline">
                <input type="checkbox" [(ngModel)]="trialBalanceIncludeZero"/>
                Incluir cuentas sin movimiento
              </label>
              <button class="btn btn-primary btn-sm" [disabled]="loadingTrialBalance()" (click)="loadTrialBalance()">
                {{ loadingTrialBalance() ? 'Consultando...' : 'Generar reporte' }}
              </button>
            </div>

            <div class="report-summary">
              <div class="hero-mini-card report-mini-card">
                <span class="hero-mini-card__label">Débitos</span>
                <strong>{{ formatCurrency(trialBalanceTotals().debit) }}</strong>
              </div>
              <div class="hero-mini-card report-mini-card">
                <span class="hero-mini-card__label">Créditos</span>
                <strong>{{ formatCurrency(trialBalanceTotals().credit) }}</strong>
              </div>
              <div class="hero-mini-card report-mini-card">
                <span class="hero-mini-card__label">Balance</span>
                <strong>{{ formatCurrency(trialBalanceTotals().balance) }}</strong>
              </div>
            </div>

            @if (loadingTrialBalance()) {
              <div class="table-loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:90px"></div>
                    <div class="sk sk-line" style="width:200px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                  </div>
                }
              </div>
            } @else if (trialBalance().length === 0) {
              <div class="empty-state">
                <p>No hay movimientos contabilizados para el rango seleccionado</p>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th>Nivel</th>
                    <th class="text-right">Débito</th>
                    <th class="text-right">Crédito</th>
                    <th class="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of trialBalance(); track row.accountId) {
                    <tr>
                      <td><span class="code-badge" [class]="'code-level-' + row.level">{{ row.code }}</span></td>
                      <td>{{ row.name }}</td>
                      <td><span class="level-badge level-{{ row.level }}">N{{ row.level }}</span></td>
                      <td class="text-right">{{ formatCurrency(row.totalDebit) }}</td>
                      <td class="text-right">{{ formatCurrency(row.totalCredit) }}</td>
                      <td class="text-right"><strong>{{ formatCurrency(row.balance) }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          <div class="table-card panel-card">
            <div class="panel-card__header">
              <div>
                <p class="filters-kicker">Libro mayor</p>
                <h3>Saldos por cuenta</h3>
              </div>
            </div>

            <div class="filters-bar panel-card__report-filters">
              <input type="date" [(ngModel)]="trialBalanceDateFrom" class="filter-select"/>
              <input type="date" [(ngModel)]="trialBalanceDateTo" class="filter-select"/>
              <select [(ngModel)]="trialBalanceLevel" class="filter-select">
                <option value="">Todos los niveles</option>
                <option value="1">Nivel 1</option>
                <option value="2">Nivel 2</option>
                <option value="3">Nivel 3</option>
                <option value="4">Nivel 4</option>
              </select>
              <input type="text" [(ngModel)]="trialBalanceSearch" class="search-input search-input--compact" placeholder="Buscar cuenta o nombre"/>
              <label class="check-inline">
                <input type="checkbox" [(ngModel)]="trialBalanceIncludeZero"/>
                Incluir cuentas sin movimiento
              </label>
              <button class="btn btn-primary btn-sm" [disabled]="loadingGeneralLedger()" (click)="loadGeneralLedger()">
                {{ loadingGeneralLedger() ? 'Consultando...' : 'Generar mayor' }}
              </button>
            </div>

            @if (loadingGeneralLedger()) {
              <div class="table-loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:90px"></div>
                    <div class="sk sk-line" style="width:180px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                  </div>
                }
              </div>
            } @else if (generalLedger().length === 0) {
              <div class="empty-state">
                <p>No hay datos para generar el libro mayor en el rango seleccionado</p>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cuenta</th>
                    <th class="text-right">Saldo inicial</th>
                    <th class="text-right">Débitos</th>
                    <th class="text-right">Créditos</th>
                    <th class="text-right">Saldo final</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of generalLedger(); track row.accountId) {
                    <tr>
                      <td><span class="code-badge" [class]="'code-level-' + row.level">{{ row.code }}</span></td>
                      <td>{{ row.name }}</td>
                      <td class="text-right">{{ formatCurrency(row.openingBalance) }}</td>
                      <td class="text-right">{{ formatCurrency(row.periodDebit) }}</td>
                      <td class="text-right">{{ formatCurrency(row.periodCredit) }}</td>
                      <td class="text-right"><strong>{{ formatCurrency(row.endingBalance) }}</strong></td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="2"><strong>Totales</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(generalLedgerTotals().openingBalance) }}</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(generalLedgerTotals().periodDebit) }}</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(generalLedgerTotals().periodCredit) }}</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(generalLedgerTotals().endingBalance) }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            }
          </div>

          <div class="table-card panel-card">
            <div class="panel-card__header">
              <div>
                <p class="filters-kicker">Auxiliar contable</p>
                <h3>Movimientos detallados por cuenta</h3>
              </div>
            </div>

            <div class="filters-bar panel-card__report-filters">
              <select [(ngModel)]="accountAuxiliaryAccountId" class="filter-select">
                <option value="">Selecciona una cuenta</option>
                @for (account of allAccounts(); track account.id) {
                  <option [value]="account.id">{{ account.code }} — {{ account.name }}</option>
                }
              </select>
              <input type="date" [(ngModel)]="trialBalanceDateFrom" class="filter-select"/>
              <input type="date" [(ngModel)]="trialBalanceDateTo" class="filter-select"/>
              <button class="btn btn-primary btn-sm" [disabled]="loadingAccountAuxiliary()" (click)="loadAccountAuxiliary()">
                {{ loadingAccountAuxiliary() ? 'Consultando...' : 'Consultar auxiliar' }}
              </button>
            </div>

            @if (loadingAccountAuxiliary()) {
              <div class="table-loading">
                @for (i of [1,2,3,4]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:90px"></div>
                    <div class="sk sk-line" style="width:200px"></div>
                    <div class="sk sk-line" style="width:90px"></div>
                    <div class="sk sk-line" style="width:90px"></div>
                  </div>
                }
              </div>
            } @else if (!accountAuxiliary()) {
              <div class="empty-state">
                <p>Selecciona una cuenta y genera el auxiliar para ver los movimientos</p>
              </div>
            } @else {
              <div class="report-summary">
                <div class="hero-mini-card report-mini-card">
                  <span class="hero-mini-card__label">Cuenta</span>
                  <strong>{{ accountAuxiliary()!.account.code }}</strong>
                </div>
                <div class="hero-mini-card report-mini-card">
                  <span class="hero-mini-card__label">Saldo inicial</span>
                  <strong>{{ formatCurrency(accountAuxiliary()!.openingBalance) }}</strong>
                </div>
                <div class="hero-mini-card report-mini-card">
                  <span class="hero-mini-card__label">Saldo final</span>
                  <strong>{{ formatCurrency(accountAuxiliary()!.totals.endingBalance) }}</strong>
                </div>
              </div>

              <table class="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Comprobante</th>
                    <th>Descripción</th>
                    <th class="text-right">Débito</th>
                    <th class="text-right">Crédito</th>
                    <th class="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (movement of accountAuxiliary()!.data; track movement.entryId + movement.number + movement.date) {
                    <tr>
                      <td>{{ formatDate(movement.date) }}</td>
                      <td><span class="journal-number">{{ movement.number }}</span></td>
                      <td>
                        <div>{{ movement.description }}</div>
                        @if (movement.lineDescription) {
                          <div class="text-muted">{{ movement.lineDescription }}</div>
                        }
                      </td>
                      <td class="text-right">{{ formatCurrency(movement.debit) }}</td>
                      <td class="text-right">{{ formatCurrency(movement.credit) }}</td>
                      <td class="text-right"><strong>{{ formatCurrency(movement.runningBalance) }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          <div class="table-card panel-card">
            <div class="panel-card__header">
              <div>
                <p class="filters-kicker">Estados financieros</p>
                <h3>Balance general y estado de resultados</h3>
              </div>
              <button class="btn btn-primary btn-sm" [disabled]="loadingFinancialStatements()" (click)="loadFinancialStatements()">
                {{ loadingFinancialStatements() ? 'Consultando...' : 'Actualizar estados' }}
              </button>
            </div>

            @if (loadingFinancialStatements()) {
              <div class="table-loading">
                @for (i of [1,2,3,4,5]; track i) {
                  <div class="skeleton-row">
                    <div class="sk sk-line" style="width:120px"></div>
                    <div class="sk sk-line" style="width:220px"></div>
                    <div class="sk sk-line" style="width:100px"></div>
                  </div>
                }
              </div>
            } @else if (!financialStatements()) {
              <div class="empty-state">
                <p>No hay información suficiente para construir los estados financieros</p>
              </div>
            } @else {
              <div class="statements-grid">
                <div class="statement-card">
                  <div class="statement-card__head">
                    <h4>Balance general</h4>
                    <span>{{ trialBalanceDateTo }}</span>
                  </div>
                  @for (section of financialStatements()!.balanceSheet.sections; track section.key) {
                    <div class="statement-section">
                      <div class="statement-section__title">{{ section.label }}</div>
                      @for (row of section.rows; track row.accountId) {
                        <div class="statement-row">
                          <span>{{ row.code }} · {{ row.name }}</span>
                          <strong>{{ formatCurrency(row.amount) }}</strong>
                        </div>
                      }
                      <div class="statement-row statement-row--total">
                        <span>Total {{ section.label }}</span>
                        <strong>{{ formatCurrency(section.total) }}</strong>
                      </div>
                    </div>
                  }
                  <div class="statement-row statement-row--grand">
                    <span>Pasivo + Patrimonio</span>
                    <strong>{{ formatCurrency(financialStatements()!.balanceSheet.totals.liabilitiesPlusEquity) }}</strong>
                  </div>
                </div>

                <div class="statement-card">
                  <div class="statement-card__head">
                    <h4>Estado de resultados</h4>
                    <span>{{ trialBalanceDateFrom }} al {{ trialBalanceDateTo }}</span>
                  </div>
                  @for (section of financialStatements()!.incomeStatement.sections; track section.key) {
                    <div class="statement-section">
                      <div class="statement-section__title">{{ section.label }}</div>
                      @for (row of section.rows; track row.accountId) {
                        <div class="statement-row">
                          <span>{{ row.code }} · {{ row.name }}</span>
                          <strong>{{ formatCurrency(row.amount) }}</strong>
                        </div>
                      }
                      <div class="statement-row statement-row--total">
                        <span>Total {{ section.label }}</span>
                        <strong>{{ formatCurrency(section.total) }}</strong>
                      </div>
                    </div>
                  }
                  <div class="statement-row statement-row--grand">
                    <span>Resultado neto</span>
                    <strong>{{ formatCurrency(financialStatements()!.incomeStatement.totals.netIncome) }}</strong>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      }

    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: NUEVA / EDITAR CUENTA
         ══════════════════════════════════════════════════════════════════════ -->
    @if (showAccountModal()) {
      <div class="modal-overlay">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingAccountId() ? 'Editar cuenta' : 'Nueva cuenta contable' }}</h3>
            <button class="drawer-close" (click)="closeAccountModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <div class="form-row">
              <div class="form-group">
                <label>Código PUC *</label>
                <input type="text" [(ngModel)]="accountForm.code" class="form-control" placeholder="Ej: 1105"/>
              </div>
              <div class="form-group">
                <label>Nivel *</label>
                <select [(ngModel)]="accountForm.level" class="form-control">
                  <option value="">— Seleccionar nivel —</option>
                  <option value="1">1 — Clase</option>
                  <option value="2">2 — Grupo</option>
                  <option value="3">3 — Cuenta</option>
                  <option value="4">4 — Subcuenta</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Nombre de la cuenta *</label>
              <input type="text" [(ngModel)]="accountForm.name" class="form-control" placeholder="Ej: Caja General"/>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Naturaleza *</label>
                <select [(ngModel)]="accountForm.nature" class="form-control">
                  <option value="">— Seleccionar —</option>
                  <option value="DEBIT">Débito</option>
                  <option value="CREDIT">Crédito</option>
                </select>
              </div>
              <div class="form-group">
                <label>Cuenta Padre (opcional)</label>
                <select [(ngModel)]="accountForm.parentId" class="form-control">
                  <option value="">— Sin padre —</option>
                  @for (acc of getAvailableParentAccounts(); track acc.id) {
                    <option [value]="acc.id">{{ acc.code }} — {{ acc.name }}</option>
                  }
                </select>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeAccountModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingAccount()" (click)="saveAccount()">
              {{ savingAccount() ? 'Guardando...' : (editingAccountId() ? 'Actualizar' : 'Crear cuenta') }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (showPeriodModal()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Nuevo período contable</h3>
            <button class="drawer-close" (click)="closePeriodModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Año *</label>
                <select [(ngModel)]="periodForm.year" class="form-control">
                  <option [ngValue]="null">— Seleccionar año —</option>
                  @for (year of periodYearOptions(); track year) {
                    <option [ngValue]="year">{{ year }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Mes *</label>
                <select [(ngModel)]="periodForm.month" class="form-control">
                  <option [ngValue]="null">— Seleccionar mes —</option>
                  @for (month of monthOptions(); track month.value) {
                    <option [ngValue]="month.value">{{ month.label }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Nombre</label>
              <input type="text" [(ngModel)]="periodForm.name" class="form-control" placeholder="Ej: Abril 2026"/>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closePeriodModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingPeriod()" (click)="savePeriod()">
              {{ savingPeriod() ? 'Guardando...' : 'Crear período' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: NUEVO COMPROBANTE
         ══════════════════════════════════════════════════════════════════════ -->
    @if (showJournalModal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingJournalId() ? 'Editar comprobante contable' : 'Nuevo comprobante contable' }}</h3>
            <button class="drawer-close" (click)="closeJournalModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Encabezado del comprobante -->
            <div class="form-row">
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" [(ngModel)]="journalForm.date" class="form-control"/>
              </div>
              <div class="form-group">
                <label>Referencia</label>
                <input type="text" [(ngModel)]="journalForm.reference" class="form-control" placeholder="Ej: FAC-001"/>
              </div>
            </div>

            <div class="form-group">
              <label>Descripción *</label>
              <input type="text" [(ngModel)]="journalForm.description" class="form-control" placeholder="Ej: Registro de ventas del día"/>
            </div>

            <!-- Líneas del asiento -->
            <div class="form-section-title">Líneas del asiento contable</div>

            <div class="lines-table-wrap">
              <table class="lines-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Descripción</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of journalForm.lines; track $index; let i = $index) {
                    <tr>
                      <td>
                        <select [(ngModel)]="line.accountId" class="form-control form-control-sm">
                          <option value="">— Cuenta —</option>
                          @for (acc of allAccounts(); track acc.id) {
                            <option [value]="acc.id">{{ acc.code }} — {{ acc.name }}</option>
                          }
                        </select>
                      </td>
                      <td>
                        <input type="text" [(ngModel)]="line.description" class="form-control form-control-sm" placeholder="Concepto"/>
                      </td>
                      <td>
                        <input type="number" [(ngModel)]="line.debit" (ngModelChange)="recalculateJournalBalance()" class="form-control form-control-sm text-right" placeholder="0" min="0"/>
                      </td>
                      <td>
                        <input type="number" [(ngModel)]="line.credit" (ngModelChange)="recalculateJournalBalance()" class="form-control form-control-sm text-right" placeholder="0" min="0"/>
                      </td>
                      <td>
                        @if (journalForm.lines.length > 2) {
                          <button class="btn-icon btn-icon-danger" (click)="removeLine(i)" title="Eliminar línea">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                            </svg>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="lines-actions">
              <button class="btn btn-secondary btn-sm" (click)="addLine()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
                </svg>
                Agregar línea
              </button>
            </div>

            <!-- Indicador de cuadre en tiempo real -->
            <div class="balance-indicator" [class.balanced]="isBalanced()" [class.unbalanced]="!isBalanced()">
              <div class="balance-row">
                <span>Total Débitos:</span>
                <strong>{{ formatCurrency(journalTotalDebit()) }}</strong>
              </div>
              <div class="balance-row">
                <span>Total Créditos:</span>
                <strong>{{ formatCurrency(journalTotalCredit()) }}</strong>
              </div>
              <div class="balance-status">
                @if (isBalanced()) {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                  </svg>
                  Asiento cuadrado
                } @else {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/>
                  </svg>
                  Diferencia: {{ formatCurrency(Math.abs(journalTotalDebit() - journalTotalCredit())) }}
                }
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeJournalModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="savingJournal() || !isBalanced()" (click)="saveJournal()">
              {{ savingJournal() ? 'Guardando...' : (editingJournalId() ? 'Guardar cambios' : 'Crear comprobante') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: DETALLE DEL COMPROBANTE
         ══════════════════════════════════════════════════════════════════════ -->
    @if (detailJournal()) {
      <div class="modal-overlay">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Comprobante {{ detailJournal()!.number }}</h3>
              <div class="modal-subtitle">{{ detailJournal()!.description }}</div>
            </div>
            <button class="drawer-close" (click)="detailJournal.set(null)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Datos del encabezado -->
            <div class="detail-grid">
              <div class="detail-item"><span>Número</span><strong>{{ detailJournal()!.number }}</strong></div>
              <div class="detail-item"><span>Fecha</span><strong>{{ formatDate(detailJournal()!.date) }}</strong></div>
              <div class="detail-item"><span>Estado</span>
                <strong>
                  <span class="journal-badge journal-{{ detailJournal()!.status.toLowerCase() }}">
                    {{ statusLabel(detailJournal()!.status) }}
                  </span>
                </strong>
              </div>
              <div class="detail-item"><span>Referencia</span><strong>{{ detailJournal()!.reference || '—' }}</strong></div>
            </div>

            <!-- Líneas del asiento -->
            @if (detailJournal()!.lines && detailJournal()!.lines!.length > 0) {
              <div class="detail-section-title">Líneas del asiento</div>
              <table class="data-table detail-lines-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Descripción</th>
                    <th class="text-right">Débito</th>
                    <th class="text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of detailJournal()!.lines; track line.id) {
                    <tr>
                      <td>
                        @if (line.account) {
                          <span class="code-badge code-level-3">{{ line.account.code }}</span>
                          <span class="line-account-name">{{ line.account.name }}</span>
                        } @else { — }
                      </td>
                      <td class="text-muted">{{ line.description || '—' }}</td>
                      <td class="text-right">
                        @if (line.debit > 0) { <strong>{{ formatCurrency(line.debit) }}</strong> }
                        @else { <span class="text-muted">—</span> }
                      </td>
                      <td class="text-right">
                        @if (line.credit > 0) { <strong>{{ formatCurrency(line.credit) }}</strong> }
                        @else { <span class="text-muted">—</span> }
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="2"><strong>TOTALES</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(detailJournal()!.totalDebit ?? 0) }}</strong></td>
                    <td class="text-right"><strong>{{ formatCurrency(detailJournal()!.totalCredit ?? 0) }}</strong></td>
                  </tr>
                </tfoot>
              </table>
            }

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="detailJournal.set(null)">Cerrar</button>
            @if (detailJournal()!.status === 'DRAFT') {
              <button class="btn btn-secondary" (click)="openJournalModal(detailJournal()!)">Editar</button>
              <button class="btn btn-primary" [disabled]="savingJournal()" (click)="postJournal(detailJournal()!)">
                {{ savingJournal() ? 'Procesando...' : 'Contabilizar' }}
              </button>
            }
            @if (detailJournal()!.status === 'POSTED') {
              <button class="btn btn-danger" [disabled]="savingJournal()" (click)="confirmCancel(detailJournal()!)">Anular</button>
            }
          </div>
        </div>
      </div>
    }

    @if (deleteJournalTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>Eliminar comprobante</h3></div>
          <div class="modal-body">
            <p>¿Deseas eliminar el comprobante <strong>{{ deleteJournalTarget()!.number }}</strong>? Solo los comprobantes en borrador pueden eliminarse.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="deleteJournalTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="savingJournal()" (click)="doDeleteJournal()">
              {{ savingJournal() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (deleteAccountTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>Eliminar cuenta</h3></div>
          <div class="modal-body">
            <p>¿Deseas eliminar la cuenta <strong>{{ deleteAccountTarget()!.code }} — {{ deleteAccountTarget()!.name }}</strong>?</p>
            <p>Si la cuenta ya tiene movimientos, el sistema la dejará inactiva para conservar la integridad contable.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="deleteAccountTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="savingAccount()" (click)="doDeleteAccount()">
              {{ savingAccount() ? 'Procesando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: CONFIRMAR ANULACIÓN
         ══════════════════════════════════════════════════════════════════════ -->
    @if (cancelTarget()) {
      <div class="modal-overlay">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>Anular comprobante</h3></div>
          <div class="modal-body">
            <p>¿Estás seguro de anular el comprobante <strong>{{ cancelTarget()!.number }}</strong>? Esta acción no se puede deshacer.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="cancelTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="savingJournal()" (click)="doCancel()">
              {{ savingJournal() ? 'Anulando...' : 'Sí, anular' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ── Contenedor principal ─────────────────────────────────────────────── */
    .page { max-width:1260px; padding-bottom:24px; }

    /* ── Hero shell ───────────────────────────────────────────────────────── */
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .65fr);
      gap:18px;
      margin-bottom:18px;
      padding:22px;
      border-radius:28px;
      background:
        radial-gradient(circle at top left, rgba(127,183,255,.18), transparent 26%),
        radial-gradient(circle at bottom right, rgba(45,212,191,.16), transparent 28%),
        linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0f7a72 100%);
      box-shadow:0 24px 48px rgba(12,28,53,.16);
      color:#fff;
    }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
    .hero-copy { max-width:620px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#a5c8ff;
    }
    .page-title { font-family:'Sora',sans-serif; font-size:32px; line-height:1.02; font-weight:800; color:#fff; margin:0 0 10px; letter-spacing:-.05em; }
    .page-subtitle { font-size:14px; color:rgba(236,244,255,.8); margin:0; line-height:1.6; }
    .hero-aside { display:grid; gap:12px; align-content:start; }
    .hero-highlight {
      padding:18px;
      border-radius:20px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.16);
      backdrop-filter:blur(10px);
    }
    .hero-highlight-label {
      display:block;
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.14em;
      color:#a5c8ff;
      margin-bottom:8px;
    }
    .hero-highlight strong {
      display:block;
      font-family:'Sora',sans-serif;
      font-size:40px;
      line-height:1;
      letter-spacing:-.06em;
      margin-bottom:8px;
    }
    .hero-highlight small {
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
      color:rgba(236,244,255,.72);
      margin-bottom:5px;
    }
    .hero-mini-card strong {
      font-family:'Sora',sans-serif;
      font-size:20px;
      color:#fff;
      letter-spacing:-.04em;
    }

    /* ── Pestañas ─────────────────────────────────────────────────────────── */
    .tabs-bar {
      display:flex;
      gap:6px;
      margin-bottom:18px;
      padding:6px;
      background:#fff;
      border:1px solid #dce6f0;
      border-radius:16px;
      box-shadow:0 8px 20px rgba(12,28,53,.04);
    }
    .tab-btn {
      display:flex;
      align-items:center;
      gap:7px;
      padding:9px 18px;
      border:none;
      border-radius:10px;
      background:transparent;
      cursor:pointer;
      font-size:13.5px;
      font-weight:600;
      color:#64748b;
      transition:all .15s;
    }
    .tab-btn:hover { background:#f0f4f9; color:#1a407e; }
    .tab-btn.active { background:#1a407e; color:#fff; box-shadow:0 4px 12px rgba(26,64,126,.25); }

    /* ── Filtros ──────────────────────────────────────────────────────────── */
    .filters-shell {
      margin-bottom:18px;
      padding:18px;
      border-radius:24px;
      background:rgba(255,255,255,.84);
      border:1px solid #dce6f0;
      box-shadow:0 16px 30px rgba(12,28,53,.05);
      backdrop-filter:blur(10px);
    }
    .filters-head {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }
    .filters-kicker {
      margin:0 0 6px;
      font-size:10px;
      font-weight:800;
      letter-spacing:.14em;
      text-transform:uppercase;
      color:#1a407e;
    }
    .filters-head h3 {
      margin:0;
      font-family:'Sora',sans-serif;
      font-size:18px;
      letter-spacing:-.04em;
      color:#0c1c35;
    }
    .results-pill {
      padding:8px 12px;
      border-radius:999px;
      background:#eff6ff;
      border:1px solid #bfdbfe;
      color:#1d4ed8;
      font-size:12px;
      font-weight:700;
      white-space:nowrap;
    }
    .filters-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; position:relative; max-width:420px; min-width:180px; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; min-height:44px; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; background:#fff; box-shadow:0 8px 20px rgba(12,28,53,.03); }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .search-input--compact { min-height:44px; padding-left:12px; }
    .filter-select { min-height:44px; padding:8px 12px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; background:#fff; color:#374151; box-shadow:0 8px 20px rgba(12,28,53,.03); }

    .panel-grid { display:grid; gap:18px; }
    .panel-card { padding:18px; overflow:visible; }
    .panel-card__header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:12px;
      margin-bottom:16px;
    }
    .panel-card__header h3 { margin:0; font-family:'Sora',sans-serif; font-size:18px; letter-spacing:-.04em; color:#0c1c35; }
    .panel-card__filters { display:flex; gap:12px; flex-wrap:wrap; }
    .panel-card__report-filters { margin-bottom:16px; }
    .report-summary { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-bottom:16px; }
    .report-mini-card { background:#f8fbff; border:1px solid #dce6f0; }
    .report-mini-card strong { color:#0c1c35; }
    .statements-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; }
    .statement-card { border:1px solid #dce6f0; border-radius:18px; padding:16px; background:#fbfdff; }
    .statement-card__head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
    .statement-card__head h4 { margin:0; font-family:'Sora',sans-serif; font-size:16px; color:#0c1c35; }
    .statement-card__head span { font-size:12px; color:#64748b; }
    .statement-section { border-top:1px solid #e8eef8; padding-top:12px; margin-top:12px; }
    .statement-section__title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin-bottom:10px; }
    .statement-row { display:flex; justify-content:space-between; gap:12px; padding:6px 0; font-size:13px; color:#334155; }
    .statement-row strong { color:#0f172a; }
    .statement-row--total { border-top:1px dashed #cbd5e1; margin-top:8px; padding-top:10px; font-weight:700; }
    .statement-row--grand { border-top:2px solid #bfdbfe; margin-top:14px; padding-top:12px; font-size:14px; font-weight:800; color:#1a407e; }
    .check-inline {
      display:inline-flex;
      align-items:center;
      gap:8px;
      font-size:13px;
      color:#475569;
      min-height:44px;
    }

    /* ── Tabla ────────────────────────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; box-shadow:0 16px 28px rgba(12,28,53,.05); }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:14px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .text-right { text-align:right; }

    /* ── Badges de cuentas ────────────────────────────────────────────────── */
    .code-badge {
      font-family:monospace;
      font-size:13px;
      font-weight:700;
      padding:3px 8px;
      border-radius:6px;
    }
    .code-level-1 { background:#e0e7ff; color:#4338ca; }
    .code-level-2 { background:#dbeafe; color:#1e40af; }
    .code-level-3 { background:#d1fae5; color:#065f46; }
    .code-level-4 { background:#fef3c7; color:#92400e; }
    .acc-name { font-weight:500; color:#0c1c35; font-size:14px; }
    .level-badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:6px; white-space:nowrap; }
    .level-1 { background:#e0e7ff; color:#4338ca; }
    .level-2 { background:#dbeafe; color:#1e40af; }
    .level-3 { background:#d1fae5; color:#065f46; }
    .level-4 { background:#fef3c7; color:#92400e; }
    .nature-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px; }
    .nature-badge.debit  { background:#dbeafe; color:#1e40af; }
    .nature-badge.credit { background:#fce7f3; color:#9d174d; }
    .parent-ref { font-size:12px; color:#64748b; font-family:monospace; }
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge.active { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }

    /* ── Badges de comprobantes ───────────────────────────────────────────── */
    .journal-number { font-family:monospace; font-weight:700; font-size:14px; color:#1a407e; }
    .journal-desc { max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; color:#0c1c35; }
    .journal-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px; white-space:nowrap; }
    .journal-draft { background:#f3f4f6; color:#6b7280; }
    .journal-posted { background:#d1fae5; color:#065f46; }
    .journal-cancelled { background:#fee2e2; color:#991b1b; }

    /* ── Acciones de la tabla ─────────────────────────────────────────────── */
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#9ca3af; transition:all .15s; box-shadow:0 6px 16px rgba(12,28,53,.03); display:inline-flex; align-items:center; justify-content:center; }
    .btn-icon:hover { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
    .btn-icon-success:hover { background:#d1fae5; color:#059669; border-color:#6ee7b7; }

    /* ── Paginación ───────────────────────────────────────────────────────── */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; display:flex; align-items:center; justify-content:center; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* ── Skeleton ─────────────────────────────────────────────────────────── */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }
    .text-muted { color:#9ca3af; }

    /* ── Modal ────────────────────────────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-lg { max-width:820px; }
    .modal-sm { max-width:400px; }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-subtitle { font-size:13px; color:#9ca3af; margin-top:4px; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }
    .drawer-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; margin-left:auto; }
    .drawer-close:hover { background:#f0f4f8; color:#374151; }

    /* ── Formulario ───────────────────────────────────────────────────────── */
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control-sm { padding:6px 10px; font-size:13px; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

    /* ── Tabla de líneas del asiento ──────────────────────────────────────── */
    .lines-table-wrap { overflow-x:auto; margin-bottom:10px; border:1px solid #dce6f0; border-radius:10px; }
    .lines-table { width:100%; border-collapse:collapse; }
    .lines-table th { padding:9px 12px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .lines-table td { padding:8px 10px; border-bottom:1px solid #f0f4f8; }
    .lines-table tr:last-child td { border-bottom:none; }
    .lines-actions { margin-bottom:16px; }

    /* ── Indicador de cuadre ──────────────────────────────────────────────── */
    .balance-indicator {
      display:flex;
      align-items:center;
      gap:20px;
      padding:14px 18px;
      border-radius:12px;
      border:2px solid;
      font-size:13.5px;
      flex-wrap:wrap;
    }
    .balance-indicator.balanced { background:#f0fdf4; border-color:#86efac; color:#166534; }
    .balance-indicator.unbalanced { background:#fef2f2; border-color:#fca5a5; color:#991b1b; }
    .balance-row { display:flex; gap:8px; align-items:center; }
    .balance-row strong { font-family:monospace; font-size:14px; }
    .balance-status { display:flex; align-items:center; gap:6px; font-weight:700; margin-left:auto; }

    /* ── Detalle del comprobante ──────────────────────────────────────────── */
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin:16px 0 10px; }
    .detail-lines-table tfoot td { padding:12px 16px; border-top:2px solid #dce6f0; background:#f8fbff; }
    .totals-row td { font-weight:700; color:#0c1c35; }
    .line-account-name { margin-left:8px; font-size:13px; color:#374151; }

    /* ── Botones ──────────────────────────────────────────────────────────── */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-sm { padding:7px 14px; font-size:13px; }

    /* ── Animación de entrada ─────────────────────────────────────────────── */
    .animate-in { animation:fadeUp .3s ease both; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

    /* ── Responsive ───────────────────────────────────────────────────────── */
    @media (max-width: 768px) {
      .hero-shell { grid-template-columns:1fr; padding:18px; border-radius:24px; }
      .page-title { font-size:26px; }
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header .btn { width:100%; justify-content:center; }
      .hero-mini-grid { grid-template-columns:repeat(3, minmax(0, 1fr)); }
      .filters-head { flex-direction:column; align-items:flex-start; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .panel-card__header { flex-direction:column; align-items:stretch; }
      .panel-card__filters { width:100%; }
      .report-summary { grid-template-columns:1fr; }
      .statements-grid { grid-template-columns:1fr; }
      .form-row { grid-template-columns:1fr; }
      .detail-grid { grid-template-columns:1fr; }
    }
    @media (max-width: 640px) {
      .hero-shell { padding:16px; gap:14px; }
      .hero-mini-grid { grid-template-columns:1fr 1fr; }
      .filters-shell { padding:14px; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:560px; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
      .balance-indicator { flex-direction:column; align-items:flex-start; gap:8px; }
      .balance-status { margin-left:0; }
    }
  `]
})
export class AccountingComponent implements OnInit {

  // ── URLs base ────────────────────────────────────────────────────────────────
  private readonly ACCOUNTS_API = `${environment.apiUrl}/accounting/accounts`;
  private readonly JOURNALS_API = `${environment.apiUrl}/accounting/journal-entries`;
  private readonly PERIODS_API = `${environment.apiUrl}/accounting/periods`;
  private readonly TRIAL_BALANCE_API = `${environment.apiUrl}/accounting/reports/trial-balance`;
  private readonly GENERAL_LEDGER_API = `${environment.apiUrl}/accounting/reports/general-ledger`;
  private readonly ACCOUNT_AUXILIARY_API = `${environment.apiUrl}/accounting/reports/account-auxiliary`;
  private readonly FINANCIAL_STATEMENTS_API = `${environment.apiUrl}/accounting/reports/financial-statements`;

  // ── Pestaña activa ───────────────────────────────────────────────────────────
  activeTab = signal<AccountingTab>('accounts');

  // ── Plan de cuentas ──────────────────────────────────────────────────────────
  accounts       = signal<Account[]>([]);
  allAccounts    = signal<Account[]>([]);  // catálogo completo para selectores
  loadingAccounts = signal(true);
  savingAccount   = signal(false);
  totalAccounts   = signal(0);
  accountPage     = signal(1);
  accountTotalPages = signal(1);
  accountSearch   = '';
  filterLevel     = '';
  filterAccountActive = '';
  private accountSearchTimer: any;

  // ── Modal de cuenta ──────────────────────────────────────────────────────────
  showAccountModal  = signal(false);
  editingAccountId  = signal<string | null>(null);
  accountForm: AccountForm = this.emptyAccountForm();

  // ── Períodos contables y reportes ────────────────────────────────────────────
  periods = signal<AccountingPeriod[]>([]);
  loadingPeriods = signal(false);
  savingPeriod = signal(false);
  showPeriodModal = signal(false);
  periodForm: PeriodForm = this.emptyPeriodForm();
  periodFilterYear = '';
  periodFilterStatus = '';
  trialBalance = signal<TrialBalanceRow[]>([]);
  loadingTrialBalance = signal(false);
  trialBalanceTotals = signal({ debit: 0, credit: 0, balance: 0 });
  trialBalanceDateFrom = '';
  trialBalanceDateTo = '';
  trialBalanceLevel = '';
  trialBalanceSearch = '';
  trialBalanceIncludeZero = false;
  generalLedger = signal<GeneralLedgerRow[]>([]);
  loadingGeneralLedger = signal(false);
  generalLedgerTotals = signal({ openingBalance: 0, periodDebit: 0, periodCredit: 0, endingBalance: 0 });
  accountAuxiliary = signal<AccountAuxiliaryResponse | null>(null);
  loadingAccountAuxiliary = signal(false);
  accountAuxiliaryAccountId = '';
  financialStatements = signal<FinancialStatementsResponse | null>(null);
  loadingFinancialStatements = signal(false);

  // ── Comprobantes ─────────────────────────────────────────────────────────────
  journals       = signal<JournalEntry[]>([]);
  loadingJournals = signal(false);
  savingJournal   = signal(false);
  totalJournals   = signal(0);
  journalPage     = signal(1);
  journalTotalPages = signal(1);
  journalSearch   = '';
  filterJournalStatus = '';
  filterDateFrom  = '';
  filterDateTo    = '';
  private journalSearchTimer: any;

  // ── KPIs de comprobantes ─────────────────────────────────────────────────────
  postedCount = computed(() => this.journals().filter(j => j.status === 'POSTED').length);
  draftCount  = computed(() => this.journals().filter(j => j.status === 'DRAFT').length);
  // ── Modales de comprobante ───────────────────────────────────────────────────
  showJournalModal = signal(false);
  editingJournalId = signal<string | null>(null);
  detailJournal    = signal<JournalEntry | null>(null);
  cancelTarget     = signal<JournalEntry | null>(null);
  deleteJournalTarget = signal<DeleteJournalTarget | null>(null);
  deleteAccountTarget = signal<Account | null>(null);
  journalForm: JournalForm = this.emptyJournalForm();
  journalTotalDebit = signal(0);
  journalTotalCredit = signal(0);
  journalIsBalanced = signal(false);

  // Exponemos Math para el template
  readonly Math = Math;
  readonly limit = 20;

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.initializeTrialBalanceRange();
    this.loadAccounts();
    this.loadAllAccounts();
    this.loadJournals();
    this.loadPeriods();
    this.loadTrialBalance();
    this.loadGeneralLedger();
    this.loadFinancialStatements();
    this.recalculateJournalBalance();
  }

  // ── Cambio de pestaña ────────────────────────────────────────────────────────

  switchTab(tab: AccountingTab) {
    this.activeTab.set(tab);
  }

  openPrimaryAction() {
    if (this.activeTab() === 'accounts') {
      this.openAccountModal();
      return;
    }

    if (this.activeTab() === 'journals') {
      this.openJournalModal();
      return;
    }

    this.openPeriodModal();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PLAN DE CUENTAS
  // ══════════════════════════════════════════════════════════════════════════════

  loadAccounts() {
    this.loadingAccounts.set(true);
    const params: Record<string, string> = {
      page:  String(this.accountPage()),
      limit: String(this.limit),
    };
    if (this.accountSearch)      params['search']   = this.accountSearch;
    if (this.filterLevel)        params['level']    = this.filterLevel;
    if (this.filterAccountActive) params['isActive'] = this.filterAccountActive;

    this.http.get<PaginatedResponse<Account>>(this.ACCOUNTS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.accounts.set(data ?? []);
        this.totalAccounts.set(total ?? 0);
        this.accountTotalPages.set(totalPages ?? 1);
        this.loadingAccounts.set(false);
      },
      error: (e) => {
        this.loadingAccounts.set(false);
        this.notify.error(e?.error?.message ?? 'Error al cargar el plan de cuentas');
      },
    });
  }

  /** Carga todas las cuentas sin paginación para los selectores de cuenta padre y líneas */
  private loadAllAccounts() {
    this.http.get<PaginatedResponse<Account>>(this.ACCOUNTS_API, { params: { limit: '1000' } }).subscribe({
      next: ({ data }) => this.allAccounts.set(data ?? []),
      error: () => { /* no bloqueante */ },
    });
  }

  onAccountSearch() {
    clearTimeout(this.accountSearchTimer);
    this.accountSearchTimer = setTimeout(() => { this.accountPage.set(1); this.loadAccounts(); }, 350);
  }

  setAccountPage(p: number) { this.accountPage.set(p); this.loadAccounts(); }

  accountPageRange(): number[] {
    const tp = this.accountTotalPages(), cp = this.accountPage();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  openAccountModal(account?: Account) {
    if (account) {
      this.editingAccountId.set(account.id);
      this.accountForm = {
        code:     account.code,
        name:     account.name,
        level:    account.level,
        parentId: account.parentId ?? '',
        nature:   account.nature,
      };
    } else {
      this.editingAccountId.set(null);
      this.accountForm = this.emptyAccountForm();
    }
    this.showAccountModal.set(true);
  }

  closeAccountModal() {
    this.showAccountModal.set(false);
    this.editingAccountId.set(null);
    this.accountForm = this.emptyAccountForm();
  }

  saveAccount() {
    const f = this.accountForm;
    if (!f.code?.trim() || !f.name?.trim() || !f.level || !f.nature) {
      this.notify.warning('Código, nombre, nivel y naturaleza son obligatorios');
      return;
    }
    if (Number(f.level) === 1 && f.parentId) {
      this.notify.warning('Las cuentas de nivel 1 no deben tener cuenta padre');
      return;
    }
    if (Number(f.level) > 1 && !f.parentId) {
      this.notify.warning(`Las cuentas de nivel ${f.level} deben tener cuenta padre`);
      return;
    }
    this.savingAccount.set(true);
    const body: Record<string, any> = {
      code:     f.code.trim(),
      name:     f.name.trim(),
      level:    Number(f.level),
      nature:   f.nature,
      parentId: f.parentId || undefined,
    };

    const req = this.editingAccountId()
      ? this.http.put<Account>(`${this.ACCOUNTS_API}/${this.editingAccountId()}`, body)
      : this.http.post<Account>(this.ACCOUNTS_API, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingAccountId() ? 'Cuenta actualizada' : 'Cuenta creada');
        this.savingAccount.set(false);
        this.closeAccountModal();
        this.loadAccounts();
        this.loadAllAccounts();
      },
      error: (e) => {
        this.savingAccount.set(false);
        this.notify.error(e?.error?.message ?? 'Error al guardar la cuenta');
      },
    });
  }

  toggleAccount(account: Account) {
    this.http.patch(`${this.ACCOUNTS_API}/${account.id}/toggle`, {}).subscribe({
      next: () => {
        this.notify.success(account.isActive ? 'Cuenta desactivada' : 'Cuenta activada');
        this.loadAccounts();
      },
      error: (e) => this.notify.error(e?.error?.message ?? 'Error al cambiar estado'),
    });
  }

  confirmDeleteAccount(account: Account) {
    this.deleteAccountTarget.set(account);
  }

  doDeleteAccount() {
    const account = this.deleteAccountTarget();
    if (!account) return;
    this.savingAccount.set(true);
    this.http.delete(`${this.ACCOUNTS_API}/${account.id}`).subscribe({
      next: () => {
        this.notify.success('Cuenta procesada correctamente');
        this.savingAccount.set(false);
        this.deleteAccountTarget.set(null);
        this.loadAccounts();
        this.loadAllAccounts();
      },
      error: (e) => {
        this.savingAccount.set(false);
        this.notify.error(e?.error?.message ?? 'Error al eliminar la cuenta');
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PERÍODOS CONTABLES Y BALANCE DE PRUEBA
  // ══════════════════════════════════════════════════════════════════════════════

  loadPeriods() {
    this.loadingPeriods.set(true);
    const params: Record<string, string> = {};
    if (this.periodFilterYear) params['year'] = this.periodFilterYear;
    if (this.periodFilterStatus) params['status'] = this.periodFilterStatus;

    this.http.get<AccountingPeriod[]>(this.PERIODS_API, { params }).subscribe({
      next: (data) => {
        this.periods.set(data ?? []);
        this.loadingPeriods.set(false);
      },
      error: (e) => {
        this.loadingPeriods.set(false);
        this.notify.error(e?.error?.message ?? 'Error al cargar períodos contables');
      },
    });
  }

  openPeriodModal() {
    this.periodForm = this.emptyPeriodForm();
    this.showPeriodModal.set(true);
  }

  closePeriodModal() {
    this.showPeriodModal.set(false);
    this.periodForm = this.emptyPeriodForm();
  }

  savePeriod() {
    if (!this.periodForm.year || !this.periodForm.month) {
      this.notify.warning('Debes seleccionar año y mes del período');
      return;
    }

    this.savingPeriod.set(true);
    const body = {
      year: this.periodForm.year,
      month: this.periodForm.month,
      name: this.periodForm.name.trim() || undefined,
    };

    this.http.post<AccountingPeriod>(this.PERIODS_API, body).subscribe({
      next: () => {
        this.notify.success('Período contable creado');
        this.savingPeriod.set(false);
        this.closePeriodModal();
        this.loadPeriods();
      },
      error: (e) => {
        this.savingPeriod.set(false);
        this.notify.error(e?.error?.message ?? 'Error al crear el período');
      },
    });
  }

  closePeriod(period: AccountingPeriod) {
    if (!confirm(`¿Deseas cerrar el período ${period.name}? No debe tener comprobantes en borrador.`)) {
      return;
    }

    this.savingPeriod.set(true);
    this.http.patch<AccountingPeriod>(`${this.PERIODS_API}/${period.id}/close`, {}).subscribe({
      next: () => {
        this.notify.success('Período cerrado correctamente');
        this.savingPeriod.set(false);
        this.loadPeriods();
      },
      error: (e) => {
        this.savingPeriod.set(false);
        this.notify.error(e?.error?.message ?? 'Error al cerrar el período');
      },
    });
  }

  reopenPeriod(period: AccountingPeriod) {
    if (!confirm(`¿Deseas reabrir el período ${period.name}?`)) {
      return;
    }

    this.savingPeriod.set(true);
    this.http.patch<AccountingPeriod>(`${this.PERIODS_API}/${period.id}/reopen`, {}).subscribe({
      next: () => {
        this.notify.success('Período reabierto');
        this.savingPeriod.set(false);
        this.loadPeriods();
      },
      error: (e) => {
        this.savingPeriod.set(false);
        this.notify.error(e?.error?.message ?? 'Error al reabrir el período');
      },
    });
  }

  lockPeriod(period: AccountingPeriod) {
    if (!confirm(`¿Deseas bloquear el período ${period.name}?`)) {
      return;
    }

    this.savingPeriod.set(true);
    this.http.patch<AccountingPeriod>(`${this.PERIODS_API}/${period.id}/lock`, {}).subscribe({
      next: () => {
        this.notify.success('Período bloqueado');
        this.savingPeriod.set(false);
        this.loadPeriods();
      },
      error: (e) => {
        this.savingPeriod.set(false);
        this.notify.error(e?.error?.message ?? 'Error al bloquear el período');
      },
    });
  }

  unlockPeriod(period: AccountingPeriod) {
    if (!confirm(`¿Deseas desbloquear el período ${period.name}?`)) {
      return;
    }

    this.savingPeriod.set(true);
    this.http.patch<AccountingPeriod>(`${this.PERIODS_API}/${period.id}/unlock`, {}).subscribe({
      next: () => {
        this.notify.success('Período desbloqueado');
        this.savingPeriod.set(false);
        this.loadPeriods();
      },
      error: (e) => {
        this.savingPeriod.set(false);
        this.notify.error(e?.error?.message ?? 'Error al desbloquear el período');
      },
    });
  }

  loadTrialBalance() {
    if (!this.trialBalanceDateFrom || !this.trialBalanceDateTo) {
      this.notify.warning('Selecciona un rango de fechas para generar el balance de prueba');
      return;
    }

    this.loadingTrialBalance.set(true);
    const params: Record<string, string> = {
      dateFrom: this.trialBalanceDateFrom,
      dateTo: this.trialBalanceDateTo,
      includeZero: String(this.trialBalanceIncludeZero),
    };
    if (this.trialBalanceLevel) params['level'] = this.trialBalanceLevel;
    if (this.trialBalanceSearch.trim()) params['search'] = this.trialBalanceSearch.trim();

    this.http.get<TrialBalanceResponse>(this.TRIAL_BALANCE_API, { params }).subscribe({
      next: (response) => {
        this.trialBalance.set(response.data ?? []);
        this.trialBalanceTotals.set(response.totals ?? { debit: 0, credit: 0, balance: 0 });
        this.loadingTrialBalance.set(false);
      },
      error: (e) => {
        this.loadingTrialBalance.set(false);
        this.notify.error(e?.error?.message ?? 'Error al generar el balance de prueba');
      },
    });
  }

  loadGeneralLedger() {
    if (!this.trialBalanceDateFrom || !this.trialBalanceDateTo) {
      this.notify.warning('Selecciona un rango de fechas para generar el libro mayor');
      return;
    }

    this.loadingGeneralLedger.set(true);
    const params: Record<string, string> = {
      dateFrom: this.trialBalanceDateFrom,
      dateTo: this.trialBalanceDateTo,
      includeZero: String(this.trialBalanceIncludeZero),
    };
    if (this.trialBalanceLevel) params['level'] = this.trialBalanceLevel;
    if (this.trialBalanceSearch.trim()) params['search'] = this.trialBalanceSearch.trim();

    this.http.get<GeneralLedgerResponse>(this.GENERAL_LEDGER_API, { params }).subscribe({
      next: (response) => {
        this.generalLedger.set(response.data ?? []);
        this.generalLedgerTotals.set(
          response.totals ?? { openingBalance: 0, periodDebit: 0, periodCredit: 0, endingBalance: 0 },
        );
        this.loadingGeneralLedger.set(false);
      },
      error: (e) => {
        this.loadingGeneralLedger.set(false);
        this.notify.error(e?.error?.message ?? 'Error al generar el libro mayor');
      },
    });
  }

  loadAccountAuxiliary() {
    if (!this.accountAuxiliaryAccountId) {
      this.notify.warning('Selecciona una cuenta para consultar el auxiliar');
      return;
    }

    if (!this.trialBalanceDateFrom || !this.trialBalanceDateTo) {
      this.notify.warning('Selecciona un rango de fechas para consultar el auxiliar');
      return;
    }

    this.loadingAccountAuxiliary.set(true);
    this.http.get<AccountAuxiliaryResponse>(this.ACCOUNT_AUXILIARY_API, {
      params: {
        accountId: this.accountAuxiliaryAccountId,
        dateFrom: this.trialBalanceDateFrom,
        dateTo: this.trialBalanceDateTo,
      },
    }).subscribe({
      next: (response) => {
        this.accountAuxiliary.set(response);
        this.loadingAccountAuxiliary.set(false);
      },
      error: (e) => {
        this.loadingAccountAuxiliary.set(false);
        this.notify.error(e?.error?.message ?? 'Error al consultar el auxiliar');
      },
    });
  }

  loadFinancialStatements() {
    if (!this.trialBalanceDateFrom || !this.trialBalanceDateTo) {
      this.notify.warning('Selecciona un rango de fechas para generar los estados financieros');
      return;
    }

    this.loadingFinancialStatements.set(true);
    const params: Record<string, string> = {
      dateFrom: this.trialBalanceDateFrom,
      dateTo: this.trialBalanceDateTo,
    };
    if (this.trialBalanceLevel) params['level'] = this.trialBalanceLevel;

    this.http.get<FinancialStatementsResponse>(this.FINANCIAL_STATEMENTS_API, { params }).subscribe({
      next: (response) => {
        this.financialStatements.set(response);
        this.loadingFinancialStatements.set(false);
      },
      error: (e) => {
        this.loadingFinancialStatements.set(false);
        this.notify.error(e?.error?.message ?? 'Error al generar los estados financieros');
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPROBANTES CONTABLES
  // ══════════════════════════════════════════════════════════════════════════════

  loadJournals() {
    this.loadingJournals.set(true);
    const params: Record<string, string> = {
      page:  String(this.journalPage()),
      limit: String(this.limit),
    };
    if (this.journalSearch)        params['search']   = this.journalSearch;
    if (this.filterJournalStatus)  params['status']   = this.filterJournalStatus;
    if (this.filterDateFrom)       params['dateFrom'] = this.filterDateFrom;
    if (this.filterDateTo)         params['dateTo']   = this.filterDateTo;

    this.http.get<PaginatedResponse<JournalEntry>>(this.JOURNALS_API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.journals.set(data ?? []);
        this.totalJournals.set(total ?? 0);
        this.journalTotalPages.set(totalPages ?? 1);
        this.loadingJournals.set(false);
      },
      error: (e) => {
        this.loadingJournals.set(false);
        this.notify.error(e?.error?.message ?? 'Error al cargar comprobantes');
      },
    });
  }

  onJournalSearch() {
    clearTimeout(this.journalSearchTimer);
    this.journalSearchTimer = setTimeout(() => { this.journalPage.set(1); this.loadJournals(); }, 350);
  }

  setJournalPage(p: number) { this.journalPage.set(p); this.loadJournals(); }

  journalPageRange(): number[] {
    const tp = this.journalTotalPages(), cp = this.journalPage();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  openJournalModal(entry?: JournalEntry) {
    if (!entry) {
      this.editingJournalId.set(null);
      this.journalForm = this.emptyJournalForm();
      this.recalculateJournalBalance();
      this.showJournalModal.set(true);
      return;
    }

    if (entry.status !== 'DRAFT') {
      this.notify.warning('Solo se pueden editar comprobantes en borrador');
      return;
    }

    const openWithEntry = (full: JournalEntry) => {
      this.editingJournalId.set(full.id);
      this.journalForm = {
        date: this.asInputDate(full.date),
        description: full.description ?? '',
        reference: full.reference ?? '',
        lines: (full.lines ?? []).map((line) => ({
          accountId: line.accountId,
          description: line.description ?? '',
          debit: Number(line.debit ?? 0) || null,
          credit: Number(line.credit ?? 0) || null,
        })),
      };
      this.recalculateJournalBalance();
      this.showJournalModal.set(true);
    };

    if (!entry.lines) {
      this.http.get<JournalEntry>(`${this.JOURNALS_API}/${entry.id}`).subscribe({
        next: (full) => openWithEntry(full),
        error: (e) => this.notify.error(e?.error?.message ?? 'No fue posible cargar el comprobante para editar'),
      });
      return;
    }

    openWithEntry(entry);
  }

  closeJournalModal() {
    this.showJournalModal.set(false);
    this.editingJournalId.set(null);
    this.journalForm = this.emptyJournalForm();
    this.recalculateJournalBalance();
  }

  addLine() {
    this.journalForm.lines.push({ accountId: '', description: '', debit: null, credit: null });
    this.recalculateJournalBalance();
  }

  removeLine(index: number) {
    this.journalForm.lines.splice(index, 1);
    this.recalculateJournalBalance();
  }

  saveJournal() {
    const f = this.journalForm;
    if (!f.date || !f.description?.trim()) {
      this.notify.warning('Fecha y descripción son obligatorias');
      return;
    }
    if (!this.isBalanced()) {
      this.notify.warning('El asiento debe estar cuadrado antes de guardar');
      return;
    }
    // Validar que todas las líneas tengan cuenta asignada
    const linesInvalid = f.lines.some(l => !l.accountId);
    if (linesInvalid) {
      this.notify.warning('Todas las líneas deben tener una cuenta asignada');
      return;
    }

    this.savingJournal.set(true);
    const body = {
      date:        f.date,
      description: f.description.trim(),
      reference:   f.reference?.trim() || undefined,
      lines: f.lines.map((l, index) => ({
        accountId:   l.accountId,
        description: l.description?.trim() || undefined,
        debit:       Number(l.debit)  || 0,
        credit:      Number(l.credit) || 0,
        position:    index + 1,
      })),
    };

    const request$ = this.editingJournalId()
      ? this.http.put<JournalEntry>(`${this.JOURNALS_API}/${this.editingJournalId()}`, body)
      : this.http.post<JournalEntry>(this.JOURNALS_API, body);

    request$.subscribe({
      next: () => {
        this.notify.success(this.editingJournalId() ? 'Comprobante actualizado exitosamente' : 'Comprobante creado exitosamente');
        this.savingJournal.set(false);
        this.closeJournalModal();
        this.loadJournals();
      },
      error: (e) => {
        this.savingJournal.set(false);
        this.notify.error(e?.error?.message ?? 'Error al crear el comprobante');
      },
    });
  }

  openDetail(je: JournalEntry) {
    // Cargar detalle completo con líneas
    this.http.get<JournalEntry>(`${this.JOURNALS_API}/${je.id}`).subscribe({
      next: (data) => this.detailJournal.set(data),
      error: () => this.detailJournal.set(je), // fallback al dato que ya tenemos
    });
  }

  postJournal(je: JournalEntry) {
    this.savingJournal.set(true);
    this.http.patch(`${this.JOURNALS_API}/${je.id}/post`, {}).subscribe({
      next: () => {
        this.notify.success('Comprobante contabilizado');
        this.savingJournal.set(false);
        this.detailJournal.set(null);
        this.loadJournals();
      },
      error: (e) => {
        this.savingJournal.set(false);
        this.notify.error(e?.error?.message ?? 'Error al contabilizar');
      },
    });
  }

  confirmCancel(je: JournalEntry) {
    this.cancelTarget.set(je);
  }

  doCancel() {
    const je = this.cancelTarget();
    if (!je) return;
    this.savingJournal.set(true);
    this.http.patch(`${this.JOURNALS_API}/${je.id}/cancel`, {}).subscribe({
      next: () => {
        this.notify.success('Comprobante anulado');
        this.savingJournal.set(false);
        this.cancelTarget.set(null);
        this.detailJournal.set(null);
        this.loadJournals();
      },
      error: (e) => {
        this.savingJournal.set(false);
        this.notify.error(e?.error?.message ?? 'Error al anular el comprobante');
      },
    });
  }

  confirmDeleteJournal(je: JournalEntry) {
    this.deleteJournalTarget.set({ id: je.id, number: je.number });
  }

  doDeleteJournal() {
    const target = this.deleteJournalTarget();
    if (!target) return;
    this.savingJournal.set(true);
    this.http.delete(`${this.JOURNALS_API}/${target.id}`).subscribe({
      next: () => {
        this.notify.success('Comprobante eliminado');
        this.savingJournal.set(false);
        this.deleteJournalTarget.set(null);
        this.detailJournal.set(null);
        this.loadJournals();
      },
      error: (e) => {
        this.savingJournal.set(false);
        this.notify.error(e?.error?.message ?? 'Error al eliminar el comprobante');
      },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  levelLabel(level: number): string {
    return LEVEL_LABELS[level] ?? '';
  }

  statusLabel(status: JournalStatus): string {
    const map: Record<JournalStatus, string> = {
      DRAFT:     'Borrador',
      POSTED:    'Contabilizado',
      CANCELLED: 'Anulado',
    };
    return map[status] ?? status;
  }

  periodYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - 2 + index);
  }

  monthOptions() {
    return [
      { value: 1, label: 'Enero' },
      { value: 2, label: 'Febrero' },
      { value: 3, label: 'Marzo' },
      { value: 4, label: 'Abril' },
      { value: 5, label: 'Mayo' },
      { value: 6, label: 'Junio' },
      { value: 7, label: 'Julio' },
      { value: 8, label: 'Agosto' },
      { value: 9, label: 'Septiembre' },
      { value: 10, label: 'Octubre' },
      { value: 11, label: 'Noviembre' },
      { value: 12, label: 'Diciembre' },
    ];
  }

  padMonth(month: number): string {
    return String(month).padStart(2, '0');
  }

  totalDebit(): number {
    return this.journalTotalDebit();
  }

  totalCredit(): number {
    return this.journalTotalCredit();
  }

  isBalanced(): boolean {
    return this.journalIsBalanced();
  }

  recalculateJournalBalance() {
    const debit = this.journalForm.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = this.journalForm.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    this.journalTotalDebit.set(debit);
    this.journalTotalCredit.set(credit);
    this.journalIsBalanced.set(debit > 0 && credit > 0 && Math.abs(debit - credit) < 0.01);
  }

  /** Formatea un valor numérico como moneda colombiana COP */
  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style:    'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  /** Formatea fecha ISO a formato colombiano dd/MM/yyyy */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  getAvailableParentAccounts(): Account[] {
    const level = Number(this.accountForm.level || 0);
    if (!level || level <= 1) return [];
    return this.allAccounts().filter((acc) => acc.level === level - 1 && acc.id !== this.editingAccountId());
  }

  private asInputDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private initializeTrialBalanceRange() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    this.trialBalanceDateFrom = this.asInputDate(start.toISOString());
    this.trialBalanceDateTo = this.asInputDate(end.toISOString());
  }

  // ── Valores por defecto ───────────────────────────────────────────────────────

  private emptyAccountForm(): AccountForm {
    return { code: '', name: '', level: '', parentId: '', nature: '' };
  }

  private emptyJournalForm(): JournalForm {
    const today = new Date().toISOString().split('T')[0];
    return {
      date:        today,
      description: '',
      reference:   '',
      lines: [
        { accountId: '', description: '', debit: null, credit: null },
        { accountId: '', description: '', debit: null, credit: null },
      ],
    };
  }

  private emptyPeriodForm(): PeriodForm {
    const current = new Date();
    return {
      year: current.getFullYear(),
      month: current.getMonth() + 1,
      name: '',
    };
  }

  // Escape no cierra los modales — el usuario debe usar el botón X
  @HostListener('document:keydown.escape')
  onEscapeKey() {}
}
