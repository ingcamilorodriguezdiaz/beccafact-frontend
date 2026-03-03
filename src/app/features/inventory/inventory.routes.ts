import { Routes } from '@angular/router';
export const INVENTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./inventory.component').then(m => m.InventoryComponent) }
];
