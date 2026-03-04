import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature { id?: string; key: string; label: string; value: string; }
interface Plan { id: string; name: string; displayName: string; description: string; price: number; currency: string; isActive: boolean; isCustom: boolean; createdAt: string; features: PlanFeature[]; _count?: { subscriptions: number }; }

const FEATURE_DEFAULTS: PlanFeature[] = [
  { key:'max_documents_per_month', label:'Documentos / mes',   value:'100' },
  { key:'max_products',            label:'Productos',           value:'500' },
  { key:'max_users',               label:'Usuarios',            value:'5' },
  { key:'max_integrations',        label:'Integraciones',       value:'2' },
  { key:'storage_months',          label:'Historial (meses)',   value:'12' },
  { key:'has_inventory',           label:'Inventario',          value:'true' },
  { key:'has_reports',             label:'Reportes',            value:'true' },
  { key:'has_integrations',        label:'Integraciones',       value:'false' },
  { key:'bulk_import',             label:'Importación masiva',  value:'false' },
  { key:'dian_enabled',            label:'Facturación DIAN',    value:'false' },
];
const BOOL_KEYS = ['has_inventory','has_reports','has_integrations','bulk_import','dian_enabled'];

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
        <button class="btn btn-primary" (click)="openCreate()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          Nuevo Plan
        </button>
      </div>

      @if (loading()) {
        <div class="plans-grid">
          @for (i of [1,2,3]; track i) {
            <div class="plan-card">
              <div class="sk sk-line" style="width:60%;height:18px;margin-bottom:8px"></div>
              <div class="sk sk-line" style="width:40%;height:12px;margin-bottom:14px"></div>
              <div class="sk sk-line" style="width:80%;height:11px;margin-bottom:6px"></div>
              <div class="sk sk-line" style="width:70%;height:11px;margin-bottom:6px"></div>
              <div class="sk sk-line" style="width:90%;height:11px"></div>
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
                <span class="type-badge" [class.custom-badge]="plan.isCustom">{{ plan.isCustom ? 'Custom' : 'Estándar' }}</span>
              </div>

              <div class="plan-price">
                <span class="price-val">{{ plan.price | currency:(plan.currency || 'COP'):'symbol':'1.0-0' }}</span>
                <span class="price-period">/ mes</span>
              </div>

              @if (plan.description) { <p class="plan-desc">{{ plan.description }}</p> }

              <div class="plan-features">
                @for (feat of plan.features.slice(0,5); track feat.key) {
                  <div class="feat-row">
                    <span class="feat-label">{{ feat.label || feat.key }}</span>
                    <span class="feat-val" [class.feat-true]="feat.value==='true'" [class.feat-false]="feat.value==='false'">
                      @if (feat.value === 'true') { ✓ }
                      @else if (feat.value === 'false') { ✗ }
                      @else { {{ feat.value === '-1' ? '∞' : feat.value }} }
                    </span>
                  </div>
                }
                @if (plan.features.length > 5) { <div class="feat-more">+{{ plan.features.length - 5 }} más</div> }
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

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ isNew() ? 'Nuevo Plan' : 'Editar Plan' }}</h3>
            <button class="modal-close" (click)="closeModal()">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <!-- Info básica -->
              <div class="form-section">
                <div class="section-title">Información General</div>
                <label class="form-label">Nombre interno (slug) *</label>
                <input type="text" [(ngModel)]="form.name" placeholder="BASICO" class="form-control" [disabled]="!isNew()" (input)="form.name = form.name.toUpperCase()"/>
                <p class="form-hint">Solo mayúsculas y guiones bajos.</p>
                <label class="form-label">Nombre visible *</label>
                <input type="text" [(ngModel)]="form.displayName" placeholder="Plan Básico" class="form-control"/>
                <label class="form-label">Descripción</label>
                <textarea [(ngModel)]="form.description" placeholder="Descripción breve..." class="form-control" rows="2"></textarea>
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

              <!-- Features -->
              <div class="form-section">
                <div class="section-title">Límites y Features</div>
                <div class="features-grid">
                  @for (feat of form.features; track feat.key) {
                    <div class="feat-editor">
                      <div class="feat-editor-label">{{ feat.label || feat.key }}</div>
                      @if (isBoolKey(feat.key)) {
                        <select [(ngModel)]="feat.value" class="form-control feat-input">
                          <option value="true">✓ Sí</option>
                          <option value="false">✗ No</option>
                        </select>
                      } @else {
                        <input type="text" [(ngModel)]="feat.value" class="form-control feat-input" placeholder="-1 = ilimitado"/>
                      }
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (isNew() ? 'Crear Plan' : 'Guardar') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { max-width: 1200px; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }
    .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; font-size:13.5px; font-weight:600; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:#1a407e; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#133265; }
    .btn-primary:disabled { opacity:.6; cursor:default; }
    .btn-secondary { background:#f0f4f9; color:#374151; border:1px solid #dce6f0; }
    .btn-secondary:hover { background:#e8eef8; }

    /* Plans grid */
    .plans-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:16px; }
    .plan-card { background:#fff; border:1px solid #dce6f0; border-radius:14px; padding:18px; position:relative; overflow:hidden; transition:box-shadow .15s, transform .15s; }
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
    .plan-features { border-top:1px solid #f0f4f8; padding-top:10px; margin-bottom:12px; }
    .feat-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; font-size:12.5px; }
    .feat-label { color:#64748b; }
    .feat-val { font-weight:600; color:#334155; font-size:12px; }
    .feat-true { color:#10b981; }
    .feat-false { color:#ef4444; }
    .feat-more { font-size:11px; color:#94a3b8; margin-top:4px; text-align:right; }
    .plan-footer { display:flex; align-items:center; justify-content:space-between; }
    .plan-subs { display:flex; align-items:center; gap:5px; font-size:12px; color:#64748b; }
    .plan-actions-row { display:flex; gap:6px; }
    .btn-icon { width:30px; height:30px; border-radius:7px; border:1px solid #dce6f0; background:#f8fafc; color:#475569; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
    .btn-icon:hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-icon-warn:hover { background:#f59e0b; border-color:#f59e0b; color:#fff; }

    /* Skeleton */
    .sk { background:linear-gradient(90deg,#f0f4f8 25%,#e8eef8 50%,#f0f4f8 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:6px; display:block; margin-bottom:6px; }
    @keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; background:rgba(12,28,53,.55); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; backdrop-filter:blur(2px); }
    .modal { background:#fff; border-radius:16px; width:100%; max-width:820px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(12,28,53,.25); }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 22px; border-bottom:1px solid #f0f4f8; flex-shrink:0; }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f8; }
    .modal-body { flex:1; overflow-y:auto; padding:18px 22px; }
    .modal-footer { padding:14px 22px; border-top:1px solid #f0f4f8; display:flex; justify-content:flex-end; gap:10px; flex-shrink:0; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
    .section-title { font-size:11px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:.08em; margin-bottom:12px; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:4px; }
    .form-hint { font-size:11px; color:#94a3b8; margin:2px 0 10px; }
    .form-control { width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px; font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box; outline:none; margin-bottom:10px; }
    .form-control:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,.08); }
    .form-control:disabled { background:#f8fafc; color:#94a3b8; }
    textarea.form-control { resize:vertical; min-height:56px; }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .check-row { display:flex; gap:14px; margin-top:4px; }
    .check-label { display:flex; align-items:center; gap:6px; font-size:13px; color:#475569; cursor:pointer; }
    .features-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .feat-editor-label { font-size:11.5px; font-weight:600; color:#475569; margin-bottom:3px; }
    .feat-input { margin-bottom:0 !important; }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 768px) {
      .page-header { flex-direction:column; align-items:stretch; }
      .page-header .btn { width:100%; justify-content:center; }
      .plans-grid { grid-template-columns:1fr 1fr; gap:12px; }
    }
    @media (max-width: 640px) {
      .plans-grid { grid-template-columns:1fr; }
      .modal-overlay { align-items:flex-end; padding:0; }
      .modal { border-radius:20px 20px 0 0; max-height:95dvh; max-width:100%; }
      .form-grid { grid-template-columns:1fr; }
      .features-grid { grid-template-columns:1fr; }
      .modal-footer { flex-direction:column-reverse; gap:8px; }
      .modal-footer .btn { width:100%; justify-content:center; }
    }
    @media (max-width: 400px) {
      .form-row-2 { grid-template-columns:1fr; }
    }
  `],
})
export class SaPlansComponent implements OnInit {
  plans = signal<Plan[]>([]);
  loading = signal(true);
  saving = signal(false);
  showModal = signal(false);
  editId = signal<string | null>(null);
  form = this.emptyForm();
  isNew = computed(() => !this.editId());
  private readonly api = `${environment.apiUrl}/super-admin`;

  constructor(private http: HttpClient, private notify: NotificationService) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Plan[]>(`${this.api}/plans`).subscribe({
      next: d => { this.plans.set(d); this.loading.set(false); },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar planes'); }
    });
  }

  openCreate() { this.editId.set(null); this.form = this.emptyForm(); this.showModal.set(true); }
  openEdit(plan: Plan) {
    this.editId.set(plan.id);
    this.form = { name:plan.name, displayName:plan.displayName, description:plan.description??'', price:plan.price, currency:plan.currency??'COP', isActive:plan.isActive, isCustom:plan.isCustom,
      features: FEATURE_DEFAULTS.map(def => { const e = plan.features.find(f => f.key===def.key); return { key:def.key, label:def.label, value:e?.value??def.value }; }) };
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name || !this.form.displayName || this.form.price == null) { this.notify.error('Completa los campos obligatorios'); return; }
    this.saving.set(true);
    const req = this.isNew() ? this.http.post<Plan>(`${this.api}/plans`, this.form) : this.http.put<Plan>(`${this.api}/plans/${this.editId()}`, this.form);
    req.subscribe({
      next: () => { this.saving.set(false); this.closeModal(); this.notify.success(this.isNew() ? 'Plan creado' : 'Plan actualizado'); this.load(); },
      error: e => { this.saving.set(false); this.notify.error(e?.error?.message ?? 'Error'); }
    });
  }

  toggleActive(plan: Plan) {
    this.http.put(`${this.api}/plans/${plan.id}`, { ...plan, isActive: !plan.isActive, features: plan.features }).subscribe({
      next: () => { this.notify.success(plan.isActive ? 'Plan desactivado' : 'Plan activado'); this.load(); },
      error: () => this.notify.error('Error al cambiar estado')
    });
  }

  isBoolKey(key: string) { return BOOL_KEYS.includes(key); }
  private emptyForm() { return { name:'', displayName:'', description:'', price:0, currency:'COP', isActive:true, isCustom:false, features: FEATURE_DEFAULTS.map(f => ({...f})) }; }
}