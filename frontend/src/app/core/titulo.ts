import { Injectable, inject } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { EstadoTienda } from './estado-tienda';

/** Pone en la pestaña el título de la página junto al nombre del negocio configurado. */
@Injectable({ providedIn: 'root' })
export class TituloTienda extends TitleStrategy {
  private estado = inject(EstadoTienda);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.estado.titular(this.buildTitle(snapshot) ?? '');
  }
}
