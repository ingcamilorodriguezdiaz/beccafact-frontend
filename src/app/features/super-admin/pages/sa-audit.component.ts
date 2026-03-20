import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface AuditLog {
  id: string; companyId?: string; userId?: string;
  action: string; resource: string; resourceId?: string;
  before?: any; after?: any; ip?: string; userAgent?: string; createdAt: string;
  user?: { firstName: string; lastName: string; email: string };
  company?: { name: string };
}
interface PagedResult { data: AuditLog[]; total: number; page: number; limit: number; }

const ACTION_COLORS: Record<string, string> = {
  CREATE:'action-create', UPDATE:'action-update', DELETE:'action-delete',
  LOGIN:'action-login', EXPORT:'action-export', SUSPEND:'action-suspend',
  ACTIVATE:'action-activate', CHANGE_PLAN:'action-change',
};
  
@Component({
  selector: 'app-sa-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Logs de Auditoría</h2>
          <p class="page-subtitle">Registro completo de acciones del sistema</p>
        </div>
        <button class="btn-ghost" (click)="reset()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14">
            <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
          </svg>
          <span class="btn-text">Limpiar filtros</span>
        </button>
      </div>

      <!-- Filters -->
      <div class="filters-card">
        <div class="filters-row">
          <div class="filter-group filter-group--wide">
            <label class="filter-label">Empresa (ID)</label>
            <input type="text" [(ngModel)]="filters.companyId" (ngModelChange)="onFilterChange()"
                   placeholder="UUID de empresa" class="filter-input"/>
          </div>
          <div class="filter-group">
            <label class="filter-label">Recurso</label>
            <select [(ngModel)]="filters.resource" (ngModelChange)="onFilterChange()" class="filter-input">
              <option value="">Todos</option>
              <option value="invoice">Factura</option>
              <option value="product">Producto</option>
              <option value="user">Usuario</option>
              <option value="company">Empresa</option>
              <option value="subscription">Suscripción</option>
              <option value="customer">Cliente</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Acción</label>
            <select [(ngModel)]="filters.action" (ngModelChange)="onFilterChange()" class="filter-input">
              <option value="">Todas</option>
              <option value="CREATE">Crear</option>
              <option value="UPDATE">Actualizar</option>
              <option value="DELETE">Eliminar</option>
              <option value="LOGIN">Login</option>
              <option value="EXPORT">Exportar</option>
              <option value="SUSPEND">Suspender</option>
              <option value="ACTIVATE">Activar</option>
              <option value="CHANGE_PLAN">Cambiar plan</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Desde</label>
            <input type="date" [(ngModel)]="filters.from" (ngModelChange)="onFilterChange()" class="filter-input"/>
          </div>
          <div class="filter-group">
            <label class="filter-label">Hasta</label>
            <input type="date" [(ngModel)]="filters.to" (ngModelChange)="onFilterChange()" class="filter-input"/>
          </div>
        </div>
      </div>

      <!-- Results info -->
      @if (!loading()) {
        <div class="results-bar">
          <span class="results-count">{{ total() }} registros encontrados</span>
          <span class="results-page">Pág. {{ page() }} / {{ totalPages() }}</span>
        </div>
      }

      <!-- ══════════════════════════════════════
           TABLA — visible solo en desktop (≥641px)
           ══════════════════════════════════════ -->
      <div class="table-card desktop-only">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-row">
              <div class="sk" style="width:90px;height:22px;border-radius:10px"></div>
              <div class="sk" style="width:130px;height:13px"></div>
              <div class="sk" style="width:80px;height:20px;border-radius:8px"></div>
              <div class="sk" style="width:100px;height:13px"></div>
            </div>
          }
        } @else if (logs().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44">
              <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
              <path d="M16 20h16M16 26h10M16 32h8M13 14h22a2 2 0 012 2v20a2 2 0 01-2 2H13a2 2 0 01-2-2V16a2 2 0 012-2z"
                    stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>Sin registros con los filtros aplicados</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empresa</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Recurso</th>
                  <th class="hide-lg">IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (log of logs(); track log.id) {
                  <tr class="log-row" (click)="toggleExpand(log.id)">
                    <td>
                      <div class="log-date">{{ log.createdAt | date:'dd/MM/yy' }}</div>
                      <div class="log-time">{{ log.createdAt | date:'HH:mm:ss' }}</div>
                    </td>
                    <td>
                      @if (log.company) { <span class="company-name">{{ log.company.name }}</span> }
                      @else { <span class="text-muted">Sistema</span> }
                    </td>
                    <td>
                      @if (log.user) {
                        <div class="user-cell">
                          <div class="user-av">
                            {{ (log.user.firstName[0]||'') + (log.user.lastName[0]||'') }}
                          </div>
                          <div>
                            <div class="user-name">{{ log.user.firstName }} {{ log.user.lastName }}</div>
                            <div class="user-email">{{ log.user.email }}</div>
                          </div>
                        </div>
                      } @else { <span class="text-muted">Sistema</span> }
                    </td>
                    <td>
                      <span class="action-pill {{ getActionClass(log.action) }}">{{ log.action }}</span>
                    </td>
                    <td>
                      <span class="resource-badge">{{ log.resource }}</span>
                      @if (log.resourceId) {
                        <div class="resource-id">{{ log.resourceId.slice(0,8) }}…</div>
                      }
                    </td>
                    <td class="hide-lg">
                      <span class="ip-badge">{{ log.ip || '—' }}</span>
                    </td>
                    <td>
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"
                           class="expand-icon" [class.expanded]="expanded().has(log.id)">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                      </svg>
                    </td>
                  </tr>

                  @if (expanded().has(log.id)) {
                    <tr class="expand-row">
                      <td colspan="7">
                        <div class="expand-body">
                          <div class="expand-cols">
                            <div class="expand-col">
                              <div class="expand-title">ANTES</div>
                              <pre class="json-pre">{{ log.before | json }}</pre>
                            </div>
                            <div class="expand-col">
                              <div class="expand-title">DESPUÉS</div>
                              <pre class="json-pre">{{ log.after | json }}</pre>
                            </div>
                            <div class="expand-col">
                              <div class="expand-title">METADATA</div>
                              <div class="meta-grid">
                                <span class="meta-key">ID</span>
                                <span class="meta-val">{{ log.id }}</span>
                                <span class="meta-key">Recurso ID</span>
                                <span class="meta-val">{{ log.resourceId || '—' }}</span>
                                <span class="meta-key">IP</span>
                                <span class="meta-val">{{ log.ip || '—' }}</span>
                                <span class="meta-key">User Agent</span>
                                <span class="meta-val ua">{{ log.userAgent || '—' }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="page() <= 1" (click)="goTo(page() - 1)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                  <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
                </svg>
              </button>
              <span class="page-info">{{ page() }} / {{ totalPages() }}</span>
              <button class="page-btn" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
                </svg>
              </button>
            </div>
          }
        }
      </div>

      <!-- ══════════════════════════════════════
           CARDS — visible solo en móvil (≤640px)
           ══════════════════════════════════════ -->
      <div class="mobile-only">
        @if (loading()) {
          <div class="mobile-skeleton">
            @for (i of [1,2,3,4]; track i) {
              <div class="log-card">
                <div class="sk" style="width:80px;height:20px;border-radius:99px;margin-bottom:10px"></div>
                <div class="sk" style="width:60%;height:13px;margin-bottom:6px"></div>
                <div class="sk" style="width:40%;height:12px"></div>
              </div>
            }
          </div>
        } @else if (logs().length === 0) {
          <div class="empty-state" style="background:#fff;border:1px solid #dce6f0;border-radius:12px">
            <svg viewBox="0 0 48 48" fill="none" width="40">
              <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
              <path d="M16 20h16M16 26h10M16 32h8M13 14h22a2 2 0 012 2v20a2 2 0 01-2 2H13a2 2 0 01-2-2V16a2 2 0 012-2z"
                    stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>Sin registros con los filtros aplicados</p>
          </div>
        } @else {
          <div class="mobile-logs">
            @for (log of logs(); track log.id) {
              <div class="log-card" (click)="toggleExpand(log.id)">
                <!-- Top row: acción + recurso + fecha -->
                <div class="lc-top">
                  <span class="action-pill {{ getActionClass(log.action) }}">{{ log.action }}</span>
                  <span class="resource-badge">{{ log.resource }}</span>
                  <span class="lc-time">{{ log.createdAt | date:'dd/MM/yy HH:mm' }}</span>
                </div>

                <!-- Empresa -->
                @if (log.company) {
                  <div class="lc-company">{{ log.company.name }}</div>
                }

                <!-- Usuario -->
                @if (log.user) {
                  <div class="lc-user">
                    <div class="user-av user-av--sm">
                      {{ (log.user.firstName[0]||'') + (log.user.lastName[0]||'') }}
                    </div>
                    <span>{{ log.user.firstName }} {{ log.user.lastName }} · {{ log.user.email }}</span>
                  </div>
                }

                <!-- Expandible -->
                @if (expanded().has(log.id)) {
                  <div class="lc-detail">
                    @if (log.after) {
                      <div class="expand-title" style="margin-bottom:6px">DESPUÉS</div>
                      <pre class="json-pre">{{ log.after | json }}</pre>
                    }
                    <div class="meta-grid" style="margin-top:10px">
                      <span class="meta-key">IP</span>
                      <span class="meta-val">{{ log.ip || '—' }}</span>
                      <span class="meta-key">ID</span>
                      <span class="meta-val ua">{{ log.id }}</span>
                    </div>
                  </div>
                }

                <!-- Chevron -->
                <svg viewBox="0 0 20 20" fill="currentColor" width="14"
                     class="lc-chevron" [class.expanded]="expanded().has(log.id)">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                </svg>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination mobile-pagination">
              <button class="page-btn" [disabled]="page() <= 1" (click)="goTo(page() - 1)">‹</button>
              <span class="page-info">{{ page() }} / {{ totalPages() }}</span>
              <button class="page-btn" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)">›</button>
            </div>
          }
        }
      </div>

    </div>
  `,
  styles: [`
    .page { max-width: 1300px; }

    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .animate-in { animation: fadeUp .25s ease; }

    /* ── Header ─────────────────────────────────────── */
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
    }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 14px; background: #fff; border: 1px solid #dce6f0;
      color: #475569; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all .15s; flex-shrink: 0;
    }
    .btn-ghost:hover { background: #f0f4f9; }

    /* ── Filters ────────────────────────────────────── */
    .filters-card {
      background: #fff; border: 1px solid #dce6f0;
      border-radius: 12px; padding: 14px 18px; margin-bottom: 14px;
    }
    .filters-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
      gap: 10px;
    }
    .filter-label {
      display: block; font-size: 11px; font-weight: 700; color: #64748b;
      margin-bottom: 4px; text-transform: uppercase; letter-spacing: .05em;
    }
    .filter-input {
      width: 100%; padding: 7px 10px; border: 1px solid #dce6f0;
      border-radius: 8px; font-size: 13px; color: #0c1c35;
      box-sizing: border-box; outline: none; background: #fff;
    }
    .filter-input:focus { border-color: #1a407e; box-shadow: 0 0 0 3px rgba(26,64,126,.07); }

    .results-bar { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .results-count { font-size: 13px; color: #475569; font-weight: 600; }
    .results-page  { font-size: 12px; color: #94a3b8; }

    /* ── Table card (desktop) ───────────────────────── */
    .table-card {
      background: #fff; border: 1px solid #dce6f0;
      border-radius: 12px; overflow: hidden;
    }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .audit-table { width: 100%; border-collapse: collapse; min-width: 600px; }
    .audit-table th {
      padding: 10px 13px; text-align: left; font-size: 11px; font-weight: 700;
      color: #64748b; text-transform: uppercase; letter-spacing: .07em;
      background: #f8fafc; border-bottom: 1px solid #dce6f0;
    }
    .log-row { cursor: pointer; transition: background .1s; }
    .log-row:hover { background: #f8fafc; }
    .log-row td { padding: 10px 13px; border-bottom: 1px solid #f0f4f9; vertical-align: middle; }
    .log-date { font-size: 13px; font-weight: 600; color: #334155; }
    .log-time { font-size: 11px; color: #94a3b8; }
    .company-name { font-size: 13px; font-weight: 600; color: #334155; }
    .text-muted { font-size: 12px; color: #94a3b8; }

    .user-cell { display: flex; align-items: center; gap: 8px; }
    .user-av {
      width: 27px; height: 27px; border-radius: 7px; flex-shrink: 0;
      background: linear-gradient(135deg,#1a407e,#00c6a0);
      color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      text-transform: uppercase;
    }
    .user-av--sm { width: 22px; height: 22px; font-size: 9px; border-radius: 5px; }
    .user-name  { font-size: 12.5px; font-weight: 600; color: #334155; }
    .user-email { font-size: 11px; color: #94a3b8; }

    .action-pill {
      display: inline-block; padding: 3px 9px; border-radius: 99px;
      font-size: 11px; font-weight: 700; letter-spacing: .04em; white-space: nowrap;
    }
    .action-create   { background: #dcfce7; color: #15803d; }
    .action-update   { background: #dbeafe; color: #1d4ed8; }
    .action-delete   { background: #fee2e2; color: #dc2626; }
    .action-login    { background: #f3e8ff; color: #7c3aed; }
    .action-export   { background: #e0f2fe; color: #0369a1; }
    .action-suspend  { background: #fef3c7; color: #92400e; }
    .action-activate { background: #d1fae5; color: #065f46; }
    .action-change   { background: #fce7f3; color: #9d174d; }

    .resource-badge {
      font-size: 11.5px; font-weight: 600; color: #475569;
      background: #f0f4f9; padding: 2px 7px; border-radius: 5px;
    }
    .resource-id { font-size: 10.5px; color: #94a3b8; font-family: monospace; margin-top: 2px; }
    .ip-badge { font-family: monospace; font-size: 12px; color: #64748b; }

    .expand-icon { color: #94a3b8; transition: transform .2s; display: block; }
    .expand-icon.expanded { transform: rotate(180deg); color: #1a407e; }

    /* Expand row */
    .expand-row td { padding: 0; border-bottom: 1px solid #dce6f0; }
    .expand-body { padding: 14px 18px; background: #f8fafc; }
    .expand-cols { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 14px; }
    .expand-title {
      font-size: 10px; font-weight: 800; color: #64748b;
      text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px;
    }
    .json-pre {
      margin: 0; padding: 10px; background: #fff; border: 1px solid #e2e8f0;
      border-radius: 8px; font-size: 11px; color: #334155;
      overflow: auto; max-height: 150px; white-space: pre-wrap; word-break: break-all;
    }
    .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; align-items: start; }
    .meta-key { font-size: 11px; font-weight: 700; color: #64748b; white-space: nowrap; }
    .meta-val { font-size: 11px; color: #334155; font-family: monospace; word-break: break-all; }
    .ua { font-size: 10px; }

    /* Skeleton */
    .skeleton-row {
      display: flex; align-items: center; gap: 18px;
      padding: 13px 18px; border-bottom: 1px solid #f0f4f9;
    }
    .mobile-skeleton { display: flex; flex-direction: column; gap: 8px; }
    .sk {
      background: linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite;
      border-radius: 6px; height: 13px; flex-shrink: 0;
    }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 48px; color: #94a3b8; font-size: 14px;
    }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 12px; border-top: 1px solid #f0f4f8;
    }
    .mobile-pagination {
      background: #fff; border: 1px solid #dce6f0;
      border-radius: 12px; margin-top: 8px;
    }
    .page-btn {
      width: 32px; height: 32px; border-radius: 8px; border: 1px solid #dce6f0;
      background: #fff; color: #475569; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s; font-size: 16px;
    }
    .page-btn:hover:not(:disabled) { background: #1a407e; color: #fff; border-color: #1a407e; }
    .page-btn:disabled { opacity: .4; cursor: default; }
    .page-info { font-size: 13px; font-weight: 600; color: #475569; min-width: 50px; text-align: center; }

    /* ── Mobile cards ───────────────────────────────── */
    /* hide-lg solo aplica dentro de la tabla */
    .hide-lg { }

    .mobile-logs { display: flex; flex-direction: column; gap: 8px; }
    .log-card {
      background: #fff; border: 1px solid #dce6f0; border-radius: 12px;
      padding: 12px 14px; cursor: pointer; position: relative;
      padding-right: 34px; /* espacio para el chevron */
    }
    .lc-top {
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap; margin-bottom: 6px;
    }
    .lc-time { font-size: 11px; color: #94a3b8; margin-left: auto; white-space: nowrap; }
    .lc-company { font-size: 13px; font-weight: 600; color: #0c1c35; margin-bottom: 4px; }
    .lc-user {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #9ca3af; margin-bottom: 4px;
    }
    .lc-chevron {
      position: absolute; top: 14px; right: 12px;
      color: #94a3b8; transition: transform .2s;
    }
    .lc-chevron.expanded { transform: rotate(180deg); color: #1a407e; }
    .lc-detail { border-top: 1px solid #f0f4f8; padding-top: 10px; margin-top: 8px; }

    /* ── Visibilidad responsive ─────────────────────── */
    /* Desktop: tabla visible, mobile-only oculto */
    .desktop-only { display: block; }
    .mobile-only  { display: none;  }

    @media (max-width: 900px) {
      .filters-row { grid-template-columns: 1fr 1fr 1fr; }
      .filter-group--wide { grid-column: span 3; }
    }

    @media (max-width: 640px) {
      /* Swap: ocultar tabla, mostrar cards */
      .desktop-only { display: none !important; }
      .mobile-only  { display: block; }

      .page-header { flex-direction: column; align-items: stretch; }
      .filters-row { grid-template-columns: 1fr 1fr; }
      .filter-group--wide { grid-column: span 2; }
      .results-bar { flex-direction: column; gap: 2px; }
    }

    @media (max-width: 420px) {
      .filters-row { grid-template-columns: 1fr; }
      .filter-group--wide { grid-column: span 1; }
      .btn-text { display: none; }
    }
  `],
})
export class SaAuditComponent implements OnInit {
  logs = signal<AuditLog[]>([]);
  loading = signal(true);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  expanded = signal<Set<string>>(new Set());
  filters = { companyId: '', resource: '', action: '', from: '', to: '' };
  private filterTimer: any;
  private readonly api = `${environment.apiUrl}/super-admin/audit-logs`;

  constructor(private http: HttpClient) {}
  ngOnInit() { this.load(); }

  onFilterChange() {
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  reset() {
    this.filters = { companyId: '', resource: '', action: '', from: '', to: '' };
    this.page.set(1);
    this.load();
  }

  goTo(p: number) { this.page.set(p); this.load(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 50 };
    if (this.filters.companyId) params.companyId = this.filters.companyId;
    if (this.filters.resource)  params.resource  = this.filters.resource;
    if (this.filters.action)    params.action    = this.filters.action;
    if (this.filters.from)      params.from      = this.filters.from;
    if (this.filters.to)        params.to        = this.filters.to;
    const qs = new URLSearchParams(params).toString();
    this.http.get<PagedResult>(`${this.api}?${qs}`).subscribe({
      next: res => {
        this.logs.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(Math.ceil(res.total / 50));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleExpand(id: string) {
    const s = new Set(this.expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expanded.set(s);
  }

  getActionClass(action: string) { return ACTION_COLORS[action] ?? 'action-update'; }
}