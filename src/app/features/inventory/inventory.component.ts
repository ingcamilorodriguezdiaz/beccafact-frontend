import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { environment } from '../../../environments/environment';

interface Product {
  id: string;
  categoryId?: string;
  category?: { id: string; name: string };
  sku: string;
  name: string;
  description?: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number;
  taxType: string;
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK';
  barcode?: string;
  imageUrl?: string;
}

interface Category { id: string; name: string; }

interface ProductForm {
  categoryId: string;
  sku: string;
  name: string;
  description: string;
  price: number | null;
  cost: number | null;
  stock: number;
  minStock: number;
  unit: string;
  taxRate: number;
  taxType: string;
  barcode: string;
  status: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Inventario</h2>
          <p class="page-subtitle">{{ total() }} productos · {{ lowStockCount() }} con stock bajo</p>
        </div>
        <div class="header-actions">
          <a routerLink="/import" class="btn btn-secondary">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"/></svg>
            Importar CSV
          </a>
          <button class="btn btn-primary" (click)="openModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
            Nuevo producto
          </button>
        </div>
      </div>

      <!-- Low stock alert -->
      @if (lowStockCount() > 0) {
        <div class="alert-bar">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
          <span><strong>{{ lowStockCount() }} productos</strong> están por debajo del stock mínimo</span>
          <button class="alert-link" (click)="filterStatus = 'low'; load()">Ver solo estos</button>
        </div>
      }

      <!-- Filters + View Toggle -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
          <input type="text" placeholder="Buscar por nombre o SKU..."
                 [(ngModel)]="search" (ngModelChange)="onSearch()" class="search-input"/>
        </div>
        <select [(ngModel)]="filterCategory" (ngModelChange)="load()" class="filter-select">
          <option value="">Todas las categorías</option>
          @for (cat of categories(); track cat.id) {
            <option [value]="cat.id">{{ cat.name }}</option>
          }
        </select>
        <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="filter-select">
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
          <option value="OUT_OF_STOCK">Sin stock</option>
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

