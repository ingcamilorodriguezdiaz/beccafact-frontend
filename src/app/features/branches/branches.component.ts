import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  department?: string;
  phone?: string;
  email?: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { stocks: number; userBranches: number; invoices: number };
}

interface BranchStock {
  id: string;
  productId: string;
  stock: number;
  minStock: number;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
}

interface BranchForm {
  name: string;
  address: string;
  city: string;
  department: string;
  phone: string;
  email: string;
  isMain: boolean;
}

interface StockEditState {
  productId: string;
  stock: number;
  minStock: number;
}

interface TransferForm {
  targetBranchId: string;
  productId: string;
  quantity: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!--  VIEW: LIST                                                    -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      @if (view() === 'list') {

        <!-- Header -->
        <div class="page-header">
          <div>
            <h2 class="page-title">Sucursales</h2>
            <p class="page-subtitle">{{ branches().length }} sucursal{{ branches().length !== 1 ? 'es' : '' }} registrada{{ branches().length !== 1 ? 's' : '' }}</p>
          </div>
          @if (isAdmin()) {
            <button class="btn btn-primary" (click)="openCreate()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
              Nueva sucursal
            </button>
          }
        </div>

        <!-- Loading skeleton -->
        @if (loading()) {
          <div class="branches-grid">
            @for (i of [1,2,3]; track i) {
              <div class="branch-card branch-card--skeleton">
                <div class="sk sk-line" style="width:60%;height:18px;margin-bottom:10px"></div>
                <div class="sk sk-line" style="width:80%;margin-bottom:6px"></div>
                <div class="sk sk-line" style="width:50%;margin-bottom:6px"></div>
                <div class="sk sk-line" style="width:70%;margin-bottom:16px"></div>
                <div style="display:flex;gap:8px">
                  <div class="sk sk-line" style="flex:1;height:32px;border-radius:8px"></div>
                  <div class="sk sk-line" style="width:36px;height:32px;border-radius:8px"></div>
                  <div class="sk sk-line" style="width:36px;height:32px;border-radius:8px"></div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Empty state -->
        @else if (branches().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="52" height="52">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>
            </svg>
            <p>No hay sucursales registradas aún</p>
            @if (isAdmin()) {
              <button class="btn btn-primary btn-sm" (click)="openCreate()">Crear primera sucursal</button>
            }
          </div>
        }

        <!-- Grid of branch cards -->
        @else {
          <div class="branches-grid">
            @for (branch of branches(); track branch.id) {
              <div class="branch-card" [class.branch-card--inactive]="!branch.isActive">

                <!-- Card top: name + badges -->
                <div class="card-top">
                  <div class="card-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
                    </svg>
                  </div>
                  <div class="card-name-wrap">
                    <h3 class="card-name">{{ branch.name }}</h3>
                    <div class="card-badges">
                      @if (branch.isMain) {
                        <span class="badge badge--main">Principal</span>
                      }
                      <span class="badge" [class.badge--active]="branch.isActive" [class.badge--inactive]="!branch.isActive">
                        {{ branch.isActive ? 'Activa' : 'Inactiva' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Contact info -->
                <div class="card-info">
                  @if (branch.city || branch.department) {
                    <div class="card-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                      </svg>
                      <span>{{ [branch.city, branch.department].filter(nonEmpty).join(', ') }}</span>
                    </div>
                  }
                  @if (branch.address) {
                    <div class="card-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                      </svg>
                      <span>{{ branch.address }}</span>
                    </div>
                  }
                  @if (branch.phone) {
                    <div class="card-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                      </svg>
                      <span>{{ branch.phone }}</span>
                    </div>
                  }
                  @if (branch.email) {
                    <div class="card-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <span>{{ branch.email }}</span>
                    </div>
                  }
                </div>

                <!-- Stats -->
                @if (branch._count) {
                  <div class="card-stats">
                    <div class="stat-chip">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                        <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z"/>
                      </svg>
                      {{ branch._count.stocks }} refs.
                    </div>
                    <div class="stat-chip">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                      </svg>
                      {{ branch._count.userBranches }} usuarios
                    </div>
                    <div class="stat-chip">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/>
                      </svg>
                      {{ branch._count.invoices }} facturas
                    </div>
                  </div>
                }

                <!-- Actions -->
                <div class="card-actions">
                  <button class="btn btn-sm btn-secondary card-actions__main" (click)="selectBranch(branch)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                      <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z"/>
                    </svg>
                    Ver inventario
                  </button>
                  @if (isAdmin()) {
                    <button class="btn-icon" title="Editar" (click)="openEdit(branch)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                    </button>
                    <button class="btn-icon" [title]="branch.isActive ? 'Desactivar' : 'Activar'" (click)="toggleActive(branch)">
                      @if (branch.isActive) {
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                          <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/>
                        </svg>
                      } @else {
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                        </svg>
                      }
                    </button>
                    @if (!branch.isMain) {
                      <button class="btn-icon btn-icon-danger" title="Eliminar" (click)="confirmDelete(branch)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
                        </svg>
                      </button>
                    }
                  }
                </div>

              </div>
            }
          </div>
        }

      }
      <!-- END VIEW LIST -->

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!--  VIEW: DETAIL (stocks)                                         -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      @if (view() === 'detail' && selectedBranch()) {

        <!-- Back + Header -->
        <div class="detail-header">
          <button class="btn-back" (click)="goBack()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"/>
            </svg>
            Sucursales
          </button>
          <div class="detail-title-block">
            <h2 class="page-title">{{ selectedBranch()!.name }}</h2>
            <div class="detail-meta">
              @if (selectedBranch()!.city) { <span>{{ selectedBranch()!.city }}</span> }
              @if (selectedBranch()!.address) { <span>·</span><span>{{ selectedBranch()!.address }}</span> }
              <span class="badge" [class.badge--active]="selectedBranch()!.isActive" [class.badge--inactive]="!selectedBranch()!.isActive">
                {{ selectedBranch()!.isActive ? 'Activa' : 'Inactiva' }}
              </span>
            </div>
          </div>
          @if (isAdmin()) {
            <button class="btn btn-secondary btn-sm" (click)="initializeInventory(selectedBranch()!.id)" [disabled]="saving()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
              </svg>
              Inicializar inventario
            </button>
          }
        </div>

        <!-- Stock search + Transfer toggle -->
        <div class="detail-toolbar">
          <div class="search-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
            </svg>
            <input type="text" placeholder="Buscar producto, SKU..." [(ngModel)]="stockSearchValue"
                   (ngModelChange)="stockSearch.set($event)" class="search-input"/>
          </div>
          @if (isAdmin()) {
            <button class="btn btn-secondary btn-sm" [class.btn-primary]="transferMode()" (click)="transferMode.set(!transferMode())">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/>
              </svg>
              Transferir stock
            </button>
          }
        </div>

        <!-- Transfer panel -->
        @if (transferMode()) {
          <div class="transfer-panel">
            <div class="transfer-panel__header">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/>
              </svg>
              <span>Transferir stock a otra sucursal</span>
            </div>
            <div class="transfer-panel__body">
              <div class="form-group">
                <label>Sucursal destino *</label>
                <select [(ngModel)]="transferForm.targetBranchId" class="form-control">
                  <option value="">Seleccionar sucursal...</option>
                  @for (b of otherBranches(); track b.id) {
                    <option [value]="b.id">{{ b.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Producto *</label>
                <select [(ngModel)]="transferForm.productId" class="form-control">
                  <option value="">Seleccionar producto...</option>
                  @for (s of stocks(); track s.id) {
                    <option [value]="s.productId">{{ s.product.name }} (stock: {{ s.stock }})</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Cantidad *</label>
                <input type="number" [(ngModel)]="transferForm.quantity" class="form-control" placeholder="0" min="1"/>
              </div>
              <div class="transfer-panel__actions">
                <button class="btn btn-secondary btn-sm" (click)="transferMode.set(false)">Cancelar</button>
                <button class="btn btn-primary btn-sm" [disabled]="saving() || !transferForm.targetBranchId || !transferForm.productId || !transferForm.quantity"
                        (click)="doTransfer()">
                  {{ saving() ? 'Transfiriendo...' : 'Confirmar transferencia' }}
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Stocks table -->
        <div class="table-card">
          @if (loadingStocks()) {
            <div class="table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="skeleton-row">
                  <div class="sk sk-line" style="width:180px"></div>
                  <div class="sk sk-line" style="width:80px"></div>
                  <div class="sk sk-line" style="width:60px"></div>
                  <div class="sk sk-line" style="width:70px"></div>
                  <div class="sk sk-line" style="width:70px"></div>
                  <div class="sk sk-line" style="width:40px"></div>
                </div>
              }
            </div>
          } @else if (filteredStocks().length === 0) {
            <div class="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44">
                <path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
              <p>{{ stockSearch() ? 'Sin resultados para "' + stockSearch() + '"' : 'No hay referencias de stock en esta sucursal' }}</p>
              @if (!stockSearch() && isAdmin()) {
                <button class="btn btn-primary btn-sm" (click)="initializeInventory(selectedBranch()!.id)">Inicializar inventario</button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Unidad</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                  <th>Estado</th>
                  @if (isAdmin()) { <th></th> }
                </tr>
              </thead>
              <tbody>
                @for (s of filteredStocks(); track s.id) {
                  <tr [class.stock-alert-row]="s.stock <= s.minStock">
                    <td>
                      <div class="prod-cell">
                        <div class="prod-icon" [class.low]="s.stock <= s.minStock">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                          </svg>
                        </div>
                        <span class="prod-name">{{ s.product.name }}</span>
                      </div>
                    </td>
                    <td><code class="sku-badge">{{ s.product.sku }}</code></td>
                    <td class="text-muted">{{ s.product.unit }}</td>
                    <td>
                      @if (editingStock()?.productId === s.productId) {
                        <input type="number" [(ngModel)]="editingStockData.stock"
                               class="inline-input" min="0" style="width:70px"/>
                      } @else {
                        <span [class.stock-val-low]="s.stock <= s.minStock">{{ s.stock }}</span>
                      }
                    </td>
                    <td>
                      @if (editingStock()?.productId === s.productId) {
                        <input type="number" [(ngModel)]="editingStockData.minStock"
                               class="inline-input" min="0" style="width:70px"/>
                      } @else {
                        {{ s.minStock }}
                      }
                    </td>
                    <td>
                      @if (s.stock <= s.minStock) {
                        <span class="stock-alert-badge">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"/>
                          </svg>
                          Stock bajo
                        </span>
                      } @else {
                        <span class="stock-ok-badge">OK</span>
                      }
                    </td>
                    @if (isAdmin()) {
                      <td class="actions-cell">
                        @if (editingStock()?.productId === s.productId) {
                          <button class="btn-icon btn-icon-success" title="Guardar" (click)="saveStock()" [disabled]="saving()">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                            </svg>
                          </button>
                          <button class="btn-icon" title="Cancelar" (click)="editingStock.set(null)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                            </svg>
                          </button>
                        } @else {
                          <button class="btn-icon" title="Editar stock" (click)="startEditStock(s)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                            </svg>
                          </button>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

      }
      <!-- END VIEW DETAIL -->


      <!-- ══════════════════════════════════════════════════════════════ -->
      <!--  BRANCH FORM MODAL                                             -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      @if (showForm()) {
        <div class="modal-overlay">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingBranch() ? 'Editar sucursal' : 'Nueva sucursal' }}</h3>
              <button class="modal-close" (click)="showForm.set(false)">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group fg-full">
                  <label>Nombre *</label>
                  <input type="text" [(ngModel)]="branchForm.name" class="form-control"
                         placeholder="Sucursal Centro" [class.input-error]="formSubmitted && !branchForm.name"/>
                  @if (formSubmitted && !branchForm.name) {
                    <span class="field-error">El nombre es requerido</span>
                  }
                </div>
              </div>
              <div class="form-row form-row--2">
                <div class="form-group">
                  <label>Ciudad</label>
                  <input type="text" [(ngModel)]="branchForm.city" class="form-control" placeholder="Bogotá"/>
                </div>
                <div class="form-group">
                  <label>Departamento</label>
                  <input type="text" [(ngModel)]="branchForm.department" class="form-control" placeholder="Cundinamarca"/>
                </div>
              </div>
              <div class="form-group">
                <label>Dirección</label>
                <input type="text" [(ngModel)]="branchForm.address" class="form-control" placeholder="Calle 123 #45-67"/>
              </div>
              <div class="form-row form-row--2">
                <div class="form-group">
                  <label>Teléfono</label>
                  <input type="tel" [(ngModel)]="branchForm.phone" class="form-control" placeholder="3001234567"/>
                </div>
                <div class="form-group">
                  <label>Correo electrónico</label>
                  <input type="email" [(ngModel)]="branchForm.email" class="form-control" placeholder="sucursal@empresa.com"/>
                </div>
              </div>
              <div class="form-check">
                <input type="checkbox" id="isMain" [(ngModel)]="branchForm.isMain" class="form-check-input"/>
                <label for="isMain" class="form-check-label">
                  Marcar como sucursal principal
                  <span class="form-check-hint">Solo puede existir una sucursal principal a la vez</span>
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="showForm.set(false)">Cancelar</button>
              <button class="btn btn-primary" [disabled]="saving()" (click)="saveBranch()">
                {{ saving() ? 'Guardando...' : (editingBranch() ? 'Actualizar' : 'Crear sucursal') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirm Modal -->
      @if (deleteTarget()) {
        <div class="modal-overlay">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Eliminar sucursal</h3>
            </div>
            <div class="modal-body">
              <p>¿Eliminar la sucursal <strong>{{ deleteTarget()!.name }}</strong>?</p>
              <p>Esta acción eliminará también todos los datos de inventario asociados y no se puede deshacer.</p>
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

    </div>
  `,
  styles: [`
    .page { max-width: 1200px; }

    /* ── Header ── */
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* ── Skeleton ── */
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; height:14px; }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .table-loading { padding:12px 16px; }
    .skeleton-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }

    /* ── Grid ── */
    .branches-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:16px; }

    /* ── Branch Card ── */
    .branch-card { background:#fff; border:1px solid #dce6f0; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:12px; transition:box-shadow .18s, transform .18s; }
    .branch-card:hover { box-shadow:0 4px 20px rgba(26,64,126,.10); transform:translateY(-2px); }
    .branch-card--inactive { opacity:.65; background:#f9fafb; }
    .branch-card--skeleton { pointer-events:none; }
    .card-top { display:flex; align-items:flex-start; gap:12px; }
    .card-icon { width:40px; height:40px; border-radius:10px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .card-name-wrap { flex:1; min-width:0; }
    .card-name { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0 0 6px; }
    .card-badges { display:flex; gap:6px; flex-wrap:wrap; }

    /* ── Badges ── */
    .badge { padding:2px 9px; border-radius:9999px; font-size:11px; font-weight:700; white-space:nowrap; }
    .badge--main { background:#ccfbf1; color:#0f766e; }
    .badge--active { background:#d1fae5; color:#065f46; }
    .badge--inactive { background:#f3f4f6; color:#6b7280; }

    /* ── Card info ── */
    .card-info { display:flex; flex-direction:column; gap:5px; }
    .card-info-row { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#64748b; }
    .card-info-row svg { color:#94a3b8; flex-shrink:0; }
    .card-info-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    /* ── Stats ── */
    .card-stats { display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #f0f4f8; padding-top:10px; }
    .stat-chip { display:flex; align-items:center; gap:4px; font-size:11.5px; color:#64748b; background:#f8fafc; border:1px solid #f0f4f8; border-radius:6px; padding:3px 8px; }
    .stat-chip svg { color:#94a3b8; }

    /* ── Card actions ── */
    .card-actions { display:flex; align-items:center; gap:6px; border-top:1px solid #f0f4f8; padding-top:12px; }
    .card-actions__main { flex:1; justify-content:center; }

    /* ── Empty state ── */
    .empty-state { padding:60px 24px; text-align:center; color:#9ca3af; }
    .empty-state p { margin:16px 0; font-size:14px; }

    /* ── Detail view ── */
    .detail-header { display:flex; align-items:flex-start; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
    .btn-back { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; background:#f0f4f9; border:1px solid #dce6f0; font-size:13px; font-weight:600; color:#374151; cursor:pointer; flex-shrink:0; transition:all .15s; }
    .btn-back:hover { background:#e8eef8; color:#1a407e; }
    .detail-title-block { flex:1; }
    .detail-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px; font-size:13px; color:#64748b; }
    .detail-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }

    /* ── Search ── */
    .search-wrap { flex:1; min-width:200px; max-width:360px; position:relative; }
    .search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; }
    .search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; }
    .search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }

    /* ── Transfer panel ── */
    .transfer-panel { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:16px 20px; margin-bottom:14px; }
    .transfer-panel__header { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:700; color:#065f46; margin-bottom:14px; }
    .transfer-panel__body { display:grid; grid-template-columns:1fr 1fr 160px auto; gap:12px; align-items:end; }
    .transfer-panel__actions { display:flex; gap:8px; align-items:center; }

    /* ── Table ── */
    .table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { padding:11px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .data-table td { padding:10px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .data-table tr:last-child td { border-bottom:none; }
    .data-table tr:hover td { background:#fafcff; }
    .stock-alert-row td { background:#fffbeb !important; }
    .prod-cell { display:flex; align-items:center; gap:10px; }
    .prod-icon { width:30px; height:30px; border-radius:7px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .prod-icon.low { background:#fef3c7; color:#d97706; }
    .prod-name { font-weight:600; color:#0c1c35; font-size:13.5px; }
    .sku-badge { background:#f0f4f9; color:#1a407e; font-size:11.5px; padding:2px 7px; border-radius:5px; font-family:monospace; }
    .text-muted { color:#9ca3af; font-size:13px; }
    .stock-val-low { color:#d97706; font-weight:700; }
    .stock-alert-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:9999px; background:#fef3c7; color:#92400e; font-size:11px; font-weight:700; }
    .stock-ok-badge { display:inline-flex; padding:2px 8px; border-radius:9999px; background:#d1fae5; color:#065f46; font-size:11px; font-weight:700; }
    .actions-cell { text-align:right; white-space:nowrap; }

    /* ── Inline edit ── */
    .inline-input { padding:5px 8px; border:1px solid #1a407e; border-radius:6px; font-size:13px; outline:none; background:#fff; }

    /* ── Buttons ── */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover:not(:disabled) { background:#e8eef8; }
    .btn-danger { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-danger:disabled { opacity:.6; cursor:default; }
    .btn-sm { padding:7px 14px; font-size:13px; }
    .btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; }
    .btn-icon:hover { background:#f0f4f9; color:#1a407e; }
    .btn-icon:disabled { opacity:.4; cursor:default; }
    .btn-icon-danger:hover { background:#fee2e2; color:#dc2626; }
    .btn-icon-success:hover { background:#d1fae5; color:#065f46; }

    /* ── Modal ── */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:540px; max-height:90vh; display:flex; flex-direction:column; }
    .modal-sm { max-width:400px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:17px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f8; color:#374151; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-body p { font-size:14px; color:#374151; line-height:1.6; margin:0 0 8px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; flex-shrink:0; }

    /* ── Form ── */
    .form-row { display:grid; grid-template-columns:1fr; gap:0; }
    .form-row--2 { grid-template-columns:1fr 1fr; gap:12px; }
    .fg-full { grid-column:1 / -1; }
    .form-group { margin-bottom:14px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .input-error { border-color:#dc2626; }
    .field-error { font-size:11.5px; color:#dc2626; margin-top:3px; display:block; }
    .form-check { display:flex; align-items:flex-start; gap:10px; padding:12px; background:#f8fafc; border-radius:8px; margin-top:4px; }
    .form-check-input { width:16px; height:16px; flex-shrink:0; margin-top:2px; cursor:pointer; accent-color:#1a407e; }
    .form-check-label { font-size:13.5px; font-weight:600; color:#374151; cursor:pointer; }
    .form-check-hint { display:block; font-size:11.5px; color:#9ca3af; font-weight:400; margin-top:2px; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:stretch; gap:10px; }
      .branches-grid { grid-template-columns:1fr; }
      .detail-header { flex-direction:column; gap:10px; }
      .transfer-panel__body { grid-template-columns:1fr 1fr; }
      .transfer-panel__actions { grid-column:1 / -1; justify-content:flex-end; }
    }
    @media (max-width: 640px) {
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .form-row--2 { grid-template-columns:1fr; }
      .transfer-panel__body { grid-template-columns:1fr; }
      .data-table { min-width:560px; }
      .table-card { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    }
  `]
})
export class BranchesComponent implements OnInit {
  private readonly http     = inject(HttpClient);
  private readonly notify   = inject(NotificationService);
  private readonly auth     = inject(AuthService);
  private readonly API      = `${environment.apiUrl}/branches`;

  // ── State ──────────────────────────────────────────────────────────────────
  branches       = signal<Branch[]>([]);
  loading        = signal(true);
  saving         = signal(false);

  selectedBranch = signal<Branch | null>(null);
  view           = signal<'list' | 'detail'>('list');
  showForm       = signal(false);
  editingBranch  = signal<Branch | null>(null);

  stocks         = signal<BranchStock[]>([]);
  loadingStocks  = signal(false);
  stockSearch    = signal('');
  stockSearchValue = '';
  transferMode   = signal(false);

  editingStock     = signal<StockEditState | null>(null);
  editingStockData: StockEditState = { productId: '', stock: 0, minStock: 0 };

  deleteTarget   = signal<Branch | null>(null);
  formSubmitted  = false;

  // ── Branch form model ──────────────────────────────────────────────────────
  branchForm: BranchForm = this.emptyBranchForm();

  // ── Transfer form model ────────────────────────────────────────────────────
  transferForm: TransferForm = { targetBranchId: '', productId: '', quantity: null };

  // ── Computed ───────────────────────────────────────────────────────────────
  filteredStocks = computed(() => {
    const q = this.stockSearch().toLowerCase().trim();
    if (!q) return this.stocks();
    return this.stocks().filter(s =>
      s.product.name.toLowerCase().includes(q) ||
      s.product.sku.toLowerCase().includes(q)
    );
  });

  otherBranches = computed(() =>
    this.branches().filter(b => b.id !== this.selectedBranch()?.id && b.isActive)
  );

  isAdmin = computed(() => {
    const user = this.auth.user();
    if (!user) return false;
    return user.roles?.some(r => r === 'ADMIN' || r === 'MANAGER') ?? false;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadBranches();
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  loadBranches(): void {
    this.loading.set(true);
    this.http.get<any>(`${this.API}`).subscribe({
      next: (res) => {
        this.branches.set(res.data ?? res);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Error al cargar sucursales');
        this.loading.set(false);
      },
    });
  }

  // ── Form helpers ───────────────────────────────────────────────────────────
  private emptyBranchForm(): BranchForm {
    return { name: '', address: '', city: '', department: '', phone: '', email: '', isMain: false };
  }

  openCreate(): void {
    this.editingBranch.set(null);
    this.branchForm = this.emptyBranchForm();
    this.formSubmitted = false;
    this.showForm.set(true);
  }

  openEdit(branch: Branch): void {
    this.editingBranch.set(branch);
    this.branchForm = {
      name:       branch.name,
      address:    branch.address    ?? '',
      city:       branch.city       ?? '',
      department: branch.department ?? '',
      phone:      branch.phone      ?? '',
      email:      branch.email      ?? '',
      isMain:     branch.isMain,
    };
    this.formSubmitted = false;
    this.showForm.set(true);
  }

  saveBranch(): void {
    this.formSubmitted = true;
    if (!this.branchForm.name.trim()) return;

    this.saving.set(true);
    const editing = this.editingBranch();

    const request$ = editing
      ? this.http.patch<any>(`${this.API}/${editing.id}`, this.branchForm)
      : this.http.post<any>(`${this.API}`, this.branchForm);

    request$.subscribe({
      next: () => {
        this.notify.success(editing ? 'Sucursal actualizada' : 'Sucursal creada exitosamente');
        this.saving.set(false);
        this.showForm.set(false);
        this.loadBranches();
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al guardar sucursal');
        this.saving.set(false);
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  confirmDelete(branch: Branch): void {
    this.deleteTarget.set(branch);
  }

  doDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.saving.set(true);
    this.http.delete<any>(`${this.API}/${target.id}`).subscribe({
      next: () => {
        this.notify.success('Sucursal eliminada');
        this.saving.set(false);
        this.deleteTarget.set(null);
        this.loadBranches();
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al eliminar sucursal');
        this.saving.set(false);
      },
    });
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  toggleActive(branch: Branch): void {
    this.http.patch<any>(`${this.API}/${branch.id}/toggle-active`, {}).subscribe({
      next: () => {
        this.notify.success(branch.isActive ? 'Sucursal desactivada' : 'Sucursal activada');
        this.loadBranches();
      },
      error: (err) => this.notify.error(err?.error?.message ?? 'Error al cambiar estado'),
    });
  }

  // ── Detail / Stocks ────────────────────────────────────────────────────────
  selectBranch(branch: Branch): void {
    this.selectedBranch.set(branch);
    this.stockSearch.set('');
    this.stockSearchValue = '';
    this.transferMode.set(false);
    this.editingStock.set(null);
    this.view.set('detail');
    this.loadStocks(branch.id);
  }

  goBack(): void {
    this.view.set('list');
    this.selectedBranch.set(null);
    this.stocks.set([]);
    this.transferMode.set(false);
    this.editingStock.set(null);
  }

  loadStocks(branchId: string): void {
    this.loadingStocks.set(true);
    this.http.get<any>(`${this.API}/${branchId}/stocks`).subscribe({
      next: (res) => {
        this.stocks.set(res.data ?? res);
        this.loadingStocks.set(false);
      },
      error: () => {
        this.notify.error('Error al cargar inventario de la sucursal');
        this.loadingStocks.set(false);
      },
    });
  }

  initializeInventory(branchId: string): void {
    this.saving.set(true);
    this.http.post<any>(`${this.API}/${branchId}/stocks/initialize`, {}).subscribe({
      next: () => {
        this.notify.success('Inventario inicializado');
        this.saving.set(false);
        this.loadStocks(branchId);
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al inicializar inventario');
        this.saving.set(false);
      },
    });
  }

  // ── Inline stock edit ──────────────────────────────────────────────────────
  startEditStock(s: BranchStock): void {
    this.editingStockData = { productId: s.productId, stock: s.stock, minStock: s.minStock };
    this.editingStock.set(this.editingStockData);
  }

  saveStock(): void {
    const editing = this.editingStock();
    const branch  = this.selectedBranch();
    if (!editing || !branch) return;
    this.saving.set(true);
    this.http.patch<any>(`${this.API}/${branch.id}/stocks`, {
      productId: this.editingStockData.productId,
      stock:     this.editingStockData.stock,
      minStock:  this.editingStockData.minStock,
    }).subscribe({
      next: () => {
        this.notify.success('Stock actualizado');
        this.saving.set(false);
        this.editingStock.set(null);
        this.loadStocks(branch.id);
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al actualizar stock');
        this.saving.set(false);
      },
    });
  }

  // ── Transfer ───────────────────────────────────────────────────────────────
  doTransfer(): void {
    const branch = this.selectedBranch();
    if (!branch) return;
    if (!this.transferForm.targetBranchId || !this.transferForm.productId || !this.transferForm.quantity) return;

    this.saving.set(true);
    this.http.post<any>(`${this.API}/${branch.id}/stocks/transfer`, {
      targetBranchId: this.transferForm.targetBranchId,
      productId:      this.transferForm.productId,
      quantity:       this.transferForm.quantity,
    }).subscribe({
      next: () => {
        this.notify.success('Transferencia realizada exitosamente');
        this.saving.set(false);
        this.transferMode.set(false);
        this.transferForm = { targetBranchId: '', productId: '', quantity: null };
        this.loadStocks(branch.id);
      },
      error: (err) => {
        this.notify.error(err?.error?.message ?? 'Error al transferir stock');
        this.saving.set(false);
      },
    });
  }
  nonEmpty = (v: any) => Boolean(v);
}
