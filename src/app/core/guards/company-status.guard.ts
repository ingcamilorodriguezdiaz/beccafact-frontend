import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const companyStatusGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();

  if (!user || auth.isSuperAdmin()) return true;

  const status = user.company?.status;
  if (status === 'SUSPENDED') {
    return router.createUrlTree(['/auth/suspended']);
  }
  if (status === 'CANCELLED') {
    return router.createUrlTree(['/auth/cancelled']);
  }

  return true;
};
