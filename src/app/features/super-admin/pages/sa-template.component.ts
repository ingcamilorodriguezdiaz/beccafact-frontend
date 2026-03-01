import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// ── Definición completa de columnas disponibles ──────────────────────────────
interface ColDef {
  key:      string;
  label:    string;
  hint:     string;
  type:     'text' | 'number' | 'select';
  options?: string[];
  required: boolean;
  sample:   string;
}

const ALL_COLUMNS: ColDef[] = [
  { key:'nombre_producto', label:'Nombre del Producto',  hint:'Nombre completo (máx. 255 car.)',           type:'text',   required:true,  sample:'Laptop Dell XPS 15' },
  { key:'sku',             label:'SKU / Código',          hint:'Código único. Ej: PROD-001',                type:'text',   required:true,  sample:'DELL-XPS-001' },
  { key:'precio',          label:'Precio de Venta',       hint:'Precio en COP. Ej: 50000',                  type:'number', required:true,  sample:'3500000' },
  { key:'categoria',       label:'Categoría',             hint:'Se crea automáticamente si no existe',      type:'text',   required:false, sample:'Tecnología' },
  { key:'costo',           label:'Costo',                 hint:'Precio de costo. Ej: 35000',                type:'number', required:false, sample:'2800000' },
  { key:'stock_inicial',   label:'Stock Inicial',         hint:'Cantidad inicial en inventario',            type:'number', required:false, sample:'10' },
  { key:'impuesto',        label:'IVA (%)',               hint:'0, 5, 8 o 19',                              type:'select', required:false, sample:'19', options:['0','5','8','19'] },
  { key:'unidad',          label:'Unidad de Medida',      hint:'UND, KG, MT, LT, HR, SRV',                 type:'select', required:false, sample:'UND', options:['UND','KG','MT','LT','HR','SRV'] },
  { key:'descripcion',     label:'Descripción',           hint:'Descripción del producto (máx. 500 car.)',  type:'text',   required:false, sample:'Laptop profesional Intel i7 16GB RAM' },
  { key:'estado',          label:'Estado',                hint:'ACTIVE o INACTIVE',                         type:'select', required:false, sample:'ACTIVE', options:['ACTIVE','INACTIVE'] },
];

interface ColState extends ColDef {
  enabled:  boolean;
  editLabel: string;
  editHint:  string;
  editSample: string;
  editing:  boolean;
}

