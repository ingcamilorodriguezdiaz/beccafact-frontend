import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';

interface PlanFeature {
  id?: string;
  key: string;
  label: string;
  value: string;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  isActive: boolean;
  isCustom: boolean;
  createdAt: string;
  features: PlanFeature[];
  _count?: { subscriptions: number };
}

const FEATURE_DEFAULTS: PlanFeature[] = [
  { key: 'max_documents_per_month', label: 'Documentos / mes', value: '100' },
  { key: 'max_products',            label: 'Productos',          value: '500' },
  { key: 'max_users',               label: 'Usuarios',           value: '5' },
  { key: 'max_integrations',        label: 'Integraciones',      value: '2' },
  { key: 'storage_months',          label: 'Historial (meses)',  value: '12' },
  { key: 'has_inventory',           label: 'Inventario',         value: 'true' },
  { key: 'has_reports',             label: 'Reportes',           value: 'true' },
  { key: 'has_integrations',        label: 'Integraciones',      value: 'false' },
  { key: 'bulk_import',             label: 'Importación masiva', value: 'false' },
  { key: 'dian_enabled',            label: 'Facturación DIAN',   value: 'false' },
];

const BOOL_KEYS = ['has_inventory','has_reports','has_integrations','bulk_import','dian_enabled'];

