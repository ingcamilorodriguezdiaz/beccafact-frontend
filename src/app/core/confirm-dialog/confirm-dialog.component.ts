import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * ConfirmDialogComponent
 * ──────────────────────
 * Componente standalone reutilizable para reemplazar confirm() y prompt() nativos.
 *
 * Soporta dos modos:
 *   • 'confirm'  — muestra título + mensaje + botones Cancelar / Confirmar
 *   • 'prompt'   — igual que confirm pero añade un campo de texto obligatorio
 *
 * Uso en cualquier componente padre:
 *
 *   // 1. Importar en el componente que lo usa
 *   imports: [ConfirmDialogComponent]
 *
 *   // 2. En el template
 *   <app-confirm-dialog />
 *
 *   // 3. En la clase, inyectar el servicio
 *   dialog = inject(ConfirmDialogService);
 *
 *   // Confirm simple
 *   this.dialog.confirm({
 *     title:   '¿Eliminar empleado?',
 *     message: 'Esta acción no se puede deshacer.',
 *     danger:  true,
 *     confirmLabel: 'Eliminar',
 *   }).then(ok => { if (ok) ... });
 *
 *   // Prompt (con campo de texto)
 *   this.dialog.prompt({
 *     title:       '¿Motivo de anulación?',
 *     message:     'Ingresa el motivo para continuar.',
 *     placeholder: 'Escribe el motivo…',
 *     confirmLabel:'Anular',
 *     danger:      true,
 *   }).then(value => { if (value !== null) ... });
 */

// ── Opciones del diálogo ────────────────────────────────────────────────────

export interface ConfirmOptions {
  title:         string;
  message?:      string;
  /** Texto adicional de detalle (se muestra en gris pequeño) */
  detail?:       string;
  confirmLabel?: string;   // default: 'Confirmar'
  cancelLabel?:  string;   // default: 'Cancelar'
  /** Colorea el botón de confirmar en rojo */
  danger?:       boolean;
  /** Ícono Material Symbols en el encabezado */
  icon?:         string;
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?:  string;
  /** Texto inicial del campo */
  initialValue?: string;
  /** Etiqueta del campo */
  inputLabel?:   string;
  /** Tipo de entrada a mostrar en el prompt */
  inputType?:    'text' | 'textarea' | 'select' | 'date';
  /** Opciones para prompts tipo select */
  options?: Array<{ label: string; value: string }>;
  /** Permite confirmar el diálogo aunque el valor esté vacío */
  allowEmpty?: boolean;
}

// ── Servicio del diálogo ────────────────────────────────────────────────────

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  // Estado interno compartido con el componente
  _visible   = signal(false);
  _mode      = signal<'confirm' | 'prompt'>('confirm');
  _opts      = signal<ConfirmOptions & PromptOptions>({} as any);
  _inputVal  = signal('');

  private _resolve!: (v: any) => void;

  /** Abre un diálogo de confirmación. Devuelve true si el usuario confirma. */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    return this._open('confirm', opts);
  }

  /** Abre un diálogo con campo de texto. Devuelve el string ingresado o null si cancela. */
  prompt(opts: PromptOptions): Promise<string | null> {
    return this._open('prompt', opts);
  }

  private _open(mode: 'confirm' | 'prompt', opts: any): Promise<any> {
    this._mode.set(mode);
    this._opts.set(opts);
    this._inputVal.set(opts.initialValue ?? '');
    this._visible.set(true);
    return new Promise(res => { this._resolve = res; });
  }

  _confirm() {
    const val = this._mode() === 'prompt' ? this._inputVal() : true;
    this._visible.set(false);
    if (this._mode() === 'prompt') {
      const allowEmpty = !!this._opts().allowEmpty;
      const normalized = typeof val === 'string' ? val : '';
      this._resolve(!allowEmpty && !normalized.trim() ? null : normalized);
      return;
    }
    this._resolve(true);
  }

  _cancel() {
    this._visible.set(false);
    this._resolve(this._mode() === 'prompt' ? null : false);
  }
}

