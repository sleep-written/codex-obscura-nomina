import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { usesHashRouting } from './shared/native/platform';
import { BrandedTitleStrategy } from './shared/services/app-title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Path en web, hash empaquetado — ver `usesHashRouting()`.
    provideRouter(routes, ...(usesHashRouting() ? [withHashLocation()] : [])),
    { provide: TitleStrategy, useClass: BrandedTitleStrategy }
  ]
};
