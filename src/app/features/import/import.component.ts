import { Component, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface PreviewResult {
  totalRows: number; validRows: number; errorRows: number;
  previewRows: Record<string, unknown>[];
  errors: Array<{ row: number; field: string; message: string }>;
}
interface ImportJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';
  fileName: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  errors?: Array<{ row: number; field: string; message: string }>;
}

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="import-page animate-in">

      <div class="page-header">
        <div>
          <h2 class="page-title">Importación Masiva</h2>
          <p class="page-subtitle">Carga productos desde CSV o Excel — hasta 10MB</p>
        </div>
        <button class="btn btn-secondary" (click)="downloadTemplate()" [disabled]="downloadingTemplate()">
          @if (downloadingTemplate()) {
            <span class="btn-spinner"></span>
            Generando...
          } @else {
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/></svg>
            Descargar plantilla
          }
        </button>
      </div>

      <!-- Steps indicator -->
      <div class="steps-bar">
        @for (s of steps; track s.num) {
          <div class="step-item" [class.step-active]="currentStep() >= s.num" [class.step-done]="currentStep() > s.num">
            <div class="step-num">
              @if (currentStep() > s.num) {
                <svg viewBox="0 0 14 14" fill="currentColor" width="12"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              } @else {
                {{ s.num }}
              }
            </div>
            <span class="step-label">{{ s.label }}</span>
          </div>
          @if (s.num < steps.length) { <div class="step-line" [class.step-line-done]="currentStep() > s.num"></div> }
        }
      </div>

      <!-- Step 1: Upload -->
      <div class="import-card">
        <div class="ic-title">
          <span class="ic-num">1</span>
          Seleccionar archivo
        </div>

        <div class="drop-zone"
             [class.drag-over]="isDragOver()"
             [class.has-file]="selectedFile() !== null"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave()"
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" accept=".csv,.xlsx,.xls" style="display:none"
                 (change)="onFileSelected($event)" />
          @if (selectedFile(); as file) {
            <div class="file-info">
              <div class="fi-icon">
                <svg viewBox="0 0 20 20" fill="currentColor" width="28"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>
              </div>
              <div class="fi-details">
                <div class="fi-name">{{ file.name }}</div>
                <div class="fi-size">{{ formatSize(file.size) }}</div>
              </div>
              <button class="fi-remove" (click)="removeFile($event)" type="button">
                <svg viewBox="0 0 14 14" fill="currentColor" width="14"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
          } @else {
            <div class="drop-content">
              <div class="dc-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
              </div>
              <div class="dc-text">
                Arrastra tu archivo aquí
                <span>o haz clic para seleccionar</span>
              </div>
              <div class="dc-hint">CSV o XLSX · Máximo 10MB</div>
            </div>
          }
        </div>

        <button class="btn btn-primary" [disabled]="!selectedFile() || isPreviewing()"
                (click)="loadPreview()" type="button">
          @if (isPreviewing()) {
            <span class="btn-spinner"></span> Analizando...
          } @else {
            <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z"/><path fill-rule="evenodd" d="M10 3a7 7 0 100 14A7 7 0 0010 3zm-9 7a9 9 0 1118 0A9 9 0 011 10z"/></svg>
            Analizar archivo
          }
        </button>
      </div>

      <!-- Step 2: Preview -->
      @if (preview(); as prev) {
        <div class="import-card animate-in">
          <div class="ic-title">
            <span class="ic-num">2</span>
            Vista previa y validación
          </div>

          <div class="preview-stats">
            <div class="ps-item ps-total">
              <div class="ps-val">{{ prev.totalRows }}</div>
              <div class="ps-lbl">Total filas</div>
            </div>
            <div class="ps-item ps-valid">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" style="color:#00a084"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              <div class="ps-val">{{ prev.validRows }}</div>
              <div class="ps-lbl">Válidas</div>
            </div>
            <div class="ps-item ps-error">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" style="color:#dc2626"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
              <div class="ps-val">{{ prev.errorRows }}</div>
              <div class="ps-lbl">Errores</div>
            </div>
          </div>

          @if (prev.errors.length > 0) {
            <div class="errors-box">
              <div class="eb-header">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/></svg>
                <span>{{ prev.errors.length }} errores encontrados — solo se importarán filas válidas</span>
              </div>
              <div class="table-responsive">
                <table class="table">
                  <thead><tr><th>Fila</th><th>Campo</th><th>Problema</th></tr></thead>
                  <tbody>
                    @for (err of prev.errors.slice(0, 10); track err.row) {
                      <tr>
                        <td><span class="row-badge">{{ err.row }}</span></td>
                        <td><code class="field-code">{{ err.field }}</code></td>
                        <td>{{ err.message }}</td>
                      </tr>
                    }
                    @if (prev.errors.length > 10) {
                      <tr>
                        <td colspan="3" class="more-errors">
                          ...y {{ prev.errors.length - 10 }} errores más. Corrige el archivo y vuelve a cargar.
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @if (prev.previewRows.length > 0) {
            <div class="preview-table-section">
              <div class="preview-table-title">Vista previa — primeras filas</div>
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      @for (key of previewKeys(); track key) { <th>{{ key }}</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of prev.previewRows.slice(0, 8); track $index) {
                      <tr>
                        @for (key of previewKeys(); track key) {
                          <td>{{ asString(row[key]) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <div class="preview-actions">
            <button class="btn btn-secondary" (click)="resetUpload()" type="button">Cancelar</button>
            <button class="btn btn-primary" [disabled]="prev.validRows === 0 || isUploading()"
                    (click)="startImport()" type="button">
              @if (isUploading()) {
                <span class="btn-spinner"></span> Iniciando...
              } @else {
                <svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"/></svg>
                Importar {{ prev.validRows }} productos
              }
            </button>
          </div>
        </div>
      }

      <!-- Step 3: Progress -->
      @if (activeJob(); as job) {
        <div class="import-card animate-in">
          <div class="ic-title">
            <span class="ic-num">3</span>
            Procesando importación
          </div>

          <div class="job-progress">
            <div class="jp-header">
              <div class="jp-file">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" style="color:#7ea3cc"><path fill-rule="evenodd" d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/><path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3z"/></svg>
                {{ job.fileName }}
              </div>
              <span class="status-chip status-{{ job.status.toLowerCase() }}">{{ statusLabel(job.status) }}</span>
            </div>

            <div class="jp-bar-wrap">
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="jobProgress()"
                     [class.danger]="job.status === 'ERROR'"></div>
              </div>
              <span class="jp-pct">{{ jobProgress() }}%</span>
            </div>

            <div class="jp-stats">
              <div class="jps-item">
                <span class="jps-num">{{ job.processedRows }}</span>
                <span class="jps-lbl">de {{ job.totalRows }} procesadas</span>
              </div>
              <div class="jps-item jps-success">
                <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
                <span class="jps-num">{{ job.successRows }}</span> exitosas
              </div>
              @if (job.errorRows > 0) {
                <div class="jps-item jps-error">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg>
                  <span class="jps-num">{{ job.errorRows }}</span> errores
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- History -->
      <div class="import-card">
        <div class="ic-title">
          <svg viewBox="0 0 20 20" fill="currentColor" width="17" style="color:#7ea3cc"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
          Historial de importaciones
        </div>

        @if (history().length === 0) {
          <div class="empty-history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" style="color:#dce6f0">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
            <p>No hay importaciones anteriores</p>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Archivo</th><th>Estado</th><th>Total</th>
                  <th>Exitosas</th><th>Errores</th><th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                @for (job of history(); track job.id) {
                  <tr>
                    <td>
                      <div class="hist-file">
                        <svg viewBox="0 0 16 16" fill="currentColor" width="13" style="color:#9ab5cc"><path fill-rule="evenodd" d="M4 1.5H3a2 2 0 00-2 2V14a2 2 0 002 2h10a2 2 0 002-2V3.5a2 2 0 00-2-2h-1v1h1a1 1 0 011 1V14a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1h1v-1z"/></svg>
                        {{ job.fileName }}
                      </div>
                    </td>
                    <td><span class="status-chip status-{{ job.status.toLowerCase() }}">{{ statusLabel(job.status) }}</span></td>
                    <td>{{ job.totalRows }}</td>
                    <td><span class="num-success">{{ job.successRows }}</span></td>
                    <td><span class="num-error" [class.hide-zero]="job.errorRows === 0">{{ job.errorRows }}</span></td>
                    <td class="hist-date">{{ job.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .import-page { max-width: 900px; }

    /* Steps bar */
    .steps-bar {
      display: flex; align-items: center; margin-bottom: 24px;
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: 13px; padding: 18px 24px;
      box-shadow: var(--shadow-sm);
    }
    .step-item { display: flex; align-items: center; gap: 9px; }
    .step-num {
      width: 26px; height: 26px; border-radius: 50%; border: 2px solid #dce6f0;
      background: #f0f4f9; color: #9ab5cc; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; flex-shrink: 0;
    }
    .step-item.step-active .step-num { background: #1a407e; border-color: #1a407e; color: #fff; }
    .step-item.step-done .step-num   { background: #00c6a0; border-color: #00c6a0; color: #fff; }
    .step-label { font-size: 13px; font-weight: 600; color: #9ab5cc; white-space: nowrap; }
    .step-item.step-active .step-label { color: #1a407e; }
    .step-item.step-done .step-label   { color: #00a084; }
    .step-line {
      flex: 1; height: 1px; background: #dce6f0; margin: 0 14px; transition: background 0.3s;
    }
    .step-line.step-line-done { background: #00c6a0; }

    /* Import card */
    .import-card {
      background: var(--surface,#fff); border: 1px solid var(--border,#dce6f0);
      border-radius: 13px; padding: 24px; margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .ic-title {
      display: flex; align-items: center; gap: 10px;
      font-family: 'Sora',sans-serif; font-size: 15px; font-weight: 700;
      color: #0c1c35; margin-bottom: 20px;
    }
    .ic-num {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      color: #fff; font-size: 12px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }

    /* Drop zone */
    .drop-zone {
      border: 2px dashed #c8d8eb; border-radius: 12px; padding: 40px 24px;
      text-align: center; cursor: pointer; transition: all 0.2s;
      background: #f8fbfd; margin-bottom: 18px;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #1a407e; background: #e8eef8; cursor: pointer;
    }
    .drop-zone.has-file { border-color: #00c6a0; background: #f0fdf9; cursor: default; }
    .dc-icon {
      width: 56px; height: 56px; border-radius: 14px; background: #e8eef8;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 16px; color: #1a407e;
    }
    .dc-icon svg { width: 28px; height: 28px; }
    .dc-text { font-size: 14.5px; font-weight: 600; color: #0c1c35; margin-bottom: 6px; }
    .dc-text span { display: block; color: #1a407e; font-weight: 700; margin-top: 2px; }
    .dc-hint { font-size: 12.5px; color: #9ab5cc; }
    .file-info { display: flex; align-items: center; gap: 14px; text-align: left; }
    .fi-icon { width: 48px; height: 48px; border-radius: 10px; background: #e8eef8; display: flex; align-items: center; justify-content: center; color: #1a407e; flex-shrink: 0; }
    .fi-name { font-weight: 700; color: #0c1c35; font-size: 14px; }
    .fi-size { font-size: 12px; color: #7ea3cc; margin-top: 2px; }
    .fi-remove { margin-left: auto; background: none; border: none; cursor: pointer; color: #9ab5cc; display: flex; padding: 4px; border-radius: 5px; transition: all 0.15s; }
    .fi-remove:hover { color: #dc2626; background: #fee2e2; }

    .btn-spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Preview stats */
    .preview-stats {
      display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .ps-item {
      flex: 1; min-width: 110px; padding: 16px 20px; border-radius: 10px;
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 5px;
    }
    .ps-total { background: #f0f4f9; }
    .ps-valid { background: #e0faf4; }
    .ps-error { background: #fee2e2; }
    .ps-val { font-family: 'Sora',sans-serif; font-size: 28px; font-weight: 800; color: #0c1c35; line-height: 1; }
    .ps-lbl { font-size: 12.5px; color: #7ea3cc; font-weight: 600; }

    /* Errors box */
    .errors-box {
      background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;
      margin-bottom: 20px; overflow: hidden;
    }
    .eb-header {
      display: flex; align-items: center; gap: 9px;
      padding: 12px 16px; background: #fef3c7;
      font-size: 13px; font-weight: 700; color: #92400e;
      border-bottom: 1px solid #fcd34d;
    }
    .row-badge {
      background: #f0f4f9; color: #3d5a80; padding: 2px 8px;
      border-radius: 5px; font-size: 12px; font-weight: 700;
    }
    .field-code {
      background: #f0f4f9; color: #1a407e; padding: 2px 8px;
      border-radius: 5px; font-size: 12px; font-family: monospace;
    }
    .more-errors { text-align: center; padding: 12px; color: #92400e; font-size: 13px; font-weight: 600; }

    .preview-table-section { margin-top: 20px; }
    .preview-table-title { font-size: 13.5px; font-weight: 700; color: #3d5a80; margin-bottom: 10px; }
    .preview-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 22px; }

    /* Job progress */
    .job-progress { display: flex; flex-direction: column; gap: 14px; }
    .jp-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .jp-file { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #0c1c35; }
    .jp-bar-wrap { display: flex; align-items: center; gap: 12px; }
    .jp-bar-wrap .progress-track { flex: 1; }
    .jp-pct { font-size: 13px; font-weight: 700; color: #0c1c35; min-width: 34px; text-align: right; }
    .jp-stats { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .jps-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #7ea3cc; }
    .jps-num { font-weight: 700; color: #0c1c35; font-size: 14px; }
    .jps-success { color: #00a084; }
    .jps-success .jps-num { color: #00a084; }
    .jps-error { color: #dc2626; }
    .jps-error .jps-num { color: #dc2626; }

    /* Status chips */
    .status-chip {
      display: inline-flex; align-items: center; padding: 3px 10px;
      border-radius: 9999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.03em;
    }
    .status-pending    { background: #fef3c7; color: #92400e; }
    .status-processing { background: var(--brand-light,#e8eef8); color: var(--brand,#1a407e); }
    .status-completed  { background: var(--accent-light,#e0faf4); color: var(--accent-dark,#00a084); }
    .status-error      { background: #fee2e2; color: #991b1b; }
    .status-cancelled  { background: #f0f4f9; color: #7ea3cc; }

    /* History */
    .hist-file { display: flex; align-items: center; gap: 7px; font-weight: 500; }
    .hist-date { color: #9ab5cc; font-size: 13px; white-space: nowrap; }
    .num-success { color: #00a084; font-weight: 700; }
    .num-error   { color: #dc2626; font-weight: 700; }
    .num-error.hide-zero { color: #c8d8eb; }

    /* Empty */
    .empty-history { text-align: center; padding: 36px; color: #c8d8eb; }
    .empty-history p { margin-top: 12px; font-size: 14px; color: #9ab5cc; }
  `],
})
export class ImportComponent implements OnDestroy {
  private readonly API = `${environment.apiUrl}/import`;
  private pollInterval?: ReturnType<typeof setInterval>;
downloadingReport = signal<string | null>(null);
  steps = [
    { num: 1, label: 'Seleccionar archivo' },
    { num: 2, label: 'Vista previa' },
    { num: 3, label: 'Procesando' },
  ];

  selectedFile  = signal<File | null>(null);
  isDragOver    = signal(false);
  isPreviewing  = signal(false);
  isUploading   = signal(false);
  downloadingTemplate = signal(false);
  preview       = signal<PreviewResult | null>(null);
  activeJob     = signal<ImportJob | null>(null);
  history       = signal<ImportJob[]>([]);

  previewKeys = computed(() => {
    const rows = this.preview()?.previewRows ?? [];
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  });
  jobProgress = computed(() => {
    const job = this.activeJob();
    if (!job || job.totalRows === 0) return 0;
    return Math.round((job.processedRows / job.totalRows) * 100);
  });
  currentStep = computed(() => {
    if (this.activeJob()) return 3;
    if (this.preview()) return 2;
    return 1;
  });

  constructor(private http: HttpClient, private notification: NotificationService) {
    this.loadHistory();
  }
  ngOnDestroy() { if (this.pollInterval) clearInterval(this.pollInterval); }

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragOver.set(true); }
  onDragLeave() { this.isDragOver.set(false); }
  onDrop(e: DragEvent) {
    e.preventDefault(); this.isDragOver.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.setFile(file);
  }
  onFileSelected(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.setFile(f);
  }
  setFile(file: File) {
    if (file.size > 10 * 1024 * 1024) { this.notification.error('El archivo supera el límite de 10MB'); return; }
    this.selectedFile.set(file); this.preview.set(null);
  }
  removeFile(e: Event) { e.stopPropagation(); this.resetUpload(); }
  resetUpload() { this.selectedFile.set(null); this.preview.set(null); }

  loadPreview() {
    const file = this.selectedFile();
    if (!file) return;
    this.isPreviewing.set(true);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${this.API}/preview`, fd).subscribe({
      next: (res) => { this.preview.set(res.data ?? res); this.isPreviewing.set(false); },
      error: () => { this.isPreviewing.set(false); this.notification.error('Error al analizar el archivo'); },
    });
  }
  startImport() {
    const file = this.selectedFile();
    if (!file) return;
    this.isUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${this.API}/upload`, fd).subscribe({
      next: (res) => {
        this.isUploading.set(false);
        const job: ImportJob = res.data ?? res;
        this.activeJob.set(job);
        this.notification.success('Importación iniciada — procesando en segundo plano...');
        this.pollJobStatus(job.id);
      },
      error: () => { this.isUploading.set(false); this.notification.error('Error al iniciar la importación'); },
    });
  }
  pollJobStatus(jobId: string) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.http.get<any>(`${this.API}/${jobId}/status`).subscribe({
        next: (res) => {
          const job: ImportJob = res.data ?? res;
          this.activeJob.set(job);
          if (['COMPLETED', 'ERROR', 'CANCELLED'].includes(job.status)) {
            clearInterval(this.pollInterval);
            this.loadHistory();
            if (job.status === 'COMPLETED') this.notification.success(`✅ ${job.successRows} productos importados exitosamente`);
            else if (job.status === 'ERROR') this.notification.error('La importación terminó con errores');
          }
        },
      });
    }, 2000);
  }
  loadHistory() {
    this.http.get<any>(`${this.API}/history`).subscribe({
      next: (res) => {
        const list = res.data?.data ?? res.data ?? [];
        this.history.set(Array.isArray(list) ? list : []);
      },
    });
  }
  asString(val: unknown): string { return val === null || val === undefined ? '' : String(val); }

  downloadTemplate() {
    this.downloadingTemplate.set(true);
    this.http.post(`${this.API}/template`, {}, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href  = url;
        link.download = `plantilla-importacion-${new Date().toISOString().slice(0,10)}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingTemplate.set(false);
        this.notification.success('Plantilla descargada correctamente');
      },
      error: () => {
        this.downloadingTemplate.set(false);
        this.notification.error('Error al generar la plantilla');
      },
    });
  }
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  statusLabel(status: string): string {
    return { PENDING:'Pendiente', PROCESSING:'Procesando', COMPLETED:'Completado', ERROR:'Error', CANCELLED:'Cancelado' }[status] ?? status;
  }

  downloadErrorReport(job: ImportJob) {
  this.downloadingReport.set(job.id);
  this.http.get(`${this.API}/${job.id}/error-report`, { responseType: 'blob' }).subscribe({
    next: (blob) => {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `errores-${job.fileName.replace(/\.[^.]+$/, '')}-${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.downloadingReport.set(null);
      this.notification.success('Reporte de errores descargado');
    },
    error: () => {
      this.downloadingReport.set(null);
      this.notification.error('Error al generar el reporte');
    },
  });
}
}
