import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { EmpresaActual } from '../core/empresa';
import { EstadoTienda } from '../core/estado-tienda';
import { cuando, horaTexto, linkWhatsapp } from '../core/formato';
import { DIAS } from '../core/modelos';
import { SedeElegida } from '../core/sede';
import { ModalCentro } from './modal-centro';
import { Icono } from './icono';

/** Día de hoy en Colombia: 1 = lunes … 7 = domingo. */
function hoyColombia(): number {
  const d = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/Bogota' }).format(new Date());
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1;
}

/**
 * Si el cliente entra cuando la tienda (o su sede) está fuera del horario de atención, o cerrada por el negocio,
 * un modal en el centro le explica cuándo abren y el horario de la semana. Sale una vez por visita y por sede;
 * después puede ver el menú y dejar listo su carrito.
 */
@Component({
  selector: 'app-aviso-cerrado',
  imports: [ModalCentro, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mostrar(); as t) {
      <app-modal-centro icono="luna" etiqueta="La tienda está cerrada" (cerrar)="cerrar()">
        <h2>{{ t.abierto ? 'Ahora estamos cerrados' : 'Por ahora no estamos recibiendo pedidos' }}</h2>
        @if (sedeNombre()) { <p>Sede <b>{{ sedeNombre() }}</b></p> }
        @if (t.proximaApertura && t.abierto) {
          <p class="mc-abre">Abrimos {{ abre(t.proximaApertura) }}</p>
        } @else if (!t.abierto) {
          <p>El negocio pausó los pedidos un momento. Vuelve a intentarlo más tarde o escríbenos.</p>
        }
        <ul class="mc-horario" aria-label="Horario de atención">
          @for (h of horario(); track h.dia) {
            <li [class.hoy]="h.hoy" [class.cerrado]="!h.activo">
              <span>{{ h.nombre }}{{ h.hoy ? ' (hoy)' : '' }}</span>
              <span>{{ h.texto }}</span>
            </li>
          }
        </ul>
        <p style="font-size:14px">Mientras tanto, puedes ver el menú y dejar listo tu carrito.</p>
        <div class="mc-acciones">
          <button class="primary" type="button" (click)="cerrar()">Ver el menú</button>
          @if (t.whatsapp) { <a class="btn" [href]="wa(t.whatsapp)" target="_blank" rel="noopener"><app-icono nombre="chat" [tam]="16" /> Escríbenos por WhatsApp</a> }
          @if (t.sedes.length > 1) { <button class="linkbtn" type="button" (click)="otraSede()">Ver otra sede</button> }
        </div>
      </app-modal-centro>
    }
  `,
})
export class AvisoCerrado {
  private estado = inject(EstadoTienda);
  private sede = inject(SedeElegida);
  private emp = inject(EmpresaActual);

  /** El layout lo activa solo en el menú y el carrito (no en el seguimiento de un pedido). */
  readonly activo = input(true);

  private visto = signal(new Set<string>());

  private tienda = computed(() => this.estado.catalogo()?.tienda ?? null);
  /** Clave por empresa y sede: si cambia de sede y la otra también está cerrada, se le avisa. */
  private clave = computed(() => `leinei:${this.emp.slug() || 'dominio'}:cerrado-visto:${this.tienda()?.sedeId ?? 0}`);

  protected mostrar = computed(() => {
    const t = this.tienda();
    if (!t || !this.activo() || t.modoPedido !== 'INMEDIATO') return null;
    // Con varias sedes, primero que escoja la sede (su modal sale antes).
    if (t.sedes.length > 1 && !this.sede.escogidaEnVisita()) return null;
    if (t.abierto && t.enHorario) return null;
    if (this.visto().has(this.clave())) return null;
    return t;
  });

  protected sedeNombre = computed(() => {
    const t = this.tienda();
    return t && t.sedes.length > 1 ? t.sedes.find((s) => s.id === t.sedeId)?.nombre ?? '' : '';
  });

  /** Lunes a domingo, con el día de hoy marcado. */
  protected horario = computed(() => {
    const hoy = hoyColombia();
    return [...(this.tienda()?.horarios ?? [])].sort((a, b) => a.dia - b.dia).map((h) => ({
      dia: h.dia, nombre: DIAS[h.dia] ?? '', activo: h.activo, hoy: h.dia === hoy,
      texto: h.activo ? `${horaTexto(h.abre)} – ${horaTexto(h.cierra)}` : 'Cerrado',
    }));
  });

  constructor() {
    // Lo ya visto en esta pestaña (sobrevive a recargar, no a cerrar el navegador).
    effect(() => {
      const k = this.clave();
      untracked(() => {
        try { if (sessionStorage.getItem(k)) this.visto.update((s) => new Set(s).add(k)); } catch { /* sin almacenamiento */ }
      });
    });
  }

  protected abre(iso: string): string { return cuando(iso); }

  protected wa(numero: string): string {
    return linkWhatsapp(numero, `Hola, quería hacer un pedido en ${this.tienda()?.nombre ?? ''}.`);
  }

  protected cerrar(): void {
    const k = this.clave();
    try { sessionStorage.setItem(k, '1'); } catch { /* sin almacenamiento */ }
    this.visto.update((s) => new Set(s).add(k));
  }

  protected otraSede(): void {
    this.cerrar();
    this.sede.abrirSelector.update((v) => v + 1);
  }
}
