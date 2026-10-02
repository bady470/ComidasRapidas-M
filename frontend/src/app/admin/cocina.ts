import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Icono } from '../compartido/icono';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { AvisosPortal } from '../core/avisos-portal';
import { EstadoTienda } from '../core/estado-tienda';
import { ImpresionCocina } from '../core/impresion-cocina';
import { ConfigCocina, EstadoPedido, PedidoAdmin } from '../core/modelos';

interface Columna { clave: string; titulo: string; estados: EstadoPedido[]; vacio: string; }

const COLUMNAS: Columna[] = [
  { clave: 'por', titulo: 'Por preparar', estados: ['NUEVO', 'CONFIRMADO'], vacio: 'No hay pedidos esperando.' },
  { clave: 'prep', titulo: 'Preparando', estados: ['PREPARANDO'], vacio: 'Nada en preparación.' },
  { clave: 'listo', titulo: 'Listos y en camino', estados: ['LISTO', 'EN_CAMINO'], vacio: 'Nada esperando entrega.' },
];

/**
 * Pantalla de cocina: los pedidos activos en tres columnas, con letra grande, el tiempo que llevan y un botón para
 * pasarlos al siguiente paso. Se actualiza sola. Desde aquí se configura la impresión de comandas.
 */
@Component({
  selector: 'app-cocina',
  imports: [Icono, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h">
      <h1>Cocina</h1>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <span class="en-vivo" [class.off]="!avisos.enVivo()">{{ avisos.enVivo() ? 'En vivo' : 'Reconectando' }}</span>
        @if (imp.config().modo === 'AUTOMATICA') {
          <label class="check" [title]="'Activa esto solo en el computador que tiene la impresora'">
            <input type="checkbox" [checked]="imp.esteEquipo()" (change)="imp.usarEsteEquipo($any($event.target).checked)"> Este equipo imprime</label>
        }
        <button class="btn" type="button" (click)="configAbierta.set(!configAbierta())"><app-icono nombre="imprimir" /> Impresión</button>
        <button class="btn" type="button" (click)="pantallaCompleta()"><app-icono nombre="pantalla" /> Pantalla completa</button>
      </div>
    </div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (configAbierta()) {
      <form class="panel" style="margin-bottom:16px" (ngSubmit)="guardarConfig()">
        <h3>Comandas impresas</h3>
        <div class="field"><span class="flabel">¿Cómo imprimir?</span>
          <div class="opts">
            <label class="opt"><input type="radio" name="modo" value="APAGADA" [(ngModel)]="f.modo"><span><b>No imprimir</b><br><span class="muted">La cocina trabaja con esta pantalla.</span></span></label>
            <label class="opt"><input type="radio" name="modo" value="MANUAL" [(ngModel)]="f.modo"><span><b>A mano</b><br><span class="muted">Botón «Imprimir» en cada pedido.</span></span></label>
            <label class="opt"><input type="radio" name="modo" value="AUTOMATICA" [(ngModel)]="f.modo"><span><b>Automática</b><br><span class="muted">El equipo de la cocina imprime cada pedido solo.</span></span></label>
          </div></div>
        @if (f.modo === 'AUTOMATICA') {
          <div class="row2">
            <div class="field"><label for="iMom">¿Cuándo?</label>
              <select id="iMom" name="iMom" [(ngModel)]="f.momento">
                <option value="NUEVO">Apenas llega el pedido</option>
                <option value="CONFIRMADO">Cuando lo confirmo</option>
              </select></div>
            <label class="check" style="align-self:end;padding-bottom:10px">
              <input type="checkbox" name="iPago" [(ngModel)]="f.esperaPago"> Con pago en línea, esperar a que se confirme el pago</label>
          </div>
        }
        @if (f.modo !== 'APAGADA') {
          <div class="row2">
            <div class="field"><label for="iPapel">Papel</label>
              <select id="iPapel" name="iPapel" [(ngModel)]="f.papel">
                <option [ngValue]="80">80 mm (el más común)</option><option [ngValue]="58">58 mm (impresoras pequeñas)</option>
              </select></div>
            <div class="field"><label for="iCop">Copias</label>
              <select id="iCop" name="iCop" [(ngModel)]="f.copias">
                <option [ngValue]="1">1</option><option [ngValue]="2">2 (cocina y domiciliario)</option><option [ngValue]="3">3</option>
              </select></div>
          </div>
          <label class="check"><input type="checkbox" name="iPrec" [(ngModel)]="f.precios"> Mostrar precios y total</label>
          <div class="field"><label for="iPie">Texto al final <span class="hint">(opcional)</span></label>
            <input id="iPie" name="iPie" [(ngModel)]="f.pie" maxlength="120" placeholder="¡Gracias por tu pedido!"></div>
          <p class="hint">Se imprime desde el navegador, sin instalar nada. Para que salga sin preguntar, abre Chrome en el computador
            de la cocina con la opción <code>--kiosk-printing</code> y deja la impresora térmica como predeterminada.</p>
        }
        <div class="row">
          <button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
          <button class="linkbtn" type="button" (click)="configAbierta.set(false)">Cerrar</button>
        </div>
      </form>
    }

    <div class="kds">
      @for (col of columnas; track col.clave) {
        @let lista = deColumna(col);
        <section class="kds-col">
          <h2>{{ col.titulo }} <span class="pill num">{{ lista.length }}</span></h2>
          @for (p of lista; track p.id) {
            @let min = minutos(p);
            <article class="kds-card" [class.tarde]="min >= limite()" [class.atento]="min >= limite() / 2 && min < limite()">
              <header>
                <b class="kds-cod num">{{ p.codigo }}</b>
                <span class="kds-tipo">@if (p.tipoEntrega === 'DOMICILIO') { <app-icono nombre="domiciliarios" [tam]="15" /> Domicilio } @else { <app-icono nombre="local" [tam]="15" /> Recoge }</span>
                <span class="kds-min num" [attr.aria-label]="'Hace ' + min + ' minutos'">{{ min }} min</span>
              </header>
              <div class="kds-cliente">{{ p.clienteNombre }}{{ p.origen === 'WHATSAPP' ? ' · WhatsApp' : '' }}</div>
              <ul class="kds-items">
                @for (i of p.items; track $index) {
                  <li><b>{{ i.cantidad }} ×</b> {{ i.nombre }}@if (i.detalle) {<span>{{ i.detalle }}</span>}</li>
                }
              </ul>
              @if (p.notas) { <div class="kds-nota"><app-icono nombre="nota" [tam]="15" /> {{ p.notas }}</div> }
              @if (p.metodoPago === 'EN_LINEA' && p.estadoPago !== 'RECIBIDO') { <div class="kds-aviso"><app-icono nombre="reloj" [tam]="15" /> Esperando el pago en línea</div> }
              <footer>
                @if (siguiente(p); as s) {
                  <button class="btn main" type="button" [disabled]="moviendo() === p.id" (click)="mover(p, s.estado)">{{ s.texto }}</button>
                }
                @if (imp.config().modo !== 'APAGADA') {
                  <button class="btn" type="button" (click)="imprimir(p)" [title]="imp.yaImpreso(p.id) ? 'Ya se imprimió; toca para imprimir otra vez' : 'Imprimir comanda'">
                    <app-icono nombre="imprimir" />{{ imp.yaImpreso(p.id) ? ' ✓' : '' }}</button>
                }
              </footer>
            </article>
          } @empty {
            <p class="muted kds-vacio">{{ col.vacio }}</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .kds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-items: start; padding-bottom: 40px; }
    @media (max-width: 900px) { .kds { grid-template-columns: 1fr; } }
    .kds-col { background: var(--surface-2); border-radius: var(--r); padding: 12px; display: grid; gap: 10px; min-height: 200px; align-content: start; }
    .kds-col h2 { font-size: 17px; display: flex; gap: 8px; align-items: center; }
    .kds-card { background: var(--surface); border: 1px solid var(--line); border-left: 5px solid var(--info); border-radius: 12px; padding: 12px; display: grid; gap: 8px; }
    .kds-card.atento { border-left-color: var(--warn); }
    .kds-card.tarde { border-left-color: var(--bad); }
    .kds-card header { display: flex; gap: 8px; align-items: center; }
    .kds-cod { font-size: 22px; letter-spacing: .02em; }
    .kds-tipo { font-size: 13px; color: var(--ink-2); }
    .kds-min { margin-left: auto; font-weight: 800; font-size: 15px; color: var(--ink-2); }
    .atento .kds-min { color: var(--warn); }
    .tarde .kds-min { color: var(--bad); }
    .kds-cliente { color: var(--ink-2); font-size: 14px; }
    .kds-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 18px; }
    .kds-items span { display: block; font-size: 14px; color: var(--ink-2); padding-left: 26px; }
    .kds-nota { background: var(--warn-soft); color: var(--warn); border-radius: 8px; padding: 6px 8px; font-weight: 700; }
    .kds-aviso { background: var(--info-soft); color: var(--info); border-radius: 8px; padding: 6px 8px; font-weight: 700; font-size: 14px; }
    .kds-card footer { display: flex; gap: 8px; }
    .kds-card footer .main { flex: 1; font-size: 15px; padding-block: 10px; }
    .kds-vacio { text-align: center; padding: 20px 0; }
  `,
})
export class CocinaPage {
  private api = inject(AdminApi);
  private toast = inject(Avisos);
  private estado = inject(EstadoTienda);
  protected avisos = inject(AvisosPortal);
  protected imp = inject(ImpresionCocina);

  protected readonly columnas = COLUMNAS;
  protected pedidos = signal<PedidoAdmin[]>([]);
  protected error = signal('');
  protected moviendo = signal<number | null>(null);
  protected configAbierta = signal(false);
  protected guardando = signal(false);
  protected f: ConfigCocina = { ...this.imp.config() };
  private ahora = signal(Date.now());

  /** Minutos a partir de los cuales un pedido va tarde: el tiempo máximo de entrega de la tienda (mínimo 15). */
  protected limite = computed(() => Math.max(15, this.estado.catalogo()?.tienda.tiempoMax ?? 40));

  constructor() {
    this.cargar();
    const reloj = setInterval(() => this.ahora.set(Date.now()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    effect(() => {
      this.avisos.cambioPedido();
      untracked(() => this.cargar());
    });
    effect(() => {
      const c = this.imp.config();
      untracked(() => { if (!this.configAbierta()) this.f = { ...c }; });
    });
  }

  private cargar(): void {
    this.api.pedidos({}).subscribe({
      next: (l) => { this.pedidos.set(l); this.error.set(''); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  /** Los más viejos arriba: se preparan en orden de llegada. */
  protected deColumna(c: Columna): PedidoAdmin[] {
    return this.pedidos().filter((p) => c.estados.includes(p.estado))
      .sort((a, b) => new Date(a.creado).getTime() - new Date(b.creado).getTime());
  }

  protected minutos(p: PedidoAdmin): number {
    return Math.max(0, Math.floor((this.ahora() - new Date(p.creado).getTime()) / 60_000));
  }

  protected siguiente(p: PedidoAdmin): { estado: EstadoPedido; texto: string } | null {
    switch (p.estado) {
      case 'NUEVO': case 'CONFIRMADO': return { estado: 'PREPARANDO', texto: 'Empezar' };
      case 'PREPARANDO': return p.tipoEntrega === 'RECOGER' ? { estado: 'LISTO', texto: 'Listo para recoger' } : { estado: 'EN_CAMINO', texto: 'Salió a domicilio' };
      case 'LISTO': case 'EN_CAMINO': return { estado: 'ENTREGADO', texto: 'Entregado' };
      default: return null;
    }
  }

  protected mover(p: PedidoAdmin, destino: EstadoPedido): void {
    this.moviendo.set(p.id);
    this.api.cambiarEstado(p.id, destino).subscribe({
      next: (r) => { this.moviendo.set(null); this.pedidos.update((l) => l.map((x) => (x.id === r.id ? r : x))); },
      error: (e) => { this.moviendo.set(null); this.toast.mostrar(mensajeError(e)); },
    });
  }

  protected imprimir(p: PedidoAdmin): void { this.imp.imprimir(p); }

  protected guardarConfig(): void {
    this.guardando.set(true);
    this.api.guardarConfigCocina({ ...this.f, papel: Number(this.f.papel) as 58 | 80, copias: Number(this.f.copias) }).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.imp.config.set(c);
        this.configAbierta.set(false);
        this.toast.mostrar(c.modo === 'AUTOMATICA' && !this.imp.esteEquipo()
          ? 'Guardado. Activa «Este equipo imprime» en el computador de la cocina.' : 'Impresión guardada');
      },
      error: (e) => { this.guardando.set(false); this.toast.mostrar(mensajeError(e)); },
    });
  }

  protected pantallaCompleta(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }
}
