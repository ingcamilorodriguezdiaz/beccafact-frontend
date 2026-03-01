import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];

  if (!allowedRoles.length) return true;
  if (auth.isSuperAdmin()) return true;

  const userRoles = auth.user()?.roles ?? [];
  const hasRole = allowedRoles.some((r) => userRoles.includes(r));

  if (hasRole) return true;
  return router.createUrlTree(['/dashboard']);
};
