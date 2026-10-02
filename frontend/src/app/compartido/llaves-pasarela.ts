import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Avisos } from '../core/avisos';
import { copiar } from '../core/formato';
import { Llaves, LlavesGuardadas, Proveedor } from '../core/modelos';

/** Qué pide cada pasarela y dónde se encuentra en su panel. */
const AYUDA: Record<Proveedor, { donde: string; publica: string; privada: string | null; integridad: string | null; eventos: string; webhook: string }> = {
  WOMPI: {
    donde: 'En el panel de Wompi: Desarrolladores → Programadores → «Llaves del API» y «Secretos para integración técnica».',
    publica: 'Llave pública (pub_test_… o pub_prod_…)',
    privada: 'Llave privada (prv_…) · opcional: permite revisar un pago sin esperar el aviso',
    integridad: 'Secreto de integridad',
    eventos: 'Secreto de eventos',
    webhook: 'En Wompi: Desarrolladores → Programadores → «URL de eventos». Pégala en el ambiente que vas a usar (pruebas o producción).',
  },
  BOLD: {
    donde: 'En el panel de Bold: Integraciones → «Llaves de integración» (API Link de pagos).',
    publica: 'Llave de identidad',
    privada: null,
    integridad: null,
    eventos: 'Llave secreta (en pruebas puede quedar vacía)',
    webhook: 'En Bold: Integraciones → Webhooks → agregar la dirección de abajo.',
  },
};

/** Formulario de las llaves de una cuenta de pasarela. Los secretos guardados nunca se muestran: solo si están. */
@Component({
  selector: 'app-llaves-pasarela',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = ayuda();
    @let g = guardadas();
    <p class="hint">{{ a.donde }}</p>
    <div class="row2">
      <div class="field"><label [for]="id('amb')">Ambiente</label>
        <select [id]="id('amb')" [name]="id('amb')" [ngModel]="valor().ambiente" (ngModelChange)="cambiar('ambiente', $event)">
          <option value="PRUEBAS">Pruebas (sandbox, no cobra de verdad)</option>
          <option value="PRODUCCION">Producción (cobros reales)</option>
        </select></div>
      <div class="field"><label [for]="id('pub')">{{ a.publica }}</label>
        <input [id]="id('pub')" [name]="id('pub')" autocomplete="off" spellcheck="false" [ngModel]="valor().llavePublica" (ngModelChange)="cambiar('llavePublica', $event)"></div>
    </div>
    <div class="row2">
      @if (a.integridad) {
        <div class="field"><label [for]="id('int')">{{ a.integridad }}</label>
          <input [id]="id('int')" [name]="id('int')" type="password" autocomplete="new-password" [ngModel]="valor().secretoIntegridad"
                 (ngModelChange)="cambiar('secretoIntegridad', $event)" [placeholder]="g?.tieneSecretoIntegridad ? '•••••••• (guardado; escribe otro para cambiarlo)' : ''"></div>
      }
      <div class="field"><label [for]="id('evt')">{{ a.eventos }}</label>
        <input [id]="id('evt')" [name]="id('evt')" type="password" autocomplete="new-password" [ngModel]="valor().secretoEventos"
               (ngModelChange)="cambiar('secretoEventos', $event)" [placeholder]="g?.tieneSecretoEventos ? '•••••••• (guardado; escribe otro para cambiarlo)' : ''"></div>
    </div>
    @if (a.privada) {
      <div class="field"><label [for]="id('prv')">{{ a.privada }}</label>
        <input [id]="id('prv')" [name]="id('prv')" type="password" autocomplete="new-password" [ngModel]="valor().llavePrivada"
               (ngModelChange)="cambiar('llavePrivada', $event)" [placeholder]="g?.tieneLlavePrivada ? '•••••••• (guardada; escribe otra para cambiarla)' : ''"></div>
    }
    <span class="hint">Los secretos se guardan cifrados y nunca se vuelven a mostrar.</span>
    @if (urlEventos()) {
      <div class="field" style="margin-top:8px"><span class="flabel">Dirección para los avisos de pago (webhook)</span>
        <div class="url-copiable"><code>{{ urlEventos() }}</code><button class="btn" type="button" (click)="copiarUrl()">Copiar</button></div>
        <span class="hint">{{ a.webhook }} {{ esDeEmpresa() ? 'Este link es solo de esta empresa: no lo compartas con otra.' : 'Este link es el de la cuenta de la plataforma.' }}
          Con él los pagos se confirman solos al instante.</span></div>
    }
  `,
})
export class LlavesPasarela {
  private avisos = inject(Avisos);

  /** Lo que se está escribiendo (los secretos vacíos dejan los guardados). */
  readonly valor = model.required<Llaves>();
  readonly guardadas = input<LlavesGuardadas | null>(null);
  readonly urlEventos = input('');
  /** Prefijo para los id de los campos (puede haber varios formularios en la misma página). */
  readonly prefijo = input('llv');

  protected ayuda = computed(() => AYUDA[this.valor().proveedor]);
  /** El link de una empresa termina en su identificador; el de la plataforma termina en /eventos. */
  protected esDeEmpresa = computed(() => !this.urlEventos().endsWith('/eventos'));

  protected id(campo: string): string { return this.prefijo() + '-' + campo; }

  protected cambiar(campo: keyof Llaves, v: string): void {
    this.valor.update((l) => ({ ...l, [campo]: v }));
  }

  protected async copiarUrl(): Promise<void> {
    this.avisos.mostrar((await copiar(this.urlEventos())) ? 'Dirección copiada' : 'Selecciona la dirección para copiarla');
  }
}

/** Llaves para el formulario a partir de lo guardado (los secretos van vacíos). */
export function llavesDesde(g: LlavesGuardadas | null, proveedor: Proveedor): Llaves {
  const mismo = g && g.proveedor === proveedor;
  return {
    proveedor, ambiente: mismo ? g.ambiente : 'PRUEBAS', llavePublica: mismo ? g.llavePublica : '',
    llavePrivada: '', secretoIntegridad: '', secretoEventos: '',
  };
}
