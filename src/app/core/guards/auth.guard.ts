import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Si la comprobación inicial ya terminó, decidir inmediatamente
  if (auth.authChecked()) {
    return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
  }

  // Todavía esperando /auth/me → esperar a que authChecked sea true
  return toObservable(auth.authChecked).pipe(
    filter(checked => checked),          // esperar hasta que sea true
    take(1),                             // solo una vez
    map(() =>
      auth.isAuthenticated()
        ? true
        : router.createUrlTree(['/auth/login'])
    ),
  );
};