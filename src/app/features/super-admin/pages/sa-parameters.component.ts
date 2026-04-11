import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogService } from '../../../core/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../../environments/environment';

interface Parameter {
  id: string;
  category: string;
  value: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-sa-parameters',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <div class="page animate-in">

      <!-- ── Header ── -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Parámetros del sistema</h2>
          <p class="page-subtitle">{{ filtered().length }} parámetros configurados</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
          </svg>
          Nuevo parámetro
        </button>
      </div>

      <!-- ── Filtros ── -->
      <div class="filters-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"/>
          </svg>
          <input type="text" [(ngModel)]="searchValue" (ngModelChange)="search.set($event)"
                 placeholder="Buscar parámetro…" class="form-control search-input"/>
        </div>
        <select [(ngModel)]="filterCategoryValue" (ngModelChange)="filterCategory.set($event)"
                class="form-control filter-select">
          <option value="">Todas las categorías</option>
          @for (cat of categories(); track cat) {
            <option [value]="cat">{{ cat }}</option>
          }
        </select>
      </div>

      <!-- ── Tabla ── -->
      <div class="table-card">
        @if (loading()) {
          @for (i of [1,2,3,4,5]; track i) {
            <div class="sk-row">
              <div class="sk" style="width:90px;height:22px;border-radius:99px"></div>
              <div class="sk" style="width:120px;height:13px"></div>
              <div class="sk" style="width:160px;height:13px"></div>
              <div class="sk" style="width:70px;height:22px;border-radius:99px"></div>
              <div class="sk" style="width:64px;height:28px;border-radius:8px;margin-left:auto"></div>
            </div>
          }
        } @else if (filtered().length === 0) {
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none" width="44">
              <rect width="48" height="48" rx="12" fill="#f0f4f9"/>
              <path d="M24 10a14 14 0 100 28 14 14 0 000-28zm0 5a2 2 0 110 4 2 2 0 010-4zm-1 8h2v9h-2z" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="24" cy="19" r="2" fill="#94a3b8"/>
              <path d="M22 25h4v8h-4z" fill="#94a3b8" rx="1"/>
            </svg>
            <p>No hay parámetros configurados</p>
          </div>
        } @else {
          <table class="co-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Valor</th>
                <th>Etiqueta</th>
                <th>Estado</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (param of filtered(); track param.id) {
                <tr class="co-row">
                  <td><span class="badge-category" [attr.data-cat]="param.category">{{ param.category }}</span></td>
                  <td class="param-value">{{ param.value }}</td>
                  <td class="param-label">{{ param.label || '—' }}</td>
                  <td>
                    @if (param.isActive) {
                      <span class="badge-active">Activo</span>
                    } @else {
                      <span class="badge-inactive">Inactivo</span>
                    }
                  </td>
                  <td class="text-muted">{{ param.createdAt | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-btn" title="Editar" (click)="openEdit(param)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                      <button class="icon-btn danger" title="Eliminar" (click)="deleteParam(param)">
                        <svg viewBox="0 0 20 20" fill="currentColor" width="14">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>

    <!-- ══ Modal Crear / Editar ══ -->
    @if (showModal()) {
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editParam() ? 'Editar parámetro' : 'Nuevo parámetro' }}</h3>
            <button class="modal-close" (click)="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Categoría *</label>
              <input type="text" [(ngModel)]="form.category" class="form-control"
                     placeholder="Ej: INVOICE_TYPE, REGIME, TAX"/>
              <span class="field-hint">Identifica el grupo al que pertenece este parámetro</span>
            </div>
            <div class="form-group">
              <label>Valor *</label>
              <input type="text" [(ngModel)]="form.value" class="form-control"
                     placeholder="Ej: FACTURA_VENTA"/>
            </div>
            <div class="form-group">
              <label>Etiqueta</label>
              <input type="text" [(ngModel)]="form.label" class="form-control"
                     placeholder="Ej: Factura de Venta (texto visible)"/>
            </div>
            <div class="form-group form-group--check">
              <label class="check-label">
                <input type="checkbox" [(ngModel)]="form.isActive" class="check-input"/>
                <span>Parámetro activo</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()" [disabled]="saving()">Cancelar</button>
            <button class="btn-primary" (click)="save()" [disabled]="saving() || !form.category || !form.value">
              @if (saving()) {
                <span class="spinner"></span>
              }
              {{ editParam() ? 'Guardar cambios' : 'Crear parámetro' }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-confirm-dialog />
  `,
  styles: [`
    @keyframes fadeSlide { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
    @keyframes shimmer   { 0%{background-position:200%} 100%{background-position:-200%} }
    @keyframes spin      { to{transform:rotate(360deg)} }

    .animate-in { animation:fadeSlide .28s ease; }
    .page { padding:0; }

    .page-header   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
    .page-title    { font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { color:#9ab5cc; font-size:13.5px; margin:0; }

    .btn-primary {
      background:#1a407e; color:#fff; border:none; padding:9px 16px;
      border-radius:9px; font-size:13.5px; font-weight:600; cursor:pointer;
      display:flex; align-items:center; gap:6px; transition:background .15s;
    }
    .btn-primary:hover:not(:disabled) { background:#15336a; }
    .btn-primary:disabled { opacity:.6; cursor:default; }

    .btn-secondary {
      background:#f0f4f9; color:#374151; border:1px solid #dce6f0;
      padding:9px 16px; border-radius:9px; font-size:13.5px; font-weight:600;
      cursor:pointer; transition:background .15s;
    }
    .btn-secondary:hover:not(:disabled) { background:#e8eef8; }
    .btn-secondary:disabled { opacity:.6; cursor:default; }

    .filters-bar  { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
    .search-wrap  { position:relative; flex:1; min-width:200px; max-width:360px; }
    .search-icon  { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9ab5cc; pointer-events:none; }
    .search-input { padding-left:34px !important; }
    .filter-select { max-width:220px; }

    .form-control {
      width:100%; padding:9px 12px; border:1.5px solid #dce6f0;
      border-radius:9px; font-size:13.5px; outline:none;
      transition:border-color .15s; box-sizing:border-box;
    }
    .form-control:focus { border-color:#1a407e; }

    .table-card { background:#fff; border-radius:14px; box-shadow:0 1px 4px rgba(12,28,53,.08); overflow:hidden; }
    .co-table   { width:100%; border-collapse:collapse; }
    .co-table th {
      font-size:11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.07em; color:#9ab5cc; padding:12px 16px;
      background:#fafbfc; border-bottom:1px solid #edf1f7; text-align:left;
    }
    .co-table td { padding:12px 16px; font-size:13.5px; color:#334155; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .co-row:last-child td { border-bottom:none; }
    .co-row:hover { background:#f8fafc; }

    .param-value { font-weight:600; color:#0c1c35; font-family:monospace; font-size:12.5px; }
    .param-label { color:#64748b; }
    .text-muted  { color:#94a3b8; font-size:12.5px; }

    /* Category badge with auto-color cycling */
    .badge-category {
      display:inline-block; padding:3px 9px; border-radius:7px;
      font-size:11px; font-weight:700; white-space:nowrap;
      background:#ede9fe; color:#5b21b6;
    }
    .badge-category[data-cat*="INVOICE"]   { background:#dbeafe; color:#1e40af; }
    .badge-category[data-cat*="TAX"]       { background:#fef3c7; color:#92400e; }
    .badge-category[data-cat*="REGIME"]    { background:#d1fae5; color:#065f46; }
    .badge-category[data-cat*="CURRENCY"]  { background:#fce7f3; color:#9d174d; }
    .badge-category[data-cat*="PAYMENT"]   { background:#e0f2fe; color:#075985; }

    .badge-active   { background:rgba(0,198,160,.12); color:#00a884; border-radius:9999px; padding:3px 10px; font-size:11.5px; font-weight:600; }
    .badge-inactive { background:#f1f5f9; color:#94a3b8; border-radius:9999px; padding:3px 10px; font-size:11.5px; font-weight:600; }

    .row-actions { display:flex; gap:4px; justify-content:flex-end; }
    .icon-btn { background:none; border:none; cursor:pointer; padding:5px; border-radius:6px; color:#9ab5cc; transition:color .15s,background .15s; }
    .icon-btn:hover { background:#f0f4f9; color:#1a407e; }
    .icon-btn.danger:hover { color:#ef4444; background:rgba(239,68,68,.08); }

    .sk-row { display:flex; align-items:center; gap:16px; padding:14px 16px; border-bottom:1px solid #f0f4f9; }
    .sk { background:linear-gradient(90deg,#f0f4f9 25%,#e8eef8 50%,#f0f4f9 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px; display:block; }

    .empty-state { display:flex; flex-direction:column; align-items:center; gap:10px; padding:52px 24px; color:#94a3b8; font-size:14px; }

    /* Modal */
    .modal-overlay { position:fixed; inset:0; width:100vw; height:100dvh; background:rgba(12,28,53,.52); display:flex; align-items:center; justify-content:center; z-index:5000; padding:24px; backdrop-filter:blur(4px); }
    .modal-box { background:#fff; border-radius:18px; padding:0; width:min(560px, 100%); box-shadow:0 28px 80px rgba(12,28,53,.28); display:flex; flex-direction:column; max-height:min(92dvh, 820px); overflow:hidden; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #f0f4f8; }
    .modal-header h3 { font-size:16px; font-weight:700; color:#0c1c35; margin:0; }
    .modal-close { background:none; border:none; cursor:pointer; color:#9ca3af; font-size:22px; padding:0 4px; }
    .modal-body { padding:20px 24px; overflow:auto; }
    .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid #f0f4f8; }

    .form-group { margin-bottom:16px; }
    .form-group label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:5px; }
    .field-hint { font-size:11px; color:#9ab5cc; margin-top:4px; display:block; }

    .form-group--check { margin-bottom:8px; }
    .check-label { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13.5px; color:#374151; font-weight:500; }
    .check-input { width:16px; height:16px; cursor:pointer; accent-color:#1a407e; }

    .spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; display:inline-block; }

    @media (max-width:600px) {
      .filter-select { max-width:100%; }
      .modal-footer { flex-direction:column-reverse; }
      .modal-footer button { width:100%; justify-content:center; }
      .co-table { min-width:540px; }
      .table-card { overflow-x:auto; }
    }
  `]
})
export class SaParametersComponent implements OnInit {
  private readonly API = `${environment.apiUrl}/super-admin/parameters`;

  parameters     = signal<Parameter[]>([]);
  loading        = signal(true);
  saving         = signal(false);
  search         = signal('');
  filterCategory = signal('');
  showModal      = signal(false);
  editParam      = signal<Parameter | null>(null);

  searchValue          = '';
  filterCategoryValue  = '';

  form = { category: '', value: '', label: '', isActive: true };

  categories = computed(() => {
    const cats = [...new Set(this.parameters().map(p => p.category))];
    return cats.sort();
  });

  filtered = computed(() => {
    const term = this.search().toLowerCase().trim();
    const cat  = this.filterCategory();
    return this.parameters().filter(p => {
      const matchesCat  = !cat  || p.category === cat;
      const matchesTerm = !term ||
        p.category.toLowerCase().includes(term) ||
        p.value.toLowerCase().includes(term) ||
        (p.label ?? '').toLowerCase().includes(term);
      return matchesCat && matchesTerm;
    });
  });

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
    private dialog: ConfirmDialogService,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>(this.API).subscribe({
      next: r => {
        this.parameters.set(r.data ?? r);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Error al cargar los parámetros');
        this.loading.set(false);
      },
    });
  }

  openCreate() {
    this.editParam.set(null);
    this.form = { category: '', value: '', label: '', isActive: true };
    this.showModal.set(true);
  }

  openEdit(param: Parameter) {
    this.editParam.set(param);
    this.form = {
      category: param.category,
      value: param.value,
      label: param.label ?? '',
      isActive: param.isActive,
    };
    this.showModal.set(true);
  }

  closeModal() {
    if (this.saving()) return;
    this.showModal.set(false);
    this.editParam.set(null);
  }

  save() {
    if (!this.form.category.trim() || !this.form.value.trim()) return;
    this.saving.set(true);

    const existing = this.editParam();
    const payload  = {
      category: this.form.category.trim(),
      value:    this.form.value.trim(),
      label:    this.form.label.trim() || null,
      isActive: this.form.isActive,
    };

    const request$ = existing
      ? this.http.patch<any>(`${this.API}/${existing.id}`, payload)
      : this.http.post<any>(this.API, payload);

    request$.subscribe({
      next: () => {
        this.notify.success(existing ? 'Parámetro actualizado' : 'Parámetro creado exitosamente');
        this.saving.set(false);
        this.closeModal();
        this.load();
      },
      error: (err) => {
        this.notify.error(err?.error?.message || 'Error al guardar el parámetro');
        this.saving.set(false);
      },
    });
  }

  deleteParam(param: Parameter) {
    this.dialog.confirm({
      title: `¿Eliminar parámetro?`,
      message: `${param.category} → ${param.value}`,
      detail: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    }).then(ok => {
      if (!ok) return;
      this.http.delete<void>(`${this.API}/${param.id}`).subscribe({
        next: () => {
          this.notify.success('Parámetro eliminado');
          this.load();
        },
        error: (err) => this.notify.error(err?.error?.message || 'Error al eliminar el parámetro'),
      });
    });
  }
}
