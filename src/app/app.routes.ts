import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { planGuard } from './core/guards/plan.guard';
import { companyStatusGuard } from './core/guards/company-status.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'super-admin',
    canActivate: [authGuard, superAdminGuard],
    loadChildren: () =>
      import('./features/super-admin/super-admin.routes').then((m) => m.SUPER_ADMIN_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard, companyStatusGuard],
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'invoices',
        canActivate: [planGuard],
        data: { feature: 'has_invoices' },
        loadChildren: () =>
          import('./features/invoices/invoices.routes').then((m) => m.INVOICE_ROUTES),
      },
      {
        path: 'inventory',
        canActivate: [planGuard],
        data: { feature: 'has_inventory' },
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'customers',
        loadChildren: () =>
          import('./features/customers/customers.routes').then((m) => m.CUSTOMER_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'import',
        canActivate: [planGuard, roleGuard],
        data: { feature: 'bulk_import', roles: ['ADMIN', 'MANAGER'] },
        loadChildren: () =>
          import('./features/import/import.routes').then((m) => m.IMPORT_ROUTES),
      },
      {
        path: 'cartera',
        canActivate: [planGuard, roleGuard],
        data: { feature: 'has_cartera', roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
        loadChildren: () =>
          import('./features/cartera/cartera.routes').then((m) => m.CARTERA_ROUTES),
      },
      {
        path: 'payroll',
        canActivate: [planGuard, roleGuard],
        data: { feature: 'has_payroll', roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
        loadChildren: () =>
          import('./features/payroll/payroll.routes').then((m) => m.PAYROLL_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'auth/login' },
];
