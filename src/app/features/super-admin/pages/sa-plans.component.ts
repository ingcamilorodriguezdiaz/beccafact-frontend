import { Component, HostListener, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature { id?: string; key: string; label: string; value: string; }
interface Plan {
  id: string; name: string; displayName: string; description: string;
  price: number; currency: string; isActive: boolean; isCustom: boolean;
  createdAt: string; features: PlanFeature[];
  _count?: { subscriptions: number };
}

// Contrato del catálogo — espejo del tipo en el backend
interface FeatureDef {
  key: string; label: string; description: string;
  type: 'bool' | 'number' | 'months';
  defaultValue: string; icon: string;
  group: 'limits' | 'modules' | 'support';
  numberHint?: string;
}

const GROUPS: { id: 'limits' | 'modules' | 'support'; label: string }[] = [
  { id: 'limits',  label: 'Límites'  },
  { id: 'modules', label: 'Módulos'  },
  { id: 'support', label: 'Soporte'  },
];

// Keys prioritarias para las cards (no cambian con el catálogo)
const CARD_PRIORITY = [
  'max_documents_per_month', 'max_users', 'max_products',
  'has_invoices', 'has_inventory', 'has_reports', 'dian_enabled',
  'has_accounting', 'has_purchasing', 'priority_support',
];

@Component({
  selector: 'app-sa-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">
      <div class="page-header">
        <div>
          <h2 class="page-title">Gestión de Planes</h2>
          <p class="page-subtitle">{{ plans().length }} planes configurados</p>
        </div>
        <button class="btn btn-primary" (click)="openCreate()" [disabled]="loadingCatalog()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          {{ loadingCatalog() ? 'Cargando...' : 'Nuevo Plan' }}
        </button>
      </div>

      <!-- ── Plan cards ─────────────────────────────────────── -->
      @if (loading()) {
        <div class="plans-grid">
          @for (i of [1,2,3]; track i) {
            <div class="plan-card">
              <div class="sk" style="width:60%;height:18px;margin-bottom:8px"></div>
              <div class="sk" style="width:40%;height:12px;margin-bottom:14px"></div>
              <div class="sk" style="width:80%;height:11px;margin-bottom:6px"></div>
              <div class="sk" style="width:70%;height:11px;margin-bottom:6px"></div>
              <div class="sk" style="width:90%;height:11px"></div>
            </div>
          }
        </div>
      } @else {
        <div class="plans-grid">
          @for (plan of plans(); track plan.id) {
            <div class="plan-card" [class.plan-inactive]="!plan.isActive">
              @if (!plan.isActive) { <div class="inactive-ribbon">INACTIVO</div> }

              <div class="plan-card-header">
                <div>
                  <div class="plan-name">{{ plan.displayName }}</div>
                  <code class="plan-slug">{{ plan.name }}</code>
                </div>
                <span class="type-badge" [class.custom-badge]="plan.isCustom">
                  {{ plan.isCustom ? 'Custom' : 'Estándar' }}
                </span>
              </div>

              <div class="plan-price">
                <span class="price-val">{{ plan.price | currency:(plan.currency || 'COP'):'symbol':'1.0-0' }}</span>
                <span class="price-period">/ mes</span>
              </div>

              @if (plan.description) { <p class="plan-desc">{{ plan.description }}</p> }

              <div class="plan-features">
                @for (feat of cardFeatures(plan); track feat.key) {
                  <div class="feat-row">
                    <div class="feat-row-left">
                      @if (featDef(feat.key); as def) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13" class="feat-icon">
                          <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="def.icon"/>
                        </svg>
                        <span class="feat-label">{{ def.label }}</span>
                      } @else {
                        <span class="feat-label">{{ feat.label || feat.key }}</span>
                      }
                    </div>
                    <span class="feat-val">
                      @if (feat.value === 'true')        { <span class="feat-check">✓</span> }
                      @else if (feat.value === 'false')  { <span class="feat-x">✗</span> }
                      @else {
                        {{ feat.value === '-1' ? '∞' : feat.value }}{{ featDef(feat.key)?.type === 'months' ? ' meses' : '' }}
                      }
                    </span>
                  </div>
                }
                @if (plan.features.length > 6) {
                  <div class="feat-more">+{{ plan.features.length - 6 }} características más</div>
                }
              </div>

              <div class="plan-footer">
                <div class="plan-subs">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>
                  {{ plan._count?.subscriptions ?? 0 }} suscripciones
                </div>
                <div class="plan-actions-row">
                  <button class="btn-icon" (click)="openEdit(plan)" title="Editar">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                  </button>
                  <button class="btn-icon btn-icon-warn" (click)="toggleActive(plan)" [title]="plan.isActive ? 'Desactivar' : 'Activar'">
                    @if (plan.isActive) {
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524L13.477 14.89zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
                    } @else {
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- ════════════════════════════════════
         MODAL CREAR / EDITAR PLAN
         ════════════════════════════════════ -->
    @if (showModal()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal" (click)="$event.stopPropagation()">

          <div class="modal-header">
            <h3>{{ isNew() ? 'Nuevo Plan' : 'Editar Plan' }}</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-grid">

              <!-- ── Info básica ──────────────────────────────── -->
              <div class="form-section">
                <div class="section-title">Información general</div>

                <label class="form-label">Nombre interno (slug) *</label>
                <input type="text" [(ngModel)]="form.name" placeholder="BASICO" class="form-control"
                       [disabled]="!isNew()" (input)="form.name = form.name.toUpperCase()"/>
                <p class="form-hint">Solo mayúsculas y guiones bajos. No se puede cambiar.</p>

                <label class="form-label">Nombre visible *</label>
                <input type="text" [(ngModel)]="form.displayName" placeholder="Plan Básico" class="form-control"/>

                <label class="form-label">Descripción</label>
                <textarea [(ngModel)]="form.description" placeholder="Descripción breve del plan..."
                          class="form-control" rows="2"></textarea>

                <div class="form-row-2">
                  <div>
                    <label class="form-label">Precio *</label>
                    <input type="number" [(ngModel)]="form.price" placeholder="0" class="form-control" min="0"/>
                  </div>
                  <div>
                    <label class="form-label">Moneda</label>
                    <select [(ngModel)]="form.currency" class="form-control">
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div class="check-row">
                  <label class="check-label"><input type="checkbox" [(ngModel)]="form.isActive"/> Plan activo</label>
                  <label class="check-label"><input type="checkbox" [(ngModel)]="form.isCustom"/> Personalizado</label>
                </div>
              </div>

              <!-- ── Features dinámicas ──────────────────────── -->
              <div class="form-section">
                <div class="section-title">Límites y características</div>

                <!-- Tabs por grupo -->
                <div class="feature-tabs">
                  @for (g of groups; track g.id) {
                    <button class="feature-tab" [class.active]="activeGroup() === g.id"
                            (click)="activeGroup.set(g.id)">
                      {{ g.label }}
                      <span class="tab-count">{{ groupCount(g.id) }}</span>
                    </button>
                  }
                </div>

                <!-- Lista de features del grupo activo -->
                <div class="features-list">
                  @for (feat of groupFeatures(activeGroup()); track feat.key) {
                    @if (featDef(feat.key); as def) {
                      <div class="feat-editor-row">
                        <div class="feat-editor-info">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                               width="16" height="16" class="feat-editor-icon">
                            <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="def.icon"/>
                          </svg>
                          <div>
                            <div class="feat-editor-label">{{ def.label }}</div>
                            <div class="feat-editor-desc">{{ def.description }}</div>
                          </div>
                        </div>
                        <div class="feat-editor-control">
                          @if (def.type === 'bool') {
                            <label class="toggle">
                              <input type="checkbox"
                                     [checked]="feat.value === 'true'"
                                     (change)="feat.value = $any($event.target).checked ? 'true' : 'false'"/>
                              <span class="toggle-slider"></span>
                            </label>
                          } @else {
                            <div class="num-input-wrap">
                              <input type="number" [(ngModel)]="feat.value"
                                     class="form-control num-input"
                                     [placeholder]="def.numberHint ?? '0'"/>
                              @if (def.type === 'months') {
                                <span class="num-unit">meses</span>
                              }
                            </div>
                            <div class="feat-hint">-1 = ilimitado</div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Features custom (no en catálogo) -->
                @if (customFeatures().length) {
                  <div class="custom-features-section">
                    <div class="custom-features-title">Características personalizadas</div>
                    @for (feat of customFeatures(); track feat.key) {
                      <div class="feat-editor-row feat-custom-row">
                        <div class="feat-editor-info">
                          <svg viewBox="0 0 20 20" fill="currentColor" width="14" class="feat-editor-icon"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
                          <div>
                            <div class="feat-editor-label">{{ feat.label || feat.key }}</div>
                            <code class="feat-key-code">{{ feat.key }}</code>
                          </div>
                        </div>
                        <div class="feat-editor-control">
                          <input type="text" [(ngModel)]="feat.value" class="form-control num-input"/>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (isNew() ? 'Crear Plan' : 'Guardar cambios') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1200px; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .animate-in { animation: fadeUp .25s ease; }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#133265; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }

    /* ── Plan cards ────────────────────────────────────────── */
    .plans-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:16px; }
    .plan-card { background:#fff; border:1px solid #dce6f0; border-radius:14px; padding:18px; position:relative; overflow:hidden; transition:box-shadow .15s, transform .15s; display:flex; flex-direction:column; }
    .plan-card:hover { box-shadow:0 4px 20px rgba(12,28,53,.1); transform:translateY(-1px); }
    .plan-inactive { opacity:.55; }
    .inactive-ribbon { position:absolute; top:10px; left:50%; transform:translateX(-50%); background:#ef4444; color:#fff; font-size:9px; font-weight:800; letter-spacing:.12em; padding:2px 8px; border-radius:99px; }
    .plan-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:10px; gap:8px; }
    .plan-name { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; }
    .plan-slug { font-size:11px; color:#94a3b8; background:#f0f4f9; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block; }
    .type-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; background:#f0f4f9; color:#64748b; flex-shrink:0; }
    .custom-badge { background:rgba(26,64,126,0.1); color:#1a407e; }
    .plan-price { margin-bottom:8px; }
    .price-val { font-family:'Sora',sans-serif; font-size:24px; font-weight:800; color:#0c1c35; }
    .price-period { font-size:12px; color:#94a3b8; margin-left:4px; }
    .plan-desc { font-size:12.5px; color:#64748b; margin:0 0 10px; line-height:1.5; }

    /* Features en card */
    .plan-features { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px; flex:1; }
    .feat-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; gap:8px; }
    .feat-row-left { display:flex; align-items:center; gap:5px; min-width:0; flex:1; }
    .feat-icon { color:#94a3b8; flex-shrink:0; }
    .feat-label { font-size:12.5px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .feat-val { font-weight:600; font-size:12px; color:#334155; flex-shrink:0; }
    .feat-check { color:#10b981; font-size:13px; }
    .feat-x     { color:#ef4444; font-size:13px; }
    .feat-more  { font-size:11px; color:#94a3b8; margin-top:6px; text-align:right; font-style:italic; }

    .plan-footer { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #f0f4f8; padding-top:12px; margin-top:auto; }
    .plan-subs { display:flex; align-items:center; gap:5px; font-size:12px; color:#64748b; }
    .plan-actions-row { display:flex; gap:6px; }
    .btn-icon { width:30px; height:30px; border-radius:7px; border:1px solid #dce6f0; background:#f8fafc; color:#475569; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .btn-icon:hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-icon-warn:hover { background:#f59e0b; border-color:#f59e0b; color:#fff; }

    /* Skeleton */
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; display:block; margin-bottom:6px; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    /* ── Modal ─────────────────────────────────────────────── */
    .modal-overlay { position:fixed; inset:0; width:100vw; height:100dvh; background:rgba(12,28,53,.58); display:flex; align-items:center; justify-content:center; z-index:5000; padding:24px; backdrop-filter:blur(4px); }
    .modal { background:#fff; border-radius:18px; width:min(960px, 100%); max-height:min(92dvh, 920px); display:flex; flex-direction:column; box-shadow:0 28px 80px rgba(12,28,53,.28); overflow:hidden; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body { flex:1; overflow-y:auto; padding:18px 22px; }
    .modal-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; justify-content:flex-end; gap:10px; flex-shrink:0; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
    .form-section { display:flex; flex-direction:column; }
    .section-title { font-size:11px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.08em; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid #f0f4f8; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-hint { font-size:11px; color:#94a3b8; margin:2px 0 10px; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; margin-bottom:10px; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control:disabled { background:#f8fafc; color:#94a3b8; }
    textarea.form-control { resize:vertical; min-height:56px; }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .check-row { display:flex; gap:14px; margin-top:4px; }
    .check-label { display:flex; align-items:center; gap:6px; font-size:13px; color:#475569; cursor:pointer; }

    /* ── Feature tabs ─────────────────────────────────────── */
    .feature-tabs { display:flex; gap:3px; margin-bottom:14px; background:#f8fafc; border:1px solid #dce6f0; border-radius:9px; padding:3px; }
    .feature-tab { flex:1; padding:6px 8px; border:none; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; background:transparent; color:#64748b; transition:all .15s; display:flex; align-items:center; justify-content:center; gap:5px; }
    .feature-tab:hover { background:#fff; color:#1a407e; }
    .feature-tab.active { background:#fff; color:#1a407e; box-shadow:0 1px 4px rgba(0,0,0,.1); }
    .tab-count { background:#e8eef8; color:#1a407e; font-size:10px; font-weight:700; padding:1px 5px; border-radius:99px; }
    .feature-tab.active .tab-count { background:#1a407e; color:#fff; }

    /* ── Feature editor ───────────────────────────────────── */
    .features-list { display:flex; flex-direction:column; gap:1px; overflow-y:auto; max-height:320px; padding-right:2px; }
    .feat-editor-row { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-radius:8px; gap:12px; transition:background .1s; }
    .feat-editor-row:hover { background:#f8fafc; }
    .feat-editor-info { display:flex; align-items:flex-start; gap:8px; flex:1; min-width:0; }
    .feat-editor-icon { color:#94a3b8; flex-shrink:0; margin-top:1px; }
    .feat-editor-label { font-size:13px; font-weight:600; color:#0c1c35; line-height:1.3; }
    .feat-editor-desc  { font-size:11px; color:#94a3b8; margin-top:1px; line-height:1.3; }
    .feat-editor-control { display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0; }

    /* Toggle switch */
    .toggle { position:relative; display:inline-block; width:38px; height:22px; cursor:pointer; flex-shrink:0; }
    .toggle input { opacity:0; width:0; height:0; }
    .toggle-slider { position:absolute; inset:0; background:#dce6f0; border-radius:99px; transition:.2s; }
    .toggle-slider:before { content:''; position:absolute; width:16px; height:16px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:.2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .toggle input:checked + .toggle-slider { background:#1a407e; }
    .toggle input:checked + .toggle-slider:before { transform:translateX(16px); }

    /* Numeric input */
    .num-input-wrap { display:flex; align-items:center; gap:4px; }
    .num-input { width:82px; margin-bottom:0 !important; padding:5px 8px !important; text-align:right; }
    .num-unit { font-size:11.5px; color:#64748b; white-space:nowrap; }
    .feat-hint { font-size:10.5px; color:#94a3b8; }

    /* Custom features */
    .custom-features-section { margin-top:12px; border-top:1px solid #f0f4f8; padding-top:10px; }
    .custom-features-title { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .feat-custom-row { border:1px dashed #dce6f0; border-radius:8px; }
    .feat-key-code { font-size:10px; color:#94a3b8; }

    /* ── Responsive ────────────────────────────────────────── */
    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:stretch; }
      .page-header .btn { width:100%; justify-content:center; }
      .plans-grid { grid-template-columns:1fr 1fr; gap:12px; }
    }
    @media (max-width: 640px) {
      .plans-grid { grid-template-columns:1fr; }
      .modal-overlay { align-items:center; justify-content:center; padding:16px; }
      .modal { border-radius:18px; width:100%; max-height:92dvh; max-width:100%; }
      .form-grid { grid-template-columns:1fr; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
      .features-list { max-height:260px; }
    }
    @media (max-width: 400px) {
      .form-row-2 { grid-template-columns:1fr; }
      .num-input { width:64px; }
    }
  `],
})
export class SaPlansComponent implements OnInit {
  plans        = signal<Plan[]>([]);
  catalog      = signal<FeatureDef[]>([]);
  catalogMap   = computed(() => new Map(this.catalog().map(f => [f.key, f])));
  loading      = signal(true);
  loadingCatalog = signal(true);
  saving       = signal(false);
  showModal    = signal(false);
  editId       = signal<string | null>(null);
  activeGroup  = signal<'limits' | 'modules' | 'support'>('limits');

  form = this.emptyForm();
  isNew = computed(() => !this.editId());

  readonly groups = GROUPS;

  private readonly plansApi   = `${environment.apiUrl}/super-admin`;
  private readonly catalogApi = `${environment.apiUrl}/plans/feature-catalog`;

  constructor(private http: HttpClient, private notify: NotificationService) {}

  ngOnInit() {
    // Cargar catálogo y planes en paralelo
    this.loadCatalog();
    this.load();
  }

  loadCatalog() {
    this.loadingCatalog.set(true);
    this.http.get<FeatureDef[]>(this.catalogApi).subscribe({
      next: catalog => {
        this.catalog.set(catalog);
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.loadingCatalog.set(false);
        this.notify.error('Error al cargar catálogo de features');
      },
    });
  }

  load() {
    this.loading.set(true);
    this.http.get<any>(`${this.plansApi}/plans`).subscribe({
      next: d => { this.plans.set(d.data ?? d); this.loading.set(false); },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar planes'); },
    });
  }

  openCreate() {
    this.editId.set(null);
    this.activeGroup.set('limits');
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  openEdit(plan: Plan) {
    this.editId.set(plan.id);
    this.activeGroup.set('limits');
    const map = this.catalogMap();
    // Mapear cada key del catálogo al valor almacenado en BD (o default)
    const features = this.catalog().map(def => {
      const existing = plan.features.find(f => f.key === def.key);
      return { key: def.key, label: def.label, value: existing?.value ?? def.defaultValue };
    });
    // Preservar features custom (keys no presentes en el catálogo)
    plan.features
      .filter(f => !map.has(f.key))
      .forEach(f => features.push({ key: f.key, label: f.label, value: f.value }));

    this.form = {
      name: plan.name, displayName: plan.displayName,
      description: plan.description ?? '', price: plan.price,
      currency: plan.currency ?? 'COP', isActive: plan.isActive,
      isCustom: plan.isCustom, features,
    };
    this.showModal.set(true);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    // Escape no cierra los modales — solo el botón X
  }

    closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name || !this.form.displayName || this.form.price == null) {
      this.notify.error('Completa los campos obligatorios'); return;
    }
    this.saving.set(true);
    const req = this.isNew()
      ? this.http.post<Plan>(`${this.plansApi}/plans`, this.form)
      : this.http.put<Plan>(`${this.plansApi}/plans/${this.editId()}`, this.form);

    req.subscribe({
      next: () => {
        this.saving.set(false); this.closeModal();
        this.notify.success(this.isNew() ? 'Plan creado' : 'Plan actualizado');
        this.load();
      },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); },
    });
  }

  toggleActive(plan: Plan) {
    this.http.put(`${this.plansApi}/plans/${plan.id}`, { ...plan, isActive: !plan.isActive, features: plan.features }).subscribe({
      next: () => { this.notify.success(plan.isActive ? 'Plan desactivado' : 'Plan activado'); this.load(); },
      error: () => this.notify.error('Error al cambiar estado'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────

  /** Features del form filtradas por grupo */
  groupFeatures(group: string): PlanFeature[] {
    const map = this.catalogMap();
    return this.form.features.filter(f => map.get(f.key)?.group === group);
  }

  /** Features del form que no están en el catálogo */
  customFeatures = computed(() => {
    const map = this.catalogMap();
    return this.form.features.filter(f => !map.has(f.key));
  });

  /** Cantidad de features por grupo */
  groupCount(group: string): number {
    const map = this.catalogMap();
    return this.form.features.filter(f => map.get(f.key)?.group === group).length;
  }

  /** Definición del catálogo para una key */
  featDef(key: string): FeatureDef | undefined { return this.catalogMap().get(key); }

  /** Top 6 features para la card, ordenadas por prioridad */
  cardFeatures(plan: Plan): PlanFeature[] {
    const sorted = [...plan.features].sort((a, b) => {
      const ia = CARD_PRIORITY.indexOf(a.key);
      const ib = CARD_PRIORITY.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return sorted.slice(0, 6);
  }

  private emptyForm() {
    return {
      name: '', displayName: '', description: '',
      price: 0, currency: 'COP', isActive: true, isCustom: false,
      // Al crear, inicializar features desde el catálogo cargado
      features: this.catalog().map(f => ({ key: f.key, label: f.label, value: f.defaultValue })),
    };
  }
}
