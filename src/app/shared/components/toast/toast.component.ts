import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of notification.toasts(); track toast.id) {
        <div class="toast toast-{{ toast.type }}" (click)="notification.dismiss(toast.id)" role="alert">
          <div class="toast-icon-wrap">
            @if (toast.type === 'success') {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
            } @else if (toast.type === 'error') {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            } @else if (toast.type === 'warning') {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
            } @else {
              <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>
            }
          </div>
          <span class="toast-msg">{{ toast.message }}</span>
          <button class="toast-close" type="button" aria-label="Cerrar">
            <svg viewBox="0 0 14 14" fill="currentColor" width="12"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px; z-index: 9999;
    }
    .toast {
      display: flex; align-items: center; gap: 11px;
      padding: 13px 16px; border-radius: 11px; cursor: pointer;
      box-shadow: 0 6px 24px rgba(12,28,53,0.16); min-width: 300px; max-width: 440px;
      animation: toastIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: 1px solid transparent;
    }
    @keyframes toastIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }

    .toast-success {
      background: #fff; border-color: #a7f3d0;
      box-shadow: 0 6px 24px rgba(0,160,132,0.12);
    }
    .toast-success .toast-icon-wrap { color: #00c6a0; background: #e0faf4; }

    .toast-error {
      background: #fff; border-color: #fca5a5;
      box-shadow: 0 6px 24px rgba(239,68,68,0.12);
    }
    .toast-error .toast-icon-wrap { color: #ef4444; background: #fee2e2; }

    .toast-warning {
      background: #fff; border-color: #fcd34d;
      box-shadow: 0 6px 24px rgba(245,158,11,0.12);
    }
    .toast-warning .toast-icon-wrap { color: #f59e0b; background: #fef3c7; }

    .toast-info {
      background: #fff; border-color: #93c5fd;
      box-shadow: 0 6px 24px rgba(59,130,246,0.12);
    }
    .toast-info .toast-icon-wrap { color: #3b82f6; background: #dbeafe; }

    .toast-icon-wrap {
      width: 28px; height: 28px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .toast-msg { flex: 1; font-size: 13.5px; font-weight: 500; color: #0c1c35; }
    .toast-close {
      background: none; border: none; cursor: pointer; opacity: 0.4;
      display: flex; align-items: center; transition: opacity 0.15s;
      padding: 2px;
    }
    .toast-close:hover { opacity: 0.8; }
  `],
})
export class ToastComponent {
  constructor(protected notification: NotificationService) {}
}
