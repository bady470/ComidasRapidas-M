import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { CelularPipe } from '../core/formato';
import { Domiciliario } from '../core/modelos';

/** Personas que llevan los domicilios. Se asignan a cada pedido desde «Pedidos». */
@Component({
  selector: 'app-domiciliarios',
  imports: [FormsModule, CelularPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="two" style="margin-bottom:40px">
      <div class="panel">
        <h3>Domiciliarios</h3>
        <p class="muted">Asígnalos a cada pedido a domicilio desde «Pedidos». Al asignarlo puedes enviarle el pedido por WhatsApp,
          y el cliente ve quién le lleva su pedido.</p>
        <div class="tablewrap tabla-datos" style="margin-inline:-16px;margin-bottom:-16px">
          <table>
            <thead><tr><th>Nombre</th><th>Celular</th><th>Estado</th><th class="r">Acciones</th></tr></thead>
            <tbody>
              @for (d of lista(); track d.id) {
                @if (editando() === d.id) {
                  <tr>
                    <td colspan="4">
                      <form class="stack" style="gap:8px" (ngSubmit)="guardar(d.id)">
                        <div class="row2">
                          <div class="field"><label [for]="'en' + d.id">Nombre</label><input [id]="'en' + d.id" name="en" [(ngModel)]="edicion.nombre"></div>
                          <div class="field"><label [for]="'ec' + d.id">Celular</label><input [id]="'ec' + d.id" name="ec" inputmode="tel" [(ngModel)]="edicion.celular"></div>
                        </div>
                        <label class="check"><input type="checkbox" name="ea" [(ngModel)]="edicion.activo"> Activo</label>
                        <div class="row"><button class="btn main" type="submit">Guardar</button><button class="btn" type="button" (click)="editando.set(null)">Cancelar</button></div>
                      </form>
                    </td>
                  </tr>
                } @else {
                  <tr [class.apagada]="!d.activo">
                    <td><b>{{ d.nombre }}</b></td>
                    <td class="num">{{ d.celular | celular }}</td>
                    <td><span class="st" [class.pay-RECIBIDO]="d.activo" [class.pay-PENDIENTE]="!d.activo">{{ d.activo ? 'Activo' : 'Inactivo' }}</span></td>
                    <td class="r"><button class="btn" type="button" (click)="editar(d)">Editar</button></td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="4" class="vacio">Todavía no tienes domiciliarios.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <form class="panel" (ngSubmit)="crear(f)" #f="ngForm">
        <h3>Agregar domiciliario</h3>
        <div class="field"><label for="dNombre">Nombre</label><input id="dNombre" name="dNombre" [(ngModel)]="nuevo.nombre"></div>
        <div class="field"><label for="dCel">Celular <span class="hint">(para enviarle los pedidos por WhatsApp)</span></label>
          <input id="dCel" name="dCel" inputmode="tel" [(ngModel)]="nuevo.celular" placeholder="3001234567"></div>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <div><button class="btn main" type="submit">Agregar</button></div>
      </form>
    </div>
  `,
})
export class DomiciliariosPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);

  protected lista = signal<Domiciliario[]>([]);
  protected editando = signal<number | null>(null);
  protected error = signal('');
  protected nuevo = { nombre: '', celular: '' };
  protected edicion = { nombre: '', celular: '', activo: true };

  constructor() {
    this.api.domiciliarios().subscribe({ next: (l) => this.lista.set(l), error: (e) => this.error.set(mensajeError(e)) });
  }

  protected editar(d: Domiciliario): void {
    this.edicion = { nombre: d.nombre, celular: d.celular, activo: d.activo };
    this.editando.set(d.id);
  }

  protected guardar(id: number): void {
    const e = this.edicion;
    this.api.guardarDomiciliario(id, { nombre: e.nombre.trim(), celular: e.celular.replace(/\D/g, ''), activo: e.activo }).subscribe({
      next: (l) => { this.lista.set(l); this.editando.set(null); this.avisos.mostrar('Domiciliario actualizado'); },
      error: (err) => this.avisos.mostrar(mensajeError(err)),
    });
  }

  protected crear(form: NgForm): void {
    const n = this.nuevo;
    const cel = n.celular.replace(/\D/g, '');
    if (!n.nombre.trim()) { this.error.set('Escribe el nombre.'); return; }
    if (cel && !/^3\d{9}$/.test(cel)) { this.error.set('El celular debe tener 10 dígitos y empezar por 3.'); return; }
    this.api.guardarDomiciliario(null, { nombre: n.nombre.trim(), celular: cel, activo: true }).subscribe({
      next: (l) => {
        this.lista.set(l);
        form.resetForm();
        this.nuevo = { nombre: '', celular: '' };
        this.error.set('');
        this.avisos.mostrar('Domiciliario agregado');
      },
      error: (err) => this.error.set(mensajeError(err)),
    });
  }
}