      <!-- ══ TABLE VIEW ══ -->
      @if (viewMode() === 'table') {
        <div class="table-card">
          @if (loading()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-avatar"></div>
                  <div class="sk sk-line" style="width:200px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:100px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:60px"></div>
                </div>
              }
            </div>
          } @else if (products().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <p>{{ search ? 'Sin resultados para "' + search + '"' : 'No hay productos en el catálogo' }}</p>
              @if (!search) { <button class="btn btn-primary btn-sm" (click)="openModal()">Crear primer producto</button> }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>IVA</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (p of products(); track p.id) {
                  <tr [class.low-stock-row]="p.stock <= p.minStock && p.status === 'ACTIVE'">
                    <td>
                      <div class="prod-cell">
                        <div class="prod-icon" [class.low]="p.stock <= p.minStock">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>
                        </div>
                        <div>
                          <div class="prod-name">{{ p.name }}</div>
                          @if (p.description) { <div class="prod-desc">{{ p.description | slice:0:50 }}{{ p.description.length > 50 ? '…' : '' }}</div> }
                        </div>
                      </div>
                    </td>
                    <td><code class="sku-badge">{{ p.sku }}</code></td>
                    <td class="text-muted">{{ p.category?.name ?? '—' }}</td>
                    <td><strong>{{ fmtCOP(p.price) }}</strong></td>
                    <td>
                      <div class="stock-cell" [class.low]="p.stock <= p.minStock">
                        <span>{{ p.stock }} {{ p.unit }}</span>
                        @if (p.stock <= p.minStock) {
                          <svg viewBox="0 0 20 20" fill="currentColor" width="12" title="Stock bajo"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"/></svg>
                        }
                      </div>
                    </td>
                    <td class="text-muted">{{ p.taxRate }}%</td>
                    <td><span class="status-pill status-{{ p.status.toLowerCase() }}">{{ statusLabel(p.status) }}</span></td>
                    <td class="actions-cell">
                      <button class="btn-icon" title="Ver detalle" (click)="viewDetail(p)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                      </button>
                      <button class="btn-icon" (click)="openModal(p)" title="Editar">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                      </button>
                      <button class="btn-icon btn-icon-danger" (click)="confirmDelete(p)" title="Eliminar">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (totalPages() > 1) {
              <div class="pagination">
                <span class="pagination-info">{{ (page()-1)*20+1 }}–{{ min(page()*20,total()) }} de {{ total() }}</span>
                <div class="pagination-btns">
                  <button class="btn-page" [disabled]="page()===1" (click)="setPage(page()-1)">‹</button>
                  @for (p of pageRange(); track p) {
                    <button class="btn-page" [class.active]="p===page()" (click)="setPage(p)">{{ p }}</button>
                  }
                  <button class="btn-page" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">›</button>
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ══ GRID VIEW ══ -->
      @if (viewMode() === 'grid') {
        @if (loading()) {
          <div class="product-grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <div class="product-card product-card--skeleton">
                <div class="sk sk-avatar pc-sk-icon"></div>
                <div class="sk sk-line" style="width:70%;margin:10px 0 6px"></div>
                <div class="sk sk-line" style="width:40%;margin-bottom:14px"></div>
                <div class="sk sk-line" style="width:90%"></div>
                <div class="sk sk-line" style="width:80%;margin-top:6px"></div>
              </div>
            }
          </div>
        } @else if (products().length === 0) {
          <div class="empty-state-grid-wrap">
            <div class="empty-state-grid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <p>No hay productos</p>
              <button class="btn btn-primary btn-sm" (click)="openModal()">Crear producto</button>
            </div>
          </div>
        } @else {
          <div class="product-grid">
            @for (p of products(); track p.id) {
              <div class="product-card" [class.low-stock-card]="p.stock <= p.minStock" [class.inactive-card]="p.status === 'INACTIVE'">

                <!-- Status top-right -->
                <span class="pc-status status-pill status-{{ p.status.toLowerCase() }}">{{ statusLabel(p.status) }}</span>

                <!-- Icon + nombre -->
                <div class="pc-top">
                  <div class="pc-icon" [class.low]="p.stock <= p.minStock">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="22"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>
                  </div>
                  <div class="pc-name">{{ p.name }}</div>
                  <code class="sku-badge">{{ p.sku }}</code>
                </div>

                <!-- Info rows -->
                <div class="pc-info">
                  @if (p.category) {
                    <div class="pc-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"/></svg>
                      <span>{{ p.category.name }}</span>
                    </div>
                  }
                  <div class="pc-info-row">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/></svg>
                    <span class="pc-price">{{ fmtCOP(p.price) }}</span>
                  </div>
                  <div class="pc-info-row" [class.pc-low-stock]="p.stock <= p.minStock">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"/></svg>
                    <span>{{ p.stock }} {{ p.unit }}
                      @if (p.stock <= p.minStock) { <span class="pc-low-label">· Stock bajo</span> }
                    </span>
                  </div>
                  <div class="pc-info-row">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="12"><path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/></svg>
                    <span>IVA {{ p.taxRate }}%</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="pc-actions">
                  <button class="btn btn-sm btn-secondary" (click)="viewDetail(p)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                    Ver
                  </button>
                  <button class="btn btn-sm btn-secondary" (click)="openModal(p)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                    Editar
                  </button>
                  <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDelete(p)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
                  </button>
                </div>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination pagination--standalone">
              <span class="pagination-info">{{ (page()-1)*20+1 }}–{{ min(page()*20,total()) }} de {{ total() }}</span>
              <div class="pagination-btns">
                <button class="btn-page" [disabled]="page()===1" (click)="setPage(page()-1)">‹</button>
                @for (p of pageRange(); track p) {
                  <button class="btn-page" [class.active]="p===page()" (click)="setPage(p)">{{ p }}</button>
                }
                <button class="btn-page" [disabled]="page()===totalPages()" (click)="setPage(page()+1)">›</button>
              </div>
            </div>
          }
        }
      }
    </div>

    <!-- ══ DETAIL DRAWER ══ -->
    @if (detailProduct()) {
      <div class="drawer-overlay" (click)="closeDetail()">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-icon" [class.low]="detailProduct()!.stock <= detailProduct()!.minStock">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg>
            </div>
            <div class="drawer-header-text">
              <div class="drawer-title">{{ detailProduct()!.name }}</div>
              <div class="drawer-sub">
                <code class="sku-badge">{{ detailProduct()!.sku }}</code>
                @if (detailProduct()!.category) {
                  <span class="drawer-cat">· {{ detailProduct()!.category!.name }}</span>
                }
              </div>
            </div>
            <span class="status-pill status-{{ detailProduct()!.status.toLowerCase() }}" style="flex-shrink:0">
              {{ statusLabel(detailProduct()!.status) }}
            </span>
            <button class="drawer-close" (click)="closeDetail()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>

          <div class="drawer-body">
            <!-- Precios -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"/></svg>
                Precios
              </div>
              <div class="dw-dates-row">
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Precio venta</span>
                  <span class="dw-date-val">{{ fmtCOP(detailProduct()!.price) }}</span>
                </div>
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Costo</span>
                  <span class="dw-date-val">{{ detailProduct()!.cost ? fmtCOP(detailProduct()!.cost) : '—' }}</span>
                </div>
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">{{ detailProduct()!.taxType }}</span>
                  <span class="dw-date-val">{{ detailProduct()!.taxRate }}%</span>
                </div>
              </div>
            </div>

            <!-- Inventario -->
            <div class="dw-section">
              <div class="dw-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"/></svg>
                Inventario
              </div>
              <div class="dw-dates-row">
                <div class="dw-date-chip" [class.dw-date-chip-overdue]="detailProduct()!.stock <= detailProduct()!.minStock">
                  <span class="dw-date-lbl">Stock actual</span>
                  <span class="dw-date-val">{{ detailProduct()!.stock }} {{ detailProduct()!.unit }}</span>
                </div>
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Stock mínimo</span>
                  <span class="dw-date-val">{{ detailProduct()!.minStock }} {{ detailProduct()!.unit }}</span>
                </div>
                <div class="dw-date-chip">
                  <span class="dw-date-lbl">Unidad</span>
                  <span class="dw-date-val">{{ detailProduct()!.unit }}</span>
                </div>
              </div>
            </div>

            <!-- Descripción -->
            @if (detailProduct()!.description) {
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"/></svg>
                  Descripción
                </div>
                <div class="dw-notes">{{ detailProduct()!.description }}</div>
              </div>
            }

            <!-- Barcode -->
            @if (detailProduct()!.barcode) {
              <div class="dw-section">
                <div class="dw-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm5-1a1 1 0 000 2h1a1 1 0 000-2H8zM3 9a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm5-1a1 1 0 000 2h1a1 1 0 000-2H8zm-5 5a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm5-1a1 1 0 000 2h1a1 1 0 000-2H8zm4-9a1 1 0 000 2h1a1 1 0 000-2h-1zm0 4a1 1 0 000 2h1a1 1 0 000-2h-1zm0 4a1 1 0 000 2h1a1 1 0 000-2h-1z"/></svg>
                  Código de barras
                </div>
                <code class="dw-barcode">{{ detailProduct()!.barcode }}</code>
              </div>
            }
          </div>

          <div class="drawer-footer">
            <button class="btn btn-secondary btn-sm" (click)="openModal(detailProduct()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
              Editar producto
            </button>
            <button class="btn btn-danger btn-sm" (click)="confirmDelete(detailProduct()!)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══ PRODUCT MODAL ══ -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingId() ? 'Editar producto' : 'Nuevo producto' }}</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-section-title">Información básica</div>
            <div class="form-row">
              <div class="form-group fg-2">
                <label>Nombre del producto *</label>
                <input type="text" [(ngModel)]="form.name" class="form-control" placeholder="Laptop Dell XPS 15"/>
              </div>
              <div class="form-group">
                <label>SKU *</label>
                <input type="text" [(ngModel)]="form.sku" class="form-control" placeholder="LAP-001"/>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Categoría</label>
                <select [(ngModel)]="form.categoryId" class="form-control">
                  <option value="">Sin categoría</option>
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Unidad de medida</label>
                <select [(ngModel)]="form.unit" class="form-control">
                  <option value="UND">Unidad (UND)</option>
                  <option value="KG">Kilogramo (KG)</option>
                  <option value="MT">Metro (MT)</option>
                  <option value="LT">Litro (LT)</option>
                  <option value="HR">Hora (HR)</option>
                  <option value="SRV">Servicio (SRV)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Estado</label>
                <select [(ngModel)]="form.status" class="form-control">
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="OUT_OF_STOCK">Sin stock</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea [(ngModel)]="form.description" class="form-control" rows="2" placeholder="Descripción del producto..."></textarea>
            </div>

            <div class="form-section-title">Precios e impuestos</div>
            <div class="form-row">
              <div class="form-group">
                <label>Precio de venta (COP) *</label>
                <input type="number" [(ngModel)]="form.price" class="form-control" placeholder="0"/>
              </div>
              <div class="form-group">
                <label>Costo (COP)</label>
                <input type="number" [(ngModel)]="form.cost" class="form-control" placeholder="0"/>
              </div>
              <div class="form-group">
                <label>Tipo de impuesto</label>
                <select [(ngModel)]="form.taxType" class="form-control">
                  <option value="IVA">IVA</option>
                  <option value="INC">INC (Impoconsumo)</option>
                  <option value="ICA">ICA</option>
                  <option value="NONE">Exento / Excluido</option>
                </select>
              </div>
              <div class="form-group">
                <label>Tasa (%)</label>
                <select [(ngModel)]="form.taxRate" class="form-control">
                  <option [value]="0">0%</option>
                  <option [value]="5">5%</option>
                  <option [value]="8">8%</option>
                  <option [value]="19">19%</option>
                </select>
              </div>
            </div>

            <div class="form-section-title">Inventario</div>
            <div class="form-row">
              <div class="form-group">
                <label>Stock actual</label>
                <input type="number" [(ngModel)]="form.stock" class="form-control" placeholder="0"/>
              </div>
              <div class="form-group">
                <label>Stock mínimo</label>
                <input type="number" [(ngModel)]="form.minStock" class="form-control" placeholder="5"/>
              </div>
              <div class="form-group">
                <label>Código de barras</label>
                <input type="text" [(ngModel)]="form.barcode" class="form-control" placeholder="7707123456789"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'Guardando...' : (editingId() ? 'Actualizar' : 'Crear producto') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete Confirm -->
    @if (deleteTarget()) {
      <div class="modal-overlay" (click)="deleteTarget.set(null)">
        <div class="modal modal-sm" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>Eliminar producto</h3></div>
          <div class="modal-body"><p>¿Eliminar <strong>{{ deleteTarget()!.name }}</strong>? Esta acción no se puede deshacer.</p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="deleteTarget.set(null)">Cancelar</button>
            <button class="btn btn-danger" [disabled]="saving()" (click)="doDelete()">{{ saving() ? 'Eliminando...' : 'Sí, eliminar' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width:1200px; }
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }
    .header-actions { display:flex; gap:10px; }
    .alert-bar { display:flex; align-items:center; gap:10px; background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:10px 16px; margin-bottom:14px; font-size:13.5px; color:#92400e; }
    .alert-bar svg { color:#d97706; flex-shrink:0; }
    .alert-link { margin-left:auto; background:none; border:none; cursor:pointer; font-size:13px; font-weight:700; color:#d97706; text-decoration:underline; }

    /* Filters */
    .filters-bar { display:flex; gap:10px; margin-bottom:16px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; min-width:200px; max-width:360px; position:relative; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; background:#fff; color:#374151; }
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:8px; overflow:hidden; margin-left:auto; flex-shrink:0; }
    .view-toggle button { padding:7px 10px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button:hover { background:#f0f4f9; color:#1a407e; }
    .view-toggle button.active { background:#1a407e; color:#fff; }

    /* ── TABLE VIEW ─────────────────────────────────────────── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:11px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:11px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .low-stock-row td { background:#fffbeb !important; }
    .prod-cell { display:flex; align-items:center; gap:10px; }
    .prod-icon { width:32px; height:32px; border-radius:8px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .prod-icon.low { background:#fef3c7; color:#d97706; }
    .prod-name { font-weight:600; color:#0c1c35; font-size:14px; }
    .prod-desc { font-size:12px; color:#9ca3af; }
    .sku-badge { background:#f0f4f9; color:#1a407e; font-size:11.5px; padding:2px 8px; border-radius:5px; font-family:monospace; }
    .text-muted { color:#9ca3af; font-size:13px; }
    .stock-cell { display:flex; align-items:center; gap:4px; font-weight:600; }
    .stock-cell.low { color:#d97706; }
    .stock-cell svg { color:#f59e0b; }
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; white-space:nowrap; }
    .status-active { background:#d1fae5; color:#065f46; }
    .status-inactive { background:#f3f4f6; color:#6b7280; }
    .status-out_of_stock { background:#fee2e2; color:#991b1b; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; }
    .pagination { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid #f0f4f8; }
    .pagination-info { font-size:13px; color:#9ca3af; }
    .pagination-btns { display:flex; gap:4px; }
    .btn-page { padding:5px 10px; border:1px solid #dce6f0; border-radius:6px; background:#fff; font-size:13px; cursor:pointer; color:#374151; min-width:32px; }
    .btn-page:hover:not(:disabled) { background:#f0f4f9; border-color:#1a407e; color:#1a407e; }
    .btn-page.active { background:#1a407e; border-color:#1a407e; color:#fff; }
    .btn-page:disabled { opacity:.4; cursor:default; }

    /* ── GRID VIEW ──────────────────────────────────────────── */
    .product-grid {
      display:grid;
      grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));
      gap:14px;
    }
    .product-card {
      background:#fff; border:1px solid #dce6f0; border-radius:12px;
      padding:18px 16px 14px; position:relative;
      transition:box-shadow .18s, transform .18s;
      display:flex; flex-direction:column;
    }
    .product-card:hover { box-shadow:0 4px 20px rgba(26,64,126,.1); transform:translateY(-2px); }
    .low-stock-card { border-color:#fcd34d; background:#fffbeb; }
    .inactive-card { opacity:.7; }
    .product-card--skeleton { pointer-events:none; }

    /* Status badge top-right */
    .pc-status { position:absolute; top:12px; right:12px; }

    /* Top section */
    .pc-top { display:flex; flex-direction:column; align-items:center; text-align:center; padding:4px 0 12px; }
    .pc-icon {
      width:48px; height:48px; border-radius:12px;
      background:#e8eef8; color:#1a407e;
      display:flex; align-items:center; justify-content:center;
      margin-bottom:10px;
    }
    .pc-icon.low { background:#fef3c7; color:#d97706; }
    .pc-name { font-size:14px; font-weight:700; color:#0c1c35; line-height:1.3; margin-bottom:5px; }
    .pc-sk-icon { width:48px; height:48px; border-radius:12px; display:block; margin:0 auto 10px; }

    /* Info rows */
    .pc-info {
      border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px;
      display:flex; flex-direction:column; gap:5px; flex:1;
    }
    .pc-info-row { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; }
    .pc-info-row svg { color:#94a3b8; flex-shrink:0; }
    .pc-info-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pc-price { font-weight:700; color:#0c1c35; font-size:13px; }
    .pc-low-stock { color:#d97706; font-weight:600; }
    .pc-low-stock svg { color:#f59e0b; }
    .pc-low-label { color:#d97706; font-weight:700; }

    /* Card actions */
    .pc-actions { display:flex; gap:6px; align-items:center; border-top:1px solid #f0f4f8; padding-top:10px; }
    .pc-actions .btn { flex:1; justify-content:center; }

    /* Standalone pagination */
    .pagination--standalone {
      background:#fff; border:1px solid #dce6f0; border-radius:12px; margin-top:4px;
    }
    .empty-state-grid-wrap { background:#fff; border:1px solid #dce6f0; border-radius:12px; }
    .empty-state-grid { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state-grid p { margin:16px 0; font-size:14px; }

    /* Skeleton */
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:32px; height:32px; border-radius:8px; flex-shrink:0; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .empty-state { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* ── DETAIL DRAWER ──────────────────────────────────────── */
    .drawer-overlay { position:fixed; inset:0; background:rgba(12,28,53,.4); z-index:100; display:flex; justify-content:flex-end; backdrop-filter:blur(2px); }
    .drawer { width:420px; max-width:100vw; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-8px 0 32px rgba(12,28,53,.12); }
    .drawer-header { display:flex; align-items:center; gap:10px; padding:18px 20px 14px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .drawer-icon { width:40px; height:40px; border-radius:10px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .drawer-icon.low { background:#fef3c7; color:#d97706; }
    .drawer-header-text { flex:1; min-width:0; }
    .drawer-title { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; }
    .drawer-sub { display:flex; align-items:center; gap:6px; margin-top:3px; flex-wrap:wrap; }
    .drawer-cat { font-size:12px; color:#94a3b8; }
    .drawer-close { background:none; border:none; cursor:pointer; color:#94a3b8; padding:5px; border-radius:7px; transition:all .15s; flex-shrink:0; }
    .drawer-close:hover { background:#f1f5f9; color:#374151; }
    .drawer-body { flex:1; overflow-y:auto; padding:0; scrollbar-width:thin; scrollbar-color:#e2e8f0 transparent; }
    .drawer-footer { padding:14px 20px; border-top:1px solid #f0f4f8; display:flex; gap:8px; flex-shrink:0; }

    /* Drawer sections — reutiliza clases de invoices drawer */
    .dw-section { padding:14px 20px; border-bottom:1px solid #f8fafc; }
    .dw-section:last-child { border-bottom:none; }
    .dw-section-title { display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; margin-bottom:10px; }
    .dw-dates-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
    .dw-date-chip { background:#f8fafc; border:1px solid #f0f4f8; border-radius:8px; padding:8px 10px; text-align:center; }
    .dw-date-chip-overdue { background:#fff5f5; border-color:#fecaca; }
    .dw-date-chip-overdue .dw-date-val { color:#dc2626 !important; }
    .dw-date-lbl { display:block; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin-bottom:3px; }
    .dw-date-val { display:block; font-size:12.5px; font-weight:700; color:#1e293b; }
    .dw-notes { font-size:13px; color:#475569; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; line-height:1.5; }
    .dw-barcode { display:block; font-size:13px; font-family:monospace; color:#475569; background:#f1f5f9; padding:8px 12px; border-radius:8px; letter-spacing:.05em; }

    /* ── MODAL ──────────────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; }
    .modal-lg { max-width:720px; }
    .modal-sm { max-width:400px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f8; color:#374151; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; flex-shrink:0; }
    .form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#9ca3af; margin:16px 0 10px; padding-bottom:6px; border-bottom:1px solid #f0f4f8; }
    .form-section-title:first-child { margin-top:0; }
    .form-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .form-row .fg-2 { grid-column:span 2; }
    .form-group { margin-bottom:12px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    textarea.form-control { resize:vertical; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-sm { padding:7px 14px; font-size:13px; }

    /* ── RESPONSIVE ─────────────────────────────────────────── */
    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .header-actions { flex-direction:row; flex-wrap:wrap; gap:8px; }
      .header-actions .btn { flex:1; justify-content:center; min-width:120px; }
      .filters-bar { flex-wrap:wrap; }
      .search-wrap { width:100%; max-width:100%; flex:unset; }
      .view-toggle { margin-left:0; }
      .product-grid { grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
      /* Drawer full-width */
      .drawer { width:100%; max-width:100%; }
    }
    @media (max-width: 640px) {
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      .data-table { min-width:560px; }
      /* Drawer bottom-sheet */
      .drawer-overlay { align-items:flex-end; justify-content:stretch; }
      .drawer { width:100%; height:90dvh; border-radius:18px 18px 0 0; }
      /* Modal bottom-sheet */
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .form-row { grid-template-columns:1fr 1fr; }
      .form-row .fg-2 { grid-column:1 / -1; }
      .product-grid { grid-template-columns:1fr 1fr; gap:8px; }
      .pagination { flex-direction:column; gap:8px; align-items:center; }
      .dw-dates-row { grid-template-columns:1fr 1fr; }
      .alert-bar { flex-wrap:wrap; }
      .alert-link { margin-left:0; }
      .drawer-footer { flex-direction:column; }
      .drawer-footer .btn { width:100%; justify-content:center; }
    }
    @media (max-width: 400px) {
      .product-grid { grid-template-columns:1fr; }
      .form-row { grid-template-columns:1fr; }
      .form-row .fg-2 { grid-column:1; }
    }
  `]
})
export class InventoryComponent implements OnInit {
  private readonly API      = `${environment.apiUrl}/products`;
  private readonly CATS_API = `${environment.apiUrl}/categories`;

  products    = signal<Product[]>([]);
  categories  = signal<Category[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  total       = signal(0);
  page        = signal(1);
  totalPages  = signal(1);
  viewMode    = signal<'table' | 'grid'>('table');
  detailProduct = signal<Product | null>(null);

  search         = '';
  filterCategory = '';
  filterStatus   = '';
  private searchTimer: any;

  showModal  = signal(false);
  editingId  = signal<string | null>(null);
  deleteTarget = signal<Product | null>(null);

  form: ProductForm = this.emptyForm();

  get lowStockCount() {
    return signal(this.products().filter(p => p.stock <= p.minStock && p.status === 'ACTIVE').length);
  }

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() { this.loadCategories(); this.load(); }

  loadCategories() {
    this.http.get<any>(`${this.CATS_API}`).subscribe({
      next: r => this.categories.set(r.data ?? r),
      error: () => {}
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), limit: 20 };
    if (this.search) params.search = this.search;
    if (this.filterCategory) params.categoryId = this.filterCategory;
    if (this.filterStatus && this.filterStatus !== 'low') params.status = this.filterStatus;

    this.http.get<any>(this.API, { params }).subscribe({
      next: r => {
        this.products.set(r.data ?? r);
        this.total.set(r.total ?? r.length);
        this.totalPages.set(r.totalPages ?? 1);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar productos'); }
    });
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.page.set(1); this.load(); }, 350);
  }

  setPage(p: number) { this.page.set(p); this.load(); }

  pageRange(): number[] {
    const tp = this.totalPages(), cp = this.page();
    const r: number[] = [];
    for (let i = Math.max(1, cp - 2); i <= Math.min(tp, cp + 2); i++) r.push(i);
    return r;
  }

  viewDetail(p: Product) { this.detailProduct.set(p); }
  closeDetail()          { this.detailProduct.set(null); }

  openModal(p?: Product) {
    if (p) {
      this.editingId.set(p.id);
      this.form = {
        categoryId: p.categoryId ?? '', sku: p.sku, name: p.name,
        description: p.description ?? '', price: p.price, cost: p.cost,
        stock: p.stock, minStock: p.minStock, unit: p.unit,
        taxRate: p.taxRate, taxType: p.taxType,
        barcode: p.barcode ?? '', status: p.status
      };
    } else {
      this.editingId.set(null);
      this.form = this.emptyForm();
    }
    this.detailProduct.set(null);
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name || !this.form.sku || this.form.price == null) {
      this.notify.warning('Nombre, SKU y precio son obligatorios'); return;
    }
    this.saving.set(true);
    const body = { ...this.form, categoryId: this.form.categoryId || undefined };
    const req = this.editingId()
      ? this.http.patch(`${this.API}/${this.editingId()}`, body)
      : this.http.post(this.API, body);

    req.subscribe({
      next: () => {
        this.notify.success(this.editingId() ? 'Producto actualizado' : 'Producto creado');
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al guardar'); }
    });
  }

  confirmDelete(p: Product) {
    this.detailProduct.set(null);
    this.deleteTarget.set(p);
  }

  doDelete() {
    const p = this.deleteTarget();
    if (!p) return;
    this.saving.set(true);
    this.http.delete(`${this.API}/${p.id}`).subscribe({
      next: () => {
        this.notify.success('Producto eliminado');
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error al eliminar'); }
    });
  }

  statusLabel(s: string): string {
    return ({ ACTIVE: 'Activo', INACTIVE: 'Inactivo', OUT_OF_STOCK: 'Sin stock' } as any)[s] ?? s;
  }

  fmtCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  min(a: number, b: number) { return Math.min(a, b); }

  private emptyForm(): ProductForm {
    return { categoryId: '', sku: '', name: '', description: '', price: null, cost: null, stock: 0, minStock: 5, unit: 'UND', taxRate: 19, taxType: 'IVA', barcode: '', status: 'ACTIVE' };
  }
}