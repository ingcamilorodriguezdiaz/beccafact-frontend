import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiResponse } from '../../model/api-response.model';

export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {

  return next(req).pipe(
    map(event => {

      if (event instanceof HttpResponse) {

        const body = event.body as ApiResponse<any>;

        if (body && typeof body === 'object' && 'data' in body) {
          return event.clone({ body: body.data });
        }

      }

      return event;
    })
  );
};