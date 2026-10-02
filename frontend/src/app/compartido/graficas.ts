import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

/**
 * Gráficas del portal, dibujadas a mano (SVG y HTML) para no cargar librerías:
 *  - GraficaLinea: una serie en el tiempo, con área suave y línea guía + globo al pasar el mouse.
 *  - GraficaBarras: barras horizontales con el nombre a la izquierda y el valor en la punta.
 *  - GraficaColumnas: columnas (horas del día, días de la semana).
 *  - GraficaPartes: una barra partida al 100 % con leyenda (cómo pagan, cómo reciben).
 *
 * Reglas comunes: marcas delgadas (barras de máximo 24 px, línea de 2 px, punta redondeada de 4 px), cuadrícula de
 * un pelo y discreta, el texto siempre con colores de texto (nunca del color de la serie) y un globo con el detalle
 * al pasar el mouse o tocar. Cada página ofrece además la vista de tabla.
 */

/** etiqueta: la del globo; corta: la del eje (si no se da, se usa etiqueta). */
export interface Punto { etiqueta: string; valor: number; detalle?: string; corta?: string; }

/** Valores redondos para el eje (0, 50.000, 100.000…). */
function ticks(max: number, cantidad = 4): number[] {
  if (max <= 0) return [0];
  const bruto = max / cantidad;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto;
  const lista: number[] = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) lista.push(v);
  if (lista[lista.length - 1]! < max) lista.push(lista[lista.length - 1]! + paso);
  return lista;
}

