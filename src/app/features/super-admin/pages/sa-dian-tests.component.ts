import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { SaDianTestsService, DianTestSet, DianTestSetDocument } from './sa-dian-tests.service';

interface Company {
  id: string;
  name: string;
  nit: string;
  email: string;
  status: string;
}

@Component({
  selector: 'app-sa-dian-tests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Sets de Pruebas DIAN</h2>
          <p class="page-subtitle">
            Gestión de sets de prueba de Facturación Electrónica y Nómina Electrónica por empresa
          </p>
        </div>
        @if (anyInProgress()) {
          <div class="refresh-indicator">
            <span class="spinner"></span>
            <span>Actualizando cada 10s…</span>
          </div>
        }
      </div>

      <!-- ── Barra de búsqueda ────────────────────────────────── -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchTermModel"
            (ngModelChange)="searchTerm.set($event)"
            placeholder="Buscar empresa o NIT…"
            class="form-control search-input"
          />
        </div>
        <span class="results-count">{{ filteredCompanies().length }} empresa(s)</span>
      </div>

      <!-- ── Loading skeleton ────────────────────────────────── -->
      @if (loading()) {
        <div class="company-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="dian-card dian-card--skeleton">
              <div class="sk sk-avatar"></div>
              <div class="sk sk-line" style="width:70%;margin:12px 0 6px"></div>
              <div class="sk sk-line" style="width:45%;margin-bottom:16px"></div>
              <div class="sk sk-line" style="width:100%;height:10px;margin-bottom:8px"></div>
              <div class="sk sk-line" style="width:100%;height:10px"></div>
            </div>
          }
        </div>
      }

      <!-- ── Sin resultados ──────────────────────────────────── -->
      @if (!loading() && filteredCompanies().length === 0) {
        <div class="empty-state">
          <svg viewBox="0 0 48 48" fill="none" width="44">
            <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
            <path d="M14 34V18l10-6 10 6v16M18 34v-8h4v8M26 34v-8h4v8"
                  stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <p>{{ searchTerm() ? 'Sin resultados para "' + searchTerm() + '"' : 'No hay empresas registradas' }}</p>
        </div>
      }

      <!-- ── Grid de empresas ────────────────────────────────── -->
      @if (!loading() && filteredCompanies().length > 0) {
        <div class="company-grid">
          @for (company of filteredCompanies(); track company.id) {
            <div class="dian-card">

              <!-- Cabecera empresa -->
              <div class="dian-card-header">
                <div class="co-avatar">{{ company.name[0].toUpperCase() }}</div>
                <div class="dian-card-info">
                  <div class="dian-card-name">{{ company.name }}</div>
                  <div class="dian-card-nit">NIT {{ company.nit }}</div>
                </div>
              </div>

              <!-- Facturación -->
              <div class="test-section">
                <div class="test-section-label">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/>
                  </svg>
                  <span>Facturación</span>
                  <span class="doc-count-hint">(50 docs)</span>
                  @if (getLatestTestSet(company.id, 'FACTURACION'); as ts) {
                    <span class="badge" [class]="statusClass(ts.status)">
                      {{ statusLabel(ts.status) }}
                    </span>
                  } @else {
                    <span class="badge badge-muted">Sin iniciar</span>
                  }
                </div>
                @if (getLatestTestSet(company.id, 'FACTURACION'); as ts) {
                  <div class="progress-wrap">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="progressPct(ts)"
                           [class.fill-success]="ts.status === 'COMPLETED'"
                           [class.fill-warning]="ts.status === 'IN_PROGRESS' || ts.status === 'PARTIAL'"
                           [class.fill-danger]="ts.status === 'FAILED'">
                      </div>
                    </div>
                    <span class="progress-label">{{ ts.sentDocs }}/{{ ts.totalDocs }}</span>
                  </div>
                  <div class="test-stats">
                    <span class="stat stat-ok">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/></svg>
                      {{ ts.acceptedDocs }}
                    </span>
                    <span class="stat stat-err">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zM8 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/></svg>
                      {{ ts.rejectedDocs + ts.errorDocs }}
                    </span>
                    @if (ts.startedAt) {
                      <span class="stat stat-date">{{ ts.startedAt | date:'dd/MM/yy HH:mm' }}</span>
                    }
                  </div>
                }
                <div class="test-actions">
                  @if (!getLatestTestSet(company.id, 'FACTURACION') ||
                       getLatestTestSet(company.id, 'FACTURACION')?.status === 'FAILED') {
                    <button class="btn btn-sm btn-primary"
                            (click)="confirmStart(company, 'FACTURACION')"
                            [disabled]="actionLoading()">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
                      </svg>
                      Iniciar
                    </button>
                  }
                  @if (getLatestTestSet(company.id, 'FACTURACION'); as ts) {
                    <button class="btn btn-sm btn-secondary"
                            (click)="openDetail(ts.id)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                      </svg>
                      Ver detalle
                    </button>
                    @if (ts.status !== 'IN_PROGRESS' && ts.status !== 'PENDING') {
                      <button class="btn btn-sm btn-danger"
                              (click)="confirmReset(ts, company.id)"
                              [disabled]="actionLoading()">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
                        </svg>
                        Reiniciar
                      </button>
                    }
                  }
                </div>
              </div>

              <div class="test-divider"></div>

              <!-- Nómina -->
              <div class="test-section">
                <div class="test-section-label">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                  </svg>
                  <span>Nómina</span>
                  <span class="doc-count-hint">(20 docs)</span>
                  @if (getLatestTestSet(company.id, 'NOMINA'); as ts) {
                    <span class="badge" [class]="statusClass(ts.status)">
                      {{ statusLabel(ts.status) }}
                    </span>
                  } @else {
                    <span class="badge badge-muted">Sin iniciar</span>
                  }
                </div>
                @if (getLatestTestSet(company.id, 'NOMINA'); as ts) {
                  <div class="progress-wrap">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="progressPct(ts)"
                           [class.fill-success]="ts.status === 'COMPLETED'"
                           [class.fill-warning]="ts.status === 'IN_PROGRESS' || ts.status === 'PARTIAL'"
                           [class.fill-danger]="ts.status === 'FAILED'">
                      </div>
                    </div>
                    <span class="progress-label">{{ ts.sentDocs }}/{{ ts.totalDocs }}</span>
                  </div>
                  <div class="test-stats">
                    <span class="stat stat-ok">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/></svg>
                      {{ ts.acceptedDocs }}
                    </span>
                    <span class="stat stat-err">
                      <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zM8 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"/></svg>
                      {{ ts.rejectedDocs + ts.errorDocs }}
                    </span>
                    @if (ts.startedAt) {
                      <span class="stat stat-date">{{ ts.startedAt | date:'dd/MM/yy HH:mm' }}</span>
                    }
                  </div>
                }
                <div class="test-actions">
                  @if (!getLatestTestSet(company.id, 'NOMINA') ||
                       getLatestTestSet(company.id, 'NOMINA')?.status === 'FAILED') {
                    <button class="btn btn-sm btn-primary"
                            (click)="confirmStart(company, 'NOMINA')"
                            [disabled]="actionLoading()">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
                      </svg>
                      Iniciar
                    </button>
                  }
                  @if (getLatestTestSet(company.id, 'NOMINA'); as ts) {
                    <button class="btn btn-sm btn-secondary"
                            (click)="openDetail(ts.id)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
                      </svg>
                      Ver detalle
                    </button>
                    @if (ts.status !== 'IN_PROGRESS' && ts.status !== 'PENDING') {
                      <button class="btn btn-sm btn-danger"
                              (click)="confirmReset(ts, company.id)"
                              [disabled]="actionLoading()">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
                        </svg>
                        Reiniciar
                      </button>
                    }
                  }
                </div>
              </div>

            </div>
          }
        </div>
      }
    </div>

    <!-- ════════════════════════════════════════════════════════
         MODAL: Confirmación de inicio
         ════════════════════════════════════════════════════════ -->
    @if (showConfirmModal()) {
      <div class="modal-overlay" (click)="closeConfirmModal()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Iniciar Set de Pruebas</h3>
            <button class="modal-close" (click)="closeConfirmModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="confirm-icon">
              <svg viewBox="0 0 48 48" fill="none" width="40">
                <rect width="48" height="48" rx="12" fill="#eff6ff"/>
                <path d="M24 14v10M24 30h.01" stroke="#1a407e" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="confirm-text">
              ¿Iniciar set de pruebas de
              <strong>{{ confirmType() === 'FACTURACION' ? 'Facturación (50 docs)' : 'Nómina (20 docs)' }}</strong>
              para la empresa
              <strong>{{ confirmCompany()?.name }}</strong>?
            </p>
            <p class="confirm-sub">
              @if (confirmType() === 'FACTURACION') {
                Se generarán y enviarán 30 facturas, 10 notas crédito y 10 notas débito a la DIAN en ambiente de habilitación.
              } @else {
                Se generarán y enviarán 10 nóminas electrónicas individuales y 10 nóminas de ajuste a la DIAN.
              }
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeConfirmModal()">Cancelar</button>
            <button class="btn btn-primary" (click)="executeStart()" [disabled]="actionLoading()">
              @if (actionLoading()) {
                <span class="spinner spinner-sm"></span> Iniciando…
              } @else {
                Confirmar inicio
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════════════
         MODAL: Confirmación de reset
         ════════════════════════════════════════════════════════ -->
    @if (showResetModal()) {
      <div class="modal-overlay" (click)="closeResetModal()">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Reiniciar Set de Pruebas</h3>
            <button class="modal-close" (click)="closeResetModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="confirm-icon">
              <svg viewBox="0 0 48 48" fill="none" width="40">
                <rect width="48" height="48" rx="12" fill="#fff7ed"/>
                <path d="M24 16v8M24 30h.01" stroke="#c2410c" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="confirm-text">
              ¿Eliminar el set de pruebas actual y permitir iniciar uno nuevo?
            </p>
            <p class="confirm-sub">
              Se eliminarán el set y todos sus documentos de la base de datos. Esta acción no puede deshacerse.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeResetModal()">Cancelar</button>
            <button class="btn btn-danger" (click)="executeReset()" [disabled]="actionLoading()">
              @if (actionLoading()) {
                <span class="spinner spinner-sm"></span> Eliminando…
              } @else {
                Confirmar eliminación
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ════════════════════════════════════════════════════════
         MODAL: Detalle del test set
         ════════════════════════════════════════════════════════ -->
    @if (showDetailModal() && selectedTestSet()) {
      <div class="modal-overlay" (click)="closeDetail()">
        <div class="modal modal-xl" (click)="$event.stopPropagation()">

          <!-- Header modal -->
          <div class="modal-header">
            <div class="detail-header-info">
              <h3>Detalle del Set de Pruebas</h3>
              <div class="detail-header-meta">
                <span class="badge" [class]="statusClass(selectedTestSet()!.status)">
                  {{ statusLabel(selectedTestSet()!.status) }}
                </span>
                <span class="badge badge-type">
                  {{ selectedTestSet()!.type === 'FACTURACION' ? 'Facturación' : 'Nómina' }}
                </span>
                @if (selectedTestSet()!.status === 'IN_PROGRESS') {
                  <span class="detail-refresh-badge">
                    <span class="spinner spinner-xs"></span>
                    Actualizando…
                  </span>
                }
              </div>
            </div>
            <button class="modal-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>

          <!-- Resumen -->
          <div class="modal-body">
            <div class="detail-summary">
              <div class="summary-card">
                <div class="summary-val">{{ selectedTestSet()!.totalDocs }}</div>
                <div class="summary-label">Total</div>
              </div>
              <div class="summary-card summary-card--sent">
                <div class="summary-val">{{ selectedTestSet()!.sentDocs }}</div>
                <div class="summary-label">Enviados</div>
              </div>
              <div class="summary-card summary-card--ok">
                <div class="summary-val">{{ selectedTestSet()!.acceptedDocs }}</div>
                <div class="summary-label">Aceptados</div>
              </div>
              <div class="summary-card summary-card--rej">
                <div class="summary-val">{{ selectedTestSet()!.rejectedDocs }}</div>
                <div class="summary-label">Rechazados</div>
              </div>
              <div class="summary-card summary-card--err">
                <div class="summary-val">{{ selectedTestSet()!.errorDocs }}</div>
                <div class="summary-label">Errores</div>
              </div>
            </div>

            <!-- Barra de progreso global -->
            <div class="detail-progress-wrap">
              <div class="detail-progress-bar">
                <div class="detail-progress-fill"
                     [style.width.%]="progressPct(selectedTestSet()!)"
                     [class.fill-success]="selectedTestSet()!.status === 'COMPLETED'"
                     [class.fill-warning]="selectedTestSet()!.status === 'IN_PROGRESS' || selectedTestSet()!.status === 'PARTIAL'"
                     [class.fill-danger]="selectedTestSet()!.status === 'FAILED'">
                </div>
              </div>
              <span class="detail-progress-pct">{{ progressPct(selectedTestSet()!) | number:'1.0-0' }}%</span>
            </div>

            <!-- Fechas -->
            <div class="detail-dates">
              @if (selectedTestSet()!.startedAt) {
                <span class="detail-date">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M5.25 0a.75.75 0 01.75.75V2h4V.75a.75.75 0 011.5 0V2h.25A2.75 2.75 0 0114.5 4.75v8.5A2.75 2.75 0 0111.75 16H4.25A2.75 2.75 0 011.5 13.25v-8.5A2.75 2.75 0 014.25 2H4.5V.75A.75.75 0 015.25 0zm-1 3.5h-.75c-.69 0-1.25.56-1.25 1.25v.5h9.5v-.5c0-.69-.56-1.25-1.25-1.25H4.25z"/></svg>
                  Inicio: {{ selectedTestSet()!.startedAt | date:'dd/MM/yyyy HH:mm' }}
                </span>
              }
              @if (selectedTestSet()!.completedAt) {
                <span class="detail-date">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path fill-rule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/></svg>
                  Completado: {{ selectedTestSet()!.completedAt | date:'dd/MM/yyyy HH:mm' }}
                </span>
              }
            </div>

            <!-- Tabla de documentos -->
            <div class="docs-table-wrap">
              @if (detailLoading()) {
                <div class="docs-loading">
                  @for (i of [1,2,3,4,5]; track i) {
                    <div class="sk-doc-row">
                      <div class="sk" style="width:30px;height:12px"></div>
                      <div class="sk" style="width:140px;height:12px"></div>
                      <div class="sk" style="width:70px;height:20px;border-radius:8px"></div>
                      <div class="sk" style="width:60px;height:12px"></div>
                      <div class="sk" style="width:200px;height:12px"></div>
                    </div>
                  }
                </div>
              } @else if (!selectedTestSet()!.documents?.length) {
                <div class="docs-empty">
                  <svg viewBox="0 0 48 48" fill="none" width="36">
                    <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
                    <path d="M16 12h16v24H16z" stroke="#94a3b8" stroke-width="1.5"/>
                    <path d="M20 18h8M20 22h8M20 26h5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                  <p>No hay documentos cargados aún</p>
                </div>
              } @else {
                <table class="docs-table">
                  <thead>
                    <tr>
                      <th class="th-narrow">#</th>
                      <th>Tipo</th>
                      <th>Estado DIAN</th>
                      <th class="th-narrow">Código</th>
                      <th>Mensaje / Errores DIAN</th>
                      <th>ZipKey</th>
                      <th>Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (doc of selectedTestSet()!.documents; track doc.id) {
                      <tr [class.doc-row--ok]="doc.status === 'ACCEPTED'"
                          [class.doc-row--rej]="doc.status === 'REJECTED' || (doc.status === 'SENT' && doc.dianStatusCode && doc.dianStatusCode !== '00')"
                          [class.doc-row--err]="doc.status === 'ERROR'">
                        <td class="td-seq">{{ doc.sequence }}</td>
                        <td>
                          <span class="doc-type-badge">{{ docTypeLabel(doc.docType) }}</span>
                        </td>
                        <td>
                          <span class="badge" [class]="docStatusClass(doc.status, doc.dianStatusCode)">
                            {{ docStatusLabel(doc.status, doc.dianStatusCode) }}
                          </span>
                        </td>
                        <td class="td-code">
                          @if (doc.dianStatusCode) {
                            <code>{{ doc.dianStatusCode }}</code>
                          } @else {
                            <span class="text-muted">–</span>
                          }
                        </td>
                        <td class="td-msg">
                          @if (doc.dianStatusMsg) {
                            <span class="doc-msg" [title]="doc.dianStatusMsg">{{ doc.dianStatusMsg }}</span>
                          } @else if (doc.errorMsg) {
                            <span class="doc-msg doc-msg--err" [title]="doc.errorMsg">{{ doc.errorMsg }}</span>
                          } @else {
                            <span class="text-muted">–</span>
                          }
                        </td>
                        <td class="td-zipkey">
                          @if (doc.dianZipKey) {
                            <code class="zipkey-code" [title]="doc.dianZipKey">
                              {{ doc.dianZipKey | slice:0:12 }}…
                            </code>
                          } @else {
                            <span class="text-muted">–</span>
                          }
                        </td>
                        <td class="td-date">
                          @if (doc.sentAt) {
                            {{ doc.sentAt | date:'dd/MM/yy HH:mm' }}
                          } @else {
                            <span class="text-muted">–</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>

          <!-- Footer modal -->
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeDetail()">Cerrar</button>
            @if (selectedTestSet()!.status === 'IN_PROGRESS' ||
                 selectedTestSet()!.status === 'PARTIAL' ||
                 selectedTestSet()!.status === 'COMPLETED') {
              <button class="btn btn-primary"
                      (click)="checkStatuses()"
                      [disabled]="checkLoading()">
                @if (checkLoading()) {
                  <span class="spinner spinner-sm"></span> Verificando…
                } @else {
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
                  </svg>
                  Verificar estados DIAN
                }
              </button>
            }
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    /* ─── Animación entrada ─────────────────────────────────── */
    .animate-in { animation: fadeSlideIn .25s ease; }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─── Page layout ───────────────────────────────────────── */
    .page { display: flex; flex-direction: column; gap: 20px; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      flex-wrap: wrap; gap: 12px;
    }
    .page-title {
      font-size: 22px; font-weight: 700; color: #0c1c35;
      font-family: 'Sora', sans-serif; margin: 0 0 4px;
    }
    .page-subtitle { font-size: 13.5px; color: #6b7280; margin: 0; }

    /* Indicador auto-refresh */
    .refresh-indicator {
      display: flex; align-items: center; gap: 8px;
      background: #eff6ff; border: 1px solid #bfdbfe;
      color: #1a407e; padding: 7px 14px; border-radius: 9999px;
      font-size: 12.5px; font-weight: 600;
    }

    /* ─── Spinner ───────────────────────────────────────────── */
    .spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid currentColor; border-top-color: transparent;
      border-radius: 50%; animation: spin .7s linear infinite;
    }
    .spinner-sm { width: 12px; height: 12px; border-width: 2px; }
    .spinner-xs { width: 10px; height: 10px; border-width: 1.5px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ─── Filtros ───────────────────────────────────────────── */
    .filters-bar {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .search-wrap {
      position: relative; flex: 1; min-width: 240px;
    }
    .search-icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      color: #94a3b8; pointer-events: none;
    }
    .search-input { padding-left: 32px; }
    .results-count {
      font-size: 12.5px; color: #94a3b8; white-space: nowrap;
    }

    /* ─── Form controls ─────────────────────────────────────── */
    .form-control {
      width: 100%; padding: 8px 12px; border: 1.5px solid #dce6f0;
      border-radius: 8px; font-size: 13.5px; color: #1e293b;
      background: #fff; outline: none; transition: border-color .15s;
      box-sizing: border-box;
    }
    .form-control:focus { border-color: #1a407e; }

    /* ─── Skeleton ──────────────────────────────────────────── */
    .sk {
      background: linear-gradient(90deg, #f0f4f9 25%, #e2e8f0 50%, #f0f4f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite; border-radius: 6px;
    }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .sk-avatar { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; }
    .sk-line   { height: 13px; }
    .dian-card--skeleton {
      display: flex; flex-direction: column; gap: 0;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 18px; min-height: 220px;
    }

    /* ─── Empty state ───────────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 48px 24px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
      color: #94a3b8; font-size: 14px; text-align: center;
    }

    /* ─── Company grid ──────────────────────────────────────── */
    .company-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }

    /* ─── DIAN card ─────────────────────────────────────────── */
    .dian-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
      padding: 18px; display: flex; flex-direction: column; gap: 14px;
      box-shadow: 0 1px 4px rgba(12,28,53,.05);
      transition: box-shadow .2s, border-color .2s;
    }
    .dian-card:hover {
      box-shadow: 0 4px 16px rgba(12,28,53,.1);
      border-color: #bfdbfe;
    }

    /* Card header */
    .dian-card-header {
      display: flex; align-items: center; gap: 12px;
    }
    .co-avatar {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #1a407e, #3b82f6);
      color: #fff; font-family: 'Sora', sans-serif;
      font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }
    .dian-card-info { min-width: 0; }
    .dian-card-name {
      font-size: 14px; font-weight: 700; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .dian-card-nit { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    /* Divider */
    .test-divider { height: 1px; background: #f1f5f9; margin: 0 -2px; }

    /* Test section */
    .test-section { display: flex; flex-direction: column; gap: 8px; }

    .test-section-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 12.5px; font-weight: 700; color: #374151;
      flex-wrap: wrap;
    }
    .test-section-label svg { color: #6b7280; flex-shrink: 0; }
    .doc-count-hint {
      font-size: 11px; color: #94a3b8; font-weight: 500;
    }

    /* Progress bar */
    .progress-wrap {
      display: flex; align-items: center; gap: 8px;
    }
    .progress-bar {
      flex: 1; height: 7px; background: #f1f5f9; border-radius: 9999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%; border-radius: 9999px;
      background: #60a5fa; transition: width .4s ease;
    }
    .progress-fill.fill-success { background: #16a34a; }
    .progress-fill.fill-warning { background: #d97706; }
    .progress-fill.fill-danger  { background: #dc2626; }
    .progress-label { font-size: 11px; color: #94a3b8; white-space: nowrap; }

    /* Stats row */
    .test-stats {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .stat {
      display: flex; align-items: center; gap: 4px;
      font-size: 11.5px; font-weight: 600;
    }
    .stat svg { flex-shrink: 0; }
    .stat-ok   { color: #16a34a; }
    .stat-err  { color: #dc2626; }
    .stat-date { color: #94a3b8; font-size: 10.5px; font-weight: 400; margin-left: auto; }

    /* Action buttons within card */
    .test-actions {
      display: flex; gap: 8px; flex-wrap: wrap;
    }

    /* ─── Badges ────────────────────────────────────────────── */
    .badge {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 9999px;
      font-size: 11px; font-weight: 700; letter-spacing: .02em;
      white-space: nowrap;
    }
    .badge-muted    { background: #f3f4f6; color: #6b7280; }
    .badge-primary  { background: #eff6ff; color: #1a407e; }
    .badge-type     { background: #f0fdf4; color: #15803d; }
    .badge-pending  { background: #f3f4f6; color: #6b7280; }
    .badge-progress { background: #fef3c7; color: #b45309; }
    .badge-done     { background: #dcfce7; color: #16a34a; }
    .badge-partial  { background: #fef3c7; color: #d97706; }
    .badge-failed   { background: #fee2e2; color: #dc2626; }
    .badge-sent     { background: #eff6ff; color: #2563eb; }
    .badge-accepted { background: #dcfce7; color: #16a34a; }
    .badge-rejected { background: #fee2e2; color: #dc2626; }
    .badge-error    { background: #fee2e2; color: #b91c1c; }

    /* ─── Buttons ───────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px; font-size: 13px;
      font-weight: 600; border: none; cursor: pointer;
      transition: all .15s; text-decoration: none;
    }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn-primary {
      background: #1a407e; color: #fff;
    }
    .btn-primary:hover:not(:disabled) { background: #153266; }
    .btn-secondary {
      background: #f0f4f9; color: #374151;
      border: 1px solid #dce6f0;
    }
    .btn-secondary:hover:not(:disabled) { background: #e2e8f2; }
    .btn-sm { padding: 5px 10px; font-size: 12px; border-radius: 7px; }
    .btn-danger {
      background: #dc2626; color: #fff; border: 1.5px solid #dc2626;
    }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; border-color: #b91c1c; }

    /* ─── Modales ───────────────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(12,28,53,.55); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      z-index: 500; padding: 20px;
      animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .modal {
      background: #fff; border-radius: 16px; width: 100%;
      max-width: 560px; max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(12,28,53,.25);
      animation: slideUp .25s ease;
    }
    .modal-sm  { max-width: 420px; }
    .modal-xl  { max-width: 880px; }
    @keyframes slideUp {
      from { opacity:0; transform:translateY(24px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 18px 20px 14px; border-bottom: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
    .modal-header h3 {
      font-size: 16px; font-weight: 700; color: #0c1c35;
      font-family: 'Sora', sans-serif; margin: 0 0 4px;
    }
    .detail-header-info { display: flex; flex-direction: column; gap: 6px; }
    .detail-header-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .detail-refresh-badge {
      display: flex; align-items: center; gap: 5px;
      font-size: 11px; color: #b45309; font-weight: 600;
    }

    .modal-close {
      background: none; border: none; cursor: pointer;
      color: #94a3b8; padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: color .15s, background .15s; flex-shrink: 0;
    }
    .modal-close:hover { background: #f1f5f9; color: #374151; }

    .modal-body {
      padding: 18px 20px; overflow-y: auto; flex: 1;
      display: flex; flex-direction: column; gap: 16px;
    }
    .modal-body::-webkit-scrollbar { width: 4px; }
    .modal-body::-webkit-scrollbar-thumb { background: #dce6f0; border-radius: 2px; }

    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 14px 20px; border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    /* Confirm modal */
    .confirm-icon {
      display: flex; justify-content: center; margin-bottom: 4px;
    }
    .confirm-text {
      text-align: center; font-size: 14.5px; color: #1e293b; margin: 0;
      line-height: 1.6;
    }
    .confirm-sub {
      text-align: center; font-size: 12.5px; color: #6b7280;
      line-height: 1.6; margin: 0;
    }

    /* Detail modal: resumen */
    .detail-summary {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
    }
    .summary-card {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 10px 8px; text-align: center;
    }
    .summary-card--sent { background: #eff6ff; border-color: #bfdbfe; }
    .summary-card--ok   { background: #f0fdf4; border-color: #bbf7d0; }
    .summary-card--rej  { background: #fef3c7; border-color: #fde68a; }
    .summary-card--err  { background: #fee2e2; border-color: #fecaca; }
    .summary-val {
      font-size: 22px; font-weight: 800; color: #0c1c35;
      font-family: 'Sora', sans-serif;
    }
    .summary-label { font-size: 11px; color: #6b7280; font-weight: 600; margin-top: 2px; }

    /* Detail progress */
    .detail-progress-wrap {
      display: flex; align-items: center; gap: 10px;
    }
    .detail-progress-bar {
      flex: 1; height: 10px; background: #f1f5f9; border-radius: 9999px;
      overflow: hidden;
    }
    .detail-progress-fill {
      height: 100%; border-radius: 9999px;
      background: #60a5fa; transition: width .5s ease;
    }
    .detail-progress-pct {
      font-size: 13px; font-weight: 700; color: #374151;
      min-width: 38px; text-align: right;
    }

    /* Dates row */
    .detail-dates {
      display: flex; gap: 16px; flex-wrap: wrap;
    }
    .detail-date {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: #6b7280;
    }

    /* Documents table */
    .docs-table-wrap {
      overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;
    }
    .docs-table {
      width: 100%; border-collapse: collapse; font-size: 12.5px;
    }
    .docs-table thead tr {
      background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .docs-table th {
      padding: 9px 12px; text-align: left; font-size: 11px;
      font-weight: 700; color: #6b7280; text-transform: uppercase;
      letter-spacing: .05em; white-space: nowrap;
    }
    .docs-table td {
      padding: 8px 12px; border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .docs-table tbody tr:last-child td { border-bottom: none; }
    .docs-table tbody tr:hover { background: #f8fafc; }

    .th-narrow { width: 48px; }
    .td-seq { color: #94a3b8; font-weight: 600; font-size: 11px; }
    .td-code code {
      font-family: 'JetBrains Mono', monospace; font-size: 11px;
      background: #f1f5f9; padding: 2px 5px; border-radius: 4px;
      color: #374151;
    }
    .td-msg { max-width: 240px; }
    .doc-msg {
      display: block; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 220px;
      font-size: 12px; color: #374151;
    }
    .doc-msg--err { color: #dc2626; }
    .td-zipkey { max-width: 120px; }
    .zipkey-code { font-size: 10.5px; background: #f0f4f9; border-radius: 4px; padding: 2px 5px; color: #475569; cursor: help; display: inline-block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .td-date { font-size: 11.5px; color: #94a3b8; white-space: nowrap; }

    .doc-type-badge {
      font-size: 11.5px; color: #374151; font-weight: 500;
    }

    /* Row coloring by status */
    .doc-row--ok  td { background: #f0fdf4 !important; }
    .doc-row--rej td { background: #fef9c3 !important; }
    .doc-row--err td { background: #fff1f2 !important; }

    /* Loading skeleton in table */
    .docs-loading { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
    .sk-doc-row { display: flex; align-items: center; gap: 16px; }

    /* Empty docs */
    .docs-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 32px 16px;
      color: #94a3b8; font-size: 13px;
    }

    .text-muted { color: #94a3b8; font-size: 12px; }

    /* ─── Responsive ────────────────────────────────────────── */
    @media (max-width: 640px) {
      .company-grid { grid-template-columns: 1fr; }
      .detail-summary { grid-template-columns: repeat(3, 1fr); }
      .modal-xl { max-width: 100%; }
      .docs-table th:nth-child(4),
      .docs-table td:nth-child(4) { display: none; }
    }
    @media (max-width: 400px) {
      .detail-summary { grid-template-columns: repeat(2, 1fr); }
    }
  `],
})
export class SaDianTestsComponent implements OnInit, OnDestroy {
  private http     = inject(HttpClient);
  private notify   = inject(NotificationService);
  private service  = inject(SaDianTestsService);
  private cdr      = inject(ChangeDetectorRef);

  // ── State ─────────────────────────────────────────────────────
  companies       = signal<Company[]>([]);
  testSets        = signal<Map<string, DianTestSet[]>>(new Map());
  loading         = signal(false);
  actionLoading   = signal(false);
  checkLoading    = signal(false);
  detailLoading   = signal(false);

  selectedTestSet  = signal<DianTestSet | null>(null);
  showDetailModal  = signal(false);
  showConfirmModal = signal(false);

  searchTerm      = signal('');
  searchTermModel = '';

  // Confirm start dialog state
  confirmCompany  = signal<Company | null>(null);
  confirmType     = signal<'FACTURACION' | 'NOMINA'>('FACTURACION');

  // Reset dialog state
  showResetModal  = signal(false);
  resetTargetTs   = signal<DianTestSet | null>(null);
  resetCompanyId  = signal<string>('');

  // Auto-refresh
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // ── Computed ──────────────────────────────────────────────────
  filteredCompanies = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.companies();
    return this.companies().filter(
      c => c.name.toLowerCase().includes(term) || (c.nit ?? '').includes(term)
    );
  });

  anyInProgress = computed(() => {
    for (const sets of this.testSets().values()) {
      if (sets.some(ts => ts.status === 'IN_PROGRESS')) return true;
    }
    return false;
  });

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadCompanies();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  // ── Data loading ──────────────────────────────────────────────
  loadCompanies(): void {
    this.loading.set(true);
    this.http
      .get<Company[]>(`${environment.apiUrl}/super-admin/companies`)
      .subscribe({
        next: (data) => {
          // SA companies API returns { data: Company[], total, ... } after interceptor unwrap
          const raw = Array.isArray(data)
            ? data
            : (data as any).items ?? (data as any).data ?? [];
          // Filter out any entry without a valid id (defensive guard)
          const list = (raw as any[]).filter((c: any) => !!c?.id);
          this.companies.set(list);
          this.loading.set(false);
          this.cdr.markForCheck();
          this.loadAllTestSets(list);
        },
        error: (err) => {
          this.notify.error(err?.error?.message ?? 'Error al cargar empresas');
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  loadAllTestSets(companies: Company[]): void {
    for (const c of companies) {
      this.loadTestSetsForCompany(c.id);
    }
  }

  loadTestSetsForCompany(companyId: string): void {
    if (!companyId) return;
    this.service.findByCompany(companyId).subscribe({
      next: (sets) => {
        this.testSets.update(map => {
          const next = new Map(map);
          next.set(companyId, sets);
          return next;
        });
        this.cdr.markForCheck();
        this.manageAutoRefresh();
      },
      error: () => {
        // Silently ignore per-company errors (company may have no test sets yet)
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  getLatestTestSet(companyId: string, type: 'FACTURACION' | 'NOMINA'): DianTestSet | null {
    const sets = this.testSets().get(companyId) ?? [];
    const filtered = sets.filter(ts => ts.type === type);
    if (!filtered.length) return null;
    // Return the most recent (by createdAt desc)
    return filtered.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
  }

  progressPct(ts: DianTestSet): number {
    if (!ts.totalDocs) return 0;
    return Math.round((ts.sentDocs / ts.totalDocs) * 100);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING:     'Pendiente',
      IN_PROGRESS: 'En Progreso',
      COMPLETED:   'Completado',
      PARTIAL:     'Parcial',
      FAILED:      'Fallido',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING:     'badge-pending',
      IN_PROGRESS: 'badge-progress',
      COMPLETED:   'badge-done',
      PARTIAL:     'badge-partial',
      FAILED:      'badge-failed',
    };
    return map[status] ?? 'badge-muted';
  }

  docTypeLabel(docType: string): string {
    const map: Record<string, string> = {
      FACTURA:       'Factura de Venta',
      NOTA_CREDITO:  'Nota Crédito',
      NOTA_DEBITO:   'Nota Débito',
      NOMINA:        'Nómina Electrónica',
      NOMINA_AJUSTE: 'Nómina de Ajuste',
    };
    return map[docType] ?? docType;
  }

  docStatusLabel(status: string, dianStatusCode?: string): string {
    // SENT with a non-00 DIAN code means it was effectively rejected
    if (status === 'SENT' && dianStatusCode && dianStatusCode !== '00') return 'Rechazado';
    const map: Record<string, string> = {
      PENDING:  'Pendiente',
      SENT:     'Enviado',
      ACCEPTED: 'Aceptado',
      REJECTED: 'Rechazado',
      ERROR:    'Error',
    };
    return map[status] ?? status;
  }

  docStatusClass(status: string, dianStatusCode?: string): string {
    if (status === 'SENT' && dianStatusCode && dianStatusCode !== '00') return 'badge-rejected';
    const map: Record<string, string> = {
      PENDING:  'badge-pending',
      SENT:     'badge-sent',
      ACCEPTED: 'badge-accepted',
      REJECTED: 'badge-rejected',
      ERROR:    'badge-error',
    };
    return map[status] ?? 'badge-muted';
  }

  // ── Actions ───────────────────────────────────────────────────
  confirmStart(company: Company, type: 'FACTURACION' | 'NOMINA'): void {
    this.confirmCompany.set(company);
    this.confirmType.set(type);
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmCompany.set(null);
  }

  executeStart(): void {
    const company = this.confirmCompany();
    const type    = this.confirmType();
    if (!company) return;

    this.actionLoading.set(true);
    const obs = type === 'FACTURACION'
      ? this.service.startFacturacion(company.id)
      : this.service.startNomina(company.id);

    obs.subscribe({
      next: (newSet) => {
        this.notify.success(
          `Set de pruebas de ${type === 'FACTURACION' ? 'Facturación' : 'Nómina'} iniciado`
        );
        this.actionLoading.set(false);
        this.showConfirmModal.set(false);
        this.confirmCompany.set(null);
        // Refresh this company's test sets
        this.loadTestSetsForCompany(company.id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al iniciar el set de pruebas');
        this.actionLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  confirmReset(ts: DianTestSet, companyId: string): void {
    this.resetTargetTs.set(ts);
    this.resetCompanyId.set(companyId);
    this.showResetModal.set(true);
  }

  closeResetModal(): void {
    this.showResetModal.set(false);
    this.resetTargetTs.set(null);
  }

  executeReset(): void {
    const ts        = this.resetTargetTs();
    const companyId = this.resetCompanyId();
    if (!ts) return;

    this.actionLoading.set(true);
    this.service.cancel(ts.id).subscribe({
      next: () => {
        this.notify.success('Set eliminado. Ya puede iniciar uno nuevo.');
        this.actionLoading.set(false);
        this.showResetModal.set(false);
        this.resetTargetTs.set(null);
        this.loadTestSetsForCompany(companyId);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al eliminar el set de pruebas');
        this.actionLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  openDetail(testSetId: string): void {
    this.detailLoading.set(true);
    this.showDetailModal.set(true);
    this.cdr.markForCheck();

    this.service.findOne(testSetId).subscribe({
      next: (ts) => {
        this.selectedTestSet.set(ts);
        this.detailLoading.set(false);
        this.cdr.markForCheck();
        this.manageAutoRefresh();
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al cargar el detalle');
        this.detailLoading.set(false);
        this.showDetailModal.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedTestSet.set(null);
  }

  checkStatuses(): void {
    const ts = this.selectedTestSet();
    if (!ts) return;
    this.checkLoading.set(true);

    this.service.checkStatuses(ts.id).subscribe({
      next: (updated) => {
        this.selectedTestSet.set(updated);
        this.checkLoading.set(false);
        // Also refresh the card
        this.loadTestSetsForCompany(updated.companyId);
        this.cdr.markForCheck();
        this.notify.success('Estados actualizados desde DIAN');
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al verificar estados');
        this.checkLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Auto-refresh ──────────────────────────────────────────────
  private manageAutoRefresh(): void {
    if (this.anyInProgress()) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) return; // Already running
    this.refreshInterval = setInterval(() => {
      // Refresh all companies that have an IN_PROGRESS test set
      for (const [companyId, sets] of this.testSets()) {
        if (sets.some(ts => ts.status === 'IN_PROGRESS')) {
          this.loadTestSetsForCompany(companyId);
        }
      }
      // If detail modal is open and IN_PROGRESS, refresh detail too
      const detail = this.selectedTestSet();
      if (detail && detail.status === 'IN_PROGRESS') {
        this.service.findOne(detail.id).subscribe({
          next: (updated) => {
            this.selectedTestSet.set(updated);
            this.cdr.markForCheck();
          },
          error: () => {},
        });
      }
    }, 10_000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}
