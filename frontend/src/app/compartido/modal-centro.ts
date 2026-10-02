import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { Icono } from './icono';

/**
 * Modal en el centro de la pantalla: fondo que se oscurece y difumina, y una tarjeta que entra con un pequeño rebote;
 * su contenido aparece en cascada. Se cierra con Esc, con la X o tocando el fondo (si es «cerrable»).
 * Quien pidió «reducir movimiento» en su sistema lo ve sin animación.
 */
@Component({
  selector: 'app-modal-centro',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mc-fondo" (click)="cerrable() && cerrar.emit()">
      <div #caja class="mc-caja" [class.mc-ancha]="ancha()" role="dialog" aria-modal="true" [attr.aria-label]="etiqueta()"
           tabindex="-1" (click)="$event.stopPropagation()" (keydown.escape)="cerrable() && cerrar.emit()">
        @if (cerrable()) { <button class="mc-x" type="button" aria-label="Cerrar" (click)="cerrar.emit()"><app-icono nombre="cerrar" [tam]="18" /></button> }
        @if (icono()) { <div class="mc-icono" aria-hidden="true"><app-icono [nombre]="icono()" [tam]="34" /></div> }
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalCentro {
  readonly etiqueta = input('');
  /** Nombre del ícono (ver icono.ts) que va grande arriba, en una burbuja con el color de la marca. */
  readonly icono = input('');
  readonly cerrable = input(true);
  readonly ancha = input(false);
  readonly cerrar = output<void>();

  private caja = viewChild.required<ElementRef<HTMLElement>>('caja');

  constructor() {
    // Mientras está abierto, la página de atrás no se desplaza.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => { document.body.style.overflow = anterior; });
    afterNextRender(() => this.caja().nativeElement.focus({ preventScroll: true }));
  }
}
