import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        notification.error('Sin conexión al servidor. Verifica tu conexión.');
      } else if (error.status === 403) {
        notification.error(error.error?.message || 'No tienes permisos para esta acción.');
      } else if (error.status === 404) {
        notification.error('Recurso no encontrado.');
      } else if (error.status === 422 || error.status === 400) {
        const msg = error.error?.message;
        if (Array.isArray(msg)) {
          msg.forEach((m: string) => notification.error(m));
        } else {
          notification.error(msg || 'Datos inválidos.');
        }
      } else if (error.status === 429) {
        notification.error('Demasiadas solicitudes. Espera un momento.');
      } else if (error.status >= 500) {
        notification.error('Error del servidor. Intenta nuevamente.');
      }

      return throwError(() => error);
    }),
  );
};
