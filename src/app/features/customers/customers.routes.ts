import { Routes } from '@angular/router';
export const CUSTOMER_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./customers.component').then(m => m.CustomersComponent) }
];
