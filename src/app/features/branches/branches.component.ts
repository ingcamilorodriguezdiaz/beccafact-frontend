import {
  Component, OnInit, signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
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
  product: { id: string; name: string; sku: string; unit: string };
}

interface Country      { code: string; name: string; }
interface Department   { code: string; name: string; countryCode: string; }
interface Municipality { code: string; name: string; departmentCode: string; department?: { name: string }; }

interface BranchForm {
  name: string; address: string; city: string; department: string;
  phone: string; email: string; isMain: boolean;
  cityCode: string; departmentCode: string; country: string;
}

interface StockEditState { productId: string; stock: number; minStock: number; }
interface TransferForm   { targetBranchId: string; productId: string; quantity: number | null; }

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="brf-page animate-in">

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!--  VIEW: LIST                                                    -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      @if (view() === 'list') {

        <div class="brf-page-header">
          <div>
            <h2 class="brf-page-title">Sucursales</h2>
            <p class="brf-page-subtitle">
              {{ branches().length }} sucursal{{ branches().length !== 1 ? 'es' : '' }}
              registrada{{ branches().length !== 1 ? 's' : '' }}
            </p>
          </div>
          @if (isAdmin()) {
            <button class="brf-btn brf-btn-primary" (click)="openCreate()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
              </svg>
              Nueva sucursal
            </button>
          }
        </div>

        <!-- Skeleton -->
        @if (loading()) {
          <div class="brf-grid">
            @for (i of [1,2,3]; track i) {
              <div class="brf-card brf-card--skeleton">
                <div class="brf-sk" style="width:60%;height:18px;margin-bottom:10px"></div>
                <div class="brf-sk" style="width:80%;margin-bottom:6px"></div>
                <div class="brf-sk" style="width:50%;margin-bottom:6px"></div>
                <div class="brf-sk" style="width:70%;margin-bottom:16px"></div>
                <div style="display:flex;gap:8px">
                  <div class="brf-sk" style="flex:1;height:32px;border-radius:8px"></div>
                  <div class="brf-sk" style="width:36px;height:32px;border-radius:8px"></div>
                  <div class="brf-sk" style="width:36px;height:32px;border-radius:8px"></div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Empty -->
        @else if (branches().length === 0) {
          <div class="brf-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="52" height="52">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>
            </svg>
            <p>No hay sucursales registradas aún</p>
            @if (isAdmin()) {
              <button class="brf-btn brf-btn-primary brf-btn-sm" (click)="openCreate()">Crear primera sucursal</button>
            }
          </div>
        }

        <!-- Grid -->
        @else {
          <div class="brf-grid">
            @for (branch of branches(); track branch.id) {
              <div class="brf-card" [class.brf-card--inactive]="!branch.isActive">

                <div class="brf-card-top">
                  <div class="brf-card-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"/>
                    </svg>
                  </div>
                  <div class="brf-card-name-wrap">
                    <h3 class="brf-card-name">{{ branch.name }}</h3>
                    <div class="brf-badges">
                      @if (branch.isMain) { <span class="brf-badge brf-badge--main">Principal</span> }
                      <span class="brf-badge"
                            [class.brf-badge--active]="branch.isActive"
                            [class.brf-badge--inactive]="!branch.isActive">
                        {{ branch.isActive ? 'Activa' : 'Inactiva' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="brf-card-info">
                  @if (branch.city || branch.department) {
                    <div class="brf-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                      </svg>
                      <span>{{ [branch.city, branch.department].filter(nonEmpty).join(', ') }}</span>
                    </div>
                  }
                  @if (branch.address) {
                    <div class="brf-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                      </svg>
                      <span>{{ branch.address }}</span>
                    </div>
                  }
                  @if (branch.phone) {
                    <div class="brf-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                      </svg>
                      <span>{{ branch.phone }}</span>
                    </div>
                  }
                  @if (branch.email) {
                    <div class="brf-info-row">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="12">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                      </svg>
                      <span>{{ branch.email }}</span>
                    </div>
                  }
                </div>

                @if (branch._count) {
                  <div class="brf-stats">
                    <div class="brf-stat-chip">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                      </svg>
                      {{ branch._count.userBranches }} usuarios
                    </div>
                    <div class="brf-stat-chip">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"/>
                      </svg>
                      {{ branch._count.invoices }} facturas
                    </div>
                  </div>
                }

                <div class="brf-card-actions">
                  <button class="brf-btn brf-btn-sm brf-btn-secondary brf-card-actions__main" (click)="selectBranch(branch)">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                      <path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z"/>
                    </svg>
                    Ver inventario
                  </button>
                  @if (isAdmin()) {
                    <button class="brf-btn-icon" title="Editar" (click)="openEdit(branch)">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                    </button>
                    <button class="brf-btn-icon" [title]="branch.isActive ? 'Desactivar' : 'Activar'" (click)="toggleActive(branch)">
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
                      <button class="brf-btn-icon brf-btn-icon--danger" title="Eliminar" (click)="confirmDelete(branch)">
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

      <!-- ══════════════════════════════════════════════════════════════ -->
      <!--  VIEW: DETAIL                                                  -->
      <!-- ══════════════════════════════════════════════════════════════ -->
      @if (view() === 'detail' && selectedBranch()) {

        <div class="brf-detail-header">
          <button class="brf-btn-back" (click)="goBack()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"/>
            </svg>
            Sucursales
          </button>
          <div class="brf-detail-title">
            <h2 class="brf-page-title">{{ selectedBranch()!.name }}</h2>
            <div class="brf-detail-meta">
              @if (selectedBranch()!.city) { <span>{{ selectedBranch()!.city }}</span> }
              @if (selectedBranch()!.address) { <span>·</span><span>{{ selectedBranch()!.address }}</span> }
              <span class="brf-badge"
                    [class.brf-badge--active]="selectedBranch()!.isActive"
                    [class.brf-badge--inactive]="!selectedBranch()!.isActive">
                {{ selectedBranch()!.isActive ? 'Activa' : 'Inactiva' }}
              </span>
            </div>
          </div>
          @if (isAdmin()) {
            <button class="brf-btn brf-btn-secondary brf-btn-sm"
                    (click)="initializeInventory(selectedBranch()!.id)" [disabled]="saving()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
              </svg>
              Inicializar inventario
            </button>
          }
        </div>

        <div class="brf-toolbar">
          <div class="brf-search-wrap">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
            </svg>
            <input type="text" placeholder="Buscar producto, SKU..."
                   [(ngModel)]="stockSearchValue"
                   (ngModelChange)="stockSearch.set($event)"
                   class="brf-search-input"/>
          </div>
          @if (isAdmin()) {
            <button class="brf-btn brf-btn-secondary brf-btn-sm"
                    [class.brf-btn-primary]="transferMode()"
                    (click)="transferMode.set(!transferMode())">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13">
                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/>
              </svg>
              Transferir stock
            </button>
          }
        </div>

        @if (transferMode()) {
          <div class="brf-transfer-panel">
            <div class="brf-transfer-header">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/>
              </svg>
              <span>Transferir stock a otra sucursal</span>
            </div>
            <div class="brf-transfer-body">
              <div class="brf-form-group">
                <label>Sucursal destino *</label>
                <select [(ngModel)]="transferForm.targetBranchId" class="brf-form-control">
                  <option value="">Seleccionar sucursal...</option>
                  @for (b of otherBranches(); track b.id) {
                    <option [value]="b.id">{{ b.name }}</option>
                  }
                </select>
              </div>
              <div class="brf-form-group">
                <label>Producto *</label>
                <select [(ngModel)]="transferForm.productId" class="brf-form-control">
                  <option value="">Seleccionar producto...</option>
                  @for (s of stocks(); track s.id) {
                    <option [value]="s.productId">{{ s.product.name }} (stock: {{ s.stock }})</option>
                  }
                </select>
              </div>
              <div class="brf-form-group">
                <label>Cantidad *</label>
                <input type="number" [(ngModel)]="transferForm.quantity"
                       class="brf-form-control" placeholder="0" min="1"/>
              </div>
              <div class="brf-transfer-actions">
                <button class="brf-btn brf-btn-secondary brf-btn-sm" (click)="transferMode.set(false)">Cancelar</button>
                <button class="brf-btn brf-btn-primary brf-btn-sm"
                        [disabled]="saving() || !transferForm.targetBranchId || !transferForm.productId || !transferForm.quantity"
                        (click)="doTransfer()">
                  {{ saving() ? 'Transfiriendo...' : 'Confirmar transferencia' }}
                </button>
              </div>
            </div>
          </div>
        }

        <div class="brf-table-card">
          @if (loadingStocks()) {
            <div class="brf-table-loading">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="brf-sk-row">
                  <div class="brf-sk" style="width:180px"></div>
                  <div class="brf-sk" style="width:80px"></div>
                  <div class="brf-sk" style="width:60px"></div>
                  <div class="brf-sk" style="width:70px"></div>
                  <div class="brf-sk" style="width:70px"></div>
                  <div class="brf-sk" style="width:40px"></div>
                </div>
              }
            </div>
          } @else if (filteredStocks().length === 0) {
            <div class="brf-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44">
                <path stroke-linecap="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
              <p>{{ stockSearch() ? 'Sin resultados para "' + stockSearch() + '"' : 'No hay referencias de stock en esta sucursal' }}</p>
              @if (!stockSearch() && isAdmin()) {
                <button class="brf-btn brf-btn-primary brf-btn-sm" (click)="initializeInventory(selectedBranch()!.id)">
                  Inicializar inventario
                </button>
              }
            </div>
          } @else {
            <table class="brf-table">
              <thead>
                <tr>
                  <th>Producto</th><th>SKU</th><th>Unidad</th>
                  <th>Stock actual</th><th>Stock mínimo</th><th>Estado</th>
                  @if (isAdmin()) { <th></th> }
                </tr>
              </thead>
              <tbody>
                @for (s of filteredStocks(); track s.id) {
                  <tr [class.brf-alert-row]="s.stock <= s.minStock">
                    <td>
                      <div class="brf-prod-cell">
                        <div class="brf-prod-icon" [class.low]="s.stock <= s.minStock">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/>
                            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                          </svg>
                        </div>
                        <span class="brf-prod-name">{{ s.product.name }}</span>
                      </div>
                    </td>
                    <td><code class="brf-sku">{{ s.product.sku }}</code></td>
                    <td class="brf-muted">{{ s.product.unit }}</td>
                    <td>
                      @if (editingStock()?.productId === s.productId) {
                        <input type="number" [(ngModel)]="editingStockData.stock"
                               class="brf-inline-input" min="0" style="width:70px"/>
                      } @else {
                        <span [class.brf-val-low]="s.stock <= s.minStock">{{ s.stock }}</span>
                      }
                    </td>
                    <td>
                      @if (editingStock()?.productId === s.productId) {
                        <input type="number" [(ngModel)]="editingStockData.minStock"
                               class="brf-inline-input" min="0" style="width:70px"/>
                      } @else { {{ s.minStock }} }
                    </td>
                    <td>
                      @if (s.stock <= s.minStock) {
                        <span class="brf-badge-alert">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="11">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z"/>
                          </svg>
                          Stock bajo
                        </span>
                      } @else {
                        <span class="brf-badge-ok">OK</span>
                      }
                    </td>
                    @if (isAdmin()) {
                      <td class="brf-actions-cell">
                        @if (editingStock()?.productId === s.productId) {
                          <button class="brf-btn-icon brf-btn-icon--success" title="Guardar"
                                  (click)="saveStock()" [disabled]="saving()">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                            </svg>
                          </button>
                          <button class="brf-btn-icon" title="Cancelar" (click)="editingStock.set(null)">
                            <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                            </svg>
                          </button>
                        } @else {
                          <button class="brf-btn-icon" title="Editar stock" (click)="startEditStock(s)">
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

    </div>

    <!-- ══════════════════════════════════════════════════════════════ -->
    <!--  MODAL: BRANCH FORM  — fuera del div.brf-page                  -->
    <!-- ══════════════════════════════════════════════════════════════ -->
    @if (showForm()) {
      <div class="modal-overlay">
        <div class="brf-modal" (click)="$event.stopPropagation()">

          <div class="brf-modal-header">
            <h3>{{ editingBranch() ? 'Editar sucursal' : 'Nueva sucursal' }}</h3>
            <button class="brf-modal-close" (click)="showForm.set(false)">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>

          <div class="brf-modal-body">

            <!-- Nombre -->
            <div class="brf-form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="branchForm.name" class="brf-form-control"
                     placeholder="Sucursal Centro"
                     [class.brf-input-error]="formSubmitted && !branchForm.name"/>
              @if (formSubmitted && !branchForm.name) {
                <span class="brf-field-error">El nombre es requerido</span>
              }
            </div>

            <!-- Teléfono + Email -->
            <div class="brf-form-row--2">
              <div class="brf-form-group">
                <label>Teléfono</label>
                <input type="tel" [(ngModel)]="branchForm.phone"
                       class="brf-form-control" placeholder="3001234567"/>
              </div>
              <div class="brf-form-group">
                <label>Correo electrónico</label>
                <input type="email" [(ngModel)]="branchForm.email"
                       class="brf-form-control" placeholder="sucursal@empresa.com"/>
              </div>
            </div>

            <!-- Sección Ubicación -->
            <div class="brf-form-section-title">Ubicación</div>

            <!-- País + Departamento -->
            <div class="brf-form-row--2">
              <div class="brf-form-group">
                <label>País</label>
                <select [(ngModel)]="branchForm.country" (ngModelChange)="onCountryChange($event)"
                        class="brf-form-control" name="country">
                  <option value="">— Seleccionar país —</option>
                  @for (c of countries(); track c.code) {
                    <option [value]="c.code">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="brf-form-group">
                <label>Departamento</label>
                @if (branchForm.country === 'CO') {
                  <select [(ngModel)]="branchForm.departmentCode"
                          (ngModelChange)="onDepartmentChange($event)"
                          class="brf-form-control" name="departmentCode"
                          [disabled]="!branchForm.country">
                    <option value="">— Seleccionar departamento —</option>
                    @for (d of departments(); track d.code) {
                      <option [value]="d.code">{{ d.name }}</option>
                    }
                  </select>
                } @else {
                  <input type="text" [(ngModel)]="branchForm.departmentCode"
                         class="brf-form-control" name="departmentCode" placeholder="Estado / Provincia"/>
                }
              </div>
            </div>

            <!-- Municipio + Dirección -->
            <div class="brf-form-row--2">
              <div class="brf-form-group brf-muni-wrap">
                <label>
                  @if (branchForm.country === 'CO') { Municipio (DIVIPOLA) }
                  @else { Ciudad }
                </label>
                @if (branchForm.country === 'CO') {
                  <input type="text"
                         [value]="muniSearchText()"
                         (input)="onMuniInput($any($event.target).value)"
                         (focus)="muniDropdownOpen.set(true)"
                         (blur)="muniDropdownOpen.set(false)"
                         [placeholder]="branchForm.departmentCode ? 'Buscar municipio...' : 'Selecciona primero el departamento'"
                         [disabled]="!branchForm.departmentCode"
                         class="brf-form-control"
                         name="citySearch"
                         autocomplete="off"/>
                  @if (muniDropdownOpen() && filteredMunicipalities().length > 0) {
                    <ul class="brf-muni-dropdown" (mousedown)="$event.preventDefault()">
                      @for (m of filteredMunicipalities(); track m.code) {
                        <li class="brf-muni-option" (click)="onMuniSelect(m)">
                          <span class="brf-muni-name">{{ m.name }}</span>
                          <span class="brf-muni-code">{{ m.code }}</span>
                        </li>
                      }
                    </ul>
                  }
                  @if (muniDropdownOpen() && muniSearchText().length >= 2 && filteredMunicipalities().length === 0 && !loadingMunis()) {
                    <div class="brf-muni-dropdown brf-muni-dropdown--empty">Sin resultados</div>
                  }
                  @if (loadingMunis()) {
                    <div class="brf-muni-dropdown brf-muni-dropdown--empty">Buscando...</div>
                  }
                  @if (branchForm.cityCode) {
                    <span class="brf-divipola-hint">
                      <svg viewBox="0 0 20 20" fill="currentColor" width="11"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/></svg>
                      Cód. DIVIPOLA: <strong>{{ branchForm.cityCode }}</strong>
                    </span>
                  }
                } @else {
                  <input type="text" [(ngModel)]="branchForm.cityCode"
                         class="brf-form-control" name="cityCode" placeholder="Nombre de la ciudad"/>
                }
              </div>
              <div class="brf-form-group">
                <label>Dirección</label>
                <input type="text" [(ngModel)]="branchForm.address"
                       class="brf-form-control" placeholder="Calle 123 #45-67"/>
              </div>
            </div>

            <!-- Principal -->
            <div class="brf-form-check">
              <input type="checkbox" id="isMain" [(ngModel)]="branchForm.isMain" class="brf-check-input"/>
              <label for="isMain" class="brf-check-label">
                Marcar como sucursal principal
                <span class="brf-check-hint">Solo puede existir una sucursal principal a la vez</span>
              </label>
            </div>

          </div>

          <div class="brf-modal-footer">
            <button class="brf-btn brf-btn-secondary" (click)="showForm.set(false)">Cancelar</button>
            <button class="brf-btn brf-btn-primary" [disabled]="saving()" (click)="saveBranch()">
              {{ saving() ? 'Guardando...' : (editingBranch() ? 'Actualizar' : 'Crear sucursal') }}
            </button>
          </div>

        </div>
      </div>
    }

    <!-- MODAL: Eliminar — fuera del div.brf-page -->
    @if (deleteTarget()) {
      <div class="modal-overlay" (click)="deleteTarget.set(null)">
        <div class="brf-modal brf-modal--sm" (click)="$event.stopPropagation()">
          <div class="brf-modal-header">
            <h3>Eliminar sucursal</h3>
          </div>
          <div class="brf-modal-body">
            <p>¿Eliminar la sucursal <strong>{{ deleteTarget()!.name }}</strong>?</p>
            <p>Esta acción eliminará también todos los datos de inventario asociados y no se puede deshacer.</p>
          </div>
          <div class="brf-modal-footer">
            <button class="brf-btn brf-btn-secondary" (click)="deleteTarget.set(null)">Cancelar</button>
            <button class="brf-btn brf-btn-danger" [disabled]="saving()" (click)="doDelete()">
              {{ saving() ? 'Eliminando...' : 'Sí, eliminar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`

    /* ══════════════════════════════════════════════════════════════════════
       OVERLAY + MODAL  — mismo patrón que inventory.component
       position:fixed + inset:0  →  cubre el viewport completo sin depender
       de ningún ancestro, igual que .modal-overlay en inventory.
    ══════════════════════════════════════════════════════════════════════ */

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 16px;
    }

    .brf-modal {
      background: #fff;
      border-radius: 16px;
      width: 100%;
      max-width: 540px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
      animation: brf-modal-in 0.2s cubic-bezier(.22,.68,0,1.2);
    }

    .brf-modal--sm { max-width: 400px; }

    @keyframes brf-modal-in {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }

    .brf-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid #f0f4f8;
      flex-shrink: 0;
    }

    .brf-modal-header h3 {
      font-family: 'Sora', sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: #0c1c35;
      margin: 0;
    }

    .brf-modal-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #9ca3af;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all .15s;
    }
    .brf-modal-close:hover { background: #f0f4f8; color: #374151; }

    .brf-modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .brf-modal-body p { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 8px; }

    .brf-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid #f0f4f8;
      flex-shrink: 0;
    }

    /* ══════════════════════════════════════════════════════════════════════
       PAGE & LAYOUT
    ══════════════════════════════════════════════════════════════════════ */

    .brf-page        { max-width: 1200px; }
    .brf-page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; }
    .brf-page-title  { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .brf-page-subtitle { font-size:13px; color:#7ea3cc; margin:0; }

    /* ── Skeleton ── */
    .brf-sk {
      background: linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%);
      background-size: 200% 100%;
      animation: brf-shimmer 1.5s infinite;
      border-radius: 6px; height: 14px;
    }
    @keyframes brf-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .brf-table-loading { padding:12px 16px; }
    .brf-sk-row { display:flex; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #f0f4f8; }

    /* ── Grid ── */
    .brf-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }

    /* ── Card ── */
    .brf-card { background:#fff; border:1px solid #dce6f0; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:12px; transition:box-shadow .18s,transform .18s; }
    .brf-card:hover { box-shadow:0 4px 20px rgba(26,64,126,.10); transform:translateY(-2px); }
    .brf-card--inactive { opacity:.65; background:#f9fafb; }
    .brf-card--skeleton { pointer-events:none; }
    .brf-card-top { display:flex; align-items:flex-start; gap:12px; }
    .brf-card-icon { width:40px; height:40px; border-radius:10px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .brf-card-name-wrap { flex:1; min-width:0; }
    .brf-card-name { font-family:'Sora',sans-serif; font-size:15px; font-weight:700; color:#0c1c35; margin:0 0 6px; }
    .brf-badges { display:flex; gap:6px; flex-wrap:wrap; }

    /* ── Badges ── */
    .brf-badge          { padding:2px 9px; border-radius:9999px; font-size:11px; font-weight:700; white-space:nowrap; }
    .brf-badge--main    { background:#ccfbf1; color:#0f766e; }
    .brf-badge--active  { background:#d1fae5; color:#065f46; }
    .brf-badge--inactive { background:#f3f4f6; color:#6b7280; }
    .brf-badge-alert    { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:9999px; background:#fef3c7; color:#92400e; font-size:11px; font-weight:700; }
    .brf-badge-ok       { display:inline-flex; padding:2px 8px; border-radius:9999px; background:#d1fae5; color:#065f46; font-size:11px; font-weight:700; }

    /* ── Info rows ── */
    .brf-card-info { display:flex; flex-direction:column; gap:5px; }
    .brf-info-row  { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#64748b; }
    .brf-info-row svg  { color:#94a3b8; flex-shrink:0; }
    .brf-info-row span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    /* ── Stats ── */
    .brf-stats     { display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #f0f4f8; padding-top:10px; }
    .brf-stat-chip { display:flex; align-items:center; gap:4px; font-size:11.5px; color:#64748b; background:#f8fafc; border:1px solid #f0f4f8; border-radius:6px; padding:3px 8px; }
    .brf-stat-chip svg { color:#94a3b8; }

    /* ── Card actions ── */
    .brf-card-actions       { display:flex; align-items:center; gap:6px; border-top:1px solid #f0f4f8; padding-top:12px; }
    .brf-card-actions__main { flex:1; justify-content:center; }

    /* ── Empty ── */
    .brf-empty   { padding:60px 24px; text-align:center; color:#9ca3af; }
    .brf-empty p { margin:16px 0; font-size:14px; }

    /* ── Detail header ── */
    .brf-detail-header { display:flex; align-items:flex-start; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
    .brf-btn-back { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; background:#f0f4f9; border:1px solid #dce6f0; font-size:13px; font-weight:600; color:#374151; cursor:pointer; flex-shrink:0; transition:all .15s; }
    .brf-btn-back:hover { background:#e8eef8; color:#1a407e; }
    .brf-detail-title { flex:1; }
    .brf-detail-meta  { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px; font-size:13px; color:#64748b; }
    .brf-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }

    /* ── Search ── */
    .brf-search-wrap { flex:1; min-width:200px; max-width:360px; position:relative; }
    .brf-search-wrap svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; pointer-events:none; }
    .brf-search-input { width:100%; padding:8px 12px 8px 36px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; }
    .brf-search-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }

    /* ── Transfer ── */
    .brf-transfer-panel  { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:16px 20px; margin-bottom:14px; }
    .brf-transfer-header { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:700; color:#065f46; margin-bottom:14px; }
    .brf-transfer-body   { display:grid; grid-template-columns:1fr 1fr 160px auto; gap:12px; align-items:end; }
    .brf-transfer-actions { display:flex; gap:8px; align-items:center; }

    /* ── Table ── */
    .brf-table-card { background:#fff; border:1px solid #dce6f0; border-radius:12px; overflow:hidden; }
    .brf-table { width:100%; border-collapse:collapse; }
    .brf-table th { padding:11px 14px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; background:#f8fafc; border-bottom:1px solid #dce6f0; text-align:left; }
    .brf-table td { padding:10px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .brf-table tr:last-child td { border-bottom:none; }
    .brf-table tr:hover td { background:#fafcff; }
    .brf-alert-row td { background:#fffbeb !important; }

    .brf-prod-cell { display:flex; align-items:center; gap:10px; }
    .brf-prod-icon { width:30px; height:30px; border-radius:7px; background:#e8eef8; color:#1a407e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .brf-prod-icon.low { background:#fef3c7; color:#d97706; }
    .brf-prod-name { font-weight:600; color:#0c1c35; font-size:13.5px; }
    .brf-sku       { background:#f0f4f9; color:#1a407e; font-size:11.5px; padding:2px 7px; border-radius:5px; font-family:monospace; }
    .brf-muted     { color:#9ca3af; font-size:13px; }
    .brf-val-low   { color:#d97706; font-weight:700; }
    .brf-actions-cell { text-align:right; white-space:nowrap; }

    /* ── Inline edit ── */
    .brf-inline-input { padding:5px 8px; border:1px solid #1a407e; border-radius:6px; font-size:13px; outline:none; background:#fff; }

    /* ── Buttons ── */
    .brf-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .brf-btn-primary             { background:#1a407e; color:#fff; }
    .brf-btn-primary:hover:not(:disabled) { background:#15336a; }
    .brf-btn-primary:disabled    { opacity:.6; cursor:default; }
    .brf-btn-secondary           { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .brf-btn-secondary:hover:not(:disabled) { background:#e8eef8; }
    .brf-btn-danger              { background:#dc2626; color:#fff; }
    .brf-btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .brf-btn-danger:disabled     { opacity:.6; cursor:default; }
    .brf-btn-sm  { padding:7px 14px; font-size:13px; }
    .brf-btn-icon { background:none; border:none; padding:5px; border-radius:6px; cursor:pointer; color:#9ca3af; transition:all .15s; display:inline-flex; align-items:center; justify-content:center; }
    .brf-btn-icon:hover          { background:#f0f4f9; color:#1a407e; }
    .brf-btn-icon:disabled       { opacity:.4; cursor:default; }
    .brf-btn-icon--danger:hover  { background:#fee2e2; color:#dc2626; }
    .brf-btn-icon--success:hover { background:#d1fae5; color:#065f46; }

    /* ── Form ── */
    .brf-form-row--2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .brf-form-group  { margin-bottom:14px; }
    .brf-form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .brf-form-control { width:100%; padding:9px 12px; border:1px solid #dce6f0; border-radius:8px; font-size:14px; outline:none; background:#fff; color:#0c1c35; box-sizing:border-box; transition:border-color .15s, box-shadow .15s; }
    .brf-form-control:focus    { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .brf-form-control:disabled { background:#f9fafb; color:#9ca3af; cursor:not-allowed; }
    .brf-input-error   { border-color:#dc2626 !important; }
    .brf-field-error   { font-size:11.5px; color:#dc2626; margin-top:3px; display:block; }
    .brf-form-check    { display:flex; align-items:flex-start; gap:10px; padding:12px; background:#f8fafc; border-radius:8px; margin-top:4px; }
    .brf-check-input   { width:16px; height:16px; flex-shrink:0; margin-top:2px; cursor:pointer; accent-color:#1a407e; }
    .brf-check-label   { font-size:13.5px; font-weight:600; color:#374151; cursor:pointer; }
    .brf-check-hint    { display:block; font-size:11.5px; color:#9ca3af; font-weight:400; margin-top:2px; }

    /* ── Form section title ── */
    .brf-form-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#1a407e; margin:4px 0 12px; padding-bottom:6px; border-bottom:1px solid #e8eef8; }

    /* ── Municipio ── */
    .brf-muni-wrap     { position:relative; }
    .brf-muni-dropdown { position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #dce6f0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.10); max-height:200px; overflow-y:auto; z-index:300; margin:4px 0 0; padding:4px 0; list-style:none; }
    .brf-muni-dropdown--empty { padding:10px 14px; font-size:13px; color:#9ca3af; list-style:none; }
    .brf-muni-option   { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; cursor:pointer; font-size:13.5px; color:#374151; }
    .brf-muni-option:hover { background:#f0f4f9; }
    .brf-muni-name     { font-weight:500; }
    .brf-muni-code     { font-size:11px; color:#9ca3af; font-family:monospace; }
    .brf-divipola-hint { display:inline-flex; align-items:center; gap:4px; margin-top:5px; font-size:11.5px; color:#065f46; }
    .brf-divipola-hint svg { color:#059669; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .brf-page-header   { flex-direction:column; align-items:stretch; gap:10px; }
      .brf-grid          { grid-template-columns:1fr; }
      .brf-detail-header { flex-direction:column; gap:10px; }
      .brf-transfer-body { grid-template-columns:1fr 1fr; }
      .brf-transfer-actions { grid-column:1 / -1; justify-content:flex-end; }
    }

    @media (max-width: 640px) {
      .modal-overlay       { align-items: flex-end; padding: 0; }
      .brf-modal           { border-radius: 20px 20px 0 0; max-width: 100%; max-height: 95dvh; }
      .brf-modal-footer    { flex-direction:column-reverse; gap:8px; }
      .brf-modal-footer .brf-btn { width:100%; justify-content:center; }
      .brf-form-row--2     { grid-template-columns:1fr; }
      .brf-transfer-body   { grid-template-columns:1fr; }
      .brf-table           { min-width:560px; }
      .brf-table-card      { overflow-x:auto; -webkit-overflow-scrolling:touch; }
    }
  `]
})
export class BranchesComponent implements OnInit {
  private readonly http   = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly auth   = inject(AuthService);
  private readonly API    = `${environment.apiUrl}/branches`;

  // ── State ──────────────────────────────────────────────────────────────────
  branches       = signal<Branch[]>([]);
  loading        = signal(true);
  saving         = signal(false);

  selectedBranch = signal<Branch | null>(null);
  view           = signal<'list' | 'detail'>('list');
  showForm       = signal(false);
  editingBranch  = signal<Branch | null>(null);

  stocks           = signal<BranchStock[]>([]);
  loadingStocks    = signal(false);
  stockSearch      = signal('');
  stockSearchValue = '';
  transferMode     = signal(false);

  editingStock     = signal<StockEditState | null>(null);
  editingStockData: StockEditState = { productId: '', stock: 0, minStock: 0 };

  deleteTarget  = signal<Branch | null>(null);
  formSubmitted = false;

  branchForm: BranchForm = this.emptyBranchForm();

  // ── Geo ────────────────────────────────────────────────────────────────────
  private readonly GEO_API = `${environment.apiUrl}/location`;
  countries        = signal<Country[]>([]);
  departments      = signal<Department[]>([]);
  municipalities   = signal<Municipality[]>([]);
  loadingMunis     = signal(false);
  muniDropdownOpen = signal(false);
  muniSearchText   = signal('');
  private muniSearch$ = new Subject<{ q: string; dept: string }>();

  filteredMunicipalities = computed(() => {
    const text     = this.muniSearchText().toLowerCase().trim();
    const deptCode = this.branchForm.departmentCode;
    return this.municipalities().filter(m =>
      (!deptCode || m.departmentCode === deptCode) &&
      (!text || m.name.toLowerCase().includes(text))
    );
  });

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
    this.loadCountries();
    this.loadDepartments();
    this.muniSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.q === b.q && a.dept === b.dept),
      switchMap(({ q, dept }) => {
        if (q.length < 2) return of([]);
        this.loadingMunis.set(true);
        const params: any = { q, limit: '20' };
        if (dept) params['departmentCode'] = dept;
        return this.http.get<Municipality[]>(`${this.GEO_API}/municipalities/search`, { params });
      }),
    ).subscribe({
      next: d => { this.municipalities.set(d); this.loadingMunis.set(false); },
      error: () => this.loadingMunis.set(false),
    });
  }

  // ── Geo methods ────────────────────────────────────────────────────────────
  private loadCountries() {
    this.http.get<Country[]>(`${this.GEO_API}/countries`).subscribe({
      next: d => this.countries.set(d), error: () => {}
    });
  }

  private loadDepartments(countryCode = 'CO') {
    this.http.get<Department[]>(`${this.GEO_API}/departments`, { params: { countryCode } }).subscribe({
      next: d => this.departments.set(d), error: () => {}
    });
  }

  private loadMunicipalitiesByDept(departmentCode: string) {
    this.http.get<Municipality[]>(`${this.GEO_API}/departments/${departmentCode}/municipalities`).subscribe({
      next: d => this.municipalities.set(d), error: () => {}
    });
  }

  onCountryChange(code: string) {
    this.branchForm.departmentCode = '';
    this.branchForm.cityCode = '';
    this.branchForm.city = '';
    this.branchForm.department = '';
    this.muniSearchText.set('');
    if (code === 'CO') this.loadDepartments('CO');
    else this.departments.set([]);
  }

  onDepartmentChange(deptCode: string) {
    this.branchForm.cityCode = '';
    this.branchForm.city = '';
    this.muniSearchText.set('');
    if (deptCode) this.loadMunicipalitiesByDept(deptCode);
  }

  onMuniInput(q: string) {
    this.muniSearchText.set(q);
    this.muniDropdownOpen.set(true);
    this.muniSearch$.next({ q, dept: this.branchForm.departmentCode });
  }

  onMuniSelect(m: Municipality) {
    this.branchForm.cityCode       = m.code;
    this.branchForm.departmentCode = m.departmentCode;
    this.branchForm.city           = m.name;
    this.branchForm.department     = m.department?.name ?? '';
    this.muniSearchText.set(m.name);
    this.muniDropdownOpen.set(false);
  }

  // ── Load branches ──────────────────────────────────────────────────────────
  loadBranches(): void {
    this.loading.set(true);
    this.http.get<any>(`${this.API}`).subscribe({
      next: res => { this.branches.set(res.data ?? res); this.loading.set(false); },
      error: ()  => { this.notify.error('Error al cargar sucursales'); this.loading.set(false); },
    });
  }

  // ── Branch form ────────────────────────────────────────────────────────────
  private emptyBranchForm(): BranchForm {
    return { name:'', address:'', city:'', department:'', phone:'', email:'', isMain:false, cityCode:'', departmentCode:'', country:'CO' };
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
      name:           branch.name,
      address:        branch.address        ?? '',
      city:           branch.city           ?? '',
      department:     branch.department     ?? '',
      phone:          branch.phone          ?? '',
      email:          branch.email          ?? '',
      isMain:         branch.isMain,
      cityCode:       (branch as any).cityCode        ?? '',
      departmentCode: (branch as any).departmentCode  ?? '',
      country:        (branch as any).country         ?? 'CO',
    };
    if ((branch as any).departmentCode) this.loadMunicipalitiesByDept((branch as any).departmentCode);
    this.muniSearchText.set(branch.city ?? '');
    this.formSubmitted = false;
    this.showForm.set(true);
  }

  saveBranch(): void {
    this.formSubmitted = true;
    if (!this.branchForm.name.trim()) return;
    this.saving.set(true);
    const editing = this.editingBranch();
    const req$ = editing
      ? this.http.patch<any>(`${this.API}/${editing.id}`, this.branchForm)
      : this.http.post<any>(`${this.API}`, this.branchForm);
    req$.subscribe({
      next: () => {
        this.notify.success(editing ? 'Sucursal actualizada' : 'Sucursal creada exitosamente');
        this.saving.set(false); this.showForm.set(false); this.loadBranches();
      },
      error: err => { this.notify.error(err?.error?.message ?? 'Error al guardar sucursal'); this.saving.set(false); },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  confirmDelete(branch: Branch) { this.deleteTarget.set(branch); }

  doDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.saving.set(true);
    this.http.delete<any>(`${this.API}/${target.id}`).subscribe({
      next: () => {
        this.notify.success('Sucursal eliminada');
        this.saving.set(false); this.deleteTarget.set(null); this.loadBranches();
      },
      error: err => { this.notify.error(err?.error?.message ?? 'Error al eliminar'); this.saving.set(false); },
    });
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  toggleActive(branch: Branch): void {
    this.http.patch<any>(`${this.API}/${branch.id}/toggle-active`, {}).subscribe({
      next: () => { this.notify.success(branch.isActive ? 'Sucursal desactivada' : 'Sucursal activada'); this.loadBranches(); },
      error: err => this.notify.error(err?.error?.message ?? 'Error al cambiar estado'),
    });
  }

  // ── Detail / Stocks ────────────────────────────────────────────────────────
  selectBranch(branch: Branch): void {
    this.selectedBranch.set(branch);
    this.stockSearch.set(''); this.stockSearchValue = '';
    this.transferMode.set(false); this.editingStock.set(null);
    this.view.set('detail');
    this.loadStocks(branch.id);
  }

  goBack(): void {
    this.view.set('list'); this.selectedBranch.set(null);
    this.stocks.set([]); this.transferMode.set(false); this.editingStock.set(null);
  }

  loadStocks(branchId: string): void {
    this.loadingStocks.set(true);
    this.http.get<any>(`${this.API}/${branchId}/stocks`).subscribe({
      next: res => { this.stocks.set(res.data ?? res); this.loadingStocks.set(false); },
      error: ()  => { this.notify.error('Error al cargar inventario'); this.loadingStocks.set(false); },
    });
  }

  initializeInventory(branchId: string): void {
    this.saving.set(true);
    this.http.post<any>(`${this.API}/${branchId}/stocks/initialize`, {}).subscribe({
      next: () => { this.notify.success('Inventario inicializado'); this.saving.set(false); this.loadStocks(branchId); },
      error: err => { this.notify.error(err?.error?.message ?? 'Error al inicializar'); this.saving.set(false); },
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
        this.saving.set(false); this.editingStock.set(null); this.loadStocks(branch.id);
      },
      error: err => { this.notify.error(err?.error?.message ?? 'Error al actualizar stock'); this.saving.set(false); },
    });
  }

  // ── Transfer ───────────────────────────────────────────────────────────────
  doTransfer(): void {
    const branch = this.selectedBranch();
    if (!branch || !this.transferForm.targetBranchId || !this.transferForm.productId || !this.transferForm.quantity) return;
    this.saving.set(true);
    this.http.post<any>(`${this.API}/${branch.id}/stocks/transfer`, {
      targetBranchId: this.transferForm.targetBranchId,
      productId:      this.transferForm.productId,
      quantity:       this.transferForm.quantity,
    }).subscribe({
      next: () => {
        this.notify.success('Transferencia realizada exitosamente');
        this.saving.set(false); this.transferMode.set(false);
        this.transferForm = { targetBranchId:'', productId:'', quantity:null };
        this.loadStocks(branch.id);
      },
      error: err => { this.notify.error(err?.error?.message ?? 'Error al transferir'); this.saving.set(false); },
    });
  }

  nonEmpty = (v: any) => Boolean(v);
}