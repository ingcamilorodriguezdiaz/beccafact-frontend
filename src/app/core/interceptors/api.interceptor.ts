import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiResponse } from '../../model/api-response.model';

export const apiResponseInterceptor: HttpInterceptorFn = (req, next) => {

  return next(req).pipe(
    map(event => {

      if (event instanceof HttpResponse) {

        const {data} = event.body as ApiResponse<any>;
        console.log("camil ",data);
       
        if (data && data !== undefined) {
          return event.clone({
            body: data
          });
        }

      }

      return event;
    })
  );
};