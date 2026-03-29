import { HttpInterceptorFn } from '@angular/common/http';

const BRANCH_KEY = 'active_branch_id';

export const branchInterceptor: HttpInterceptorFn = (req, next) => {
  const branchId = localStorage.getItem(BRANCH_KEY);

  if (!branchId) return next(req);

  return next(
    req.clone({ setHeaders: { 'X-Branch-Id': branchId } }),
  );
};
