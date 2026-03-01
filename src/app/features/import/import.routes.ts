import { Routes } from '@angular/router';

export const IMPORT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./import.component').then((m) => m.ImportComponent),
  },
  {
    path: 'template',
    loadComponent: () => import('./import-template.component').then((m) => m.ImportTemplateComponent),
  },
];
