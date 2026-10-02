import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Icono } from '../compartido/icono';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { InfoPlantilla, PLANTILLAS, Plantilla, plantillaDe } from '../core/modelos';

/**
 * Plantillas de la tienda: el negocio escoge cómo ven los clientes su menú. Cada una se puede probar en vivo
 * (la tienda real dentro de un celular o un computador, con ?plantilla=…) antes de aplicarla.
 */
@Component({
  selector: 'app-plantillas',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pt-intro">
      <div>
        <h2>Escoge cómo se ve tu tienda</h2>
        <p class="muted">Tus productos, precios y pedidos no cambian: solo la forma en que tus clientes ven el menú.
          Pruébalas en vivo y aplica la que más te guste; el cambio les llega al instante.</p>
      </div>
      <a class="btn" [href]="emp.url()" target="_blank" rel="noopener"><app-icono nombre="externo" /> Ver mi tienda</a>
    </div>

    @if (error() && !vista()) { <div class="alerta mala">{{ error() }}</div> }

    <div class="pt-grid">
      @for (p of plantillas; track p.clave) {
        <article class="pt-card" [class.actual]="actual() === p.clave" [class.elegida]="vista() === p.clave">
          <button class="pt-mini" type="button" (click)="ver(p.clave)" [attr.aria-label]="'Ver en vivo la plantilla ' + p.nombre"
                  [style.--pt-fondo]="p.muestra.fondo" [style.--pt-tarjeta]="p.muestra.tarjeta" [style.--pt-texto]="p.muestra.texto">
            @switch (p.clave) {
              @case ('CLASICA') {
                <span class="m-hero"><i class="m-l w60"></i><i class="m-l w40"></i><i class="m-btn"></i><span class="m-fotos"><i></i><i></i></span></span>
                <span class="m-fila"><i class="m-l w50"></i><i class="m-foto"></i></span>
                <span class="m-fila"><i class="m-l w40"></i><i class="m-foto"></i></span>
              }
              @case ('VITRINA') {
                <span class="m-hero bajo"><i class="m-l w50"></i><i class="m-btn"></i></span>
                <span class="m-tarjetas"><i></i><i></i><i></i><i></i></span>
              }
              @case ('EXPRESS') {
                <span class="m-tira"><i class="m-l w40"></i><i class="m-pild"></i></span>
                <span class="m-chips"><i></i><i></i><i></i><i></i></span>
                @for (i of [1, 2, 3, 4]; track i) { <span class="m-fila corta"><i class="m-foto chica"></i><i class="m-l w50"></i></span> }
              }
              @case ('ELEGANTE') {
                <span class="m-hero centro"><i class="m-l w50"></i><i class="m-l w30"></i></span>
                @for (i of [1, 2, 3]; track i) { <span class="m-carta"><i class="m-l w30"></i><i class="m-puntos"></i><i class="m-l w10"></i></span> }
              }
            }
            <span class="pt-ver"><app-icono nombre="ojo" [tam]="16" /> Ver en vivo</span>
          </button>
          <div class="pt-info">
            <div class="pt-titulo">
              <h3>{{ p.nombre }}</h3>
              @if (actual() === p.clave) { <span class="pt-uso"><app-icono nombre="ok" [tam]="14" /> En uso</span> }
            </div>
            <p>{{ p.descripcion }}</p>
            <span class="pt-ideal"><app-icono nombre="chispa" [tam]="14" /> {{ p.idealPara }}</span>
          </div>
          <div class="pt-acciones">
            <button class="btn" type="button" (click)="ver(p.clave)"><app-icono nombre="ojo" /> Probar</button>
            @if (actual() !== p.clave) {
              <button class="btn main" type="button" (click)="aplicar(p)" [disabled]="guardando()">Usar esta</button>
            }
          </div>
        </article>
      }
    </div>

    @if (vista(); as v) {
      <section class="pt-vivo" aria-label="Vista previa en vivo">
        <header class="pt-vivo-h">
          <div>
            <h3>Vista previa · {{ info(v).nombre }}</h3>
            <p class="muted">Es tu tienda real: puedes tocar, buscar y abrir productos. Nada se guarda hasta que la apliques.</p>
          </div>
          <div class="pt-vivo-acc">
            <div class="seg" role="group" aria-label="Tamaño de la vista previa">
              <button type="button" [attr.aria-pressed]="pantalla() === 'celular'" (click)="pantalla.set('celular')"><app-icono nombre="movil" [tam]="16" /> Celular</button>
              <button type="button" [attr.aria-pressed]="pantalla() === 'computador'" (click)="pantalla.set('computador')"><app-icono nombre="pantalla" [tam]="16" /> Computador</button>
            </div>
            @if (actual() !== v) {
              <button class="btn main" type="button" (click)="aplicar(info(v))" [disabled]="guardando()">
                {{ guardando() ? 'Aplicando…' : 'Usar ' + info(v).nombre }}</button>
            } @else {
              <span class="pt-uso grande"><app-icono nombre="ok" [tam]="16" /> Es la que ven tus clientes</span>
            }
            <button class="mt-icono" type="button" (click)="vista.set(null)" aria-label="Cerrar la vista previa"><app-icono nombre="cerrar" /></button>
          </div>
        </header>
        @if (error()) { <div class="alerta mala">{{ error() }}</div> }
        <div class="pt-marco" [class.computador]="pantalla() === 'computador'">
          @if (pantalla() === 'celular') { <span class="pt-notch" aria-hidden="true"></span> }
          <iframe [src]="urlVista()" [title]="'Vista previa de la tienda con la plantilla ' + info(v).nombre" loading="lazy"></iframe>
        </div>
      </section>
    }
  `,
})
export class PlantillasPage {
  private api = inject(AdminApi);
  private estado = inject(EstadoTienda);
  private avisos = inject(Avisos);
  private sanitizer = inject(DomSanitizer);
  protected emp = inject(EmpresaActual);

  protected readonly plantillas = PLANTILLAS;
  /** La que ven hoy los clientes (se actualiza apenas se aplica otra). */
  protected actual = computed(() => this.aplicada() ?? plantillaDe(this.estado.catalogo()?.tienda.plantilla));
  private aplicada = signal<Plantilla | null>(null);
  protected vista = signal<Plantilla | null>(null);
  protected pantalla = signal<'celular' | 'computador'>('celular');
  protected guardando = signal(false);
  protected error = signal('');

  /** La tienda real con la plantilla a probar; misma dirección del navegador, así que no hay nada externo. */
  protected urlVista = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`${this.emp.url()}?plantilla=${this.vista() ?? ''}`));

  protected info(clave: Plantilla): InfoPlantilla {
    return PLANTILLAS.find((p) => p.clave === clave) ?? PLANTILLAS[0]!;
  }

  protected ver(clave: Plantilla): void {
    this.error.set('');
    this.vista.set(clave);
    requestAnimationFrame(() => document.querySelector('.pt-vivo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  protected aplicar(p: InfoPlantilla): void {
    this.guardando.set(true);
    this.error.set('');
    this.api.cambiarPlantilla(p.clave).subscribe({
      next: (r) => {
        this.aplicada.set(r.plantilla);
        this.guardando.set(false);
        this.estado.cargar();
        this.avisos.mostrar(`¡Listo! Tus clientes ya ven la plantilla ${p.nombre}.`);
      },
      error: (e) => { this.error.set(mensajeError(e)); this.guardando.set(false); },
    });
  }
}