@Component({
  selector: 'app-sa-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Gestión de Planes</h2>
          <p class="page-subtitle">{{ plans().length }} planes configurados</p>
        </div>
        <button class="btn-primary" (click)="openCreate()" type="button">
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          Nuevo Plan
        </button>
      </div>

      <!-- Plans Grid -->
      @if (loading()) {
        <div class="plans-grid">
          @for (i of [1,2,3]; track i) {
            <div class="plan-card plan-skeleton">
              <div class="sk sk-line" style="width:60%;height:20px;margin-bottom:8px"></div>
              <div class="sk sk-line" style="width:40%;height:14px;margin-bottom:16px"></div>
              <div class="sk sk-line" style="width:80%;height:12px;margin-bottom:6px"></div>
              <div class="sk sk-line" style="width:70%;height:12px;margin-bottom:6px"></div>
              <div class="sk sk-line" style="width:90%;height:12px"></div>
            </div>
          }
        </div>
      } @else {
        <div class="plans-grid">
          @for (plan of plans(); track plan.id) {
            <div class="plan-card" [class.plan-inactive]="!plan.isActive">
              <div class="plan-card-header">
                <div>
                  <div class="plan-name">{{ plan.displayName }}</div>
                  <code class="plan-slug">{{ plan.name }}</code>
                </div>
                <div class="plan-badge" [class.badge-custom]="plan.isCustom">
                  {{ plan.isCustom ? 'Custom' : 'Estándar' }}
                </div>
              </div>

              <div class="plan-price">
                <span class="price-val">{{ plan.price | currency:(plan.currency || 'COP'):'symbol':'1.0-0' }}</span>
                <span class="price-period">/ mes</span>
              </div>

              @if (plan.description) {
                <p class="plan-desc">{{ plan.description }}</p>
              }

              <!-- Features summary -->
              <div class="plan-features">
                @for (feat of plan.features.slice(0,5); track feat.key) {
                  <div class="feat-row">
                    <span class="feat-label">{{ feat.label || feat.key }}</span>
                    <span class="feat-val" [class.feat-bool-true]="feat.value==='true'" [class.feat-bool-false]="feat.value==='false'">
                      @if (feat.value === 'true') { ✓ }
                      @else if (feat.value === 'false') { ✗ }
                      @else { {{ feat.value === '-1' ? '∞' : feat.value }} }
                    </span>
                  </div>
                }
                @if (plan.features.length > 5) {
                  <div class="feat-more">+{{ plan.features.length - 5 }} más</div>
                }
              </div>

              <div class="plan-footer">
                <div class="plan-subs">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="13"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>
                  {{ plan._count?.subscriptions ?? 0 }} suscripciones
                </div>
                <div class="plan-actions">
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

              @if (!plan.isActive) {
                <div class="plan-inactive-overlay">INACTIVO</div>
              }
            </div>
          }
        </div>
      }

      <!-- Modal Overlay -->
      @if (showModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ isNew() ? 'Nuevo Plan' : 'Editar Plan' }}</h3>
              <button class="modal-close" (click)="closeModal()" type="button">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
              </button>
            </div>

            <div class="modal-body">
              <div class="form-grid">
                <!-- Left: General Info -->
                <div class="form-section">
                  <div class="section-title">Información General</div>

                  <label class="form-label">Nombre interno (slug) *</label>
                  <input type="text" [(ngModel)]="form.name" placeholder="BASICO" class="form-input"
                    [disabled]="!isNew()" style="text-transform:uppercase" (input)="form.name = form.name.toUpperCase()"/>
                  <p class="form-hint">Identificador único, solo mayúsculas y guiones bajos.</p>

                  <label class="form-label">Nombre visible *</label>
                  <input type="text" [(ngModel)]="form.displayName" placeholder="Plan Básico" class="form-input"/>

                  <label class="form-label">Descripción</label>
                  <textarea [(ngModel)]="form.description" placeholder="Descripción breve del plan..." class="form-input form-textarea" rows="2"></textarea>

                  <div class="form-row">
                    <div>
                      <label class="form-label">Precio *</label>
                      <input type="number" [(ngModel)]="form.price" placeholder="0" class="form-input" min="0"/>
                    </div>
                    <div>
                      <label class="form-label">Moneda</label>
                      <select [(ngModel)]="form.currency" class="form-input form-select">
                        <option value="COP">COP</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-check-row">
                    <label class="checkbox-label">
                      <input type="checkbox" [(ngModel)]="form.isActive" class="form-check"/>
                      <span>Plan activo</span>
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" [(ngModel)]="form.isCustom" class="form-check"/>
                      <span>Plan personalizado</span>
                    </label>
                  </div>
                </div>

                <!-- Right: Features -->
                <div class="form-section">
                  <div class="section-title">Límites y Features</div>
                  <div class="features-grid">
                    @for (feat of form.features; track feat.key; let i = $index) {
                      <div class="feat-editor">
                        <div class="feat-editor-label">{{ feat.label || feat.key }}</div>
                        @if (isBoolKey(feat.key)) {
                          <select [(ngModel)]="feat.value" class="form-input form-select feat-input">
                            <option value="true">✓ Sí</option>
                            <option value="false">✗ No</option>
                          </select>
                        } @else {
                          <input type="text" [(ngModel)]="feat.value" class="form-input feat-input"
                            placeholder="-1 = ilimitado"/>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-ghost" (click)="closeModal()" type="button">Cancelar</button>
              <button class="btn-primary" (click)="save()" [disabled]="saving()" type="button">
                @if (saving()) {
                  <span class="spinner"></span> Guardando...
                } @else {
                  {{ isNew() ? 'Crear Plan' : 'Guardar Cambios' }}
                }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .page { max-width: 1200px; }
    .animate-in { animation: fadeUp 0.25s ease; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }

    .btn-primary {
      display:inline-flex; align-items:center; gap:7px; padding:9px 18px;
      background:#1a407e; color:#fff; border:none; border-radius:8px;
      font-size:13.5px; font-weight:600; cursor:pointer; transition:background 0.15s;
    }
    .btn-primary:hover { background:#133265; }
    .btn-primary:disabled { opacity:0.6; cursor:default; }
    .btn-ghost {
      padding:9px 18px; background:transparent; border:1px solid #dce6f0;
      color:#475569; border-radius:8px; font-size:13.5px; font-weight:600;
      cursor:pointer; transition:all 0.15s;
    }
    .btn-ghost:hover { background:#f0f4f9; }

    /* Grid */
    .plans-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }

    .plan-card {
      background:#fff; border:1px solid #dce6f0; border-radius:14px;
      padding:20px; position:relative; overflow:hidden;
      transition:box-shadow 0.15s, transform 0.15s;
    }
    .plan-card:hover { box-shadow:0 4px 20px rgba(12,28,53,0.1); transform:translateY(-1px); }
    .plan-card-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }
    .plan-name { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; }
    .plan-slug { font-size:11px; color:#94a3b8; background:#f0f4f9; padding:2px 6px; border-radius:4px; margin-top:3px; display:inline-block; }
    .plan-badge { font-size:10px; font-weight:700; padding:3px 8px; border-radius:6px; background:#f0f4f9; color:#64748b; }
    .badge-custom { background:rgba(26,64,126,0.1); color:#1a407e; }

    .plan-price { margin-bottom:10px; }
    .price-val { font-family:'Sora',sans-serif; font-size:24px; font-weight:800; color:#0c1c35; }
    .price-period { font-size:12px; color:#94a3b8; margin-left:4px; }
    .plan-desc { font-size:12.5px; color:#64748b; margin:0 0 12px; line-height:1.5; }

    .plan-features { border-top:1px solid #f0f4f9; padding-top:12px; margin-bottom:14px; }
    .feat-row { display:flex; justify-content:space-between; align-items:center; padding:3px 0; font-size:12.5px; }
    .feat-label { color:#64748b; }
    .feat-val { font-weight:600; color:#334155; font-size:12px; }
    .feat-bool-true { color:#10b981; }
    .feat-bool-false { color:#ef4444; }
    .feat-more { font-size:11px; color:#94a3b8; margin-top:4px; text-align:right; }

    .plan-footer { display:flex; align-items:center; justify-content:space-between; }
    .plan-subs { display:flex; align-items:center; gap:5px; font-size:12px; color:#64748b; }
    .plan-actions { display:flex; gap:6px; }
    .btn-icon {
      width:30px; height:30px; border-radius:7px; border:1px solid #dce6f0;
      background:#f8fafc; color:#475569; cursor:pointer; display:flex;
      align-items:center; justify-content:center; transition:all 0.15s;
    }
    .btn-icon:hover { background:#1a407e; color:#fff; border-color:#1a407e; }
    .btn-icon-warn:hover { background:#f59e0b; border-color:#f59e0b; color:#fff; }

    .plan-inactive { opacity:0.55; }
    .plan-inactive-overlay {
      position:absolute; top:10px; left:50%; transform:translateX(-50%);
      background:#ef4444; color:#fff; font-size:9px; font-weight:800;
      letter-spacing:0.12em; padding:2px 8px; border-radius:99px;
    }
    .plan-skeleton { min-height:200px; }

    /* Skeleton */
    .sk { background: linear-gradient(90deg,#f0f4f9 25%,#e2e8f0 50%,#f0f4f9 75%); background-size:200%; border-radius:6px; animation:shimmer 1.4s infinite; }
    @keyframes shimmer { from{background-position:200%} to{background-position:-200%} }

    /* Modal */
    .modal-overlay {
      position:fixed; inset:0; background:rgba(12,28,53,0.55);
      display:flex; align-items:center; justify-content:center;
      z-index:1000; padding:20px; backdrop-filter:blur(2px);
    }
    .modal {
      background:#fff; border-radius:16px; width:100%; max-width:820px;
      max-height:90vh; display:flex; flex-direction:column;
      box-shadow:0 20px 60px rgba(12,28,53,0.25);
    }
    .modal-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:18px 24px; border-bottom:1px solid #f0f4f9;
    }
    .modal-header h3 { font-family:'Sora',sans-serif; font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px; border-radius:6px; }
    .modal-close:hover { background:#f0f4f9; color:#475569; }
    .modal-body { flex:1; overflow-y:auto; padding:20px 24px; }
    .modal-footer {
      padding:16px 24px; border-top:1px solid #f0f4f9;
      display:flex; justify-content:flex-end; gap:10px;
    }

    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
    .section-title { font-size:12px; font-weight:700; color:#1a407e; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:14px; }
    .form-label { display:block; font-size:12.5px; font-weight:600; color:#475569; margin-bottom:5px; }
    .form-hint { font-size:11px; color:#94a3b8; margin:3px 0 12px; }
    .form-input {
      width:100%; padding:8px 11px; border:1px solid #dce6f0; border-radius:8px;
      font-size:13.5px; color:#0c1c35; background:#fff; box-sizing:border-box;
      transition:border-color 0.15s; outline:none; margin-bottom:12px;
    }
    .form-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .form-input:disabled { background:#f8fafc; color:#94a3b8; }
    .form-textarea { resize:vertical; min-height:60px; }
    .form-select { cursor:pointer; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-check-row { display:flex; gap:16px; margin-top:4px; }
    .checkbox-label { display:flex; align-items:center; gap:7px; font-size:13px; color:#475569; cursor:pointer; }
    .form-check { width:15px; height:15px; accent-color:#1a407e; }

    .features-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .feat-editor { }
    .feat-editor-label { font-size:12px; font-weight:600; color:#475569; margin-bottom:4px; }
    .feat-input { margin-bottom:0 !important; }

    .spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; display:inline-block; }
    @keyframes spin { to { transform:rotate(360deg); } }
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

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<Plan[]>(`${this.api}/plans`).subscribe({
      next: (data) => { this.plans.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.notify.error('Error al cargar planes'); },
    });
  }

  openCreate() {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.showModal.set(true);
  }

  openEdit(plan: Plan) {
    this.editId.set(plan.id);
    this.form = {
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description ?? '',
      price: plan.price,
      currency: plan.currency ?? 'COP',
      isActive: plan.isActive,
      isCustom: plan.isCustom,
      features: FEATURE_DEFAULTS.map(def => {
        const existing = plan.features.find(f => f.key === def.key);
        return { key: def.key, label: def.label, value: existing?.value ?? def.value };
      }),
    };
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); }

  save() {
    if (!this.form.name || !this.form.displayName || this.form.price == null) {
      this.notify.error('Completa los campos obligatorios');
      return;
    }
    this.saving.set(true);
    const payload = { ...this.form };
    const req = this.isNew()
      ? this.http.post<Plan>(`${this.api}/plans`, payload)
      : this.http.put<Plan>(`${this.api}/plans/${this.editId()}`, payload);

    req.subscribe({
      next: (plan) => {
        this.saving.set(false);
        this.closeModal();
        this.notify.success(this.isNew() ? 'Plan creado' : 'Plan actualizado');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.error(err?.error?.message ?? 'Error al guardar plan');
      },
    });
  }

  toggleActive(plan: Plan) {
    const payload = { isActive: !plan.isActive };
    this.http.put(`${this.api}/plans/${plan.id}`, { ...plan, isActive: !plan.isActive, features: plan.features }).subscribe({
      next: () => {
        this.notify.success(plan.isActive ? 'Plan desactivado' : 'Plan activado');
        this.load();
      },
      error: () => this.notify.error('Error al cambiar estado del plan'),
    });
  }

  isBoolKey(key: string) { return BOOL_KEYS.includes(key); }

  private emptyForm() {
    return {
      name: '',
      displayName: '',
      description: '',
      price: 0,
      currency: 'COP',
      isActive: true,
      isCustom: false,
      features: FEATURE_DEFAULTS.map(f => ({ ...f })),
    };
  }
}
