import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,  // 👈 añade esto
  template: `
    @if (loading.isLoading()) {
      <div class="loader-bar" aria-label="Cargando"></div>
    }
  `,
  styles: [`
    .loader-bar {
      position: fixed; top: 0; left: 0; right: 0;
      height: 3px; z-index: 9999;
      background: linear-gradient(90deg, #1a407e 0%, #00c6a0 50%, #1a407e 100%);
      background-size: 200% 100%;
      animation: loaderAnim 1.2s ease infinite;
    }
    @keyframes loaderAnim {
      0%   { background-position: -100% 0; }
      100% { background-position:  200% 0; }
    }
  `],
})
export class GlobalLoaderComponent {
  constructor(protected loading: LoadingService) {}
}