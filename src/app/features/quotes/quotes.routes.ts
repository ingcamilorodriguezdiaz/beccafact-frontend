import { Routes } from '@angular/router';

export const QUOTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./quotes.component').then((m) => m.QuotesComponent),
  },
];