/** 1.250.000 → «1,3 M»; 45.000 → «45 mil». Para ejes donde no cabe el número completo. */
export function compacto(n: number, pesos = true): string {
  const s = pesos ? '$' : '';
  if (Math.abs(n) >= 1_000_000) return s + (n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
  if (Math.abs(n) >= 1_000) return s + Math.round(n / 1_000).toLocaleString('es-CO') + ' mil';
  return s + n.toLocaleString('es-CO');
}

/** Mide el ancho del contenedor para dibujar a tamaño real (el texto no se deforma). */
function anchoDe(el: ElementRef<HTMLElement>): () => number {
  const ancho = signal(0);
  const destruir = inject(DestroyRef);
  // Primera medida sin esperar a que el navegador pinte (en pestañas en segundo plano el pintado se pausa).
  const t = setTimeout(() => { if (!ancho()) ancho.set(Math.round(el.nativeElement.clientWidth)); }, 0);
  destruir.onDestroy(() => clearTimeout(t));
  afterNextRender(() => {
    const ro = new ResizeObserver(([e]) => ancho.set(Math.round(e!.contentRect.width)));
    ro.observe(el.nativeElement);
    destruir.onDestroy(() => ro.disconnect());
  });
  return ancho;
}

@Component({
  selector: 'app-grafica-linea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g-caja" (mouseleave)="activo.set(null)">
      @if (ancho() > 0 && puntos().length) {
        @let g = geo();
        <svg [attr.width]="ancho()" [attr.height]="alto()" role="img" [attr.aria-label]="titulo()">
          @for (t of g.ticks; track t) {
            <line class="g-grid" [attr.x1]="g.izq" [attr.x2]="ancho() - g.der" [attr.y1]="g.y(t)" [attr.y2]="g.y(t)" />
            <text class="g-eje" [attr.x]="g.izq - 8" [attr.y]="g.y(t) + 4" text-anchor="end">{{ formatoEje()(t) }}</text>
          }
          <path class="g-area" [attr.d]="g.area" />
          <path class="g-linea" [attr.d]="g.linea" />
          @for (e of g.etiquetasX; track e.i) {
            <text class="g-eje" [attr.x]="g.x(e.i)" [attr.y]="alto() - 6" text-anchor="middle">{{ e.texto }}</text>
          }
          <!-- Valor al final de la línea (solo ese: el resto lo cuenta el globo). -->
          <circle class="g-punto" [attr.cx]="g.x(puntos().length - 1)" [attr.cy]="g.y(ultimo().valor)" r="4" />
          @if (activo() !== null) {
            @let i = activo()!;
            <line class="g-guia" [attr.x1]="g.x(i)" [attr.x2]="g.x(i)" [attr.y1]="g.arriba" [attr.y2]="g.abajo" />
            <circle class="g-punto" [attr.cx]="g.x(i)" [attr.cy]="g.y(puntos()[i]!.valor)" r="5" />
          }
          <rect class="g-captura" [attr.x]="g.izq" [attr.y]="0" [attr.width]="ancho() - g.izq - g.der" [attr.height]="alto()"
                (mousemove)="mover($event, g)" (touchstart)="tocar($event, g)" (touchmove)="tocar($event, g)" />
        </svg>
        @if (activo() !== null) {
          @let i = activo()!;
          @let p = puntos()[i]!;
          <div class="g-globo" [style.left.px]="g.x(i)" [style.top.px]="g.y(p.valor)">
            <b>{{ p.etiqueta }}</b><span>{{ formato()(p.valor) }}</span>@if (p.detalle) {<span class="muted">{{ p.detalle }}</span>}
          </div>
        }
      }
    </div>
  `,
  host: { class: 'g-host' },
})
export class GraficaLinea {
  readonly puntos = input.required<Punto[]>();
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-CO'));
  readonly formatoEje = input<(n: number) => string>((n) => compacto(n));
  readonly titulo = input('');
  readonly alto = input(240);

  protected ancho = anchoDe(inject(ElementRef));
  protected activo = signal<number | null>(null);
  protected ultimo = computed(() => this.puntos()[this.puntos().length - 1]!);

  protected geo = computed(() => {
    const pts = this.puntos();
    const w = this.ancho();
    const h = this.alto();
    const izq = 64, der = 16, arriba = 12, abajo = h - 26;
    const t = ticks(Math.max(...pts.map((p) => p.valor), 0));
    const max = t[t.length - 1] || 1;
    const x = (i: number) => izq + (pts.length === 1 ? (w - izq - der) / 2 : (i * (w - izq - der)) / (pts.length - 1));
    const y = (v: number) => abajo - (v / max) * (abajo - arriba);
    const linea = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
    const area = `${linea} L${x(pts.length - 1).toFixed(1)},${abajo} L${x(0).toFixed(1)},${abajo} Z`;
    // Hasta ~7 etiquetas en el eje x, repartidas.
    const cada = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((w - izq) / 80))));
    const etiquetasX = pts.map((p, i) => ({ i, texto: p.corta ?? p.etiqueta })).filter((e) => e.i % cada === 0);
    return { izq, der, arriba, abajo, ticks: t, x, y, linea, area, etiquetasX, n: pts.length };
  });

  protected mover(ev: MouseEvent, g: ReturnType<GraficaLinea['geo']>): void {
    const rect = (ev.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    this.elegir(ev.clientX - rect.left, g);
  }

  protected tocar(ev: TouchEvent, g: ReturnType<GraficaLinea['geo']>): void {
    const t = ev.touches[0];
    if (!t) return;
    const rect = (ev.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    this.elegir(t.clientX - rect.left, g);
  }

  private elegir(px: number, g: ReturnType<GraficaLinea['geo']>): void {
    if (g.n === 1) { this.activo.set(0); return; }
    const paso = (this.ancho() - g.izq - g.der) / (g.n - 1);
    this.activo.set(Math.max(0, Math.min(g.n - 1, Math.round((px - g.izq) / paso))));
  }
}

@Component({
  selector: 'app-grafica-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g-barras" role="list">
      @for (p of puntos(); track p.etiqueta; let i = $index) {
        <div class="g-fila" role="listitem" (mouseenter)="activo.set(i)" (mouseleave)="activo.set(null)" tabindex="0"
             (focus)="activo.set(i)" (blur)="activo.set(null)">
          <span class="g-nombre" [title]="p.etiqueta">{{ p.etiqueta }}</span>
          <span class="g-pista"><span class="g-barra" [style.width.%]="porcentaje(p.valor)"></span>
            <span class="g-valor num">{{ formato()(p.valor) }}</span></span>
          @if (activo() === i && p.detalle) { <span class="g-globo g-globo-fila">{{ p.detalle }}</span> }
        </div>
      }
    </div>
  `,
  host: { class: 'g-host' },
})
export class GraficaBarras {
  readonly puntos = input.required<Punto[]>();
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-CO'));
  protected activo = signal<number | null>(null);
  private max = computed(() => Math.max(1, ...this.puntos().map((p) => p.valor)));
  /** El valor ocupa máximo el 80 % de la pista: el 20 % restante es para el número en la punta. */
  protected porcentaje(v: number): number { return (v / this.max()) * 80; }
}

@Component({
  selector: 'app-grafica-columnas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g-columnas" [style.height.px]="alto()">
      @for (p of puntos(); track p.etiqueta; let i = $index) {
        <div class="g-col" (mouseenter)="activo.set(i)" (mouseleave)="activo.set(null)" tabindex="0" (focus)="activo.set(i)" (blur)="activo.set(null)"
             [attr.aria-label]="p.etiqueta + ': ' + formato()(p.valor)">
          <span class="g-col-pista">
            <span class="g-col-barra" [class.destacada]="i === mayor()" [style.height.%]="(p.valor / max()) * 100"></span>
          </span>
          <span class="g-col-x">{{ cadaEtiqueta() > 1 && i % cadaEtiqueta() ? '' : p.etiqueta }}</span>
          @if (activo() === i) {
            <span class="g-globo g-globo-col"><b>{{ p.etiqueta }}</b><span>{{ formato()(p.valor) }}</span>@if (p.detalle) {<span class="muted">{{ p.detalle }}</span>}</span>
          }
        </div>
      }
    </div>
  `,
  host: { class: 'g-host' },
})
export class GraficaColumnas {
  readonly puntos = input.required<Punto[]>();
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-CO'));
  readonly alto = input(180);
  /** Mostrar la etiqueta del eje cada N columnas (las horas no caben todas). */
  readonly cadaEtiqueta = input(1);
  protected activo = signal<number | null>(null);
  protected max = computed(() => Math.max(1, ...this.puntos().map((p) => p.valor)));
  /** La columna más alta va en el color de acento; las demás, un paso más suave. */
  protected mayor = computed(() => {
    const pts = this.puntos();
    let m = -1, idx = -1;
    pts.forEach((p, i) => { if (p.valor > m && p.valor > 0) { m = p.valor; idx = i; } });
    return idx;
  });
}

export interface Parte { nombre: string; valor: number; detalle?: string; }

@Component({
  selector: 'app-grafica-partes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="g-partes" role="img" [attr.aria-label]="resumen()">
      @for (p of partes(); track p.nombre; let i = $index) {
        @if (p.valor > 0) {
          <span class="g-parte" [style.flex-grow]="p.valor" [style.background]="'var(--serie-' + (i + 1) + ')'"
                (mouseenter)="activo.set(i)" (mouseleave)="activo.set(null)"></span>
        }
      }
    </div>
    <ul class="g-leyenda">
      @for (p of partes(); track p.nombre; let i = $index) {
        <li [class.activa]="activo() === i" (mouseenter)="activo.set(i)" (mouseleave)="activo.set(null)">
          <span class="g-muestra" [style.background]="'var(--serie-' + (i + 1) + ')'"></span>
          <span>{{ p.nombre }}</span>
          <b class="num">{{ porcentaje(p.valor) }} %</b>
          <span class="muted num">{{ formato()(p.valor) }}{{ p.detalle ? ' · ' + p.detalle : '' }}</span>
        </li>
      }
    </ul>
  `,
  host: { class: 'g-host' },
})
export class GraficaPartes {
  /** Máximo 3 partes (la paleta valida tres colores distinguibles también para daltonismo). */
  readonly partes = input.required<Parte[]>();
  readonly formato = input<(n: number) => string>((n) => n.toLocaleString('es-CO'));
  protected activo = signal<number | null>(null);
  private total = computed(() => this.partes().reduce((s, p) => s + p.valor, 0) || 1);
  protected porcentaje(v: number): number { return Math.round((v / this.total()) * 100); }
  protected resumen = computed(() => this.partes().map((p) => `${p.nombre} ${this.porcentaje(p.valor)} %`).join(', '));
}
