import {
  Component, OnInit, OnDestroy, signal, computed, inject,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, afterNextRender, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../core/confirm-dialog/confirm-dialog.component';
import { PosApiService, CartItem, PosCatalogProduct, PosCombo, PosConfigDeployment, PosCoupon, PosCustomerAccountStatement, PosCustomerLoyaltyProfile, PosExternalOrder, PosGovernanceAction, PosGovernanceRule, PosIntegrationSummary, PosInventoryLocation, PosInventoryStock, PosInventoryTransfer, PosInvoiceDetail, PosLoyaltyCampaign, PosMultiBranchOverview, PosOperatingConfig, PosOperationalIncident, PosPaymentMethod, PosPostSaleRequest, PosPriceList, PosPricingPreview, PosPromotion, PosSale, PosSalePayment, PosSalesAnalytics, PosSession, PosShiftTemplate, PosSupervisorOverride, PosTerminal, PosAuditEntry } from './pos.service';

interface Product {
  id: string; name: string; sku: string; price: number;
  taxRate: number; taxType: string; stock: number; unit: string; minStock?: number;
  availableStock?: number; reservedStock?: number; hasInventoryDetail?: boolean;
  inventoryLocations?: PosCatalogProduct['inventoryLocations'];
}
interface Customer {
  id: string; name: string; documentNumber: string; documentType: string;
  loyaltyCode?: string | null;
  membershipTier?: string | null;
  customerSegment?: string | null;
  loyaltyPointsBalance?: number;
}

interface EditablePaymentLine {
  paymentMethod: PosPaymentMethod;
  amount: number;
  transactionReference?: string;
  providerName?: string;
  notes?: string;
}

interface PosPostSaleFormLine {
  saleItemId: string;
  description: string;
  soldQuantity: number;
  quantity: number;
}

interface PosPostSaleReplacementLine {
  productId: string;
  quantity: number;
}

interface QueuedPosSalePayload {
  clientSyncId: string;
  createdAt: string;
  payload: any;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
<div #posRoot class="pos-root" [class.pos-root--fullscreen]="isFullscreen()">

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
                @if (activeSession()?.terminal || activeSession()?.shiftTemplate) {
                  <small>
                    {{ activeSession()?.terminal?.code || 'Sin caja' }}{{ activeSession()?.terminal?.name ? ' · ' + activeSession()?.terminal?.name : '' }}
                    {{ activeSession()?.shiftTemplate?.name ? ' · ' + activeSession()?.shiftTemplate?.name : '' }}
                  </small>
                @if (activeSession()?.terminal?.lastHeartbeatAt) {
                    <small>
                      Heartbeat {{ activeSession()?.terminal?.lastHeartbeatAt | date:'shortTime' }}
                    </small>
                  }
                  @if (offlineMode()) {
                    <small class="session-alert session-alert--offline">
                      Modo offline · {{ pendingOfflineQueue().length }} ventas pendientes
                    </small>
                  } @else if (pendingOfflineQueue().length > 0) {
                    <small class="session-alert session-alert--degraded">
                      Sincronización diferida · {{ pendingOfflineQueue().length }} pendientes
                    </small>
                  }
                }
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
        <button class="sb-btn" (click)="openOperatingConfigModal()">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M9.243 1.604a1 1 0 00-1.486 0l-.62.69a1 1 0 01-1.06.27l-.9-.276a1 1 0 00-1.22.74l-.18.923a1 1 0 01-.79.79l-.923.18a1 1 0 00-.74 1.22l.275.9a1 1 0 01-.27 1.06l-.69.62a1 1 0 000 1.486l.69.62a1 1 0 01.27 1.06l-.276.9a1 1 0 00.74 1.22l.923.18a1 1 0 01.79.79l.18.923a1 1 0 001.22.74l.9-.275a1 1 0 011.06.27l.62.69a1 1 0 001.486 0l.62-.69a1 1 0 011.06-.27l.9.276a1 1 0 001.22-.74l.18-.923a1 1 0 01.79-.79l.923-.18a1 1 0 00.74-1.22l-.275-.9a1 1 0 01.27-1.06l.69-.62a1 1 0 000-1.486l-.69-.62a1 1 0 01-.27-1.06l.276-.9a1 1 0 00-.74-1.22l-.923-.18a1 1 0 01-.79-.79l-.18-.923a1 1 0 00-1.22-.74l-.9.275a1 1 0 01-1.06-.27l-.62-.69zM8.5 10.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
          Configuración POS
        </button>
        <button class="sb-btn" (click)="openCashMovementModal()">
          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M8 1a.5.5 0 01.5.5V3h3a.5.5 0 010 1h-3v2h3a.5.5 0 010 1h-3v2h3a.5.5 0 010 1h-3v2h3a.5.5 0 010 1h-3v1.5a.5.5 0 01-1 0V13H5a2 2 0 01-2-2V5a2 2 0 012-2h2.5V1.5A.5.5 0 018 1z"/></svg>
          Movimientos de caja
        </button>
        <button class="sb-btn sb-btn--fullscreen" (click)="toggleFullscreen()" [attr.aria-pressed]="isFullscreen()" [title]="isFullscreen() ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'">
          @if (isFullscreen()) {
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M2.5 10a.5.5 0 01.5.5V13h2.5a.5.5 0 010 1h-3A.5.5 0 012 13.5v-3a.5.5 0 01.5-.5zm11 0a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-3a.5.5 0 010-1H13v-2.5a.5.5 0 01.5-.5zm-8-8A.5.5 0 015 2.5V5H2.5a.5.5 0 010-1h3A.5.5 0 016 4.5v-3a.5.5 0 01.5-.5zm8 0a.5.5 0 01.5.5v3A.5.5 0 0113.5 6h-3a.5.5 0 010-1H13V2.5a.5.5 0 01.5-.5z"/></svg>
            Salir pantalla completa
          } @else {
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M1.5 1A.5.5 0 012 1.5V4h2.5a.5.5 0 010 1h-3A.5.5 0 011 4.5v-3A.5.5 0 011.5 1zm13 0a.5.5 0 01.5.5v3a.5.5 0 01-1 0V2h-2.5a.5.5 0 010-1h3zM1 11.5a.5.5 0 011 0V14h2.5a.5.5 0 010 1h-3A.5.5 0 011 14.5v-3zm13 0a.5.5 0 011 0v3a.5.5 0 01-.5.5h-3a.5.5 0 010-1H14v-2.5z"/></svg>
            Pantalla completa
          }
        </button>
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
        <div class="no-session-summary" *ngIf="operatingConfig() as config">
          <span>{{ config.branch?.name ?? 'Sucursal no detectada' }}</span>
          <strong>{{ terminals().length }} cajas · {{ shiftTemplates().length }} turnos</strong>
        </div>
        <button class="btn-open-session btn-open-session--secondary" (click)="openOperatingConfigModal()">
          Configuración operativa
        </button>
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

            @if (inventoryLocations().length > 0) {
              <div class="catalog-location-bar">
                <label class="field-group">
                  <span>Bodega POS</span>
                  <select class="field-input" [ngModel]="selectedInventoryLocationId()" (ngModelChange)="selectedInventoryLocationId.set($event); loadProducts(productSearch)">
                    <option value="">Automática</option>
                    @for (location of inventoryLocations(); track location.id) {
                      <option [value]="location.id">{{ location.code }} · {{ location.name }}</option>
                    }
                  </select>
                </label>
              </div>
            }

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
                <div class="product-card" [class.out-of-stock]="(p.availableStock ?? p.stock) <= 0"
                     (click)="addToCart(p)"
                     [attr.aria-disabled]="(p.availableStock ?? p.stock) <= 0"
                     [attr.title]="(p.availableStock ?? p.stock) <= 0 ? 'Sin stock disponible' : ('Agregar ' + p.name + ' al carrito')">
                  @if ((p.availableStock ?? p.stock) <= 0) {
                    <div class="pc-ribbon out">✗ Sin stock</div>
                  } @else if ((p.availableStock ?? p.stock) <= (p.minStock ?? 10)) {
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
                      @if ((p.availableStock ?? p.stock) <= 0) {
                        <span class="pc-stock-badge out-of-stock-badge">✗ Sin stock</span>
                      } @else if ((p.availableStock ?? p.stock) <= (p.minStock ?? 10)) {
                        <span class="pc-stock-badge low-stock-badge">⚠ {{ p.availableStock ?? p.stock }} {{ p.unit }}</span>
                      } @else {
                        <span class="pc-stock-badge in-stock-badge">✓ {{ p.availableStock ?? p.stock }} {{ p.unit }}</span>
                      }
                      @if ((p.availableStock ?? p.stock) > 0) {
                        <div class="pc-add-btn" aria-hidden="true">
                          <svg viewBox="0 0 12 12" fill="currentColor" width="11"><path d="M6 1a.5.5 0 01.5.5v4h4a.5.5 0 010 1h-4v4a.5.5 0 01-1 0v-4h-4a.5.5 0 010-1h4v-4A.5.5 0 016 1z"/></svg>
                        </div>
                      }
                    </div>
                    @if ((p.reservedStock ?? 0) > 0 || p.hasInventoryDetail) {
                      <div class="pc-submeta">
                        @if ((p.reservedStock ?? 0) > 0) {
                          <span>Reservado: {{ p.reservedStock }}</span>
                        }
                        @if (p.inventoryLocations?.length) {
                          <span>{{ p.inventoryLocations!.length }} bodegas/lotes</span>
                        }
                      </div>
                    }
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
                @if (customerLoyaltyProfile()) {
                  <div class="cs-loyalty">
                    <span class="cart-hero-badge">{{ customerLoyaltyProfile()!.customer.membershipTier || 'Frecuente' }}</span>
                    <span class="cart-hero-badge cart-hero-badge--accent">{{ customerLoyaltyProfile()!.customer.loyaltyPointsBalance }} pts</span>
                    @if (customerLoyaltyProfile()!.customer.customerSegment) {
                      <span class="cart-hero-badge">{{ customerLoyaltyProfile()!.customer.customerSegment }}</span>
                    }
                  </div>
                  <small class="cs-loyalty-meta">
                    {{ customerLoyaltyProfile()!.metrics.salesCount }} compras · ticket prom. {{ fmtCOP(customerLoyaltyProfile()!.metrics.averageTicket) }}
                  </small>
                }
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
          <div class="field-group ct-price-list">
            <label for="pos-price-list">Lista de precios POS</label>
            <select id="pos-price-list" class="field-input" [ngModel]="selectedPriceListId()" (ngModelChange)="onPriceListSelected($event)">
              <option value="">Tarifa base</option>
              @for (priceList of priceLists(); track priceList.id) {
                <option [value]="priceList.id">{{ priceList.name }}</option>
              }
            </select>
          </div>
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
          @if (pricingPreview()) {
            @if (pricingPreview()!.orderPromotionDiscount > 0) {
              <div class="ct-row ct-disc">
                <span>Promoción automática</span>
                <span class="disc-val">-{{ fmtCOP(pricingPreview()!.orderPromotionDiscount) }}</span>
              </div>
            }
            @if (pricingPreview()!.comboDiscount > 0) {
              <div class="ct-row ct-disc">
                <span>Combos aplicados</span>
                <span class="disc-val">-{{ fmtCOP(pricingPreview()!.comboDiscount) }}</span>
              </div>
            }
            @if (pricingPreview()!.appliedOrderPromotions.length || pricingPreview()!.appliedCombos.length) {
              <div class="promo-preview-card">
                @if (pricingPreview()!.priceList) {
                  <div><strong>Tarifa:</strong> {{ pricingPreview()!.priceList!.name }}</div>
                }
                @if (pricingPreview()!.appliedOrderPromotions.length) {
                  <div><strong>Promos:</strong> {{ pricingPreview()!.appliedOrderPromotions.join(', ') }}</div>
                }
                @if (pricingPreview()!.appliedCombos.length) {
                  <div><strong>Combos:</strong> {{ getAppliedComboNames(pricingPreview()!) }}</div>
                }
              </div>
            }
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
          @if (cashPaymentTotal() > 0 && paymentTotal() > cartTotal() && cart().length > 0) {
            <div class="ct-change-ticker">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11" aria-hidden="true"><path d="M8.97 4.97a.75.75 0 011.07 1.05l-3.99 4.99a.75.75 0 01-1.08.02L2.324 8.384a.75.75 0 111.06-1.06l2.094 2.093L8.95 4.992a.25.25 0 01.02-.022z"/></svg>
              Cambio: <strong>{{ fmtCOP(changeAmount()) }}</strong>
            </div>
          }
        </div>

        <!-- Invoice toggle — always visible -->
        <div class="invoice-toggle" [class.active]="generateInvoice() && !!selectedCustomer()" [class.it-disabled]="!selectedCustomer()" (click)="selectedCustomer() && generateInvoice.set(!generateInvoice())">
          <div class="it-checkbox" [class.checked]="generateInvoice() && !!selectedCustomer()">
            @if (generateInvoice() && selectedCustomer()) {
              <svg viewBox="0 0 12 12" fill="none" width="10"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            }
          </div>
          <div class="it-text">
            <span class="it-main">¿Requiere factura electrónica?</span>
            @if (!selectedCustomer()) {
              <span class="it-sub it-sub--warn">Selecciona un cliente para habilitar</span>
            } @else {
              <span class="it-sub">{{ generateInvoice() ? 'Se generará factura para ' + selectedCustomer()!.name : 'Toca para activar la facturación electrónica' }}</span>
            }
          </div>
          <svg viewBox="0 0 16 16" fill="currentColor" width="13" class="it-doc-icon"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
        </div>

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
                      (click)="setPrimaryPaymentMethod(m.value)">
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
                    <span class="pm-chip" [ngClass]="getPaymentClass(sale.paymentMethod)">
                      {{ getPaymentMethodSummary(sale) }}
                    </span>
                  </td>
                  <td class="tr"><strong class="td-total">{{ fmtCOP(sale.total) }}</strong></td>
                  <td class="tc">
                    <div class="status-stack">
                      <span class="status-chip status-{{ sale.status.toLowerCase() }}">{{ getStatusLabel(sale.status) }}</span>
                      @if (sale.postSaleRequests?.length) {
                        <span class="history-badge">
                          {{ sale.postSaleRequests![0].type === 'EXCHANGE' ? 'Cambio' : 'Devolución' }}
                          · {{ getPostSaleStatusLabel(sale.postSaleRequests![0].status) }}
                        </span>
                      }
                    </div>
                  </td>
                  <td class="tc">
                    @if (sale.invoiceId && sale.invoice) {
                      <div class="inv-dian-cell">
                        <div class="inv-dian-head">
                          <span class="inv-chip inv-chip--sm inv-chip--number">
                            <svg viewBox="0 0 12 12" fill="currentColor" width="9"><path fill-rule="evenodd" d="M10 6a4 4 0 11-8 0 4 4 0 018 0zm-3.78-1.28a.75.75 0 00-1.06 1.06l1.5 1.5a.75.75 0 001.06 0l2.5-2.5a.75.75 0 00-1.06-1.06L6.25 5.69l-.97-.97z"/></svg>
                            {{ sale.invoice.invoiceNumber }}
                          </span>
                          @if (sale.invoice.status === 'ACCEPTED_DIAN') {
                            <span class="dian-badge dian-accepted">DIAN ✓</span>
                          } @else if (sale.invoice.status === 'PAID') {
                            <span class="dian-badge dian-paid">Pagada</span>
                          } @else if (sale.invoice.status === 'REJECTED_DIAN') {
                            <span class="dian-badge dian-rejected">DIAN ✗</span>
                          } @else if (sale.invoice.status === 'SENT_DIAN') {
                            <span class="dian-badge dian-sent">En revisión</span>
                          } @else {
                            <span class="dian-badge dian-draft">Pendiente</span>
                          }
                        </div>
                        <div class="inv-dian-actions">
                          <button class="history-link-btn history-link-btn--neutral" (click)="openInvoiceModal(sale)">
                            <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M8 3C4.5 3 1.61 5.167.5 8c1.11 2.833 4 5 7.5 5s6.39-2.167 7.5-5c-1.11-2.833-4-5-7.5-5zm0 8.5A3.5 3.5 0 118 4.5a3.5 3.5 0 010 7zm0-1.5A2 2 0 108 6a2 2 0 000 4z"/></svg>
                            Ver
                          </button>
                          @if (sale.invoice.status === 'SENT_DIAN') {
                            <button class="history-link-btn history-link-btn--dian" (click)="queryDianStatus(sale)" [disabled]="queryingDian[sale.id]">
                              <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M8 3a5 5 0 00-4.546 2.916.5.5 0 11-.908-.418 6 6 0 111.2 6.635.5.5 0 11.84-.542A5 5 0 108 3z"/><path d="M8.5 5.5a.5.5 0 00-1 0V8c0 .133.053.26.146.354l1.5 1.5a.5.5 0 00.708-.708L8.5 7.793V5.5z"/></svg>
                              {{ queryingDian[sale.id] ? 'Consultando…' : 'Consultar' }}
                            </button>
                          } @else if (sale.invoice.status === 'DRAFT' || sale.invoice.status === 'ISSUED') {
                            <button class="history-link-btn history-link-btn--dian" (click)="submitInvoiceToDian(sale)" [disabled]="sendingDian[sale.id]">
                              <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path d="M8.5 1.5a.5.5 0 00-1 0v6.293L5.354 5.646a.5.5 0 10-.708.708l3 3a.498.498 0 00.708 0l3-3a.5.5 0 10-.708-.708L8.5 7.793V1.5z"/><path d="M2.5 10a.5.5 0 00-.5.5v1A2.5 2.5 0 004.5 14h7a2.5 2.5 0 002.5-2.5v-1a.5.5 0 00-1 0v1A1.5 1.5 0 0111.5 13h-7A1.5 1.5 0 013 11.5v-1a.5.5 0 00-.5-.5z"/></svg>
                              {{ sendingDian[sale.id] ? 'Enviando…' : 'Enviar' }}
                            </button>
                          }
                        </div>
                      </div>
                    } @else if (sale.invoiceId) {
                      <span class="inv-chip">Vinculada</span>
                    } @else if (sale.status === 'ADVANCE' || sale.deliveryStatus === 'PENDING') {
                      <div class="advance-actions">
                        @if (sale.status === 'ADVANCE') {
                          <button class="link-btn adv-pay-btn" (click)="openAddPaymentModal(sale)">+Pago</button>
                        }
                        @if (sale.orderType === 'DELIVERY' && sale.orderStatus !== 'IN_TRANSIT' && sale.deliveryStatus === 'PENDING') {
                          <button class="link-btn adv-dlv-btn" (click)="openDispatchModal(sale)">Despachar</button>
                        }
                        @if (sale.deliveryStatus === 'PENDING') {
                          <button class="link-btn adv-dlv-btn" (click)="openDeliverModal(sale)">{{ sale.orderType === 'PICKUP' ? 'Recoger' : 'Entregar' }}</button>
                        }
                      </div>
                    } @else if (sale.status === 'COMPLETED' && sale.customer && sale.deliveryStatus === 'DELIVERED') {
                      <button class="history-link-btn history-link-btn--primary" (click)="generateInvoiceForSale(sale)">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/><path d="M8 7a.5.5 0 01.5.5V9H10a.5.5 0 010 1H8.5v1.5a.5.5 0 01-1 0V10H6a.5.5 0 010-1h1.5V7.5A.5.5 0 018 7z"/></svg>
                        Generar
                      </button>
                    } @else {
                      <span class="td-dash">—</span>
                    }
                  </td>
                  <td class="tc">
                    @if (sale.orderType !== 'IN_STORE') {
                      <div class="history-badges-row" style="margin-bottom:6px">
                        <span class="history-badge">{{ getOrderTypeLabel(sale.orderType) }}</span>
                        <span class="history-badge">{{ getOrderStatusLabel(sale.orderStatus) }}</span>
                      </div>
                    }
                    <div class="td-actions">
                      <button class="tda-btn" (click)="printReceipt(sale.id)" title="Imprimir tirilla" aria-label="Imprimir tirilla">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M2.5 8a.5.5 0 100-1 .5.5 0 000 1z"/><path d="M5 1a2 2 0 00-2 2v2H2a2 2 0 00-2 2v3a2 2 0 002 2h1v1a2 2 0 002 2h6a2 2 0 002-2v-1h1a2 2 0 002-2V7a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H5zM4 3a1 1 0 011-1h6a1 1 0 011 1v2H4V3zm1 5a2 2 0 00-2 2v1H2a1 1 0 01-1-1V7a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1h-1v-1a2 2 0 00-2-2H5zm7 2v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3a1 1 0 011-1h6a1 1 0 011 1z"/></svg>
                        <span>Imprimir</span>
                      </button>
                      @if (sale.status === 'COMPLETED') {
                        <button class="tda-btn" (click)="openPostSaleModal(sale)" title="Registrar postventa" aria-label="Registrar postventa">
                          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M8 1a.5.5 0 01.5.5V3h2.5A1.5 1.5 0 0112.5 4.5V7a.5.5 0 01-1 0V4.5a.5.5 0 00-.5-.5H8.5v1.5a.5.5 0 01-1 0V4H5a.5.5 0 00-.5.5V7a.5.5 0 01-1 0V4.5A1.5 1.5 0 015 3h2.5V1.5A.5.5 0 018 1zm-4 8a.5.5 0 01.5.5V12a1 1 0 001 1h5a.5.5 0 010 1h-5A2 2 0 013.5 12V9.5A.5.5 0 014 9zm8 0a.5.5 0 01.5.5V12A2 2 0 0110.5 14H9a.5.5 0 010-1h1.5a1 1 0 001-1V9.5A.5.5 0 0112 9zm-2.146.146a.5.5 0 01.707 0L12 10.586l1.439-1.44a.5.5 0 11.707.708l-1.792 1.793a1 1 0 01-1.414 0L9.146 9.854a.5.5 0 010-.708z"/></svg>
                          <span>Postventa</span>
                        </button>
                        <button class="tda-btn" (click)="refundSale(sale)" title="Reembolsar venta" aria-label="Reembolsar venta">
                          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M8 2a5.5 5.5 0 1 0 5.473 6.045.5.5 0 1 1 .994.11A6.5 6.5 0 1 1 8 1.5v-1a.5.5 0 0 1 1 0V2h1.5a.5.5 0 0 1 0 1H8.207l1.147 1.146a.5.5 0 0 1-.708.708l-2-2a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L8.207 2H8z"/></svg>
                          <span>Reembolsar</span>
                        </button>
                      }
                      @if (sale.status === 'COMPLETED' || sale.status === 'ADVANCE') {
                        <button class="tda-btn danger" (click)="cancelSale(sale.id)" title="Cancelar venta" aria-label="Cancelar venta">
                          <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                          <span>Cancelar</span>
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
          @if (terminals().length > 0) {
            <div class="field-group">
              <label>Caja / terminal POS</label>
              <select [(ngModel)]="openSessionTerminalId" class="field-input">
                <option value="">Selecciona una caja</option>
                @for (terminal of terminals(); track terminal.id) {
                  <option [value]="terminal.id">{{ terminal.code }} · {{ terminal.name }}{{ terminal.cashRegisterName ? ' · ' + terminal.cashRegisterName : '' }}</option>
                }
              </select>
              @if (selectedOpenTerminal()) {
                <small class="field-hint">Impresora: {{ selectedOpenTerminal()?.printerName || 'No definida' }} · Prefijo: {{ selectedOpenTerminal()?.invoicePrefix || 'POS' }}</small>
              }
            </div>
          }
          @if (shiftTemplates().length > 0) {
            <div class="field-group">
              <label>Turno operativo</label>
              <select [(ngModel)]="openSessionShiftId" class="field-input">
                <option value="">Sin turno específico</option>
                @for (shift of shiftTemplates(); track shift.id) {
                  <option [value]="shift.id">{{ shift.name }} · {{ shift.startTime }} - {{ shift.endTime }}</option>
                }
              </select>
            </div>
          }
          <div class="field-group">
            <label>Efectivo inicial (COP)</label>
            <input type="number" [(ngModel)]="openSessionCash" min="0" step="1000" class="field-input big-input" placeholder="0"/>
          </div>
          <div class="field-group">
            <label>Notas (opcional)</label>
            <textarea [(ngModel)]="openSessionNotes" rows="2" class="field-input" placeholder="Ej: Turno mañana..."></textarea>
          </div>
          @if (operatingConfig()?.fiscal?.resolutionNumber || operatingConfig()?.fiscal?.prefix) {
            <div class="pos-config-chip">
              <strong>Configuración fiscal POS</strong>
              <span>Prefijo {{ selectedOpenTerminal()?.invoicePrefix || operatingConfig()?.fiscal?.prefix || 'POS' }} · Resolución {{ selectedOpenTerminal()?.resolutionNumber || operatingConfig()?.fiscal?.resolutionNumber || 'Pendiente' }}</span>
            </div>
          }
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

  <!-- Operating config -->
  @if (showOperatingConfigModal()) {
    <div class="overlay" (click)="closeOperatingConfigModal()">
      <div class="modal modal-operating-config" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M11.983 1.904a1.5 1.5 0 00-2.966 0l-.16.998a1.5 1.5 0 01-1.17 1.219l-.98.21a1.5 1.5 0 00-.925 2.378l.617.802a1.5 1.5 0 010 1.818l-.617.802a1.5 1.5 0 00.925 2.378l.98.21a1.5 1.5 0 011.17 1.219l.16.998a1.5 1.5 0 002.966 0l.16-.998a1.5 1.5 0 011.17-1.219l.98-.21a1.5 1.5 0 00.925-2.378l-.617-.802a1.5 1.5 0 010-1.818l.617-.802a1.5 1.5 0 00-.925-2.378l-.98-.21a1.5 1.5 0 01-1.17-1.219l-.16-.998zM10.5 12a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
          </div>
          <div>
            <div class="modal-title">Configuración operativa del POS</div>
            <div class="modal-subtitle">Administra cajas, terminales, turnos y parámetros de la operación</div>
          </div>
          <button class="modal-close-btn" (click)="closeOperatingConfigModal()">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body modal-body--config">
          <div class="config-summary-grid">
            <div class="config-summary-card">
              <span>Sucursal activa</span>
              <strong>{{ operatingConfig()?.branch?.name ?? 'No detectada' }}</strong>
              <small>{{ operatingConfig()?.branch?.city || 'Sin ciudad configurada' }}</small>
            </div>
            <div class="config-summary-card">
              <span>Cajas / terminales</span>
              <strong>{{ terminals().length }}</strong>
              <small>{{ activeTerminalsCount() }} activas</small>
            </div>
            <div class="config-summary-card">
              <span>Turnos</span>
              <strong>{{ shiftTemplates().length }}</strong>
              <small>Plantillas disponibles</small>
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Cajas y terminales</h4>
                <p>Dispositivos, impresoras, prefijos y parámetros por punto de venta.</p>
              </div>
              <button class="btn-modal-pri" (click)="openTerminalForm()">Nueva terminal</button>
            </div>
            <div class="config-card-list">
              @for (terminal of terminals(); track terminal.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ terminal.code }} · {{ terminal.name }}</strong>
                    <small>{{ terminal.cashRegisterName || 'Caja general' }} · {{ terminal.printerName || 'Sin impresora' }} · {{ terminal.invoicePrefix || 'POS' }}</small>
                  </div>
                  <button class="btn-modal-sec" (click)="editTerminal(terminal)">Editar</button>
                </article>
              } @empty {
                <div class="config-empty">No hay terminales POS configuradas todavía.</div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Turnos operativos</h4>
                <p>Define franjas horarias y parámetros de cierre por jornada.</p>
              </div>
              <button class="btn-modal-pri" (click)="openShiftForm()">Nuevo turno</button>
            </div>
            <div class="config-card-list">
              @for (shift of shiftTemplates(); track shift.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ shift.name }}</strong>
                    <small>{{ shift.startTime }} - {{ shift.endTime }} · Tolerancia {{ shift.toleranceMinutes }} min</small>
                  </div>
                  <button class="btn-modal-sec" (click)="editShift(shift)">Editar</button>
                </article>
              } @empty {
                <div class="config-empty">No hay turnos POS definidos todavía.</div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Política comercial POS</h4>
                <p>Listas de precios, promociones automáticas y combos activos para la caja.</p>
              </div>
            </div>
            <div class="config-summary-grid">
              <div class="config-summary-card">
                <span>Listas de precios</span>
                <strong>{{ priceLists().length }}</strong>
                <small>{{ getDefaultPriceListName() }}</small>
              </div>
              <div class="config-summary-card">
                <span>Promociones activas</span>
                <strong>{{ promotions().length }}</strong>
                <small>Cliente, producto, volumen y horario</small>
              </div>
              <div class="config-summary-card">
                <span>Combos</span>
                <strong>{{ combos().length }}</strong>
                <small>Paquetes comerciales configurados</small>
              </div>
            </div>
            <div class="config-card-list">
              @for (priceList of priceLists(); track priceList.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ priceList.name }}{{ priceList.isDefault ? ' · Predeterminada' : '' }}</strong>
                    <small>{{ priceList.items.length }} reglas de precio</small>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay listas de precios POS activas.</div>
              }
            </div>
            <div class="config-card-list" style="margin-top:10px">
              @for (promotion of promotions().slice(0, 6); track promotion.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ promotion.name }}</strong>
                    <small>{{ promotion.type }} · {{ promotion.discountMode === 'PERCENT' ? promotion.discountValue + '%' : fmtCOP(promotion.discountValue) }}</small>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay promociones activas cargadas.</div>
              }
            </div>
            <div class="config-card-list" style="margin-top:10px">
              @for (combo of combos().slice(0, 6); track combo.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ combo.name }}</strong>
                    <small>{{ combo.items.length }} productos · {{ fmtCOP(combo.comboPrice) }}</small>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay combos activos configurados.</div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Fidelización y CRM retail</h4>
                <p>Campañas de puntos, membresías y segmentación de clientes frecuentes.</p>
              </div>
              <button class="btn-modal-pri" (click)="openLoyaltyCampaignForm()">Nueva campaña</button>
            </div>
            <div class="config-summary-grid">
              <div class="config-summary-card">
                <span>Campañas activas</span>
                <strong>{{ loyaltyCampaigns().length }}</strong>
                <small>Puntos, bonos y segmentación</small>
              </div>
              <div class="config-summary-card">
                <span>Cliente seleccionado</span>
                <strong>{{ customerLoyaltyProfile()?.customer?.membershipTier || 'Sin membresía' }}</strong>
                <small>{{ customerLoyaltyProfile()?.customer?.loyaltyPointsBalance ?? 0 }} puntos disponibles</small>
              </div>
              <div class="config-summary-card">
                <span>Segmento actual</span>
                <strong>{{ customerLoyaltyProfile()?.customer?.customerSegment || 'General' }}</strong>
                <small>Se usa para campañas y trazabilidad</small>
              </div>
            </div>
            <div class="config-card-list">
              @for (campaign of loyaltyCampaigns(); track campaign.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ campaign.name }}</strong>
                    <small>
                      {{ campaign.targetTier || 'Todas las membresías' }}
                      · {{ campaign.targetSegment || 'Todos los segmentos' }}
                      · +{{ campaign.bonusPoints }} pts
                    </small>
                  </div>
                  <div class="config-actions-inline">
                    <span class="history-badge">{{ campaign.isActive ? 'Activa' : 'Inactiva' }}</span>
                    <button class="btn-modal-sec" (click)="editLoyaltyCampaign(campaign)">Editar</button>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay campañas de fidelización configuradas todavía.</div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Inventario retail en tiempo real</h4>
                <p>Bodegas POS, reservas para pedidos, trazabilidad por lote/serie y transferencias entre tiendas.</p>
              </div>
              <div class="config-actions-inline">
                <button class="btn-modal-sec" (click)="openInventoryStockForm()">Cargar stock</button>
                <button class="btn-modal-sec" (click)="openInventoryTransferForm()">Nueva transferencia</button>
                <button class="btn-modal-pri" (click)="openInventoryLocationForm()">Nueva bodega</button>
              </div>
            </div>
            <div class="config-summary-grid">
              <div class="config-summary-card">
                <span>Bodegas activas</span>
                <strong>{{ inventoryLocations().length }}</strong>
                <small>{{ selectedInventoryLocationId() ? 'Filtro de bodega activo' : 'Asignación automática habilitada' }}</small>
              </div>
              <div class="config-summary-card">
                <span>Registros de stock</span>
                <strong>{{ inventoryStocks().length }}</strong>
                <small>Lotes, series y disponibilidad reservada</small>
              </div>
              <div class="config-summary-card">
                <span>Transferencias</span>
                <strong>{{ inventoryTransfers().length }}</strong>
                <small>Movimientos entre tiendas y bodegas</small>
              </div>
            </div>
            <div class="config-card-list">
              @for (location of inventoryLocations(); track location.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ location.code }} · {{ location.name }}{{ location.isDefault ? ' · Predeterminada' : '' }}</strong>
                    <small>{{ location.type }} · {{ location.allowPosSales ? 'Disponible para POS' : 'Solo backoffice' }} · {{ location._count?.stocks ?? 0 }} registros</small>
                  </div>
                  <div class="config-actions-inline">
                    <button class="btn-modal-sec" (click)="editInventoryLocation(location)">Editar</button>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay bodegas retail configuradas todavía.</div>
              }
            </div>
            <div class="config-card-list" style="margin-top:10px">
              @for (stock of inventoryStocks().slice(0, 8); track stock.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ stock.product?.name || 'Producto' }} · {{ stock.location?.code }}</strong>
                    <small>
                      Físico {{ stock.quantity }} · Reservado {{ stock.reservedQuantity }}
                      @if (stock.lotNumber) { · Lote {{ stock.lotNumber }} }
                      @if (stock.serialNumber) { · Serie {{ stock.serialNumber }} }
                    </small>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">Aún no hay registros de stock retail cargados.</div>
              }
            </div>
            <div class="config-card-list" style="margin-top:10px">
              @for (transfer of inventoryTransfers().slice(0, 8); track transfer.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ transfer.reference }}</strong>
                    <small>{{ transfer.fromLocation?.code }} → {{ transfer.toLocation?.code }} · {{ transfer.items.length }} ítems</small>
                  </div>
                  <div class="config-actions-inline">
                    <span class="history-badge">{{ transfer.status }}</span>
                    @if (transfer.status === 'PENDING') {
                      <button class="btn-modal-pri" (click)="postInventoryTransfer(transfer)" [disabled]="postingTransferId === transfer.id">
                        {{ postingTransferId === transfer.id ? 'Aplicando...' : 'Aplicar' }}
                      </button>
                    }
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay transferencias registradas.</div>
              }
            </div>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Supervisión de cierres</h4>
                <p>Aprueba cierres con diferencia de caja y reaperturas controladas.</p>
              </div>
            </div>
            <div class="config-card-list">
              @for (session of recentManagedSessions(); track session.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ session.terminal?.code || 'Caja POS' }} · {{ session.status === 'PENDING_CLOSE_APPROVAL' ? 'Pendiente de aprobación' : 'Sesión cerrada' }}</strong>
                    <small>
                      {{ session.user.firstName }} {{ session.user.lastName }}
                      · Dif. {{ fmtCOP(session.cashDifference ?? 0) }}
                      · Final {{ fmtCOP(session.finalCash ?? 0) }}
                    </small>
                  </div>
                  <div class="config-actions-inline">
                    @if (session.status === 'PENDING_CLOSE_APPROVAL') {
                      <button class="btn-modal-pri" (click)="approveManagedSession(session)" [disabled]="approvingSessionId === session.id">
                        {{ approvingSessionId === session.id ? 'Aprobando...' : 'Aprobar cierre' }}
                      </button>
                    } @else {
                      <button class="btn-modal-sec" (click)="reopenManagedSession(session)" [disabled]="reopeningSessionId === session.id">
                        {{ reopeningSessionId === session.id ? 'Reabriendo...' : 'Reabrir caja' }}
                      </button>
                    }
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay cierres pendientes ni sesiones recientes para supervisar.</div>
              }
            </div>
            <label class="field-group" style="margin-top:12px">
              <span>Notas de reapertura controlada</span>
              <textarea class="field-input" rows="2" [(ngModel)]="reopenNotes" placeholder="Motivo de reapertura o novedad detectada"></textarea>
            </label>
          </div>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Gobierno, permisos y auditoría POS</h4>
                <p>Controla permisos por acción, overrides de supervisor y la bitácora visible del punto de venta.</p>
              </div>
            </div>

            <div class="config-card-list">
              @for (rule of governanceRules(); track rule.action) {
                <article class="config-card-item" style="align-items:flex-start">
                  <div style="width:100%">
                    <strong>{{ getGovernanceActionLabel(rule.action) }}</strong>
                    <small>{{ rule.notes || 'Regla de control interno POS' }}</small>
                    <div class="config-form-grid" style="margin-top:10px">
                      <label class="field-group">
                        <span>Tope descuento %</span>
                        <input
                          class="field-input"
                          type="number"
                          min="0"
                          max="100"
                          [ngModel]="rule.maxDiscountPct ?? ''"
                          (ngModelChange)="updateGovernanceRule(rule, { maxDiscountPct: toNullableNumber($event) })"
                        />
                      </label>
                      <label class="field-group">
                        <span>Tope valor</span>
                        <input
                          class="field-input"
                          type="number"
                          min="0"
                          [ngModel]="rule.maxAmountThreshold ?? ''"
                          (ngModelChange)="updateGovernanceRule(rule, { maxAmountThreshold: toNullableNumber($event) })"
                        />
                      </label>
                    </div>
                    <div class="config-switches">
                      <label>
                        <input
                          type="checkbox"
                          [ngModel]="rule.requiresSupervisorOverride"
                          (ngModelChange)="updateGovernanceRule(rule, { requiresSupervisorOverride: !!$event })"
                        />
                        Requiere override del supervisor
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          [ngModel]="rule.isActive"
                          (ngModelChange)="updateGovernanceRule(rule, { isActive: !!$event })"
                        />
                        Regla activa
                      </label>
                    </div>
                    <div class="config-switches">
                      @for (role of governanceRoles; track role) {
                        <label>
                          <input
                            type="checkbox"
                            [checked]="hasGovernanceRole(rule, role)"
                            (change)="toggleGovernanceRole(rule, role, $any($event.target).checked)"
                          />
                          {{ role }}
                        </label>
                      }
                    </div>
                  </div>
                  <div class="config-actions-inline">
                    <button class="btn-modal-pri" (click)="saveGovernanceRule(rule)" [disabled]="savingGovernanceRuleAction() === rule.action">
                      {{ savingGovernanceRuleAction() === rule.action ? 'Guardando...' : 'Guardar regla' }}
                    </button>
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay reglas de gobierno POS configuradas.</div>
              }
            </div>

            <div class="config-card-list" style="margin-top:12px">
              @for (override of pendingGovernanceOverrides(); track override.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ getGovernanceActionLabel(override.action) }}</strong>
                    <small>
                      {{ override.reason }}
                      · {{ override.requestedBy?.firstName }} {{ override.requestedBy?.lastName }}
                    </small>
                  </div>
                  <div class="config-actions-inline">
                    @if (canSupervise()) {
                      <button class="btn-modal-pri" (click)="approveGovernanceOverride(override)" [disabled]="approvingOverrideId === override.id">
                        {{ approvingOverrideId === override.id ? 'Aprobando...' : 'Aprobar' }}
                      </button>
                      <button class="btn-modal-sec" (click)="rejectGovernanceOverride(override)" [disabled]="rejectingOverrideId === override.id">
                        {{ rejectingOverrideId === override.id ? 'Procesando...' : 'Rechazar' }}
                      </button>
                    } @else {
                      <span class="history-badge">Pendiente</span>
                    }
                  </div>
                </article>
              } @empty {
                <div class="config-empty">No hay overrides pendientes de supervisión.</div>
              }
            </div>

            <div class="config-card-list" style="margin-top:12px">
              @for (entry of governanceAudit(); track entry.id) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ entry.action }}</strong>
                    <small>
                      {{ entry.user?.firstName }} {{ entry.user?.lastName }}
                      · {{ entry.createdAt | date:'short' }}
                    </small>
                  </div>
                  <div class="config-actions-inline">
                    <span class="history-badge">{{ entry.resource }}</span>
                    @if (entry.resourceId) {
                      <small>#{{ entry.resourceId.slice(0, 8) }}</small>
                    }
                  </div>
                </article>
              } @empty {
                <div class="config-empty">La bitácora POS aún no tiene movimientos visibles.</div>
              }
            </div>
          </div>

          @if (canSupervise()) {
            <div class="config-section">
              <div class="config-section__header">
                <div>
                  <h4>Analítica empresarial del POS</h4>
                  <p>KPIs por caja, cajero, tienda, hora, medio de pago, margen, devoluciones y productividad.</p>
                </div>
                <div class="config-actions-inline">
                  <label class="field-group" style="min-width:180px">
                    <span>Desde</span>
                    <input class="field-input" type="date" [(ngModel)]="analyticsFrom" />
                  </label>
                  <label class="field-group" style="min-width:180px">
                    <span>Hasta</span>
                    <input class="field-input" type="date" [(ngModel)]="analyticsTo" />
                  </label>
                  <button class="btn-modal-pri" (click)="loadSalesAnalytics()" [disabled]="loadingSalesAnalytics()">
                    {{ loadingSalesAnalytics() ? 'Cargando...' : 'Actualizar analítica' }}
                  </button>
                </div>
              </div>

              @if (salesAnalytics(); as analytics) {
                <div class="config-summary-grid">
                  <div class="config-summary-card">
                    <span>Ventas POS</span>
                    <strong>{{ fmtCOP(analytics.kpis.totalSales) }}</strong>
                    <small>{{ analytics.kpis.completedCount }} transacciones completadas</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Ticket promedio</span>
                    <strong>{{ fmtCOP(analytics.kpis.avgTicket) }}</strong>
                    <small>Promedio del período analizado</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Margen bruto</span>
                    <strong>{{ fmtCOP(analytics.kpis.grossMarginAmount) }}</strong>
                    <small>{{ analytics.kpis.grossMarginPct | number:'1.0-2' }}% sobre ventas POS</small>
                  </div>
                </div>

                <div class="config-summary-grid" style="margin-top:12px">
                  <div class="config-summary-card">
                    <span>Descuentos</span>
                    <strong>{{ fmtCOP(analytics.kpis.totalDiscounts) }}</strong>
                    <small>Promociones, combos y descuentos manuales</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Devoluciones</span>
                    <strong>{{ fmtCOP(analytics.kpis.totalRefunded) }}</strong>
                    <small>{{ analytics.kpis.refundRate | number:'1.0-2' }}% de tasa de devolución</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Ventas anuladas</span>
                    <strong>{{ fmtCOP(analytics.kpis.totalCancelled) }}</strong>
                    <small>{{ analytics.kpis.approvedReturns }} postventas aprobadas</small>
                  </div>
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of analytics.byTerminal.slice(0, 6); track item.terminalId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.terminalName }}</strong>
                        <small>{{ item.transactions }} tickets · ticket prom. {{ fmtCOP(item.avgTicket) }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.sales) }}</span>
                        @if (item.refunds > 0) {
                          <small>Dev. {{ fmtCOP(item.refunds) }}</small>
                        }
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay ventas POS para construir analítica por caja.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of analytics.productivity.slice(0, 6); track item.cashierId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.cashierName }}</strong>
                        <small>{{ item.transactions }} tickets · ticket prom. {{ fmtCOP(item.avgTicket) }} · margen {{ fmtCOP(item.margin) }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">Score {{ item.productivityScore | number:'1.0-0' }}</span>
                        <small>{{ fmtCOP(item.sales) }}</small>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay productividad por cajero disponible todavía.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of analytics.byBranch.slice(0, 6); track item.branchId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.branchName }}</strong>
                        <small>{{ item.transactions }} tickets · ticket prom. {{ fmtCOP(item.avgTicket) }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.sales) }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay consolidado por tienda disponible para el período.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of analytics.byPaymentMethod; track item.paymentMethod) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ getPaymentMethodLabel(item.paymentMethod) }}</strong>
                        <small>{{ item.count }} líneas de pago registradas</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.total) }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay desglose por medio de pago para el período consultado.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of getActiveHours(analytics.byHour).slice(0, 8); track item.hour) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ formatHourLabel(item.hour) }}</strong>
                        <small>{{ item.transactions }} tickets · ticket prom. {{ fmtCOP(item.avgTicket) }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.sales) }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay actividad horaria registrada para el rango actual.</div>
                  }
                </div>
              } @else if (loadingSalesAnalytics()) {
                <div class="config-empty">Cargando analítica empresarial del POS...</div>
              } @else {
                <div class="config-empty">Aún no hay analítica disponible para el rango seleccionado.</div>
              }
            </div>
          }

          @if (canSupervise()) {
            <div class="config-section">
              <div class="config-section__header">
                <div>
                  <h4>Integraciones empresariales</h4>
                  <p>Contabilidad, cartera, compras, inventario, fidelización, bancos y operación omnicanal conectados al POS.</p>
                </div>
                <div class="config-actions-inline">
                  <button class="btn-modal-sec" (click)="loadIntegrationSummary()" [disabled]="loadingIntegrationSummary()">
                    {{ loadingIntegrationSummary() ? 'Actualizando...' : 'Actualizar resumen' }}
                  </button>
                  <button class="btn-modal-sec" (click)="createReplenishmentRequest()">
                    Crear solicitud compra
                  </button>
                  <button class="btn-modal-sec" (click)="reconcileElectronicPayments()">
                    Conciliar pagos POS
                  </button>
                  <button class="btn-modal-pri" (click)="syncAccountingIntegrations()" [disabled]="syncingAccountingIntegrations()">
                    {{ syncingAccountingIntegrations() ? 'Sincronizando...' : 'Sincronizar contabilidad POS' }}
                  </button>
                </div>
              </div>

              @if (integrationSummary(); as summary) {
                <div class="config-summary-grid">
                  <div class="config-summary-card">
                    <span>Contabilidad</span>
                    <strong>{{ summary.accounting.integratedSales + summary.accounting.integratedRefunds + summary.accounting.integratedCashMovements }}</strong>
                    <small>{{ summary.accounting.failures }} fallos visibles en integración POS</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Cartera POS</span>
                    <strong>{{ fmtCOP(summary.cartera.pendingAmount) }}</strong>
                    <small>{{ summary.cartera.pendingCount }} saldos pendientes de clientes POS</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Bancos / conciliación</span>
                    <strong>{{ summary.banks.reconciledBankMovements }}</strong>
                    <small>{{ summary.banks.pendingReconciliation }} referencias pendientes por conciliar</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Cupones / puntos</span>
                    <strong>{{ summary.loyalty.redeemedPoints }}</strong>
                    <small>{{ summary.loyalty.activeCoupons }} cupones activos · {{ fmtCOP(summary.loyalty.redeemedAmount) }} redimidos</small>
                  </div>
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  <article class="config-card-item">
                    <div>
                      <strong>Sincronización contable POS</strong>
                      <small>
                        Ventas {{ summary.accounting.integratedSales }}/{{ summary.accounting.completedSales }}
                        · Reembolsos {{ summary.accounting.integratedRefunds }}/{{ summary.accounting.refundedSales }}
                        · Caja {{ summary.accounting.integratedCashMovements }}/{{ summary.accounting.cashMovements }}
                      </small>
                    </div>
                    <div class="config-actions-inline">
                      <span class="history-badge">{{ summary.accounting.failures }} fallos</span>
                    </div>
                  </article>
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.cartera.recentPending; track item.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.saleNumber }}</strong>
                        <small>{{ item.customerName }} · pendiente {{ fmtCOP(item.remainingAmount) }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">Cartera POS</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay saldos POS pendientes para integrar con cartera.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.purchasing.suggestedProducts; track item.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.name }}</strong>
                        <small>{{ item.sku }} · stock {{ item.stock }} · mínimo {{ item.minStock }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">Reabastecer</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay sugerencias de reabastecimiento urgentes desde POS.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.purchasing.recentRequests; track item.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.reference }}</strong>
                        <small>{{ item.message || 'Solicitud generada desde POS' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ item.createdAt | date:'short' }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">Todavía no se han generado solicitudes de compra desde el POS.</div>
                  }
                </div>

                <div class="config-summary-grid" style="margin-top:12px">
                  <div class="config-summary-card">
                    <span>Inventario retail</span>
                    <strong>{{ summary.inventory.openReservations }}</strong>
                    <small>{{ summary.inventory.reservedUnits }} unidades reservadas · {{ summary.inventory.pendingTransfers }} transferencias pendientes · {{ summary.inventory.discrepancyCount }} diferencias</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Fidelización</span>
                    <strong>{{ summary.loyalty.activeCampaigns }}</strong>
                    <small>{{ summary.loyalty.issuedPoints }} emitidos · {{ summary.loyalty.redeemedPoints }} redimidos</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Pagos electrónicos</span>
                    <strong>{{ summary.banks.electronicPayments }}</strong>
                    <small>{{ summary.banks.referencedPayments }} referencias transaccionales capturadas</small>
                  </div>
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.ecommerce.channels; track item.orderType + '-' + item.orderStatus) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ getOrderTypeLabel(item.orderType) }}</strong>
                        <small>{{ item.orderStatus }} · {{ item.count }} pedidos</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.total) }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay actividad omnicanal relevante para el período actual.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.ecommerce.externalOrders; track item.channel + '-' + item.status) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.channel }}</strong>
                        <small>{{ item.status }} · {{ item.count }} pedidos externos</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ fmtCOP(item.total) }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay intake de e-commerce o marketplace registrado todavía.</div>
                  }
                </div>

                @if (summary.banks.latestBatch) {
                  <div class="config-card-list" style="margin-top:12px">
                    <article class="config-card-item">
                      <div>
                        <strong>{{ summary.banks.latestBatch.reference }}</strong>
                        <small>{{ summary.banks.latestBatch.createdAt | date:'short' }} · {{ summary.banks.latestBatch.matchedPayments }} referenciados</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ summary.banks.latestBatch.reconciledPayments }} conciliados</span>
                      </div>
                    </article>
                  </div>
                }

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.traces; track item.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.module }}</strong>
                        <small>{{ item.message || (item.sourceType + ' -> ' + (item.targetType || 'sin destino')) }} · {{ item.createdAt | date:'short' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ item.status }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">Todavía no hay trazabilidad POS multi-módulo registrada.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (item of summary.accounting.recentActivity; track item.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ item.resourceType }}</strong>
                        <small>{{ item.message || 'Actividad de integración POS' }} · {{ item.createdAt | date:'short' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ item.status }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">Todavía no hay actividad reciente de integraciones POS registrada.</div>
                  }
                </div>
              } @else if (loadingIntegrationSummary()) {
                <div class="config-empty">Cargando integraciones empresariales del POS...</div>
              } @else {
                <div class="config-empty">Aún no hay resumen de integraciones empresariales disponible.</div>
              }
            </div>
          }

          @if (canSupervise()) {
            <div class="config-section">
              <div class="config-section__header">
                <div>
                  <h4>Operación multi-sucursal y alta disponibilidad</h4>
                  <p>Monitorea sucursales, terminales, sesiones activas y continuidad operativa del POS.</p>
                </div>
                <div class="config-actions-inline">
                  <button class="btn-modal-pri" (click)="loadMultiBranchOverview()" [disabled]="loadingMultiBranchOverview()">
                    {{ loadingMultiBranchOverview() ? 'Actualizando...' : 'Actualizar monitor' }}
                  </button>
                </div>
              </div>

              @if (multiBranchOverview(); as overview) {
                <div class="config-summary-grid">
                  <div class="config-summary-card">
                    <span>Sucursales POS</span>
                    <strong>{{ overview.totals.branches }}</strong>
                    <small>{{ overview.totals.openSessions }} sesiones abiertas</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Terminales activas</span>
                    <strong>{{ overview.totals.onlineTerminals }}/{{ overview.totals.terminals }}</strong>
                    <small>Con heartbeat operativo reciente</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Operación pendiente</span>
                    <strong>{{ overview.totals.pendingOmnichannel }}</strong>
                    <small>{{ overview.totals.pendingTransfers }} transferencias entre tiendas pendientes</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Incidentes / SLA</span>
                    <strong>{{ overview.totals.openIncidents }}</strong>
                    <small>{{ overview.totals.slaBreaches }} terminales fuera de SLA</small>
                  </div>
                </div>

                <div class="config-summary-grid" style="margin-top:12px">
                  <div class="config-summary-card">
                    <span>Cola offline local</span>
                    <strong>{{ pendingOfflineQueue().length }}</strong>
                    <small>{{ offlineMode() ? 'Modo offline activo' : 'Lista para sincronizar' }}</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Incidentes abiertos</span>
                    <strong>{{ openOperationalIncidentsCount() }}</strong>
                    <small>Monitoreo operativo POS visible</small>
                  </div>
                  <div class="config-summary-card">
                    <span>Despliegues config</span>
                    <strong>{{ configDeployments().length }}</strong>
                    <small>Publicaciones multi-sucursal recientes</small>
                  </div>
                </div>

                <div class="config-actions-inline" style="margin-top:12px">
                  <button class="btn-modal-sec" (click)="syncOfflineQueue()" [disabled]="syncingOfflineQueue() || pendingOfflineQueue().length === 0 || offlineMode()">
                    {{ syncingOfflineQueue() ? 'Sincronizando cola...' : 'Sincronizar pendientes' }}
                  </button>
                  <button class="btn-modal-pri" (click)="publishPosConfiguration()">
                    Publicar configuración
                  </button>
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (branch of overview.branches; track branch.branchId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ branch.branchName }}{{ branch.isMain ? ' · Principal' : '' }}</strong>
                        <small>
                          {{ branch.terminalsOnline }}/{{ branch.terminalsTotal }} terminales online
                          · {{ branch.openSessions }} cajas abiertas
                          · {{ branch.activeCashiers }} cajeros activos
                        </small>
                        <small>
                          Ventas hoy {{ fmtCOP(branch.salesToday) }}
                          · ticket prom. {{ fmtCOP(branch.avgTicketToday) }}
                          · pedidos pendientes {{ branch.pendingOrders }}
                        </small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ branch.city || 'Sin ciudad' }}</span>
                        @if (branch.lastHeartbeatAt) {
                          <small>{{ branch.lastHeartbeatAt | date:'shortTime' }}</small>
                        }
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay sucursales activas con operación POS visible.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (terminal of overview.terminals.slice(0, 10); track terminal.terminalId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ terminal.code }} · {{ terminal.name }}</strong>
                        <small>{{ terminal.isDefault ? 'Terminal predeterminada' : 'Terminal operativa' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ terminal.heartbeatStatus }}</span>
                        @if (terminal.lastHeartbeatAt) {
                          <small>{{ terminal.lastHeartbeatAt | date:'short' }}</small>
                        }
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay terminales POS registradas para el monitor multi-sucursal.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (session of overview.sessions.slice(0, 10); track session.sessionId) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ session.terminalCode || 'Caja POS' }}</strong>
                        <small>
                          Sesión {{ session.sessionId.slice(0, 8) }} · cajero {{ session.cashierId.slice(0, 8) }}
                          @if ((session.offlineQueueDepth ?? 0) > 0) {
                            · cola {{ session.offlineQueueDepth }}
                          }
                        </small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ session.heartbeatStatus }}</span>
                        @if (session.lastHeartbeatAt) {
                          <small>{{ session.lastHeartbeatAt | date:'short' }}</small>
                        }
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay sesiones activas para monitorear continuidad operativa.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (incident of operationalIncidents().slice(0, 8); track incident.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ incident.title }}</strong>
                        <small>{{ incident.type }} · {{ incident.startedAt | date:'short' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ incident.severity }}</span>
                        @if (incident.status !== 'RESOLVED') {
                          <button class="btn-modal-sec" (click)="resolveOperationalIncident(incident)">
                            Resolver
                          </button>
                        }
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay incidentes operativos abiertos en este momento.</div>
                  }
                </div>

                <div class="config-card-list" style="margin-top:12px">
                  @for (deployment of configDeployments().slice(0, 8); track deployment.id) {
                    <article class="config-card-item">
                      <div>
                        <strong>{{ deployment.versionLabel || deployment.deploymentType }}</strong>
                        <small>{{ deployment.scope }} · {{ deployment.createdAt | date:'short' }}</small>
                      </div>
                      <div class="config-actions-inline">
                        <span class="history-badge">{{ deployment.status }}</span>
                      </div>
                    </article>
                  } @empty {
                    <div class="config-empty">No hay despliegues de configuración registrados todavía.</div>
                  }
                </div>
              } @else if (loadingMultiBranchOverview()) {
                <div class="config-empty">Cargando monitor multi-sucursal del POS...</div>
              } @else {
                <div class="config-empty">Aún no hay monitor multi-sucursal disponible.</div>
              }
            </div>
          }

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Solicitudes de postventa</h4>
                <p>Aprueba devoluciones parciales, cambios y generación de nota crédito POS.</p>
              </div>
            </div>
            <div class="config-card-list">
              @if (loadingPostSaleRequests()) {
                <div class="config-empty">Cargando solicitudes de postventa...</div>
              } @else {
                @for (request of postSaleRequests(); track request.id) {
                  <article class="config-card-item">
                    <div>
                      <strong>{{ request.sale?.saleNumber || 'Venta POS' }} · {{ request.type === 'EXCHANGE' ? 'Cambio' : 'Devolución' }}</strong>
                      <small>
                        {{ getPostSaleReasonLabel(request.reasonCode) }}
                        · {{ fmtCOP(request.total) }}
                        · {{ request.sale?.customer?.name || 'Cliente ocasional' }}
                      </small>
                      @if (request.creditNoteInvoice) {
                        <small>Nota crédito: {{ request.creditNoteInvoice.invoiceNumber }}</small>
                      }
                    </div>
                    <div class="config-actions-inline">
                      <button class="btn-modal-pri" (click)="approvePostSaleRequest(request)" [disabled]="resolvingPostSaleId === request.id">
                        {{ resolvingPostSaleId === request.id ? 'Aprobando...' : 'Aprobar' }}
                      </button>
                      <button class="btn-modal-sec" (click)="rejectPostSaleRequest(request)" [disabled]="resolvingPostSaleId === request.id">
                        {{ resolvingPostSaleId === request.id ? 'Procesando...' : 'Rechazar' }}
                      </button>
                    </div>
                  </article>
                } @empty {
                  <div class="config-empty">No hay solicitudes pendientes de aprobación.</div>
                }
              }
            </div>
          </div>

          @if (showTerminalForm()) {
            <div class="config-inline-form">
              <h4>{{ editingTerminalId ? 'Editar terminal POS' : 'Nueva terminal POS' }}</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Código</span><input class="field-input" type="text" [(ngModel)]="terminalForm.code" /></label>
                <label class="field-group"><span>Nombre</span><input class="field-input" type="text" [(ngModel)]="terminalForm.name" /></label>
                <label class="field-group"><span>Caja</span><input class="field-input" type="text" [(ngModel)]="terminalForm.cashRegisterName" /></label>
                <label class="field-group"><span>Dispositivo</span><input class="field-input" type="text" [(ngModel)]="terminalForm.deviceName" /></label>
                <label class="field-group"><span>Impresora</span><input class="field-input" type="text" [(ngModel)]="terminalForm.printerName" /></label>
                <label class="field-group"><span>Conexión</span><input class="field-input" type="text" [(ngModel)]="terminalForm.printerConnectionType" /></label>
                <label class="field-group"><span>Ancho papel</span><input class="field-input" type="number" [(ngModel)]="terminalForm.printerPaperWidth" /></label>
                <label class="field-group"><span>Prefijo factura</span><input class="field-input" type="text" [(ngModel)]="terminalForm.invoicePrefix" /></label>
                <label class="field-group"><span>Prefijo tirilla</span><input class="field-input" type="text" [(ngModel)]="terminalForm.receiptPrefix" /></label>
                <label class="field-group"><span>Resolución</span><input class="field-input" type="text" [(ngModel)]="terminalForm.resolutionNumber" /></label>
              </div>
              <div class="config-switches">
                <label><input type="checkbox" [(ngModel)]="terminalForm.isDefault" /> Terminal por defecto</label>
                <label><input type="checkbox" [(ngModel)]="terminalForm.autoPrintReceipt" /> Autoimprimir tirilla</label>
                <label><input type="checkbox" [(ngModel)]="terminalForm.requireCustomerForInvoice" /> Exigir cliente para facturar</label>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeTerminalForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveTerminal()" [disabled]="savingOperatingConfig()">Guardar terminal</button>
              </div>
            </div>
          }

          @if (showShiftForm()) {
            <div class="config-inline-form">
              <h4>{{ editingShiftId ? 'Editar turno POS' : 'Nuevo turno POS' }}</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Código</span><input class="field-input" type="text" [(ngModel)]="shiftForm.code" /></label>
                <label class="field-group"><span>Nombre</span><input class="field-input" type="text" [(ngModel)]="shiftForm.name" /></label>
                <label class="field-group"><span>Hora inicio</span><input class="field-input" type="time" [(ngModel)]="shiftForm.startTime" /></label>
                <label class="field-group"><span>Hora fin</span><input class="field-input" type="time" [(ngModel)]="shiftForm.endTime" /></label>
                <label class="field-group"><span>Tolerancia</span><input class="field-input" type="number" [(ngModel)]="shiftForm.toleranceMinutes" /></label>
              </div>
              <div class="config-switches">
                <label><input type="checkbox" [(ngModel)]="shiftForm.requiresBlindClose" /> Requiere cierre ciego</label>
                <label><input type="checkbox" [(ngModel)]="shiftForm.isActive" /> Activo</label>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeShiftForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveShift()" [disabled]="savingOperatingConfig()">Guardar turno</button>
              </div>
            </div>
          }

          @if (showLoyaltyCampaignForm()) {
            <div class="config-inline-form">
              <h4>{{ editingLoyaltyCampaignId ? 'Editar campaña de fidelización' : 'Nueva campaña de fidelización' }}</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Código</span><input class="field-input" type="text" [(ngModel)]="loyaltyCampaignForm.code" /></label>
                <label class="field-group"><span>Nombre</span><input class="field-input" type="text" [(ngModel)]="loyaltyCampaignForm.name" /></label>
                <label class="field-group"><span>Segmento objetivo</span><input class="field-input" type="text" [(ngModel)]="loyaltyCampaignForm.targetSegment" placeholder="VIP, Hogar, Mayorista..." /></label>
                <label class="field-group"><span>Membresía objetivo</span><input class="field-input" type="text" [(ngModel)]="loyaltyCampaignForm.targetTier" placeholder="Silver, Gold, Platinum..." /></label>
                <label class="field-group"><span>Subtotal mínimo</span><input class="field-input" type="number" [(ngModel)]="loyaltyCampaignForm.minSubtotal" min="0" /></label>
                <label class="field-group"><span>Puntos por tramo</span><input class="field-input" type="number" [(ngModel)]="loyaltyCampaignForm.pointsPerAmount" min="0" step="0.01" /></label>
                <label class="field-group"><span>Tramo base</span><input class="field-input" type="number" [(ngModel)]="loyaltyCampaignForm.amountStep" min="1" step="1000" /></label>
                <label class="field-group"><span>Bono fijo</span><input class="field-input" type="number" [(ngModel)]="loyaltyCampaignForm.bonusPoints" min="0" /></label>
              </div>
              <label class="field-group"><span>Descripción</span><textarea class="field-input" rows="2" [(ngModel)]="loyaltyCampaignForm.description"></textarea></label>
              <div class="config-switches">
                <label><input type="checkbox" [(ngModel)]="loyaltyCampaignForm.isActive" /> Activa</label>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeLoyaltyCampaignForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveLoyaltyCampaign()" [disabled]="savingOperatingConfig()">Guardar campaña</button>
              </div>
            </div>
          }

          @if (showInventoryLocationForm()) {
            <div class="config-inline-form">
              <h4>{{ editingInventoryLocationId ? 'Editar bodega POS' : 'Nueva bodega POS' }}</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Código</span><input class="field-input" type="text" [(ngModel)]="inventoryLocationForm.code" /></label>
                <label class="field-group"><span>Nombre</span><input class="field-input" type="text" [(ngModel)]="inventoryLocationForm.name" /></label>
                <label class="field-group"><span>Tipo</span>
                  <select class="field-input" [(ngModel)]="inventoryLocationForm.type">
                    <option value="STORE">Store</option>
                    <option value="BACKROOM">Backroom</option>
                    <option value="WAREHOUSE">Warehouse</option>
                    <option value="TRANSIT">Transit</option>
                  </select>
                </label>
              </div>
              <div class="config-switches">
                <label><input type="checkbox" [(ngModel)]="inventoryLocationForm.isDefault" /> Predeterminada</label>
                <label><input type="checkbox" [(ngModel)]="inventoryLocationForm.isActive" /> Activa</label>
                <label><input type="checkbox" [(ngModel)]="inventoryLocationForm.allowPosSales" /> Disponible para ventas POS</label>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeInventoryLocationForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveInventoryLocation()" [disabled]="savingOperatingConfig()">Guardar bodega</button>
              </div>
            </div>
          }

          @if (showInventoryStockForm()) {
            <div class="config-inline-form">
              <h4>Cargar stock retail</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Bodega</span>
                  <select class="field-input" [(ngModel)]="inventoryStockForm.locationId">
                    <option value="">Selecciona</option>
                    @for (location of inventoryLocations(); track location.id) {
                      <option [value]="location.id">{{ location.code }} · {{ location.name }}</option>
                    }
                  </select>
                </label>
                <label class="field-group"><span>Producto</span>
                  <select class="field-input" [(ngModel)]="inventoryStockForm.productId">
                    <option value="">Selecciona</option>
                    @for (product of products(); track product.id) {
                      <option [value]="product.id">{{ product.sku }} · {{ product.name }}</option>
                    }
                  </select>
                </label>
                <label class="field-group"><span>Cantidad</span><input class="field-input" type="number" min="0" [(ngModel)]="inventoryStockForm.quantity" /></label>
                <label class="field-group"><span>Lote</span><input class="field-input" type="text" [(ngModel)]="inventoryStockForm.lotNumber" /></label>
                <label class="field-group"><span>Serie</span><input class="field-input" type="text" [(ngModel)]="inventoryStockForm.serialNumber" /></label>
                <label class="field-group"><span>Vence</span><input class="field-input" type="date" [(ngModel)]="inventoryStockForm.expiresAt" /></label>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeInventoryStockForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveInventoryStock()" [disabled]="savingOperatingConfig()">Guardar stock</button>
              </div>
            </div>
          }

          @if (showInventoryTransferForm()) {
            <div class="config-inline-form">
              <h4>Nueva transferencia entre tiendas</h4>
              <div class="config-form-grid">
                <label class="field-group"><span>Origen</span>
                  <select class="field-input" [(ngModel)]="inventoryTransferForm.fromLocationId">
                    <option value="">Selecciona</option>
                    @for (location of inventoryLocations(); track location.id) {
                      <option [value]="location.id">{{ location.code }} · {{ location.name }}</option>
                    }
                  </select>
                </label>
                <label class="field-group"><span>Destino</span>
                  <select class="field-input" [(ngModel)]="inventoryTransferForm.toLocationId">
                    <option value="">Selecciona</option>
                    @for (location of inventoryLocations(); track location.id) {
                      <option [value]="location.id">{{ location.code }} · {{ location.name }}</option>
                    }
                  </select>
                </label>
                <label class="field-group"><span>Referencia</span><input class="field-input" type="text" [(ngModel)]="inventoryTransferForm.reference" /></label>
              </div>
              <label class="field-group"><span>Notas</span><textarea class="field-input" rows="2" [(ngModel)]="inventoryTransferForm.notes"></textarea></label>
              <div class="config-card-list" style="margin:10px 0">
                @for (line of inventoryTransferForm.items; track $index) {
                  <article class="config-card-item">
                    <div class="config-form-grid" style="width:100%">
                      <label class="field-group"><span>Producto</span>
                        <select class="field-input" [(ngModel)]="line.productId">
                          <option value="">Selecciona</option>
                          @for (product of products(); track product.id) {
                            <option [value]="product.id">{{ product.sku }} · {{ product.name }}</option>
                          }
                        </select>
                      </label>
                      <label class="field-group"><span>Cantidad</span><input class="field-input" type="number" min="1" [(ngModel)]="line.quantity" /></label>
                      <label class="field-group"><span>Lote</span><input class="field-input" type="text" [(ngModel)]="line.lotNumber" /></label>
                      <label class="field-group"><span>Serie</span><input class="field-input" type="text" [(ngModel)]="line.serialNumber" /></label>
                    </div>
                    <div class="config-actions-inline">
                      <button class="btn-modal-sec" (click)="removeTransferLine($index)">Quitar</button>
                    </div>
                  </article>
                }
              </div>
              <div class="config-actions-inline" style="margin-bottom:10px">
                <button class="btn-modal-sec" (click)="addTransferLine()">Agregar ítem</button>
              </div>
              <div class="modal-footer modal-footer--inline">
                <button class="btn-modal-sec" (click)="closeInventoryTransferForm()">Cancelar</button>
                <button class="btn-modal-pri" (click)="saveInventoryTransfer()" [disabled]="savingOperatingConfig()">Guardar transferencia</button>
              </div>
            </div>
          }
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
              <div class="ssb-row">
                <span>↗ Ingresos de caja</span>
                <strong>{{ fmtCOP(sessionSummary()?.cashIn ?? 0) }}</strong>
              </div>
              <div class="ssb-row">
                <span>↘ Retiros parciales</span>
                <strong>{{ fmtCOP(sessionSummary()?.cashOut ?? 0) }}</strong>
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
            <div class="field-group" style="margin-top:12px">
              <label>Arqueo por denominación</label>
              <div class="denomination-grid">
                @for (bill of quickBills; track bill) {
                  <label class="denomination-item">
                    <span>{{ fmtCOP(bill) }}</span>
                    <input type="number" min="0" class="field-input" [(ngModel)]="closeDenominationCounts[bill]" />
                  </label>
                }
              </div>
              @if (countedCashByDenominations() > 0) {
                <small class="field-hint">Total contado por denominación: {{ fmtCOP(countedCashByDenominations()) }}</small>
              }
            </div>
            <!-- Diferencia en tiempo real -->
            @if (closeCashResolved() > 0) {
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
            @if (activeSession()?.shiftTemplate?.requiresBlindClose) {
              <div class="pos-config-chip" style="margin-top:12px">
                <strong>Cierre supervisado</strong>
                <span>Este turno exige revisión supervisor o aprobación manual del cierre.</span>
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

  <!-- Cash movements -->
  @if (showCashMovementModal()) {
    <div class="overlay" (click)="showCashMovementModal.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h10a3 3 0 003-3V7.414A2 2 0 0016.414 6L13 2.586A2 2 0 0011.586 2H4zm7 1.414L14.586 8H13a2 2 0 01-2-2V4.414z"/></svg>
          </div>
          <div>
            <div class="modal-title">Movimientos de caja</div>
            <div class="modal-subtitle">Registra retiros parciales, consignaciones y otros movimientos operativos.</div>
          </div>
          <button class="modal-close-btn" (click)="showCashMovementModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body modal-body--config">
          <div class="config-form-grid">
            <label class="field-group">
              <span>Tipo</span>
              <select class="field-input" [(ngModel)]="cashMovementType">
                <option value="OUT">Retiro parcial</option>
                <option value="IN">Ingreso de caja</option>
              </select>
            </label>
            <label class="field-group">
              <span>Monto</span>
              <input class="field-input" type="number" [(ngModel)]="cashMovementAmount" min="0" step="1000" />
            </label>
          </div>
          <label class="field-group">
            <span>Motivo</span>
            <textarea class="field-input" rows="2" [(ngModel)]="cashMovementReason" placeholder="Ej: retiro para consignación, pago de mensajería, etc."></textarea>
          </label>
          <div class="modal-footer modal-footer--inline">
            <button class="btn-modal-pri" (click)="saveCashMovement()" [disabled]="processing()">Registrar movimiento</button>
          </div>
          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Movimientos recientes</h4>
                <p>Trazabilidad de ingresos y retiros de la sesión actual.</p>
              </div>
            </div>
            <div class="config-card-list">
              @if (loadingCashMovements()) {
                <div class="config-empty">Cargando movimientos...</div>
              } @else {
                @for (movement of cashMovements(); track movement.id) {
                  <article class="config-card-item">
                    <div>
                      <strong>{{ movement.type === 'OUT' ? 'Retiro parcial' : 'Ingreso' }} · {{ fmtCOP(movement.amount) }}</strong>
                      <small>{{ movement.reason }} · {{ movement.user?.firstName }} {{ movement.user?.lastName }}</small>
                    </div>
                    <span class="history-badge">{{ movement.type === 'OUT' ? 'Salida' : 'Entrada' }}</span>
                  </article>
                } @empty {
                  <div class="config-empty">No hay movimientos registrados en esta sesión.</div>
                }
              }
            </div>
          </div>
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
            <div class="modal-subtitle pm-badge" [ngClass]="getPaymentClass(selectedPaymentMethod())">{{ getPaymentLabel(selectedPaymentMethod()) }}</div>
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

          <div class="payment-line-grid" style="margin-bottom:12px">
            <div class="field-group">
              <label>Canal origen</label>
              <input class="field-input" type="text" [(ngModel)]="sourceChannel" placeholder="POS, WEB, MARKETPLACE, WHATSAPP..." />
            </div>
            <div class="field-group">
              <label>Pedido externo</label>
              <select class="field-input" [(ngModel)]="externalOrderId">
                <option value="">Sin vincular</option>
                @for (order of externalOrders(); track order.id) {
                  <option [value]="order.id">{{ order.channel }} · {{ order.externalOrderNumber }} · {{ order.status }}</option>
                }
              </select>
            </div>
            <div class="field-group">
              <label>Cupón</label>
              <input class="field-input" type="text" [(ngModel)]="couponCode" placeholder="Código de cupón" />
            </div>
            <div class="field-group">
              <label>Puntos a redimir</label>
              <input class="field-input" type="number" [(ngModel)]="loyaltyPointsToRedeem" min="0" step="1" />
              @if (customerLoyaltyProfile()) {
                <small>{{ customerLoyaltyProfile()!.customer.loyaltyPointsBalance }} puntos disponibles</small>
              }
            </div>
          </div>

          @if (customerAccountStatement()) {
            <div class="config-summary-grid" style="margin-bottom:12px">
              <div class="config-summary-card">
                <span>Saldo POS</span>
                <strong>{{ fmtCOP(customerAccountStatement()!.summary.posPendingAmount) }}</strong>
                <small>{{ customerAccountStatement()!.pos.pendingCount }} pedidos pendientes</small>
              </div>
              <div class="config-summary-card">
                <span>Cartera</span>
                <strong>{{ fmtCOP(customerAccountStatement()!.summary.carteraBalance) }}</strong>
                <small>Estado de cuenta integrado del cliente</small>
              </div>
              <div class="config-summary-card">
                <span>Exposición total</span>
                <strong>{{ fmtCOP(customerAccountStatement()!.summary.combinedExposure) }}</strong>
                <small>POS + cartera del cliente</small>
              </div>
            </div>
          }

          @if (cashPaymentTotal() > 0) {
            <div class="field-group">
              <label for="amount-paid-input">Monto recibido del cliente (COP)</label>
              <input id="amount-paid-input" type="number" [ngModel]="cashPaymentTotal()"
                     (ngModelChange)="setCashPaymentAmount(+$event)"
                     min="0" step="1000" class="field-input pay-amount-input"
                     placeholder="0" aria-describedby="change-display" />
            </div>

            <div class="quick-bills">
              <button class="qb-btn qb-exact" (click)="setCashPaymentAmount(cartTotal())"
                      aria-label="Establecer monto exacto">
                Exacto
              </button>
              @for (bill of quickBills; track bill) {
                <button class="qb-btn" (click)="setCashPaymentAmount(cashPaymentTotal() + bill)"
                        [attr.aria-label]="'Agregar ' + fmtCOP(bill)">
                  +{{ fmtCOP(bill) }}
                </button>
              }
            </div>

            <div id="change-display" class="change-display" role="status" aria-live="polite">
              @if (paymentTotal() <= 0) {
                <div class="cd-neutral">
                  <span>Ingresa el monto recibido</span>
                </div>
              } @else if (paymentTotal() < cartTotal()) {
                <div class="cd-short">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M7.938 2.016A.13.13 0 018.002 2a.13.13 0 01.063.016.146.146 0 01.054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 01-.054.06.116.116 0 01-.066.017H1.146a.115.115 0 01-.066-.017.163.163 0 01-.054-.06.176.176 0 01.002-.183L7.884 2.073a.147.147 0 01.054-.057z"/></svg>
                  <span class="cd-label">Falta</span>
                  <strong class="cd-amount">{{ fmtCOP(cartTotal() - paymentTotal()) }}</strong>
                </div>
              } @else {
                <div class="cd-ok">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" aria-hidden="true"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                  <span class="cd-label">Cambio</span>
                  <strong class="cd-amount">{{ fmtCOP(changeAmount()) }}</strong>
                </div>
              }
            </div>
          }

          <div class="payment-lines-editor">
            <div class="payment-lines-header">
              <strong>Distribución de medios</strong>
              <button type="button" class="mini-link-btn" (click)="addPaymentLine()">+ Agregar línea</button>
            </div>
            @for (line of paymentLines(); track $index) {
              <div class="payment-line-card">
                <div class="payment-line-grid">
                  <div class="field-group">
                    <label>Medio</label>
                    <select class="field-input" [ngModel]="line.paymentMethod" (ngModelChange)="updatePaymentLine($index, { paymentMethod: $event })">
                      @for (m of paymentMethods; track m.value) {
                        @if (m.value !== 'MIXED') {
                          <option [value]="m.value">{{ m.label }}</option>
                        }
                      }
                    </select>
                  </div>
                  <div class="field-group">
                    <label>Monto</label>
                    <input class="field-input" type="number" [ngModel]="line.amount" (ngModelChange)="updatePaymentLine($index, { amount: +$event })" min="0" step="100" />
                  </div>
                  <div class="field-group">
                    <label>Referencia</label>
                    <input class="field-input" type="text" [ngModel]="line.transactionReference" (ngModelChange)="updatePaymentLine($index, { transactionReference: $event })" placeholder="NSU, voucher, transacción" />
                  </div>
                  <div class="field-group">
                    <label>Canal / proveedor</label>
                    <input class="field-input" type="text" [ngModel]="line.providerName" (ngModelChange)="updatePaymentLine($index, { providerName: $event })" placeholder="Datáfono, Nequi, convenio" />
                  </div>
                </div>
                @if (paymentLines().length > 1) {
                  <div class="payment-line-actions">
                    <button type="button" class="mini-link-btn danger" (click)="removePaymentLine($index)">Eliminar línea</button>
                  </div>
                }
              </div>
            }
            <div class="payment-lines-summary">
              <span>Total registrado</span>
              <strong>{{ fmtCOP(paymentTotal()) }}</strong>
            </div>
          </div>

          <!-- Toggle anticipo -->
          <div class="advance-toggle">
            <div class="field-group" style="margin-bottom:10px">
              <label>Tipo de pedido</label>
              <select class="field-input" [ngModel]="selectedOrderType()" (ngModelChange)="setOrderType($event)">
                <option value="IN_STORE">Venta mostrador</option>
                <option value="PICKUP">Pedido para recoger</option>
                <option value="DELIVERY">Domicilio</option>
                <option value="LAYAWAY">Venta apartada</option>
                <option value="PREORDER">Preorden</option>
              </select>
            </div>
            @if (selectedOrderType() !== 'IN_STORE') {
              <div class="payment-line-grid" style="margin-bottom:12px">
                <div class="field-group">
                  <label>Referencia</label>
                  <input class="field-input" type="text" [(ngModel)]="orderReference" placeholder="Pedido web, WhatsApp, app..." />
                </div>
                <div class="field-group">
                  <label>Programado para</label>
                  <input class="field-input" type="datetime-local" [(ngModel)]="scheduledAt" />
                </div>
                @if (selectedOrderType() === 'DELIVERY') {
                  <div class="field-group">
                    <label>Dirección de entrega</label>
                    <input class="field-input" type="text" [(ngModel)]="deliveryAddress" placeholder="Dirección del domicilio" />
                  </div>
                  <div class="field-group">
                    <label>Contacto</label>
                    <input class="field-input" type="text" [(ngModel)]="deliveryContactName" placeholder="Nombre de quien recibe" />
                  </div>
                  <div class="field-group">
                    <label>Teléfono</label>
                    <input class="field-input" type="text" [(ngModel)]="deliveryContactPhone" placeholder="Celular / WhatsApp" />
                  </div>
                }
              </div>
            }
            <label class="adv-toggle-label">
              <input type="checkbox" [ngModel]="isAdvancePayment()" (ngModelChange)="isAdvancePayment.set($event); amountPaid.set(0)" [disabled]="selectedOrderType() === 'LAYAWAY'" />
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
        @if (completedSale()!.orderType !== 'IN_STORE') {
          <div class="success-sale-num">{{ getOrderTypeLabel(completedSale()!.orderType) }} · {{ getOrderStatusLabel(completedSale()!.orderStatus) }}</div>
        }

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
        @if (hasCashPayment(completedSale()!) && completedSale()!.change > 0) {
          <div class="success-change-box">
            <span class="scb-label">Cambio a entregar</span>
            <span class="scb-amount">{{ fmtCOP(completedSale()!.change) }}</span>
          </div>
        }

        <!-- Factura generada -->
        @if (completedSale()!.invoice) {
          <div class="success-inv-block">
            <div class="sib-header">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" aria-hidden="true"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
              <span>{{ completedSale()!.invoice!.invoiceNumber }}</span>
              @if (completedSale()!.invoice!.status === 'ACCEPTED_DIAN') {
                <span class="dian-badge dian-accepted">DIAN ✓</span>
              } @else if (completedSale()!.invoice!.status === 'PAID') {
                <span class="dian-badge dian-paid">Pagada</span>
              } @else if (completedSale()!.invoice!.status === 'REJECTED_DIAN') {
                <span class="dian-badge dian-rejected">DIAN ✗</span>
              } @else if (completedSale()!.invoice!.status === 'SENT_DIAN') {
                <span class="dian-badge dian-sent">Enviada</span>
              } @else {
                <span class="dian-badge dian-draft">Borrador</span>
              }
            </div>
            <div class="sib-actions">
              @if (completedSale()!.invoice!.status === 'DRAFT') {
                <button class="sib-btn sib-btn--dian" (click)="submitInvoiceToDian(completedSale()!)" [disabled]="sendingDian[completedSale()!.id]">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/><path d="M7.646 1.146a.5.5 0 01.708 0l3 3a.5.5 0 01-.708.708L8.5 2.707V11.5a.5.5 0 01-1 0V2.707L5.354 4.854a.5.5 0 11-.708-.708l3-3z"/></svg>
                  {{ sendingDian[completedSale()!.id] ? 'Enviando…' : 'Enviar a DIAN' }}
                </button>
              } @else if (completedSale()!.invoice!.status === 'SENT_DIAN') {
                <button class="sib-btn" (click)="queryDianStatus(completedSale()!)" [disabled]="queryingDian[completedSale()!.id]">
                  {{ queryingDian[completedSale()!.id] ? 'Consultando…' : 'Consultar DIAN' }}
                </button>
              }
              <button class="sib-btn" (click)="openInvoiceModal(completedSale()!)">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M10.5 8a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/></svg>
                Ver factura
              </button>
            </div>
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
          } @else if (!completedSale()!.invoiceId && completedSale()!.customer) {
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

  <!-- Invoice Detail Drawer -->
  @if (showInvoiceModal() && selectedInvoiceSale()) {
    <div class="pos-drawer-overlay" (click)="showInvoiceModal.set(false)">
      <div class="pos-drawer" (click)="$event.stopPropagation()">

        <!-- Drawer header -->
        <div class="pos-drawer-header">
          <div class="pos-drawer-header-left">
            <div class="pos-drawer-inv-number">{{ selectedInvoiceSale()!.invoice?.invoiceNumber ?? selectedInvoiceSale()!.saleNumber }}</div>
            <div class="pos-drawer-meta">
              <span class="type-badge-pos">Factura electrónica</span>
              <span class="pos-drawer-dot">·</span>
              <span class="pos-drawer-date">{{ selectedInvoiceSale()!.createdAt | date:'dd MMM yyyy' }}</span>
            </div>
          </div>
          <div class="pos-drawer-header-right">
            @if (selectedInvoiceSale()!.invoice?.status === 'ACCEPTED_DIAN') {
              <span class="dian-badge dian-accepted">Aceptada ✓</span>
            } @else if (selectedInvoiceSale()!.invoice?.status === 'PAID') {
              <span class="dian-badge dian-paid">Pagada</span>
            } @else if (selectedInvoiceSale()!.invoice?.status === 'REJECTED_DIAN') {
              <span class="dian-badge dian-rejected">Rechazada ✗</span>
            } @else if (selectedInvoiceSale()!.invoice?.status === 'SENT_DIAN') {
              <span class="dian-badge dian-sent">Enviada</span>
            } @else {
              <span class="dian-badge dian-draft">Borrador</span>
            }
            <button class="pos-drawer-close" (click)="showInvoiceModal.set(false)" title="Cerrar">
              <svg viewBox="0 0 20 20" fill="currentColor" width="17"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
        </div>

        <!-- Drawer body -->
        <div class="pos-drawer-body">

          <!-- Venta info -->
          <div class="pos-dw-section">
            <div class="pos-dw-section-title">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M8 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path fill-rule="evenodd" d="M1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"/></svg>
              Información de venta
            </div>
            <div class="pos-dw-card">
              <div class="pos-dw-info-row">
                <span class="pos-dw-lbl">Nro. venta</span>
                <span class="pos-dw-val">{{ selectedInvoiceSale()!.saleNumber }}</span>
              </div>
              <div class="pos-dw-info-row">
                <span class="pos-dw-lbl">Fecha</span>
                <span class="pos-dw-val">{{ selectedInvoiceSale()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="pos-dw-info-row">
                <span class="pos-dw-lbl">Método de pago</span>
                <span class="pos-dw-val">{{ getPaymentMethodSummary(selectedInvoiceSale()!) }}</span>
              </div>
            </div>
          </div>

          <!-- Cliente -->
          @if (selectedInvoiceSale()!.customer) {
            <div class="pos-dw-section">
              <div class="pos-dw-section-title">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z"/></svg>
                Cliente
              </div>
              <div class="pos-dw-card">
                <div class="pos-dw-client-name">{{ selectedInvoiceSale()!.customer!.name }}</div>
                <div class="pos-dw-client-doc">{{ selectedInvoiceSale()!.customer!.documentType }}: {{ selectedInvoiceSale()!.customer!.documentNumber }}</div>
              </div>
            </div>
          }

          @if (selectedInvoiceDetail() || loadingInvoiceDetail()) {
            <div class="pos-dw-section">
              <div class="pos-dw-section-title">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path fill-rule="evenodd" d="M4.75 1a.75.75 0 01.75.75V3h5V1.75a.75.75 0 011.5 0V3h.75A2.25 2.25 0 0115 5.25v7.5A2.25 2.25 0 0112.75 15h-9.5A2.25 2.25 0 011 12.75v-7.5A2.25 2.25 0 013.25 3H4V1.75A.75.75 0 014.75 1zM2.5 6.5v6.25c0 .414.336.75.75.75h9.5a.75.75 0 00.75-.75V6.5h-11zm11-1.5v-.25a.75.75 0 00-.75-.75h-9.5a.75.75 0 00-.75.75V5h11z"/></svg>
                Fechas y documento
              </div>
              @if (loadingInvoiceDetail()) {
                <div class="pos-dw-card pos-dw-loading">
                  <div class="spinner-xs"></div>
                  Cargando detalle de factura...
                </div>
              } @else if (selectedInvoiceDetail()) {
                <div class="pos-dw-card">
                  <div class="pos-dw-date-grid">
                    <div class="pos-dw-date-chip">
                      <span class="pos-dw-date-lbl">Emisión</span>
                      <span class="pos-dw-date-val">{{ selectedInvoiceDetail()!.issueDate | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <div class="pos-dw-date-chip">
                      <span class="pos-dw-date-lbl">Vencimiento</span>
                      <span class="pos-dw-date-val">{{ selectedInvoiceDetail()!.dueDate ? (selectedInvoiceDetail()!.dueDate! | date:'dd/MM/yyyy') : 'Contado' }}</span>
                    </div>
                    <div class="pos-dw-date-chip">
                      <span class="pos-dw-date-lbl">Moneda</span>
                      <span class="pos-dw-date-val">{{ selectedInvoiceDetail()!.currency ?? 'COP' }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Ítems -->
          <div class="pos-dw-section">
            <div class="pos-dw-section-title">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M3 2a2 2 0 00-2 2v1h14V4a2 2 0 00-2-2H3zm13 3H0v6a2 2 0 002 2h12a2 2 0 002-2V5z"/></svg>
              Ítems ({{ selectedInvoiceSale()!.items.length }})
            </div>
            <div class="pos-dw-items">
              <div class="pos-dw-items-head">
                <span>Producto</span>
                <span class="tc">Cant.</span>
                <span class="tr">Total</span>
              </div>
              @for (item of selectedInvoiceSale()!.items; track item.id) {
                <div class="pos-dw-item-row">
                  <div class="pos-dw-item-desc">
                    <span class="pos-dw-item-name">{{ item.description }}</span>
                    @if (item.taxRate > 0) {
                      <span class="pos-dw-item-tax">IVA {{ item.taxRate }}%</span>
                    }
                  </div>
                  <span class="tc pos-dw-item-qty">{{ item.quantity }}</span>
                  <span class="tr pos-dw-item-total">{{ fmtCOP(item.total) }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Totales -->
          <div class="pos-dw-section">
            <div class="pos-dw-section-title">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.95-.8-2.12-1.718H4zm2.09-5.9c0-1.028.836-1.6 2.056-1.71V8.84c-1.164-.267-2.056-.82-2.056-1.96zm2.56 6.116c1.38.235 2.07.87 2.07 1.964 0 1.164-.85 1.807-2.07 1.962v-3.926z"/></svg>
              Totales
            </div>
            <div class="pos-dw-totals">
              <div class="pos-dw-total-row">
                <span>Subtotal</span>
                <span>{{ fmtCOP(selectedInvoiceSale()!.subtotal) }}</span>
              </div>
              <div class="pos-dw-total-row">
                <span>IVA</span>
                <span>{{ fmtCOP(selectedInvoiceSale()!.taxAmount) }}</span>
              </div>
              @if (selectedInvoiceSale()!.discountAmount > 0) {
                <div class="pos-dw-total-row pos-dw-total-disc">
                  <span>Descuento</span>
                  <span>-{{ fmtCOP(selectedInvoiceSale()!.discountAmount) }}</span>
                </div>
              }
              <div class="pos-dw-total-row pos-dw-total-grand">
                <span>TOTAL</span>
                <strong>{{ fmtCOP(selectedInvoiceSale()!.total) }}</strong>
              </div>
            </div>
          </div>

          <!-- DIAN -->
          @if (selectedInvoiceSale()!.invoice) {
            <div class="pos-dw-section">
              <div class="pos-dw-section-title">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path fill-rule="evenodd" d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.414A2 2 0 0013.414 3L11 .586A2 2 0 009.586 0H4zm7 1.5v2A1.5 1.5 0 0012.5 5h2V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h7z"/></svg>
                Factura electrónica DIAN
              </div>
              <div class="pos-dw-card">
                <div class="pos-dw-info-row">
                  <span class="pos-dw-lbl">Número</span>
                  <span class="pos-dw-val">{{ selectedInvoiceSale()!.invoice!.invoiceNumber }}</span>
                </div>
                @if (selectedInvoiceDetail()?.status) {
                  <div class="pos-dw-info-row">
                    <span class="pos-dw-lbl">Estado interno</span>
                    <span class="pos-dw-val">{{ selectedInvoiceDetail()!.status }}</span>
                  </div>
                }
                <div class="pos-dw-info-row">
                  <span class="pos-dw-lbl">Estado</span>
                  <span class="pos-dw-val">
                    @if (selectedInvoiceSale()!.invoice!.status === 'ACCEPTED_DIAN') {
                      <span class="dian-badge dian-accepted">Aceptada ✓</span>
                    } @else if (selectedInvoiceSale()!.invoice!.status === 'PAID') {
                      <span class="dian-badge dian-paid">Pagada</span>
                    } @else if (selectedInvoiceSale()!.invoice!.status === 'REJECTED_DIAN') {
                      <span class="dian-badge dian-rejected">Rechazada ✗</span>
                    } @else if (selectedInvoiceSale()!.invoice!.status === 'SENT_DIAN') {
                      <span class="dian-badge dian-sent">Enviada</span>
                    } @else {
                      <span class="dian-badge dian-draft">Borrador</span>
                    }
                  </span>
                </div>
                @if (selectedInvoiceDetail()?.dianStatusCode) {
                  <div class="pos-dw-info-row">
                    <span class="pos-dw-lbl">Código DIAN</span>
                    <span class="pos-dw-val pos-dw-code">
                      {{ selectedInvoiceDetail()!.dianStatusCode }}
                      @if (dianCodeDesc(selectedInvoiceDetail()!.dianStatusCode)) {
                        <small>{{ dianCodeDesc(selectedInvoiceDetail()!.dianStatusCode) }}</small>
                      }
                    </span>
                  </div>
                }
                @if (selectedInvoiceSale()!.invoice!.dianZipKey) {
                  <div class="pos-dw-info-row">
                    <span class="pos-dw-lbl">ZipKey</span>
                    <span class="pos-dw-val pos-dw-mono">
                      {{ selectedInvoiceSale()!.invoice!.dianZipKey }}
                      <button class="pos-dw-copy" (click)="copyText(selectedInvoiceSale()!.invoice!.dianZipKey)">Copiar</button>
                    </span>
                  </div>
                }
                @if (selectedInvoiceSale()!.invoice!.dianCufe) {
                  <div class="pos-dw-cufe-block">
                    <span class="pos-dw-lbl">CUFE</span>
                    <code class="pos-dw-cufe-code">{{ selectedInvoiceSale()!.invoice!.dianCufe }}</code>
                    <button class="pos-dw-copy pos-dw-copy--inline" (click)="copyText(selectedInvoiceSale()!.invoice!.dianCufe)">Copiar CUFE</button>
                  </div>
                }
                @if (selectedInvoiceSale()!.invoice!.dianStatusMsg) {
                  <div class="pos-dw-info-row">
                    <span class="pos-dw-lbl">Respuesta DIAN</span>
                    <span class="pos-dw-val pos-dw-muted">{{ selectedInvoiceSale()!.invoice!.dianStatusMsg }}</span>
                  </div>
                }
              </div>
            </div>
          }

          @if (selectedInvoiceDetail()?.notes) {
            <div class="pos-dw-section">
              <div class="pos-dw-section-title">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11"><path d="M2 3.75A1.75 1.75 0 013.75 2h8.5A1.75 1.75 0 0114 3.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5zm2.25 1a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zm0 3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zm0 3a.75.75 0 100 1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>
                Observaciones
              </div>
              <div class="pos-dw-card pos-dw-note">
                {{ selectedInvoiceDetail()!.notes }}
              </div>
            </div>
          }

        </div>

        <!-- Drawer footer -->
        <div class="pos-drawer-footer">
          @if (selectedInvoiceSale()!.invoice?.status === 'DRAFT') {
            <button class="pos-dw-btn pos-dw-btn--primary" (click)="submitInvoiceToDian(selectedInvoiceSale()!); showInvoiceModal.set(false)" [disabled]="sendingDian[selectedInvoiceSale()!.id]">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
              {{ sendingDian[selectedInvoiceSale()!.id] ? 'Enviando...' : 'Enviar a la DIAN' }}
            </button>
          }
          @if (selectedInvoiceSale()!.invoice?.dianZipKey || selectedInvoiceSale()!.invoice?.dianCufe) {
            <button class="pos-dw-btn pos-dw-btn--outline" (click)="queryDianStatus(selectedInvoiceSale()!)" [disabled]="queryingDian[selectedInvoiceSale()!.id]">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
              {{ queryingDian[selectedInvoiceSale()!.id] ? 'Consultando...' : 'Consultar DIAN' }}
            </button>
          }
          <button class="pos-dw-btn pos-dw-btn--outline" (click)="openInvoicePdf(selectedInvoiceSale()!)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M9.293 0H3.5A1.5 1.5 0 002 1.5v13A1.5 1.5 0 003.5 16h9a1.5 1.5 0 001.5-1.5V4.707L9.293 0zM9 1.5 12.5 5H9V1.5z"/><path d="M4.75 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z"/></svg>
            Vista previa
          </button>
          <button class="pos-dw-btn pos-dw-btn--outline" (click)="downloadInvoicePdf(selectedInvoiceSale()!)" [disabled]="downloadingInvoicePdf()">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M8 1a.75.75 0 01.75.75v6.19l1.72-1.72a.75.75 0 111.06 1.06L8.53 10.28a.75.75 0 01-1.06 0L4.47 7.28a.75.75 0 111.06-1.06l1.72 1.72V1.75A.75.75 0 018 1z"/><path d="M2.75 10.5a.75.75 0 00-.75.75v1A2.75 2.75 0 004.75 15h6.5A2.75 2.75 0 0014 12.25v-1a.75.75 0 00-1.5 0v1c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1a.75.75 0 00-.75-.75z"/></svg>
            {{ downloadingInvoicePdf() ? 'Descargando PDF...' : 'Descargar PDF' }}
          </button>
          @if (selectedInvoiceSale()!.invoice?.dianCufe) {
            <button class="pos-dw-btn pos-dw-btn--outline" (click)="downloadInvoiceZip(selectedInvoiceSale()!)" [disabled]="downloadingInvoiceZip()">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M8 1a.75.75 0 01.75.75v6.19l1.72-1.72a.75.75 0 111.06 1.06L8.53 10.28a.75.75 0 01-1.06 0L4.47 7.28a.75.75 0 111.06-1.06l1.72 1.72V1.75A.75.75 0 018 1z"/><path d="M2.75 10.5a.75.75 0 00-.75.75v1A2.75 2.75 0 004.75 15h6.5A2.75 2.75 0 0014 12.25v-1a.75.75 0 00-1.5 0v1c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1a.75.75 0 00-.75-.75z"/></svg>
              {{ downloadingInvoiceZip() ? 'Descargando ZIP...' : 'Descargar ZIP' }}
            </button>
          }
          @if (selectedInvoiceSale()!.invoice && canMarkInvoicePaid()) {
            <button class="pos-dw-btn pos-dw-btn--success" (click)="markInvoicePaid(selectedInvoiceSale()!)">
              <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
              Marcar pagada
            </button>
          }
          <button class="pos-dw-btn pos-dw-btn--ghost" (click)="showInvoiceModal.set(false)">Cerrar</button>
        </div>

      </div>
    </div>
  }

  @if (showInvoicePdfModal()) {
    <div class="modal-overlay">
      <div class="modal modal-pdf" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" style="color:#dc2626"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"/></svg>
            Vista previa de factura
          </h3>
          <button class="modal-close" (click)="closeInvoicePdfModal()">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="pdf-iframe-wrap">
          @if (loadingInvoicePdfPreview()) {
            <div class="pdf-loading"><div class="pdf-spinner"></div><p>Generando previsualización...</p></div>
          } @else if (invoicePdfUrl()) {
            <iframe [src]="invoicePdfUrl()!" class="pdf-iframe" frameborder="0"></iframe>
          }
        </div>
        <div class="modal-footer">
          <span class="pdf-note">⚠ Las facturas en borrador incluyen marca de agua</span>
          <button class="btn btn-primary" (click)="selectedInvoiceSale() && downloadInvoicePdf(selectedInvoiceSale()!)" [disabled]="downloadingInvoicePdf() || !selectedInvoiceSale()">
            {{ downloadingInvoicePdf() ? 'Descargando...' : 'Descargar PDF' }}
          </button>
          <button class="btn btn-secondary" (click)="closeInvoicePdfModal()">Cerrar</button>
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
          <div class="payment-lines-editor" style="margin-top:12px">
            <div class="payment-lines-header">
              <strong>Medios del abono</strong>
              <button type="button" class="mini-link-btn" (click)="addAdvancePaymentLine()">+ Agregar línea</button>
            </div>
            @for (line of addPaymentLines; track $index) {
              <div class="payment-line-card">
                <div class="payment-line-grid">
                  <div class="field-group">
                    <label>Medio</label>
                    <select class="field-input" [ngModel]="line.paymentMethod" (ngModelChange)="updateAdvancePaymentLine($index, { paymentMethod: $event })">
                      @for (m of paymentMethods; track m.value) {
                        @if (m.value !== 'MIXED') {
                          <option [value]="m.value">{{ m.label }}</option>
                        }
                      }
                    </select>
                  </div>
                  <div class="field-group">
                    <label>Monto</label>
                    <input class="field-input" type="number" [ngModel]="line.amount" (ngModelChange)="updateAdvancePaymentLine($index, { amount: +$event })" min="0.01" [max]="selectedAdvanceSale()?.remainingAmount ?? 0" />
                  </div>
                  <div class="field-group">
                    <label>Referencia</label>
                    <input class="field-input" type="text" [ngModel]="line.transactionReference" (ngModelChange)="updateAdvancePaymentLine($index, { transactionReference: $event })" placeholder="Referencia opcional" />
                  </div>
                  <div class="field-group">
                    <label>Canal / proveedor</label>
                    <input class="field-input" type="text" [ngModel]="line.providerName" (ngModelChange)="updateAdvancePaymentLine($index, { providerName: $event })" placeholder="Datáfono, wallet, convenio" />
                  </div>
                </div>
                @if (addPaymentLines.length > 1) {
                  <div class="payment-line-actions">
                    <button type="button" class="mini-link-btn danger" (click)="removeAdvancePaymentLine($index)">Eliminar línea</button>
                  </div>
                }
              </div>
            }
            <div class="payment-lines-summary">
              <span>Total del abono</span>
              <strong>{{ fmtCOP(addPaymentAmount) }}</strong>
            </div>
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

  @if (showDispatchModal()) {
    <div class="overlay" role="dialog" aria-modal="true" (click)="showDispatchModal.set(false)">
      <div class="modal modal-adv" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M0 3.5A1.5 1.5 0 011.5 2h9A1.5 1.5 0 0112 3.5V5h1.02a1.5 1.5 0 011.17.563l1.481 1.85a1.5 1.5 0 01.329.938V10.5a1.5 1.5 0 01-1.5 1.5H14a2 2 0 11-4 0H5a2 2 0 11-3.998-.085A1.5 1.5 0 010 10.5v-7z"/></svg>
          </div>
          <div>
            <div class="modal-title">Despachar pedido</div>
            <div class="modal-subtitle">{{ selectedAdvanceSale()?.saleNumber }}</div>
          </div>
          <button class="modal-close-btn" (click)="showDispatchModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="field-group">
            <label>Notas de despacho</label>
            <input type="text" [(ngModel)]="dispatchNotes" class="field-input" placeholder="Ej: Mensajero externo, guía o novedad" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showDispatchModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri" (click)="submitDispatch()" [disabled]="processingAdvance()">
            @if (processingAdvance()) { <span class="spinner-sm"></span> Procesando... } @else { Confirmar despacho }
          </button>
        </div>
      </div>
    </div>
  }

  @if (showPostSaleModal()) {
    <div class="overlay" role="dialog" aria-modal="true" (click)="showPostSaleModal.set(false)">
      <div class="modal modal-operating-config" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-header-icon teal">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M10 2a.75.75 0 01.75.75V4h2.5A2.75 2.75 0 0116 6.75v2.5a.75.75 0 01-1.5 0v-2.5c0-.69-.56-1.25-1.25-1.25h-2.5V7a.75.75 0 01-1.5 0V5.5h-2.5c-.69 0-1.25.56-1.25 1.25v2.5a.75.75 0 01-1.5 0v-2.5A2.75 2.75 0 016.75 4h2.5V2.75A.75.75 0 0110 2zm-4.53 8.22a.75.75 0 011.06 0L10 13.69l3.47-3.47a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 010-1.06z"/></svg>
          </div>
          <div>
            <div class="modal-title">Postventa POS</div>
            <div class="modal-subtitle">{{ selectedPostSaleSale()?.saleNumber }} · devolución parcial o cambio</div>
          </div>
          <button class="modal-close-btn" (click)="showPostSaleModal.set(false)">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
          </button>
        </div>
        <div class="modal-body modal-body--config">
          <div class="config-form-grid">
            <label class="field-group">
              <span>Tipo de gestión</span>
              <select class="field-input" [ngModel]="postSaleType()" (ngModelChange)="postSaleType.set($event)">
                <option value="RETURN">Devolución parcial</option>
                <option value="EXCHANGE">Cambio por producto</option>
              </select>
            </label>
            <label class="field-group">
              <span>Motivo</span>
              <select class="field-input" [ngModel]="postSaleReasonCode()" (ngModelChange)="postSaleReasonCode.set($event)">
                <option value="DEFECTIVE_PRODUCT">Producto defectuoso</option>
                <option value="WRONG_PRODUCT">Producto incorrecto</option>
                <option value="CUSTOMER_DISSATISFACTION">Inconformidad del cliente</option>
                <option value="BILLING_ERROR">Error de facturación</option>
                <option value="WARRANTY">Garantía</option>
                <option value="OTHER">Otro</option>
              </select>
            </label>
          </div>
          <label class="field-group">
            <span>Detalle adicional</span>
            <textarea class="field-input" rows="2" [(ngModel)]="postSaleReasonDetail" placeholder="Soporte o contexto para el supervisor"></textarea>
          </label>

          <div class="config-section">
            <div class="config-section__header">
              <div>
                <h4>Ítems a devolver</h4>
                <p>Selecciona la cantidad exacta a devolver por cada línea vendida.</p>
              </div>
            </div>
            <div class="config-card-list">
              @for (line of postSaleLines(); track line.saleItemId) {
                <article class="config-card-item">
                  <div>
                    <strong>{{ line.description }}</strong>
                    <small>Vendido: {{ line.soldQuantity }}</small>
                  </div>
                  <div class="config-actions-inline">
                    <input class="field-input" style="width:110px" type="number" min="0" [max]="line.soldQuantity" [ngModel]="line.quantity" (ngModelChange)="updatePostSaleLine($index, +$event)" />
                  </div>
                </article>
              }
            </div>
          </div>

          @if (postSaleType() === 'EXCHANGE') {
            <div class="config-section">
              <div class="config-section__header">
                <div>
                  <h4>Productos de reemplazo</h4>
                  <p>El cambio descontará inventario al momento de la aprobación del supervisor.</p>
                </div>
                <button class="btn-modal-sec" (click)="addReplacementLine()">Agregar línea</button>
              </div>
              <div class="config-card-list">
                @for (line of postSaleReplacementLines(); track $index) {
                  <article class="config-card-item">
                    <div class="config-form-grid" style="width:100%">
                      <label class="field-group">
                        <span>Producto</span>
                        <select class="field-input" [ngModel]="line.productId" (ngModelChange)="updateReplacementLine($index, { productId: $event })">
                          <option value="">Selecciona un producto</option>
                          @for (product of products(); track product.id) {
                            <option [value]="product.id">{{ product.name }} · {{ product.sku }} · {{ fmtCOP(product.price) }}</option>
                          }
                        </select>
                      </label>
                      <label class="field-group">
                        <span>Cantidad</span>
                        <input class="field-input" type="number" min="0" [ngModel]="line.quantity" (ngModelChange)="updateReplacementLine($index, { quantity: +$event })" />
                      </label>
                    </div>
                    @if (postSaleReplacementLines().length > 1) {
                      <div class="config-actions-inline">
                        <button class="btn-modal-sec" (click)="removeReplacementLine($index)">Quitar</button>
                      </div>
                    }
                  </article>
                }
              </div>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-modal-sec" (click)="showPostSaleModal.set(false)">Cancelar</button>
          <button class="btn-modal-pri" (click)="submitPostSaleRequest()" [disabled]="submittingPostSale()">
            {{ submittingPostSale() ? 'Enviando...' : 'Enviar a aprobación' }}
          </button>
        </div>
      </div>
    </div>
  }

<app-confirm-dialog />
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
    .pos-root--fullscreen {
      height:100vh;
      background:
        radial-gradient(circle at top left, rgba(0, 198, 160, 0.1), transparent 24%),
        radial-gradient(circle at top right, rgba(26, 64, 126, 0.1), transparent 20%),
        #edf4fb;
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
    .sb-btn--fullscreen { background:rgba(14,165,233,.18); border-color:rgba(125,211,252,.3); color:#effbff; }
    .sb-btn--fullscreen:hover { background:rgba(14,165,233,.26); border-color:rgba(186,230,253,.44); }

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
    .pos-root--fullscreen .pos-layout { padding:14px; gap:14px; }
    .pos-root--fullscreen .products-panel,
    .pos-root--fullscreen .checkout-panel { border-radius:20px; }
    .pos-root--fullscreen .products-grid { grid-template-columns:repeat(auto-fill,minmax(184px,1fr)); gap:14px; }
    .pos-root--fullscreen .checkout-shell { scroll-padding-bottom:132px; }
    .pos-root--fullscreen .cart-hero { margin:0 16px 14px; }

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
    .catalog-location-bar { padding:8px 14px 0; background:rgba(255,255,255,.8); }

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
    .pc-submeta { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; font-size:10px; color:#64748b; }
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
    .ct-price-list { margin-bottom:10px; }
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
    .pm-chip.pm-dataphone { background:#e0f2fe; color:#075985; border:1px solid #7dd3fc; }
    .pm-chip.pm-wallet { background:#dcfce7; color:#166534; border:1px solid #86efac; }
    .pm-chip.pm-voucher { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
    .pm-chip.pm-gift-card { background:#fae8ff; color:#86198f; border:1px solid #e879f9; }
    .pm-chip.pm-agreement { background:#ecfccb; color:#3f6212; border:1px solid #bef264; }
    .status-chip.status-completed { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .status-chip.status-cancelled { background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; }
    .status-chip.status-refunded { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
    .status-chip.status-advance { background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; }
    .inv-chip { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
    .inv-chip--sm { font-size:10px; padding:4px 8px; }
    .inv-chip--number { font-size:10.5px; font-weight:800; letter-spacing:.03em; box-shadow:inset 0 1px 0 rgba(255,255,255,.45); }
    .inv-dian-cell {
      display:flex; flex-direction:column; align-items:stretch; gap:8px; min-width:164px;
      padding:8px 10px; border-radius:14px; background:linear-gradient(180deg,#ffffff 0%, #f8fbff 100%);
      border:1px solid #e2e8f0; box-shadow:0 8px 22px rgba(15,23,42,.04);
    }
    .inv-dian-head { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; }
    .inv-dian-actions { display:flex; align-items:center; justify-content:center; gap:6px; flex-wrap:wrap; }
    .dian-badge { display:inline-block; padding:2px 7px; border-radius:5px; font-size:10px; font-weight:700; white-space:nowrap; }
    .dian-accepted { background:#dcfce7; color:#166534; border:1px solid #bbf7d0; }
    .dian-rejected { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
    .dian-sent { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
    .dian-draft { background:#f3f4f6; color:#374151; border:1px solid #d1d5db; }
    .dian-btn { font-size:10.5px; padding:2px 6px; }

    .payment-lines-editor {
      display:grid; gap:10px; margin-top:14px; padding:14px;
      border:1px solid #dce6f0; border-radius:16px;
      background:linear-gradient(180deg,#ffffff 0%, #f8fbff 100%);
    }
    .payment-lines-header,
    .payment-lines-summary,
    .payment-line-actions {
      display:flex; align-items:center; justify-content:space-between; gap:10px;
    }
    .payment-line-card {
      display:grid; gap:8px; padding:12px;
      border:1px solid #e2e8f0; border-radius:14px; background:#fff;
    }
    .payment-line-grid {
      display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px;
    }
    .payment-lines-summary {
      padding-top:4px; border-top:1px dashed #dce6f0;
      font-size:12px; color:#475569;
    }
    .payment-lines-summary strong { font-size:14px; color:#0f172a; }
    .mini-link-btn {
      border:none; background:transparent; cursor:pointer;
      color:#1d4ed8; font-size:12px; font-weight:700;
    }
    .mini-link-btn.danger { color:#b91c1c; }
    @media (max-width: 900px) {
      .payment-line-grid { grid-template-columns:1fr; }
    }

    /* Invoice success block in overlay */
    .success-inv-block { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 14px; margin:10px 0; }
    .sib-header { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#1e40af; margin-bottom:8px; }
    .sib-actions { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
    .sib-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid #93c5fd; background:#fff; color:#1e40af; transition:all .12s; }
    .sib-btn:hover { background:#dbeafe; }
    .sib-btn:disabled { opacity:.6; cursor:not-allowed; }
    .sib-btn--dian { background:#1a407e; color:#fff; border-color:#1a407e; }
    .sib-btn--dian:hover { background:#1e3a8a; }
    .dian-sent { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
    .dian-draft { background:#f3f4f6; color:#374151; border:1px solid #d1d5db; }
    .dian-paid { background:#dcfce7; color:#166534; border:1px solid #86efac; }
    /* Invoice modal */
    .modal-invoice { width:460px; }
    .inv-modal-rows { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
    .inv-modal-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #f0f4f8; }
    .imr-label { font-size:12.5px; color:#7ea3cc; }
    .imr-val { font-size:13px; color:#1a1a2e; }
    .imr-mono { font-family:monospace; font-size:11px; word-break:break-all; }
    .imr-muted { font-size:11.5px; color:#6b7280; max-width:220px; text-align:right; }
    .inv-modal-dian { margin-top:4px; }
    .inv-modal-hint { font-size:12.5px; color:#6b7280; margin:0 0 12px; line-height:1.5; }
    .inv-modal-success { display:flex; align-items:center; gap:8px; padding:12px; background:#dcfce7; border-radius:8px; color:#166534; font-size:13px; font-weight:600; }

    /* POS Invoice Drawer */
    .pos-drawer-overlay { position:fixed; inset:0; background:rgba(12,28,53,.45); z-index:600; display:flex; justify-content:flex-end; backdrop-filter:blur(2px); animation:fadeIn .15s ease; }
    .pos-drawer { width:460px; max-width:100vw; background:#fff; height:100%; display:flex; flex-direction:column; box-shadow:-8px 0 32px rgba(12,28,53,.14); animation:slideInRight .2s ease; }
    @keyframes slideInRight { from{transform:translateX(40px);opacity:0} to{transform:none;opacity:1} }
    .pos-drawer-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 14px; border-bottom:1px solid #f0f4f8; flex-shrink:0; gap:10px; }
    .pos-drawer-header-left { flex:1; min-width:0; }
    .pos-drawer-inv-number { font-size:18px; font-weight:800; color:#0c1c35; letter-spacing:.3px; }
    .pos-drawer-meta { display:flex; align-items:center; gap:6px; margin-top:4px; }
    .type-badge-pos { display:inline-block; padding:2px 8px; border-radius:5px; font-size:10.5px; font-weight:700; background:#ede9fe; color:#5b21b6; }
    .pos-drawer-dot { color:#cbd5e1; font-size:12px; }
    .pos-drawer-date { font-size:12px; color:#94a3b8; }
    .pos-drawer-header-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .pos-drawer-close { background:none; border:none; cursor:pointer; color:#94a3b8; padding:5px; border-radius:7px; transition:all .15s; }
    .pos-drawer-close:hover { background:#f1f5f9; color:#374151; }
    .pos-drawer-body { flex:1; overflow-y:auto; padding:0; scrollbar-width:thin; scrollbar-color:#e2e8f0 transparent; }
    .pos-dw-section { padding:14px 20px; border-bottom:1px solid #f8fafc; }
    .pos-dw-section:last-child { border-bottom:none; }
    .pos-dw-section-title { display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#94a3b8; margin-bottom:10px; }
    .pos-dw-card { background:#f8fafc; border:1px solid #f0f4f8; border-radius:10px; padding:12px 14px; }
    .pos-dw-info-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f0f4f8; }
    .pos-dw-info-row:last-child { border-bottom:none; }
    .pos-dw-lbl { font-size:11.5px; color:#94a3b8; }
    .pos-dw-val { font-size:12.5px; color:#1e293b; text-align:right; }
    .pos-dw-mono { font-family:monospace; font-size:11px; word-break:break-all; max-width:200px; }
    .pos-dw-code { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
    .pos-dw-code small { font-size:10px; color:#94a3b8; }
    .pos-dw-muted { font-size:11px; color:#6b7280; max-width:200px; text-align:right; }
    .pos-dw-client-name { font-size:14px; font-weight:700; color:#0c1c35; margin-bottom:3px; }
    .pos-dw-client-doc { font-size:12px; color:#64748b; font-family:monospace; }
    .pos-dw-date-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; }
    .pos-dw-date-chip { padding:10px 12px; border-radius:10px; background:#fff; border:1px solid #e2e8f0; }
    .pos-dw-date-lbl { display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; margin-bottom:4px; }
    .pos-dw-date-val { display:block; font-size:12.5px; font-weight:700; color:#1e293b; }
    .pos-dw-loading { display:flex; align-items:center; gap:8px; color:#64748b; }
    .pos-dw-items { border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .pos-dw-items-head { display:grid; grid-template-columns:1fr 52px 80px; padding:6px 12px; background:#f8fafc; border-bottom:1px solid #f0f4f8; }
    .pos-dw-items-head span { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; }
    .pos-dw-item-row { display:grid; grid-template-columns:1fr 52px 80px; align-items:center; padding:8px 12px; border-bottom:1px solid #f8fafc; }
    .pos-dw-item-row:last-child { border-bottom:none; }
    .pos-dw-item-name { display:block; font-size:12.5px; font-weight:600; color:#1e293b; }
    .pos-dw-item-tax { display:inline-block; font-size:10px; color:#94a3b8; background:#f1f5f9; padding:1px 5px; border-radius:4px; margin-top:2px; }
    .pos-dw-item-qty { font-size:12.5px; color:#475569; }
    .pos-dw-item-total { font-size:12.5px; font-weight:700; color:#0c1c35; }
    .pos-dw-totals { border:1px solid #f0f4f8; border-radius:10px; overflow:hidden; }
    .pos-dw-total-row { display:flex; justify-content:space-between; padding:7px 14px; border-bottom:1px solid #f0f4f8; font-size:13px; color:#64748b; }
    .pos-dw-total-row:last-child { border-bottom:none; }
    .pos-dw-total-disc { color:#f59e0b; }
    .pos-dw-total-grand { background:#fff; border-top:2px solid #e8eef8 !important; font-weight:700; color:#0c1c35; font-size:14px; }
    .pos-dw-total-grand strong { font-family:'Sora',sans-serif; font-size:16px; font-weight:800; color:#1a407e; }
    .pos-dw-cufe-block { padding:8px 0 4px; border-top:1px solid #f0f4f8; margin-top:4px; }
    .pos-dw-cufe-code { display:block; font-size:10px; color:#475569; font-family:monospace; word-break:break-all; margin-top:4px; background:#f1f5f9; padding:6px 8px; border-radius:6px; line-height:1.5; }
    .pos-dw-copy { margin-left:8px; padding:3px 7px; border:none; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-size:10px; font-weight:700; cursor:pointer; }
    .pos-dw-copy--inline { margin-top:8px; margin-left:0; }
    .pos-dw-note { font-size:12.5px; color:#475569; line-height:1.6; white-space:pre-wrap; }
    .pos-drawer-footer { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; padding:14px 20px; border-top:1px solid #f0f4f8; flex-shrink:0; background:#fafcff; align-items:stretch; }
    .pos-dw-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; min-height:40px; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:all .12s; border:none; text-align:center; }
    .pos-dw-btn:disabled { opacity:.6; cursor:not-allowed; }
    .pos-dw-btn--primary { background:#1a407e; color:#fff; }
    .pos-dw-btn--primary:hover:not(:disabled) { background:#1e3a8a; }
    .pos-dw-btn--outline { background:#fff; border:1.5px solid #dce6f0; color:#374151; }
    .pos-dw-btn--outline:hover:not(:disabled) { border-color:#93c5fd; color:#1a407e; }
    .pos-dw-btn--success { background:#ecfdf5; border:1.5px solid #a7f3d0; color:#047857; }
    .pos-dw-btn--success:hover:not(:disabled) { background:#d1fae5; }
    .pos-dw-btn--ghost { background:none; border:1.5px dashed #dce6f0; color:#94a3b8; }
    .pos-dw-btn--ghost:hover { color:#374151; }
    /* Improved invoice toggle */
    .it-disabled { opacity:.55; cursor:not-allowed !important; }
    .it-sub--warn { color:#d97706 !important; }

    .status-stack { display:flex; flex-direction:column; align-items:center; gap:6px; }
    .td-actions { display:flex; align-items:center; justify-content:center; gap:8px; min-width:156px; flex-wrap:wrap; }
    .history-link-btn {
      display:inline-flex; align-items:center; gap:6px;
      justify-content:center; min-height:30px; min-width:72px;
      padding:6px 11px; border-radius:999px; border:1px solid transparent;
      font-size:11px; font-weight:700; cursor:pointer; transition:all .14s;
      background:#f8fafc; color:#1e3a8a;
    }
    .history-link-btn svg { flex-shrink:0; }
    .history-link-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 18px rgba(26,64,126,.08); }
    .history-link-btn:disabled { opacity:.6; cursor:not-allowed; box-shadow:none; transform:none; }
    .history-link-btn--neutral { background:#fff; border-color:#dbe5f0; color:#334155; }
    .history-link-btn--neutral:hover:not(:disabled) { border-color:#93c5fd; color:#1d4ed8; background:#eff6ff; }
    .history-link-btn--primary { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
    .history-link-btn--primary:hover:not(:disabled) { background:#dbeafe; }
    .history-link-btn--dian { background:#ecfeff; border-color:#a5f3fc; color:#0f766e; }
    .history-link-btn--dian:hover:not(:disabled) { background:#cffafe; border-color:#67e8f9; }
    .tda-btn { min-width:76px; height:32px; border-radius:9px; background:#fff; border:1px solid #dce6f0; color:#374151; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:0 10px; transition:all .12s; font-size:11px; font-weight:700; }
    .tda-btn:hover { background:#f8fafc; border-color:#93c5fd; color:#1a407e; box-shadow:0 8px 18px rgba(26,64,126,.08); }
    .tda-btn.danger { border-color:#fecaca; color:#dc2626; background:#fff5f5; }
    .tda-btn.danger:hover { background:#fee2e2; border-color:#fca5a5; }
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
    .promo-preview-card {
      margin-top:8px; padding:10px 12px; border-radius:12px;
      background:linear-gradient(180deg,#eff6ff 0%, #f8fbff 100%);
      border:1px solid #bfdbfe; color:#1e3a8a; font-size:11.5px;
      display:grid; gap:4px;
    }

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
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:720; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:#fff; border-radius:18px; width:min(960px, 100%); max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 26px 70px rgba(15,23,42,.28); border:1px solid #dbe4ee; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px; border-bottom:1px solid #e5edf5; }
    .modal-header h3 { display:flex; align-items:center; gap:10px; font-size:18px; font-weight:800; color:#102a43; margin:0; }
    .modal-close { border:none; background:#f8fafc; color:#475569; width:34px; height:34px; border-radius:10px; cursor:pointer; display:grid; place-items:center; }
    .modal-close:hover { background:#eef2f7; }
    .modal-pdf { max-width:900px; height:90vh; }
    .pdf-iframe-wrap { flex:1; overflow:hidden; background:#e5e7eb; min-height:420px; }
    .pdf-iframe { width:100%; height:100%; border:none; }
    .pdf-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:16px; color:#94a3b8; }
    .pdf-spinner { width:40px; height:40px; border:4px solid #e2e8f0; border-top-color:#1a407e; border-radius:50%; animation:spin .8s linear infinite; }
    .modal-footer { display:flex; align-items:center; gap:10px; padding:14px 18px; border-top:1px solid #e5edf5; background:#fff; }
    .pdf-note { font-size:12px; color:#94a3b8; margin-right:auto; }
    .btn { border:none; border-radius:10px; padding:10px 14px; font-weight:700; cursor:pointer; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-secondary { background:#eef2f7; color:#334155; }
    .btn-open-session--secondary { background:#eef6ff; color:#1a407e; margin-bottom:10px; }
    .no-session-summary { margin:4px 0 14px; text-align:center; }
    .no-session-summary span { display:block; font-size:12px; color:#64748b; }
    .no-session-summary strong { display:block; font-size:13px; color:#0f172a; margin-top:4px; }
    .field-hint { display:block; font-size:11px; color:#64748b; margin-top:6px; }
    .session-alert { display:inline-flex; align-items:center; gap:6px; margin-top:4px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:700; width:max-content; }
    .session-alert--offline { background:#fee2e2; color:#b91c1c; }
    .session-alert--degraded { background:#fef3c7; color:#92400e; }
    .pos-config-chip { padding:10px 12px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; display:grid; gap:4px; margin-top:8px; }
    .pos-config-chip strong { font-size:12px; color:#1d4ed8; }
    .pos-config-chip span { font-size:12px; color:#334155; }
    .modal-operating-config { width:min(1120px, 100%); }
    .modal-body--config { display:grid; gap:18px; }
    .config-summary-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    .config-summary-card { padding:14px; border-radius:14px; background:#f8fbff; border:1px solid #dbe7f3; display:grid; gap:4px; }
    .config-summary-card span { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; font-weight:700; }
    .config-summary-card strong { font-size:17px; color:#0f172a; }
    .config-summary-card small { font-size:12px; color:#64748b; }
    .config-section { padding:16px; border-radius:18px; background:#fff; border:1px solid #e2e8f0; box-shadow:0 10px 22px rgba(15,23,42,.04); }
    .config-section__header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
    .config-section__header h4 { margin:0 0 4px; font-size:16px; color:#0f172a; }
    .config-section__header p { margin:0; font-size:12.5px; color:#64748b; }
    .config-card-list { display:grid; gap:10px; }
    .config-card-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:14px; background:#f8fafc; border:1px solid #e2e8f0; }
    .config-card-item strong { display:block; font-size:13px; color:#0f172a; }
    .config-card-item small { display:block; margin-top:4px; font-size:12px; color:#64748b; }
    .config-actions-inline { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .config-empty { padding:14px; border:1px dashed #cbd5e1; border-radius:14px; color:#64748b; background:#f8fafc; font-size:13px; }
    .config-inline-form { padding:16px; border-radius:18px; background:#f8fbff; border:1px solid #dbe7f3; display:grid; gap:14px; }
    .config-inline-form h4 { margin:0; font-size:15px; color:#0f172a; }
    .config-form-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
    .config-form-grid .field-group { margin:0; }
    .config-form-grid .field-group span { display:block; font-size:12px; color:#475569; margin-bottom:6px; font-weight:600; }
    .config-switches { display:flex; flex-wrap:wrap; gap:14px; font-size:12.5px; color:#334155; }
    .modal-footer--inline { padding:0; border-top:none; background:transparent; justify-content:flex-end; }
    .denomination-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; margin-top:10px; }
    .denomination-item { display:grid; gap:6px; font-size:12px; color:#334155; }
    .denomination-item span { font-weight:700; }
    .history-badge { display:inline-flex; align-items:center; justify-content:center; min-width:72px; padding:6px 10px; border-radius:999px; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; font-size:11px; font-weight:700; }
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
      .pos-dw-date-grid { grid-template-columns:1fr; }
      .pos-drawer-footer { grid-template-columns:1fr; }
      .config-summary-grid, .config-form-grid { grid-template-columns:1fr; }
      .denomination-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
      .config-section__header, .config-card-item { flex-direction:column; align-items:stretch; }
    }
  `],
})
export class PosComponent implements OnInit, OnDestroy {
  private pos = inject(PosApiService);
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private dialog = inject(ConfirmDialogService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private customerSearch$ = new Subject<string>();

  @ViewChild('posRoot') posRootRef?: ElementRef<HTMLDivElement>;
  @ViewChild('productSearchInput') productSearchInputRef?: ElementRef<HTMLInputElement>;

  activeSession    = signal<PosSession | null>(null);
  loadingSession   = signal(true);
  processing       = signal(false);
  showHistory      = signal(false);
  showOpenSessionModal  = signal(false);
  showCloseSessionModal = signal(false);
  showCashMovementModal = signal(false);
  showOperatingConfigModal = signal(false);
  showTerminalForm = signal(false);
  showShiftForm = signal(false);
  showLoyaltyCampaignForm = signal(false);
  showInventoryLocationForm = signal(false);
  showInventoryStockForm = signal(false);
  showInventoryTransferForm = signal(false);
  showPaymentModal      = signal(false);
  completedSale         = signal<PosSale | null>(null);
  operatingConfig = signal<PosOperatingConfig | null>(null);
  terminals = signal<PosTerminal[]>([]);
  shiftTemplates = signal<PosShiftTemplate[]>([]);
  loyaltyCampaigns = signal<PosLoyaltyCampaign[]>([]);
  coupons = signal<PosCoupon[]>([]);
  externalOrders = signal<PosExternalOrder[]>([]);
  customerAccountStatement = signal<PosCustomerAccountStatement | null>(null);
  inventoryLocations = signal<PosInventoryLocation[]>([]);
  inventoryStocks = signal<PosInventoryStock[]>([]);
  inventoryTransfers = signal<PosInventoryTransfer[]>([]);
  customerLoyaltyProfile = signal<PosCustomerLoyaltyProfile | null>(null);
  savingOperatingConfig = signal(false);
  loadingCashMovements = signal(false);
  cashMovements = signal<any[]>([]);
  recentManagedSessions = signal<PosSession[]>([]);
  governanceRules = signal<PosGovernanceRule[]>([]);
  pendingGovernanceOverrides = signal<PosSupervisorOverride[]>([]);
  recentGovernanceOverrides = signal<PosSupervisorOverride[]>([]);
  governanceAudit = signal<PosAuditEntry[]>([]);
  salesAnalytics = signal<PosSalesAnalytics | null>(null);
  loadingSalesAnalytics = signal(false);
  integrationSummary = signal<PosIntegrationSummary | null>(null);
  loadingIntegrationSummary = signal(false);
  syncingAccountingIntegrations = signal(false);
  multiBranchOverview = signal<PosMultiBranchOverview | null>(null);
  loadingMultiBranchOverview = signal(false);
  operationalIncidents = signal<PosOperationalIncident[]>([]);
  configDeployments = signal<PosConfigDeployment[]>([]);
  offlineMode = signal(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  pendingOfflineQueue = signal<QueuedPosSalePayload[]>([]);
  syncingOfflineQueue = signal(false);
  savingGovernanceRuleAction = signal<PosGovernanceAction | null>(null);
  approvingOverrideId: string | null = null;
  rejectingOverrideId: string | null = null;

  openSessionCash  = 0;
  openSessionNotes = '';
  openSessionTerminalId = '';
  openSessionShiftId = '';
  closeSessionCash = 0;
  closeSessionNotes = '';
  cashMovementType: 'IN' | 'OUT' = 'OUT';
  cashMovementAmount = 0;
  cashMovementReason = '';
  editingTerminalId: string | null = null;
  editingShiftId: string | null = null;
  editingLoyaltyCampaignId: string | null = null;
  editingInventoryLocationId: string | null = null;
  postingTransferId: string | null = null;
  reopenNotes = '';
  reopeningSessionId: string | null = null;
  approvingSessionId: string | null = null;
  analyticsFrom = '';
  analyticsTo = '';
  closeDenominationCounts: Record<string, number> = {
    '100000': 0,
    '50000': 0,
    '20000': 0,
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
  };

  // Tiempo de sesión transcurrido
  sessionElapsedSignal = signal('');
  private sessionTimerInterval: any;
  private heartbeatInterval: any;
  private readonly offlineQueueStorageKey = 'beccafact_pos_offline_queue';
  private readonly recoverySnapshotStorageKey = 'beccafact_pos_recovery_snapshot';

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
  selectedPaymentMethod = signal<PosPaymentMethod>('CASH');
  selectedOrderType = signal<'IN_STORE' | 'PICKUP' | 'DELIVERY' | 'LAYAWAY' | 'PREORDER'>('IN_STORE');
  scheduledAt = '';
  orderReference = '';
  deliveryAddress = '';
  deliveryContactName = '';
  deliveryContactPhone = '';
  sourceChannel = 'POS';
  externalOrderId = '';
  couponCode = '';
  loyaltyPointsToRedeem = 0;
  paymentLines = signal<EditablePaymentLine[]>([]);
  generateInvoice    = signal(false);
  isAdvancePayment   = signal(false);
  cartDiscountPct    = signal(0);

  // Advance payment modals
  showAddPaymentModal  = signal(false);
  showDeliverModal     = signal(false);
  showDispatchModal    = signal(false);
  selectedAdvanceSale  = signal<PosSale | null>(null);
  addPaymentAmount     = 0;
  addPaymentMethod: PosPaymentMethod = 'CASH';
  addPaymentLines: EditablePaymentLine[] = [];
  addPaymentNotes      = '';
  deliverNotes         = '';
  deliverGenerateInv   = false;
  dispatchNotes        = '';
  processingAdvance    = signal(false);
  sendingDian: Record<string, boolean> = {};
  queryingDian: Record<string, boolean> = {};
  showInvoiceModal     = signal(false);
  selectedInvoiceSale  = signal<PosSale | null>(null);
  selectedInvoiceDetail = signal<PosInvoiceDetail | null>(null);
  loadingInvoiceDetail = signal(false);
  showInvoicePdfModal = signal(false);
  invoicePdfUrl = signal<SafeResourceUrl | null>(null);
  invoicePdfObjectUrl: string | null = null;
  loadingInvoicePdfPreview = signal(false);
  downloadingInvoicePdf = signal(false);
  downloadingInvoiceZip = signal(false);
  isFullscreen = signal(false);

  sessionSales   = signal<PosSale[]>([]);
  loadingHistory = signal(false);
  sessionSummary = signal<any>(null);
  postSaleRequests = signal<PosPostSaleRequest[]>([]);
  loadingPostSaleRequests = signal(false);
  showPostSaleModal = signal(false);
  submittingPostSale = signal(false);
  selectedPostSaleSale = signal<PosSale | null>(null);
  postSaleType = signal<'RETURN' | 'EXCHANGE'>('RETURN');
  postSaleReasonCode =
    signal<'DEFECTIVE_PRODUCT' | 'WRONG_PRODUCT' | 'CUSTOMER_DISSATISFACTION' | 'BILLING_ERROR' | 'WARRANTY' | 'OTHER'>('DEFECTIVE_PRODUCT');
  postSaleReasonDetail = '';
  postSaleLines = signal<PosPostSaleFormLine[]>([]);
  postSaleReplacementLines = signal<PosPostSaleReplacementLine[]>([]);
  resolvingPostSaleId: string | null = null;

  // Free item form
  showFreeItemForm = signal(false);
  freeItemName  = '';
  freeItemPrice = 0;
  freeItemTax   = 19;

  // SKU / barcode search
  skuSearch = '';

  terminalForm = this.emptyTerminalForm();
  shiftForm = this.emptyShiftForm();
  loyaltyCampaignForm = this.emptyLoyaltyCampaignForm();
  selectedPriceListId = signal<string>('');
  selectedInventoryLocationId = signal<string>('');
  inventoryLocationForm = this.emptyInventoryLocationForm();
  inventoryStockForm = this.emptyInventoryStockForm();
  inventoryTransferForm = this.emptyInventoryTransferForm();
  priceLists = signal<PosPriceList[]>([]);
  promotions = signal<PosPromotion[]>([]);
  combos = signal<PosCombo[]>([]);
  pricingPreview = signal<PosPricingPreview | null>(null);
  loadingPricingPreview = signal(false);
  readonly governanceRoles = ['ADMIN', 'MANAGER', 'OPERATOR', 'CAJERO'];

  // Two-way binding proxy for cartDiscountPct signal
  get discountPctProxy(): number { return this.cartDiscountPct(); }
  set discountPctProxy(v: number) {
    this.cartDiscountPct.set(Math.min(100, Math.max(0, Number(v) || 0)));
    this.refreshPricingPreview();
  }

  paymentMethods = [
    { value: 'CASH'     as const, label: 'Efectivo',      emoji: '💵' },
    { value: 'CARD'     as const, label: 'Tarjeta',       emoji: '💳' },
    { value: 'TRANSFER' as const, label: 'Transf.',       emoji: '🏦' },
    { value: 'DATAPHONE' as const, label: 'Datáfono',     emoji: '🧾' },
    { value: 'WALLET'   as const, label: 'Billetera',     emoji: '📲' },
    { value: 'VOUCHER'  as const, label: 'Vale',          emoji: '🎟️' },
    { value: 'GIFT_CARD' as const, label: 'Gift card',    emoji: '🎁' },
    { value: 'AGREEMENT' as const, label: 'Convenio',     emoji: '🤝' },
    { value: 'MIXED'    as const, label: 'Mixto',         emoji: '🔀' },
  ];

  cartSubtotal = computed(() => this.cart().reduce((s, i) => s + i.subtotal, 0));
  cartTax      = computed(() => this.cart().reduce((s, i) => s + i.taxAmount, 0));
  cartCount    = computed(() => this.cart().reduce((s, i) => s + i.quantity, 0));
  availableProductsCount = computed(() => this.products().filter(p => Number(p.availableStock ?? p.stock) > 0).length);
  lowStockProductsCount = computed(() => this.products().filter(p => {
    const available = Number(p.availableStock ?? p.stock);
    return available > 0 && available <= (p.minStock ?? 10);
  }).length);
  activeTerminalsCount = computed(() => this.terminals().filter((terminal) => terminal.isActive).length);
  sessionAverageTicket = computed(() => {
    const session = this.activeSession();
    if (!session || !session.totalTransactions) return 0;
    return Number(session.totalSales) / Number(session.totalTransactions);
  });
  openOperationalIncidentsCount = computed(
    () => this.operationalIncidents().filter((item) => item.status !== 'RESOLVED').length,
  );
  cartTotal    = computed(() => {
    if (this.pricingPreview()) return Number(this.pricingPreview()!.total);
    const raw  = this.cart().reduce((s, i) => s + i.total, 0);
    const disc = this.cartDiscountPct();
    if (disc <= 0) return raw;
    return Math.round(raw * (1 - disc / 100) * 100) / 100;
  });
  cartDiscountAmount = computed(() => {
    if (this.pricingPreview()) {
      const preview = this.pricingPreview()!;
      return Number(preview.orderPromotionDiscount) + Number(preview.comboDiscount) + Number(preview.manualDiscountAmount);
    }
    const raw = this.cart().reduce((s, i) => s + i.total, 0);
    return Math.round(raw * (this.cartDiscountPct() / 100) * 100) / 100;
  });
  paymentTotal = computed(() =>
    this.paymentLines().reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );
  cashPaymentTotal = computed(() =>
    this.paymentLines()
      .filter((line) => line.paymentMethod === 'CASH')
      .reduce((sum, line) => sum + Number(line.amount || 0), 0),
  );
  changeAmount = computed(() => Math.max(0, this.paymentTotal() - this.cartTotal()));
  sessionTotal = computed(() =>
    this.sessionSales().filter(s => s.status === 'COMPLETED').reduce((acc, s) => acc + Number(s.total), 0),
  );
  isPaymentValid = computed(() => {
    if (this.cart().length === 0) return false;
    const totalPaid = this.paymentTotal();
    const total = this.cartTotal();
    if (this.isAdvancePayment()) return totalPaid > 0 && totalPaid < total;
    if (this.cashPaymentTotal() > 0) return totalPaid >= total;
    return Math.abs(totalPaid - total) <= 0.01;
  });

  // Efectivo esperado al cierre: inicial + ventas en efectivo
  expectedCash = computed(() => {
    return Number(this.sessionSummary()?.expectedCash ?? 0);
  });

  // Diferencia entre efectivo real ingresado y esperado (positivo = sobra, negativo = falta)
  countedCashByDenominations = computed(() =>
    Object.entries(this.closeDenominationCounts).reduce((sum, [value, qty]) => sum + Number(value) * Number(qty || 0), 0),
  );
  closeCashResolved = computed(() => this.countedCashByDenominations() > 0 ? this.countedCashByDenominations() : this.closeSessionCash);
  cashDiff = computed(() => this.closeCashResolved() - this.expectedCash());
  selectedOpenTerminal = computed(() => this.terminals().find(item => item.id === this.openSessionTerminalId) ?? null);

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

  canSupervise = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('ADMIN') || roles.includes('MANAGER');
  });

  private hasAnyRole(roles: string[]) {
    const current = this.auth.user()?.roles ?? [];
    return roles.some((role) => current.includes(role));
  }

  private findGovernanceRule(action: PosGovernanceAction) {
    return this.governanceRules().find((rule) => rule.action === action) ?? null;
  }

  private shouldRequestOverride(action: PosGovernanceAction, options?: { discountPct?: number; amount?: number }) {
    if (this.canSupervise()) return false;
    const rule = this.findGovernanceRule(action);
    if (!rule || !rule.isActive) return false;

    const allowedRoles = rule.allowedRoles ?? [];
    const roleAllowed = allowedRoles.length === 0 || this.hasAnyRole(allowedRoles);
    const discountExceeded =
      rule.maxDiscountPct != null &&
      Number(options?.discountPct ?? 0) > Number(rule.maxDiscountPct);
    const amountExceeded =
      rule.maxAmountThreshold != null &&
      Number(rule.maxAmountThreshold) > 0 &&
      Number(options?.amount ?? 0) > Number(rule.maxAmountThreshold);

    return rule.requiresSupervisorOverride || !roleAllowed || discountExceeded || amountExceeded;
  }

  toNullableNumber(value: unknown): number | null {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private findApprovedOverride(action: PosGovernanceAction, resourceType: string, resourceId?: string) {
    return this.recentGovernanceOverrides().find((override) =>
      override.action === action &&
      override.resourceType === resourceType &&
      (resourceId ? override.resourceId === resourceId : true) &&
      override.status === 'APPROVED',
    );
  }

  getGovernanceActionLabel(action: PosGovernanceAction) {
    switch (action) {
      case 'MANUAL_DISCOUNT': return 'Descuento manual';
      case 'CASH_WITHDRAWAL': return 'Retiro parcial';
      case 'CANCEL_SALE': return 'Cancelar venta';
      case 'REFUND_SALE': return 'Reembolso';
      case 'REOPEN_SESSION': return 'Reabrir caja';
      case 'APPROVE_POST_SALE': return 'Aprobar postventa';
      default: return action;
    }
  }

  getPaymentMethodLabel(method: string) {
    const labels: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      MIXED: 'Mixto',
      DATAPHONE: 'Datáfono',
      WALLET: 'Billetera',
      VOUCHER: 'Vale',
      GIFT_CARD: 'Gift card',
      AGREEMENT: 'Convenio',
    };
    return labels[method] ?? method;
  }

  formatHourLabel(hour: number) {
    return `${String(hour).padStart(2, '0')}:00`;
  }

  hasHourlyActivity = (item: { transactions: number; sales: number }) =>
    Number(item.transactions) > 0 || Number(item.sales) > 0;

  getActiveHours(items: Array<{ hour: number; transactions: number; sales: number; avgTicket: number }>) {
    return items.filter(this.hasHourlyActivity);
  }

  private requiresOverrideMessage(message?: string) {
    const normalized = String(message ?? '').toLowerCase();
    return normalized.includes('override') || normalized.includes('supervisor');
  }

  private productSearchTimer: any;
  private createClientSyncId() {
    const generator = (globalThis.crypto as Crypto | undefined)?.randomUUID;
    if (typeof generator === 'function') return generator.call(globalThis.crypto);
    return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private persistOfflineQueue() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.offlineQueueStorageKey, JSON.stringify(this.pendingOfflineQueue()));
  }

  private loadOfflineQueue() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.offlineQueueStorageKey);
      this.pendingOfflineQueue.set(raw ? JSON.parse(raw) : []);
    } catch {
      this.pendingOfflineQueue.set([]);
    }
  }

  private persistRecoverySnapshot() {
    if (typeof localStorage === 'undefined') return;
    const snapshot = {
      cart: this.cart(),
      customer: this.selectedCustomer(),
      orderType: this.selectedOrderType(),
      generateInvoice: this.generateInvoice(),
      isAdvancePayment: this.isAdvancePayment(),
      selectedPriceListId: this.selectedPriceListId(),
      selectedInventoryLocationId: this.selectedInventoryLocationId(),
      sourceChannel: this.sourceChannel,
      externalOrderId: this.externalOrderId,
      couponCode: this.couponCode,
      loyaltyPointsToRedeem: this.loyaltyPointsToRedeem,
    };
    localStorage.setItem(this.recoverySnapshotStorageKey, JSON.stringify(snapshot));
  }

  private restoreRecoverySnapshot() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.recoverySnapshotStorageKey);
      if (!raw || this.cart().length > 0) return;
      const snapshot = JSON.parse(raw);
      if (Array.isArray(snapshot?.cart) && snapshot.cart.length > 0) {
        this.cart.set(snapshot.cart);
      }
      if (snapshot?.customer) this.selectedCustomer.set(snapshot.customer);
      if (snapshot?.orderType) this.selectedOrderType.set(snapshot.orderType);
      this.generateInvoice.set(!!snapshot?.generateInvoice);
      this.isAdvancePayment.set(!!snapshot?.isAdvancePayment);
      if (snapshot?.selectedPriceListId) this.selectedPriceListId.set(snapshot.selectedPriceListId);
      if (snapshot?.selectedInventoryLocationId) this.selectedInventoryLocationId.set(snapshot.selectedInventoryLocationId);
      this.sourceChannel = snapshot?.sourceChannel || 'POS';
      this.externalOrderId = snapshot?.externalOrderId || '';
      this.couponCode = snapshot?.couponCode || '';
      this.loyaltyPointsToRedeem = Number(snapshot?.loyaltyPointsToRedeem || 0);
      if (snapshot?.customer?.id) {
        this.pos.getCustomerAccountStatement(snapshot.customer.id).subscribe({
          next: (statement) => this.customerAccountStatement.set(statement),
          error: () => void 0,
        });
      }
    } catch {
      void 0;
    }
  }

  private queueOfflineSale(payload: any) {
    const queued = [...this.pendingOfflineQueue(), {
      clientSyncId: payload.clientSyncId,
      createdAt: new Date().toISOString(),
      payload,
    }];
    this.pendingOfflineQueue.set(queued);
    this.persistOfflineQueue();
    this.persistRecoverySnapshot();
  }

  constructor() {
    // Foco automático en el campo de búsqueda cuando la sesión esté activa
    afterNextRender(() => {
      if (this.activeSession()) {
        this.productSearchInputRef?.nativeElement?.focus();
      }
    });
  }

  ngOnInit() {
    this.loadOfflineQueue();
    this.loadActiveSession();
    this.loadOperatingConfig();
    this.loadProducts();
    this.restoreRecoverySnapshot();
    this.initCustomerSearch();
    // Timer para actualizar el tiempo de sesión cada minuto
    this.sessionTimerInterval = setInterval(() => {
      this.sessionElapsedSignal.set(Date.now().toString());
      this.cdr.markForCheck();
    }, 60_000);
  }

  @HostListener('window:online')
  onBrowserOnline() {
    this.offlineMode.set(false);
    this.syncOfflineQueue();
    this.cdr.markForCheck();
  }

  @HostListener('window:offline')
  onBrowserOffline() {
    this.offlineMode.set(true);
    this.cdr.markForCheck();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    const active = document.fullscreenElement === this.posRootRef?.nativeElement;
    this.isFullscreen.set(active);
    this.cdr.markForCheck();
  }

  async toggleFullscreen() {
    const root = this.posRootRef?.nativeElement;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement && document.fullscreenElement !== root) {
        await document.exitFullscreen();
      }
      await root.requestFullscreen();
    } catch {
      this.notify.error('No fue posible cambiar al modo de pantalla completa');
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.persistRecoverySnapshot();
    clearInterval(this.sessionTimerInterval);
    clearInterval(this.heartbeatInterval);
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
  selectCustomer(c: Customer) {
    this.selectedCustomer.set(c);
    this.customerSearchTerm = '';
    this.customerResults.set([]);
    this.showCustomerDropdown.set(false);
    this.customerLoyaltyProfile.set(null);
    this.customerAccountStatement.set(null);
    this.pos.getCustomerLoyaltyProfile(c.id).subscribe({
      next: (profile) => { this.customerLoyaltyProfile.set(profile); this.cdr.markForCheck(); },
      error: () => this.customerLoyaltyProfile.set(null),
    });
    this.pos.getCustomerAccountStatement(c.id).subscribe({
      next: (statement) => {
        this.customerAccountStatement.set(statement);
        this.cdr.markForCheck();
      },
      error: () => this.customerAccountStatement.set(null),
    });
    this.persistRecoverySnapshot();
    this.refreshPricingPreview();
  }
  clearCustomerSearch() { this.customerSearchTerm = ''; this.customerResults.set([]); this.showCustomerDropdown.set(false); }
  clearSelectedCustomer() {
    this.selectedCustomer.set(null);
    this.customerLoyaltyProfile.set(null);
    this.customerAccountStatement.set(null);
    this.generateInvoice.set(false);
    this.customerSearchTerm = '';
    this.couponCode = '';
    this.loyaltyPointsToRedeem = 0;
    this.persistRecoverySnapshot();
    this.refreshPricingPreview();
  }
  setOrderType(type: 'IN_STORE' | 'PICKUP' | 'DELIVERY' | 'LAYAWAY' | 'PREORDER') {
    this.selectedOrderType.set(type);
    if (type === 'LAYAWAY') {
      this.isAdvancePayment.set(true);
    } else if (type === 'IN_STORE') {
      this.isAdvancePayment.set(false);
    }
  }
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
      next: s => {
        this.activeSession.set(s);
        this.loadingSession.set(false);
        this.restartHeartbeatLoop();
        if (!this.offlineMode() && this.pendingOfflineQueue().length > 0) {
          this.syncOfflineQueue();
        }
      },
      error: () => {
        this.activeSession.set(null);
        this.loadingSession.set(false);
        clearInterval(this.heartbeatInterval);
      },
    });
  }

  loadOperatingConfig() {
    this.pos.getOperatingConfig().subscribe({
      next: (config) => {
        this.operatingConfig.set(config);
        this.terminals.set(config.terminals ?? []);
        this.shiftTemplates.set(config.shifts ?? []);
        this.priceLists.set(config.priceLists ?? []);
        this.promotions.set(config.promotions ?? []);
        this.combos.set(config.combos ?? []);
        this.loyaltyCampaigns.set(config.loyaltyCampaigns ?? []);
        this.coupons.set(config.coupons ?? []);
        this.externalOrders.set(config.externalOrders ?? []);
        this.inventoryLocations.set(config.inventoryLocations ?? []);
        this.inventoryTransfers.set(config.inventoryTransfers ?? []);
        this.governanceRules.set(config.governance?.rules ?? []);
        this.pendingGovernanceOverrides.set(config.governance?.pendingOverrides ?? []);
        this.recentGovernanceOverrides.set(config.governance?.recentOverrides ?? []);
        this.governanceAudit.set(config.governance?.recentAudit ?? []);
        if (!this.openSessionTerminalId) this.openSessionTerminalId = config.defaults?.terminalId ?? '';
        if (!this.openSessionShiftId) this.openSessionShiftId = config.defaults?.shiftTemplateId ?? '';
        if (!this.selectedPriceListId()) this.selectedPriceListId.set(config.defaults?.priceListId ?? '');
        if (!this.selectedInventoryLocationId()) this.selectedInventoryLocationId.set(config.defaults?.inventoryLocationId ?? '');
        this.refreshPricingPreview();
        this.loadInventoryStocks();
        this.cdr.markForCheck();
      },
      error: () => {
        this.operatingConfig.set(null);
        this.terminals.set([]);
        this.shiftTemplates.set([]);
        this.priceLists.set([]);
        this.promotions.set([]);
        this.combos.set([]);
        this.loyaltyCampaigns.set([]);
        this.coupons.set([]);
        this.externalOrders.set([]);
        this.inventoryLocations.set([]);
        this.inventoryTransfers.set([]);
        this.inventoryStocks.set([]);
        this.governanceRules.set([]);
        this.pendingGovernanceOverrides.set([]);
        this.recentGovernanceOverrides.set([]);
        this.governanceAudit.set([]);
      },
    });
  }

  loadRecentManagedSessions() {
    this.pos.getSessions({ limit: 8 }).subscribe({
      next: (res) => {
        this.recentManagedSessions.set((res.data ?? []).filter((session) => session.status !== 'OPEN'));
        this.cdr.markForCheck();
      },
      error: () => this.recentManagedSessions.set([]),
    });
  }

  loadPostSaleRequests() {
    this.loadingPostSaleRequests.set(true);
    this.pos.getPostSaleRequests({ status: 'PENDING_APPROVAL' }).subscribe({
      next: (requests) => {
        this.postSaleRequests.set(requests ?? []);
        this.loadingPostSaleRequests.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.postSaleRequests.set([]);
        this.loadingPostSaleRequests.set(false);
      },
    });
  }

  loadSalesAnalytics() {
    if (!this.canSupervise()) {
      this.salesAnalytics.set(null);
      return;
    }
    this.loadingSalesAnalytics.set(true);
    this.pos.getSalesAnalytics(this.analyticsFrom || undefined, this.analyticsTo || undefined).subscribe({
      next: (analytics) => {
        this.salesAnalytics.set(analytics);
        this.loadingSalesAnalytics.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.salesAnalytics.set(null);
        this.loadingSalesAnalytics.set(false);
        this.notify.error('No fue posible cargar la analítica empresarial del POS');
      },
    });
  }

  loadIntegrationSummary() {
    if (!this.canSupervise()) {
      this.integrationSummary.set(null);
      return;
    }
    this.loadingIntegrationSummary.set(true);
    this.pos.getIntegrationsSummary().subscribe({
      next: (summary) => {
        this.integrationSummary.set(summary);
        this.loadingIntegrationSummary.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.integrationSummary.set(null);
        this.loadingIntegrationSummary.set(false);
        this.notify.error('No fue posible cargar el resumen de integraciones del POS');
      },
    });
  }

  loadMultiBranchOverview() {
    if (!this.canSupervise()) {
      this.multiBranchOverview.set(null);
      return;
    }
    this.loadingMultiBranchOverview.set(true);
    this.pos.getMultiBranchOverview().subscribe({
      next: (overview) => {
        this.multiBranchOverview.set(overview);
        this.loadingMultiBranchOverview.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.multiBranchOverview.set(null);
        this.loadingMultiBranchOverview.set(false);
        this.notify.error('No fue posible cargar la operación multi-sucursal del POS');
      },
    });
  }

  loadOperationalIncidents() {
    if (!this.canSupervise()) {
      this.operationalIncidents.set([]);
      return;
    }
    this.pos.getOperationalIncidents().subscribe({
      next: (incidents) => {
        this.operationalIncidents.set(incidents ?? []);
        this.cdr.markForCheck();
      },
      error: () => this.operationalIncidents.set([]),
    });
  }

  loadConfigDeployments() {
    if (!this.canSupervise()) {
      this.configDeployments.set([]);
      return;
    }
    this.pos.getConfigDeployments().subscribe({
      next: (deployments) => {
        this.configDeployments.set(deployments ?? []);
        this.cdr.markForCheck();
      },
      error: () => this.configDeployments.set([]),
    });
  }

  private currentHeartbeatView() {
    if (this.showHistory()) return 'history';
    if (this.showOperatingConfigModal()) return 'operating-config';
    if (this.showPaymentModal()) return 'checkout';
    return 'sales';
  }

  private sendTerminalHeartbeat() {
    const session = this.activeSession();
    const terminalId = session?.terminal?.id;
    if (!session || !terminalId) return;
    this.pos.sendTerminalHeartbeat(terminalId, {
      sessionId: session.id,
      cartCount: this.cartCount(),
      pendingOrders: this.sessionSales().filter((sale) =>
        ['PICKUP', 'DELIVERY', 'LAYAWAY', 'PREORDER'].includes(String(sale.orderType)) &&
        !['CLOSED', 'CANCELLED'].includes(String(sale.orderStatus)),
      ).length,
      pendingSyncCount: this.pendingOfflineQueue().length,
      currentView: this.currentHeartbeatView(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      recoverySnapshot: {
        cart: this.cart().map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        customerId: this.selectedCustomer()?.id ?? null,
        orderType: this.selectedOrderType(),
        priceListId: this.selectedPriceListId() || null,
        inventoryLocationId: this.selectedInventoryLocationId() || null,
        generateInvoice: this.generateInvoice(),
        isAdvancePayment: this.isAdvancePayment(),
        pendingOfflineQueue: this.pendingOfflineQueue().length,
      },
    }).subscribe({
      next: (result) => {
        this.activeSession.update((current) =>
          current && current.id === session.id
            ? {
                ...current,
                lastHeartbeatAt: result.session?.lastHeartbeatAt ?? current.lastHeartbeatAt,
                offlineSinceAt: result.session?.offlineSinceAt ?? current.offlineSinceAt,
                offlineQueueDepth: result.session?.offlineQueueDepth ?? current.offlineQueueDepth,
                terminal: current.terminal
                  ? {
                      ...current.terminal,
                      lastHeartbeatAt: result.terminal?.lastHeartbeatAt ?? current.terminal.lastHeartbeatAt,
                    }
                  : current.terminal,
              }
            : current,
        );
        this.cdr.markForCheck();
      },
      error: () => void 0,
    });
  }

  private restartHeartbeatLoop() {
    clearInterval(this.heartbeatInterval);
    const session = this.activeSession();
    if (!session?.terminal?.id) return;
    this.sendTerminalHeartbeat();
    this.heartbeatInterval = setInterval(() => this.sendTerminalHeartbeat(), 60_000);
  }

  syncAccountingIntegrations() {
    if (!this.canSupervise()) return;
    this.syncingAccountingIntegrations.set(true);
    this.pos.syncAccountingIntegrations().subscribe({
      next: (result) => {
        this.syncingAccountingIntegrations.set(false);
        const total =
          Number(result?.sales?.length ?? 0) +
          Number(result?.refunds?.length ?? 0) +
          Number(result?.cashMovements?.length ?? 0);
        this.notify.success(total > 0 ? `Integraciones POS sincronizadas: ${total}` : 'No había integraciones POS pendientes');
        this.loadIntegrationSummary();
      },
      error: (err: any) => {
        this.syncingAccountingIntegrations.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible resincronizar la contabilidad del POS');
      },
    });
  }

  syncOfflineQueue() {
    if (this.offlineMode() || this.pendingOfflineQueue().length === 0 || this.syncingOfflineQueue()) return;
    this.syncingOfflineQueue.set(true);

    const queue = [...this.pendingOfflineQueue()];
    const processNext = () => {
      const next = queue[0];
      if (!next) {
        this.syncingOfflineQueue.set(false);
        this.persistOfflineQueue();
        this.loadSessionSales();
        this.loadIntegrationSummary();
        this.loadMultiBranchOverview();
        this.notify.success('Cola offline POS sincronizada');
        return;
      }

      this.pos.createSale(next.payload).subscribe({
        next: () => {
          queue.shift();
          this.pendingOfflineQueue.set(queue);
          this.persistOfflineQueue();
          processNext();
        },
        error: (err: any) => {
          this.syncingOfflineQueue.set(false);
          if (err?.status === 0) this.offlineMode.set(true);
          this.notify.error(err?.error?.message ?? 'No fue posible sincronizar la cola offline del POS');
        },
      });
    };

    processNext();
  }

  async resolveOperationalIncident(incident: PosOperationalIncident) {
    const notes = await this.dialog.prompt({
      title: 'Resolver incidente operativo',
      message: `Confirma la resolución de "${incident.title}".`,
      inputLabel: 'Notas',
      inputType: 'textarea',
      placeholder: 'Describe la recuperación aplicada',
      confirmLabel: 'Resolver',
      allowEmpty: true,
    });
    if (notes === null) return;
    this.pos.resolveOperationalIncident(incident.id, { notes: notes || undefined }).subscribe({
      next: () => {
        this.notify.success('Incidente operativo resuelto');
        this.loadOperationalIncidents();
        this.loadMultiBranchOverview();
      },
      error: (err: any) => {
        this.notify.error(err?.error?.message ?? 'No fue posible resolver el incidente');
      },
    });
  }

  async publishPosConfiguration() {
    const versionLabel = await this.dialog.prompt({
      title: 'Publicar configuración POS',
      message: 'Crea un despliegue centralizado de la configuración operativa actual.',
      inputLabel: 'Versión',
      placeholder: 'Ej. POS-2026-04-08-Noche',
      confirmLabel: 'Publicar',
      allowEmpty: true,
    });
    if (versionLabel === null) return;

    this.pos.createConfigDeployment({
      deploymentType: 'OPERATING_CONFIG',
      scope: 'COMPANY',
      versionLabel: versionLabel || undefined,
    }).subscribe({
      next: () => {
        this.notify.success('Configuración POS publicada para despliegue multi-sucursal');
        this.loadConfigDeployments();
        this.loadMultiBranchOverview();
      },
      error: (err: any) => {
        this.notify.error(err?.error?.message ?? 'No fue posible publicar la configuración POS');
      },
    });
  }

  createReplenishmentRequest() {
    if (!this.canSupervise()) return;
    this.pos.createReplenishmentRequest({}).subscribe({
      next: (request: any) => {
        this.notify.success(`Solicitud de compra ${request?.number ?? ''} creada desde POS`);
        this.loadIntegrationSummary();
      },
      error: (err: any) => {
        this.notify.error(err?.error?.message ?? 'No fue posible generar la solicitud de reabastecimiento');
      },
    });
  }

  reconcileElectronicPayments() {
    if (!this.canSupervise()) return;
    this.pos.reconcileElectronicPayments({ limit: 200 }).subscribe({
      next: (result: any) => {
        const reconciled = Number(result?.batch?.reconciledPayments ?? 0);
        this.notify.success(`Conciliación POS ejecutada. Referencias conciliadas: ${reconciled}`);
        this.loadIntegrationSummary();
      },
      error: (err: any) => {
        this.notify.error(err?.error?.message ?? 'No fue posible conciliar los pagos electrónicos del POS');
      },
    });
  }

  openSession() {
    this.processing.set(true);
    this.pos.openSession({
      initialCash: this.openSessionCash,
      terminalId: this.openSessionTerminalId || undefined,
      shiftTemplateId: this.openSessionShiftId || undefined,
      notes: this.openSessionNotes || undefined,
    }).subscribe({
      next: s => {
        this.activeSession.set(s);
        this.showOpenSessionModal.set(false);
        this.processing.set(false);
        this.notify.success('Caja abierta exitosamente');
        this.openSessionCash = 0;
        this.openSessionNotes = '';
        this.restartHeartbeatLoop();
      },
      error: (err: any) => { this.processing.set(false); this.notify.error(err?.error?.message ?? 'Error al abrir la caja'); },
    });
  }

  closeSession() {
    const s = this.activeSession(); if (!s) return;
    this.processing.set(true);
    this.pos.closeSession(s.id, {
      finalCash: this.closeCashResolved(),
      notes: this.closeSessionNotes || undefined,
      denominations: this.countedCashByDenominations() > 0 ? this.closeDenominationCounts : undefined,
    }).subscribe({
      next: (result) => {
        this.activeSession.set(null);
        this.cart.set([]);
        this.showCloseSessionModal.set(false);
        this.processing.set(false);
        this.resetCloseCashForm();
        clearInterval(this.heartbeatInterval);
        this.loadRecentManagedSessions();
        if (result.requiresApproval || result.status === 'PENDING_CLOSE_APPROVAL') {
          this.notify.warning('Cierre enviado a supervisión por diferencia de caja o política de turno');
        } else {
          this.notify.success('Caja cerrada exitosamente');
        }
      },
      error: (err: any) => { this.processing.set(false); this.notify.error(err?.error?.message ?? 'Error al cerrar la caja'); },
    });
  }

  private resetCloseCashForm() {
    this.closeSessionCash = 0;
    this.closeSessionNotes = '';
    this.closeDenominationCounts = {
      '100000': 0,
      '50000': 0,
      '20000': 0,
      '10000': 0,
      '5000': 0,
      '2000': 0,
      '1000': 0,
    };
  }

  openCashMovementModal() {
    const s = this.activeSession();
    if (!s) return;
    this.cashMovementType = 'OUT';
    this.cashMovementAmount = 0;
    this.cashMovementReason = '';
    this.showCashMovementModal.set(true);
    this.loadCashMovements(s.id);
  }

  loadCashMovements(sessionId: string) {
    this.loadingCashMovements.set(true);
    this.pos.getCashMovements(sessionId).subscribe({
      next: (data) => {
        this.cashMovements.set(data ?? []);
        this.loadingCashMovements.set(false);
      },
      error: () => {
        this.cashMovements.set([]);
        this.loadingCashMovements.set(false);
      },
    });
  }

  async saveCashMovement() {
    const s = this.activeSession();
    if (!s) return;
    if (this.cashMovementAmount <= 0 || !this.cashMovementReason.trim()) {
      this.notify.error('Monto y motivo son obligatorios');
      return;
    }

    let governanceOverrideId: string | undefined;
    if (this.cashMovementType === 'OUT' && this.shouldRequestOverride('CASH_WITHDRAWAL', { amount: this.cashMovementAmount })) {
      governanceOverrideId = this.findApprovedOverride('CASH_WITHDRAWAL', 'POS_SESSION', s.id)?.id;
      if (!governanceOverrideId) {
        await this.requestSupervisorOverride({
          action: 'CASH_WITHDRAWAL',
          resourceType: 'POS_SESSION',
          resourceId: s.id,
          reasonPrompt: 'Esta salida de efectivo requiere autorización del supervisor.',
          requestedPayload: {
            amount: this.cashMovementAmount,
            reason: this.cashMovementReason.trim(),
          },
        });
        return;
      }
    }

    this.processing.set(true);
    this.pos.createCashMovement(s.id, {
      type: this.cashMovementType,
      amount: this.cashMovementAmount,
      reason: this.cashMovementReason.trim(),
      governanceOverrideId,
    }).subscribe({
      next: () => {
        this.processing.set(false);
        this.notify.success(this.cashMovementType === 'OUT' ? 'Retiro parcial registrado' : 'Ingreso de caja registrado');
        this.cashMovementAmount = 0;
        this.cashMovementReason = '';
        this.loadCashMovements(s.id);
        this.loadSessionSummary();
      },
      error: (err: any) => {
        this.processing.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible registrar el movimiento de caja');
      },
    });
  }

  approveManagedSession(session: PosSession) {
    this.approvingSessionId = session.id;
    this.pos.approveCloseSession(session.id).subscribe({
      next: () => {
        this.approvingSessionId = null;
        this.notify.success('Cierre supervisado aprobado');
        this.loadRecentManagedSessions();
      },
      error: (err: any) => {
        this.approvingSessionId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible aprobar el cierre');
      },
    });
  }

  async reopenManagedSession(session: PosSession) {
    let governanceOverrideId: string | undefined;
    if (this.shouldRequestOverride('REOPEN_SESSION')) {
      governanceOverrideId = this.findApprovedOverride('REOPEN_SESSION', 'POS_SESSION', session.id)?.id;
      if (!governanceOverrideId) {
        await this.requestSupervisorOverride({
          action: 'REOPEN_SESSION',
          resourceType: 'POS_SESSION',
          resourceId: session.id,
          reasonPrompt: 'La reapertura controlada de caja requiere override del supervisor.',
          requestedPayload: {
            initialCash: Number(session.finalCash ?? session.countedCash ?? session.expectedCash ?? 0),
          },
        });
        return;
      }
    }

    this.reopeningSessionId = session.id;
    this.pos.reopenSession(session.id, {
      initialCash: Number(session.finalCash ?? session.countedCash ?? session.expectedCash ?? 0),
      terminalId: session.terminal?.id,
      shiftTemplateId: session.shiftTemplate?.id,
      notes: this.reopenNotes || undefined,
      governanceOverrideId,
    }).subscribe({
      next: (reopened) => {
        this.reopeningSessionId = null;
        this.reopenNotes = '';
        this.activeSession.set(reopened);
        this.showOperatingConfigModal.set(false);
        this.notify.success('Caja reabierta bajo control supervisor');
        this.loadRecentManagedSessions();
        this.restartHeartbeatLoop();
      },
      error: (err: any) => {
        this.reopeningSessionId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible reabrir la sesión');
      },
    });
  }

  loadProducts(search = '') {
    this.loadingProducts.set(true);
    this.pos.getCatalogProducts({
      search: search || undefined,
      locationId: this.selectedInventoryLocationId() || undefined,
    }).subscribe({
      next: (res) => { this.products.set((res ?? []) as Product[]); this.loadingProducts.set(false); },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSearch() { clearTimeout(this.productSearchTimer); this.productSearchTimer = setTimeout(() => this.loadProducts(this.productSearch), 300); }

  addToCart(product: Product) {
    const available = Number(product.availableStock ?? product.stock);
    if (available <= 0) return;
    const idx = this.cart().findIndex(i => i.productId === product.id);
    if (idx >= 0) {
      if (this.cart()[idx].quantity >= available) {
        this.notify.error('Stock insuficiente');
        return;
      }
      this.updateQty(idx, this.cart()[idx].quantity + 1);
    } else {
      const price = Number(product.price), taxRate = Number(product.taxRate);
      const sub = price, tax = sub * (taxRate / 100);
      this.cart.update(c => [...c, { productId:product.id, description:product.name, quantity:1, unitPrice:price, taxRate, discount:0, subtotal:Math.round(sub*100)/100, taxAmount:Math.round(tax*100)/100, total:Math.round((sub+tax)*100)/100, sku:product.sku, stock:product.stock, availableStock: available }]);
    }
    this.persistRecoverySnapshot();
    this.refreshPricingPreview();
  }

  updateQty(idx: number, qty: number) {
    this.cart.update(items => items.map((item, i) => {
      if (i !== idx) return item;
      const unitPrice = Number(item.unitPrice), taxRate = Number(item.taxRate), discount = Number(item.discount);
      const sub = qty * unitPrice * (1 - discount / 100), tax = sub * (taxRate / 100);
      return { ...item, quantity:qty, subtotal:Math.round(sub*100)/100, taxAmount:Math.round(tax*100)/100, total:Math.round((sub+tax)*100)/100 };
    }));
    this.persistRecoverySnapshot();
    this.refreshPricingPreview();
  }

  incrementQty(idx: number) {
    const item = this.cart()[idx];
    const available = Number(item.availableStock ?? item.stock ?? Infinity);
    if (Number.isFinite(available) && item.quantity >= available) {
      this.notify.error('Stock insuficiente');
      return;
    }
    this.updateQty(idx, item.quantity + 1);
  }
  decrementQty(idx: number) { const q = this.cart()[idx].quantity; if (q > 1) this.updateQty(idx, q - 1); }
  removeFromCart(idx: number) { this.cart.update(c => c.filter((_, i) => i !== idx)); this.persistRecoverySnapshot(); this.refreshPricingPreview(); }
  clearCart() {
    this.cart.set([]);
    this.clearSelectedCustomer();
    this.cartDiscountPct.set(0);
    this.pricingPreview.set(null);
    this.selectedOrderType.set('IN_STORE');
    this.scheduledAt = '';
    this.orderReference = '';
    this.deliveryAddress = '';
    this.deliveryContactName = '';
    this.deliveryContactPhone = '';
    this.persistRecoverySnapshot();
  }

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
    this.refreshPricingPreview();
  }

  loadSessionSummary() {
    const s = this.activeSession();
    if (!s) return;
    this.pos.getSalesSummary(undefined, undefined, s.id).subscribe({
      next: summary => this.sessionSummary.set(summary),
      error: () => {},
    });
  }

  refreshPricingPreview() {
    if (this.cart().length === 0) {
      this.pricingPreview.set(null);
      return;
    }
    this.loadingPricingPreview.set(true);
    this.pos.previewPricing({
      customerId: this.selectedCustomer()?.id,
      priceListId: this.selectedPriceListId() || undefined,
      cartDiscountPct: this.cartDiscountPct() || undefined,
      items: this.cart().map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discount: item.discount,
      })),
    }).subscribe({
      next: (preview) => {
        this.pricingPreview.set(preview);
        this.loadingPricingPreview.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.pricingPreview.set(null);
        this.loadingPricingPreview.set(false);
      },
    });
  }

  onPriceListSelected(id: string) {
    this.selectedPriceListId.set(id);
    this.refreshPricingPreview();
  }

  private buildPaymentLine(paymentMethod: PosPaymentMethod, amount: number): EditablePaymentLine {
    return {
      paymentMethod,
      amount: Math.max(0, Number(amount || 0)),
      transactionReference: '',
      providerName: '',
      notes: '',
    };
  }

  private syncPaymentSummaryFromLines() {
    const lines = this.paymentLines().filter((line) => Number(line.amount || 0) > 0);
    const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    this.amountPaid.set(Math.round(total * 100) / 100);
    this.selectedPaymentMethod.set(lines.length === 1 ? lines[0].paymentMethod : 'MIXED');
  }

  private updatePaymentLines(lines: EditablePaymentLine[]) {
    this.paymentLines.set(lines);
    this.syncPaymentSummaryFromLines();
  }

  setPrimaryPaymentMethod(method: PosPaymentMethod) {
    if (method === 'MIXED') {
      const current = this.paymentLines();
      if (current.length > 1) {
        this.updatePaymentLines(current);
      } else {
        this.updatePaymentLines([
          this.buildPaymentLine('CASH', this.cartTotal() / 2),
          this.buildPaymentLine('DATAPHONE', this.cartTotal() / 2),
        ]);
      }
      return;
    }
    this.updatePaymentLines([this.buildPaymentLine(method, this.cartTotal())]);
  }

  addPaymentLine() {
    const nextMethod = this.paymentLines().length === 0 ? this.selectedPaymentMethod() : 'DATAPHONE';
    this.updatePaymentLines([...this.paymentLines(), this.buildPaymentLine(nextMethod, 0)]);
  }

  updatePaymentLine(index: number, patch: Partial<EditablePaymentLine>) {
    this.updatePaymentLines(
      this.paymentLines().map((line, idx) =>
        idx === index
          ? {
              ...line,
              ...patch,
              amount:
                patch.amount !== undefined
                  ? Math.max(0, Number(patch.amount || 0))
                  : line.amount,
            }
          : line,
      ),
    );
  }

  removePaymentLine(index: number) {
    const next = this.paymentLines().filter((_, idx) => idx !== index);
    this.updatePaymentLines(next.length > 0 ? next : [this.buildPaymentLine('CASH', 0)]);
  }

  setCashPaymentAmount(amount: number) {
    const lines = [...this.paymentLines()];
    const cashIndex = lines.findIndex((line) => line.paymentMethod === 'CASH');
    if (cashIndex >= 0) {
      lines[cashIndex] = { ...lines[cashIndex], amount: Math.max(0, Number(amount || 0)) };
    } else {
      lines.unshift(this.buildPaymentLine('CASH', amount));
    }
    this.updatePaymentLines(lines);
  }

  get paymentRemainingAmount() {
    return Math.max(0, this.cartTotal() - this.paymentTotal());
  }

  openPaymentModal() {
    this.amountPaid.set(this.cartTotal());
    const preferred = this.selectedPaymentMethod();
    if (preferred === 'MIXED') {
      this.updatePaymentLines([
        this.buildPaymentLine('CASH', this.cartTotal() / 2),
        this.buildPaymentLine('DATAPHONE', this.cartTotal() / 2),
      ]);
    } else {
      this.updatePaymentLines([this.buildPaymentLine(preferred, this.cartTotal())]);
    }
    this.showPaymentModal.set(true);
  }

  openOperatingConfigModal() {
    this.loadOperatingConfig();
    this.loadRecentManagedSessions();
    this.loadPostSaleRequests();
    if (this.canSupervise()) this.loadSalesAnalytics();
    if (this.canSupervise()) this.loadIntegrationSummary();
    if (this.canSupervise()) this.loadMultiBranchOverview();
    if (this.canSupervise()) this.loadOperationalIncidents();
    if (this.canSupervise()) this.loadConfigDeployments();
    this.showOperatingConfigModal.set(true);
  }

  closeOperatingConfigModal() {
    this.showOperatingConfigModal.set(false);
    this.closeTerminalForm();
    this.closeShiftForm();
    this.closeLoyaltyCampaignForm();
    this.closeInventoryLocationForm();
    this.closeInventoryStockForm();
    this.closeInventoryTransferForm();
  }

  private emptyTerminalForm() {
    return {
      code: '',
      name: '',
      cashRegisterName: '',
      deviceName: '',
      printerName: '',
      printerConnectionType: 'USB',
      printerPaperWidth: 80,
      invoicePrefix: this.operatingConfig()?.fiscal?.prefix || 'POS',
      receiptPrefix: 'TIR',
      resolutionNumber: this.operatingConfig()?.fiscal?.resolutionNumber || '',
      isDefault: this.terminals().length === 0,
      autoPrintReceipt: true,
      requireCustomerForInvoice: true,
    };
  }

  private emptyShiftForm() {
    return {
      code: '',
      name: '',
      startTime: '08:00',
      endTime: '18:00',
      toleranceMinutes: 15,
      requiresBlindClose: false,
      isActive: true,
    };
  }

  private emptyLoyaltyCampaignForm() {
    return {
      code: '',
      name: '',
      description: '',
      targetSegment: '',
      targetTier: '',
      minSubtotal: 0,
      pointsPerAmount: 1,
      amountStep: 10000,
      bonusPoints: 0,
      isActive: true,
    };
  }

  private emptyInventoryLocationForm() {
    return {
      code: '',
      name: '',
      type: 'STORE',
      isDefault: this.inventoryLocations().length === 0,
      isActive: true,
      allowPosSales: true,
    };
  }

  private emptyInventoryStockForm() {
    return {
      locationId: this.selectedInventoryLocationId() || '',
      productId: '',
      quantity: 0,
      lotNumber: '',
      serialNumber: '',
      expiresAt: '',
    };
  }

  private emptyInventoryTransferForm() {
    return {
      fromLocationId: this.selectedInventoryLocationId() || '',
      toLocationId: '',
      reference: '',
      notes: '',
      items: [{ productId: '', quantity: 1, lotNumber: '', serialNumber: '', expiresAt: '' }],
    };
  }

  openTerminalForm() {
    this.editingTerminalId = null;
    this.terminalForm = this.emptyTerminalForm();
    this.showTerminalForm.set(true);
  }

  editTerminal(terminal: PosTerminal) {
    this.editingTerminalId = terminal.id;
    this.terminalForm = {
      code: terminal.code,
      name: terminal.name,
      cashRegisterName: terminal.cashRegisterName || '',
      deviceName: terminal.deviceName || '',
      printerName: terminal.printerName || '',
      printerConnectionType: terminal.printerConnectionType || 'USB',
      printerPaperWidth: terminal.printerPaperWidth || 80,
      invoicePrefix: terminal.invoicePrefix || 'POS',
      receiptPrefix: terminal.receiptPrefix || 'TIR',
      resolutionNumber: terminal.resolutionNumber || '',
      isDefault: terminal.isDefault,
      autoPrintReceipt: terminal.autoPrintReceipt,
      requireCustomerForInvoice: terminal.requireCustomerForInvoice,
    };
    this.showTerminalForm.set(true);
  }

  closeTerminalForm() {
    this.showTerminalForm.set(false);
    this.editingTerminalId = null;
    this.terminalForm = this.emptyTerminalForm();
  }

  openLoyaltyCampaignForm() {
    this.editingLoyaltyCampaignId = null;
    this.loyaltyCampaignForm = this.emptyLoyaltyCampaignForm();
    this.showLoyaltyCampaignForm.set(true);
  }

  editLoyaltyCampaign(campaign: PosLoyaltyCampaign) {
    this.editingLoyaltyCampaignId = campaign.id;
    this.loyaltyCampaignForm = {
      code: campaign.code || '',
      name: campaign.name,
      description: campaign.description || '',
      targetSegment: campaign.targetSegment || '',
      targetTier: campaign.targetTier || '',
      minSubtotal: Number(campaign.minSubtotal ?? 0),
      pointsPerAmount: Number(campaign.pointsPerAmount ?? 1),
      amountStep: Number(campaign.amountStep ?? 10000),
      bonusPoints: Number(campaign.bonusPoints ?? 0),
      isActive: campaign.isActive,
    };
    this.showLoyaltyCampaignForm.set(true);
  }

  closeLoyaltyCampaignForm() {
    this.showLoyaltyCampaignForm.set(false);
    this.editingLoyaltyCampaignId = null;
    this.loyaltyCampaignForm = this.emptyLoyaltyCampaignForm();
  }

  openInventoryLocationForm() {
    this.editingInventoryLocationId = null;
    this.inventoryLocationForm = this.emptyInventoryLocationForm();
    this.showInventoryLocationForm.set(true);
  }

  editInventoryLocation(location: PosInventoryLocation) {
    this.editingInventoryLocationId = location.id;
    this.inventoryLocationForm = {
      code: location.code,
      name: location.name,
      type: location.type,
      isDefault: location.isDefault,
      isActive: location.isActive,
      allowPosSales: location.allowPosSales,
    };
    this.showInventoryLocationForm.set(true);
  }

  closeInventoryLocationForm() {
    this.showInventoryLocationForm.set(false);
    this.editingInventoryLocationId = null;
    this.inventoryLocationForm = this.emptyInventoryLocationForm();
  }

  openInventoryStockForm() {
    this.inventoryStockForm = this.emptyInventoryStockForm();
    this.showInventoryStockForm.set(true);
  }

  closeInventoryStockForm() {
    this.showInventoryStockForm.set(false);
    this.inventoryStockForm = this.emptyInventoryStockForm();
  }

  openInventoryTransferForm() {
    this.inventoryTransferForm = this.emptyInventoryTransferForm();
    this.showInventoryTransferForm.set(true);
  }

  closeInventoryTransferForm() {
    this.showInventoryTransferForm.set(false);
    this.inventoryTransferForm = this.emptyInventoryTransferForm();
  }

  hasGovernanceRole(rule: PosGovernanceRule, role: string) {
    return (rule.allowedRoles ?? []).includes(role);
  }

  toggleGovernanceRole(rule: PosGovernanceRule, role: string, checked: boolean) {
    this.governanceRules.update((rules) =>
      rules.map((item) =>
        item.action === rule.action
          ? {
              ...item,
              allowedRoles: checked
                ? Array.from(new Set([...(item.allowedRoles ?? []), role]))
                : (item.allowedRoles ?? []).filter((current) => current !== role),
            }
          : item,
      ),
    );
  }

  updateGovernanceRule(rule: PosGovernanceRule, patch: Partial<PosGovernanceRule>) {
    this.governanceRules.update((rules) =>
      rules.map((item) => (item.action === rule.action ? { ...item, ...patch } : item)),
    );
  }

  saveGovernanceRule(rule: PosGovernanceRule) {
    this.savingGovernanceRuleAction.set(rule.action);
    this.pos.saveGovernanceRule({
      ...rule,
      allowedRoles: [...(rule.allowedRoles ?? [])],
      maxDiscountPct:
        rule.maxDiscountPct != null && Number(rule.maxDiscountPct) > 0
          ? Number(rule.maxDiscountPct)
          : undefined,
      maxAmountThreshold:
        rule.maxAmountThreshold != null && Number(rule.maxAmountThreshold) > 0
          ? Number(rule.maxAmountThreshold)
          : undefined,
    }).subscribe({
      next: () => {
        this.savingGovernanceRuleAction.set(null);
        this.notify.success(`Regla POS actualizada: ${this.getGovernanceActionLabel(rule.action)}`);
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingGovernanceRuleAction.set(null);
        this.notify.error(err?.error?.message ?? 'No fue posible guardar la regla de gobierno POS');
      },
    });
  }

  async approveGovernanceOverride(override: PosSupervisorOverride) {
    const notes = await this.dialog.prompt({
      title: 'Aprobar override',
      message: `Autoriza la acción ${this.getGovernanceActionLabel(override.action)} para continuar.`,
      inputLabel: 'Notas de aprobación',
      inputType: 'textarea',
      placeholder: 'Observación del supervisor',
      confirmLabel: 'Aprobar',
      allowEmpty: true,
    });
    if (notes === null) return;

    this.approvingOverrideId = override.id;
    this.pos.approveSupervisorOverride(override.id, notes || undefined).subscribe({
      next: () => {
        this.approvingOverrideId = null;
        this.notify.success('Override aprobado por supervisión');
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.approvingOverrideId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible aprobar el override');
      },
    });
  }

  async rejectGovernanceOverride(override: PosSupervisorOverride) {
    const notes = await this.dialog.prompt({
      title: 'Rechazar override',
      message: `Indica la razón del rechazo para ${this.getGovernanceActionLabel(override.action)}.`,
      inputLabel: 'Motivo de rechazo',
      inputType: 'textarea',
      placeholder: 'Motivo del rechazo',
      confirmLabel: 'Rechazar',
      danger: true,
    });
    if (notes === null) return;

    this.rejectingOverrideId = override.id;
    this.pos.rejectSupervisorOverride(override.id, notes || undefined).subscribe({
      next: () => {
        this.rejectingOverrideId = null;
        this.notify.success('Override rechazado');
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.rejectingOverrideId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible rechazar el override');
      },
    });
  }

  private async requestSupervisorOverride(payload: {
    action: PosGovernanceAction;
    resourceType: string;
    resourceId?: string;
    reasonPrompt: string;
    requestedPayload?: Record<string, any>;
  }) {
    const reason = await this.dialog.prompt({
      title: 'Solicitar override de supervisor',
      message: payload.reasonPrompt,
      inputLabel: 'Motivo',
      inputType: 'textarea',
      placeholder: 'Explica por qué necesitas autorización',
      confirmLabel: 'Solicitar',
    });
    if (reason === null) return null;

    return new Promise<PosSupervisorOverride | null>((resolve) => {
      this.pos.requestSupervisorOverride({
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        reason,
        requestedPayload: payload.requestedPayload,
      }).subscribe({
        next: (override) => {
          this.notify.warning('Solicitud enviada a supervisión. Apruébala desde Configuración POS.');
          this.loadOperatingConfig();
          resolve(override);
        },
        error: (err: any) => {
          this.notify.error(err?.error?.message ?? 'No fue posible solicitar el override');
          resolve(null);
        },
      });
    });
  }

  loadInventoryStocks(search = '') {
    this.pos.getInventoryStocks(search || undefined).subscribe({
      next: (stocks) => {
        this.inventoryStocks.set(stocks ?? []);
        this.cdr.markForCheck();
      },
      error: () => this.inventoryStocks.set([]),
    });
  }

  saveInventoryLocation() {
    if (!this.inventoryLocationForm.code.trim() || !this.inventoryLocationForm.name.trim()) {
      this.notify.error('Código y nombre de bodega son obligatorios');
      return;
    }
    this.savingOperatingConfig.set(true);
    const payload = {
      code: this.inventoryLocationForm.code.trim(),
      name: this.inventoryLocationForm.name.trim(),
      type: this.inventoryLocationForm.type,
      isDefault: !!this.inventoryLocationForm.isDefault,
      isActive: !!this.inventoryLocationForm.isActive,
      allowPosSales: !!this.inventoryLocationForm.allowPosSales,
    };
    const request = this.editingInventoryLocationId
      ? this.pos.updateInventoryLocation(this.editingInventoryLocationId, payload)
      : this.pos.createInventoryLocation(payload);
    request.subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success(this.editingInventoryLocationId ? 'Bodega actualizada' : 'Bodega creada');
        this.closeInventoryLocationForm();
        this.loadOperatingConfig();
        this.loadProducts(this.productSearch);
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible guardar la bodega POS');
      },
    });
  }

  saveInventoryStock() {
    if (!this.inventoryStockForm.locationId || !this.inventoryStockForm.productId || Number(this.inventoryStockForm.quantity) < 0) {
      this.notify.error('Ubicación, producto y cantidad son obligatorios');
      return;
    }
    this.savingOperatingConfig.set(true);
    this.pos.createInventoryStock({
      locationId: this.inventoryStockForm.locationId,
      productId: this.inventoryStockForm.productId,
      quantity: Number(this.inventoryStockForm.quantity),
      lotNumber: this.inventoryStockForm.lotNumber?.trim() || undefined,
      serialNumber: this.inventoryStockForm.serialNumber?.trim() || undefined,
      expiresAt: this.inventoryStockForm.expiresAt || undefined,
    }).subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success('Stock retail actualizado');
        this.closeInventoryStockForm();
        this.loadInventoryStocks();
        this.loadProducts(this.productSearch);
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible registrar el stock');
      },
    });
  }

  addTransferLine() {
    this.inventoryTransferForm.items.push({ productId: '', quantity: 1, lotNumber: '', serialNumber: '', expiresAt: '' });
  }

  removeTransferLine(index: number) {
    this.inventoryTransferForm.items.splice(index, 1);
    if (this.inventoryTransferForm.items.length === 0) this.addTransferLine();
  }

  saveInventoryTransfer() {
    if (!this.inventoryTransferForm.fromLocationId || !this.inventoryTransferForm.toLocationId) {
      this.notify.error('Selecciona origen y destino de la transferencia');
      return;
    }
    const items = this.inventoryTransferForm.items
      .filter((item: any) => item.productId && Number(item.quantity) > 0)
      .map((item: any) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        lotNumber: item.lotNumber?.trim() || undefined,
        serialNumber: item.serialNumber?.trim() || undefined,
        expiresAt: item.expiresAt || undefined,
      }));
    if (!items.length) {
      this.notify.error('Agrega al menos un producto a transferir');
      return;
    }
    this.savingOperatingConfig.set(true);
    this.pos.createInventoryTransfer({
      fromLocationId: this.inventoryTransferForm.fromLocationId,
      toLocationId: this.inventoryTransferForm.toLocationId,
      reference: this.inventoryTransferForm.reference?.trim() || undefined,
      notes: this.inventoryTransferForm.notes?.trim() || undefined,
      items,
    }).subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success('Transferencia creada');
        this.closeInventoryTransferForm();
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible crear la transferencia');
      },
    });
  }

  postInventoryTransfer(transfer: PosInventoryTransfer) {
    this.postingTransferId = transfer.id;
    this.pos.postInventoryTransfer(transfer.id).subscribe({
      next: () => {
        this.postingTransferId = null;
        this.notify.success('Transferencia aplicada al inventario');
        this.loadOperatingConfig();
        this.loadInventoryStocks();
        this.loadProducts(this.productSearch);
      },
      error: (err: any) => {
        this.postingTransferId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible aplicar la transferencia');
      },
    });
  }

  saveTerminal() {
    if (!this.terminalForm.code.trim() || !this.terminalForm.name.trim()) {
      this.notify.error('Código y nombre de terminal son obligatorios');
      return;
    }
    this.savingOperatingConfig.set(true);
    const payload = {
      code: this.terminalForm.code.trim(),
      name: this.terminalForm.name.trim(),
      cashRegisterName: this.terminalForm.cashRegisterName?.trim() || undefined,
      deviceName: this.terminalForm.deviceName?.trim() || undefined,
      printerName: this.terminalForm.printerName?.trim() || undefined,
      printerConnectionType: this.terminalForm.printerConnectionType?.trim() || undefined,
      printerPaperWidth: Number(this.terminalForm.printerPaperWidth || 80),
      invoicePrefix: this.terminalForm.invoicePrefix?.trim() || undefined,
      receiptPrefix: this.terminalForm.receiptPrefix?.trim() || undefined,
      resolutionNumber: this.terminalForm.resolutionNumber?.trim() || undefined,
      isDefault: !!this.terminalForm.isDefault,
      autoPrintReceipt: !!this.terminalForm.autoPrintReceipt,
      requireCustomerForInvoice: !!this.terminalForm.requireCustomerForInvoice,
    };
    const request = this.editingTerminalId
      ? this.pos.updateTerminal(this.editingTerminalId, payload)
      : this.pos.createTerminal(payload);
    request.subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success(this.editingTerminalId ? 'Terminal actualizada' : 'Terminal creada');
        this.closeTerminalForm();
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible guardar la terminal POS');
      },
    });
  }

  openShiftForm() {
    this.editingShiftId = null;
    this.shiftForm = this.emptyShiftForm();
    this.showShiftForm.set(true);
  }

  editShift(shift: PosShiftTemplate) {
    this.editingShiftId = shift.id;
    this.shiftForm = {
      code: shift.code || '',
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      toleranceMinutes: shift.toleranceMinutes ?? 0,
      requiresBlindClose: shift.requiresBlindClose,
      isActive: shift.isActive,
    };
    this.showShiftForm.set(true);
  }

  closeShiftForm() {
    this.showShiftForm.set(false);
    this.editingShiftId = null;
    this.shiftForm = this.emptyShiftForm();
  }

  saveShift() {
    if (!this.shiftForm.name.trim() || !this.shiftForm.startTime || !this.shiftForm.endTime) {
      this.notify.error('Nombre y horario del turno son obligatorios');
      return;
    }
    this.savingOperatingConfig.set(true);
    const payload = {
      code: this.shiftForm.code?.trim() || undefined,
      name: this.shiftForm.name.trim(),
      startTime: this.shiftForm.startTime,
      endTime: this.shiftForm.endTime,
      toleranceMinutes: Number(this.shiftForm.toleranceMinutes || 0),
      requiresBlindClose: !!this.shiftForm.requiresBlindClose,
      isActive: !!this.shiftForm.isActive,
    };
    const request = this.editingShiftId
      ? this.pos.updateShiftTemplate(this.editingShiftId, payload)
      : this.pos.createShiftTemplate(payload);
    request.subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success(this.editingShiftId ? 'Turno actualizado' : 'Turno creado');
        this.closeShiftForm();
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible guardar el turno POS');
      },
    });
  }

  saveLoyaltyCampaign() {
    if (!this.loyaltyCampaignForm.name.trim()) {
      this.notify.error('El nombre de la campaña es obligatorio');
      return;
    }
    this.savingOperatingConfig.set(true);
    const payload = {
      code: this.loyaltyCampaignForm.code?.trim() || undefined,
      name: this.loyaltyCampaignForm.name.trim(),
      description: this.loyaltyCampaignForm.description?.trim() || undefined,
      targetSegment: this.loyaltyCampaignForm.targetSegment?.trim() || undefined,
      targetTier: this.loyaltyCampaignForm.targetTier?.trim() || undefined,
      minSubtotal: Number(this.loyaltyCampaignForm.minSubtotal || 0) || undefined,
      pointsPerAmount: Number(this.loyaltyCampaignForm.pointsPerAmount || 0),
      amountStep: Number(this.loyaltyCampaignForm.amountStep || 10000),
      bonusPoints: Number(this.loyaltyCampaignForm.bonusPoints || 0),
      isActive: !!this.loyaltyCampaignForm.isActive,
    };
    const request = this.editingLoyaltyCampaignId
      ? this.pos.updateLoyaltyCampaign(this.editingLoyaltyCampaignId, payload)
      : this.pos.createLoyaltyCampaign(payload);
    request.subscribe({
      next: () => {
        this.savingOperatingConfig.set(false);
        this.notify.success(this.editingLoyaltyCampaignId ? 'Campaña actualizada' : 'Campaña creada');
        this.closeLoyaltyCampaignForm();
        this.loadOperatingConfig();
      },
      error: (err: any) => {
        this.savingOperatingConfig.set(false);
        this.notify.error(err?.error?.message ?? 'No fue posible guardar la campaña de fidelización');
      },
    });
  }

  async processSale() {
    const session = this.activeSession(); if (!session || !this.isPaymentValid()) return;
    let governanceOverrideId: string | undefined;
    if (this.cartDiscountPct() > 0 && this.shouldRequestOverride('MANUAL_DISCOUNT', {
      discountPct: this.cartDiscountPct(),
      amount: this.cartDiscountAmount(),
    })) {
      governanceOverrideId = this.findApprovedOverride('MANUAL_DISCOUNT', 'POS_SALE')?.id;
      if (!governanceOverrideId) {
        await this.requestSupervisorOverride({
          action: 'MANUAL_DISCOUNT',
          resourceType: 'POS_SALE',
          reasonPrompt: 'El descuento manual requiere autorización del supervisor.',
          requestedPayload: {
            cartDiscountPct: this.cartDiscountPct(),
            subtotal: this.cartSubtotal(),
            total: this.cartTotal(),
            itemCount: this.cart().length,
          },
        });
        return;
      }
    }
    const clientSyncId = this.createClientSyncId();
    this.processing.set(true);
    const isAdv = this.isAdvancePayment();
    const payments = this.paymentLines()
      .filter((line) => Number(line.amount || 0) > 0)
      .map((line) => ({
        paymentMethod: line.paymentMethod,
        amount: Number(line.amount),
        transactionReference: line.transactionReference?.trim() || undefined,
        providerName: line.providerName?.trim() || undefined,
        notes: line.notes?.trim() || undefined,
      }));
    const dto = {
      sessionId: session.id,
      inventoryLocationId: this.selectedInventoryLocationId() || undefined,
      customerId: this.selectedCustomer()?.id,
      orderType: this.selectedOrderType(),
      orderReference: this.orderReference?.trim() || undefined,
      scheduledAt: this.scheduledAt || undefined,
      deliveryAddress: this.deliveryAddress?.trim() || undefined,
      deliveryContactName: this.deliveryContactName?.trim() || undefined,
      deliveryContactPhone: this.deliveryContactPhone?.trim() || undefined,
      sourceChannel: this.sourceChannel?.trim() || undefined,
      externalOrderId: this.externalOrderId || undefined,
      priceListId: this.selectedPriceListId() || undefined,
      governanceOverrideId,
      clientSyncId,
      couponCode: this.couponCode?.trim() || undefined,
      loyaltyPointsToRedeem: this.loyaltyPointsToRedeem || undefined,
      items: this.cart().map(i => ({ productId:i.productId, description:i.description, quantity:i.quantity, unitPrice:i.unitPrice, taxRate:i.taxRate, discount:i.discount })),
      paymentMethod: this.selectedPaymentMethod(),
      amountPaid: this.amountPaid(),
      payments,
      generateInvoice: !isAdv && this.generateInvoice() && !!this.selectedCustomer(),
      isAdvancePayment: (isAdv || this.selectedOrderType() === 'LAYAWAY') || undefined,
      cartDiscountPct: this.cartDiscountPct() || undefined,
    };
    this.pos.createSale(dto).subscribe({
      next: (sale: any) => {
        this.completedSale.set(sale);
        this.cart.set([]);
        this.clearSelectedCustomer();
        this.generateInvoice.set(false);
        this.isAdvancePayment.set(false);
        this.selectedOrderType.set('IN_STORE');
        this.scheduledAt = '';
        this.orderReference = '';
        this.deliveryAddress = '';
        this.deliveryContactName = '';
        this.deliveryContactPhone = '';
        this.sourceChannel = 'POS';
        this.externalOrderId = '';
        this.couponCode = '';
        this.loyaltyPointsToRedeem = 0;
        this.showPaymentModal.set(false);
        this.processing.set(false);
        this.pendingOfflineQueue.set(this.pendingOfflineQueue().filter((item) => item.clientSyncId !== clientSyncId));
        this.persistOfflineQueue();
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
      error: (err: any) => {
        this.processing.set(false);
        if (err?.status === 0) {
          this.offlineMode.set(true);
          this.queueOfflineSale(dto);
          this.completedSale.set({
            ...dto,
            id: clientSyncId,
            companyId: '',
            saleNumber: `PEND-${clientSyncId.slice(0, 8).toUpperCase()}`,
            orderStatus: dto.orderType === 'IN_STORE' ? 'CLOSED' : 'OPEN',
            subtotal: this.cartSubtotal(),
            taxAmount: this.cartTax(),
            discountAmount: this.cartDiscountAmount(),
            total: this.cartTotal(),
            change: this.changeAmount(),
            advanceAmount: dto.isAdvancePayment ? this.paymentTotal() : 0,
            remainingAmount: dto.isAdvancePayment ? Math.max(0, this.cartTotal() - this.paymentTotal()) : 0,
            status: dto.isAdvancePayment ? 'ADVANCE' : 'COMPLETED',
            deliveryStatus: dto.orderType === 'IN_STORE' ? 'DELIVERED' : 'PENDING',
            createdAt: new Date().toISOString(),
            items: this.cart().map((item, index) => ({
              id: `${clientSyncId}-${index}`,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              discount: item.discount,
              subtotal: item.subtotal,
              total: item.total,
            })),
            payments: payments.map((payment, index) => ({
              id: `${clientSyncId}-pay-${index}`,
              saleId: clientSyncId,
              paymentMethod: payment.paymentMethod,
              amount: payment.amount,
              transactionReference: payment.transactionReference,
              providerName: payment.providerName,
              notes: payment.notes,
            })),
            customer: this.selectedCustomer() || undefined,
            clientSyncId,
          } as any);
          this.cart.set([]);
          this.clearSelectedCustomer();
          this.showPaymentModal.set(false);
          this.notify.warning('Sin conexión. La venta quedó guardada en cola local para sincronización diferida.');
          return;
        }
        this.notify.error(err?.error?.message ?? 'Error al procesar la venta');
      },
    });
  }

  toggleHistory() { const next = !this.showHistory(); this.showHistory.set(next); if (next) this.loadSessionSales(); }

  loadSessionSales() {
    const session = this.activeSession(); if (!session) return;
    this.loadingHistory.set(true);
    this.pos.getSales({ sessionId:session.id, limit:100 }).subscribe({
      next: res => {
        const sales = res.data ?? [];
        this.sessionSales.set(sales);
        if (this.selectedInvoiceSale()) {
          const refreshed = sales.find(item => item.id === this.selectedInvoiceSale()!.id);
          if (refreshed) this.selectedInvoiceSale.set(refreshed);
        }
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false),
    });
  }

  openPostSaleModal(sale: PosSale) {
    this.selectedPostSaleSale.set(sale);
    this.postSaleType.set('RETURN');
    this.postSaleReasonCode.set('DEFECTIVE_PRODUCT');
    this.postSaleReasonDetail = '';
    this.postSaleLines.set(
      sale.items.map((item) => ({
        saleItemId: item.id,
        description: item.description,
        soldQuantity: Number(item.quantity),
        quantity: 0,
      })),
    );
    this.postSaleReplacementLines.set([{ productId: '', quantity: 1 }]);
    this.showPostSaleModal.set(true);
  }

  updatePostSaleLine(index: number, quantity: number) {
    this.postSaleLines.update((lines) =>
      lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              quantity: Math.max(0, Math.min(Number(line.soldQuantity), Number(quantity || 0))),
            }
          : line,
      ),
    );
  }

  addReplacementLine() {
    this.postSaleReplacementLines.update((lines) => [...lines, { productId: '', quantity: 1 }]);
  }

  updateReplacementLine(index: number, patch: Partial<PosPostSaleReplacementLine>) {
    this.postSaleReplacementLines.update((lines) =>
      lines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...patch,
              quantity: Math.max(0, Number((patch.quantity ?? line.quantity) || 0)),
            }
          : line,
      ),
    );
  }

  removeReplacementLine(index: number) {
    this.postSaleReplacementLines.update((lines) =>
      lines.length <= 1 ? lines : lines.filter((_, lineIndex) => lineIndex !== index),
    );
  }

  submitPostSaleRequest() {
    const sale = this.selectedPostSaleSale();
    if (!sale) return;

    const items = this.postSaleLines()
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        saleItemId: line.saleItemId,
        quantity: Number(line.quantity),
      }));

    if (items.length === 0) {
      this.notify.error('Selecciona al menos un ítem para la devolución o cambio');
      return;
    }

    const replacements =
      this.postSaleType() === 'EXCHANGE'
        ? this.postSaleReplacementLines()
            .filter((line) => !!line.productId && Number(line.quantity) > 0)
            .map((line) => ({
              productId: line.productId,
              quantity: Number(line.quantity),
            }))
        : [];

    if (this.postSaleType() === 'EXCHANGE' && replacements.length === 0) {
      this.notify.error('Selecciona al menos un producto para el cambio');
      return;
    }

    this.submittingPostSale.set(true);
    this.pos
      .createPostSaleRequest(sale.id, {
        type: this.postSaleType(),
        reasonCode: this.postSaleReasonCode(),
        reasonDetail: this.postSaleReasonDetail?.trim() || undefined,
        items,
        replacements,
      })
      .subscribe({
        next: () => {
          this.submittingPostSale.set(false);
          this.showPostSaleModal.set(false);
          this.notify.success('Solicitud de postventa registrada y enviada a aprobación');
          this.loadSessionSales();
          this.loadPostSaleRequests();
        },
        error: (err: any) => {
          this.submittingPostSale.set(false);
          this.notify.error(err?.error?.message ?? 'No fue posible registrar la postventa');
        },
      });
  }

  approvePostSaleRequest(request: PosPostSaleRequest) {
    this.resolvingPostSaleId = request.id;
    this.pos.approvePostSaleRequest(request.id).subscribe({
      next: (resolved) => {
        this.resolvingPostSaleId = null;
        this.notify.success(
          resolved.creditNoteInvoice
            ? `Postventa aprobada y nota crédito ${resolved.creditNoteInvoice.invoiceNumber} generada`
            : 'Postventa aprobada',
        );
        this.loadPostSaleRequests();
        this.loadSessionSales();
      },
      error: (err: any) => {
        this.resolvingPostSaleId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible aprobar la postventa');
      },
    });
  }

  rejectPostSaleRequest(request: PosPostSaleRequest) {
    this.resolvingPostSaleId = request.id;
    this.pos.rejectPostSaleRequest(request.id).subscribe({
      next: () => {
        this.resolvingPostSaleId = null;
        this.notify.success('Solicitud de postventa rechazada');
        this.loadPostSaleRequests();
        this.loadSessionSales();
      },
      error: (err: any) => {
        this.resolvingPostSaleId = null;
        this.notify.error(err?.error?.message ?? 'No fue posible rechazar la postventa');
      },
    });
  }

  async cancelSale(saleId: string) {
    const confirmed = await this.dialog.confirm({
      title: 'Cancelar venta',
      message: 'Se restaurará el stock y la venta quedará anulada.',
      confirmLabel: 'Cancelar venta',
      danger: true,
    });
    if (!confirmed) return;

    let governanceOverrideId: string | undefined;
    if (this.shouldRequestOverride('CANCEL_SALE')) {
      governanceOverrideId = this.findApprovedOverride('CANCEL_SALE', 'POS_SALE', saleId)?.id;
      if (!governanceOverrideId) {
        await this.requestSupervisorOverride({
          action: 'CANCEL_SALE',
          resourceType: 'POS_SALE',
          resourceId: saleId,
          reasonPrompt: 'La anulación de venta requiere autorización del supervisor.',
        });
        return;
      }
    }

    this.pos.cancelSale(saleId, undefined, governanceOverrideId).subscribe({
      next: () => {
        this.notify.success('Venta cancelada'); this.loadSessionSales();
        const s = this.activeSession();
        if (s) { const sale = this.sessionSales().find(x => x.id === saleId); if (sale) this.activeSession.set({ ...s, totalSales:Math.max(0,Number(s.totalSales)-Number(sale.total)), totalTransactions:Math.max(0,s.totalTransactions-1) }); }
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al cancelar la venta'),
    });
  }

  async refundSale(sale: PosSale) {
    const reason = await this.dialog.prompt({
      title: 'Reembolsar venta',
      message: 'El reembolso restaurará inventario y ajustará la caja de la sesión.',
      inputLabel: 'Motivo del reembolso',
      inputType: 'textarea',
      placeholder: 'Describe el motivo del reembolso',
      confirmLabel: 'Reembolsar',
      danger: true,
    });
    if (reason === null) return;

    let governanceOverrideId: string | undefined;
    if (this.shouldRequestOverride('REFUND_SALE', { amount: sale.total })) {
      governanceOverrideId = this.findApprovedOverride('REFUND_SALE', 'POS_SALE', sale.id)?.id;
      if (!governanceOverrideId) {
        await this.requestSupervisorOverride({
          action: 'REFUND_SALE',
          resourceType: 'POS_SALE',
          resourceId: sale.id,
          reasonPrompt: 'El reembolso de venta requiere autorización del supervisor.',
          requestedPayload: {
            total: sale.total,
            saleNumber: sale.saleNumber,
            reason,
          },
        });
        return;
      }
    }

    this.pos.refundSale(sale.id, reason || undefined, governanceOverrideId).subscribe({
      next: () => {
        this.notify.success('Venta reembolsada');
        this.loadSessionSales();
      },
      error: (err: any) => {
        this.notify.error(err?.error?.message ?? 'No fue posible reembolsar la venta');
      },
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

  openInvoiceModal(sale: PosSale) {
    this.selectedInvoiceSale.set(sale);
    this.selectedInvoiceDetail.set(null);
    this.showInvoiceModal.set(true);
    this.loadInvoiceDetail(sale);
  }

  submitInvoiceToDian(sale: PosSale) {
    const invoiceId = sale.invoice?.id; if (!invoiceId) return;
    this.sendingDian[sale.id] = true;
    this.pos.submitInvoiceToDian(invoiceId).subscribe({
      next: (res: any) => {
        this.sendingDian[sale.id] = false;
        const updatedInvoice = res?.data ?? res;
        const zipKey = res?.dianZipKey ?? res?.data?.dianZipKey;
        if (zipKey) {
          this.notify.success(`Factura enviada a DIAN (ZipKey: ${zipKey.slice(0,8)}…)`);
        } else {
          this.notify.warning('Factura procesada — consulta el estado DIAN para confirmar.');
        }
        this.patchSaleInvoice(sale, updatedInvoice);
        if (this.showHistory()) this.loadSessionSales();
        this.refreshInvoiceContext(sale);
      },
      error: (err: any) => {
        this.sendingDian[sale.id] = false;
        this.notify.error(err?.error?.message ?? 'Error al enviar a la DIAN');
      },
    });
  }

  queryDianStatus(sale: PosSale) {
    const invoiceId = sale.invoice?.id; if (!invoiceId) return;
    this.queryingDian[sale.id] = true;
    this.pos.queryInvoiceDianStatus(invoiceId).subscribe({
      next: (res: any) => {
        this.queryingDian[sale.id] = false;
        const updated = res?.data ?? res;
        const status = updated?.status ?? res?.status;
        const code   = updated?.dianStatusCode ?? '—';
        const msg    = updated?.dianStatusMsg  ?? '';
        if (status === 'ACCEPTED_DIAN') {
          this.notify.success('Factura aceptada por la DIAN');
        } else if (status === 'REJECTED_DIAN') {
          this.notify.error(`Rechazada por DIAN (${code}): ${msg.slice(0, 100)}`);
        } else {
          this.notify.info(`Estado DIAN: ${code} — ${msg || 'En proceso'}`);
        }
        this.patchSaleInvoice(sale, updated);
        if (this.showHistory()) this.loadSessionSales();
        this.refreshInvoiceContext(sale);
      },
      error: (err: any) => {
        this.queryingDian[sale.id] = false;
        this.notify.error(err?.error?.message ?? 'Error al consultar estado DIAN');
      },
    });
  }

  private loadInvoiceDetail(sale: PosSale) {
    const invoiceId = sale.invoice?.id;
    if (!invoiceId) return;
    this.loadingInvoiceDetail.set(true);
    this.pos.getInvoiceDetail(invoiceId).subscribe({
      next: (detail: any) => {
        this.selectedInvoiceDetail.set(detail?.data ?? detail);
        this.loadingInvoiceDetail.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingInvoiceDetail.set(false);
        this.selectedInvoiceDetail.set(null);
      },
    });
  }

  private refreshInvoiceContext(sale: PosSale) {
    const refreshedSale = this.sessionSales().find(item => item.id === sale.id) ?? sale;
    if (this.selectedInvoiceSale()?.id === sale.id) {
      this.selectedInvoiceSale.set(refreshedSale);
      this.loadInvoiceDetail(refreshedSale);
    }
    if (this.completedSale()?.id === sale.id) {
      this.completedSale.set(refreshedSale);
    }
  }

  private patchSaleInvoice(sale: PosSale, invoicePatch: any) {
    if (!invoicePatch || !sale.invoice) return;
    const mergeSale = (target: PosSale | null) => {
      if (!target || target.id !== sale.id) return target;
      return { ...target, invoice: { ...target.invoice, ...invoicePatch } };
    };
    this.sessionSales.update(items => items.map(item => mergeSale(item as PosSale) as PosSale));
    this.selectedInvoiceSale.update(s => mergeSale(s));
    this.completedSale.update(s => mergeSale(s));
  }

  openInvoicePdf(sale: PosSale) {
    const invoiceId = sale.invoice?.id;
    if (!invoiceId) return;
    this.loadingInvoicePdfPreview.set(true);
    this.showInvoicePdfModal.set(true);
    this.pos.getInvoicePdf(invoiceId).subscribe({
      next: blob => {
        if (this.invoicePdfObjectUrl) URL.revokeObjectURL(this.invoicePdfObjectUrl);
        this.invoicePdfObjectUrl = URL.createObjectURL(new Blob([blob], { type: 'text/html' }));
        this.invoicePdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.invoicePdfObjectUrl));
        this.loadingInvoicePdfPreview.set(false);
      },
      error: () => {
        this.loadingInvoicePdfPreview.set(false);
        this.showInvoicePdfModal.set(false);
        this.notify.error('Error al generar la vista previa de la factura');
      },
    });
  }
  closeInvoicePdfModal() {
    if (this.invoicePdfObjectUrl) {
      URL.revokeObjectURL(this.invoicePdfObjectUrl);
      this.invoicePdfObjectUrl = null;
    }
    this.invoicePdfUrl.set(null);
    this.showInvoicePdfModal.set(false);
  }
  downloadInvoicePdf(sale: PosSale) {
    const invoiceId = sale.invoice?.id;
    const invoiceNumber = sale.invoice?.invoiceNumber || sale.saleNumber;
    if (!invoiceId) return;
    this.downloadingInvoicePdf.set(true);
    this.pos.downloadInvoicePdf(invoiceId).subscribe({
      next: blob => {
        this.triggerDownload(blob, `${invoiceNumber}.pdf`);
        this.downloadingInvoicePdf.set(false);
      },
      error: () => {
        this.downloadingInvoicePdf.set(false);
        this.notify.error('No fue posible descargar el PDF de la factura');
      },
    });
  }
  downloadInvoiceZip(sale: PosSale) {
    const invoiceId = sale.invoice?.id;
    const invoiceNumber = sale.invoice?.invoiceNumber || sale.saleNumber;
    if (!invoiceId) return;
    this.downloadingInvoiceZip.set(true);
    this.pos.downloadInvoiceZip(invoiceId).subscribe({
      next: blob => {
        this.triggerDownload(blob, `${invoiceNumber}.zip`);
        this.downloadingInvoiceZip.set(false);
      },
      error: () => {
        this.downloadingInvoiceZip.set(false);
        this.notify.error('No fue posible descargar el ZIP de la factura');
      },
    });
  }

  markInvoicePaid(sale: PosSale) {
    const invoice = sale.invoice;
    if (!invoice?.id) return;
    this.pos.markInvoicePaid(invoice.id).subscribe({
      next: (updated: any) => {
        this.notify.success('Factura marcada como pagada');
        this.patchSaleInvoice(sale, updated?.data ?? updated ?? { status: 'PAID' });
        if (this.showHistory()) this.loadSessionSales();
        this.refreshInvoiceContext(sale);
      },
      error: (err: any) => this.notify.error(err?.error?.message ?? 'Error al marcar la factura como pagada'),
    });
  }

  canMarkInvoicePaid(): boolean {
    const status = this.selectedInvoiceDetail()?.status ?? this.selectedInvoiceSale()?.invoice?.status;
    return !!status && !['PAID', 'CANCELLED'].includes(status);
  }

  copyText(text?: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => this.notify.success('Copiado al portapapeles'),
      () => this.notify.error('No se pudo copiar el valor'),
    );
  }
  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = Object.assign(document.createElement('a'), { href: url, download: filename });
    anchor.click();
    URL.revokeObjectURL(url);
  }

  dianCodeDesc(code?: string): string {
    return ({
      '00': 'Procesado correctamente',
      '0': 'Procesado correctamente',
      '66': 'NSU no encontrado',
      '90': 'TrackId no encontrado',
      '99': 'Errores de validación',
    } as Record<string, string>)[code ?? ''] ?? '';
  }

  openAddPaymentModal(sale: PosSale) {
    this.selectedAdvanceSale.set(sale);
    this.addPaymentAmount = Number(sale.remainingAmount);
    this.addPaymentMethod = 'CASH';
    this.addPaymentLines = [this.buildPaymentLine('CASH', Number(sale.remainingAmount))];
    this.addPaymentNotes = '';
    this.showAddPaymentModal.set(true);
  }

  addAdvancePaymentLine() {
    this.addPaymentLines = [...this.addPaymentLines, this.buildPaymentLine('DATAPHONE', 0)];
  }

  updateAdvancePaymentLine(index: number, patch: Partial<EditablePaymentLine>) {
    this.addPaymentLines = this.addPaymentLines.map((line, idx) =>
      idx === index
        ? {
            ...line,
            ...patch,
            amount:
              patch.amount !== undefined
                ? Math.max(0, Number(patch.amount || 0))
                : line.amount,
          }
        : line,
    );
    this.addPaymentAmount = this.addPaymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    this.addPaymentMethod = this.addPaymentLines.length === 1 ? this.addPaymentLines[0].paymentMethod : 'MIXED';
  }

  removeAdvancePaymentLine(index: number) {
    this.addPaymentLines = this.addPaymentLines.filter((_, idx) => idx !== index);
    if (this.addPaymentLines.length === 0) {
      this.addPaymentLines = [this.buildPaymentLine('CASH', 0)];
    }
    this.addPaymentAmount = this.addPaymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    this.addPaymentMethod = this.addPaymentLines.length === 1 ? this.addPaymentLines[0].paymentMethod : 'MIXED';
  }

  submitAddPayment() {
    const sale = this.selectedAdvanceSale();
    const payments = this.addPaymentLines
      .filter((line) => Number(line.amount || 0) > 0)
      .map((line) => ({
        paymentMethod: line.paymentMethod,
        amount: Number(line.amount),
        transactionReference: line.transactionReference?.trim() || undefined,
        providerName: line.providerName?.trim() || undefined,
        notes: line.notes?.trim() || undefined,
      }));
    if (!sale || payments.length === 0) return;
    this.addPaymentAmount = payments.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    this.addPaymentMethod = payments.length === 1 ? payments[0].paymentMethod : 'MIXED';
    this.processingAdvance.set(true);
    this.pos.addPayment(sale.id, { amountPaid: this.addPaymentAmount, paymentMethod: this.addPaymentMethod, payments, notes: this.addPaymentNotes || undefined }).subscribe({
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

  openDispatchModal(sale: PosSale) {
    this.selectedAdvanceSale.set(sale);
    this.dispatchNotes = sale.dispatchNotes || '';
    this.showDispatchModal.set(true);
  }

  submitDispatch() {
    const sale = this.selectedAdvanceSale();
    if (!sale) return;
    this.processingAdvance.set(true);
    this.pos.dispatchSale(sale.id, { notes: this.dispatchNotes || undefined }).subscribe({
      next: () => {
        this.processingAdvance.set(false);
        this.showDispatchModal.set(false);
        this.notify.success('Pedido despachado');
        this.loadSessionSales();
      },
      error: (err: any) => {
        this.processingAdvance.set(false);
        this.notify.error(err?.error?.message ?? 'Error al despachar el pedido');
      },
    });
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
    this.paymentLines.set([]);
    this.selectedPaymentMethod.set('CASH');
    this.selectedOrderType.set('IN_STORE');
    this.scheduledAt = '';
    this.orderReference = '';
    this.deliveryAddress = '';
    this.deliveryContactName = '';
    this.deliveryContactPhone = '';
    this.isAdvancePayment.set(false);
    setTimeout(() => this.productSearchInputRef?.nativeElement?.focus(), 100);
    this.cdr.markForCheck();
  }

  getPaymentLabel(m: string): string { return this.paymentMethods.find(x => x.value === m)?.label ?? m; }
  getPostSaleReasonLabel(reason: string): string {
    return ({
      DEFECTIVE_PRODUCT: 'Producto defectuoso',
      WRONG_PRODUCT: 'Producto incorrecto',
      CUSTOMER_DISSATISFACTION: 'Inconformidad del cliente',
      BILLING_ERROR: 'Error de facturación',
      WARRANTY: 'Garantía',
      OTHER: 'Otro',
    } as Record<string, string>)[reason] ?? reason;
  }
  getPostSaleStatusLabel(status: string): string {
    return ({
      PENDING_APPROVAL: 'Pendiente',
      APPROVED: 'Aprobada',
      REJECTED: 'Rechazada',
    } as Record<string, string>)[status] ?? status;
  }
  getPaymentHint(m: string): string {
    return ({
      CASH: 'Pago inmediato con cambio',
      CARD: 'Tarjeta tradicional',
      TRANSFER: 'Confirmar transferencia',
      DATAPHONE: 'Terminal bancaria presencial',
      WALLET: 'Nequi, Daviplata o similar',
      VOUCHER: 'Vale o bono corporativo',
      GIFT_CARD: 'Tarjeta regalo',
      AGREEMENT: 'Cobro a convenio o cuenta cliente',
      MIXED: 'Combina varios medios',
    } as Record<string, string>)[m] ?? 'Seleccionar medio de pago';
  }
  getPaymentMethodSummary(sale: PosSale): string {
    if (!sale.payments?.length) return this.getPaymentLabel(sale.paymentMethod);
    if (sale.payments.length === 1) return this.getPaymentLabel(sale.payments[0].paymentMethod);
    return sale.payments.map((payment) => this.getPaymentLabel(payment.paymentMethod)).join(' + ');
  }
  getOrderTypeLabel(type: string): string {
    return ({
      IN_STORE: 'Mostrador',
      PICKUP: 'Recoger',
      DELIVERY: 'Domicilio',
      LAYAWAY: 'Apartado',
      PREORDER: 'Preorden',
    } as Record<string, string>)[type] ?? type;
  }
  getOrderStatusLabel(status: string): string {
    return ({
      OPEN: 'Pendiente',
      READY: 'Listo',
      IN_TRANSIT: 'En ruta',
      CLOSED: 'Cerrado',
      CANCELLED: 'Cancelado',
    } as Record<string, string>)[status] ?? status;
  }
  getAppliedComboNames(preview: PosPricingPreview): string {
    return preview.appliedCombos.map((combo) => combo.comboName).join(', ');
  }
  getDefaultPriceListName(): string {
    return this.priceLists().find((priceList) => priceList.isDefault)?.name || 'Sin tarifa por defecto';
  }
  hasCashPayment(sale: PosSale | null | undefined): boolean {
    if (!sale) return false;
    return sale.payments?.some((payment) => payment.paymentMethod === 'CASH') || sale.paymentMethod === 'CASH';
  }
  getPaymentClass(method: string): string {
    return `pm-${method.toLowerCase().replace(/_/g, '-')}`;
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
