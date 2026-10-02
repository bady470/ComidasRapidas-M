import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { Modo } from './core/modo';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { routes } from './app.routes';
import { EmpresaActual } from './core/empresa';
import { tokenInterceptor } from './core/sesion';
import { TituloTienda } from './core/titulo';

registerLocaleData(localeEsCo);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withFetch(), withInterceptors([tokenInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: TitleStrategy, useClass: TituloTienda },
    // Antes de la primera navegación: ¿este dominio es el dominio propio de una empresa?
    provideAppInitializer(() => inject(Modo).iniciar()),
    provideAppInitializer(() => inject(EmpresaActual).resolverDominio()),
  ],
};
