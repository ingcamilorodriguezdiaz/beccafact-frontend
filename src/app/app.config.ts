import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  APP_INITIALIZER,
  LOCALE_ID,                          // ← agrega esto
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { apiResponseInterceptor } from './core/interceptors/api.interceptor';
import { branchInterceptor } from './core/interceptors/branch.interceptor';
import { AuthService } from './core/auth/auth.service';

registerLocaleData(localeEsCO);       // ← ejecuta antes del bootstrap

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions(), withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor, apiResponseInterceptor, branchInterceptor]),
    ),
    provideAnimations(),
    { provide: LOCALE_ID, useValue: 'es-CO' },   // ← registra el locale

    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.initSession(),
      deps: [AuthService],
      multi: true,
    },
  ],
};