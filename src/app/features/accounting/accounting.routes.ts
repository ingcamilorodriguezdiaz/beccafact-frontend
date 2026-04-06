import { Routes } from '@angular/router';

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./accounting.component').then((m) => m.AccountingComponent),
  },
];