// ── Componente visual ───────────────────────────────────────────────────────

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />

    @if (svc._visible()) {
      <div class="cd-overlay" role="dialog" aria-modal="true">
        <div class="cd-box" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="cd-header" [class.cd-header--danger]="svc._opts().danger">
            @if (svc._opts().icon) {
              <span class="material-symbols-outlined cd-icon">{{ svc._opts().icon }}</span>
            } @else if (svc._opts().danger) {
              <span class="material-symbols-outlined cd-icon">warning</span>
            } @else {
              <span class="material-symbols-outlined cd-icon cd-icon--info">help</span>
            }
            <h3 class="cd-title">{{ svc._opts().title }}</h3>
            <button class="cd-close" (click)="svc._cancel()" aria-label="Cerrar">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="cd-body">
            @if (svc._opts().message) {
              <p class="cd-message">{{ svc._opts().message }}</p>
            }
            @if (svc._opts().detail) {
              <p class="cd-detail">{{ svc._opts().detail }}</p>
            }
            @if (svc._mode() === 'prompt') {
              <div class="cd-field">
                @if (svc._opts().inputLabel) {
                  <label class="cd-field__label">{{ svc._opts().inputLabel }}</label>
                }
                @if (svc._opts().inputType === 'textarea') {
                  <textarea
                    class="cd-field__input cd-field__textarea"
                    [placeholder]="svc._opts().placeholder ?? ''"
                    [(ngModel)]="inputValue"
                    rows="4"
                    autofocus
                  ></textarea>
                } @else if (svc._opts().inputType === 'select') {
                  <select class="cd-field__input" [(ngModel)]="inputValue" autofocus>
                    @for (option of svc._opts().options ?? []; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                } @else {
                  <input
                    class="cd-field__input"
                    [type]="svc._opts().inputType === 'date' ? 'date' : 'text'"
                    [placeholder]="svc._opts().placeholder ?? ''"
                    [(ngModel)]="inputValue"
                    (keydown.enter)="onEnter()"
                    #inputRef
                    autofocus
                  />
                }
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="cd-footer">
            <button class="cd-btn cd-btn--cancel" (click)="svc._cancel()">
              {{ svc._opts().cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              class="cd-btn"
              [class.cd-btn--danger]="svc._opts().danger"
              [class.cd-btn--primary]="!svc._opts().danger"
              [disabled]="svc._mode() === 'prompt' && !svc._opts().allowEmpty && !inputValue.trim()"
              (click)="svc._confirm()"
            >
              {{ svc._opts().confirmLabel ?? 'Confirmar' }}
            </button>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    /* Overlay */
    .cd-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(12, 28, 53, .45);
      backdrop-filter: blur(2px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
      animation: cd-fade-in .15s ease;
    }
    @keyframes cd-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* Box */
    .cd-box {
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(12,28,53,.18), 0 4px 16px rgba(0,0,0,.08);
      width: 100%; max-width: 420px;
      display: flex; flex-direction: column;
      animation: cd-slide-up .18s ease;
      overflow: hidden;
    }
    @keyframes cd-slide-up {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    /* Header */
    .cd-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #f0f4f8;
    }
    .cd-header--danger { background: #fff8f8; border-bottom-color: #fee2e2; }
    .cd-icon {
      font-size: 22px; flex-shrink: 0;
      color: #dc2626;  /* danger por defecto */
    }
    .cd-icon--info { color: #1a407e; }
    .cd-title {
      flex: 1;
      font-family: 'Sora', sans-serif;
      font-size: 15px; font-weight: 700;
      color: #0c1c35; margin: 0;
    }
    .cd-close {
      background: none; border: none; cursor: pointer;
      color: #94a3b8; padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: background .12s;
    }
    .cd-close:hover { background: #f0f4f8; color: #475569; }
    .cd-close .material-symbols-outlined { font-size: 18px; }

    /* Body */
    .cd-body { padding: 16px 20px; }
    .cd-message {
      font-size: 14px; color: #374151; line-height: 1.55;
      margin: 0 0 8px;
    }
    .cd-detail {
      font-size: 12.5px; color: #94a3b8; line-height: 1.5;
      margin: 0;
    }

    /* Prompt field */
    .cd-field { margin-top: 12px; }
    .cd-field__label {
      display: block;
      font-size: 12.5px; font-weight: 600; color: #475569;
      margin-bottom: 5px;
    }
    .cd-field__input {
      width: 100%; box-sizing: border-box;
      padding: 9px 12px;
      border: 1.5px solid #dce6f0; border-radius: 8px;
      font-size: 13.5px; color: #0c1c35;
      outline: none; transition: border-color .15s, box-shadow .15s;
    }
    .cd-field__input:focus {
      border-color: #1a407e;
      box-shadow: 0 0 0 3px rgba(26,64,126,.09);
    }
    .cd-field__textarea {
      min-height: 96px;
      resize: vertical;
      font-family: inherit;
      line-height: 1.5;
    }

    /* Footer */
    .cd-footer {
      padding: 14px 20px;
      border-top: 1px solid #f0f4f8;
      display: flex; justify-content: flex-end; gap: 10px;
    }

    /* Buttons */
    .cd-btn {
      padding: 8px 20px; border-radius: 8px;
      font-size: 13.5px; font-weight: 600;
      border: none; cursor: pointer;
      transition: background .14s, opacity .14s;
    }
    .cd-btn:disabled { opacity: .45; cursor: default; }
    .cd-btn--cancel {
      background: #f0f4f9; color: #374151;
      border: 1px solid #dce6f0;
    }
    .cd-btn--cancel:hover { background: #e8eef8; }
    .cd-btn--primary { background: #1a407e; color: #fff; }
    .cd-btn--primary:hover:not(:disabled) { background: #133265; }
    .cd-btn--danger { background: #dc2626; color: #fff; }
    .cd-btn--danger:hover:not(:disabled) { background: #b91c1c; }

    /* Mobile */
    @media (max-width: 480px) {
      .cd-overlay { align-items: flex-end; padding: 0; }
      .cd-box { border-radius: 20px 20px 0 0; max-width: 100%; }
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(public svc: ConfirmDialogService) {}

  // Two-way binding para el input del prompt
  get inputValue(): string  { return this.svc._inputVal(); }
  set inputValue(v: string) { this.svc._inputVal.set(v); }

  onEnter() {
    if (
      this.svc._mode() === 'prompt' &&
      this.svc._opts().inputType !== 'textarea' &&
      (this.svc._opts().allowEmpty || this.inputValue.trim())
    ) {
      this.svc._confirm();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.svc._cancel(); }
}
