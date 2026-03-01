import { Injectable, signal, inject } from '@angular/core';
import { NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _count = 0;
  private _isLoading = signal(false);
  private zone = inject(NgZone);
  readonly isLoading = this._isLoading.asReadonly();

  show() {
    this.zone.run(() => {
      this._count++;
      this._isLoading.set(true);
    });
  }

  hide() {
    this.zone.run(() => {
      this._count = Math.max(0, this._count - 1);
      if (this._count === 0) this._isLoading.set(false);
    });
  }
}