@Component({
  selector: 'app-sa-template',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="stp-page">

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="stp-header">
    <div class="stp-header-left">
      <div class="stp-icon">
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#00c6a0" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M14 2v6h6M8 13h8M8 17h5" stroke="#00c6a0" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <h1 class="stp-title">Editor de Plantilla</h1>
        <p class="stp-sub">Configura los campos y descarga la plantilla Excel para importación masiva</p>
      </div>
    </div>
    <div class="stp-header-actions">
      <button class="stp-btn stp-btn-ghost" (click)="resetToDefaults()">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/></svg>
        Restaurar
      </button>
      <button class="stp-btn stp-btn-primary" (click)="downloadTemplate()" [disabled]="downloading()">
        @if (downloading()) {
          <span class="stp-spinner"></span> Generando…
        } @else {
          <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
          Descargar plantilla
        }
      </button>
    </div>
  </div>

  <!-- ── Stats bar ────────────────────────────────────────────────────── -->
  <div class="stp-stats">
    <div class="stp-stat">
      <span class="stp-stat-val">{{ enabledCount() }}</span>
      <span class="stp-stat-lbl">columnas activas</span>
    </div>
    <div class="stp-stat-div"></div>
    <div class="stp-stat">
      <span class="stp-stat-val">{{ requiredCount() }}</span>
      <span class="stp-stat-lbl">obligatorias</span>
    </div>
    <div class="stp-stat-div"></div>
    <div class="stp-stat">
      <span class="stp-stat-val">{{ ALL_COLUMNS.length - enabledCount() }}</span>
      <span class="stp-stat-lbl">ocultas</span>
    </div>
    <div class="stp-stat-div"></div>
    <div class="stp-stat">
      <span class="stp-stat-val stp-stat-green">xlsx</span>
      <span class="stp-stat-lbl">formato</span>
    </div>
  </div>

  <!-- ── Main grid ────────────────────────────────────────────────────── -->
  <div class="stp-grid">

    <!-- LEFT: Column editor ──────────────────────────────────────────── -->
    <div class="stp-panel">
      <div class="stp-panel-header">
        <span>Configurar columnas</span>
        <span class="stp-count-pill">{{ enabledCount() }}/{{ ALL_COLUMNS.length }}</span>
      </div>

      <div class="stp-col-list">
        @for (col of columns(); track col.key) {
          <div class="stp-col-row" [class.col-enabled]="col.enabled" [class.col-disabled]="!col.enabled">

            <!-- Toggle + drag handle ────────────── -->
            <div class="stp-col-left">
              <button class="stp-toggle"
                      [class.toggle-on]="col.enabled"
                      [disabled]="col.required"
                      (click)="toggleColumn(col.key)"
                      [title]="col.required ? 'Campo obligatorio' : (col.enabled ? 'Desactivar' : 'Activar')">
                <span class="toggle-knob"></span>
              </button>
            </div>

            <!-- Main content ─────────────────────── -->
            <div class="stp-col-body">
              @if (!col.editing) {
                <div class="col-info">
                  <div class="col-info-top">
                    <span class="col-label">{{ col.editLabel }}</span>
                    @if (col.required) { <span class="col-req-badge">obligatorio</span> }
                    <span class="col-type-badge col-type-{{ col.type }}">{{ col.type }}</span>
                  </div>
                  <div class="col-hint">{{ col.editHint }}</div>
                  <div class="col-sample">Ejemplo: <em>{{ col.editSample }}</em></div>
                </div>
                @if (col.enabled) {
                  <button class="stp-edit-btn" (click)="startEdit(col.key)" title="Editar etiqueta y descripción">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path d="M12.586 2.586a2 2 0 112.828 2.828l-8.5 8.5A2 2 0 015.5 14.5H3a1 1 0 01-1-1v-2.5a2 2 0 01.586-1.414l8.5-8.5z"/></svg>
                  </button>
                }
              } @else {
                <!-- Inline edit form ──────────────── -->
                <div class="col-edit-form">
                  <div class="edit-row">
                    <label>Etiqueta en Excel</label>
                    <input [(ngModel)]="col.editLabel" class="edit-input" placeholder="Nombre de columna" />
                  </div>
                  <div class="edit-row">
                    <label>Descripción / hint</label>
                    <input [(ngModel)]="col.editHint" class="edit-input" placeholder="Instrucción de llenado" />
                  </div>
                  <div class="edit-row">
                    <label>Dato de ejemplo</label>
                    <input [(ngModel)]="col.editSample" class="edit-input" placeholder="Valor de muestra" />
                  </div>
                  <div class="edit-actions">
                    <button class="stp-btn-xs stp-btn-green" (click)="saveEdit(col.key)">
                      <svg viewBox="0 0 14 14" fill="currentColor" width="11"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
                      Guardar
                    </button>
                    <button class="stp-btn-xs stp-btn-ghost" (click)="cancelEdit(col.key)">Cancelar</button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- RIGHT: Live preview ──────────────────────────────────────────── -->
    <div class="stp-panel stp-panel-preview">
      <div class="stp-panel-header">
        <span>Vista previa de la plantilla</span>
        <span class="stp-preview-tag">
          <svg viewBox="0 0 16 16" fill="currentColor" width="10"><path d="M1 2.5A1.5 1.5 0 012.5 1h11A1.5 1.5 0 0115 2.5v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-11z"/></svg>
          Excel
        </span>
      </div>

      <!-- Fake spreadsheet ──────────────────────────────────────────── -->
      <div class="stp-sheet-wrap">
        <div class="stp-sheet">

          <!-- Title row -->
          <div class="sheet-title-row">
            <div class="sheet-title-cell" [attr.colspan]="enabledCount()">
              BeccaFact — Plantilla de Importación Masiva de Productos
            </div>
          </div>

          <!-- Header row -->
          <div class="sheet-header-row">
            <div class="sheet-row-num">#</div>
            @for (col of activeColumns(); track col.key) {
              <div class="sheet-head-cell" [class.req-col]="col.required">
                {{ col.editLabel }}
                @if (col.required) { <span class="sheet-req">*</span> }
              </div>
            }
          </div>

          <!-- Hint row -->
          <div class="sheet-hint-row">
            <div class="sheet-row-num">↓</div>
            @for (col of activeColumns(); track col.key) {
              <div class="sheet-hint-cell">{{ col.editHint }}</div>
            }
          </div>

          <!-- Sample data rows -->
          @for (row of sampleRows(); track $index) {
            <div class="sheet-data-row" [class.row-alt]="$index % 2 === 1">
              <div class="sheet-row-num">{{ $index + 1 }}</div>
              @for (col of activeColumns(); track col.key) {
                <div class="sheet-data-cell">{{ row[col.key]  }}</div>
              }
            </div>
          }

          <!-- Empty rows indicator -->
          <div class="sheet-empty-row">
            <div class="sheet-row-num">…</div>
            @for (col of activeColumns(); track col.key) {
              <div class="sheet-empty-cell"></div>
            }
          </div>

        </div>
      </div>

      <!-- Sheet tabs -->
      <div class="sheet-tabs">
        <div class="sheet-tab sheet-tab-active">
          <svg viewBox="0 0 14 14" fill="currentColor" width="10"><path d="M2 2h10v10H2z"/></svg>
          Productos
        </div>
        <div class="sheet-tab">Instrucciones</div>
        <div class="sheet-tab">Valores Válidos</div>
      </div>

      <!-- Column summary chips -->
      <div class="stp-chips">
        @for (col of activeColumns(); track col.key) {
          <div class="stp-chip" [class.chip-req]="col.required">
            <span class="chip-type chip-{{ col.type }}"></span>
            {{ col.editLabel }}
          </div>
        }
      </div>

      <!-- Download call-to-action -->
      <div class="stp-cta">
        <div class="stp-cta-text">
          <strong>{{ enabledCount() }} columnas</strong> configuradas · Plantilla lista para descargar
        </div>
        <button class="stp-btn stp-btn-primary stp-btn-sm" (click)="downloadTemplate()" [disabled]="downloading()">
          @if (downloading()) {
            <span class="stp-spinner"></span>
          } @else {
            <svg viewBox="0 0 16 16" fill="currentColor" width="13"><path fill-rule="evenodd" d="M2 13.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 3h-3a.5.5 0 000 1h3a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5V4.5a.5.5 0 01.5-.5H7a.5.5 0 000-1H3.5A1.5 1.5 0 002 4.5v9zM7.5 1a.5.5 0 000 1h1.793L4.146 7.146a.5.5 0 00.708.708L10 2.707V4.5a.5.5 0 001 0V1.5a.5.5 0 00-.5-.5h-3z"/></svg>
          }
          Descargar xlsx
        </button>
      </div>
    </div>

  </div>

</div>
  `,
  styles: [`
    :host { display:block; }

    /* ── Page ─────────────────────────────────────────────────── */
    .stp-page { padding:28px; max-width:1400px; animation:fadeUp .3s ease; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

    /* ── Header ───────────────────────────────────────────────── */
    .stp-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:16px; flex-wrap:wrap; }
    .stp-header-left { display:flex; align-items:center; gap:14px; }
    .stp-icon { width:48px; height:48px; background:rgba(0,198,160,0.1); border:1px solid rgba(0,198,160,0.25); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .stp-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0f1c2e; margin:0 0 3px; }
    .stp-sub { font-size:13px; color:#64748b; margin:0; }
    .stp-header-actions { display:flex; gap:10px; }

    /* ── Stats bar ────────────────────────────────────────────── */
    .stp-stats { display:flex; align-items:center; gap:20px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 20px; margin-bottom:22px; flex-wrap:wrap; }
    .stp-stat { display:flex; flex-direction:column; align-items:center; gap:2px; }
    .stp-stat-val { font-family:'Sora',sans-serif; font-size:22px; font-weight:800; color:#0f1c2e; line-height:1; }
    .stp-stat-green { color:#00c6a0; }
    .stp-stat-lbl { font-size:11px; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:.06em; }
    .stp-stat-div { width:1px; height:32px; background:#e2e8f0; }

    /* ── Grid ─────────────────────────────────────────────────── */
    .stp-grid { display:grid; grid-template-columns:380px 1fr; gap:20px; align-items:start; }
    @media(max-width:1100px) { .stp-grid { grid-template-columns:1fr; } }

    /* ── Panel ────────────────────────────────────────────────── */
    .stp-panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
    .stp-panel-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:700; color:#334155; letter-spacing:.04em; }
    .stp-count-pill { background:#1a407e; color:#fff; font-size:11px; font-weight:700; padding:2px 9px; border-radius:99px; }
    .stp-preview-tag { display:flex; align-items:center; gap:4px; background:#16a34a; color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; }

    /* ── Column list ──────────────────────────────────────────── */
    .stp-col-list { padding:12px; display:flex; flex-direction:column; gap:8px; max-height:600px; overflow-y:auto; }
    .stp-col-list::-webkit-scrollbar { width:4px; }
    .stp-col-list::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:2px; }

    .stp-col-row { display:flex; align-items:flex-start; gap:12px; padding:12px; border-radius:10px; border:1px solid #e2e8f0; transition:all .15s; }
    .col-enabled  { background:#fff; border-color:#e2e8f0; }
    .col-disabled { background:#f8fafc; opacity:.55; }
    .col-enabled:hover { border-color:#c7d9f5; box-shadow:0 2px 8px rgba(26,64,126,0.06); }

    /* Toggle */
    .stp-toggle { position:relative; width:36px; height:20px; border-radius:99px; border:none; cursor:pointer; transition:background .2s; flex-shrink:0; margin-top:2px; background:#cbd5e1; padding:0; }
    .stp-toggle.toggle-on { background:#00c6a0; }
    .stp-toggle:disabled { cursor:not-allowed; opacity:.7; }
    .toggle-knob { position:absolute; top:3px; left:3px; width:14px; height:14px; background:#fff; border-radius:50%; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .toggle-on .toggle-knob { transform:translateX(16px); }

    /* Col body */
    .stp-col-body { flex:1; min-width:0; }
    .col-info { position:relative; }
    .col-info-top { display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap; }
    .col-label { font-size:13px; font-weight:700; color:#1e293b; }
    .col-req-badge { font-size:10px; font-weight:700; background:rgba(239,68,68,0.1); color:#ef4444; padding:1px 7px; border-radius:99px; }
    .col-type-badge { font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:4px; }
    .col-type-text   { background:#eff6ff; color:#3b82f6; }
    .col-type-number { background:#f0fdf4; color:#16a34a; }
    .col-type-select { background:#fefce8; color:#ca8a04; }
    .col-hint   { font-size:11.5px; color:#94a3b8; margin-bottom:3px; }
    .col-sample { font-size:11px; color:#64748b; }
    .col-sample em { font-style:normal; font-weight:600; color:#0f1c2e; }

    /* Edit button */
    .stp-edit-btn { position:absolute; top:-2px; right:0; background:none; border:1px solid #e2e8f0; border-radius:6px; padding:4px 6px; cursor:pointer; color:#94a3b8; transition:all .15s; display:flex; }
    .stp-edit-btn:hover { background:#f1f5f9; color:#1a407e; border-color:#c7d9f5; }

    /* Inline edit form */
    .col-edit-form { display:flex; flex-direction:column; gap:8px; }
    .edit-row { display:flex; flex-direction:column; gap:3px; }
    .edit-row label { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; }
    .edit-input { padding:7px 10px; border:1px solid #e2e8f0; border-radius:7px; font-size:13px; color:#1e293b; outline:none; transition:border .15s; background:#fff; }
    .edit-input:focus { border-color:#1a407e; box-shadow:0 0 0 3px rgba(26,64,126,0.08); }
    .edit-actions { display:flex; gap:6px; margin-top:2px; }

    /* ── Sheet preview ────────────────────────────────────────── */
    .stp-sheet-wrap { padding:16px; overflow-x:auto; }
    .stp-sheet { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; min-width:400px; font-size:11.5px; }

    .sheet-title-row { display:flex; background:#1a407e; }
    .sheet-title-cell { padding:8px 12px; color:#fff; font-family:'Sora',sans-serif; font-weight:700; font-size:11px; white-space:nowrap; }

    .sheet-header-row,
    .sheet-hint-row,
    .sheet-data-row,
    .sheet-empty-row { display:flex; border-bottom:1px solid #e2e8f0; }

    .sheet-row-num { width:28px; min-width:28px; padding:5px 6px; background:#f8fafc; border-right:1px solid #e2e8f0; color:#94a3b8; font-size:10px; text-align:center; flex-shrink:0; }
    .sheet-head-cell  { padding:6px 10px; background:#dbeafe; font-weight:700; color:#1e40af; white-space:nowrap; border-right:1px solid #bfdbfe; min-width:100px; }
    .sheet-head-cell.req-col { background:#dcfce7; color:#166534; border-right-color:#bbf7d0; }
    .sheet-req { color:#dc2626; margin-left:2px; }
    .sheet-hint-cell  { padding:5px 10px; background:#fefce8; font-size:10.5px; color:#92400e; white-space:nowrap; border-right:1px solid #fde68a; min-width:100px; font-style:italic; }
    .sheet-data-cell  { padding:5px 10px; color:#374151; white-space:nowrap; border-right:1px solid #f1f5f9; min-width:100px; }
    .sheet-empty-cell { padding:5px 10px; min-width:100px; border-right:1px solid #f1f5f9; background:#fafafa; }
    .row-alt .sheet-data-cell { background:#f8fafc; }
    .sheet-empty-row .sheet-row-num { color:#d1d5db; }

    /* Sheet tabs */
    .sheet-tabs { display:flex; gap:2px; padding:0 16px; border-top:1px solid #e2e8f0; background:#f8fafc; }
    .sheet-tab { padding:7px 14px; font-size:11.5px; font-weight:600; color:#94a3b8; cursor:pointer; border-top:2px solid transparent; transition:all .15s; display:flex; align-items:center; gap:5px; }
    .sheet-tab-active { color:#1a407e; border-top-color:#1a407e; background:#fff; }

    /* Chips */
    .stp-chips { display:flex; flex-wrap:wrap; gap:6px; padding:14px 16px; border-top:1px solid #f1f5f9; }
    .stp-chip { display:flex; align-items:center; gap:5px; padding:3px 10px; background:#f1f5f9; border-radius:99px; font-size:11.5px; color:#475569; font-weight:600; }
    .stp-chip.chip-req { background:#f0fdf4; color:#166534; }
    .chip-type { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .chip-text   { background:#3b82f6; }
    .chip-number { background:#16a34a; }
    .chip-select { background:#ca8a04; }

    /* CTA footer */
    .stp-cta { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-top:1px solid #e2e8f0; background:#f8fafc; gap:12px; flex-wrap:wrap; }
    .stp-cta-text { font-size:13px; color:#64748b; }
    .stp-cta-text strong { color:#0f1c2e; }

    /* ── Buttons ──────────────────────────────────────────────── */
    .stp-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all .15s; }
    .stp-btn:disabled { opacity:.55; cursor:not-allowed; }
    .stp-btn-sm { padding:6px 12px; font-size:12px; }
    .stp-btn-ghost { background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; }
    .stp-btn-ghost:hover:not(:disabled) { background:#e2e8f0; }
    .stp-btn-primary { background:linear-gradient(135deg,#1a407e,#00c6a0); color:#fff; }
    .stp-btn-primary:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,198,160,.3); }
    .stp-btn-xs { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; border:none; }
    .stp-btn-green { background:#dcfce7; color:#166534; }
    .stp-btn-green:hover { background:#bbf7d0; }

    .stp-spinner { width:13px; height:13px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
  `],
})
export class SaTemplateComponent {

   private http = inject(HttpClient);
  readonly ALL_COLUMNS = ALL_COLUMNS;

  private readonly API = `${environment.apiUrl}/import`;

  downloading = signal(false);

  // State for each column
  columns = signal<ColState[]>(
    ALL_COLUMNS.map(c => ({
      ...c,
      enabled:    true,
      editLabel:  c.label,
      editHint:   c.hint,
      editSample: c.sample,
      editing:    false,
    }))
  );

  activeColumns = computed(() => this.columns().filter(c => c.enabled));
  enabledCount  = computed(() => this.columns().filter(c => c.enabled).length);
  requiredCount = computed(() => this.columns().filter(c => c.required).length);

  // 3 sample rows from built-in data
  sampleRows = computed(() => {
    const samples = [
      { nombre_producto:'Laptop Dell XPS 15',  sku:'DELL-XPS-001',  precio:'3500000', categoria:'Tecnología',  costo:'2800000', stock_inicial:'10', impuesto:'19', unidad:'UND', descripcion:'Intel i7 16GB', estado:'ACTIVE' },
      { nombre_producto:'Mouse Logitech MX',   sku:'LOG-MX-001',    precio:'180000',  categoria:'Periféricos', costo:'125000',  stock_inicial:'30', impuesto:'19', unidad:'UND', descripcion:'Inalámbrico',    estado:'ACTIVE' },
      { nombre_producto:'Resma Papel A4',       sku:'PAPEL-A4-001',  precio:'18000',   categoria:'Papelería',   costo:'12000',   stock_inicial:'100',impuesto:'0',  unidad:'UND', descripcion:'500 hojas 75gr', estado:'ACTIVE' },
    ];
    // Use editSample for each column from current state
    const cols = this.columns();
    return samples.map(base => {
      const row: Record<string, string> = {};
      for (const col of cols) {
        if (col.enabled) row[col.key] = (base as any)[col.key] ?? col.editSample;
      }
      return row;
    });
  });

  toggleColumn(key: string) {
    this.columns.update(cols =>
      cols.map(c => c.key === key && !c.required ? { ...c, enabled: !c.enabled } : c)
    );
  }

  startEdit(key: string) {
    this.columns.update(cols =>
      cols.map(c => c.key === key ? { ...c, editing: true } : { ...c, editing: false })
    );
  }

  saveEdit(key: string) {
    this.columns.update(cols =>
      cols.map(c => c.key === key ? { ...c, editing: false } : c)
    );
  }

  cancelEdit(key: string) {
    const original = ALL_COLUMNS.find(c => c.key === key)!;
    this.columns.update(cols =>
      cols.map(c => c.key === key ? {
        ...c,
        editLabel:  c.editLabel,   // keep user changes but close form
        editing:    false,
      } : c)
    );
  }

  resetToDefaults() {
    this.columns.set(
      ALL_COLUMNS.map(c => ({
        ...c, enabled:true, editLabel:c.label, editHint:c.hint, editSample:c.sample, editing:false,
      }))
    );
  }

  downloadTemplate() {
    this.downloading.set(true);

    // Build column config to send to backend
    const activeKeys   = this.activeColumns().map(c => c.key);
    const customLabels = this.columns().reduce((acc, c) => {
      if (c.editLabel !== c.label || c.editHint !== c.hint || c.editSample !== c.sample) {
        acc[c.key] = { label: c.editLabel, hint: c.editHint, sample: c.editSample };
      }
      return acc;
    }, {} as Record<string, { label: string; hint: string; sample: string }>);

    this.http.post(
      `${this.API}/template`,
      { columns: activeKeys, customLabels },
      { responseType: 'blob' }
    ).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `plantilla-beccafact-${new Date().toISOString().slice(0,10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.downloading.set(false);
      },
    });
  }
}
