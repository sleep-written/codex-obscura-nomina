import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'editor' },
  {
    path: 'editor',
    title: 'Editor',
    loadComponent: () => import('./pages/editor/editor').then(m => m.Editor),
  },
  { path: '**', redirectTo: 'editor' },
];
