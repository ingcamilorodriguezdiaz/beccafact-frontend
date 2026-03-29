import {
  Component, OnInit, OnDestroy, signal, computed, inject,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, afterNextRender,
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
    <div class="session-bar" id="tour-pos-session-bar">
      <div class="session-left">
        <div class="session-headline">
          <div class="session-live">
            <span class="live-dot"></span>
            <span class="live-label">Caja abierta</span>
          </div>
          <div class="session-operator">
            <div class="session-avatar">
              {{ customerInitials({ name: (activeSession()?.user?.firstName ?? '') + ' ' + (activeSession()?.user?.lastName ?? '') }) }}
            </div>
            <div>
              <strong>{{ activeSession()?.user?.firstName }} {{ activeSession()?.user?.lastName }}</strong>
              <small>Operando desde hace {{ sessionElapsed() }}</small>
            </div>
          </div>
        </div>
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
          <div class="sb-stat">
            <span class="sb-stat-lbl">Ticket prom.</span>
            <span class="sb-stat-val">{{ fmtCOP(sessionAverageTicket()) }}</span>
          </div>
          <div class="sb-stat sb-stat--focus">
            <span class="sb-stat-lbl">Pendientes</span>
            <span class="sb-stat-val">{{ cartCount() }} ítems</span>
          </div>
        </div>
      </div>
      <div class="session-actions">
        <button class="sb-btn" id="tour-pos-history" (click)="toggleHistory()">
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
      <div class="products-panel" id="tour-pos-products">
        <div class="products-overview">
          <div class="po-copy">
            <p class="po-kicker">Punto de venta</p>
            <h2>Catálogo de productos</h2>
            <p>Explora, filtra y agrega productos sin perder visibilidad del flujo de cobro.</p>
          </div>
          <div class="po-stats">
            <div class="po-stat">
              <span>Disponibles</span>
              <strong>{{ availableProductsCount() }}</strong>
            </div>
            <div class="po-stat">
              <span>Stock bajo</span>
              <strong>{{ lowStockProductsCount() }}</strong>
            </div>
            <div class="po-stat po-stat--accent">
              <span>En carrito</span>
              <strong>{{ cartCount() }}</strong>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="catalog-tools">
          <div class="panel-toolbar">
            <div class="toolbar-search">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" class="ts-icon"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/></svg>
              <input #productSearchInput type="text" placeholder="Buscar por nombre o SKU..." [(ngModel)]="productSearch"
                     (input)="onProductSearch()" class="ts-input" aria-label="Buscar productos por nombre o SKU" />
              @if (productSearch) {
                <button class="ts-clear" (click)="productSearch=''; loadProducts()">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                </button>
              }
            </div>
            <div class="toolbar-right">
              <span class="products-counter">
                <span class="pc-num">{{ products().length }}</span> visibles
              </span>
            </div>
          </div>

          <div class="sku-search-zone" id="tour-pos-sku">
            <div class="sku-field">
              <svg viewBox="0 0 20 20" fill="currentColor" width="12" class="sku-icon"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h1a1 1 0 010 2H4a1 1 0 01-1-1zm5-8a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 010 2h-6a1 1 0 01-1-1z"/></svg>
              <input type="text" class="sku-input" placeholder="SKU / código de barras"
                     [(ngModel)]="skuSearch" (keyup.enter)="onSkuSearch()" />
            </div>
            <button class="btn-free-item" (click)="showFreeItemForm.set(!showFreeItemForm())">
              + Ítem libre
            </button>
          </div>
        </div>
        <div class="catalog-body">
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
                <div class="product-card" [class.out-of-stock]="p.stock <= 0"
                     (click)="addToCart(p)"
                     [attr.aria-disabled]="p.stock <= 0"
                     [attr.title]="p.stock <= 0 ? 'Sin stock disponible' : ('Agregar ' + p.name + ' al carrito')">
                  @if (p.stock <= 0) {
                    <div class="pc-ribbon out">✗ Sin stock</div>
                  } @else if (p.stock <= (p.minStock ?? 10)) {
                    <div class="pc-ribbon low">⚠ Stock bajo</div>
                  }

                  <div class="pc-content">
                    <div class="pc-header">
                      <span class="pc-sku">{{ p.sku }}</span>
                      <span class="pc-tax-badge">IVA {{ p.taxRate }}%</span>
                    </div>
                    <div class="pc-name">{{ p.name }}</div>
                    <div class="pc-price">{{ fmtCOP(p.price) }}</div>
                    <div class="pc-footer">
                      @if (p.stock <= 0) {
                        <span class="pc-stock-badge out-of-stock-badge">✗ Sin stock</span>
                      } @else if (p.stock <= (p.minStock ?? 10)) {
                        <span class="pc-stock-badge low-stock-badge">⚠ {{ p.stock }} {{ p.unit }}</span>
                      } @else {
                        <span class="pc-stock-badge in-stock-badge">✓ En stock</span>
                      }
                      @if (p.stock > 0) {
                        <div class="pc-add-btn" aria-hidden="true">
                          <svg viewBox="0 0 12 12" fill="currentColor" width="11"><path d="M6 1a.5.5 0 01.5.5v4h4a.5.5 0 010 1h-4v4a.5.5 0 01-1 0v-4h-4a.5.5 0 010-1h4v-4A.5.5 0 016 1z"/></svg>
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- ── RIGHT: Cart panel ───────────────────────────── -->
      <div class="checkout-panel" id="tour-pos-cart">
        <div class="checkout-shell">
          <div class="cart-header">
            <div class="cart-header-left">
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" class="cart-icon">
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
                <circle cx="6.5" cy="17.5" r="1.5"/><circle cx="14.5" cy="17.5" r="1.5"/>
              </svg>
              <div>
                <span class="cart-title-text">Venta actual</span>
                <small class="cart-title-sub">{{ cartCount() }} ítems listos para cobrar</small>
              </div>
            </div>
            @if (cart().length > 0) {
              <button class="cart-clear-btn" (click)="clearCart()">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1z"/></svg>
                Limpiar
              </button>
            }
          </div>

          <div class="cart-hero">
            <div class="cart-hero-copy">
              <p class="cart-hero-kicker">Resumen de orden</p>
              <strong>{{ fmtCOP(cartTotal()) }}</strong>
              <span>{{ selectedCustomer()?.name ?? 'Cliente ocasional' }}</span>
            </div>
            <div class="cart-hero-badges">
              <span class="cart-hero-badge">{{ getPaymentLabel(selectedPaymentMethod()) }}</span>
              @if (generateInvoice()) {
                <span class="cart-hero-badge cart-hero-badge--accent">Factura</span>
              }
              @if (isAdvancePayment()) {
                <span class="cart-hero-badge cart-hero-badge--warn">Anticipo</span>
              }
            </div>
          </div>

        <!-- Customer picker -->
        <div class="customer-zone" id="tour-pos-customer">
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

        <!-- Cart items -->
        <div class="cart-items">
          @if (cart().length === 0) {
            <div class="cart-empty">
              <div class="ce-icon">
                <svg viewBox="0 0 64 64" fill="none" width="52" aria-hidden="true">
                  <path d="M8 10h6l6 30h28l5-20H18" stroke="#dce6f0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="26" cy="48" r="3.5" stroke="#dce6f0" stroke-width="2.5"/>
                  <circle cx="42" cy="48" r="3.5" stroke="#dce6f0" stroke-width="2.5"/>
                  <path d="M4 6h4" stroke="#dce6f0" stroke-width="2.5" stroke-linecap="round"/>
                  <path d="M32 22v8M28 26h8" stroke="#7ea3cc" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <p class="ce-title">Carrito vacío</p>
              <p class="ce-hint">Busca productos en el panel izquierdo<br>o escanea un código de barras</p>
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
            <label class="ct-disc-label" for="discount-pct">Descuento %</label>
            <input id="discount-pct" type="number" class="ct-disc-field" [(ngModel)]="discountPctProxy"
                   min="0" max="100" step="1" placeholder="0" aria-label="Porcentaje de descuento" />
          </div>
          @if (cartDiscountPct() > 0) {
            <div class="ct-row ct-disc">
              <span>Descuento ({{ cartDiscountPct() }}%)</span>
              <span class="disc-val">-{{ fmtCOP(cartDiscountAmount()) }}</span>
            </div>
          }
          <div class="ct-total-divider"></div>
          <div class="ct-grand">
            <span>TOTAL</span>
            <div class="ct-grand-right">
              @if (cartDiscountPct() > 0) {
                <span class="ct-grand-original">{{ cartTotalCOP }}</span> 
              }
              <span class="ct-grand-amount">{{ fmtCOP(cartTotal()) }}</span>
            </div>
          </div>
          @if (selectedPaymentMethod() === 'CASH' && amountPaid() > cartTotal() && cart().length > 0) {
            <div class="ct-change-ticker">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11" aria-hidden="true"><path d="M8.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L2.324 8.384a.75.75 0 111.06-1.06l2.094 2.093L8.95 4.992a.25.25 0 01.02-.022z"/></svg>
              Cambio: <strong>{{ fmtCOP(changeAmount()) }}</strong>
            </div>
          }
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
          <div class="payment-header">
            <div class="ps-label">Método de pago</div>
            <div class="ps-current">{{ getPaymentLabel(selectedPaymentMethod()) }}</div>
          </div>
          <div class="pm-grid">
            @for (m of paymentMethods; track m.value) {
              <button class="pm-btn"
                      [attr.data-method]="m.value.toLowerCase()"
                      [class.pm-active]="selectedPaymentMethod() === m.value"
                      (click)="selectedPaymentMethod.set(m.value)">
                <span class="pm-icon">{{ m.emoji }}</span>
                <span class="pm-copy">
                  <span class="pm-name">{{ m.label }}</span>
                  <span class="pm-hint">{{ getPaymentHint(m.value) }}</span>
                </span>
              </button>
            }
          </div>
        </div>

        <!-- Charge button -->
        <div class="charge-wrap" id="tour-pos-charge">
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
        </div>
      </div><!-- /checkout-panel -->
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
                    } @else if (sale.status === 'ADVANCE') {
                      <div class="advance-actions">
                        <button class="link-btn adv-pay-btn" (click)="openAddPaymentModal(sale)">+Pago</button>
                        @if (sale.deliveryStatus === 'PENDING') {
                          <button class="link-btn adv-dlv-btn" (click)="openDeliverModal(sale)">Entregar</button>
                        }
                      </div>
                    } @else if (sale.status === 'COMPLETED' && sale.customer && sale.deliveryStatus === 'DELIVERED') {
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
                      @if (sale.status === 'COMPLETED' || sale.status === 'ADVANCE') {
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
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="close-session-title"
         (click)="showCloseSessionModal.set(false)" (keydown.escape)="showCloseSessionModal.set(false)">
      <div class="modal modal-close-session" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon red">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" aria-hidden="true"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"/></svg>
          </div>
          <div>
            <div class="modal-title" id="close-session-title">Cerrar Caja</div>
            <div class="modal-subtitle">Resumen de la sesión actual</div>
          </div>
          <button class="modal-close-btn" (click)="showCloseSessionModal.set(false)" aria-label="Cerrar modal">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Resumen de sesión -->
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

          <!-- Desglose por método de pago -->
          @if (sessionSummary()) {
            <div class="ssb-payment-breakdown">
              <div class="ssb-divider"></div>
              <div class="ssb-row">
                <span>💵 Efectivo en ventas</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.CASH?.total ?? 0) }}</strong>
              </div>
              <div class="ssb-row">
                <span>💳 Tarjeta</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.CARD?.total ?? 0) }}</strong>
              </div>
              <div class="ssb-row">
                <span>🏦 Transferencia</span>
                <strong>{{ fmtCOP(sessionSummary()?.byPaymentMethod?.TRANSFER?.total ?? 0) }}</strong>
              </div>
            </div>
          }

          <!-- Efectivo esperado en caja -->
          <div class="close-cash-section">
            <div class="ssb-divider"></div>
            <div class="ccs-expected-row">
              <span class="ccs-label">Efectivo esperado en caja</span>
              <span class="ccs-value">{{ fmtCOP(expectedCash()) }}</span>
            </div>
            <div class="field-group" style="margin-top:12px">
              <label for="close-cash">Efectivo real en caja (COP)</label>
              <input id="close-cash" type="number" [(ngModel)]="closeSessionCash"
                     min="0" step="1000" class="field-input big-input" placeholder="0"
                     aria-describedby="cash-diff-hint"/>
            </div>
            <!-- Diferencia en tiempo real -->
            @if (closeSessionCash > 0) {
              <div class="cash-difference" [class.diff-ok]="cashDiff() === 0" [class.diff-over]="cashDiff() > 0" [class.diff-short]="cashDiff() < 0" id="cash-diff-hint" role="status">
                @if (cashDiff() === 0) {
                  <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                  La caja cuadra perfectamente
                } @else if (cashDiff() > 0) {
                  <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/></svg>
                  Sobra {{ fmtCOP(cashDiff()) }}
                } @else {
                  <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path d="M4 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 014 8z"/></svg>
                  Falta {{ fmtCOP(-cashDiff()) }}
                }
              </div>
            }
          </div>

          <div class="field-group" style="margin-top:14px">
            <label for="close-notes">Notas del cierre (opcional)</label>
            <textarea id="close-notes" [(ngModel)]="closeSessionNotes" rows="2" class="field-input"
                      placeholder="Ej: Turno tarde, sin novedades..."></textarea>
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
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"
         (click)="showPaymentModal.set(false)"
         (keydown.escape)="showPaymentModal.set(false)"
         (keydown.enter)="isPaymentValid() && !processing() && processSale()">
      <div class="modal modal-pay" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" aria-hidden="true"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
          </div>
          <div>
            <div class="modal-title" id="payment-modal-title">Confirmar Cobro</div>
            <div class="modal-subtitle pm-badge pm-{{ selectedPaymentMethod().toLowerCase() }}">{{ getPaymentLabel(selectedPaymentMethod()) }}</div>
          </div>
          <button class="modal-close-btn" (click)="showPaymentModal.set(false)" aria-label="Cerrar modal de cobro">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <!-- Total grande -->
          <div class="pay-total-display">
            <span class="ptd-label">Total a cobrar</span>
            <span class="ptd-amount">{{ fmtCOP(cartTotal()) }}</span>
          </div>

          @if (selectedPaymentMethod() === 'CASH') {
            <!-- Campo de monto recibido -->
            <div class="field-group">
              <label for="amount-paid-input">Monto recibido del cliente (COP)</label>
              <input id="amount-paid-input" type="number" [ngModel]="amountPaid()"
                     (ngModelChange)="amountPaid.set(+$event)"
                     min="0" step="1000" class="field-input pay-amount-input"
                     placeholder="0" aria-describedby="change-display" />
            </div>

            <!-- Botones de billetes rápidos -->
            <div class="quick-bills">
              <button class="qb-btn qb-exact" (click)="amountPaid.set(cartTotal())"
                      aria-label="Establecer monto exacto">
                Exacto
              </button>
              @for (bill of quickBills; track bill) {
                <button class="qb-btn" (click)="amountPaid.set(amountPaid() + bill)"
                        [attr.aria-label]="'Agregar ' + fmtCOP(bill)">
                  +{{ fmtCOP(bill) }}
                </button>
              }
            </div>

            <!-- Cambio / Falta en tiempo real -->
            <div id="change-display" class="change-display" role="status" aria-live="polite">
              @if (amountPaid() <= 0) {
                <div class="cd-neutral">
                  <span>Ingresa el monto recibido</span>
                </div>
              } @else if (amountPaid() < cartTotal()) {
                <div class="cd-short">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M7.938 2.016A.13.13 0 018.002 2a.13.13 0 01.063.016.146.146 0 01.054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 01-.054.06.116.116 0 01-.066.017H1.146a.115.115 0 01-.066-.017.163.163 0 01-.054-.06.176.176 0 01.002-.183L7.884 2.073a.147.147 0 01.054-.057z"/></svg>
                  <span class="cd-label">Falta</span>
                  <strong class="cd-amount">{{ fmtCOP(cartTotal() - amountPaid()) }}</strong>
                </div>
              } @else {
                <div class="cd-ok">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                  <span class="cd-label">Cambio</span>
                  <strong class="cd-amount">{{ fmtCOP(changeAmount()) }}</strong>
                </div>
              }
            </div>
          } @else {
            <!-- Tarjeta / Transferencia: monto fijo -->
            <div class="pay-fixed-notice">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"/></svg>
              <div>
                <div class="pfn-title">El monto cobrado es</div>
                <div class="pfn-amount">{{ fmtCOP(cartTotal()) }}</div>
              </div>
            </div>
          }

          <!-- Toggle anticipo -->
          <div class="advance-toggle">
            <label class="adv-toggle-label">
              <input type="checkbox" [ngModel]="isAdvancePayment()" (ngModelChange)="isAdvancePayment.set($event); amountPaid.set(0)" />
              <span class="adv-toggle-text">Registrar como anticipo (pago parcial)</span>
            </label>
            @if (isAdvancePayment()) {
              <div class="adv-notice">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M8 15A7 7 0 108 1a7 7 0 000 14zm0 1A8 8 0 108 0a8 8 0 000 16z"/><path d="M5.255 5.786a.237.237 0 00.241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 00.25.246h.811a.25.25 0 00.25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/></svg>
                No se generará factura hasta entregar y completar el pago total.
              </div>
            }
          </div>

          <!-- Aviso de factura -->
          @if (selectedCustomer() && generateInvoice() && !isAdvancePayment()) {
            <div class="pay-invoice-notice">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
              Se generará una factura electrónica DRAFT para <strong>{{ selectedCustomer()!.name }}</strong>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showPaymentModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri btn-modal-lg" [class.btn-advance]="isAdvancePayment()" (click)="processSale()" [disabled]="processing() || !isPaymentValid()">
            @if (processing()) {
              <span class="spinner-sm"></span> Procesando...
            } @else if (isAdvancePayment()) {
              <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M8 1a5 5 0 00-5 5v1h1a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1V6a6 6 0 1112 0v6a2.5 2.5 0 01-2.5 2.5H9.366a1 1 0 01-.866.5h-1a1 1 0 110-2h1a1 1 0 01.866.5H11.5A1.5 1.5 0 0013 12h-1a1 1 0 01-1-1V8a1 1 0 011-1h1V6a5 5 0 00-5-5z"/></svg>
              Registrar Anticipo
            } @else {
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
              Confirmar Venta
            }
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Sale Success Overlay -->
  @if (completedSale()) {
    <div class="success-overlay" role="dialog" aria-modal="true" aria-labelledby="success-title">
      <div class="success-card">

        <!-- Ícono animado -->
        <div class="success-check-wrap">
          <svg class="success-check-svg" viewBox="0 0 80 80" fill="none" width="80" aria-hidden="true">
            <circle class="sc-ring-bg"  cx="40" cy="40" r="36" stroke="#d1fae5" stroke-width="3"/>
            <circle class="sc-ring-anim" cx="40" cy="40" r="36" stroke="#10b981" stroke-width="3"
                    stroke-dasharray="226" stroke-dashoffset="226" stroke-linecap="round"/>
            <path   class="sc-check-anim" d="M24 40l12 12 20-20" stroke="#10b981" stroke-width="3.5"
                    stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>

        <!-- Título -->
        <div class="success-title" id="success-title">
          {{ completedSale()!.status === 'ADVANCE' ? '¡Anticipo registrado!' : '¡Venta registrada!' }}
        </div>
        <div class="success-sale-num">{{ completedSale()!.saleNumber }}</div>

        <!-- Totales -->
        <div class="success-amounts">
          <div class="sa-row">
            <span>Total</span>
            <strong>{{ fmtCOP(completedSale()!.total) }}</strong>
          </div>
          <div class="sa-row">
            <span>{{ completedSale()!.status === 'ADVANCE' ? 'Anticipo recibido' : 'Recibido' }}</span>
            <strong>{{ fmtCOP(completedSale()!.amountPaid) }}</strong>
          </div>
          @if (completedSale()!.status === 'ADVANCE') {
            <div class="sa-row sa-pending">
              <span>Saldo pendiente</span>
              <strong>{{ fmtCOP(completedSale()!.remainingAmount) }}</strong>
            </div>
          }
        </div>

        <!-- Cambio prominente (solo efectivo con cambio > 0) -->
        @if (completedSale()!.paymentMethod === 'CASH' && completedSale()!.change > 0) {
          <div class="success-change-box">
            <span class="scb-label">Cambio a entregar</span>
            <span class="scb-amount">{{ fmtCOP(completedSale()!.change) }}</span>
          </div>
        }

        <!-- Factura generada -->
        @if (completedSale()!.invoice) {
          <div class="success-inv-badge">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" aria-hidden="true"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
            Factura {{ completedSale()!.invoice!.invoiceNumber }} generada
          </div>
        }

        <!-- Barra de auto-cierre -->
        <div class="success-progress-bar">
          <div class="success-progress-fill"></div>
        </div>
        <div class="success-autoclosehint">Se cerrará automáticamente en 8 s</div>

        <!-- Acciones -->
        <div class="success-actions">
          <button class="sa-btn" (click)="printReceipt(completedSale()!.id)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path d="M2.5 8a.5.5 0 100-1 .5.5 0 000 1z"/><path d="M5 1a2 2 0 00-2 2v2H2a2 2 0 00-2 2v3a2 2 0 002 2h1v1a2 2 0 002 2h6a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H5z"/></svg>
            Imprimir recibo
          </button>
          @if (completedSale()!.status === 'ADVANCE') {
            <button class="sa-btn" (click)="openAddPaymentModal(completedSale()!); dismissSuccessOverlay()">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M8 1a5 5 0 00-5 5v1h1a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1V6a6 6 0 1112 0v6a2.5 2.5 0 01-2.5 2.5H9.366a1 1 0 01-.866.5h-1a1 1 0 110-2h1a1 1 0 01.866.5H11.5A1.5 1.5 0 0013 12h-1a1 1 0 01-1-1V8a1 1 0 011-1h1V6a5 5 0 00-5-5z"/></svg>
              Agregar pago
            </button>
            <button class="sa-btn" (click)="openDeliverModal(completedSale()!); dismissSuccessOverlay()">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M0 3.5A1.5 1.5 0 011.5 2h9A1.5 1.5 0 0112 3.5V5h1.02a1.5 1.5 0 011.17.563l1.481 1.85a1.5 1.5 0 01.329.938V10.5a1.5 1.5 0 01-1.5 1.5H14a2 2 0 11-4 0H5a2 2 0 11-3.998-.085A1.5 1.5 0 010 10.5v-7z"/></svg>
              Marcar entregado
            </button>
          } @else if (!completedSale()!.invoiceId && completedSale()!.customer && completedSale()!.deliveryStatus === 'DELIVERED') {
            <button class="sa-btn" (click)="generateInvoiceForSale(completedSale()!)">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13" aria-hidden="true"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
              Generar factura
            </button>
          }
          <button class="sa-btn-primary" (click)="dismissSuccessOverlay()">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/></svg>
            Nueva venta
          </button>
        </div>

      </div>
    </div>
  }

  <!-- Add Payment Modal -->
  @if (showAddPaymentModal()) {
    <div class="overlay" role="dialog" aria-modal="true" (click)="showAddPaymentModal.set(false)">
      <div class="modal modal-adv" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon amber">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"/></svg>
          </div>
          <div>
            <div class="modal-title">Agregar Pago a Anticipo</div>
            <div class="modal-subtitle">{{ selectedAdvanceSale()?.saleNumber }}</div>
          </div>
          <button class="modal-close-btn" (click)="showAddPaymentModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="adv-summary-row">
            <span>Total venta</span><strong>{{ fmtCOP(selectedAdvanceSale()?.total ?? 0) }}</strong>
          </div>
          <div class="adv-summary-row">
            <span>Ya pagado</span><strong>{{ fmtCOP(selectedAdvanceSale()?.amountPaid ?? 0) }}</strong>
          </div>
          <div class="adv-summary-row pending">
            <span>Saldo pendiente</span><strong>{{ fmtCOP(selectedAdvanceSale()?.remainingAmount ?? 0) }}</strong>
          </div>
          <div class="field-group" style="margin-top:12px">
            <label>Monto a pagar (COP)</label>
            <input type="number" [(ngModel)]="addPaymentAmount" min="0.01" [max]="selectedAdvanceSale()?.remainingAmount ?? 0" class="field-input" />
          </div>
          <div class="field-group">
            <label>Método de pago</label>
            <select [(ngModel)]="addPaymentMethod" class="field-input">
              @for (m of paymentMethods; track m.value) {
                <option [value]="m.value">{{ m.label }}</option>
              }
            </select>
          </div>
          <div class="field-group">
            <label>Notas (opcional)</label>
            <input type="text" [(ngModel)]="addPaymentNotes" class="field-input" placeholder="Ej: Saldo final en efectivo" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showAddPaymentModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri" (click)="submitAddPayment()" [disabled]="processingAdvance() || addPaymentAmount <= 0">
            @if (processingAdvance()) { <span class="spinner-sm"></span> Procesando... } @else { Registrar Pago }
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Deliver Modal -->
  @if (showDeliverModal()) {
    <div class="overlay" role="dialog" aria-modal="true" (click)="showDeliverModal.set(false)">
      <div class="modal modal-adv" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M0 3.5A1.5 1.5 0 011.5 2h9A1.5 1.5 0 0112 3.5V5h1.02a1.5 1.5 0 011.17.563l1.481 1.85a1.5 1.5 0 01.329.938V10.5a1.5 1.5 0 01-1.5 1.5H14a2 2 0 11-4 0H5a2 2 0 11-3.998-.085A1.5 1.5 0 010 10.5v-7z"/></svg>
          </div>
          <div>
            <div class="modal-title">Marcar como Entregado</div>
            <div class="modal-subtitle">{{ selectedAdvanceSale()?.saleNumber }}</div>
          </div>
          <button class="modal-close-btn" (click)="showDeliverModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          @if (selectedAdvanceSale() && +(selectedAdvanceSale()!.remainingAmount) > 0) {
            <div class="adv-warn">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M7.938 2.016A.13.13 0 018.002 2a.13.13 0 01.063.016.146.146 0 01.054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 01-.054.06.116.116 0 01-.066.017H1.146a.115.115 0 01-.066-.017.163.163 0 01-.054-.06.176.176 0 01.002-.183L7.884 2.073a.147.147 0 01.054-.057z"/></svg>
              Saldo pendiente: <strong>{{ fmtCOP(selectedAdvanceSale()!.remainingAmount) }}</strong>. La venta quedará entregada pero aún se debe el saldo.
            </div>
          }
          <div class="field-group" style="margin-top:10px">
            <label>Notas de entrega (opcional)</label>
            <input type="text" [(ngModel)]="deliverNotes" class="field-input" placeholder="Ej: Entregado en bodega" />
          </div>
          @if (selectedAdvanceSale()?.customer && +(selectedAdvanceSale()?.remainingAmount ?? 1) <= 0) {
            <label class="adv-toggle-label" style="margin-top:10px">
              <input type="checkbox" [(ngModel)]="deliverGenerateInv" />
              <span class="adv-toggle-text">Generar factura electrónica al entregar</span>
            </label>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showDeliverModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri" (click)="submitDeliver()" [disabled]="processingAdvance()">
            @if (processingAdvance()) { <span class="spinner-sm"></span> Procesando... } @else { Confirmar Entrega }
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
      background:
        radial-gradient(circle at top left, rgba(0, 198, 160, 0.08), transparent 28%),
        radial-gradient(circle at top right, rgba(26, 64, 126, 0.08), transparent 24%),
        #f4f8fc;
      overflow:hidden;
      font-family: var(--font-b, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    }

    /* ═══════════════════════════════════════
       SESSION BAR
    ═══════════════════════════════════════ */
    .session-bar {
      display:flex; align-items:center; justify-content:space-between;
      padding:14px 20px;
      background:linear-gradient(135deg, #0d2344 0%, #16386a 52%, #0c7e70 100%);
      border-bottom:1px solid rgba(255,255,255,.08);
      flex-shrink:0; gap:16px;
      color:#fff;
      box-shadow:0 18px 30px rgba(12,28,53,.12);
    }
    .session-left { display:flex; align-items:center; justify-content:space-between; gap:18px; min-width:0; flex:1; }
    .session-headline { display:grid; gap:10px; min-width:220px; }
    .session-live { display:flex; align-items:center; gap:7px; }
    .live-dot {
      width:7px; height:7px; border-radius:50%;
      background:#10b981;
      box-shadow:0 0 0 3px rgba(16,185,129,.15);
      animation:pulse 2s ease infinite;
    }
    @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.15)} 50%{box-shadow:0 0 0 5px rgba(16,185,129,.08)} }
    .live-label { font-size:10px; font-weight:800; letter-spacing:.1em; color:#7ef4d8; text-transform:uppercase; }
    .session-operator { display:flex; align-items:center; gap:10px; }
    .session-avatar {
      width:38px; height:38px; border-radius:12px;
      background:rgba(255,255,255,.15);
      border:1px solid rgba(255,255,255,.18);
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:800; color:#fff; flex-shrink:0;
    }
    .session-operator strong { display:block; font-size:13px; font-weight:700; color:#fff; }
    .session-operator small { display:block; margin-top:2px; font-size:11px; color:rgba(236,244,255,.72); }
    .sb-stats { display:grid; grid-template-columns:repeat(5, minmax(92px, 1fr)); gap:10px; flex:1; }
    .sb-stat {
      display:flex; flex-direction:column; gap:4px;
      padding:10px 12px;
      border-radius:14px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.1);
      backdrop-filter:blur(10px);
      min-width:0;
    }
    .sb-stat-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:rgba(236,244,255,.66); }
    .sb-stat-val { font-size:13px; font-weight:800; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sb-stat.accent .sb-stat-val { color:#8bf3cb; }
    .sb-stat--focus { background:rgba(0,198,160,.16); border-color:rgba(138,243,203,.22); }
    .session-actions { display:flex; gap:7px; flex-shrink:0; }
    .sb-btn {
      display:flex; align-items:center; gap:5px; padding:5px 12px;
      border-radius:7px; font-size:11.5px; font-weight:600; cursor:pointer;
      background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.12);
      color:#fff; transition:all .14s;
      backdrop-filter:blur(8px);
    }
    .sb-btn:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.22); color:#fff; }
    .sb-btn.danger { background:rgba(239,68,68,.16); border-color:rgba(254,202,202,.32); color:#fff; }
    .sb-btn.danger:hover { background:rgba(239,68,68,.22); }

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
    .pos-layout {
      flex:1;
      min-height:0;
      display:grid;
      grid-template-columns:minmax(0, 1.18fr) minmax(420px, .82fr);
      gap:18px;
      padding:16px;
      overflow:hidden;
      align-items:stretch;
    }

    /* ══ Products Panel ══ */
    .products-panel {
      min-width:0; display:flex; flex-direction:column; overflow:hidden;
      background:rgba(255,255,255,.78);
      border:1px solid #dce6f0;
      border-radius:24px;
      box-shadow:0 18px 34px rgba(12,28,53,.06);
      backdrop-filter:blur(12px);
    }
    .catalog-tools {
      display:grid;
      gap:0;
      flex-shrink:0;
      border-top:1px solid #eef3f8;
      border-bottom:1px solid #dce6f0;
      background:rgba(255,255,255,.82);
    }
    .catalog-body {
      min-height:0;
      display:flex;
      flex-direction:column;
      flex:1;
    }
    .products-overview {
      display:flex; align-items:center; justify-content:space-between; gap:16px;
      padding:16px 18px 12px;
    }
    .po-copy h2 {
      margin:0;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:20px; line-height:1.05; letter-spacing:-.04em; color:#0c1c35;
    }
    .po-copy p:last-child { margin:8px 0 0; font-size:12px; color:#6b7f99; max-width:44ch; }
    .po-kicker {
      margin:0 0 8px; font-size:10px; font-weight:800; text-transform:uppercase;
      letter-spacing:.12em; color:#00a084;
    }
    .po-stats {
      display:grid; grid-template-columns:repeat(3, minmax(96px, 1fr)); gap:10px; flex-shrink:0;
    }
    .po-stat {
      padding:10px 12px; border-radius:14px; background:#fff; border:1px solid #dce6f0;
      box-shadow:0 10px 24px rgba(12,28,53,.05);
    }
    .po-stat span { display:block; font-size:10px; color:#8aa0b8; text-transform:uppercase; letter-spacing:.08em; font-weight:700; margin-bottom:4px; }
    .po-stat strong { font-family:var(--font-d, 'Sora', sans-serif); font-size:18px; color:#0c1c35; letter-spacing:-.05em; }
    .po-stat--accent { background:linear-gradient(135deg, #e7fbf5, #f5fffc); border-color:#c7f4e8; }
    .po-stat--accent strong { color:#00856f; }

    .panel-toolbar {
      display:flex; align-items:center; gap:12px; padding:12px 16px;
      border-bottom:1px solid #eef3f8; flex-shrink:0;
      background:rgba(255,255,255,.8);
      backdrop-filter:blur(12px);
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
      display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:12px; align-content:start;
    }
    .products-grid::-webkit-scrollbar { width:4px; }
    .products-grid::-webkit-scrollbar-thumb { background:#dce6f0; border-radius:2px; }

    .product-card {
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
      border:1px solid #dce6f0;
      border-radius:18px; overflow:hidden; cursor:pointer; position:relative;
      transition:all .16s ease;
      box-shadow:0 8px 24px rgba(12,28,53,.04);
      min-height:146px;
    }
    .product-card:not(.out-of-stock):hover {
      border-color:#9ec7ff;
      transform:translateY(-4px);
      box-shadow:0 18px 28px rgba(26,64,126,.1);
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
    .pc-name { font-size:12.5px; font-weight:700; color:#374151; line-height:1.35; margin-bottom:10px; min-height:34px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .pc-price { font-size:17px; font-weight:800; color:#1a407e; margin-bottom:10px; letter-spacing:-.3px; }
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
    .checkout-panel {
      min-width:0;
      background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); display:flex; flex-direction:column; overflow:hidden;
      border:1px solid #dce6f0;
      border-radius:24px;
      box-shadow:0 18px 34px rgba(12,28,53,.08);
      min-height:0;
    }
    .checkout-shell {
      min-height:0;
      display:flex;
      flex-direction:column;
      flex:1;
      overflow-y:auto;
      overscroll-behavior:contain;
      scroll-padding-bottom:110px;
    }
    .checkout-shell::-webkit-scrollbar { width:8px; }
    .checkout-shell::-webkit-scrollbar-track { background:transparent; }
    .checkout-shell::-webkit-scrollbar-thumb {
      background:rgba(140,160,183,.45);
      border-radius:999px;
      border:2px solid transparent;
      background-clip:padding-box;
    }
    .checkout-shell::-webkit-scrollbar-thumb:hover { background:rgba(95,122,152,.65); }

    /* Cart header */
    .cart-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 16px 12px; border-bottom:1px solid #eef3f8; flex-shrink:0;
    }
    .cart-header-left { display:flex; align-items:center; gap:8px; }
    .cart-header-left > div { display:grid; gap:2px; }
    .cart-icon { color:#1a407e; }
    .cart-title-text { font-size:13px; font-weight:700; color:#0c1c35; }
    .cart-title-sub { font-size:11px; color:#8ca0b7; }
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
    .cart-hero {
      margin:0 14px 12px;
      padding:14px 16px;
      border-radius:18px;
      background:
        radial-gradient(circle at top right, rgba(0,198,160,.18), transparent 36%),
        linear-gradient(135deg, #0f274b 0%, #17437e 58%, #0c8f79 100%);
      color:#fff;
      box-shadow:0 18px 34px rgba(12,28,53,.14);
    }
    .cart-hero-copy strong {
      display:block;
      margin-top:6px;
      font-family:var(--font-d, 'Sora', sans-serif);
      font-size:28px; line-height:1; letter-spacing:-.06em;
    }
    .cart-hero-copy span {
      display:block; margin-top:8px; color:rgba(236,244,255,.74); font-size:12px;
    }
    .cart-hero-kicker {
      margin:0; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; color:#89f3d1;
    }
    .cart-hero-badges { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; }
    .cart-hero-badge {
      padding:5px 10px; border-radius:999px;
      background:rgba(255,255,255,.12);
      border:1px solid rgba(255,255,255,.12);
      font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em;
    }
    .cart-hero-badge--accent { color:#8bf3cb; }
    .cart-hero-badge--warn { color:#fde68a; }

    /* Customer zone */
    .customer-zone { padding:10px 14px; border-bottom:1px solid #dce6f0; flex-shrink:0; background:#fff; }
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
    .cart-items {
      flex:0 0 auto;
      overflow:visible;
      padding:10px 10px 6px;
      min-height:140px;
      background:linear-gradient(180deg, #fbfdff 0%, #f5f9fc 100%);
    }
    .cart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:120px; gap:10px; }
    .ce-icon { opacity:.3; }
    .cart-empty p { color:#9ca3af; font-size:12px; margin:0; }

    .cart-item {
      background:#fff; border:1px solid #dce6f0;
      border-radius:14px; padding:11px 12px; margin-bottom:8px; transition:border-color .13s, box-shadow .13s, transform .13s;
      box-shadow:0 8px 18px rgba(12,28,53,.03);
    }
    .cart-item:hover { border-color:#93c5fd; box-shadow:0 12px 24px rgba(26,64,126,.06); transform:translateY(-1px); }
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
    .cart-totals { padding:12px 16px; border-top:1px solid #dce6f0; flex-shrink:0; background:#fff; box-shadow:0 -12px 24px rgba(12,28,53,.04); }
    .ct-row { display:flex; justify-content:space-between; font-size:12px; color:#9ca3af; padding:2px 0; }
    .ct-grand {
      display:flex; justify-content:space-between; align-items:center;
      padding:9px 12px; margin-top:8px;
      background:linear-gradient(135deg, #eff6ff, #f4fbff); border:1px solid #bfdbfe; border-radius:14px;
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
    .payment-section {
      margin:10px 14px 0;
      padding:14px;
      flex-shrink:0;
      background:
        radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 38%),
        linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%);
      border:1px solid #d7e3ef;
      border-radius:18px;
      box-shadow:0 12px 28px rgba(12,28,53,.05), inset 0 1px 0 rgba(255,255,255,.78);
    }
    .payment-header {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      margin-bottom:12px;
    }
    .ps-label {
      font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.12em;
      color:#58728f;
    }
    .ps-current {
      display:inline-flex; align-items:center; justify-content:center;
      padding:5px 10px;
      border-radius:999px;
      background:rgba(255,255,255,.8);
      border:1px solid #d7e3ef;
      color:#17437e;
      font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase;
      box-shadow:0 6px 16px rgba(12,28,53,.04);
    }
    .pm-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
    .pm-btn {
      display:flex; align-items:center; gap:10px;
      min-height:72px;
      padding:12px;
      border-radius:14px;
      background:rgba(255,255,255,.96);
      border:1px solid #d6e2ee;
      color:#2f435b; cursor:pointer; transition:all .16s;
      box-shadow:0 8px 18px rgba(12,28,53,.05);
      text-align:left;
    }
    .pm-btn:hover {
      background:#ffffff; border-color:#93c5fd; color:#1a407e;
      transform:translateY(-1px);
      box-shadow:0 12px 24px rgba(26,64,126,.1);
    }
    .pm-btn.pm-active {
      background:linear-gradient(135deg, #e9f3ff 0%, #eefbf7 100%);
      border-color:#1a407e;
      color:#123f7b;
      box-shadow:0 14px 24px rgba(26,64,126,.14);
    }
    .pm-btn[data-method="cash"] .pm-icon { background:#dcfce7; color:#15803d; }
    .pm-btn[data-method="card"] .pm-icon { background:#dbeafe; color:#1d4ed8; }
    .pm-btn[data-method="transfer"] .pm-icon { background:#ede9fe; color:#6d28d9; }
    .pm-btn[data-method="mixed"] .pm-icon { background:#fef3c7; color:#b45309; }
    .pm-btn.pm-active .pm-icon {
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.55), 0 8px 16px rgba(12,28,53,.08);
      transform:scale(1.02);
    }
    .pm-icon {
      width:40px; height:40px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      font-size:18px; line-height:1; flex-shrink:0;
    }
    .pm-copy {
      display:grid; gap:3px; min-width:0;
    }
    .pm-name { font-size:12px; font-weight:800; color:#0c1c35; }
    .pm-hint {
      font-size:10.5px; line-height:1.25;
      color:#6f88a4;
    }

    /* Charge button */
    .charge-wrap {
      padding:10px 14px 14px;
      flex-shrink:0;
      background:linear-gradient(180deg, rgba(255,255,255,.88) 0%, #ffffff 24%);
      border-top:1px solid #edf2f7;
      position:sticky;
      bottom:0;
      z-index:3;
      backdrop-filter:blur(10px);
      margin-top:auto;
    }
    .btn-charge {
      width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
      padding:15px 0; border-radius:16px; border:none; cursor:pointer;
      font-size:15px; font-weight:800; color:#fff; letter-spacing:.01em;
      background:linear-gradient(135deg, #103265, #2563eb 58%, #16a085);
      box-shadow:0 14px 26px rgba(26,64,126,.24);
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
    .status-chip.status-advance { background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; }
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

    /* Advance payment */
    .advance-toggle { margin-top:14px; }
    .adv-toggle-label { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12.5px; color:#374151; }
    .adv-toggle-label input[type=checkbox] { width:15px; height:15px; cursor:pointer; accent-color:#f59e0b; }
    .adv-toggle-text { font-weight:500; }
    .adv-notice {
      display:flex; align-items:center; gap:7px; margin-top:8px;
      padding:9px 12px; background:#fff7ed; border:1px solid #fed7aa;
      border-radius:8px; font-size:11.5px; color:#c2410c;
    }
    .btn-advance { background:#f59e0b !important; }
    .btn-advance:hover:not(:disabled) { background:#d97706 !important; }

    /* Advance sale actions in history */
    .advance-actions { display:flex; gap:5px; }
    .adv-pay-btn { color:#d97706 !important; }
    .adv-dlv-btn { color:#059669 !important; }

    /* Advance modal */
    .modal-adv { width:min(420px,94vw); }
    .modal-header-icon.amber { background:#fff7ed; color:#d97706; border:1px solid #fed7aa; }
    .adv-summary-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:6px 0; font-size:13px; border-bottom:1px solid #f3f4f6; color:#374151;
    }
    .adv-summary-row.pending { color:#c2410c; font-weight:600; border-bottom:none; }
    .adv-summary-row strong { font-weight:700; }
    .adv-warn {
      display:flex; align-items:flex-start; gap:8px; padding:10px 12px;
      background:#fff7ed; border:1px solid #fed7aa; border-radius:8px;
      font-size:12px; color:#92400e;
    }
    .adv-warn strong { font-weight:700; }

    /* Success pending amount */
    .sa-pending { color:#c2410c !important; }
    .sa-pending strong { color:#c2410c !important; }

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
      padding:8px 14px; border-bottom:1px solid #dce6f0; flex-shrink:0; background:#fff;
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

    /* ═══════════════════════════════════════
       SESSION CLOSE — MODAL AMPLIADO
    ═══════════════════════════════════════ */
    .modal-close-session { width:480px; }

    .close-cash-section { margin-top:4px; }
    .ccs-expected-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:8px 12px; background:#f0fdf4; border:1px solid #bbf7d0;
      border-radius:8px; margin-bottom:2px;
    }
    .ccs-label { font-size:12px; color:#065f46; font-weight:600; }
    .ccs-value { font-size:14px; font-weight:800; color:#059669; font-family:'Sora',sans-serif; }

    .cash-difference {
      display:flex; align-items:center; gap:7px; padding:9px 13px;
      border-radius:8px; font-size:13px; font-weight:600; margin-top:8px;
    }
    .diff-ok    { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .diff-over  { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
    .diff-short { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }

    /* ═══════════════════════════════════════
       PAYMENT MODAL — BILLETES RÁPIDOS
    ═══════════════════════════════════════ */
    .quick-bills {
      display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 12px;
    }
    .qb-btn {
      padding:5px 10px; border-radius:7px; font-size:11.5px; font-weight:600;
      background:#fff; border:1px solid #dce6f0; color:#374151;
      cursor:pointer; transition:all .13s; white-space:nowrap;
    }
    .qb-btn:hover { background:#eff6ff; border-color:#93c5fd; color:#1a407e; }
    .qb-exact {
      background:#dbeafe; border-color:#93c5fd; color:#1e40af;
    }
    .qb-exact:hover { background:#bfdbfe; }

    /* Cambio en tiempo real */
    .change-display {
      border-radius:10px; overflow:hidden; margin-top:4px;
    }
    .cd-neutral {
      padding:11px 16px; background:#f8fafc; border:1px solid #dce6f0;
      border-radius:10px; font-size:12.5px; color:#9ca3af; text-align:center;
    }
    .cd-short {
      display:flex; align-items:center; gap:8px; padding:11px 16px;
      background:#fee2e2; border:1px solid #fecaca; border-radius:10px;
      color:#dc2626;
    }
    .cd-ok {
      display:flex; align-items:center; gap:8px; padding:11px 16px;
      background:#d1fae5; border:1px solid #6ee7b7; border-radius:10px;
      color:#065f46;
    }
    .cd-label { font-size:13px; flex:1; font-weight:600; }
    .cd-amount { font-size:22px; font-weight:800; font-family:'Sora',sans-serif; }
    .cd-ok .cd-amount { color:#059669; }
    .cd-short .cd-amount { color:#dc2626; }

    /* Aviso de método no-efectivo */
    .pay-fixed-notice {
      display:flex; align-items:center; gap:14px; padding:16px;
      background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px;
      margin:4px 0 12px;
    }
    .pay-fixed-notice svg { color:#1e40af; flex-shrink:0; }
    .pfn-title { font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.06em; font-weight:700; margin-bottom:3px; }
    .pfn-amount { font-size:28px; font-weight:800; color:#1a407e; font-family:'Sora',sans-serif; letter-spacing:-.3px; }

    /* ═══════════════════════════════════════
       CART TOTALS — MEJORAS
    ═══════════════════════════════════════ */
    .ct-total-divider { height:1px; background:#dce6f0; margin:8px 0 4px; }
    .ct-grand-right { display:flex; flex-direction:column; align-items:flex-end; gap:1px; }
    .ct-grand-original {
      font-size:11px; color:#9ca3af; text-decoration:line-through; font-weight:400;
    }
    .ct-change-ticker {
      display:flex; align-items:center; justify-content:center; gap:5px;
      margin-top:7px; padding:6px 12px;
      background:#d1fae5; border:1px solid #6ee7b7; border-radius:8px;
      font-size:12.5px; color:#065f46;
    }
    .ct-change-ticker strong { font-size:14px; font-weight:800; }

    /* ═══════════════════════════════════════
       PRODUCT CARDS — STOCK BADGES
    ═══════════════════════════════════════ */
    .pc-stock-badge {
      font-size:9.5px; font-weight:700; padding:2px 7px;
      border-radius:9999px; letter-spacing:.02em;
    }
    .in-stock-badge  { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .low-stock-badge { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
    .out-of-stock-badge { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }

    /* ═══════════════════════════════════════
       CART EMPTY — MEJORADO
    ═══════════════════════════════════════ */
    .cart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:160px; gap:8px; padding:16px; }
    .ce-icon { opacity:.55; }
    .ce-title { color:#7ea3cc; font-size:13.5px; font-weight:700; margin:0; }
    .ce-hint  { color:#9ca3af; font-size:11.5px; margin:0; text-align:center; line-height:1.55; }

    /* ═══════════════════════════════════════
       SESSION BAR — TIEMPO DE SESIÓN
    ═══════════════════════════════════════ */
    .sb-session-time { color:#1a407e; font-family:'Courier New',monospace; font-size:11.5px; }

    /* ═══════════════════════════════════════
       SUCCESS OVERLAY (post-venta)
    ═══════════════════════════════════════ */
    .success-overlay {
      position:fixed; inset:0;
      background:rgba(12,28,53,.55);
      backdrop-filter:blur(4px);
      z-index:600;
      display:flex; align-items:center; justify-content:center;
      animation:fadeIn .2s ease;
    }

    .success-card {
      background:#fff; border-radius:20px;
      width:420px; max-width:95vw;
      box-shadow:0 20px 60px rgba(12,28,53,.18);
      animation:slideUp .22s ease;
      text-align:center; overflow:hidden;
      padding-bottom:8px;
    }

    /* Ícono check animado */
    .success-check-wrap { margin:28px auto 8px; display:flex; justify-content:center; }
    .success-check-svg  { display:block; }

    .sc-ring-anim {
      animation:ringDraw .55s ease-out .1s forwards;
      transform-origin:center; transform:rotate(-90deg);
    }
    @keyframes ringDraw {
      to { stroke-dashoffset:0; }
    }
    .sc-check-anim {
      stroke-dasharray:50; stroke-dashoffset:50;
      animation:checkDraw .35s ease-out .6s forwards;
    }
    @keyframes checkDraw {
      to { stroke-dashoffset:0; }
    }

    /* Cambio prominente */
    .success-change-box {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      margin:8px 22px 14px;
      padding:14px 20px;
      background:linear-gradient(135deg,#d1fae5,#a7f3d0);
      border:1.5px solid #6ee7b7; border-radius:14px;
    }
    .scb-label  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#065f46; }
    .scb-amount {
      font-size:36px; font-weight:800; color:#059669;
      font-family:'Sora',sans-serif; letter-spacing:-.5px;
      line-height:1.1;
    }

    /* Barra de progreso de auto-cierre */
    .success-progress-bar {
      height:3px; background:#f0f4f8; margin:12px 22px 4px; border-radius:2px; overflow:hidden;
    }
    .success-progress-fill {
      height:100%; background:#10b981; border-radius:2px;
      animation:progressShrink 8s linear forwards;
      width:100%;
    }
    @keyframes progressShrink {
      from { width:100%; }
      to   { width:0%; }
    }
    .success-autoclosehint {
      font-size:10.5px; color:#9ca3af; margin-bottom:6px;
    }
    @media (max-width: 1200px) {
      .session-left { flex-direction:column; align-items:stretch; }
      .sb-stats { grid-template-columns:repeat(3, minmax(92px, 1fr)); }
      .products-overview { flex-direction:column; align-items:stretch; }
      .po-stats { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 980px) {
      .pos-layout {
        display:flex;
        flex-direction:column;
        padding:12px;
      }
      .products-panel { border-right:none; }
      .checkout-panel { width:100%; min-width:0; }
    }
    @media (max-width: 760px) {
      .session-bar { padding:14px; flex-direction:column; align-items:stretch; }
      .session-actions { width:100%; }
      .session-actions .sb-btn { flex:1; justify-content:center; }
      .sb-stats { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .products-overview { padding:14px; }
      .po-stats { grid-template-columns:1fr; }
      .panel-toolbar { flex-direction:column; align-items:stretch; }
      .toolbar-right { justify-content:flex-end; }
      .pos-layout { padding:10px; gap:10px; }
      .products-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
      .cart-hero-copy strong { font-size:24px; }
      .cart-header { flex-direction:column; align-items:flex-start; gap:10px; }
      .pm-grid { grid-template-columns:repeat(2,1fr); }
    }
  `],
})
export class PosComponent implements OnInit, OnDestroy {
  private pos = inject(PosApiService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private customerSearch$ = new Subject<string>();

  @ViewChild('productSearchInput') productSearchInputRef?: ElementRef<HTMLInputElement>;

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

  // Tiempo de sesión transcurrido
  sessionElapsedSignal = signal('');
  private sessionTimerInterval: any;

  // Auto-cierre del overlay de éxito
  private successAutoCloseTimer: any;

  // Billetes colombianos rápidos
  readonly quickBills = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];

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
  generateInvoice    = signal(false);
  isAdvancePayment   = signal(false);
  cartDiscountPct    = signal(0);

  // Advance payment modals
  showAddPaymentModal  = signal(false);
  showDeliverModal     = signal(false);
  selectedAdvanceSale  = signal<PosSale | null>(null);
  addPaymentAmount     = 0;
  addPaymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' = 'CASH';
  addPaymentNotes      = '';
  deliverNotes         = '';
  deliverGenerateInv   = false;
  processingAdvance    = signal(false);

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
  cartCount    = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));
  availableProductsCount = computed(() => this.products().filter(p => p.stock > 0).length);
  lowStockProductsCount = computed(() => this.products().filter(p => p.stock > 0 && p.stock <= (p.minStock ?? 10)).length);
  sessionAverageTicket = computed(() => {
    const session = this.activeSession();
    if (!session || !session.totalTransactions) return 0;
    return Number(session.totalSales) / Number(session.totalTransactions);
  });
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
    if (this.isAdvancePayment()) return this.amountPaid() > 0 && this.amountPaid() < this.cartTotal();
    if (this.selectedPaymentMethod() === 'CASH') return this.amountPaid() >= this.cartTotal();
    return this.amountPaid() > 0;
  });

  // Efectivo esperado al cierre: inicial + ventas en efectivo
  expectedCash = computed(() => {
    const session = this.activeSession();
    if (!session) return 0;
    const cashSales = this.sessionSummary()?.byPaymentMethod?.CASH?.total ?? 0;
    return Number(session.initialCash) + Number(cashSales);
  });

  // Diferencia entre efectivo real ingresado y esperado (positivo = sobra, negativo = falta)
  cashDiff = computed(() => this.closeSessionCash - this.expectedCash());

  // Tiempo transcurrido desde la apertura de la sesión
  sessionElapsed = computed(() => {
    // Forzar reactividad a través de la señal del timer
    this.sessionElapsedSignal();
    const session = this.activeSession();
    if (!session?.openedAt) return '';
    const diffMs = Date.now() - new Date(session.openedAt).getTime();
    const totalMin = Math.floor(diffMs / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  });

  private productSearchTimer: any;

  constructor() {
    // Foco automático en el campo de búsqueda cuando la sesión esté activa
    afterNextRender(() => {
      if (this.activeSession()) {
        this.productSearchInputRef?.nativeElement?.focus();
      }
    });
  }

  ngOnInit() {
    this.loadActiveSession();
    this.loadProducts();
    this.initCustomerSearch();
    // Timer para actualizar el tiempo de sesión cada minuto
    this.sessionTimerInterval = setInterval(() => {
      this.sessionElapsedSignal.set(Date.now().toString());
      this.cdr.markForCheck();
    }, 60_000);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    clearInterval(this.sessionTimerInterval);
    clearTimeout(this.successAutoCloseTimer);
  }

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
    const isAdv = this.isAdvancePayment();
    const dto = {
      sessionId: session.id,
      customerId: this.selectedCustomer()?.id,
      items: this.cart().map(i => ({ productId:i.productId, description:i.description, quantity:i.quantity, unitPrice:i.unitPrice, taxRate:i.taxRate, discount:i.discount })),
      paymentMethod: this.selectedPaymentMethod(),
      amountPaid: this.amountPaid(),
      generateInvoice: !isAdv && this.generateInvoice() && !!this.selectedCustomer(),
      isAdvancePayment: isAdv || undefined,
      cartDiscountPct: this.cartDiscountPct() || undefined,
    };
    this.pos.createSale(dto).subscribe({
      next: (sale: any) => {
        this.completedSale.set(sale);
        this.cart.set([]);
        this.clearSelectedCustomer();
        this.generateInvoice.set(false);
        this.isAdvancePayment.set(false);
        this.showPaymentModal.set(false);
        this.processing.set(false);
        // Solo actualizar totales en sesión si la venta quedó COMPLETED
        if (sale.status === 'COMPLETED') {
          const s = this.activeSession()!;
          this.activeSession.set({ ...s, totalSales: Number(s.totalSales) + Number(sale.total), totalTransactions: s.totalTransactions + 1 });
        }
        if (this.showHistory()) this.loadSessionSales();
        clearTimeout(this.successAutoCloseTimer);
        this.successAutoCloseTimer = setTimeout(() => this.dismissSuccessOverlay(), 8_000);
        this.cdr.markForCheck();
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
    if (sale.status === 'ADVANCE') { this.notify.error('Primero completa el pago y marca el pedido como entregado'); return; }
    if (sale.deliveryStatus === 'PENDING') { this.notify.error('El pedido aún no ha sido entregado'); return; }
    this.pos.generateInvoiceFromSale(sale.id).subscribe({
      next: (inv: any) => {
        this.notify.success(`Factura ${inv.invoiceNumber} generada exitosamente`);
        if (this.showHistory()) this.loadSessionSales();
        if (this.completedSale()?.id === sale.id) this.completedSale.update(s => s ? { ...s, invoiceId:inv.id, invoice:inv } : null);
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al generar la factura'),
    });
  }

  openAddPaymentModal(sale: PosSale) {
    this.selectedAdvanceSale.set(sale);
    this.addPaymentAmount = Number(sale.remainingAmount);
    this.addPaymentMethod = 'CASH';
    this.addPaymentNotes = '';
    this.showAddPaymentModal.set(true);
  }

  submitAddPayment() {
    const sale = this.selectedAdvanceSale();
    if (!sale || this.addPaymentAmount <= 0) return;
    this.processingAdvance.set(true);
    this.pos.addPayment(sale.id, { amountPaid: this.addPaymentAmount, paymentMethod: this.addPaymentMethod, notes: this.addPaymentNotes || undefined }).subscribe({
      next: (updated: any) => {
        this.processingAdvance.set(false);
        this.showAddPaymentModal.set(false);
        this.notify.success(updated.status === 'COMPLETED' ? 'Pago completado. Venta finalizada.' : 'Pago parcial registrado');
        if (updated.status === 'COMPLETED') {
          const s = this.activeSession();
          if (s) this.activeSession.set({ ...s, totalSales: Number(s.totalSales) + Number(updated.total), totalTransactions: s.totalTransactions + 1 });
        }
        this.loadSessionSales();
      },
      error: (err: any) => { this.processingAdvance.set(false); this.notify.error(err?.error?.message ?? 'Error al registrar el pago'); },
    });
  }

  openDeliverModal(sale: PosSale) {
    this.selectedAdvanceSale.set(sale);
    this.deliverNotes = '';
    this.deliverGenerateInv = !!sale.customer && Number(sale.remainingAmount) <= 0;
    this.showDeliverModal.set(true);
  }

  submitDeliver() {
    const sale = this.selectedAdvanceSale();
    if (!sale) return;
    this.processingAdvance.set(true);
    this.pos.markDelivered(sale.id, { notes: this.deliverNotes || undefined, generateInvoice: this.deliverGenerateInv }).subscribe({
      next: (updated: any) => {
        this.processingAdvance.set(false);
        this.showDeliverModal.set(false);
        if (updated.invoice) {
          this.notify.success(`Pedido entregado y factura ${updated.invoice.invoiceNumber} generada`);
        } else {
          this.notify.success('Pedido marcado como entregado');
        }
        if (updated.status === 'COMPLETED' && sale.status !== 'COMPLETED') {
          const s = this.activeSession();
          if (s) this.activeSession.set({ ...s, totalSales: Number(s.totalSales) + Number(updated.total), totalTransactions: s.totalTransactions + 1 });
        }
        this.loadSessionSales();
      },
      error: (err: any) => { this.processingAdvance.set(false); this.notify.error(err?.error?.message ?? 'Error al marcar entregado'); },
    });
  }

  dismissSuccessOverlay() {
    clearTimeout(this.successAutoCloseTimer);
    this.completedSale.set(null);
    this.cartDiscountPct.set(0);
    this.amountPaid.set(0);
    this.selectedPaymentMethod.set('CASH');
    this.isAdvancePayment.set(false);
    setTimeout(() => this.productSearchInputRef?.nativeElement?.focus(), 100);
    this.cdr.markForCheck();
  }

  getPaymentLabel(m: string): string { return this.paymentMethods.find(x => x.value === m)?.label ?? m; }
  getPaymentHint(m: string): string {
    return ({
      CASH: 'Pago inmediato con cambio',
      CARD: 'Cobro por datáfono',
      TRANSFER: 'Confirmar transferencia',
      MIXED: 'Combina varios medios',
    } as Record<string, string>)[m] ?? 'Seleccionar medio de pago';
  }
  getStatusLabel(s: string): string { return ({ COMPLETED:'Completada', CANCELLED:'Cancelada', REFUNDED:'Reembolsada', ADVANCE:'Anticipo' } as any)[s] ?? s; }

  fmtCOP(n: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(Number(n ?? 0));
  }

  get cartTotalCOP() {
    return this.cart().reduce((s, i) => s + i.total, 0);
  }
}
