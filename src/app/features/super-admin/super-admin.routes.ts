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
        path: 'integrations',
        loadComponent: () =>
          import('./pages/sa-integrations.component').then((m) => m.SaIntegrationsComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./pages/sa-audit.component').then((m) => m.SaAuditComponent),
      },
      {
        path: 'banks',
        loadComponent: () =>
          import('./pages/sa-banks.component').then((m) => m.SaBanksComponent),
      },
      {
        path: 'parameters',
        loadComponent: () =>
          import('./pages/sa-parameters.component').then((m) => m.SaParametersComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/sa-users.component').then((m) => m.SaUsersComponent),
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
