import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const planGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredFeature = route.data['feature'] as string | undefined;

  if (!requiredFeature) return true;
  if (auth.isSuperAdmin()) return true;

  const features = auth.planFeatures();
  const val = features[requiredFeature];
  const hasFeature = val !== undefined && val !== 'false' && val !== '0';

  if (hasFeature) return true;

  return router.createUrlTree(['/dashboard'], {
    queryParams: { upgrade: true, feature: requiredFeature },
  });
};
