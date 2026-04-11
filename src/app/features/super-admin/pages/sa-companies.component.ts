import { Component, HostListener, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface Company {
  id: string; name: string; nit: string; email: string;
  phone?: string; address?: string; city?: string; department?: string;
  razonSocial?: string; status: string; createdAt: string;
  subscriptions?: Array<{ plan: { displayName: string; name: string } }>;
  _count?: { users: number; invoices: number };
}
interface Plan { id: string; name: string; displayName: string; price: number; }
interface Role { id: string; name: string; displayName: string; description?: string; }
/** Backend retorna roles como { role: { id, name, displayName } }[] */
interface UserRoleEntry { role: Role; }
interface CompanyUser {
  id: string; firstName: string; lastName: string;
  email: string; phone?: string; isActive: boolean; createdAt?: string;
  roles: UserRoleEntry[];
}


type Modal = 'none' | 'create' | 'edit' | 'detail' | 'plan' | 'users' | 'user-form';

const EMPTY_FORM = () => ({
  name: '', nit: '', razonSocial: '', email: '',
  phone: '', address: '', city: '', department: '',
  planId: '',
});

@Component({
  selector: 'app-sa-companies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ── Header ──────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Empresas</h2>
          <p class="page-subtitle">{{ total() }} empresas registradas en la plataforma</p>
        </div>
        <button class="btn btn-primary" (click)="openCreate()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
          </svg>
          Nueva empresa
        </button>
      </div>

      <!-- ── Filtros ──────────────────────────────────────── -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
          </svg>
          <input type="text" [(ngModel)]="search" (ngModelChange)="onSearch()"
                 placeholder="Buscar empresa o NIT…" class="form-control search-input"/>
        </div>
        <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="form-control filter-select">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activas</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspendidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>

        <!-- View Toggle -->
        <div class="view-toggle">
          <button [class.active]="viewMode() === 'table'" (click)="viewMode.set('table')" title="Vista tabla">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/></svg>
          </button>
          <button [class.active]="viewMode() === 'grid'" (click)="viewMode.set('grid')" title="Vista cuadrícula">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
          </button>
        </div>
      </div>

      <!-- ── Tabla desktop ────────────────────────────────── -->
      @if (viewMode() === 'table') {
      <div class="table-card desktop-only">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="sk-row">
              <div class="sk" style="width:36px;height:36px;border-radius:9px;flex-shrink:0"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:5px">
                <div class="sk" style="width:160px;height:13px"></div>
                <div class="sk" style="width:110px;height:11px"></div>
              </div>
              <div class="sk" style="width:90px;height:22px;border-radius:8px"></div>
              <div class="sk" style="width:70px;height:22px;border-radius:8px"></div>
            </div>
          }
        } @else if (companies().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44">
              <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
              <path d="M14 34V18l10-6 10 6v16M18 34v-8h4v8M26 34v-8h4v8" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <p>No se encontraron empresas</p>
          </div>
        } @else {
          <table class="co-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>NIT</th>
                <th>Plan</th>
                <th class="text-center">Usuarios</th>
                <th class="text-center">Facturas</th>
                <th>Estado</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of companies(); track c.id) {
                <tr class="co-row">
                  <td>
                    <div class="co-cell">
                      <div class="co-avatar">{{ c.name[0].toUpperCase() }}</div>
                      <div>
                        <div class="co-name">{{ c.name }}</div>
                        <div class="co-email">{{ c.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge badge-muted">{{ c.nit }}</span></td>
                  <td>
                    @if (c.subscriptions?.length) {
                      <span class="badge badge-primary">{{ c.subscriptions![0].plan.displayName }}</span>
                    } @else {
                      <span class="text-muted">Sin plan</span>
                    }
                  </td>
                  <td class="text-center">
                    <button class="count-btn" (click)="openUsers(c)" title="Ver usuarios">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                      {{ c._count?.users ?? 0 }}
                    </button>
                  </td>
                  <td class="text-center co-invoices">{{ c._count?.invoices ?? 0 }}</td>
                  <td>
                    <span class="badge" [class]="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
                  </td>
                  <td class="text-muted">{{ c.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="btn-icon" title="Ver detalle" (click)="openDetail(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      </button>
                      <button class="btn-icon" title="Editar" (click)="openEdit(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      </button>
                      <button class="btn-icon" title="Usuarios" (click)="openUsers(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                      </button>
                      @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                        <button class="btn-icon btn-icon-danger" title="Suspender" (click)="suspend(c)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
                        </button>
                      }
                      @if (c.status === 'SUSPENDED') {
                        <button class="btn-icon btn-icon-success" title="Activar" (click)="activate(c)">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                        </button>
                      }
                      <button class="btn-icon" title="Cambiar plan" (click)="openChangePlan(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14l-1 9H4L3 8zm5 3a1 1 0 012 0v4a1 1 0 11-2 0v-4zm4 0a1 1 0 112 0v4a1 1 0 11-2 0v-4z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }

        @if (totalPages() > 1) {
          <div class="pagination">
            <span class="text-muted">Página {{ page() }} de {{ totalPages() }}</span>
            <div class="pag-btns">
              <button class="page-btn" [disabled]="page()===1" (click)="setPage(page()-1)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
              </button>
              <button class="page-btn" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
              </button>
            </div>
          </div>
        }\n      </div>
      } <!-- /viewMode table -->

      <!-- ══ GRID VIEW ══ -->
      @if (viewMode() === 'grid') {
        @if (loading()) {
          <div class="company-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="co-grid-card co-grid-card--skeleton">
                <div class="sk sk-avatar-grid"></div>
                <div class="sk sk-line" style="width:70%;margin:10px auto 6px"></div>
                <div class="sk sk-line" style="width:50%;margin:0 auto 14px"></div>
                <div class="sk sk-line" style="width:90%;margin-bottom:6px"></div>
                <div class="sk sk-line" style="width:75%"></div>
              </div>
            }
          </div>
        } @else if (companies().length === 0) {
          <div class="grid-empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44"><rect width="48" height="48" rx="12" fill="#f0f4f9"/><path d="M14 34V18l10-6 10 6v16M18 34v-8h4v8M26 34v-8h4v8" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
            <p>{{ search ? 'Sin resultados para "' + search + '"' : 'No hay empresas registradas aún' }}</p>
            @if (!search) {
              <button class="btn btn-primary btn-sm" (click)="openCreate()">Crear primera empresa</button>
            }
          </div>
        } @else {
          <div class="company-grid">
            @for (c of companies(); track c.id) {
              <div class="co-grid-card" [class.co-grid-card--suspended]="c.status === 'SUSPENDED'" [class.co-grid-card--cancelled]="c.status === 'CANCELLED'">

                <!-- Status badge top-right -->
                <span class="badge cc-status-badge" [class]="statusClass(c.status)">{{ statusLabel(c.status) }}</span>

                <!-- Avatar + nombre -->
                <div class="co-grid-top">
                  <div class="co-grid-avatar">{{ c.name[0].toUpperCase() }}</div>
                  <div class="co-grid-name">{{ c.name }}</div>
                  <div class="co-grid-nit">
                    <span class="badge badge-muted">{{ c.nit }}</span>
                  </div>
                </div>

                <!-- Info rows -->
                <div class="co-grid-info">
                  @if (c.subscriptions?.length) {
                    <div class="co-grid-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                      <span class="badge badge-primary">{{ c.subscriptions![0].plan.displayName }}</span>
                    </div>
                  } @else {
                    <div class="co-grid-row co-grid-row--muted">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                      <span>Sin plan</span>
                    </div>
                  }
                  <div class="co-grid-row">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    <span>{{ c.email }}</span>
                  </div>
                  @if (c.city) {
                    <div class="co-grid-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
                      <span>{{ c.city }}</span>
                    </div>
                  }
                  <!-- Contadores -->
                  <div class="co-grid-counters">
                    <button class="co-grid-count" (click)="openUsers(c)" title="Ver usuarios">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                      {{ c._count?.users ?? 0 }} usuarios
                    </button>
                    <span class="co-grid-count co-grid-count--plain">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
                      {{ c._count?.invoices ?? 0 }} facturas
                    </span>
                  </div>
                </div>

                <!-- Acciones -->
                <div class="co-grid-actions">
                  <button class="btn btn-sm btn-secondary" (click)="openDetail(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    Ver
                  </button>
                  <button class="btn btn-sm btn-secondary" (click)="openEdit(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                    Editar
                  </button>
                  <button class="btn btn-sm btn-secondary" (click)="openUsers(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                    Usuarios
                  </button>
                  @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                    <button class="btn-icon btn-icon-danger" title="Suspender" (click)="suspend(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
                    </button>
                  }
                  @if (c.status === 'SUSPENDED') {
                    <button class="btn-icon btn-icon-success" title="Activar" (click)="activate(c)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination pagination--standalone">
              <span class="text-muted">{{ (page()-1)*20 + 1 }}–{{ min(page()*20, total()) }} de {{ total() }}</span>
              <div class="pag-btns">
                <button class="page-btn" [disabled]="page()===1" (click)="setPage(page()-1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                </button>
                <button class="page-btn" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                </button>
              </div>
            </div>
          }
        }
      } <!-- /viewMode grid -->

      <!-- ── Cards móvil (solo en vista tabla) ───────────── -->
      @if (viewMode() === 'table') {
      <div class="mobile-only">
        @if (loading()) {
          @for (i of [1,2,3]; track i) {
            <div class="co-card">
              <div class="sk" style="width:120px;height:14px;margin-bottom:8px"></div>
              <div class="sk" style="width:80px;height:12px;margin-bottom:6px"></div>
              <div class="sk" style="width:60px;height:20px;border-radius:8px"></div>
            </div>
          }
        } @else if (companies().length === 0) {
          <div class="empty-state" style="background:#fff;border:1px solid #dce6f0;border-radius:12px">
            <svg viewBox="0 0 48 48" fill="none" width="40"><rect width="48" height="48" rx="12" fill="#f0f4f9"/><path d="M14 34V18l10-6 10 6v16M18 34v-8h4v8M26 34v-8h4v8" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
            <p>No se encontraron empresas</p>
          </div>
        } @else {
          @for (c of companies(); track c.id) {
            <div class="co-card">
              <div class="co-card-top">
                <div class="co-avatar">{{ c.name[0].toUpperCase() }}</div>
                <div class="co-card-info">
                  <div class="co-name">{{ c.name }}</div>
                  <div class="co-email">{{ c.email }}</div>
                </div>
                <span class="badge" [class]="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
              </div>
              <div class="co-card-meta">
                <span class="badge badge-muted">{{ c.nit }}</span>
                @if (c.subscriptions?.length) {
                  <span class="badge badge-primary">{{ c.subscriptions![0].plan.displayName }}</span>
                }
                <span class="meta-chip">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                  {{ c._count?.users ?? 0 }} usuarios
                </span>
              </div>
              <div class="co-card-actions">
                <button class="btn btn-ghost-sm" (click)="openDetail(c)">Ver</button>
                <button class="btn btn-ghost-sm" (click)="openEdit(c)">Editar</button>
                <button class="btn btn-ghost-sm" (click)="openUsers(c)">Usuarios</button>
                <button class="btn btn-ghost-sm" (click)="openChangePlan(c)">Plan</button>
                @if (c.status === 'ACTIVE' || c.status === 'TRIAL') {
                  <button class="btn btn-ghost-sm btn-danger-ghost" (click)="suspend(c)">Suspender</button>
                }
                @if (c.status === 'SUSPENDED') {
                  <button class="btn btn-ghost-sm btn-success-ghost" (click)="activate(c)">Activar</button>
                }
              </div>
            </div>
          }
          @if (totalPages() > 1) {
            <div class="pagination mobile-pag">
              <button class="page-btn" [disabled]="page()===1" (click)="setPage(page()-1)">‹</button>
              <span class="text-muted">{{ page() }} / {{ totalPages() }}</span>
              <button class="page-btn" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">›</button>
            </div>
          }
        }
      </div>
      } <!-- /viewMode table mobile -->
    </div>

    <!-- ════════════════════════════════════════════════════════
         MODALES
         ════════════════════════════════════════════════════════ -->

    <!-- ── Crear / Editar empresa ──────────────────────────── -->
    @if (modal() === 'create' || modal() === 'edit') {
      <div class="modal-overlay" >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ modal() === 'create' ? 'Nueva empresa' : 'Editar empresa' }}</h3>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre comercial *</label>
                <input type="text" [(ngModel)]="form.name" class="form-control" placeholder="Empresa S.A.S"/>
              </div>
              <div class="form-group">
                <label>NIT *</label>
                <input type="text" [(ngModel)]="form.nit" class="form-control" placeholder="900.123.456-7"
                       [disabled]="modal() === 'edit'"/>
              </div>
            </div>
            <div class="form-group">
              <label>Razón social</label>
              <input type="text" [(ngModel)]="form.razonSocial" class="form-control" placeholder="Empresa S.A.S"/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Email *</label>
                <input type="email" [(ngModel)]="form.email" class="form-control" placeholder="contacto@empresa.com"/>
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="tel" [(ngModel)]="form.phone" class="form-control" placeholder="+57 300 000 0000"/>
              </div>
            </div>
            <div class="form-group">
              <label>Dirección</label>
              <input type="text" [(ngModel)]="form.address" class="form-control" placeholder="Calle 123 # 45-67"/>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" [(ngModel)]="form.city" class="form-control" placeholder="Bogotá"/>
              </div>
              <div class="form-group">
                <label>Departamento</label>
                <input type="text" [(ngModel)]="form.department" class="form-control" placeholder="Cundinamarca"/>
              </div>
            </div>
            @if (modal() === 'create') {
              <div class="form-group">
                <label>Plan inicial *</label>
                <select [(ngModel)]="form.planId" class="form-control">
                  <option value="">Selecciona un plan</option>
                  @for (p of plans(); track p.id) {
                    <option [value]="p.id">{{ p.displayName }} — {{ fmtCOP(p.price) }}/mes</option>
                  }
                </select>
              </div>
            }
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="saveCompany()">
              {{ saving() ? 'Guardando...' : (modal() === 'create' ? 'Crear empresa' : 'Guardar cambios') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Detalle empresa ─────────────────────────────────── -->
    @if (modal() === 'detail' && detailCompany()) {
      <div class="modal-overlay" >
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="detail-title">
              <div class="co-avatar co-avatar-lg">{{ detailCompany()!.name[0].toUpperCase() }}</div>
              <div>
                <h3>{{ detailCompany()!.name }}</h3>
                <span class="badge" [class]="statusClass(detailCompany()!.status)">
                  {{ statusLabel(detailCompany()!.status) }}
                </span>
              </div>
            </div>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">NIT</span>
                <span class="detail-val">{{ detailCompany()!.nit }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-val">{{ detailCompany()!.email }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Teléfono</span>
                <span class="detail-val">{{ detailCompany()!.phone || '—' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Razón social</span>
                <span class="detail-val">{{ detailCompany()!.razonSocial || '—' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Dirección</span>
                <span class="detail-val">{{ detailCompany()!.address || '—' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Ciudad</span>
                <span class="detail-val">{{ detailCompany()!.city || '—' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Departamento</span>
                <span class="detail-val">{{ detailCompany()!.department || '—' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Plan</span>
                <span class="detail-val">
                  @if (detailCompany()!.subscriptions?.length) {
                    <span class="badge badge-primary">{{ detailCompany()!.subscriptions![0].plan.displayName }}</span>
                  } @else { Sin plan }
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Usuarios</span>
                <span class="detail-val">{{ detailCompany()!._count?.users ?? 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Facturas</span>
                <span class="detail-val">{{ detailCompany()!._count?.invoices ?? 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Registro</span>
                <span class="detail-val">{{ detailCompany()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cerrar</button>
            <button class="btn btn-ghost" (click)="openUsers(detailCompany()!)">Ver usuarios</button>
            <button class="btn btn-primary" (click)="openEdit(detailCompany()!)">Editar</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Cambiar plan ─────────────────────────────────────── -->
    @if (modal() === 'plan' && planTarget()) {
      <div class="modal-overlay" >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Cambiar plan — {{ planTarget()!.name }}</h3>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Nuevo plan</label>
              <select [(ngModel)]="selectedPlanId" class="form-control">
                <option value="">Selecciona un plan</option>
                @for (p of plans(); track p.id) {
                  <option [value]="p.id">{{ p.displayName }} — {{ fmtCOP(p.price) }}/mes</option>
                }
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="changePlan()">
              {{ saving() ? 'Cambiando...' : 'Confirmar cambio' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Usuarios de la empresa ──────────────────────────── -->
    @if (modal() === 'users' && usersCompany()) {
      <div class="modal-overlay" >
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Usuarios — {{ usersCompany()!.name }}</h3>
              <p class="modal-sub">Gestión completa de usuarios de esta empresa</p>
            </div>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>

          <div class="modal-body">
            @if (loadingUsers()) {
              @for (i of [1,2,3]; track i) {
                <div class="user-sk-row">
                  <div class="sk" style="width:32px;height:32px;border-radius:8px;flex-shrink:0"></div>
                  <div style="flex:1;display:flex;flex-direction:column;gap:4px">
                    <div class="sk" style="width:140px;height:13px"></div>
                    <div class="sk" style="width:100px;height:11px"></div>
                  </div>
                  <div class="sk" style="width:64px;height:20px;border-radius:8px"></div>
                  <div class="sk" style="width:50px;height:28px;border-radius:7px"></div>
                </div>
              }
            } @else if (companyUsers().length === 0) {
              <div class="users-empty">
                <svg viewBox="0 0 48 48" fill="none" width="40">
                  <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
                  <path d="M16 28a8 8 0 0116 0M24 20a4 4 0 100-8 4 4 0 000 8z" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <p>No hay usuarios en esta empresa aún.</p>
                <button class="btn btn-primary" (click)="openUserForm()">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
                  Invitar primer usuario
                </button>
              </div>
            } @else {
              <div class="users-list">
                @for (u of companyUsers(); track u.id) {
                  <div class="cu-row">
                    <div class="cu-avatar">{{ (u.firstName[0]||'')+(u.lastName[0]||'') }}</div>

                    <div class="cu-info">
                      <div class="cu-name">{{ u.firstName }} {{ u.lastName }}</div>
                      <div class="cu-email">{{ u.email }}</div>
                      <!-- roles + status visibles en móvil -->
                      <div class="cu-meta-mobile">
                        @for (e of u.roles; track e.role.id) {
                          <span class="role-badge role-{{ e.role.name.toLowerCase() }}">{{ e.role.displayName }}</span>
                        }
                        <span class="status-dot" [class.active]="u.isActive"></span>
                        <span class="status-txt">{{ u.isActive ? 'Activo' : 'Inactivo' }}</span>
                      </div>
                    </div>

                    <div class="cu-roles cu-roles-desktop">
                      @for (e of u.roles; track e.role.id) {
                        <span class="role-badge role-{{ e.role.name.toLowerCase() }}">{{ e.role.displayName }}</span>
                      }
                    </div>

                    <div class="cu-status cu-status-desktop">
                      <span class="status-dot" [class.active]="u.isActive"></span>
                      <span class="status-txt">{{ u.isActive ? 'Activo' : 'Inactivo' }}</span>
                    </div>

                    <div class="cu-actions">
                      <!-- Selector de rol inline (dinámico desde backend) -->
                      <select class="role-select" [ngModel]="firstRoleId(u)"
                              (ngModelChange)="changeUserRole(u, $event)">
                        @for (r of availableRoles(); track r.id) {
                          <option [value]="r.id">{{ r.displayName }}</option>
                        }
                      </select>
                      <!-- Editar -->
                      <button class="btn-icon" title="Editar" (click)="openUserForm(u)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                      <!-- Activar / Desactivar -->
                      <button class="btn-icon" [title]="u.isActive ? 'Desactivar' : 'Activar'"
                              (click)="toggleUserActive(u)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="modal-footer modal-footer-users">
            <button class="btn btn-secondary" (click)="closeModal()">Cerrar</button>
            <button class="btn btn-primary" (click)="openUserForm()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
              Invitar usuario
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Formulario invitar / editar usuario ─────────────── -->
    @if (modal() === 'user-form' && usersCompany()) {
      <div class="modal-overlay" >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ editingUserId() ? 'Editar usuario' : 'Invitar usuario' }}</h3>
              <p class="modal-sub">{{ usersCompany()!.name }}</p>
            </div>
            <button class="modal-close" (click)="backToUsers()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="userForm.firstName" class="form-control" placeholder="Juan"/>
              </div>
              <div class="form-group">
                <label>Apellido *</label>
                <input type="text" [(ngModel)]="userForm.lastName" class="form-control" placeholder="Pérez"/>
              </div>
            </div>

            <div class="form-group">
              <label>Email *</label>
              <input type="email" [(ngModel)]="userForm.email" class="form-control"
                     [disabled]="!!editingUserId()" placeholder="usuario@empresa.com"/>
            </div>

            @if (!editingUserId()) {
              <div class="form-group">
                <label>Contraseña temporal *</label>
                <input type="password" [(ngModel)]="userForm.password" class="form-control"
                       placeholder="Mínimo 8 caracteres"/>
              </div>
            }

            <div class="form-group">
              <label>Rol *</label>
              @if (loadingRoles()) {
                <div class="form-control" style="color:#94a3b8">Cargando roles...</div>
              } @else {
                <select [(ngModel)]="userForm.roleId" class="form-control">
                  @for (r of availableRoles(); track r.id) {
                    <option [value]="r.id">{{ r.displayName }}</option>
                  }
                </select>
              }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="backToUsers()">Volver</button>
            <button class="btn btn-primary" [disabled]="savingUser()" (click)="saveUser()">
              {{ savingUser() ? 'Guardando...' : (editingUserId() ? 'Actualizar' : 'Enviar invitación') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1260px; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .animate-in { animation: fadeUp .25s ease; }

    /* ── Header ──────────────────────────────────────── */
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }

    /* ── Filtros ─────────────────────────────────────── */
    .filters-bar { display:flex; gap:12px; margin-bottom:16px; align-items:center; flex-wrap:wrap; }
    .search-wrap { position:relative; flex:1; min-width:180px; max-width:360px; }
    .search-icon { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
    .search-input { padding-left:34px !important; }
    .filter-select { max-width:220px; flex-shrink:0; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; outline:none; box-sizing:border-box; background:#fff; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control:disabled { background:#f8fafc; color:#9ca3af; }

    /* ── Tabla desktop ───────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .co-table { width:100%; border-collapse:collapse; min-width:720px; }
    .co-table th { padding:10px 13px; text-align:left; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.07em; background:#f8fafc; border-bottom:1px solid #dce6f0; }
    .co-row { transition:background .1s; }
    .co-row:hover { background:#f8fafc; }
    .co-row td { padding:11px 13px; border-bottom:1px solid #f0f4f9; vertical-align:middle; }
    .co-cell { display:flex; align-items:center; gap:10px; }
    .co-avatar { width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .co-avatar-lg { width:42px; height:42px; font-size:16px; border-radius:11px; }
    .co-name { font-size:13.5px; font-weight:600; color:#0c1c35; }
    .co-email { font-size:11.5px; color:#94a3b8; }
    .co-invoices { font-size:13px; color:#475569; }
    .text-center { text-align:center; }
    .text-muted { color:#94a3b8; font-size:12.5px; }

    /* Badges */
    .badge { display:inline-block; padding:3px 9px; border-radius:99px; font-size:11px; font-weight:700; white-space:nowrap; }
    .badge-muted    { background:#f0f4f9; color:#64748b; }
    .badge-primary  { background:#dbeafe; color:#1d4ed8; }
    .badge-success  { background:#dcfce7; color:#166534; }
    .badge-warning  { background:#fef3c7; color:#92400e; }
    .badge-danger   { background:#fee2e2; color:#dc2626; }

    .count-btn { display:inline-flex; align-items:center; gap:4px; background:#f0f4f9; border:none; border-radius:7px; padding:4px 9px; font-size:12px; font-weight:600; color:#475569; cursor:pointer; transition:all .15s; }
    .count-btn:hover { background:#dbeafe; color:#1d4ed8; }

    /* Acciones */
    .row-actions { display:flex; gap:3px; justify-content:flex-end; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#94a3b8; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; }
    .btn-icon-success:hover { background:#dcfce7; color:#166534; }

    /* Skeleton */
    .sk-row { display:flex; align-items:center; gap:14px; padding:13px 16px; border-bottom:1px solid #f0f4f9; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; display:block; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    .empty-state { display:flex; flex-direction:column; align-items:center; gap:10px; padding:48px; color:#94a3b8; font-size:14px; }

    /* Paginación */
    .pagination { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pag-btns { display:flex; gap:6px; }
    .page-btn { width:32px; height:32px; border-radius:8px; border:1px solid #dce6f0; background:#fff; color:#475569; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; font-size:16px; }
    .page-btn:hover:not(:disabled) { background:#1a407e; color:#fff; border-color:#1a407e; }
    .page-btn:disabled { opacity:.4; cursor:default; }

    /* ── Cards móvil ──────────────────────────────────── */
    .co-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:14px 16px; margin-bottom:8px; }
    .co-card-top { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
    .co-card-info { flex:1; min-width:0; }
    .co-card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
    .meta-chip { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; font-weight:600; color:#64748b; background:#f0f4f9; padding:2px 8px; border-radius:99px; }
    .co-card-actions { display:flex; gap:6px; flex-wrap:wrap; }

    .btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:background .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-ghost { background:transparent; border:1px solid #dce6f0; color:#1a407e; }
    .btn-ghost:hover { background:#f0f4f9; }
    .btn-ghost-sm { background:#f0f4f9; color:#374151; border:none; padding:5px 10px; font-size:12px; border-radius:7px; cursor:pointer; font-weight:600; }
    .btn-ghost-sm:hover { background:#e8eef8; }
    .btn-danger-ghost { color:#dc2626; }
    .btn-danger-ghost:hover { background:#fee2e2; }
    .btn-success-ghost { color:#166534; }
    .btn-success-ghost:hover { background:#dcfce7; }

    /* ── Modales ─────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; width:100vw; height:100dvh; background:rgba(12,28,53,.52); z-index:5000; display:flex; align-items:center; justify-content:center; padding:24px; backdrop-filter:blur(4px); }
    .modal { background:#fff; border-radius:18px; width:min(560px, 100%); max-height:min(92dvh, 920px); overflow:hidden; display:flex; flex-direction:column; box-shadow:0 28px 80px rgba(12,28,53,.28); }
    .modal-lg { max-width:680px; }
    .modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-sub { font-size:12px; color:#94a3b8; margin:3px 0 0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; font-size:22px; padding:0 4px; flex-shrink:0; }
    .modal-body { padding:20px 24px; overflow:auto; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; flex-shrink:0; flex-wrap:wrap; }
    .modal-footer-users { justify-content:space-between; }

    .detail-title { display:flex; align-items:center; gap:12px; }
    .detail-title h3 { margin:0 0 4px; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
    .detail-item { padding:10px 0; border-bottom:1px solid #f0f4f8; display:flex; flex-direction:column; gap:3px; padding-right:16px; }
    .detail-item:nth-last-child(-n+2) { border-bottom:none; }
    .detail-label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; }
    .detail-val { font-size:13.5px; color:#0c1c35; font-weight:500; }

    /* Formulario en modal */
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }

    /* ── Panel usuarios ───────────────────────────────── */
    .add-user-form { background:#f8fafc; border:1px solid #dce6f0; border-radius:10px; padding:14px 16px; margin-bottom:16px; }
    .add-user-title { font-size:13px; font-weight:700; color:#0c1c35; margin-bottom:12px; }
    .add-user-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }

    .users-list { display:flex; flex-direction:column; gap:0; border:1px solid #dce6f0; border-radius:10px; overflow:hidden; }
    .cu-row { display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:1px solid #f0f4f8; }
    .cu-row:last-child { border-bottom:none; }
    .cu-avatar { width:30px; height:30px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-transform:uppercase; }
    .cu-info { flex:1; min-width:0; }
    .cu-name { font-size:13px; font-weight:600; color:#0c1c35; }
    .cu-email { font-size:11px; color:#94a3b8; }
    .cu-roles { display:flex; gap:4px; flex-wrap:wrap; }
    .cu-status { display:flex; align-items:center; gap:5px; min-width:60px; }
    .status-dot { width:6px; height:6px; border-radius:50%; background:#d1d5db; flex-shrink:0; }
    .status-dot.active { background:#10b981; }
    .status-txt { font-size:11.5px; color:#374151; }
    .cu-actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }

    .role-badge { padding:2px 7px; border-radius:6px; font-size:10.5px; font-weight:700; }
    .role-admin    { background:#dbeafe; color:#1e40af; }
    .role-manager  { background:#ede9fe; color:#5b21b6; }
    .role-operator { background:#d1fae5; color:#065f46; }
    .role-viewer   { background:#f3f4f6; color:#6b7280; }

    .role-select { font-size:12px; padding:4px 8px; border:1px solid #dce6f0; border-radius:6px; color:#374151; background:#fff; cursor:pointer; outline:none; }
    .role-select:focus { border-color:#1a407e; }

    .users-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:36px; color:#94a3b8; font-size:13px; }
    .user-sk-row { display:flex; align-items:center; gap:12px; padding:11px 0; border-bottom:1px solid #f0f4f8; }

    /* Columnas desktop/móvil en panel usuarios */
    .cu-meta-mobile  { display:none; }
    .cu-roles-desktop, .cu-status-desktop { display:flex; }

    /* ── View toggle ─────────────────────────────────────── */
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:8px; overflow:hidden; margin-left:auto; flex-shrink:0; }
    .view-toggle button { padding:7px 10px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button:hover { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }

    /* ── Grid view ───────────────────────────────────────── */
    .company-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(248px, 1fr));
      gap:14px;
    }
    .co-grid-card {
      background:#fff; border:1px solid #dce6f0; border-radius:13px;
      padding:18px 16px 14px; position:relative;
      display:flex; flex-direction:column; gap:0;
      transition:box-shadow .18s, transform .18s;
    }
    .co-grid-card:hover { box-shadow:0 4px 20px rgba(26,64,126,.1); transform:translateY(-2px); }
    .co-grid-card--suspended { opacity:.75; border-color:#fde8d8; background:#fffaf8; }
    .co-grid-card--cancelled  { opacity:.6; border-color:#f0d4d4; background:#fdfafa; }
    .co-grid-card--skeleton   { pointer-events:none; }

    .cc-status-badge { position:absolute; top:12px; right:12px; }

    .co-grid-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 0 12px; }
    .co-grid-avatar {
      width:52px; height:52px; border-radius:13px;
      background:linear-gradient(135deg,#1a407e,#00c6a0);
      color:#fff; font-size:18px; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      font-family:'Sora',sans-serif; margin-bottom:10px;
    }
    .co-grid-name { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:5px; }
    .co-grid-nit  { display:flex; justify-content:center; }

    .co-grid-info {
      border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px;
      display:flex; flex-direction:column; gap:6px; flex:1;
    }
    .co-grid-row {
      display:flex; align-items:center; gap:6px;
      font-size:12px; color:#64748b;
    }
    .co-grid-row svg { color:#94a3b8; flex-shrink:0; }
    .co-grid-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .co-grid-row--muted { color:#94a3b8; }

    .co-grid-counters { display:flex; gap:6px; flex-wrap:wrap; margin-top:2px; }
    .co-grid-count {
      display:inline-flex; align-items:center; gap:4px;
      background:#f0f4f9; border:none; border-radius:7px;
      padding:3px 8px; font-size:11.5px; font-weight:600;
      color:#475569; cursor:pointer; transition:all .15s;
    }
    .co-grid-count:hover { background:#dbeafe; color:#1d4ed8; }
    .co-grid-count--plain { cursor:default; }
    .co-grid-count--plain:hover { background:#f0f4f9; color:#475569; }

    .co-grid-actions {
      display:flex; gap:6px; align-items:center;
      border-top:1px solid #f0f4f8; padding-top:10px; flex-wrap:wrap;
    }
    .co-grid-actions .btn { flex:1; justify-content:center; min-width:0; }

    .sk-avatar-grid { width:52px; height:52px; border-radius:13px; display:block; margin:0 auto 10px; }

    .grid-empty-state {
      padding:64px 24px; text-align:center; color:#9ca3af;
      background:#fff; border:1px solid #dce6f0; border-radius:13px;
      display:flex; flex-direction:column; align-items:center; gap:12px;
    }
    .grid-empty-state p { font-size:14px; margin:0; }

    .pagination--standalone {
      background:#fff; border:1px solid #dce6f0; border-radius:12px;
      margin-top:4px;
    }
    .btn-sm { padding:6px 12px; font-size:12.5px; }

    /* ── Responsive ──────────────────────────────────────── */
    .desktop-only { display:block; }
    .mobile-only  { display:none; }
    .mobile-pag   { background:#fff; border:1px solid #dce6f0; border-radius:12px; margin-top:4px; justify-content:center; }

    @media (max-width: 900px) {
      .filter-select { max-width:180px; }
      .company-grid { grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
    }

    @media (max-width: 700px) {
      .desktop-only { display:none !important; }
      .mobile-only  { display:block; }
      .page-header { flex-direction:column; align-items:stretch; }
      .btn.btn-primary { width:100%; justify-content:center; }
      .filters-bar { flex-direction:column; align-items:stretch; }
      .search-wrap { max-width:100%; }
      .filter-select { max-width:100%; }
      .view-toggle { margin-left:0; align-self:flex-end; }
      .company-grid { grid-template-columns:repeat(2, 1fr); gap:10px; }
    }

    @media (max-width: 480px) {
      .company-grid { grid-template-columns:1fr; }
    }

    @media (max-width: 560px) {
      .modal-overlay { align-items:center; justify-content:center; padding:16px; }
      .modal, .modal-lg { border-radius:18px; width:100%; max-width:100%; max-height:92dvh; }
      .form-row { grid-template-columns:1fr; }
      .detail-grid { grid-template-columns:1fr; }
      .detail-item:last-child { border-bottom:none; }
      .modal-footer { flex-direction:column-reverse; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .modal-footer-users { flex-direction:column; }
      /* Panel usuarios: ocultar columnas desktop, mostrar meta inline */
      .cu-row { flex-wrap:wrap; gap:8px; }
      .cu-roles-desktop  { display:none !important; }
      .cu-status-desktop { display:none !important; }
      .cu-meta-mobile {
        display:flex; align-items:center; gap:6px;
        flex-wrap:wrap; margin-top:4px;
      }
      .cu-actions { width:100%; justify-content:flex-end; }
    }

    @media (max-width: 400px) {
      .co-card-actions { gap:4px; }
      .btn-ghost-sm { padding:4px 8px; font-size:11px; }
    }
  `]
})
export class SaCompaniesComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/super-admin`;

  companies    = signal<Company[]>([]);
  plans        = signal<Plan[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  total        = signal(0);
  page         = signal(1);
  totalPages   = signal(1);

  // Roles dinámicos desde backend
  availableRoles = signal<Role[]>([]);
  loadingRoles   = signal(false);

  modal        = signal<Modal>('none');
  detailCompany = signal<Company | null>(null);
  planTarget   = signal<Company | null>(null);
  usersCompany = signal<Company | null>(null);

  // Usuarios del panel
  companyUsers  = signal<CompanyUser[]>([]);
  loadingUsers  = signal(false);
  savingUser    = signal(false);
  editingUserId = signal<string | null>(null);
  userForm      = { firstName: '', lastName: '', email: '', password: '', roleId: '' };

  viewMode = signal<'table' | 'grid'>('table');

  // Formulario empresa
  form = EMPTY_FORM();
  editingId = '';
  search = '';
  filterStatus = '';
  selectedPlanId = '';
  private searchTimer: any;

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() { this.load(); this.loadPlans(); this.loadRoles(); }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search) params.search = this.search;
    if (this.filterStatus) params.status = this.filterStatus;
    this.http.get<any>(`${this.API}/companies`, { params }).subscribe({
      next: r => {
        this.companies.set(r.data ?? r);
        this.total.set(r.total ?? r.length);
        this.totalPages.set(r.totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadPlans() {
    this.http.get<any>(`${this.API}/plans`).subscribe({
      next: r => this.plans.set(r.data ?? r),
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  // ── Abrir modales ────────────────────────────────────────
  openCreate() {
    this.editingId = '';
    this.form = EMPTY_FORM();
    this.modal.set('create');
  }

  openEdit(c: Company) {
    this.editingId = c.id;
    this.form = {
      name: c.name, nit: c.nit, razonSocial: c.razonSocial ?? '',
      email: c.email, phone: c.phone ?? '', address: c.address ?? '',
      city: c.city ?? '', department: c.department ?? '', planId: '',
    };
    this.modal.set('edit');
  }

  openDetail(c: Company) {
    this.detailCompany.set(c);
    this.modal.set('detail');
  }

  openChangePlan(c: Company) {
    this.planTarget.set(c);
    this.selectedPlanId = '';
    this.modal.set('plan');
  }

  openUsers(c: Company) {
    this.usersCompany.set(c);
    this.editingUserId.set(null);
    this.userForm = { firstName: '', lastName: '', email: '', password: '', roleId: this.availableRoles()[0]?.id ?? '' };
    this.modal.set('users');
    this.loadUsers(c.id);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales — solo el botón X
  }

    closeModal() {
    this.modal.set('none');
    this.detailCompany.set(null);
    this.planTarget.set(null);
    this.usersCompany.set(null);
  }

  // ── CRUD empresa ─────────────────────────────────────────
  saveCompany() {
    if (!this.form.name || !this.form.email) {
      this.notify.warning('Nombre y email son obligatorios'); return;
    }
    this.saving.set(true);
    const body: any = { ...this.form };

    const req = this.editingId
      ? this.http.patch(`${this.API}/companies/${this.editingId}`, body)
      : this.http.post(`${this.API}/companies`, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingId ? 'Empresa actualizada' : 'Empresa creada');
        this.saving.set(false); this.closeModal(); this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  suspend(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/suspend`, {}).subscribe({
      next: () => { this.notify.success('Empresa suspendida'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error'),
    });
  }

  activate(c: Company) {
    this.http.post(`${this.API}/companies/${c.id}/activate`, {}).subscribe({
      next: () => { this.notify.success('Empresa activada'); this.load(); },
      error: e => this.notify.error(e?.error?.message ?? 'Error'),
    });
  }

  changePlan() {
    if (!this.selectedPlanId) { this.notify.warning('Selecciona un plan'); return; }
    this.saving.set(true);
    this.http.post(`${this.API}/companies/${this.planTarget()!.id}/change-plan`, { planId: this.selectedPlanId }).subscribe({
      next: () => {
        this.notify.success('Plan cambiado exitosamente');
        this.saving.set(false); this.closeModal(); this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  // ── Roles dinámicos ──────────────────────────────────────
  loadRoles() {
    this.loadingRoles.set(true);
    this.http.get<any>(`${this.API}/roles`).subscribe({
      next: r => {
        this.availableRoles.set(r.data ?? r);
        // Si no hay rol seleccionado aún, preseleccionar el primero
        if (!this.userForm.roleId && (r.data ?? r).length) {
          this.userForm.roleId = (r.data ?? r)[0].id;
        }
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false),
    });
  }

  // ── Usuarios de empresa ──────────────────────────────────
  loadUsers(companyId: string) {
    this.loadingUsers.set(true);
    this.http.get<any>(`${this.API}/companies/${companyId}/users`).subscribe({
      next: r => { this.companyUsers.set(r.data ?? r); this.loadingUsers.set(false); },
      error: () => this.loadingUsers.set(false),
    });
  }

  openUserForm(u?: CompanyUser) {
    const defaultRoleId = this.availableRoles()[0]?.id ?? '';
    if (u) {
      this.editingUserId.set(u.id);
      this.userForm = { firstName: u.firstName, lastName: u.lastName, email: u.email, password: '', roleId: this.firstRoleId(u) || defaultRoleId };
    } else {
      this.editingUserId.set(null);
      this.userForm = { firstName: '', lastName: '', email: '', password: '', roleId: defaultRoleId };
    }
    this.modal.set('user-form');
  }

  saveUser() {
    if (!this.userForm.firstName || !this.userForm.email) {
      this.notify.warning('Nombre y email son obligatorios'); return;
    }
    this.savingUser.set(true);
    const cid = this.usersCompany()!.id;

    const body: any = {
      firstName: this.userForm.firstName,
      lastName:  this.userForm.lastName,
      email:     this.userForm.email,
      roleId:    this.userForm.roleId,
    };
    if (!this.editingUserId() && this.userForm.password) body.password = this.userForm.password;

    const req = this.editingUserId()
      ? this.http.patch(`${this.API}/companies/${cid}/users/${this.editingUserId()}`, body)
      : this.http.post(`${this.API}/companies/${cid}/users`, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingUserId() ? 'Usuario actualizado' : 'Usuario creado');
        this.savingUser.set(false);
        this.modal.set('users');
        this.loadUsers(cid);
      },
      error: e => { this.savingUser.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  toggleUserActive(u: CompanyUser) {
    const cid = this.usersCompany()!.id;
    this.http.patch(`${this.API}/companies/${cid}/users/${u.id}/toggle-active`, {}).subscribe({
      next: () => { this.notify.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado'); this.loadUsers(cid); },
      error: e => this.notify.error(e?.error?.message ?? 'Error'),
    });
  }

  changeUserRole(u: CompanyUser, roleId: string) {
    const cid = this.usersCompany()!.id;
    this.http.patch(`${this.API}/companies/${cid}/users/${u.id}`, { roleId }).subscribe({
      next: () => { this.notify.success('Rol actualizado'); this.loadUsers(cid); },
      error: e => { this.notify.error(e?.error?.message ?? 'Error'); this.loadUsers(cid); },
    });
  }

  backToUsers() {
    this.modal.set('users');
    this.editingUserId.set(null);
  }

  // ── Helpers ──────────────────────────────────────────────
  statusLabel(s: string) {
    return ({ ACTIVE:'Activo', TRIAL:'Trial', SUSPENDED:'Suspendido', CANCELLED:'Cancelado' } as any)[s] ?? s;
  }
  statusClass(s: string) {
    return ({ ACTIVE:'badge-success', TRIAL:'badge-warning', SUSPENDED:'badge-danger', CANCELLED:'badge-muted' } as any)[s] ?? 'badge-muted';
  }
  firstRoleId(u: CompanyUser): string  { return u.roles[0]?.role?.id   ?? ''; }
  firstRoleName(u: CompanyUser): string { return u.roles[0]?.role?.name ?? ''; }

  roleLabel(r: string) {
    // Primero busca en roles dinámicos del backend; fallback a mapa estático
    const found = this.availableRoles().find(role => role.name === r);
    return found?.displayName ?? ({ ADMIN:'Admin', MANAGER:'Gerente', OPERATOR:'Operador' } as any)[r] ?? r;
  }
  fmtCOP(v: number) {
    return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v);
  }
  min(a: number, b: number) { return Math.min(a, b); }
}
