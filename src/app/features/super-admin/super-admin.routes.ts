import { Routes } from '@angular/router';

export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./super-admin-layout.component').then((m) => m.SuperAdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/sa-dashboard.component').then((m) => m.SaDashboardComponent),
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./pages/sa-companies.component').then((m) => m.SaCompaniesComponent),
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('./pages/sa-plans.component').then((m) => m.SaPlansComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./pages/sa-audit.component').then((m) => m.SaAuditComponent),
      },
      {
        path: 'template',
        loadComponent: () =>
          import('./pages/sa-template.component').then((m) => m.SaTemplateComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
