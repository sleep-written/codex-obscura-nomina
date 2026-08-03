import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'songs' },
  {
    path: 'songs',
    title: 'Mis canciones',
    loadComponent: () => import('./pages/songs/songs').then(m => m.Songs),
  },
  // Sin id se edita lo que haya en el borrador (una canción nueva); con id se
  // abre esa canción de la biblioteca.
  {
    path: 'editor',
    title: 'Editor',
    loadComponent: () => import('./pages/editor/editor').then(m => m.Editor),
  },
  {
    path: 'editor/:id',
    title: 'Editor',
    loadComponent: () => import('./pages/editor/editor').then(m => m.Editor),
  },
  { path: '**', redirectTo: 'songs' },
];
