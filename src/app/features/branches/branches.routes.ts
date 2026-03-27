import { Routes } from '@angular/router';

export const BRANCHES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./branches.component').then((m) => m.BranchesComponent),
  },
];
