import {
  Component, OnInit, OnDestroy, signal, computed, inject,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { PosApiService, CartItem, PosSession, PosSale } from './pos.service';

interface Product {
  id: string; name: string; sku: string; price: number;
  taxRate: number; taxType: string; stock: number; unit: string; minStock?: number;
}
interface Customer {
  id: string; name: string; documentNumber: string; documentType: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
<div class="pos-root">

  <!-- ═══ SESSION BAR ═══ -->
  @if (activeSession()) {
    <div class="session-bar">
      <div class="session-left">
        <div class="session-live">
          <span class="live-dot"></span>
          <span class="live-label">CAJA ABIERTA</span>
        </div>
        <span class="sb-divider"></span>
        <span class="sb-cashier">
          <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z"/></svg>
          {{ activeSession()?.user?.firstName }} {{ activeSession()?.user?.lastName }}
        </span>
        <span class="sb-divider"></span>
        <div class="sb-stats">
          <div class="sb-stat">
            <span class="sb-stat-lbl">Apertura</span>
            <span class="sb-stat-val">{{ fmtCOP(activeSession()!.initialCash) }}</span>
          </div>
          <div class="sb-stat accent">
            <span class="sb-stat-lbl">Ventas hoy</span>
            <span class="sb-stat-val">{{ fmtCOP(activeSession()!.totalSales) }}</span>
          </div>
          <div class="sb-stat">
            <span class="sb-stat-lbl">Transacciones</span>
            <span class="sb-stat-val">{{ activeSession()!.totalTransactions }}</span>
          </div>
        </div>
      </div>
      <div class="session-actions">
        <button class="sb-btn" (click)="toggleHistory()">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4zm3 3a1 1 0 112 0v4a1 1 0 11-2 0V5z" clip-rule="evenodd"/></svg>
          Historial
        </button>
        <button class="sb-btn danger" (click)="loadSessionSummary(); showCloseSessionModal.set(true)">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M10 12.5a.5.5 0 01-.5.5h-8a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5h8a.5.5 0 01.5.5v2a.5.5 0 001 0v-2A1.5 1.5 0 009.5 2h-8A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h8a1.5 1.5 0 001.5-1.5v-2a.5.5 0 00-1 0v2z"/><path fill-rule="evenodd" d="M15.854 8.354a.5.5 0 000-.708l-3-3a.5.5 0 00-.708.708L14.293 7.5H5.5a.5.5 0 000 1h8.793l-2.147 2.146a.5.5 0 00.708.708l3-3z"/></svg>
          Cerrar Caja
        </button>
      </div>
    </div>
  }

  <!-- ═══ NO SESSION ═══ -->
  @if (!activeSession() && !loadingSession()) {
    <div class="no-session">
      <div class="no-session-card">
        <div class="no-session-glow"></div>
        <div class="no-session-icon">
          <svg viewBox="0 0 64 64" fill="none" width="40" height="40">
            <rect x="8" y="20" width="48" height="32" rx="5" stroke="#00c6a0" stroke-width="2.5"/>
            <path d="M20 20V15a12 12 0 1124 0v5" stroke="#00c6a0" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="32" cy="36" r="4" fill="#00c6a0"/>
            <path d="M32 40v6" stroke="#00c6a0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="no-session-text">
          <h2>Punto de Venta</h2>
          <p>Registra el efectivo inicial para comenzar tu sesión de ventas.</p>
        </div>
        <button class="btn-open-session" (click)="showOpenSessionModal.set(true)">
          <svg viewBox="0 0 16 16" fill="currentColor" width="15"><path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/></svg>
          Abrir Caja
        </button>
      </div>
    </div>
  }

  <!-- ═══ POS LAYOUT ═══ -->
  @if (activeSession() && !showHistory()) {
    <div class="pos-layout">

      <!-- ── LEFT: Products panel ─────────────────────────── -->
      <div class="products-panel">

        <!-- Toolbar -->
        <div class="panel-toolbar">
          <div class="toolbar-search">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" class="ts-icon"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
            <input type="text" placeholder="Buscar por nombre o SKU..." [(ngModel)]="productSearch"
                   (input)="onProductSearch()" class="ts-input" />
            @if (productSearch) {
              <button class="ts-clear" (click)="productSearch=''; loadProducts()">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            }
          </div>
          <div class="toolbar-right">
            <span class="products-counter">
              <span class="pc-num">{{ products().length }}</span> productos
            </span>
          </div>
        </div>

        <!-- Grid -->
        @if (loadingProducts()) {
          <div class="panel-placeholder">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="product-skeleton"></div>
            }
          </div>
        } @else if (products().length === 0) {
          <div class="panel-empty">
            <svg viewBox="0 0 48 48" fill="none" width="44">
              <circle cx="24" cy="24" r="19" stroke="#1e3a5f" stroke-width="2"/>
              <path d="M16 24h16M24 16v16" stroke="#2a5080" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <p>No se encontraron productos</p>
            @if (productSearch) {
              <button class="link-btn" (click)="productSearch=''; loadProducts()">Ver todos</button>
            }
          </div>
        } @else {
          <div class="products-grid">
            @for (p of products(); track p.id) {
              <div class="product-card" [class.out-of-stock]="p.stock <= 0" (click)="addToCart(p)">
                <!-- Stock ribbon -->
                @if (p.stock <= 0) {
                  <div class="pc-ribbon out">Sin stock</div>
                } @else if (p.stock <= (p.minStock ?? 5)) {
                  <div class="pc-ribbon low">Stock bajo</div>
                }

                <div class="pc-content">
                  <div class="pc-header">
                    <span class="pc-sku">{{ p.sku }}</span>
                    <span class="pc-tax-badge">IVA {{ p.taxRate }}%</span>
                  </div>
                  <div class="pc-name">{{ p.name }}</div>
                  <div class="pc-price">{{ fmtCOP(p.price) }}</div>
                  <div class="pc-footer">
                    <span class="pc-stock" [class.low]="p.stock > 0 && p.stock <= (p.minStock ?? 5)">
                      <svg viewBox="0 0 12 12" fill="currentColor" width="9"><path d="M6 1L1 3.5v5L6 11l5-2.5v-5L6 1z"/></svg>
                      {{ p.stock }} {{ p.unit }}
                    </span>
                    <div class="pc-add-btn">
                      <svg viewBox="0 0 12 12" fill="currentColor" width="11"><path d="M6 1a.5.5 0 01.5.5v4h4a.5.5 0 010 1h-4v4a.5.5 0 01-1 0v-4h-4a.5.5 0 010-1h4v-4A.5.5 0 016 1z"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- ── RIGHT: Cart panel ───────────────────────────── -->
      <div class="cart-panel">

        <!-- Cart header -->
        <div class="cart-header">
          <div class="cart-header-left">
            <svg viewBox="0 0 20 20" fill="currentColor" width="15" class="cart-icon">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
              <circle cx="6.5" cy="17.5" r="1.5"/><circle cx="14.5" cy="17.5" r="1.5"/>
            </svg>
            <span class="cart-title-text">Venta actual</span>
            @if (cart().length > 0) {
              <span class="cart-count-badge">{{ cart().length }}</span>
            }
          </div>
          @if (cart().length > 0) {
            <button class="cart-clear-btn" (click)="clearCart()">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1z"/></svg>
              Limpiar
            </button>
          }
        </div>

        <!-- Customer picker -->
        <div class="customer-zone">
          @if (!selectedCustomer()) {
            <div class="cust-search-wrap">
              <div class="cust-field" [class.focused]="showCustomerDropdown()">
                <svg viewBox="0 0 16 16" fill="currentColor" width="13" class="cust-field-icon">
                  <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z"/>
                </svg>
                <input type="text" class="cust-input"
                       placeholder="Cliente (opcional)..."
                       [(ngModel)]="customerSearchTerm"
                       (input)="onCustomerSearch()"
                       (focus)="showCustomerDropdown.set(true)"
                       autocomplete="off" />
                @if (customerSearchTerm) {
                  <button class="cust-clear" (click)="clearCustomerSearch()">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                  </button>
                }
              </div>
              @if (showCustomerDropdown() && (customerResults().length > 0 || loadingCustomers())) {
                <div class="cust-dropdown">
                  @if (loadingCustomers()) {
                    <div class="cust-dd-loading"><div class="spinner-xs"></div> Buscando...</div>
                  }
                  @for (c of customerResults(); track c.id) {
                    <div class="cust-dd-item" (click)="selectCustomer(c)">
                      <div class="cdi-avatar">{{ customerInitials(c) }}</div>
                      <div>
                        <div class="cdi-name">{{ c.name }}</div>
                        <div class="cdi-doc">{{ c.documentType }}: {{ c.documentNumber }}</div>
                      </div>
                    </div>
                  }
                  @if (!loadingCustomers() && customerResults().length === 0 && customerSearchTerm.length >= 2) {
                    <div class="cust-dd-empty">Sin resultados para "{{ customerSearchTerm }}"</div>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="cust-selected">
              <div class="cs-avatar">{{ customerInitials(selectedCustomer()!) }}</div>
              <div class="cs-info">
                <span class="cs-name">{{ selectedCustomer()!.name }}</span>
                <span class="cs-doc">{{ selectedCustomer()!.documentType }}: {{ selectedCustomer()!.documentNumber }}</span>
              </div>
              <button class="cs-remove" (click)="clearSelectedCustomer()" title="Quitar cliente">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>
          }
        </div>

        <!-- SKU / barcode search -->
        <div class="sku-search-zone">
          <div class="sku-field">
            <svg viewBox="0 0 20 20" fill="currentColor" width="12" class="sku-icon"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm5-8a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1z"/></svg>
            <input type="text" class="sku-input" placeholder="SKU / código de barras"
                   [(ngModel)]="skuSearch" (keyup.enter)="onSkuSearch()" />
          </div>
          <button class="btn-free-item" (click)="showFreeItemForm.set(!showFreeItemForm())">
            + Ítem libre
          </button>
        </div>

        <!-- Free item form -->
        @if (showFreeItemForm()) {
          <div class="free-item-form">
            <div class="fi-row">
              <input type="text" class="fi-input fi-desc" placeholder="Descripción" [(ngModel)]="freeItemName" />
            </div>
            <div class="fi-row">
              <input type="number" class="fi-input" placeholder="Precio" [(ngModel)]="freeItemPrice" min="0" />
              <input type="number" class="fi-input fi-tax" placeholder="IVA%" [(ngModel)]="freeItemTax" min="0" max="100" />
              <button class="fi-add-btn" (click)="addFreeItem()">Agregar</button>
            </div>
          </div>
        }

        <!-- Cart items -->
        <div class="cart-items">
          @if (cart().length === 0) {
            <div class="cart-empty">
              <div class="ce-icon">
                <svg viewBox="0 0 48 48" fill="none" width="32">
                  <path d="M10 12h28l-3 18H13L10 12z" stroke="#1e3a5f" stroke-width="2.5"/>
                  <circle cx="17" cy="37" r="2.5" fill="#1e3a5f"/>
                  <circle cx="31" cy="37" r="2.5" fill="#1e3a5f"/>
                  <path d="M6 8h4l4 22" stroke="#1e3a5f" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </div>
              <p>Selecciona productos del catálogo</p>
            </div>
          }
          @for (item of cart(); track $index; let i = $index) {
            <div class="cart-item">
              <div class="ci-top">
                <span class="ci-name">{{ item.description }}</span>
                <button class="ci-remove" (click)="removeFromCart(i)">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                </button>
              </div>
              <div class="ci-meta">
                @if (item.sku) { <span class="ci-sku">{{ item.sku }}</span> }
                <span class="ci-unit-price">{{ fmtCOP(item.unitPrice) }}/u</span>
                @if (item.taxRate > 0) { <span class="ci-tax-chip">IVA {{ item.taxRate }}%</span> }
              </div>
              <div class="ci-bottom">
                <div class="qty-control">
                  <button class="qty-btn" (click)="decrementQty(i)" [disabled]="item.quantity <= 1">−</button>
                  <span class="qty-display">{{ item.quantity }}</span>
                  <button class="qty-btn" (click)="incrementQty(i)">+</button>
                </div>
                <span class="ci-line-total">{{ fmtCOP(item.total) }}</span>
              </div>
            </div>
          }
        </div>

        <!-- Totals -->
        <div class="cart-totals">
          <div class="ct-row"><span>Subtotal</span><span>{{ fmtCOP(cartSubtotal()) }}</span></div>
          <div class="ct-row"><span>IVA</span><span>{{ fmtCOP(cartTax()) }}</span></div>
          <div class="ct-row ct-disc-input">
            <label class="ct-disc-label">Descuento %</label>
            <input type="number" class="ct-disc-field" [(ngModel)]="discountPctProxy"
                   min="0" max="100" step="1" placeholder="0" />
          </div>
          @if (cartDiscountPct() > 0) {
            <div class="ct-row ct-disc">
              <span>Descuento ({{ cartDiscountPct() }}%)</span>
              <span class="disc-val">-{{ fmtCOP(cartDiscountAmount()) }}</span>
            </div>
          }
          <div class="ct-grand">
            <span>TOTAL</span>
            <span class="ct-grand-amount">{{ fmtCOP(cartTotal()) }}</span>
          </div>
        </div>

        <!-- Invoice toggle -->
        @if (selectedCustomer()) {
          <div class="invoice-toggle" [class.active]="generateInvoice()" (click)="generateInvoice.set(!generateInvoice())">
            <div class="it-checkbox" [class.checked]="generateInvoice()">
              @if (generateInvoice()) {
                <svg viewBox="0 0 12 12" fill="none" width="10"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              }
            </div>
            <div class="it-text">
              <span class="it-main">Generar factura electrónica</span>
              <span class="it-sub">Se vinculará a esta venta automáticamente</span>
            </div>
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" class="it-doc-icon"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
          </div>
        }

        <!-- Payment method -->
        <div class="payment-section">
          <div class="ps-label">Método de pago</div>
          <div class="pm-grid">
            @for (m of paymentMethods; track m.value) {
              <button class="pm-btn" [class.pm-active]="selectedPaymentMethod() === m.value"
                      (click)="selectedPaymentMethod.set(m.value)">
                <span class="pm-icon">{{ m.emoji }}</span>
                <span class="pm-name">{{ m.label }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Charge button -->
        <div class="charge-wrap">
          <button class="btn-charge" [disabled]="cart().length === 0 || processing()"
                  (click)="openPaymentModal()">
            @if (processing()) {
              <span class="spinner-sm"></span>
              Procesando...
            } @else {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                <path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/>
              </svg>
              Cobrar {{ fmtCOP(cartTotal()) }}
            }
          </button>
        </div>

      </div><!-- /cart-panel -->
    </div><!-- /pos-layout -->
  }

  <!-- ═══ HISTORY VIEW ═══ -->
  @if (activeSession() && showHistory()) {
    <div class="history-view">
      <div class="hv-toolbar">
        <div class="hv-left">
          <button class="btn-back" (click)="showHistory.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 010 .708L5.707 8l5.647 5.646a.5.5 0 01-.708.708l-6-6a.5.5 0 010-.708l6-6a.5.5 0 01.708 0z"/></svg>
            Volver al POS
          </button>
          <div class="hv-title">Ventas de la sesión</div>
        </div>
        <div class="hv-right">
          <div class="hv-stat-pill">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fill-rule="evenodd" d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0zM8 2a6 6 0 100 12A6 6 0 008 2z"/></svg>
            {{ sessionSales().length }} ventas
          </div>
          <div class="hv-stat-pill green">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M8.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L2.324 8.384a.75.75 0 111.06-1.06l2.094 2.093L8.95 4.992a.25.25 0 01.02-.022zm-.92 5.14l.92.92a.75.75 0 001.079-.02l3.992-4.99a.75.75 0 10-1.091-1.028L9.477 9.417l-.485-.486-.943 1.179z"/></svg>
            {{ fmtCOP(sessionTotal()) }}
          </div>
        </div>
      </div>

      @if (loadingHistory()) {
        <div class="hv-loading"><div class="spinner"></div></div>
      } @else {
        <div class="hv-table-wrap">
          <table class="sales-table">
            <thead>
              <tr>
                <th>Nro.</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th class="tc">Ítems</th>
                <th>Método</th>
                <th class="tr">Total</th>
                <th class="tc">Estado</th>
                <th class="tc">Factura</th>
                <th class="tc">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (sale of sessionSales(); track sale.id) {
                <tr [class.row-cancelled]="sale.status === 'CANCELLED'">
                  <td><strong class="sale-number">{{ sale.saleNumber }}</strong></td>
                  <td class="td-muted">{{ sale.createdAt | date:'HH:mm' }}</td>
                  <td>
                    @if (sale.customer) {
                      <div class="td-customer">
                        <div class="tdc-avatar">{{ customerInitials(sale.customer) }}</div>
                        <span>{{ sale.customer.name }}</span>
                      </div>
                    } @else {
                      <span class="td-muted">Ocasional</span>
                    }
                  </td>
                  <td class="tc td-muted">{{ sale.items.length }}</td>
                  <td>
                    <span class="pm-chip pm-{{ sale.paymentMethod.toLowerCase() }}">
                      {{ getPaymentLabel(sale.paymentMethod) }}
                    </span>
                  </td>
                  <td class="tr"><strong class="td-total">{{ fmtCOP(sale.total) }}</strong></td>
                  <td class="tc">
                    <span class="status-chip status-{{ sale.status.toLowerCase() }}">{{ getStatusLabel(sale.status) }}</span>
                  </td>
                  <td class="tc">
                    @if (sale.invoiceId) {
                      <span class="inv-chip">
                        <svg viewBox="0 0 12 12" fill="currentColor" width="9"><path fill-rule="evenodd" d="M10 6a4 4 0 11-8 0 4 4 0 018 0zm-3.78-1.28a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.06 0l2.5-2.5a.75.75 0 00-1.06-1.06L6.25 5.69l-.97-.97z"/></svg>
                        Vinculada
                      </span>
                    } @else if (sale.status === 'COMPLETED' && sale.customer) {
                      <button class="link-btn" (click)="generateInvoiceForSale(sale)">Generar</button>
                    } @else {
                      <span class="td-dash">—</span>
                    }
                  </td>
                  <td class="tc">
                    <div class="td-actions">
                      <button class="tda-btn" (click)="printReceipt(sale.id)" title="Imprimir tirilla">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M2.5 8a.5.5 0 100-1 .5.5 0 000 1z"/><path d="M5 1a2 2 0 00-2 2v2H2a2 2 0 00-2 2v3a2 2 0 002 2h1v1a2 2 0 002 2h6a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H5zM4 3a1 1 0 011-1h6a1 1 0 011 1v2H4V3zm1 5a2 2 0 00-2 2v1H2a1 1 0 01-1-1V7a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1h-1v-1a2 2 0 00-2-2H5zm7 2v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3a1 1 0 011-1h6a1 1 0 011 1z"/></svg>
                      </button>
                      @if (sale.status === 'COMPLETED') {
                        <button class="tda-btn danger" (click)="cancelSale(sale.id)" title="Cancelar venta">
                          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
              @empty {
                <tr><td colspan="9" class="td-empty">No hay ventas en esta sesión</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  }

  <!-- ═══════════════════════════════════════
       MODALS
  ═══════════════════════════════════════ -->

  <!-- Open Session -->
  @if (showOpenSessionModal()) {
    <div class="overlay" (click)="showOpenSessionModal.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/></svg>
          </div>
          <div>
            <div class="modal-title">Abrir Caja</div>
            <div class="modal-subtitle">Registra el efectivo inicial para comenzar</div>
          </div>
          <button class="modal-close-btn" (click)="showOpenSessionModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="field-group">
            <label>Efectivo inicial (COP)</label>
            <input type="number" [(ngModel)]="openSessionCash" min="0" step="1000" class="field-input big-input" placeholder="0"/>
          </div>
          <div class="field-group">
            <label>Notas (opcional)</label>
            <textarea [(ngModel)]="openSessionNotes" rows="2" class="field-input" placeholder="Ej: Turno mañana..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showOpenSessionModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri" (click)="openSession()" [disabled]="processing()">
            @if (processing()) { <span class="spinner-sm"></span> }
            Abrir Caja
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Close Session -->
  @if (showCloseSessionModal()) {
    <div class="overlay" (click)="showCloseSessionModal.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon red">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/></svg>
          </div>
          <div>
            <div class="modal-title">Cerrar Caja</div>
            <div class="modal-subtitle">Resumen de la sesión actual</div>
          </div>
          <button class="modal-close-btn" (click)="showCloseSessionModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="session-summary">
            <div class="ss-item">
              <span>Apertura</span>
              <strong>{{ fmtCOP(activeSession()?.initialCash) }}</strong>
            </div>
            <div class="ss-item">
              <span>Total vendido</span>
              <strong class="ss-green">{{ fmtCOP(activeSession()?.totalSales) }}</strong>
            </div>
            <div class="ss-item">
              <span>Transacciones</span>
              <strong>{{ activeSession()?.totalTransactions }}</strong>
            </div>
          </div>
          @if (sessionSummary()) {
            <div class="ssb-payment-breakdown">
              <div class="ssb-divider"></div>
              <div class="ssb-row">
                <span>Efectivo</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.CASH?.total ?? 0) }}</strong>
              </div>
              <div class="ssb-row">
                <span>Tarjeta</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.CARD?.total ?? 0) }}</strong>
              </div>
              <div class="ssb-row">
                <span>Transferencia</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.TRANSFER?.total ?? 0) }}</strong>
              </div>
            </div>
          }
          <div class="field-group">
            <label>Efectivo final en caja (COP)</label>
            <input type="number" [(ngModel)]="closeSessionCash" min="0" step="1000" class="field-input big-input" placeholder="0"/>
          </div>
          <div class="field-group">
            <label>Notas del cierre (opcional)</label>
            <textarea [(ngModel)]="closeSessionNotes" rows="2" class="field-input"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showCloseSessionModal.set(false)">Cancelar</button>
          <button class="btn-modal-danger" (click)="closeSession()" [disabled]="processing()">
            @if (processing()) { <span class="spinner-sm"></span> }
            Cerrar Caja
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Payment Modal -->
  @if (showPaymentModal()) {
    <div class="overlay" (click)="showPaymentModal.set(false)">
      <div class="modal modal-pay" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
          </div>
          <div>
            <div class="modal-title">Confirmar Cobro</div>
            <div class="modal-subtitle pm-badge pm-{{ selectedPaymentMethod().toLowerCase() }}">{{ getPaymentLabel(selectedPaymentMethod()) }}</div>
          </div>
          <button class="modal-close-btn" (click)="showPaymentModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Big total display -->
          <div class="pay-total-display">
            <span class="ptd-label">Total a cobrar</span>
            <span class="ptd-amount">{{ fmtCOP(cartTotal()) }}</span>
          </div>

          <!-- Amount received -->
          <div class="field-group">
            <label>{{ selectedPaymentMethod() === 'CASH' ? 'Monto recibido del cliente' : 'Monto recibido' }} (COP)</label>
            <input type="number" [ngModel]="amountPaid()"
                   (ngModelChange)="amountPaid.set($event)"
                   min="0" step="1000" class="field-input pay-amount-input"
                   placeholder="0" />
          </div>

          <!-- Change (only for cash) -->
          @if (selectedPaymentMethod() === 'CASH') {
            <div class="change-row" [class.change-ok]="changeAmount() >= 0">
              <span>Cambio a entregar</span>
              <strong>{{ fmtCOP(changeAmount()) }}</strong>
            </div>
          }

          <!-- Invoice notice -->
          @if (selectedCustomer() && generateInvoice()) {
            <div class="pay-invoice-notice">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
              Se generará una factura electrónica DRAFT para <strong>{{ selectedCustomer()!.name }}</strong>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showPaymentModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri btn-modal-lg" (click)="processSale()" [disabled]="processing() || !isPaymentValid()">
            @if (processing()) {
              <span class="spinner-sm"></span> Procesando...
            } @else {
              <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
              Confirmar Venta
            }
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Sale Success Modal -->
  @if (completedSale()) {
    <div class="overlay">
      <div class="modal modal-success" (click)="$event.stopPropagation()">
        <div class="success-ring">
          <svg viewBox="0 0 80 80" fill="none" width="80">
            <circle cx="40" cy="40" r="36" stroke="rgba(0,198,160,0.2)" stroke-width="2"/>
            <circle cx="40" cy="40" r="28" stroke="#00c6a0" stroke-width="2" stroke-dasharray="176" stroke-dashoffset="44" stroke-linecap="round"/>
            <path d="M26 40l10 10 18-18" stroke="#00c6a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="success-title">¡Venta Registrada!</div>
        <div class="success-sale-num">{{ completedSale()!.saleNumber }}</div>

        <div class="success-amounts">
          <div class="sa-row"><span>Total cobrado</span><strong>{{ fmtCOP(completedSale()!.total) }}</strong></div>
          <div class="sa-row"><span>Recibido</span><strong>{{ fmtCOP(completedSale()!.amountPaid) }}</strong></div>
          <div class="sa-row sa-change"><span>Cambio</span><strong>{{ fmtCOP(completedSale()!.change) }}</strong></div>
        </div>

        @if (completedSale()!.invoice) {
          <div class="success-inv-badge">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"/></svg>
            Factura {{ completedSale()!.invoice!.invoiceNumber }} generada
          </div>
        }

        <div class="success-actions">
          <button class="sa-btn" (click)="printReceipt(completedSale()!.id)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M2.5 8a.5.5 0 100-1 .5.5 0 000 1z"/><path d="M5 1a2 2 0 00-2 2v2H2a2 2 0 00-2 2v3a2 2 0 002 2h1v1a2 2 0 002 2h6a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H5z"/></svg>
            Imprimir
          </button>
          @if (!completedSale()!.invoiceId && completedSale()!.customer) {
            <button class="sa-btn" (click)="generateInvoiceForSale(completedSale()!)">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
              Factura
            </button>
          }
          <button class="sa-btn-primary" (click)="completedSale.set(null)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/></svg>
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  }

</div>
  `,
  styles: [`
    :host { display:block; height:100%; overflow:hidden; }

    /* ═══════════════════════════════════════
       ROOT
    ═══════════════════════════════════════ */
    .pos-root {
      display:flex; flex-direction:column; height:100%;
      background:#f8fafc;
      overflow:hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* ═══════════════════════════════════════
       SESSION BAR
    ═══════════════════════════════════════ */
    .session-bar {
      display:flex; align-items:center; justify-content:space-between;
      padding:0 20px; height:46px;
      background:#fff;
      border-bottom:1px solid #dce6f0;
      flex-shrink:0; gap:16px;
    }
    .session-left { display:flex; align-items:center; gap:14px; min-width:0; }
    .session-live { display:flex; align-items:center; gap:7px; }
    .live-dot {
      width:7px; height:7px; border-radius:50%;
      background:#10b981;
      box-shadow:0 0 0 3px rgba(16,185,129,.15);
      animation:pulse 2s ease infinite;
    }
    @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.15)} 50%{box-shadow:0 0 0 5px rgba(16,185,129,.08)} }
    .live-label { font-size:10px; font-weight:800; letter-spacing:.1em; color:#059669; }
    .sb-divider { width:1px; height:18px; background:#dce6f0; flex-shrink:0; }
    .sb-cashier { display:flex; align-items:center; gap:5px; font-size:12px; color:#374151; }
    .sb-stats { display:flex; align-items:center; gap:20px; }
    .sb-stat { display:flex; flex-direction:column; gap:1px; }
    .sb-stat-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; }
    .sb-stat-val { font-size:12px; font-weight:700; color:#374151; }
    .sb-stat.accent .sb-stat-val { color:#059669; }
    .session-actions { display:flex; gap:7px; flex-shrink:0; }
    .sb-btn {
      display:flex; align-items:center; gap:5px; padding:5px 12px;
      border-radius:7px; font-size:11.5px; font-weight:600; cursor:pointer;
      background:#fff; border:1px solid #dce6f0;
      color:#374151; transition:all .14s;
    }
    .sb-btn:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .sb-btn.danger { background:#fff5f5; border-color:#fecaca; color:#dc2626; }
    .sb-btn.danger:hover { background:#fee2e2; }

    /* ═══════════════════════════════════════
       NO SESSION
    ═══════════════════════════════════════ */
    .no-session { flex:1; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
    .no-session-card {
      position:relative; overflow:hidden;
      background:#fff;
      border:1px solid #dce6f0;
      border-radius:24px; padding:52px 48px;
      text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px;
      max-width:420px;
      box-shadow:0 20px 60px rgba(12,28,53,.1);
    }
    .no-session-glow {
      position:absolute; top:-40px; left:50%; transform:translateX(-50%);
      width:200px; height:200px; border-radius:50%;
      background:radial-gradient(circle, rgba(16,185,129,.06) 0%, transparent 70%);
      pointer-events:none;
    }
    .no-session-icon {
      width:88px; height:88px; border-radius:22px;
      background:#f0fdf4; border:1px solid #bbf7d0;
      display:flex; align-items:center; justify-content:center;
    }
    .no-session-text h2 { color:#0c1c35; font-size:22px; font-weight:800; margin:0 0 8px; font-family:'Sora',sans-serif; }
    .no-session-text p { color:#9ca3af; font-size:14px; margin:0; line-height:1.55; }
    .btn-open-session {
      display:inline-flex; align-items:center; gap:8px; padding:13px 28px;
      border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; border:none;
      background:linear-gradient(135deg, #1a407e, #2563eb);
      color:#fff; margin-top:6px;
      box-shadow:0 6px 24px rgba(26,64,126,.22);
      transition:all .16s;
    }
    .btn-open-session:hover { transform:translateY(-2px); box-shadow:0 10px 32px rgba(26,64,126,.3); }

    /* ═══════════════════════════════════════
       POS LAYOUT
    ═══════════════════════════════════════ */
    .pos-layout { display:flex; flex:1; overflow:hidden; }

    /* ══ Products Panel ══ */
    .products-panel {
      flex:1; display:flex; flex-direction:column; overflow:hidden;
      background:#f8fafc;
      border-right:1px solid #dce6f0;
    }

    .panel-toolbar {
      display:flex; align-items:center; gap:12px; padding:12px 16px;
      border-bottom:1px solid #dce6f0; flex-shrink:0;
      background:#fff;
    }
    .toolbar-search {
      flex:1; display:flex; align-items:center; gap:8px;
      background:#fff; border:1px solid #dce6f0;
      border-radius:10px; padding:9px 13px; transition:all .15s;
    }
    .toolbar-search:focus-within { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .ts-icon { color:#9ca3af; flex-shrink:0; }
    .ts-input { flex:1; background:none; border:none; outline:none; color:#374151; font-size:13px; }
    .ts-input::placeholder { color:#9ca3af; }
    .ts-clear { background:none; border:none; color:#9ca3af; cursor:pointer; display:flex; align-items:center; padding:1px; transition:color .12s; }
    .ts-clear:hover { color:#374151; }
    .toolbar-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
    .products-counter { font-size:11px; color:#9ca3af; white-space:nowrap; }
    .pc-num { color:#1a407e; font-weight:700; }

    /* Skeleton */
    .panel-placeholder { flex:1; display:grid; grid-template-columns:repeat(auto-fill,minmax(158px,1fr)); gap:10px; padding:14px; align-content:start; overflow:hidden; }
    .product-skeleton { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef5 50%,#f0f4f8 75%); background-size:200% 100%; animation:sk 1.5s infinite; border-radius:12px; height:132px; }
    @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    .panel-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#9ca3af; font-size:13px; }
    .link-btn { background:none; border:none; color:#1a407e; font-size:12.5px; cursor:pointer; text-decoration:underline; padding:0; }

    /* Products grid */
    .products-grid {
      flex:1; overflow-y:auto; padding:14px;
      display:grid; grid-template-columns:repeat(auto-fill,minmax(158px,1fr)); gap:10px; align-content:start;
    }
    .products-grid::-webkit-scrollbar { width:4px; }
    .products-grid::-webkit-scrollbar-thumb { background:#dce6f0; border-radius:2px; }

    .product-card {
      background:#fff;
      border:1px solid #dce6f0;
      border-radius:12px; overflow:hidden; cursor:pointer; position:relative;
      transition:all .16s ease;
    }
    .product-card:not(.out-of-stock):hover {
      border-color:#93c5fd;
      transform:translateY(-3px);
      box-shadow:0 4px 12px rgba(26,64,126,.08);
    }
    .product-card.out-of-stock { opacity:.45; cursor:not-allowed; filter:grayscale(.4); }

    /* Ribbon */
    .pc-ribbon {
      position:absolute; top:0; right:0;
      font-size:9px; font-weight:800; padding:3px 8px 3px 12px;
      border-radius:0 12px 0 10px; letter-spacing:.04em;
    }
    .pc-ribbon.out { background:#fee2e2; color:#dc2626; border-left:1px solid #fecaca; border-bottom:1px solid #fecaca; }
    .pc-ribbon.low { background:#fef3c7; color:#92400e; border-left:1px solid #fde68a; border-bottom:1px solid #fde68a; }

    .pc-content { padding:12px; }
    .pc-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; }
    .pc-sku { font-size:9.5px; color:#9ca3af; font-family:monospace; }
    .pc-tax-badge { font-size:9px; padding:1px 6px; border-radius:4px; background:#dbeafe; color:#1e40af; font-weight:600; }
    .pc-name { font-size:12.5px; font-weight:600; color:#374151; line-height:1.35; margin-bottom:7px; min-height:34px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .pc-price { font-size:16px; font-weight:800; color:#1a407e; margin-bottom:8px; letter-spacing:-.3px; }
    .pc-footer { display:flex; align-items:center; justify-content:space-between; }
    .pc-stock { display:flex; align-items:center; gap:3px; font-size:10px; color:#059669; }
    .pc-stock.low { color:#d97706; }
    .pc-add-btn {
      width:22px; height:22px; border-radius:7px;
      background:#dbeafe; color:#1e40af;
      display:flex; align-items:center; justify-content:center;
      transition:all .15s;
    }
    .product-card:not(.out-of-stock):hover .pc-add-btn { background:#1a407e; color:#fff; }

    /* ══ Cart Panel ══ */
    .cart-panel {
      width:360px; min-width:320px; flex-shrink:0;
      background:#fff; display:flex; flex-direction:column; overflow:hidden;
      border-left:1px solid #dce6f0;
    }

    /* Cart header */
    .cart-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 16px; border-bottom:1px solid #dce6f0; flex-shrink:0;
    }
    .cart-header-left { display:flex; align-items:center; gap:8px; }
    .cart-icon { color:#1a407e; }
    .cart-title-text { font-size:13px; font-weight:700; color:#0c1c35; }
    .cart-count-badge {
      background:#dbeafe; color:#1e40af;
      border:1px solid #bfdbfe;
      border-radius:9999px; font-size:10px; font-weight:700; padding:1px 7px;
    }
    .cart-clear-btn {
      display:flex; align-items:center; gap:5px; padding:4px 10px;
      border-radius:6px; background:#fff5f5; border:1px solid #fecaca;
      color:#dc2626; font-size:11px; cursor:pointer; transition:all .13s;
    }
    .cart-clear-btn:hover { background:#fee2e2; }

    /* Customer zone */
    .customer-zone { padding:10px 14px; border-bottom:1px solid #dce6f0; flex-shrink:0; }
    .cust-search-wrap { position:relative; }
    .cust-field {
      display:flex; align-items:center; gap:8px;
      background:#fff; border:1px solid #dce6f0;
      border-radius:9px; padding:8px 12px; transition:all .14s;
    }
    .cust-field.focused, .cust-field:focus-within { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .cust-field-icon { color:#9ca3af; flex-shrink:0; }
    .cust-input { flex:1; background:none; border:none; outline:none; color:#374151; font-size:12.5px; }
    .cust-input::placeholder { color:#9ca3af; }
    .cust-clear { background:none; border:none; color:#9ca3af; cursor:pointer; display:flex; align-items:center; padding:1px; }
    .cust-clear:hover { color:#374151; }
    .cust-dropdown {
      position:absolute; top:calc(100% + 5px); left:0; right:0;
      background:#fff; border:1px solid #dce6f0; border-radius:10px;
      z-index:100; max-height:210px; overflow-y:auto;
      box-shadow:0 12px 32px rgba(12,28,53,.12);
    }
    .cust-dd-loading { display:flex; align-items:center; gap:8px; padding:12px 14px; color:#9ca3af; font-size:12px; }
    .cust-dd-item { display:flex; align-items:center; gap:10px; padding:9px 14px; cursor:pointer; border-bottom:1px solid #f0f4f8; transition:background .12s; }
    .cust-dd-item:last-child { border-bottom:none; }
    .cust-dd-item:hover { background:#fafcff; }
    .cdi-avatar { width:28px; height:28px; border-radius:8px; background:#dbeafe; color:#1e40af; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .cdi-name { font-size:12.5px; font-weight:600; color:#374151; }
    .cdi-doc { font-size:10.5px; color:#9ca3af; margin-top:1px; }
    .cust-dd-empty { padding:12px 14px; color:#9ca3af; font-size:12px; text-align:center; }

    .cust-selected {
      display:flex; align-items:center; gap:9px;
      background:#f0f9ff; border:1px solid #bae6fd;
      border-radius:9px; padding:8px 12px;
    }
    .cs-avatar { width:32px; height:32px; border-radius:9px; background:#dbeafe; color:#1e40af; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .cs-info { flex:1; min-width:0; }
    .cs-name { display:block; font-size:12.5px; font-weight:600; color:#374151; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cs-doc { display:block; font-size:10.5px; color:#9ca3af; margin-top:1px; }
    .cs-remove { background:none; border:none; color:#9ca3af; cursor:pointer; display:flex; align-items:center; padding:4px; border-radius:5px; transition:all .12s; flex-shrink:0; }
    .cs-remove:hover { background:#fee2e2; color:#dc2626; }

    /* Cart items */
    .cart-items { flex:1; overflow-y:auto; padding:8px; min-height:0; }
    .cart-items::-webkit-scrollbar { width:3px; }
    .cart-items::-webkit-scrollbar-thumb { background:#dce6f0; border-radius:2px; }
    .cart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:120px; gap:10px; }
    .ce-icon { opacity:.3; }
    .cart-empty p { color:#9ca3af; font-size:12px; margin:0; }

    .cart-item {
      background:#fff; border:1px solid #dce6f0;
      border-radius:10px; padding:9px 11px; margin-bottom:6px; transition:border-color .13s;
    }
    .cart-item:hover { border-color:#93c5fd; }
    .ci-top { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin-bottom:4px; }
    .ci-name { font-size:12.5px; font-weight:600; color:#374151; line-height:1.3; }
    .ci-remove { background:none; border:none; color:#9ca3af; cursor:pointer; display:flex; align-items:center; padding:2px; border-radius:4px; transition:all .12s; flex-shrink:0; }
    .ci-remove:hover { background:#fee2e2; color:#dc2626; }
    .ci-meta { display:flex; align-items:center; gap:6px; margin-bottom:7px; flex-wrap:wrap; }
    .ci-sku { font-size:9.5px; color:#9ca3af; font-family:monospace; }
    .ci-unit-price { font-size:10.5px; color:#9ca3af; }
    .ci-tax-chip { font-size:9.5px; background:#dbeafe; color:#1e40af; padding:1px 5px; border-radius:3px; }
    .ci-bottom { display:flex; align-items:center; justify-content:space-between; }
    .qty-control { display:flex; align-items:center; gap:6px; }
    .qty-btn {
      width:26px; height:26px; border-radius:8px;
      background:#f8fafc; border:1px solid #dce6f0;
      color:#374151; font-size:16px; cursor:pointer;
      display:flex; align-items:center; justify-content:center; transition:all .12s;
      line-height:1;
    }
    .qty-btn:hover:not(:disabled) { background:#dbeafe; border-color:#93c5fd; color:#1a407e; }
    .qty-btn:disabled { opacity:.3; cursor:not-allowed; }
    .qty-display { min-width:26px; text-align:center; font-size:14px; font-weight:700; color:#0c1c35; }
    .ci-line-total { font-size:14px; font-weight:700; color:#1a407e; }

    /* Totals */
    .cart-totals { padding:10px 16px; border-top:1px solid #dce6f0; flex-shrink:0; }
    .ct-row { display:flex; justify-content:space-between; font-size:12px; color:#9ca3af; padding:2px 0; }
    .ct-grand {
      display:flex; justify-content:space-between; align-items:center;
      padding:9px 12px; margin-top:8px;
      background:#f0f6ff; border:1px solid #bfdbfe; border-radius:9px;
      font-size:12px; font-weight:700; color:#374151;
    }
    .ct-grand-amount { font-size:20px; font-weight:800; color:#1a407e; font-family:'Sora',sans-serif; }

    /* Invoice toggle */
    .invoice-toggle {
      display:flex; align-items:center; gap:9px; margin:0 14px;
      padding:9px 11px; background:#f8fafc; border:1px solid #dce6f0;
      border-radius:9px; cursor:pointer; transition:all .15s; flex-shrink:0;
    }
    .invoice-toggle.active { background:#eff6ff; border-color:#bfdbfe; }
    .invoice-toggle:hover { border-color:#93c5fd; }
    .it-checkbox { width:17px; height:17px; border-radius:5px; border:1.5px solid #dce6f0; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .12s; background:#fff; }
    .it-checkbox.checked { background:#1a407e; border-color:#1a407e; }
    .it-text { flex:1; }
    .it-main { display:block; font-size:12px; font-weight:600; color:#374151; }
    .it-sub { display:block; font-size:10px; color:#9ca3af; margin-top:1px; }
    .it-doc-icon { color:#9ca3af; flex-shrink:0; }

    /* Payment method */
    .payment-section { padding:10px 14px; flex-shrink:0; }
    .ps-label { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#9ca3af; margin-bottom:8px; }
    .pm-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; }
    .pm-btn {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      padding:8px 4px; border-radius:9px;
      background:#fff; border:1px solid #dce6f0;
      color:#374151; cursor:pointer; transition:all .14s;
    }
    .pm-btn:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .pm-btn.pm-active { background:#eff6ff; border-color:#1a407e; color:#1a407e; }
    .pm-icon { font-size:15px; line-height:1; }
    .pm-name { font-size:10.5px; font-weight:600; }

    /* Charge button */
    .charge-wrap { padding:0 14px 14px; flex-shrink:0; }
    .btn-charge {
      width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
      padding:14px 0; border-radius:12px; border:none; cursor:pointer;
      font-size:15px; font-weight:800; color:#fff; letter-spacing:.01em;
      background:linear-gradient(135deg, #1a407e, #2563eb);
      box-shadow:0 4px 20px rgba(26,64,126,.22);
      transition:all .16s;
    }
    .btn-charge:hover:not(:disabled) { opacity:.93; transform:translateY(-1px); box-shadow:0 8px 28px rgba(26,64,126,.3); }
    .btn-charge:disabled { opacity:.35; cursor:not-allowed; transform:none; box-shadow:none; }

    /* ═══════════════════════════════════════
       HISTORY VIEW
    ═══════════════════════════════════════ */
    .history-view { flex:1; display:flex; flex-direction:column; overflow:hidden; background:#f8fafc; }
    .hv-toolbar {
      display:flex; align-items:center; justify-content:space-between;
      padding:13px 20px; border-bottom:1px solid #dce6f0; flex-shrink:0;
      background:#fff;
    }
    .hv-left { display:flex; align-items:center; gap:14px; }
    .hv-title { font-size:14px; font-weight:700; color:#0c1c35; font-family:'Sora',sans-serif; }
    .hv-right { display:flex; align-items:center; gap:8px; }
    .hv-stat-pill {
      display:flex; align-items:center; gap:5px;
      padding:5px 12px; border-radius:99px;
      background:#f8fafc; border:1px solid #dce6f0;
      font-size:12px; color:#374151;
    }
    .hv-stat-pill.green { background:#d1fae5; border-color:#6ee7b7; color:#065f46; }
    .btn-back {
      display:flex; align-items:center; gap:6px; padding:6px 13px;
      background:#fff; border:1px solid #dce6f0;
      border-radius:8px; color:#374151; font-size:12.5px; cursor:pointer; transition:all .14s;
    }
    .btn-back:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .hv-loading { flex:1; display:flex; align-items:center; justify-content:center; }
    .hv-table-wrap { flex:1; overflow:auto; }

    /* Sales table */
    .sales-table { width:100%; border-collapse:collapse; }
    .sales-table th {
      padding:11px 14px; font-size:11px; color:#9ca3af; font-weight:700;
      text-transform:uppercase; letter-spacing:.06em;
      border-bottom:1px solid #f0f4f8;
      text-align:left; white-space:nowrap; background:#f8fafc;
    }
    .sales-table td { padding:11px 14px; font-size:13.5px; color:#374151; border-bottom:1px solid #f0f4f8; vertical-align:middle; }
    .sales-table tr:hover td { background:#fafcff; }
    .tc { text-align:center; }
    .tr { text-align:right; }
    .sale-number { font-size:13px; font-weight:700; color:#0c1c35; font-family:monospace; }
    .td-muted { color:#9ca3af !important; font-size:12px; }
    .td-customer { display:flex; align-items:center; gap:7px; }
    .tdc-avatar { width:24px; height:24px; border-radius:6px; background:#dbeafe; color:#1e40af; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .td-total { color:#0c1c35; font-size:13px; }
    .td-dash { color:#9ca3af; }
    .td-empty { text-align:center !important; color:#9ca3af !important; padding:40px !important; font-size:13px; }
    .row-cancelled td { opacity:.5; }

    /* Table chips */
    .pm-chip, .status-chip, .inv-chip {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 9px; border-radius:6px; font-size:10.5px; font-weight:600; white-space:nowrap;
    }
    .pm-chip.pm-cash { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .pm-chip.pm-card { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
    .pm-chip.pm-transfer { background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; }
    .pm-chip.pm-mixed { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
    .status-chip.status-completed { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .status-chip.status-cancelled { background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; }
    .status-chip.status-refunded { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
    .inv-chip { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }

    .td-actions { display:flex; align-items:center; justify-content:center; gap:5px; }
    .tda-btn { width:28px; height:28px; border-radius:7px; background:#fff; border:1px solid #dce6f0; color:#374151; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .12s; }
    .tda-btn:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .tda-btn.danger { border-color:#fecaca; color:#dc2626; }
    .tda-btn.danger:hover { background:#fee2e2; }
    .link-btn { background:none; border:none; color:#1a407e; font-size:12px; cursor:pointer; text-decoration:underline; padding:0; transition:color .12s; }
    .link-btn:hover { color:#2563eb; }

    /* ═══════════════════════════════════════
       MODALS
    ═══════════════════════════════════════ */
    .overlay {
      position:fixed; inset:0; background:rgba(12,28,53,.4); z-index:500;
      display:flex; align-items:center; justify-content:center;
      animation:fadeIn .15s ease;
      backdrop-filter:blur(2px);
    }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }

    .modal {
      background:#fff;
      border:1px solid #dce6f0; border-radius:14px;
      width:440px; max-width:95vw;
      box-shadow:0 20px 60px rgba(12,28,53,.15);
      animation:slideUp .18s ease;
      overflow:hidden;
    }
    .modal-pay { width:390px; }
    .modal-success { width:420px; }
    @keyframes slideUp { from{transform:translateY(18px);opacity:0} to{transform:none;opacity:1} }

    /* Modal header */
    .modal-header {
      display:flex; align-items:center; gap:12px; padding:18px 22px;
      border-bottom:1px solid #f0f4f8;
    }
    .modal-header-icon {
      width:36px; height:36px; border-radius:10px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .modal-header-icon.teal { background:#d1fae5; color:#059669; border:1px solid #6ee7b7; }
    .modal-header-icon.red { background:#fee2e2; color:#dc2626; border:1px solid #fecaca; }
    .modal-title { font-size:15px; font-weight:700; color:#0c1c35; margin:0; font-family:'Sora',sans-serif; }
    .modal-subtitle { font-size:11.5px; color:#9ca3af; margin-top:2px; }
    .modal-close-btn { margin-left:auto; background:#f8fafc; border:1px solid #dce6f0; border-radius:8px; color:#9ca3af; cursor:pointer; width:30px; height:30px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .12s; }
    .modal-close-btn:hover { background:#f0f4f8; color:#374151; }

    /* PM badge in modal subtitle */
    .pm-badge { font-size:11px; font-weight:700; padding:2px 9px; border-radius:99px; display:inline-block; margin-top:3px; }
    .pm-badge.pm-cash { background:#d1fae5; color:#065f46; }
    .pm-badge.pm-card { background:#dbeafe; color:#1e40af; }
    .pm-badge.pm-transfer { background:#ede9fe; color:#5b21b6; }
    .pm-badge.pm-mixed { background:#fef3c7; color:#92400e; }

    /* Modal body & footer */
    .modal-body { padding:22px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:9px; padding:16px 22px; border-top:1px solid #f0f4f8; }

    /* Session summary in modal */
    .session-summary {
      background:#f8fafc; border:1px solid #dce6f0;
      border-radius:10px; padding:12px 16px; margin-bottom:18px;
      display:grid; grid-template-columns:repeat(3,1fr); gap:10px; text-align:center;
    }
    .ss-item span { display:block; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#9ca3af; margin-bottom:4px; }
    .ss-item strong { font-size:14px; font-weight:700; color:#374151; }
    .ss-item .ss-green { color:#059669; }

    /* Fields */
    .field-group { margin-bottom:16px; }
    .field-group:last-child { margin-bottom:0; }
    .field-group label { display:block; font-size:11.5px; color:#374151; font-weight:600; margin-bottom:7px; letter-spacing:.02em; }
    .field-input {
      width:100%; background:#fff; border:1px solid #dce6f0;
      border-radius:9px; color:#374151; font-size:14px; padding:10px 13px;
      outline:none; box-sizing:border-box; resize:none; transition:all .14s;
    }
    .field-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .big-input { font-size:22px; font-weight:700; text-align:center; padding:13px; }

    /* Payment modal specifics */
    .pay-total-display { text-align:center; margin-bottom:20px; }
    .ptd-label { display:block; font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:.08em; font-weight:700; margin-bottom:6px; }
    .ptd-amount { display:block; font-size:38px; font-weight:800; color:#1a407e; letter-spacing:-.5px; font-family:'Sora',sans-serif; }
    .pay-amount-input { font-size:24px; font-weight:700; text-align:center; }
    .change-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 16px; background:#f8fafc; border:1px solid #dce6f0;
      border-radius:9px; margin-top:12px;
    }
    .change-row span { font-size:13px; color:#9ca3af; }
    .change-row strong { font-size:20px; font-weight:700; color:#9ca3af; }
    .change-row.change-ok strong { color:#059669; }
    .pay-invoice-notice {
      display:flex; align-items:center; gap:8px; margin-top:14px;
      padding:10px 13px; background:#eff6ff; border:1px solid #bfdbfe;
      border-radius:9px; font-size:12px; color:#1e40af;
    }
    .pay-invoice-notice strong { color:#1a407e; }

    /* Modal buttons */
    .btn-modal-sec { padding:9px 18px; border-radius:8px; background:#fff; border:1px solid #dce6f0; color:#374151; font-size:13px; cursor:pointer; transition:all .14s; }
    .btn-modal-sec:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .btn-modal-pri {
      display:inline-flex; align-items:center; gap:7px;
      padding:9px 20px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; border:none;
      background:linear-gradient(135deg,#1a407e,#2563eb); color:#fff; transition:opacity .14s;
    }
    .btn-modal-pri:hover:not(:disabled) { opacity:.9; }
    .btn-modal-pri:disabled { opacity:.4; cursor:not-allowed; }
    .btn-modal-pri.btn-modal-lg { padding:11px 24px; font-size:14px; }
    .btn-modal-danger {
      display:inline-flex; align-items:center; gap:7px;
      padding:9px 20px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;
      background:#dc2626; border:none; color:#fff; transition:opacity .14s;
    }
    .btn-modal-danger:hover:not(:disabled) { opacity:.9; }
    .btn-modal-danger:disabled { opacity:.4; cursor:not-allowed; }

    /* ══ Success Modal ══ */
    .modal-success { text-align:center; padding-bottom:6px; }
    .success-ring { margin:28px auto 12px; display:flex; justify-content:center; }
    .success-title { font-size:20px; font-weight:800; color:#0c1c35; margin:0 0 4px; font-family:'Sora',sans-serif; }
    .success-sale-num { font-size:12px; color:#9ca3af; margin-bottom:20px; font-family:monospace; }
    .success-amounts { background:#f8fafc; border:1px solid #dce6f0; border-radius:12px; padding:14px 20px; margin:0 22px 16px; text-align:left; }
    .sa-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:5px 0; border-bottom:1px solid #f0f4f8; }
    .sa-row:last-child { border-bottom:none; }
    .sa-row span { color:#9ca3af; }
    .sa-row strong { color:#374151; font-size:14px; }
    .sa-change strong { color:#059669; font-size:18px; font-weight:800; }
    .success-inv-badge {
      display:inline-flex; align-items:center; gap:6px;
      padding:5px 14px; background:#d1fae5; border:1px solid #6ee7b7;
      border-radius:99px; font-size:12px; color:#065f46; font-weight:600; margin-bottom:16px;
    }
    .success-actions { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; padding:0 22px 26px; }
    .sa-btn {
      display:inline-flex; align-items:center; gap:6px; padding:8px 16px;
      border-radius:9px; background:#fff; border:1px solid #dce6f0;
      color:#374151; font-size:12.5px; cursor:pointer; transition:all .14s;
    }
    .sa-btn:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }
    .sa-btn-primary {
      display:inline-flex; align-items:center; gap:7px; padding:10px 22px;
      border-radius:10px; font-size:13.5px; font-weight:700; cursor:pointer; border:none;
      background:linear-gradient(135deg,#1a407e,#2563eb); color:#fff;
      box-shadow:0 4px 16px rgba(26,64,126,.22); transition:all .15s;
    }
    .sa-btn-primary:hover { opacity:.92; transform:translateY(-1px); box-shadow:0 8px 24px rgba(26,64,126,.3); }

    /* Spinners */
    .spinner { width:32px; height:32px; border:3px solid rgba(26,64,126,.12); border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; }
    .spinner-sm { width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
    .spinner-xs { width:12px; height:12px; border:2px solid rgba(26,64,126,.15); border-top-color:#1a407e; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }

    /* ═══════════════════════════════════════
       SKU SEARCH + FREE ITEM
    ═══════════════════════════════════════ */
    .sku-search-zone {
      display:flex; align-items:center; gap:6px;
      padding:6px 14px; border-bottom:1px solid #dce6f0; flex-shrink:0;
    }
    .sku-field {
      flex:1; display:flex; align-items:center; gap:6px;
      background:#fff; border:1px solid #dce6f0;
      border-radius:8px; padding:6px 10px; transition:all .14s;
    }
    .sku-field:focus-within { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .sku-icon { color:#9ca3af; flex-shrink:0; }
    .sku-input { flex:1; background:none; border:none; outline:none; color:#374151; font-size:12px; }
    .sku-input::placeholder { color:#9ca3af; }
    .btn-free-item {
      white-space:nowrap; padding:6px 11px; border-radius:8px; font-size:11px; font-weight:600;
      background:#fff; border:1px solid #dce6f0;
      color:#374151; cursor:pointer; transition:all .13s; flex-shrink:0;
    }
    .btn-free-item:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; }

    .free-item-form {
      padding:8px 14px; background:#f8fafc; border-bottom:1px solid #dce6f0;
      flex-shrink:0; display:flex; flex-direction:column; gap:6px;
    }
    .fi-row { display:flex; gap:6px; align-items:center; }
    .fi-input {
      flex:1; background:#fff; border:1px solid #dce6f0;
      border-radius:7px; color:#374151; font-size:12px; padding:7px 10px;
      outline:none; box-sizing:border-box; transition:all .13s;
    }
    .fi-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .fi-input::placeholder { color:#9ca3af; }
    .fi-desc { flex:2; }
    .fi-tax { width:68px; flex:none; }
    .fi-add-btn {
      padding:7px 13px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:none;
      background:linear-gradient(135deg,#1a407e,#2563eb); color:#fff; flex-shrink:0; transition:opacity .13s;
    }
    .fi-add-btn:hover { opacity:.88; }

    /* ═══════════════════════════════════════
       CART DISCOUNT
    ═══════════════════════════════════════ */
    .ct-disc-input {
      align-items:center; margin-top:4px;
    }
    .ct-disc-label { font-size:11px; color:#9ca3af; flex-shrink:0; }
    .ct-disc-field {
      width:64px; background:#fff; border:1px solid #dce6f0;
      border-radius:6px; color:#374151; font-size:12px; padding:4px 8px;
      outline:none; text-align:right; transition:all .13s;
    }
    .ct-disc-field:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .ct-disc { color:#d97706 !important; }
    .disc-val { color:#d97706; font-weight:600; }

    /* ═══════════════════════════════════════
       SESSION CLOSE — PAYMENT BREAKDOWN
    ═══════════════════════════════════════ */
    .ssb-payment-breakdown { margin-top:4px; }
    .ssb-divider { height:1px; background:#f0f4f8; margin:10px 0 8px; }
    .ssb-row {
      display:flex; justify-content:space-between; align-items:center;
      font-size:12.5px; padding:4px 0; color:#9ca3af;
    }
    .ssb-row strong { color:#374151; font-size:13px; }
  `],
})
export class PosComponent implements OnInit, OnDestroy {
  private pos = inject(PosApiService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private customerSearch$ = new Subject<string>();

  activeSession    = signal<PosSession | null>(null);
  loadingSession   = signal(true);
  processing       = signal(false);
  showHistory      = signal(false);
  showOpenSessionModal  = signal(false);
  showCloseSessionModal = signal(false);
  showPaymentModal      = signal(false);
  completedSale         = signal<PosSale | null>(null);

  openSessionCash  = 0;
  openSessionNotes = '';
  closeSessionCash = 0;
  closeSessionNotes = '';

  products        = signal<Product[]>([]);
  loadingProducts = signal(false);
  productSearch   = '';

  customerSearchTerm = '';
  customerResults    = signal<Customer[]>([]);
  loadingCustomers   = signal(false);
  showCustomerDropdown = signal(false);
  selectedCustomer   = signal<Customer | null>(null);

  cart           = signal<CartItem[]>([]);
  amountPaid     = signal(0);
  selectedPaymentMethod = signal<'CASH' | 'CARD' | 'TRANSFER' | 'MIXED'>('CASH');
  generateInvoice = signal(false);
  cartDiscountPct = signal(0);

  sessionSales   = signal<PosSale[]>([]);
  loadingHistory = signal(false);
  sessionSummary = signal<any>(null);

  // Free item form
  showFreeItemForm = signal(false);
  freeItemName  = '';
  freeItemPrice = 0;
  freeItemTax   = 19;

  // SKU / barcode search
  skuSearch = '';

  // Two-way binding proxy for cartDiscountPct signal
  get discountPctProxy(): number { return this.cartDiscountPct(); }
  set discountPctProxy(v: number) { this.cartDiscountPct.set(Math.min(100, Math.max(0, Number(v) || 0))); }

  paymentMethods = [
    { value: 'CASH'     as const, label: 'Efectivo',      emoji: '💵' },
    { value: 'CARD'     as const, label: 'Tarjeta',       emoji: '💳' },
    { value: 'TRANSFER' as const, label: 'Transf.',       emoji: '🏦' },
    { value: 'MIXED'    as const, label: 'Mixto',         emoji: '🔀' },
  ];

  cartSubtotal = computed(() => this.cart().reduce((s, i) => s + i.subtotal, 0));
  cartTax      = computed(() => this.cart().reduce((s, i) => s + i.taxAmount, 0));
  cartTotal    = computed(() => {
    const raw  = this.cart().reduce((s, i) => s + i.total, 0);
    const disc = this.cartDiscountPct();
    if (disc <= 0) return raw;
    return Math.round(raw * (1 - disc / 100) * 100) / 100;
  });
  cartDiscountAmount = computed(() => {
    const raw = this.cart().reduce((s, i) => s + i.total, 0);
    return Math.round(raw * (this.cartDiscountPct() / 100) * 100) / 100;
  });
  changeAmount = computed(() => Math.max(0, this.amountPaid() - this.cartTotal()));
  sessionTotal = computed(() =>
    this.sessionSales().filter(s => s.status === 'COMPLETED').reduce((acc, s) => acc + Number(s.total), 0),
  );
  isPaymentValid = computed(() => {
    if (this.cart().length === 0) return false;
    if (this.selectedPaymentMethod() === 'CASH') return this.amountPaid() >= this.cartTotal();
    return this.amountPaid() > 0;
  });

  private productSearchTimer: any;

  ngOnInit() { this.loadActiveSession(); this.loadProducts(); this.initCustomerSearch(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  private initCustomerSearch() {
    this.customerSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => {
        if (term.length < 2) { this.customerResults.set([]); this.loadingCustomers.set(false); return of({ data: [] }); }
        this.loadingCustomers.set(true);
        const p = new HttpParams().set('search', term).set('limit', '10');
        return this.http.get<{ data: Customer[] }>(`${environment.apiUrl}/customers`, { params: p });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (res: any) => { this.customerResults.set(res.data ?? []); this.loadingCustomers.set(false); this.cdr.markForCheck(); },
      error: () => this.loadingCustomers.set(false),
    });
  }

  onCustomerSearch() { this.showCustomerDropdown.set(true); this.customerSearch$.next(this.customerSearchTerm); }
  selectCustomer(c: Customer) { this.selectedCustomer.set(c); this.customerSearchTerm = ''; this.customerResults.set([]); this.showCustomerDropdown.set(false); }
  clearCustomerSearch() { this.customerSearchTerm = ''; this.customerResults.set([]); this.showCustomerDropdown.set(false); }
  clearSelectedCustomer() { this.selectedCustomer.set(null); this.generateInvoice.set(false); this.customerSearchTerm = ''; }
 customerInitials(c?: { name?: string }): string {
  if (!c?.name) return '';
  return c.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}
  loadActiveSession() {
    this.loadingSession.set(true);
    this.pos.getActiveSession().subscribe({
      next: s => { this.activeSession.set(s); this.loadingSession.set(false); },
      error: () => { this.activeSession.set(null); this.loadingSession.set(false); },
    });
  }

  openSession() {
    this.processing.set(true);
    this.pos.openSession({ initialCash: this.openSessionCash, notes: this.openSessionNotes || undefined }).subscribe({
      next: s => { this.activeSession.set(s); this.showOpenSessionModal.set(false); this.processing.set(false); this.notify.success('Caja abierta exitosamente'); this.openSessionCash = 0; this.openSessionNotes = ''; },
      error: (err: any) => { this.processing.set(false); this.notify.error(err?.error?.message ?? 'Error al abrir la caja'); },
    });
  }

  closeSession() {
    const s = this.activeSession(); if (!s) return;
    this.processing.set(true);
    this.pos.closeSession(s.id, { finalCash: this.closeSessionCash, notes: this.closeSessionNotes || undefined }).subscribe({
      next: () => { this.activeSession.set(null); this.cart.set([]); this.showCloseSessionModal.set(false); this.processing.set(false); this.notify.success('Caja cerrada exitosamente'); this.closeSessionCash = 0; this.closeSessionNotes = ''; },
      error: (err: any) => { this.processing.set(false); this.notify.error(err?.error?.message ?? 'Error al cerrar la caja'); },
    });
  }

  loadProducts(search = '') {
    this.loadingProducts.set(true);
    let p = new HttpParams().set('status', 'ACTIVE').set('limit', '100');
    if (search) p = p.set('search', search);
    this.http.get<{ data: Product[] }>(`${environment.apiUrl}/products`, { params: p }).subscribe({
      next: res => { this.products.set(res.data ?? []); this.loadingProducts.set(false); },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSearch() { clearTimeout(this.productSearchTimer); this.productSearchTimer = setTimeout(() => this.loadProducts(this.productSearch), 300); }

  addToCart(product: Product) {
    if (product.stock <= 0) return;
    const idx = this.cart().findIndex(i => i.productId === product.id);
    if (idx >= 0) {
      if (this.cart()[idx].quantity >= product.stock) {
        this.notify.error('Stock insuficiente');
        return;
      }
      this.updateQty(idx, this.cart()[idx].quantity + 1);
    } else {
      const price = Number(product.price), taxRate = Number(product.taxRate);
      const sub = price, tax = sub * (taxRate / 100);
      this.cart.update(c => [...c, { productId:product.id, description:product.name, quantity:1, unitPrice:price, taxRate, discount:0, subtotal:Math.round(sub*100)/100, taxAmount:Math.round(tax*100)/100, total:Math.round((sub+tax)*100)/100, sku:product.sku, stock:product.stock }]);
    }
  }

  updateQty(idx: number, qty: number) {
    this.cart.update(items => items.map((item, i) => {
      if (i !== idx) return item;
      const unitPrice = Number(item.unitPrice), taxRate = Number(item.taxRate), discount = Number(item.discount);
      const sub = qty * unitPrice * (1 - discount / 100), tax = sub * (taxRate / 100);
      return { ...item, quantity:qty, subtotal:Math.round(sub*100)/100, taxAmount:Math.round(tax*100)/100, total:Math.round((sub+tax)*100)/100 };
    }));
  }

  incrementQty(idx: number) {
    const item = this.cart()[idx];
    if (item.stock !== undefined && item.quantity >= item.stock) {
      this.notify.error('Stock insuficiente');
      return;
    }
    this.updateQty(idx, item.quantity + 1);
  }
  decrementQty(idx: number) { const q = this.cart()[idx].quantity; if (q > 1) this.updateQty(idx, q - 1); }
  removeFromCart(idx: number) { this.cart.update(c => c.filter((_, i) => i !== idx)); }
  clearCart() { this.cart.set([]); this.clearSelectedCustomer(); this.cartDiscountPct.set(0); }

  onSkuSearch() {
    const sku = this.skuSearch.trim();
    if (!sku) return;
    const product = this.products().find(p => p.sku === sku);
    if (product) {
      this.addToCart(product);
      this.skuSearch = '';
    } else {
      this.notify.error(`Producto no encontrado: ${sku}`);
    }
  }

  addFreeItem() {
    if (!this.freeItemName || this.freeItemPrice <= 0) return;
    const price   = Number(this.freeItemPrice);
    const taxRate = Number(this.freeItemTax);
    const sub     = price;
    const tax     = sub * (taxRate / 100);
    this.cart.update(c => [...c, {
      productId:  undefined,
      description: this.freeItemName,
      quantity:   1,
      unitPrice:  price,
      taxRate,
      discount:   0,
      subtotal:   Math.round(sub * 100) / 100,
      taxAmount:  Math.round(tax * 100) / 100,
      total:      Math.round((sub + tax) * 100) / 100,
      sku:        undefined,
      stock:      Infinity,
    }]);
    this.freeItemName  = '';
    this.freeItemPrice = 0;
    this.freeItemTax   = 19;
    this.showFreeItemForm.set(false);
  }

  loadSessionSummary() {
    const s = this.activeSession();
    if (!s) return;
    this.pos.getSalesSummary(undefined, undefined, s.id).subscribe({
      next: summary => this.sessionSummary.set(summary),
      error: () => {},
    });
  }

  openPaymentModal() { this.amountPaid.set(this.cartTotal()); this.showPaymentModal.set(true); }

  processSale() {
    const session = this.activeSession(); if (!session || !this.isPaymentValid()) return;
    this.processing.set(true);
    const dto = { sessionId:session.id, customerId:this.selectedCustomer()?.id, items:this.cart().map(i => ({ productId:i.productId, description:i.description, quantity:i.quantity, unitPrice:i.unitPrice, taxRate:i.taxRate, discount:i.discount })), paymentMethod:this.selectedPaymentMethod(), amountPaid:this.amountPaid(), generateInvoice:this.generateInvoice() && !!this.selectedCustomer(), cartDiscountPct:this.cartDiscountPct() || undefined };
    this.pos.createSale(dto).subscribe({
      next: (sale: any) => {
        this.completedSale.set(sale); this.cart.set([]); this.clearSelectedCustomer(); this.generateInvoice.set(false); this.showPaymentModal.set(false); this.processing.set(false);
        const s = this.activeSession()!;
        this.activeSession.set({ ...s, totalSales:Number(s.totalSales)+Number(sale.total), totalTransactions:s.totalTransactions+1 });
      },
      error: (err: any) => { this.processing.set(false); this.notify.error(err?.error?.message ?? 'Error al procesar la venta'); },
    });
  }

  toggleHistory() { const next = !this.showHistory(); this.showHistory.set(next); if (next) this.loadSessionSales(); }

  loadSessionSales() {
    const session = this.activeSession(); if (!session) return;
    this.loadingHistory.set(true);
    this.pos.getSales({ sessionId:session.id, limit:100 }).subscribe({
      next: res => { this.sessionSales.set(res.data ?? []); this.loadingHistory.set(false); },
      error: () => this.loadingHistory.set(false),
    });
  }

  cancelSale(saleId: string) {
    if (!confirm('¿Cancelar esta venta? Se restaurará el stock de los productos.')) return;
    this.pos.cancelSale(saleId).subscribe({
      next: () => {
        this.notify.success('Venta cancelada'); this.loadSessionSales();
        const s = this.activeSession();
        if (s) { const sale = this.sessionSales().find(x => x.id === saleId); if (sale) this.activeSession.set({ ...s, totalSales:Math.max(0,Number(s.totalSales)-Number(sale.total)), totalTransactions:Math.max(0,s.totalTransactions-1) }); }
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al cancelar la venta'),
    });
  }

  printReceipt(saleId: string) {
    this.pos.getReceipt(saleId).subscribe({
      next: ({ html }) => {
        const win = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
        if (!win) { this.notify.error('No se pudo abrir la ventana de impresión'); return; }
        win.document.write(html); win.document.close(); win.focus();
        setTimeout(() => { win.print(); }, 400);
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al generar la tirilla'),
    });
  }

  generateInvoiceForSale(sale: PosSale) {
    if (!sale.customer) { this.notify.error('La venta no tiene cliente asignado'); return; }
    this.pos.generateInvoiceFromSale(sale.id).subscribe({
      next: (inv: any) => {
        this.notify.success(`Factura ${inv.invoiceNumber} generada exitosamente`);
        if (this.showHistory()) this.loadSessionSales();
        if (this.completedSale()?.id === sale.id) this.completedSale.update(s => s ? { ...s, invoiceId:inv.id, invoice:inv } : null);
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al generar la factura'),
    });
  }

  getPaymentLabel(m: string): string { return this.paymentMethods.find(x => x.value === m)?.label ?? m; }
  getStatusLabel(s: string): string { return ({ COMPLETED:'Completada', CANCELLED:'Cancelada', REFUNDED:'Reembolsada' } as any)[s] ?? s; }

  fmtCOP(n: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Number(n ?? 0));
  }
}