import { Routes } from '@angular/router';

export const PURCHASING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./purchasing.component').then((m) => m.PurchasingComponent),
  },
];
