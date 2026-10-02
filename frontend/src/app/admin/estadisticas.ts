import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraficaBarras, GraficaColumnas, GraficaLinea, GraficaPartes, Parte, Punto, compacto } from '../compartido/graficas';
import { AdminApi, mensajeError } from '../core/api';
import { DineroPipe, diaCorto, dinero } from '../core/formato';
import { DIAS, Estadisticas, ParteVentas, ResumenVentas } from '../core/modelos';

type Rango = 'hoy' | '7' | '30' | 'mes' | 'mesPasado' | '90' | 'anio' | 'otro';

const RANGOS: { valor: Rango; texto: string }[] = [
  { valor: 'hoy', texto: 'Hoy' }, { valor: '7', texto: '7 días' }, { valor: '30', texto: '30 días' },
  { valor: 'mes', texto: 'Este mes' }, { valor: 'mesPasado', texto: 'Mes pasado' }, { valor: '90', texto: '90 días' },
  { valor: 'anio', texto: 'Este año' }, { valor: 'otro', texto: 'Otro rango' },
];

/** Fichas de arriba: qué número muestran, cómo se escribe y si subir es bueno. */
interface Ficha { titulo: string; valor: (r: ResumenVentas) => number; formato: (n: number) => string; subirEsBueno: boolean; nota?: (r: ResumenVentas) => string; }

const FICHAS: Ficha[] = [
  { titulo: 'Ventas', valor: (r) => r.ventas, formato: dinero, subirEsBueno: true, nota: (r) => `${dinero(r.cobrado)} ya cobrado` },
  { titulo: 'Pedidos', valor: (r) => r.pedidos, formato: (n) => n.toLocaleString('es-CO'), subirEsBueno: true,
    nota: (r) => r.cancelados ? `${r.cancelados} cancelado${r.cancelados === 1 ? '' : 's'}` : 'Sin cancelados' },
  { titulo: 'Ticket promedio', valor: (r) => r.ticketPromedio, formato: dinero, subirEsBueno: true, nota: (r) => `${r.unidades.toLocaleString('es-CO')} productos vendidos` },
  { titulo: 'Ganancia estimada', valor: (r) => r.ganancia, formato: dinero, subirEsBueno: true, nota: () => 'Con los costos de tus productos' },
  { titulo: 'Clientes', valor: (r) => r.clientes, formato: (n) => n.toLocaleString('es-CO'), subirEsBueno: true,
    nota: (r) => `${r.clientesNuevos} nuevo${r.clientesNuevos === 1 ? '' : 's'}` },
];

