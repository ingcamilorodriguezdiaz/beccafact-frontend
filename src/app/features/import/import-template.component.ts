import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
interface ImportTemplateRow {
  nombre_producto: string;
  sku: string;
  precio: string;
  categoria: string;
  costo: string;
  stock_inicial: string;
  impuesto: string;
  unidad: string;
  descripcion: string;
  estado: string;
}

interface ColumnConfig {
  key: keyof ImportTemplateRow; 
  label: string;
  required: boolean;
  type: 'text' | 'number' | 'select';
  options?: string[];
  example: string;
  description: string;
  include: boolean;
}

@Component({
  selector: 'app-import-template',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page animate-in">

      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Generador de Plantilla de Importación</h2>
          <p class="page-subtitle">Configura y descarga la plantilla Excel para carga masiva de productos</p>
        </div>
        <button class="btn-download" (click)="downloadTemplate()" [disabled]="downloading()" type="button">
          @if (downloading()) {
            <span class="spinner"></span> Generando...
          } @else {
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
            Descargar Plantilla Excel
          }
        </button>
      </div>

      <div class="layout-cols">

        <!-- Left: Column Configurator -->
        <div class="config-panel">
          <div class="panel-header">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" class="panel-icon"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
            <div>
              <div class="panel-title">Columnas de la Plantilla</div>
              <div class="panel-subtitle">{{ activeCount() }} de {{ columns().length }} columnas activas</div>
            </div>
          </div>

          <div class="columns-list">
            @for (col of columns(); track col.key) {
              <div class="col-row" [class.col-required]="col.required" [class.col-disabled]="!col.include && !col.required">
                <div class="col-check-wrap">
                  <input type="checkbox" [checked]="col.include" [disabled]="col.required"
                    (change)="toggleColumn(col)" class="col-check" [id]="'col_' + col.key"/>
                </div>
                <label [for]="'col_' + col.key" class="col-body">
                  <div class="col-header-row">
                    <span class="col-label">{{ col.label }}</span>
                    @if (col.required) {
                      <span class="required-badge">REQUERIDO</span>
                    }
                    <span class="col-type-badge col-type-{{ col.type }}">{{ col.type }}</span>
                  </div>
                  <div class="col-desc">{{ col.description }}</div>
                  @if (col.type === 'select' && col.options) {
                    <div class="col-opts">Valores: {{ col.options.join(' · ') }}</div>
                  }
                </label>
              </div>
            }
          </div>
        </div>

        <!-- Right: Preview + Info -->
        <div class="right-panel">

          <!-- Preview table -->
          <div class="preview-card">
            <div class="panel-header">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" class="panel-icon"><path fill-rule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z"/></svg>
              <div>
                <div class="panel-title">Vista Previa de la Plantilla</div>
                <div class="panel-subtitle">Las columnas activas aparecerán en el Excel</div>
              </div>
            </div>

            <div class="preview-scroll">
              <table class="preview-table">
                <thead>
                  <tr class="header-row">
                    @for (col of activeColumns(); track col.key) {
                      <th [class.required-col]="col.required">
                        {{ col.label }}
                        @if (col.required) { <span class="req-mark">*</span> }
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of sampleRows; track $index) {
                    <tr>
                      @for (col of activeColumns(); track col.key) {
                        <td [class.sample-cell]="!col.required">{{ row[col.key] || '...' }}</td>
                      }
                    </tr>
                  }
                  <tr class="hint-row">
                    @for (col of activeColumns(); track col.key) {
                      <td class="hint-cell">{{ col.example }}</td>
                    }
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Specs card -->
          <div class="specs-card">
            <div class="specs-title">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>
              Especificaciones de la plantilla
            </div>
            <div class="specs-grid">
              <div class="spec-item">
                <div class="spec-key">Formato</div>
                <div class="spec-val">.xlsx (Excel 2007+)</div>
              </div>
              <div class="spec-item">
                <div class="spec-key">Hojas</div>
                <div class="spec-val">3 hojas incluidas</div>
              </div>
              <div class="spec-item">
                <div class="spec-key">Límite filas</div>
                <div class="spec-val">10.000 productos</div>
              </div>
              <div class="spec-item">
                <div class="spec-key">Columnas activas</div>
                <div class="spec-val">{{ activeCount() }} de {{ columns().length }}</div>
              </div>
              <div class="spec-item">
                <div class="spec-key">Validaciones</div>
                <div class="spec-val">Dropdowns en IVA, Unidad, Estado</div>
              </div>
              <div class="spec-item">
                <div class="spec-key">Filas de muestra</div>
                <div class="spec-val">8 productos de ejemplo</div>
              </div>
            </div>

            <div class="info-box">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
              <p>Las columnas marcadas como <strong>REQUERIDO</strong> son obligatorias para una importación exitosa. Las categorías se crean automáticamente si no existen.</p>
            </div>
          </div>

          <!-- Sheets info -->
          <div class="sheets-card">
            <div class="specs-title">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"/></svg>
              Contenido de las hojas Excel
            </div>
            <div class="sheets-list">
              <div class="sheet-item">
                <div class="sheet-num">1</div>
                <div>
                  <div class="sheet-name">📦 Productos</div>
                  <div class="sheet-desc">Tabla de datos con cabeceras, filas de ejemplo y celdas formateadas. Dropdowns de validación incluidos.</div>
                </div>
              </div>
              <div class="sheet-item">
                <div class="sheet-num">2</div>
                <div>
                  <div class="sheet-name">📋 Instrucciones</div>
                  <div class="sheet-desc">Guía detallada de cada campo, reglas de formato, errores comunes y ejemplos de valores.</div>
                </div>
              </div>
              <div class="sheet-item">
                <div class="sheet-num">3</div>
                <div>
                  <div class="sheet-name">📌 Datos Válidos</div>
                  <div class="sheet-desc">Tablas de referencia: IVA permitido, unidades de medida, estados disponibles y monedas.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1240px; }
    .animate-in { animation: fadeUp 0.25s ease; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .page-title { font-family:'Sora',sans-serif; font-size:22px; font-weight:700; color:#0c1c35; margin:0 0 4px; }
    .page-subtitle { font-size:13px; color:#64748b; margin:0; }

    .btn-download {
      display:inline-flex; align-items:center; gap:8px; padding:10px 20px;
      background:linear-gradient(135deg,#1a407e,#0f2a5a); color:#fff;
      border:none; border-radius:10px; font-size:13.5px; font-weight:700;
      cursor:pointer; transition:all 0.2s; box-shadow:0 3px 12px rgba(26,64,126,0.3);
    }
    .btn-download:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 5px 18px rgba(26,64,126,0.4); }
    .btn-download:disabled { opacity:0.6; cursor:default; }

    .layout-cols { display:grid; grid-template-columns:340px 1fr; gap:20px; }

    /* Config Panel */
    .config-panel, .preview-card, .specs-card, .sheets-card {
      background:#fff; border:1px solid #dce6f0; border-radius:14px; overflow:hidden;
    }
    .config-panel { }
    .panel-header {
      display:flex; align-items:center; gap:10px; padding:16px 18px;
      border-bottom:1px solid #f0f4f9; background:#f8fafc;
    }
    .panel-icon { color:#1a407e; flex-shrink:0; }
    .panel-title { font-size:14px; font-weight:700; color:#0c1c35; }
    .panel-subtitle { font-size:12px; color:#64748b; margin-top:1px; }

    .columns-list { padding:8px; max-height:calc(100vh - 200px); overflow-y:auto; }
    .col-row {
      display:flex; align-items:flex-start; gap:10px; padding:10px;
      border-radius:9px; transition:background 0.12s; margin-bottom:3px;
    }
    .col-row:hover { background:#f8fafc; }
    .col-row.col-required { }
    .col-row.col-disabled { opacity:0.45; }
    .col-check-wrap { padding-top:2px; }
    .col-check { width:15px; height:15px; accent-color:#1a407e; cursor:pointer; }
    .col-body { flex:1; cursor:pointer; }
    .col-header-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:3px; }
    .col-label { font-size:13px; font-weight:700; color:#334155; }
    .required-badge { font-size:9px; font-weight:800; background:#fef3c7; color:#92400e; padding:1px 5px; border-radius:4px; letter-spacing:0.04em; }
    .col-type-badge { font-size:9px; font-weight:700; padding:1px 5px; border-radius:4px; }
    .col-type-text { background:#f0f4f9; color:#475569; }
    .col-type-number { background:#dbeafe; color:#1d4ed8; }
    .col-type-select { background:#f3e8ff; color:#7c3aed; }
    .col-desc { font-size:11.5px; color:#64748b; line-height:1.45; }
    .col-opts { font-size:10.5px; color:#94a3b8; margin-top:3px; font-style:italic; }

    /* Right panel */
    .right-panel { display:flex; flex-direction:column; gap:16px; }

    .preview-scroll { overflow-x:auto; }
    .preview-table { width:100%; border-collapse:collapse; font-size:12px; }
    .preview-table th {
      padding:8px 12px; background:#0c1c35; color:#fff;
      text-align:left; white-space:nowrap; font-size:11px; font-weight:700;
    }
    .required-col { background:#1a407e !important; }
    .req-mark { color:#00c6a0; margin-left:2px; }
    .preview-table td { padding:7px 12px; border-bottom:1px solid #f0f4f9; color:#334155; white-space:nowrap; }
    .sample-cell { color:#64748b; }
    .hint-row td { background:#f8fafc; }
    .hint-cell { font-size:10.5px; color:#94a3b8; font-style:italic; padding:5px 12px !important; }
    .preview-table tr:hover td { background:#f8fafc; }

    /* Specs */
    .specs-title {
      display:flex; align-items:center; gap:7px; padding:14px 18px;
      font-size:12.5px; font-weight:700; color:#0c1c35;
      border-bottom:1px solid #f0f4f9;
    }
    .specs-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
    .spec-item { padding:10px 18px; border-bottom:1px solid #f0f4f9; }
    .spec-item:nth-child(even) { border-left:1px solid #f0f4f9; }
    .spec-key { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px; }
    .spec-val { font-size:13px; font-weight:600; color:#334155; }

    .info-box {
      display:flex; align-items:flex-start; gap:8px; padding:12px 18px;
      background:#fefce8; border-top:1px solid #fde047;
    }
    .info-box svg { color:#ca8a04; flex-shrink:0; margin-top:1px; }
    .info-box p { margin:0; font-size:12px; color:#713f12; line-height:1.5; }

    /* Sheets */
    .sheets-list { padding:12px 18px; display:flex; flex-direction:column; gap:12px; }
    .sheet-item { display:flex; align-items:flex-start; gap:10px; }
    .sheet-num {
      width:24px; height:24px; border-radius:6px; background:#1a407e; color:#fff;
      font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center;
      flex-shrink:0; margin-top:2px;
    }
    .sheet-name { font-size:13px; font-weight:700; color:#334155; margin-bottom:3px; }
    .sheet-desc { font-size:12px; color:#64748b; line-height:1.45; }

    .spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.6s linear infinite; display:inline-block; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class ImportTemplateComponent {
  downloading = signal(false);

  columns = signal<ColumnConfig[]>([
    { key: 'nombre_producto', label: 'Nombre del Producto', required: true, type: 'text', example: 'Ej: Laptop Dell XPS 15', description: 'Nombre completo del producto. Máximo 255 caracteres.', include: true },
    { key: 'sku', label: 'SKU / Código', required: true, type: 'text', example: 'Ej: DELL-XPS-001', description: 'Código único del producto en tu sistema. No puede repetirse.', include: true },
    { key: 'precio', label: 'Precio de Venta', required: true, type: 'number', example: 'Ej: 3500000', description: 'Precio de venta al público en la moneda de la empresa.', include: true },
    { key: 'categoria', label: 'Categoría', required: false, type: 'text', example: 'Ej: Tecnología', description: 'Categoría del producto. Se crea automáticamente si no existe.', include: true },
    { key: 'costo', label: 'Costo', required: false, type: 'number', example: 'Ej: 2800000', description: 'Costo de adquisición del producto.', include: true },
    { key: 'stock_inicial', label: 'Stock Inicial', required: false, type: 'number', example: 'Ej: 50', description: 'Cantidad inicial en inventario al importar.', include: true },
    { key: 'impuesto', label: 'IVA (%)', required: false, type: 'select', options: ['0','5','8','19'], example: 'Ej: 19', description: 'Porcentaje de IVA aplicable al producto.', include: true },
    { key: 'unidad', label: 'Unidad de Medida', required: false, type: 'select', options: ['UND','KG','MT','LT','HR','SRV'], example: 'Ej: UND', description: 'Unidad de medida del producto.', include: true },
    { key: 'descripcion', label: 'Descripción', required: false, type: 'text', example: 'Ej: Laptop para uso profesional', description: 'Descripción detallada del producto. Máximo 500 caracteres.', include: false },
    { key: 'estado', label: 'Estado', required: false, type: 'select', options: ['ACTIVE','INACTIVE'], example: 'Ej: ACTIVE', description: 'Estado inicial del producto al importarse.', include: false },
  ]);

  sampleRows = [
    { nombre_producto: 'Laptop Dell XPS 15', sku: 'DELL-XPS-001', categoria: 'Tecnología', precio: '3500000', costo: '2800000', stock_inicial: '10', impuesto: '19', unidad: 'UND', descripcion: 'Laptop profesional', estado: 'ACTIVE' },
    { nombre_producto: 'Monitor LG 27"', sku: 'LG-MON-27-001', categoria: 'Tecnología', precio: '950000', costo: '720000', stock_inicial: '15', impuesto: '19', unidad: 'UND', descripcion: '4K IPS', estado: 'ACTIVE' },
    { nombre_producto: 'Silla Ergonómica', sku: 'SILLA-ERG-001', categoria: 'Mobiliario', precio: '480000', costo: '320000', stock_inicial: '8', impuesto: '19', unidad: 'UND', descripcion: 'Soporte lumbar', estado: 'ACTIVE' },
  ];

  activeColumns = computed(() => this.columns().filter(c => c.include));
  activeCount = computed(() => this.columns().filter(c => c.include).length);

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
  ) {}

  toggleColumn(col: ColumnConfig) {
    if (col.required) return;
    this.columns.update(cols =>
      cols.map(c => c.key === col.key ? { ...c, include: !c.include } : c)
    );
  }

  downloadTemplate() {
    this.downloading.set(true);
    const activeKeys = this.activeColumns().map(c => c.key);

    this.http.post(
      `${environment.apiUrl}/import/template`,
      { columns: activeKeys },
      { responseType: 'blob' },
    ).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plantilla_productos_beccafact_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Plantilla descargada exitosamente');
      },
      error: () => {
        this.downloading.set(false);
        this.notify.error('Error al generar la plantilla');
      },
    });
  }
}
