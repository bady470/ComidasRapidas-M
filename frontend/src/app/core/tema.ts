import { Injectable } from '@angular/core';
import { urlServidor } from './empresa';

/** Ícono original de index.html, para volver a él fuera de una tienda. */
const ICONO_ORIGINAL = document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '';

/**
 * Aplica la marca del negocio a toda la app: colores, título de la pestaña, ícono y color de la barra del celular.
 * Los demás colores se derivan en styles.css a partir de --brand y --brand-2.
 */
@Injectable({ providedIn: 'root' })
export class Tema {
  aplicar(marca: { nombre: string; eslogan?: string; colorPrimario: string; colorSecundario: string; logoUrl: string | null }): void {
    const raiz = document.documentElement.style;
    raiz.setProperty('--brand', marca.colorPrimario);
    raiz.setProperty('--on-brand', textoSobre(marca.colorPrimario));
    raiz.setProperty('--brand-2', marca.colorSecundario);
    raiz.setProperty('--on-brand-2', textoSobre(marca.colorSecundario));

    meta('theme-color', marca.colorSecundario);
    if (marca.eslogan) meta('description', `${marca.nombre}: ${marca.eslogan}`);

    const icono = urlServidor(marca.logoUrl);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) { link.href = icono ?? ICONO_ORIGINAL; link.type = ''; }
  }

  /** Quita la marca de la empresa (páginas de la plataforma). */
  restablecer(): void {
    const raiz = document.documentElement.style;
    for (const v of ['--brand', '--on-brand', '--brand-2', '--on-brand-2']) raiz.removeProperty(v);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link && ICONO_ORIGINAL) link.href = ICONO_ORIGINAL;
  }
}

/** Blanco o casi negro, el que se lea mejor sobre el color dado. */
export function textoSobre(hex: string): string {
  return luminancia(hex) > 0.42 ? '#1D1A17' : '#FFFFFF';
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return 0.5;
  const canal = (i: number) => {
    const c = parseInt(limpio.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

function meta(nombre: string, contenido: string): void {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${nombre}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.name = nombre;
    document.head.appendChild(m);
  }
  m.content = contenido;
}
