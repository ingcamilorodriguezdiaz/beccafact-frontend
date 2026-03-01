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

      <!-- Filters -->
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
        <!-- View toggle -->
        <div class="view-toggle">
          <button [class.active]="viewMode() === 'table'" (click)="viewMode.set('table')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/></svg>
          </button>
          <button [class.active]="viewMode() === 'grid'" (click)="viewMode.set('grid')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
          </button>
        </div>
      </div>

      <!-- Table View -->
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

      <!-- Grid View -->
      @if (viewMode() === 'grid' && !loading()) {
        <div class="product-grid">
          @for (p of products(); track p.id) {
            <div class="product-card" [class.low-stock-card]="p.stock <= p.minStock">
              <div class="pc-header">
                <div class="pc-icon"><svg viewBox="0 0 20 20" fill="currentColor" width="22"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/></svg></div>
                <span class="status-pill status-{{ p.status.toLowerCase() }}">{{ statusLabel(p.status) }}</span>
              </div>
              <div class="pc-name">{{ p.name }}</div>
              <code class="sku-badge">{{ p.sku }}</code>
              <div class="pc-meta">
                <div class="pc-price">{{ fmtCOP(p.price) }}</div>
                <div class="pc-stock" [class.low]="p.stock <= p.minStock">{{ p.stock }} {{ p.unit }}</div>
              </div>
              <div class="pc-actions">
                <button class="btn btn-sm btn-secondary" (click)="openModal(p)">Editar</button>
              </div>
            </div>
          }
          @if (products().length === 0 && !loading()) {
            <div class="empty-state-grid">
              <p>No hay productos</p>
              <button class="btn btn-primary btn-sm" (click)="openModal()">Crear producto</button>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Product Modal ──────────────────────────────────── -->
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
    .filters-bar { display:flex; gap:10px; margin-bottom:16px; align-items:center; flex-wrap:wrap; }
    .search-wrap { flex:1; min-width:200px; max-width:360px; position:relative; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .filter-select { padding:8px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; outline:none; background:#fff; color:#374151; }
    .view-toggle { display:flex; gap:2px; border:1px solid #dce6f0; border-radius:8px; overflow:hidden; margin-left:auto; }
    .view-toggle button { padding:7px 10px; background:#fff; border:none; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .view-toggle button.active { background:#1a407e; color:#fff; }
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
    .status-pill { padding:3px 9px; border-radius:9999px; font-size:11px; font-weight:700; }
    .status-active { background:#d1fae5; color:#065f46; }
    .status-inactive { background:#f3f4f6; color:#6b7280; }
    .status-out_of_stock { background:#fee2e2; color:#991b1b; }
    .actions-cell { text-align:right; }
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
    .product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
    .product-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; padding:16px; transition:box-shadow .15s; }
    .product-card:hover { box-shadow:0 4px 16px rgba(26,64,126,.1); }
    .low-stock-card { border-color:#fcd34d; background:#fffbeb; }
    .pc-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .pc-icon { width:36px; height:36px; border-radius:8px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; }
    .pc-name { font-weight:700; font-size:14px; color:#0c1c35; margin-bottom:4px; }
    .pc-meta { display:flex; justify-content:space-between; align-items:center; margin:10px 0 12px; }
    .pc-price { font-size:15px; font-weight:700; color:#0c1c35; }
    .pc-stock { font-size:12px; font-weight:600; color:#065f46; background:#d1fae5; padding:2px 8px; border-radius:6px; }
    .pc-stock.low { color:#92400e; background:#fef3c7; }
    .pc-actions { display:flex; gap:6px; }
    .empty-state, .empty-state-grid { padding:64px 24px; text-align:center; color:#9ca3af; }
    .empty-state-grid { grid-column:1/-1; }
    .empty-state p, .empty-state-grid p { margin:16px 0; font-size:14px; }
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    .sk-avatar { width:32px; height:32px; border-radius:8px; flex-shrink:0; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
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
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-sm { padding:7px 14px; font-size:13px; }
  `]
})
export class InventoryComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/products`;
  private readonly CATS_API = `${environment.apiUrl}/categories`;

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal(false);
  total = signal(0);
  page = signal(1);
  totalPages = signal(1);
  viewMode = signal<'table' | 'grid'>('table');

  search = '';
  filterCategory = '';
  filterStatus = '';
  private searchTimer: any;

  showModal = signal(false);
  editingId = signal<string | null>(null);
  deleteTarget = signal<Product | null>(null);

  form: ProductForm = this.emptyForm();

  get lowStockCount() {
    return signal(this.products().filter(p => p.stock <= p.minStock && p.status === 'ACTIVE').length);
  }

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    this.loadCategories();
    this.load();
  }

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

  openModal(p?: Product) {
    if (p) {
      this.editingId.set(p.id);
      this.form = {
        categoryId: p.categoryId ?? '',
        sku: p.sku, name: p.name, description: p.description ?? '',
        price: p.price, cost: p.cost, stock: p.stock, minStock: p.minStock,
        unit: p.unit, taxRate: p.taxRate, taxType: p.taxType,
        barcode: p.barcode ?? '', status: p.status
      };
    } else {
      this.editingId.set(null);
      this.form = this.emptyForm();
    }
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

  confirmDelete(p: Product) { this.deleteTarget.set(p); }

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
    return { ACTIVE: 'Activo', INACTIVE: 'Inactivo', OUT_OF_STOCK: 'Sin stock' }[s] ?? s;
  }

  fmtCOP(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);
  }

  min(a: number, b: number) { return Math.min(a, b); }

  private emptyForm(): ProductForm {
    return { categoryId: '', sku: '', name: '', description: '', price: null, cost: null, stock: 0, minStock: 5, unit: 'UND', taxRate: 19, taxType: 'IVA', barcode: '', status: 'ACTIVE' };
  }
}