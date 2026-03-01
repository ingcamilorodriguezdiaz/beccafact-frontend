import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string, duration = 4000) {
    this.add({ type: 'success', message, duration });
  }

  error(message: string, duration = 6000) {
    this.add({ type: 'error', message, duration });
  }

  warning(message: string, duration = 5000) {
    this.add({ type: 'warning', message, duration });
  }

  info(message: string, duration = 4000) {
    this.add({ type: 'info', message, duration });
  }

  dismiss(id: string) {
    this._toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private add(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    this._toasts.update((toasts) => [...toasts, { ...toast, id }]);
    if (toast.duration) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
  }
}