/** Fecha de hoy en Colombia (YYYY-MM-DD), sin depender de la zona del computador. */
function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function horaTexto(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Cómo va el negocio: fichas con la variación contra el periodo anterior y gráficas con su vista de tabla. */
@Component({
  selector: 'app-estadisticas',
  imports: [FormsModule, DineroPipe, GraficaLinea, GraficaBarras, GraficaColumnas, GraficaPartes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h"><h1>Estadísticas</h1></div>

    <div class="toolbar" style="margin-bottom:16px;flex-wrap:wrap">
      <div class="seg" role="group" aria-label="Rango de fechas">
        @for (r of rangos; track r.valor) {
          <button type="button" [attr.aria-pressed]="rango() === r.valor" (click)="elegir(r.valor)">{{ r.texto }}</button>
        }
      </div>
      @if (rango() === 'otro') {
        <input type="date" aria-label="Desde" [ngModel]="desde()" (ngModelChange)="desde.set($event); cargar()" [max]="hasta()">
        <input type="date" aria-label="Hasta" [ngModel]="hasta()" (ngModelChange)="hasta.set($event); cargar()" [min]="desde()">
      }
    </div>

    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (datos(); as d) {
      <p class="muted" style="margin:-6px 0 12px">Del {{ dia(d.desde) }} al {{ dia(d.hasta) }} · comparado con {{ dia(d.anteriorDesde) }} – {{ dia(d.anteriorHasta) }}</p>
      <div class="kpis num">
        @for (f of fichas; track f.titulo) {
          @let v = variacion(f, d);
          <div class="kpi ficha">
            <div class="lbl">{{ f.titulo }}</div>
            <div class="v">{{ f.formato(f.valor(d.actual)) }}</div>
            <div class="variacion" [class.sube]="v.clase === 'sube'" [class.baja]="v.clase === 'baja'" [class.igual]="v.clase === 'igual'">
              <span aria-hidden="true">{{ v.flecha }}</span> {{ v.texto }}</div>
            @if (f.nota) { <div class="muted" style="font-size:12.5px">{{ f.nota(d.actual) }}</div> }
          </div>
        }
      </div>

      @if (!d.actual.pedidos) {
        <div class="empty" style="margin-bottom:40px">No hay pedidos en este rango. Prueba con un rango más largo.</div>
      } @else {
        <div class="grid-g">
          <section class="panel panel-g" style="grid-column:1 / -1">
            <h3>{{ porHoras() ? 'Ventas por hora' : 'Ventas por día' }}
              <button class="linkbtn" type="button" (click)="alternar('tendencia')">{{ tabla('tendencia') ? 'Ver gráfica' : 'Ver tabla' }}</button></h3>
            @if (tabla('tendencia')) {
              <div class="tablewrap"><table class="num"><thead><tr><th>{{ porHoras() ? 'Hora' : 'Día' }}</th><th class="r">Ventas</th><th class="r">Pedidos</th></tr></thead>
                <tbody>@for (p of tendencia(); track p.etiqueta) { <tr><td>{{ p.etiqueta }}</td><td class="r">{{ p.valor | dinero }}</td><td class="r">{{ p.detalle }}</td></tr> }</tbody></table></div>
            } @else {
              <app-grafica-linea [puntos]="tendencia()" [formato]="pesos" [titulo]="porHoras() ? 'Ventas por hora' : 'Ventas por día'" />
            }
          </section>

          <section class="panel panel-g">
            <h3>Productos más vendidos
              <button class="linkbtn" type="button" (click)="alternar('productos')">{{ tabla('productos') ? 'Ver gráfica' : 'Ver tabla' }}</button></h3>
            @if (tabla('productos')) {
              <div class="tablewrap"><table class="num"><thead><tr><th>Producto</th><th class="r">Unidades</th><th class="r">Ventas</th></tr></thead>
                <tbody>@for (p of d.productos; track p.nombre) { <tr><td>{{ p.nombre }}</td><td class="r">{{ p.unidades }}</td><td class="r">{{ p.ventas | dinero }}</td></tr> }</tbody></table></div>
            } @else {
              <p class="muted" style="margin-top:-6px">Unidades vendidas. Pasa el mouse para ver cuánto vendió cada uno.</p>
              <app-grafica-barras [puntos]="productos()" [formato]="unidades" />
            }
          </section>

          <section class="panel panel-g">
            <h3>Horas con más pedidos
              <button class="linkbtn" type="button" (click)="alternar('horas')">{{ tabla('horas') ? 'Ver gráfica' : 'Ver tabla' }}</button></h3>
            @if (tabla('horas')) {
              <div class="tablewrap"><table class="num"><thead><tr><th>Hora</th><th class="r">Pedidos</th><th class="r">Ventas</th></tr></thead>
                <tbody>@for (h of d.horas; track h.hora) { @if (h.pedidos) { <tr><td>{{ hora(h.hora) }}</td><td class="r">{{ h.pedidos }}</td><td class="r">{{ h.ventas | dinero }}</td></tr> } }</tbody></table></div>
            } @else {
              <p class="muted" style="margin-top:-6px">{{ horaPico() }}</p>
              <app-grafica-columnas [puntos]="horas()" [formato]="pedidosTexto" [cadaEtiqueta]="3" />
            }
          </section>

          <section class="panel panel-g">
            <h3>Días de la semana
              <button class="linkbtn" type="button" (click)="alternar('semana')">{{ tabla('semana') ? 'Ver gráfica' : 'Ver tabla' }}</button></h3>
            @if (tabla('semana')) {
              <div class="tablewrap"><table class="num"><thead><tr><th>Día</th><th class="r">Pedidos</th><th class="r">Ventas</th></tr></thead>
                <tbody>@for (s of d.semana; track s.dia) { <tr><td>{{ nombreDia(s.dia) }}</td><td class="r">{{ s.pedidos }}</td><td class="r">{{ s.ventas | dinero }}</td></tr> }</tbody></table></div>
            } @else {
              <p class="muted" style="margin-top:-6px">Ventas según el día de entrega.</p>
              <app-grafica-columnas [puntos]="semana()" [formato]="pesos" />
            }
          </section>

          <section class="panel panel-g">
            <h3>Cómo pagan</h3>
            <app-grafica-partes [partes]="partes(d.pagos)" [formato]="pesos" />
          </section>
          <section class="panel panel-g">
            <h3>Cómo reciben</h3>
            <app-grafica-partes [partes]="partes(d.entrega)" [formato]="pesos" />
            <h3 style="margin-top:14px">Por dónde piden</h3>
            <app-grafica-partes [partes]="partes(d.origen)" [formato]="pesos" />
          </section>
        </div>
      }
    } @else if (!error()) {
      <div class="kpis">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="esqueleto" style="height:110px"></div> }</div>
      <div class="esqueleto" style="height:300px"></div>
    }
  `,
})
export class EstadisticasPage {
  private api = inject(AdminApi);

  protected readonly rangos = RANGOS;
  protected readonly fichas = FICHAS;
  protected rango = signal<Rango>('30');
  protected desde = signal(sumarDias(hoyISO(), -29));
  protected hasta = signal(hoyISO());
  protected datos = signal<Estadisticas | null>(null);
  protected error = signal('');
  private tablas = signal(new Set<string>());

  protected readonly pesos = (n: number) => dinero(n);
  protected readonly unidades = (n: number) => n.toLocaleString('es-CO') + (n === 1 ? ' unidad' : ' unidades');
  protected readonly pedidosTexto = (n: number) => n.toLocaleString('es-CO') + (n === 1 ? ' pedido' : ' pedidos');

  constructor() {
    this.cargar();
  }

  protected elegir(r: Rango): void {
    this.rango.set(r);
    const hoy = hoyISO();
    const [a, m] = hoy.split('-').map(Number) as [number, number];
    const inicioMes = `${a}-${String(m).padStart(2, '0')}-01`;
    switch (r) {
      case 'hoy': this.desde.set(hoy); this.hasta.set(hoy); break;
      case '7': this.desde.set(sumarDias(hoy, -6)); this.hasta.set(hoy); break;
      case '30': this.desde.set(sumarDias(hoy, -29)); this.hasta.set(hoy); break;
      case '90': this.desde.set(sumarDias(hoy, -89)); this.hasta.set(hoy); break;
      case 'mes': this.desde.set(inicioMes); this.hasta.set(hoy); break;
      case 'mesPasado': {
        const finAnterior = sumarDias(inicioMes, -1);
        this.desde.set(finAnterior.slice(0, 8) + '01');
        this.hasta.set(finAnterior);
        break;
      }
      case 'anio': this.desde.set(`${a}-01-01`); this.hasta.set(hoy); break;
      case 'otro': return; // el usuario escoge las fechas
    }
    this.cargar();
  }

  protected cargar(): void {
    if (!this.desde() || !this.hasta()) return;
    this.error.set('');
    this.api.estadisticas(this.desde(), this.hasta()).subscribe({
      next: (d) => this.datos.set(d),
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  protected tabla(clave: string): boolean { return this.tablas().has(clave); }
  protected alternar(clave: string): void {
    this.tablas.update((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });
  }

  protected dia(iso: string): string { return diaCorto(iso); }
  protected hora(h: number): string { return horaTexto(h); }
  protected nombreDia(d: number): string { return DIAS[d] ?? ''; }

  /** Un solo día: la tendencia se muestra por horas. */
  protected porHoras = computed(() => (this.datos()?.dias.length ?? 0) <= 1);

  protected tendencia = computed<Punto[]>(() => {
    const d = this.datos();
    if (!d) return [];
    if (this.porHoras()) {
      return this.recortarHoras(d).map((h) => ({ etiqueta: horaTexto(h.hora), valor: h.ventas, detalle: `${h.pedidos} pedidos` }));
    }
    const corta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return d.dias.map((x) => ({ etiqueta: diaCorto(x.fecha), corta: corta.format(new Date(x.fecha + 'T12:00:00Z')), valor: x.ventas,
      detalle: `${x.pedidos} pedido${x.pedidos === 1 ? '' : 's'}` }));
  });

  protected productos = computed<Punto[]>(() =>
    (this.datos()?.productos ?? []).map((p) => ({ etiqueta: p.nombre, valor: p.unidades, detalle: `Vendió ${dinero(p.ventas)}` })));

  protected horas = computed<Punto[]>(() => {
    const d = this.datos();
    return d ? this.recortarHoras(d).map((h) => ({ etiqueta: horaTexto(h.hora), valor: h.pedidos, detalle: dinero(h.ventas) })) : [];
  });

  protected horaPico = computed(() => {
    const h = [...(this.datos()?.horas ?? [])].sort((a, b) => b.pedidos - a.pedidos)[0];
    return h && h.pedidos ? `La hora con más pedidos es de ${horaTexto(h.hora)} a ${horaTexto((h.hora + 1) % 24)}.` : '';
  });

  protected semana = computed<Punto[]>(() =>
    (this.datos()?.semana ?? []).map((s) => ({ etiqueta: (DIAS[s.dia] ?? '').slice(0, 3), valor: s.ventas, detalle: `${s.pedidos} pedidos` })));

  protected partes(lista: ParteVentas[]): Parte[] {
    return lista.map((p) => ({ nombre: p.nombre, valor: p.total, detalle: `${p.pedidos} pedido${p.pedidos === 1 ? '' : 's'}` }));
  }

  /** Solo las horas en que el negocio vende (con una hora de margen a cada lado). */
  private recortarHoras(d: Estadisticas) {
    const activas = d.horas.filter((h) => h.pedidos > 0).map((h) => h.hora);
    if (!activas.length) return d.horas;
    const desde = Math.max(0, Math.min(...activas) - 1);
    const hasta = Math.min(23, Math.max(...activas) + 1);
    return d.horas.filter((h) => h.hora >= desde && h.hora <= hasta);
  }

  /** Variación contra el periodo anterior: flecha + texto, y si es buena o mala (nunca solo por el color). */
  protected variacion(f: Ficha, d: Estadisticas): { flecha: string; texto: string; clase: 'sube' | 'baja' | 'igual' } {
    const a = f.valor(d.actual);
    const b = f.valor(d.anterior);
    if (b === 0) return a === 0 ? { flecha: '•', texto: 'Igual que antes', clase: 'igual' } : { flecha: '▲', texto: 'Antes no había', clase: f.subirEsBueno ? 'sube' : 'baja' };
    const pct = Math.round(((a - b) / Math.abs(b)) * 100);
    if (pct === 0) return { flecha: '•', texto: 'Igual que antes', clase: 'igual' };
    const bueno = (pct > 0) === f.subirEsBueno;
    return { flecha: pct > 0 ? '▲' : '▼', texto: `${pct > 0 ? '+' : ''}${pct} % vs. antes`, clase: bueno ? 'sube' : 'baja' };
  }

  protected compacto = compacto;
}
