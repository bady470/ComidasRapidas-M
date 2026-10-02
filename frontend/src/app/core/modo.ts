import { Injectable, signal } from '@angular/core';

export type ModoColor = 'claro' | 'oscuro';
const CLAVE = 'leinei:modo';

/** Modo claro u oscuro de toda la app. Se recuerda en este navegador; por defecto es claro. */
@Injectable({ providedIn: 'root' })
export class Modo {
  readonly actual = signal<ModoColor>('claro');

  iniciar(): void {
    let guardado: string | null = null;
    try { guardado = localStorage.getItem(CLAVE); } catch { /* sin almacenamiento */ }
    this.poner(guardado === 'oscuro' ? 'oscuro' : 'claro', false);
  }

  alternar(): void { this.poner(this.actual() === 'oscuro' ? 'claro' : 'oscuro'); }

  private poner(m: ModoColor, guardar = true): void {
    this.actual.set(m);
    document.documentElement.dataset['modo'] = m;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (meta) meta.content = m === 'oscuro' ? 'dark' : 'light';
    if (guardar) { try { localStorage.setItem(CLAVE, m); } catch { /* nada */ } }
  }
}
