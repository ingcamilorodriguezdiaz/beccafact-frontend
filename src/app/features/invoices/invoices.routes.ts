// invoices.routes.ts
import { Routes } from '@angular/router';
export const INVOICE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./invoices-list.component').then(m => m.InvoicesListComponent) }
];
