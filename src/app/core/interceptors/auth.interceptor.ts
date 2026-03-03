import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  switchMap,
  throwError,
  BehaviorSubject,
  filter,
  take,
  EMPTY,
} from 'rxjs';
import { AuthService } from '../auth/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth  = inject(AuthService);
  const token = auth.getAccessToken();
  const authReq = token ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        return handle401Error(req, next, auth);
      }
      return throwError(() => error);
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string) {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
) {
  const refreshStream = auth.refreshToken();
  if (refreshStream === EMPTY) {
    auth.logout();
    return EMPTY;
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return refreshStream.pipe(
      switchMap((tokens: { accessToken: string; refreshToken: string }) => {
        isRefreshing = false;
        refreshTokenSubject.next(tokens.accessToken);
        return next(addToken(req, tokens.accessToken));
      }),
      catchError((err) => {
        isRefreshing = false;
        auth.logout();
        return throwError(() => err);
      }),
    );
  }

  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null),
    take(1),
    switchMap((token) => next(addToken(req, token))),
  );
}