import { Component, HostListener, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../model/paginate-response.model';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';

// ── Interfaces de dominio ─────────────────────────────────────────────────────
interface Customer {
  id: string;
  documentType: 'NIT' | 'CC' | 'CE' | 'PASSPORT' | 'TI';
  documentNumber: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  department?: string;
  cityCode?: string;
  departmentCode?: string;
  country?: string;
  creditLimit?: number;
  creditDays?: number;
  isActive: boolean;
  createdAt: string;
  invoices?: Array<{ id: string; invoiceNumber: string; total: number; status: string; issueDate: string }>;
}

interface CustomerForm {
  documentType: string;
  documentNumber: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  // Ubicación — se envían al backend; el backend los valida/resuelve desde el catálogo
  cityCode: string;       // DIVIPOLA 5 dígitos — campo principal de ubicación
  departmentCode: string; // DIVIPOLA 2 dígitos — se preselecciona para filtrar municipios
  country: string;        // ISO alpha-2, default 'CO'
  creditLimit: number | null;
  creditDays: number | null;
}

// ── Interfaces de catálogo geográfico ─────────────────────────────────────────
interface Department { code: string; name: string; countryCode: string; }
interface Municipality { code: string; name: string; departmentCode: string; department?: { name: string }; }
interface Country { code: string; name: string; }

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <section class="hero-shell" id="tour-customers-header">
        <div class="page-header">
          <div class="hero-copy">
            <p class="hero-kicker">Relacion comercial</p>
            <h2 class="page-title">Clientes</h2>
            <p class="page-subtitle">Gestiona tu base comercial con una vista más moderna, clara y cómoda para el trabajo diario.</p>
          </div>
          <button class="btn btn-primary" id="tour-new-customer" (click)="openModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
            Nuevo cliente
          </button>
        </div>
        <div class="hero-aside">
          <div class="hero-highlight">
            <span class="hero-highlight-label">Base visible</span>
            <strong>{{ total() }}</strong>
            <small>{{ viewMode() === 'table' ? 'Vista operativa detallada' : 'Vista visual por tarjetas' }}</small>
          </div>
          <div class="hero-mini-grid">
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Activos</span>
              <strong>{{ activeCustomersCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Con crédito</span>
              <strong>{{ creditCustomersCount() }}</strong>
            </div>
            <div class="hero-mini-card">
              <span class="hero-mini-card__label">Sin email</span>
              <strong>{{ missingEmailCustomersCount() }}</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- KPI strip -->
      <section class="kpi-strip">
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M10 2a5 5 0 00-3.536 8.536l-.707.707A1 1 0 006.464 13.95l.707-.707A5 5 0 1010 2zm-3 5a3 3 0 116 0 3 3 0 01-6 0z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Clientes activos</span>
            <strong class="kpi-card__value">{{ activeCustomersCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h2a1 1 0 010 2H5a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Con crédito</span>
            <strong class="kpi-card__value">{{ creditCustomersCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M2.94 6.34A2 2 0 014.8 5h10.4a2 2 0 011.86 1.34L10 10.25 2.94 6.34z"/><path d="M18 8.17l-7.37 4.08a1.5 1.5 0 01-1.26 0L2 8.17V14a2 2 0 002 2h12a2 2 0 002-2V8.17z"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Con email</span>
            <strong class="kpi-card__value">{{ customersWithEmailCount() }}</strong>
          </div>
        </article>
        <article class="kpi-card">
          <div class="kpi-card__icon">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/></svg>
          </div>
          <div>
            <span class="kpi-card__label">Con teléfono</span>
            <strong class="kpi-card__value">{{ customersWithPhoneCount() }}</strong>
          </div>
        </article>
      </section>

      <!-- Filters + View Toggle -->
      <section class="filters-shell">
        <div class="filters-head">
          <div>
            <p class="filters-kicker">Exploracion</p>
            <h3>Filtra y encuentra clientes más rápido</h3>
          </div>
          <div class="results-pill">{{ total() }} resultados</div>
        </div>
        <div class="filters-bar">
          <div class="search-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
            <input type="text" placeholder="Buscar por nombre, documento o email..."
                   [(ngModel)]="search" (ngModelChange)="onSearch()" class="search-input"/>
          </div>
          <select [(ngModel)]="filterActive" (ngModelChange)="load()" class="filter-select">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
          <div class="view-toggle">
            <button [class.active]="viewMode() === 'table'" (click)="viewMode.set('table')" title="Vista tabla">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/></svg>
            </button>
            <button [class.active]="viewMode() === 'grid'" (click)="viewMode.set('grid')" title="Vista cuadrícula">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- ══ TABLE VIEW ══ -->
      @if (viewMode() === 'table') {
        <div class="table-card" id="tour-customers-table">
          @if (loading()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-avatar"></div>
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:120px"></div>
                  <div class="sk sk-line" style="width:140px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:60px"></div>
                </div>
              }
            </div>
          } @else if (customers().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
                <path stroke-linecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
              </svg>
              <p>{{ search ? 'Sin resultados para "' + search + '"' : 'No hay clientes registrados aún' }}</p>
              @if (!search) { <button class="btn btn-primary btn-sm" (click)="openModal()">Crear primer cliente</button> }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cliente</th><th>Documento</th><th>Contacto</th>
                  <th>Ubicación</th><th>Crédito</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of customers(); track c.id) {
                  <tr>
                    <td>
                      <div class="customer-cell">
                        <div class="cust-avatar">{{ initials(c.name) }}</div>
                        <div>
                          <div class="cust-name">{{ c.name }}</div>
                          @if (c.email) { <div class="cust-email">{{ c.email }}</div> }
                        </div>
                      </div>
                    </td>
                    <td><span class="doc-badge">{{ c.documentType }}</span><span class="doc-number">{{ c.documentNumber }}</span></td>
                    <td class="text-muted">{{ c.phone || '—' }}</td>
                    <td class="text-muted">
                      @if (c.city) { {{ c.city }}@if (c.department) {, {{ c.department }}} }
                      @else { — }
                    </td>
                    <td>
                      @if (c.creditDays) { <span class="credit-badge">{{ c.creditDays }}d / {{ formatCurrency(c.creditLimit) }}</span> }
                      @else { <span class="text-muted">Contado</span> }
                    </td>
                    <td>
                      <span class="status-badge" [class.active]="c.isActive" [class.inactive]="!c.isActive">
                        {{ c.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Ver detalle" (click)="viewDetail(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      </button>
                      <button class="btn-icon" title="Editar" (click)="openModal(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      </button>
                      <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDelete(c)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            @if (totalPages() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (page()-1)*limit + 1 }}–{{ min(page()*limit, total()) }} de {{ total() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="page() === 1" (click)="setPage(page()-1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                  </button>
                  @for (p of pageRange(); track p) {
                    <button class="btn-page" [class.active]="p === page()" (click)="setPage(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="page() === totalPages()" (click)="setPage(page()+1)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ══ GRID VIEW ══ -->
      @if (viewMode() === 'grid') {
        @if (loading()) {
          <div class="customer-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="customer-card customer-card--skeleton">
                <div class="sk sk-avatar cc-sk-avatar"></div>
                <div class="sk sk-line" style="width:70%;margin:10px auto 6px"></div>
                <div class="sk sk-line" style="width:50%;margin:0 auto 14px"></div>
                <div class="sk sk-line" style="width:90%"></div>
                <div class="sk sk-line" style="width:80%;margin-top:6px"></div>
              </div>
            }
          </div>
        } @else if (customers().length === 0) {
          <div class="empty-state-grid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path stroke-linecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
            </svg>
            <p>{{ search ? 'Sin resultados para "' + search + '"' : 'No hay clientes registrados aún' }}</p>
            @if (!search) { <button class="btn btn-primary btn-sm" (click)="openModal()">Crear primer cliente</button> }
          </div>
        } @else {
          <div class="customer-grid">
            @for (c of customers(); track c.id) {
              <div class="customer-card" [class.customer-card--inactive]="!c.isActive">
                <span class="cc-status status-badge" [class.active]="c.isActive" [class.inactive]="!c.isActive">
                  {{ c.isActive ? 'Activo' : 'Inactivo' }}
                </span>
                <div class="cc-top">
                  <div class="cc-avatar">{{ initials(c.name) }}</div>
                  <div class="cc-name">{{ c.name }}</div>
                  <div class="cc-doc"><span class="doc-badge">{{ c.documentType }}</span>{{ c.documentNumber }}</div>
                </div>
                <div class="cc-info">
                  @if (c.email) {
                    <div class="cc-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                      <span>{{ c.email }}</span>
                    </div>
                  }
                  @if (c.phone) {
                    <div class="cc-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                      <span>{{ c.phone }}</span>
                    </div>
                  }
                  @if (c.city) {
                    <div class="cc-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
                      <span>{{ c.city }}@if (c.department) {, {{ c.department }}}</span>
                    </div>
                  }
                  @if (c.creditDays) {
                    <div class="cc-info-row cc-credit">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
                      <span>{{ c.creditDays }}d · {{ formatCurrency(c.creditLimit) }}</span>
                    </div>
                  }
                </div>
                <div class="cc-actions">
                  <button class="btn btn-sm btn-secondary" (click)="viewDetail(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    Ver
                  </button>
                  <button class="btn btn-sm btn-secondary" (click)="openModal(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                    Editar
                  </button>
                  <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDelete(c)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination pagination--standalone">
              <span class="pagination-info">{{ (page()-1)*limit + 1 }}–{{ min(page()*limit, total()) }} de {{ total() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page() === 1" (click)="setPage(page()-1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/></svg>
                </button>
                @for (p of pageRange(); track p) {
                  <button class="btn-page" [class.active]="p === page()" (click)="setPage(p)">{{ p }}</button>
                }
                <button class="btn-page" [disabled]="page() === totalPages()" (click)="setPage(page()+1)">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/></svg>
                </button>
              </div>
            </div>
          }
        }
      }

    </div>

    <!-- ── Detail Drawer ───────────────────────────────────── -->
    @if (detailCustomer()) {
      <div class="drawer-overlay" (click)="closeDetail()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-avatar">{{ initials(detailCustomer()!.name) }}</div>
            <div>
              <div class="drawer-title">{{ detailCustomer()!.name }}</div>
              <div class="drawer-sub">{{ detailCustomer()!.documentType }} {{ detailCustomer()!.documentNumber }}</div>
            </div>
            <button class="drawer-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="drawer-body">
            <div class="detail-grid">
              <div class="detail-item"><span>Email</span><strong>{{ detailCustomer()!.email || '—' }}</strong></div>
              <div class="detail-item"><span>Teléfono</span><strong>{{ detailCustomer()!.phone || '—' }}</strong></div>
              <div class="detail-item"><span>Ciudad</span><strong>{{ detailCustomer()!.city || '—' }}</strong></div>
              <div class="detail-item"><span>Departamento</span><strong>{{ detailCustomer()!.department || '—' }}</strong></div>
              <div class="detail-item"><span>Cód. municipio</span><strong>{{ detailCustomer()!.cityCode || '—' }}</strong></div>
              <div class="detail-item"><span>País</span><strong>{{ detailCustomer()!.country || '—' }}</strong></div>
              <div class="detail-item"><span>Dirección</span><strong>{{ detailCustomer()!.address || '—' }}</strong></div>
              <div class="detail-item"><span>Crédito límite</span><strong>{{ formatCurrency(detailCustomer()!.creditLimit) }}</strong></div>
              <div class="detail-item"><span>Días crédito</span><strong>{{ detailCustomer()!.creditDays ?? '—' }}</strong></div>
            </div>
            @if (detailCustomer()!.invoices?.length) {
              <div class="detail-section">
                <div class="detail-section-title">Últimas facturas</div>
                @for (inv of detailCustomer()!.invoices; track inv.id) {
                  <div class="inv-row">
                    <span class="inv-num">{{ inv.invoiceNumber }}</span>
                    <span class="inv-status inv-status-{{ inv.status.toLowerCase() }}">{{ statusLabel(inv.status) }}</span>
                    <span class="inv-total">{{ formatCurrency(inv.total) }}</span>
                  </div>
                }
              </div>
            }
          </div>
          <div class="drawer-footer">
            <button class="btn btn-secondary" (click)="openModal(detailCustomer()!)">Editar cliente</button>
          </div>
        </div>
      </div>
    }

    <!-- ── Create / Edit Modal ─────────────────────────────── -->
    @if (showModal()) {
      <div class="modal-overlay" >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Editar cliente' : 'Nuevo cliente' }}</h3>
            <button class="drawer-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- Documento -->
            <div class="form-row">
              <div class="form-group">
                <label>Tipo documento *</label>
                <select [(ngModel)]="form.documentType" class="form-control">
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula (CC)</option>
                  <option value="CE">Cédula Extranjería (CE)</option>
                  <option value="PASSPORT">Pasaporte</option>
                  <option value="TI">Tarjeta Identidad (TI)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Número de documento *</label>
                <input type="text" [(ngModel)]="form.documentNumber" class="form-control" placeholder="900123456"/>
              </div>
            </div>

            <div class="form-group">
              <label>Nombre / Razón social *</label>
              <input type="text" [(ngModel)]="form.name" class="form-control" placeholder="Empresa S.A.S."/>
            </div>

            <!-- Contacto -->
            <div class="form-row">
              <div class="form-group">
                <label>Email</label>
                <input type="email" [(ngModel)]="form.email" class="form-control" placeholder="correo@empresa.com"/>
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" [(ngModel)]="form.phone" class="form-control" placeholder="+57 300 000 0000"/>
              </div>
            </div>

            <!-- ── Ubicación geográfica ──────────────────────────────── -->
            <div class="form-section-title">Ubicación</div>

            <!-- País -->
            <div class="form-row">
              <div class="form-group">
                <label>País</label>
                <select [(ngModel)]="form.country" (ngModelChange)="onCountryChange($event)" class="form-control">
                  <option value="">— Seleccionar país —</option>
                  @for (c of countries(); track c.code) {
                    <option [value]="c.code">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Departamento</label>
                @if (form.country === 'CO') {
                  <select [(ngModel)]="form.departmentCode" (ngModelChange)="onDepartmentChange($event)" class="form-control"
                          [disabled]="!form.country">
                    <option value="">— Seleccionar departamento —</option>
                    @for (d of departments(); track d.code) {
                      <option [value]="d.code">{{ d.name }}</option>
                    }
                  </select>
                } @else {
                  <!-- Para países no-CO: texto libre -->
                  <input type="text" [(ngModel)]="form.departmentCode" class="form-control" placeholder="Estado / Provincia"/>
                }
              </div>
            </div>

            <!-- Municipio con buscador (solo para CO) / texto libre para otros países -->
            <div class="form-row">
              <div class="form-group">
                <label>
                  @if (form.country === 'CO') { Municipio (DIVIPOLA) }
                  @else { Ciudad }
                </label>
                @if (form.country === 'CO') {
                  <!-- Campo de búsqueda de municipios -->
                  <div class="muni-search-wrap">
                    <input type="text"
                           [value]="muniSearchText()"
                           (input)="onMuniSearchInput($event)"
                           (focus)="muniDropdownOpen.set(true)"
                           class="form-control"
                           [placeholder]="form.departmentCode ? 'Buscar municipio...' : 'Selecciona primero el departamento'"
                           [disabled]="!form.departmentCode"
                           autocomplete="off"/>

                    @if (muniDropdownOpen() && filteredMunicipalities().length > 0) {
                      <div class="muni-dropdown">
                        @for (m of filteredMunicipalities(); track m.code) {
                          <button type="button" class="muni-option" (click)="selectMunicipality(m)">
                            <span class="muni-name">{{ m.name }}</span>
                            <span class="muni-code">{{ m.code }}</span>
                          </button>
                        }
                      </div>
                    }
                    @if (muniDropdownOpen() && muniSearchText().length >= 2 && filteredMunicipalities().length === 0 && !loadingMunis()) {
                      <div class="muni-dropdown muni-dropdown--empty">Sin resultados</div>
                    }
                    @if (loadingMunis()) {
                      <div class="muni-dropdown muni-dropdown--empty">Buscando...</div>
                    }
                  </div>
                  @if (form.cityCode) {
                    <div class="muni-selected">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
                      Cód. DIVIPOLA: <strong>{{ form.cityCode }}</strong>
                    </div>
                  }
                } @else {
                  <input type="text" [(ngModel)]="form.cityCode" class="form-control" placeholder="Nombre de la ciudad"/>
                }
              </div>
              <div class="form-group">
                <label>Dirección</label>
                <input type="text" [(ngModel)]="form.address" class="form-control" placeholder="Calle 123 #45-67"/>
              </div>
            </div>

            <!-- Crédito -->
            <div class="form-row">
              <div class="form-group">
                <label>Límite de crédito (COP)</label>
                <input type="number" [(ngModel)]="form.creditLimit" class="form-control" placeholder="0"/>
              </div>
              <div class="form-group">
                <label>Días de crédito</label>
                <input type="number" [(ngModel)]="form.creditDays" class="form-control" placeholder="30"/>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : 'Crear cliente') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Delete Confirm ─────────────────────────────────── -->
    @if (deleteTarget()) {
      <div class="modal-overlay" >
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>Eliminar cliente</h3></div>
          <div class="modal-body">
            <p>¿Estás seguro de eliminar a <strong>{{ deleteTarget()!.name }}</strong>? Esta acción no se puede deshacer.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="deleteTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="saving()" (click)="doDelete()">
              {{ saving() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1260px; padding-bottom:24px; }
    .hero-shell {
      display:grid;
      grid-template-columns:minmax(0, 1.35fr) minmax(280px, .65fr);
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
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
    .hero-copy { max-width:620px; }
    .hero-kicker {
      margin:0 0 10px;
      font-size:11px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:.16em;
      color:#89f3d1;
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
      color:#a7f3d0;
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

    /* KPI strip */
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

    /* Filters */
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
      color:#00a084;
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
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .filter-select { min-height:44px; padding:8px 12px; border:1px solid #dce6f0; border-radius:12px; font-size:14px; outline:none; background:#fff; color:#374151; box-shadow:0 8px 20px rgba(12,28,53,.03); }

    /* View toggle */
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; margin-left:auto; flex-shrink:0; background:#fff; box-shadow:0 8px 18px rgba(12,28,53,.03); }
    .view-toggle button { padding:9px 11px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button:hover { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }

    /* ── TABLE VIEW */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:18px; overflow:hidden; box-shadow:0 16px 28px rgba(12,28,53,.05); }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:12px 16px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#8aa0b8; background:#f8fbff; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:14px 16px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .customer-cell { display:flex; align-items:center; gap:10px; }
    .cust-avatar { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .cust-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .cust-email { font-size:12px; color:#9ca3af; margin-top:1px; }

    /* ── GRID VIEW */
    .customer-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px; }
    .customer-card { background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border:1px solid #dce6f0; border-radius:20px; padding:18px 16px 14px; position:relative; transition:box-shadow .18s, transform .18s, border-color .18s; display:flex; flex-direction:column; gap:0; box-shadow:0 12px 26px rgba(12,28,53,.04); }
    .customer-card:hover { box-shadow:0 18px 32px rgba(26,64,126,.1); transform:translateY(-3px); border-color:#93c5fd; }
    .customer-card--inactive { opacity:.7; border-color:#f0d4d4; background:#fdfafa; }
    .customer-card--skeleton { pointer-events:none; padding:18px 16px; }
    .cc-status { position:absolute; top:12px; right:12px; }
    .cc-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:6px 0 12px; }
    .cc-avatar { width:52px; height:52px; border-radius:12px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; margin-bottom:10px; }
    .cc-name { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:4px; }
    .cc-doc { font-size:11.5px; color:#9ca3af; display:flex; align-items:center; gap:5px; justify-content:center; }
    .cc-info { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px; display:flex; flex-direction:column; gap:5px; flex:1; }
    .cc-info-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; }
    .cc-info-row svg { color:#94a3b8; flex-shrink:0; }
    .cc-info-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cc-credit { color:#065f46; font-weight:600; }
    .cc-credit svg { color:#059669; }
    .cc-actions { display:flex; gap:6px; align-items:center; border-top:1px solid #f0f4f8; padding-top:10px; }
    .cc-actions .btn { flex:1; justify-content:center; }
    .pagination--standalone { background:#fff; border:1px solid #dce6f0; border-radius:12px; margin-top:4px; }
    .empty-state-grid { grid-column:1/-1; padding:64px 24px; text-align:center; color:#9ca3af; background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .empty-state-grid p { margin:16px 0; font-size:14px; }

    /* Badges */
    .doc-badge { background:#e8eef8; color:#1a407e; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-right:4px; }
    .doc-number { font-family:monospace; font-size:13px; color:#374151; }
    .text-muted { color:#9ca3af; }
    .credit-badge { font-size:12px; color:#065f46; background:#d1fae5; padding:3px 8px; border-radius:6px; font-weight:600; }
    .status-badge { padding:3px 10px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-badge.active { background:#d1fae5; color:#065f46; }
    .status-badge.inactive { background:#fee2e2; color:#991b1b; }

    /* Actions */
    .actions-cell { text-align:right; }
    .btn-icon { background:#fff; border:1px solid #dce6f0; padding:7px; border-radius:10px; cursor:pointer; color:#9ca3af; transition:all .15s; box-shadow:0 6px 16px rgba(12,28,53,.03); }
    .btn-icon:hover { background:#f0f6ff; color:#1a407e; border-color:#93c5fd; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; }

    /* Pagination */
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; display:flex; align-items:center; justify-content:center; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* Skeleton */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:34px; height:34px; border-radius:8px; flex-shrink:0; }
    .cc-sk-avatar { width:52px; height:52px; border-radius:12px; display:block; margin:0 auto 10px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* Drawer */
    .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:100; display:flex; justify-content:flex-end; }
    .drawer { width:420px; max-width:100%; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-4px 0 24px rgba(0,0,0,.15); }
    .drawer-header { display:flex; align-items:center; gap:12px; padding:20px; border-bottom:1px solid #f0f4f8; }
    .drawer-avatar { width:44px; height:44px; border-radius:10px; background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:'Sora',sans-serif; }
    .drawer-title { font-weight:700; font-size:16px; color:#0c1c35; }
    .drawer-sub { font-size:12px; color:#9ca3af; margin-top:2px; }
    .drawer-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; flex-shrink:0; }
    .drawer-close:hover { background:#f0f4f8; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:20px; }
    .drawer-footer { padding:16px 20px; border-top:1px solid #f0f4f8; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
    .detail-item span { display:block; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; }
    .detail-item strong { font-size:14px; color:#0c1c35; }
    .detail-section { margin-top:16px; }
    .detail-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:10px; }
    .inv-row { display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid #f0f4f8; font-size:13px; }
    .inv-num { font-family:monospace; font-weight:600; color:#1a407e; flex:1; }
    .inv-total { font-weight:700; color:#0c1c35; }
    .inv-status { padding:2px 8px; border-radius:6px; font-size:10px; font-weight:700; }
    .inv-status-paid, .inv-status-accepted_dian { background:#d1fae5; color:#065f46; }
    .inv-status-draft { background:#f3f4f6; color:#6b7280; }
    .inv-status-overdue { background:#fee2e2; color:#991b1b; }
    .inv-status-sent_dian { background:#dbeafe; color:#1e40af; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:580px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-sm { max-width:400px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }

    /* Sección de ubicación */
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

    /* Buscador de municipios */
    .muni-search-wrap { position:relative; }
    .muni-dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff; border:1px solid #dce6f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.12); z-index:300; max-height:220px; overflow-y:auto; }
    .muni-option { display:flex; align-items:center; justify-content:space-between; width:100%; padding:9px 14px; background:none; border:none; cursor:pointer; font-size:13.5px; color:#374151; text-align:left; transition:background .1s; }
    .muni-option:hover { background:#f0f4f9; }
    .muni-name { font-weight:500; }
    .muni-code { font-size:11px; color:#9ca3af; font-family:monospace; }
    .muni-dropdown--empty { padding:12px 14px; font-size:13px; color:#9ca3af; }
    .muni-selected { display:flex; align-items:center; gap:5px; margin-top:5px; font-size:12px; color:#065f46; }
    .muni-selected svg { color:#059669; }

    /* Form */
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:6px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .form-control:disabled { background:#f8fafc; color:#9ca3af; cursor:not-allowed; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-sm { padding:7px 14px; font-size:13px; }

    /* Responsive */
    @media (max-width: 768px) {
      .hero-shell { grid-template-columns:1fr; padding:18px; border-radius:24px; }
      .page-title { font-size:26px; }
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .page-header .btn { width:100%; justify-content:center; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .filters-head { flex-direction:column; align-items:flex-start; }
      .filters-bar { gap:8px; }
      .search-wrap { max-width:100%; flex:1 1 100%; }
      .view-toggle { margin-left:0; }
      .drawer { width:100%; max-width:100%; }
      .customer-grid { grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
    }
    @media (max-width: 640px) {
      .hero-shell { padding:16px; gap:14px; }
      .hero-mini-grid,
      .kpi-strip { grid-template-columns:1fr; }
      .filters-shell { padding:14px; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:520px; }
      .drawer-overlay { align-items:flex-end; justify-content:stretch; }
      .drawer { width:100%; height:90dvh; border-radius:18px 18px 0 0; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .form-row { grid-template-columns:1fr; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
      .customer-grid { grid-template-columns:repeat(2, 1fr); gap:8px; }
    }
    @media (max-width: 400px) { .customer-grid { grid-template-columns:1fr; } }
  `]
})
export class CustomersComponent implements OnInit {
  private readonly API     = `${environment.apiUrl}/customers`;
  private readonly GEO_API = `${environment.apiUrl}/location`;

  // ── Lista principal ────────────────────────────────────────────────────────
  customers  = signal<Customer[]>([]);
  loading    = signal(true);
  saving     = signal(false);
  total      = signal(0);
  page       = signal(1);
  totalPages = signal(1);
  readonly limit = 20;

  viewMode = signal<'table' | 'grid'>('table');
  search = '';
  filterActive = '';
  private searchTimer: any;

  // ── Modal / drawer ─────────────────────────────────────────────────────────
  showModal      = signal(false);
  editingId      = signal<string | null>(null);
  detailCustomer = signal<Customer | null>(null);
  deleteTarget   = signal<Customer | null>(null);

  // ── Catálogos geográficos ──────────────────────────────────────────────────
  countries    = signal<Country[]>([]);
  departments  = signal<Department[]>([]);
  municipalities = signal<Municipality[]>([]);

  // ── Estado del buscador de municipios ─────────────────────────────────────
  muniSearchText   = signal('');
  muniDropdownOpen = signal(false);
  loadingMunis     = signal(false);

  /** Municipios filtrados: primero los del departamento seleccionado, luego por texto */
  filteredMunicipalities = computed(() => {
    const text = this.muniSearchText().toLowerCase().trim();
    const deptCode = this.form.departmentCode;
    return this.municipalities().filter(m =>
      (!deptCode || m.departmentCode === deptCode) &&
      (text.length < 2 || m.name.toLowerCase().includes(text))
    ).slice(0, 40); // max 40 opciones en dropdown
  });

  activeCustomersCount = computed(() => this.customers().filter(c => c.isActive).length);
  creditCustomersCount = computed(() => this.customers().filter(c => !!c.creditDays && Number(c.creditDays) > 0).length);
  missingEmailCustomersCount = computed(() => this.customers().filter(c => !c.email).length);
  customersWithEmailCount = computed(() => this.customers().filter(c => !!c.email).length);
  customersWithPhoneCount = computed(() => this.customers().filter(c => !!c.phone).length);

  private muniSearch$ = new Subject<{ q: string; dept: string }>();

  // ── Formulario ─────────────────────────────────────────────────────────────
  form: CustomerForm = this.emptyForm();

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.load();
    this.loadCountries();
    this.loadDepartments();
    // Búsqueda debounced de municipios
    this.muniSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.q === b.q && a.dept === b.dept),
      switchMap(({ q, dept }) => {
        if (q.length < 2 && !dept) return of([]);
        this.loadingMunis.set(true);
        const params: any = {};
        if (q.length >= 2) params.q = q;
        if (dept) params.departmentCode = dept;
        return this.http.get<Municipality[]>(`${this.GEO_API}/municipalities/search`, { params });
      }),
    ).subscribe({
      next: (munis) => { this.municipalities.set(munis); this.loadingMunis.set(false); },
      error: () => { this.loadingMunis.set(false); },
    });
  }

  // ── Carga de catálogos ─────────────────────────────────────────────────────

  private loadCountries() {
    this.http.get<Country[]>(`${this.GEO_API}/countries`).subscribe({
      next: (data) => this.countries.set(data),
      error: () => { /* no bloqueante */ },
    });
  }

  private loadDepartments(countryCode = 'CO') {
    this.http.get<Department[]>(`${this.GEO_API}/departments`, { params: { countryCode } }).subscribe({
      next: (data) => this.departments.set(data),
      error: () => { /* no bloqueante */ },
    });
  }

  private loadMunicipalitiesByDept(departmentCode: string) {
    this.loadingMunis.set(true);
    this.http.get<Municipality[]>(`${this.GEO_API}/departments/${departmentCode}/municipalities`).subscribe({
      next: (data) => { this.municipalities.set(data); this.loadingMunis.set(false); },
      error: () => { this.loadingMunis.set(false); },
    });
  }

  // ── Handlers de cambio en selectores geográficos ───────────────────────────

  onCountryChange(code: string) {
    // Al cambiar país resetear la ubicación específica
    this.form.departmentCode = '';
    this.form.cityCode       = '';
    this.muniSearchText.set('');
    this.municipalities.set([]);
    if (code === 'CO') {
      this.loadDepartments('CO');
    }
  }

  onDepartmentChange(deptCode: string) {
    // Al cambiar departamento, resetear el municipio seleccionado
    this.form.cityCode = '';
    this.muniSearchText.set('');
    if (deptCode) {
      this.loadMunicipalitiesByDept(deptCode);
    } else {
      this.municipalities.set([]);
    }
  }

  onMuniSearchInput(event: Event) {
    const q = (event.target as HTMLInputElement).value;
    this.muniSearchText.set(q);
    this.muniDropdownOpen.set(true);
    this.muniSearch$.next({ q, dept: this.form.departmentCode });
  }

  selectMunicipality(m: Municipality) {
    this.form.cityCode       = m.code;
    this.form.departmentCode = m.departmentCode;
    this.muniSearchText.set(m.name);
    this.muniDropdownOpen.set(false);
  }

  // ── CRUD principal ─────────────────────────────────────────────────────────

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: this.limit };
    if (this.search)         params.search   = this.search;
    if (this.filterActive)   params.isActive = this.filterActive;

    this.http.get<PaginatedResponse<Customer>>(this.API, { params }).subscribe({
      next: ({ data, total, totalPages }) => {
        this.customers.set(data ?? []);
        this.total.set(total ?? 0);
        this.totalPages.set(totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar clientes'); },
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const range: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) range.push(i);
    return range;
  }

  openModal(customer?: Customer) {
    if (customer) {
      this.editingId.set(customer.id);
      this.form = {
        documentType:   customer.documentType,
        documentNumber: customer.documentNumber,
        name:           customer.name,
        email:          customer.email          ?? '',
        phone:          customer.phone          ?? '',
        address:        customer.address        ?? '',
        cityCode:       customer.cityCode        ?? '',
        departmentCode: customer.departmentCode  ?? '',
        country:        customer.country         ?? 'CO',
        creditLimit:    customer.creditLimit      ?? null,
        creditDays:     customer.creditDays       ?? null,
      };
      // Cargar municipios del departamento si el cliente tiene uno
      if (customer.departmentCode) {
        this.loadMunicipalitiesByDept(customer.departmentCode);
      }
      // Mostrar el nombre del municipio en el buscador
      this.muniSearchText.set(customer.city ?? '');
    } else {
      this.editingId.set(null);
      this.form = this.emptyForm();
      this.municipalities.set([]);
      this.muniSearchText.set('');
    }
    this.muniDropdownOpen.set(false);
    this.detailCustomer.set(null);
    this.showModal.set(true);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales — solo el botón X
  }

    closeModal() {
    this.showModal.set(false);
    this.muniDropdownOpen.set(false);
  }

  save() {
    if (!this.form.documentNumber?.trim() || !this.form.name?.trim()) {
      this.notify.warning('Documento y nombre son obligatorios');
      return;
    }

    this.saving.set(true);

    // Construir el payload: incluir cityCode para que el backend resuelva los campos derivados
    const body: Record<string, any> = {
      documentType:   this.form.documentType,
      documentNumber: this.form.documentNumber,
      name:           this.form.name,
      email:          this.form.email   || undefined,
      phone:          this.form.phone   || undefined,
      address:        this.form.address || undefined,
      country:        this.form.country || 'CO',
      creditLimit:    this.form.creditLimit  ?? undefined,
      creditDays:     this.form.creditDays   ?? undefined,
    };

    // Ubicación: enviar cityCode si se seleccionó municipio del catálogo (CO),
    // o departmentCode + cityCode como texto libre para otros países
    if (this.form.country === 'CO' && this.form.cityCode) {
      body['cityCode'] = this.form.cityCode; // el backend derivará city, department, departmentCode
    } else if (this.form.country !== 'CO') {
      // Para países extranjeros enviamos texto libre
      if (this.form.departmentCode) body['department']     = this.form.departmentCode;
      if (this.form.cityCode)       body['city']           = this.form.cityCode;
    }
    if (this.form.departmentCode && this.form.country !== 'CO') {
      body['departmentCode'] = this.form.departmentCode;
    }

    const req = this.editingId()
      ? this.http.patch(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Cliente actualizado' : 'Cliente creado');
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al guardar');
      },
    });
  }

  viewDetail(c: Customer) {
    this.http.get<Customer>(`${this.API}/${c.id}`).subscribe({
      next: r  => this.detailCustomer.set(r),
      error: () => this.detailCustomer.set(c),
    });
  }

  closeDetail() { this.detailCustomer.set(null); }

  confirmDelete(c: Customer) { this.deleteTarget.set(c); }

  doDelete() {
    const c = this.deleteTarget();
    if (!c) return;
    this.saving.set(true);
    this.http.delete(`${this.API}/${c.id}`).subscribe({
      next: () => {
        this.notify.success('Cliente eliminado');
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.notify.error(e?.error?.message ?? 'Error al eliminar');
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  formatCurrency(v?: number | null): string {
    if (!v) return '—';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      DRAFT: 'Borrador', SENT_DIAN: 'Enviada', ACCEPTED_DIAN: 'Aceptada',
      REJECTED_DIAN: 'Rechazada', PAID: 'Pagada', CANCELLED: 'Anulada', OVERDUE: 'Vencida',
    };
    return map[s] ?? s;
  }

  min(a: number, b: number) { return Math.min(a, b); }

  private emptyForm(): CustomerForm {
    return {
      documentType: 'NIT', documentNumber: '', name: '',
      email: '', phone: '', address: '',
      cityCode: '', departmentCode: '', country: 'CO',
      creditLimit: null, creditDays: null,
    };
  }
}
