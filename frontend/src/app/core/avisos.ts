import { Injectable, signal } from '@angular/core';

/** Mensajes cortos en la parte baja de la pantalla ("Pedido guardado"). */
@Injectable({ providedIn: 'root' })
export class Avisos {
  readonly texto = signal('');
  private t: ReturnType<typeof setTimeout> | undefined;

  mostrar(texto: string): void {
    this.texto.set(texto);
    clearTimeout(this.t);
    this.t = setTimeout(() => this.texto.set(''), 2800);
  }
}
