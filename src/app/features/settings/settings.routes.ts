import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings.component').then((m) => m.SettingsComponent),
    children: [
      {
        path: 'profile',
        loadComponent: () => import('./pages/settings-profile.component').then((m) => m.SettingsProfileComponent),
      },
      {
        path: 'company',
        loadComponent: () => import('./pages/settings-company.component').then((m) => m.SettingsCompanyComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/settings-users.component').then((m) => m.SettingsUsersComponent),
      },
      {
        path: 'billing',
        loadComponent: () => import('./pages/settings-billing.component').then((m) => m.SettingsBillingComponent),
      },
      {
        path: 'integrations',
        loadComponent: () => import('./pages/settings-integrations.component').then((m) => m.SettingsIntegrationsComponent),
      },
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
    ],
  },
];
