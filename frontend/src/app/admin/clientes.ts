import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { CelularPipe, DineroPipe, linkWhatsapp } from '../core/formato';
import { ClienteResumen, Clientes } from '../core/modelos';

type Filtro = 'dormidos' | 'frecuentes' | 'nuevos' | 'contactados' | 'todos';

const MENSAJE_BASE = 'Hola {nombre} 👋, te extrañamos en {tienda}. Hace {dias} días no pides tu {favorito}. ' +
  'Hoy te esperamos con algo especial: pide aquí 👉 {link}';

/**
 * Clientes de la tienda y los que dejaron de pedir. Un botón arma el mensaje de WhatsApp con su nombre y lo que más
 * pide; al usarlo queda registrado, y si el cliente vuelve a pedir se ve como «recuperado».
 */
@Component({
  selector: 'app-clientes',
  imports: [FormsModule, DineroPipe, CelularPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-h"><h1>Clientes</h1></div>
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (datos(); as d) {
      <div class="kpis num">
        <div class="kpi"><div class="lbl">Clientes</div><div class="v">{{ d.resumen.total }}</div></div>
        <div class="kpi"><div class="lbl">Frecuentes (3+ pedidos)</div><div class="v">{{ d.resumen.frecuentes }}</div></div>
        <div class="kpi"><div class="lbl">Nuevos este mes</div><div class="v">{{ d.resumen.nuevosMes }}</div></div>
        <div class="kpi"><div class="lbl">Sin pedir hace 30+ días</div><div class="v" [style.color]="d.resumen.dormidos ? 'var(--warn)' : ''">{{ d.resumen.dormidos }}</div></div>
        <div class="kpi"><div class="lbl">Recuperados</div><div class="v ok">{{ d.resumen.recuperados }}</div>
          <div class="muted" style="font-size:12.5px">de {{ d.resumen.contactados }} a los que les escribiste</div></div>
      </div>

      <details class="panel" style="margin-bottom:16px" [open]="editando()">
        <summary style="cursor:pointer;font-weight:700" (click)="$event.preventDefault(); editando.set(!editando())">✉️ Mensaje para que vuelvan</summary>
        <p class="muted" style="font-size:13px">Puedes usar <code>{{ '{' }}nombre{{ '}' }}</code>, <code>{{ '{' }}tienda{{ '}' }}</code>,
          <code>{{ '{' }}favorito{{ '}' }}</code>, <code>{{ '{' }}dias{{ '}' }}</code> y <code>{{ '{' }}link{{ '}' }}</code>
          (la dirección de tu tienda). Si quieres dar un beneficio, escríbelo aquí: por ejemplo «con este mensaje tienes el domicilio gratis».</p>
        <textarea name="mensaje" rows="3" maxlength="600" [ngModel]="mensaje()" (ngModelChange)="mensaje.set($event)"></textarea>
        <div class="field"><span class="flabel">Así se ve</span><div class="alerta" style="white-space:pre-wrap">{{ ejemplo() }}</div></div>
        <div class="row">
          <button class="btn main" type="button" [disabled]="guardando()" (click)="guardarMensaje()">Guardar mensaje</button>
          <button class="linkbtn" type="button" (click)="mensaje.set(base)">Usar el mensaje sugerido</button>
        </div>
      </details>

      <div class="toolbar" style="margin-bottom:12px;flex-wrap:wrap">
        <div class="seg" role="group" aria-label="Filtro">
          @for (op of filtros; track op.valor) {
            <button type="button" [attr.aria-pressed]="filtro() === op.valor" (click)="filtro.set(op.valor)">{{ op.texto }} · {{ cuenta(op.valor) }}</button>
          }
        </div>
        @if (filtro() === 'dormidos') {
          <select aria-label="Días sin pedir" [ngModel]="dias()" (ngModelChange)="dias.set($event)">
            <option [ngValue]="15">15+ días</option><option [ngValue]="30">30+ días</option>
            <option [ngValue]="60">60+ días</option><option [ngValue]="90">90+ días</option>
          </select>
        }
        <input type="search" placeholder="Buscar por nombre o celular" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)">
      </div>

      <div class="panel tablewrap tabla-datos" style="padding:0;margin-bottom:40px">
        <table style="min-width:860px">
          <thead><tr><th>Cliente</th><th class="r">Pedidos</th><th class="r">Ha gastado</th><th>Último pedido</th><th>Lo que más pide</th><th>Mensaje</th><th class="r"></th></tr></thead>
          <tbody>
            @for (c of visibles(); track c.celular) {
              <tr>
                <td><b>{{ c.nombre }}</b><div class="muted num">{{ c.celular | celular }}</div></td>
                <td class="r num">{{ c.pedidos }}</td>
                <td class="r num">{{ c.total | dinero }}<div class="muted">{{ c.ticketPromedio | dinero }} c/u</div></td>
                <td>{{ hace(c.diasSinPedir) }}</td>
                <td>{{ c.favorito || '—' }}</td>
                <td>
                  @if (c.volvio) { <span class="st tx-APROBADO">Volvió</span> }
                  @else if (c.ultimoContacto) { <span class="muted">Le escribiste {{ haceFecha(c.ultimoContacto) }}</span> }
                  @else { <span class="muted">—</span> }
                </td>
                <td class="r"><button class="btn" type="button" (click)="escribir(c)">💬 Escribir</button></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted" style="padding:16px">{{ d.lista.length ? 'Ningún cliente con este filtro.' : 'Todavía no hay clientes con celular.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    } @else if (!error()) {
      <div class="kpis">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="esqueleto" style="height:100px"></div> }</div>
    }
  `,
})
export class ClientesPage {
  private api = inject(AdminApi);
  private toast = inject(Avisos);
  private emp = inject(EmpresaActual);
  private estado = inject(EstadoTienda);

  protected readonly base = MENSAJE_BASE;
  protected readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'dormidos', texto: 'Dejaron de pedir' }, { valor: 'frecuentes', texto: 'Frecuentes' },
    { valor: 'nuevos', texto: 'Nuevos' }, { valor: 'contactados', texto: 'Les escribí' }, { valor: 'todos', texto: 'Todos' },
  ];
  protected datos = signal<Clientes | null>(null);
  protected error = signal('');
  protected filtro = signal<Filtro>('dormidos');
  protected dias = signal(30);
  protected busqueda = signal('');
  protected editando = signal(false);
  protected guardando = signal(false);
  protected mensaje = signal(MENSAJE_BASE);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.api.clientes().subscribe({
      next: (d) => { this.datos.set(d); this.mensaje.set(d.mensaje || MENSAJE_BASE); },
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  private cumple(c: ClienteResumen, f: Filtro): boolean {
    switch (f) {
      case 'dormidos': return c.diasSinPedir >= this.dias();
      case 'frecuentes': return c.pedidos >= 3;
      case 'nuevos': return Date.now() - new Date(c.primero).getTime() < 30 * 86_400_000;
      case 'contactados': return !!c.ultimoContacto;
      default: return true;
    }
  }

  protected cuenta(f: Filtro): number {
    return (this.datos()?.lista ?? []).filter((c) => this.cumple(c, f)).length;
  }

  /** Los que dejaron de pedir: primero los que más gastaban (vale más la pena recuperarlos). */
  protected visibles = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    this.dias();
    const lista = (this.datos()?.lista ?? []).filter((c) => this.cumple(c, f))
      .filter((c) => !q || (c.nombre + ' ' + c.celular).toLowerCase().includes(q));
    return f === 'dormidos' || f === 'frecuentes' ? [...lista].sort((a, b) => b.total - a.total) : lista;
  });

  protected ejemplo = computed(() => this.armar(this.mensaje(), this.datos()?.lista[0] ?? null));

  private armar(plantilla: string, c: ClienteResumen | null): string {
    const tienda = this.estado.catalogo()?.tienda.nombre ?? '';
    return (plantilla || MENSAJE_BASE)
      .replaceAll('{nombre}', (c?.nombre ?? 'Ana').split(/\s+/)[0]!)
      .replaceAll('{tienda}', tienda)
      .replaceAll('{favorito}', c?.favorito || 'pedido favorito')
      .replaceAll('{dias}', String(c?.diasSinPedir ?? 30))
      .replaceAll('{link}', location.origin + this.emp.url());
  }

  protected hace(dias: number): string {
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return `Hace ${dias} días`;
  }

  protected haceFecha(iso: string): string {
    return this.hace(Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)).toLowerCase();
  }

  /** Abre WhatsApp con el mensaje armado y registra que se le escribió (para medir si vuelve). */
  protected escribir(c: ClienteResumen): void {
    const texto = this.armar(this.mensaje(), c);
    // La ventana se abre en el mismo clic (si no, el navegador la bloquea); el registro va por detrás.
    window.open(linkWhatsapp(c.celular, texto), '_blank', 'noopener');
    this.api.registrarContacto(c.celular, c.nombre, texto).subscribe({
      next: () => this.datos.update((d) => d && {
        ...d,
        resumen: c.ultimoContacto ? d.resumen : { ...d.resumen, contactados: d.resumen.contactados + 1 },
        lista: d.lista.map((x) => (x.celular === c.celular ? { ...x, ultimoContacto: new Date().toISOString(), volvio: false } : x)),
      }),
      error: () => {},
    });
  }

  protected guardarMensaje(): void {
    this.guardando.set(true);
    this.api.guardarMensajeRecuperar(this.mensaje()).subscribe({
      next: () => { this.guardando.set(false); this.editando.set(false); this.toast.mostrar('Mensaje guardado'); },
      error: (e) => { this.guardando.set(false); this.toast.mostrar(mensajeError(e)); },
    });
  }
}
