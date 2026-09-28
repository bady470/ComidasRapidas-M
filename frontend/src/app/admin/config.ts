import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Logo } from '../compartido/logo';
import { AdminApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { EstadoTienda } from '../core/estado-tienda';
import { AdminUsuario, ConfigAdmin, DIAS, MODULOS } from '../core/modelos';
import { textoSobre } from '../core/tema';

/** Todo lo que cambia de un negocio a otro: marca, contacto, forma de pedir, entregas y pagos. */
@Component({
  selector: 'app-config',
  imports: [FormsModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (config(); as c) {
      <form (ngSubmit)="guardar()" class="stack" style="gap:16px">
        <div class="two">
          <!-- Marca -->
          <div class="panel">
            <h3>Marca</h3>
            <div class="field"><label for="cNombre">Nombre del negocio</label><input id="cNombre" name="cNombre" [(ngModel)]="c.nombre"></div>
            <div class="field"><span class="flabel">Logo</span>
              <div class="subir">
                <app-logo [logoUrl]="c.logoUrl" [nombre]="c.nombre" style="width:64px;height:64px;border-radius:14px" />
                <div class="stack" style="gap:6px">
                  <label class="btn" style="cursor:pointer">{{ subiendoLogo() ? 'Subiendo…' : c.logoUrl ? 'Cambiar logo' : 'Subir logo' }}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="subirLogo($event)" [disabled]="subiendoLogo()"></label>
                  @if (c.logoUrl) { <button class="linkbtn" type="button" (click)="quitarLogo()">Quitar logo</button> }
                  <span class="hint">Cuadrado, idealmente de 512 × 512. Se aplica de inmediato.</span>
                </div>
              </div></div>
            <div class="row2">
              <div class="field"><label for="cColor1">Color principal</label>
                <div class="row"><input id="cColor1" name="cColor1" type="color" [(ngModel)]="c.colorPrimario" (ngModelChange)="refrescar()" style="width:52px;height:40px;padding:2px">
                  <input name="cColor1t" [(ngModel)]="c.colorPrimario" (ngModelChange)="refrescar()" aria-label="Código del color principal" style="flex:1;min-width:0"></div>
                <span class="hint">Botones, precios destacados y detalles.</span></div>
              <div class="field"><label for="cColor2">Color secundario</label>
                <div class="row"><input id="cColor2" name="cColor2" type="color" [(ngModel)]="c.colorSecundario" (ngModelChange)="refrescar()" style="width:52px;height:40px;padding:2px">
                  <input name="cColor2t" [(ngModel)]="c.colorSecundario" (ngModelChange)="refrescar()" aria-label="Código del color secundario" style="flex:1;min-width:0"></div>
                <span class="hint">Barra del carrito, promociones y logo sin imagen.</span></div>
            </div>
            <div class="muestra-marca" [style.--m1]="muestra().c1" [style.--m1-on]="muestra().t1" [style.--m2]="muestra().c2" [style.--m2-on]="muestra().t2">
              <div class="barra"><app-logo [logoUrl]="c.logoUrl" [nombre]="c.nombre" style="width:30px;height:30px" /> {{ c.nombre || 'Tu negocio' }}</div>
              <div class="cuerpo-m"><span class="boton-m">Agregar</span><span class="muted">Así se verá tu tienda</span></div>
            </div>
            <div class="field"><label for="cTitulo">Título de la portada</label><input id="cTitulo" name="cTitulo" [(ngModel)]="c.tituloPortada" placeholder="Ej: Las mejores hamburguesas del barrio"></div>
            <div class="field"><label for="cMsg">Mensaje de bienvenida</label><textarea id="cMsg" name="cMsg" [(ngModel)]="c.mensaje"></textarea></div>
            <div class="field"><label for="cEslogan">Eslogan <span class="hint">(pie de página)</span></label><input id="cEslogan" name="cEslogan" [(ngModel)]="c.eslogan"></div>
          </div>

          <!-- Contacto -->
          <div class="stack" style="gap:16px">
            <div class="panel">
              <h3>Contacto</h3>
              <div class="field"><label for="cWa">WhatsApp del negocio</label>
                <input id="cWa" name="cWa" inputmode="tel" [(ngModel)]="c.whatsapp" placeholder="3001234567">
                <span class="hint">Aquí llegan los mensajes de los clientes después de pedir.</span></div>
              <div class="field"><label for="cDir">Dirección del local</label><input id="cDir" name="cDir" [(ngModel)]="c.direccion" placeholder="Calle 10 # 5-20"></div>
              <div class="row2">
                <div class="field"><label for="cCiudad">Ciudad</label><input id="cCiudad" name="cCiudad" [(ngModel)]="c.ciudad"></div>
                <div class="field"><label for="cIg">Instagram</label><input id="cIg" name="cIg" [(ngModel)]="c.instagram" placeholder="minegocio"></div>
              </div>
            </div>

            <!-- Pagos -->
            <div class="panel">
              <h3>Pagos</h3>
              <span class="hint">Cuentas a las que el cliente transfiere: Nequi, Daviplata, Bancolombia, una llave Bre-B…</span>
              @for (n of c.cuentas; track $index; let i = $index) {
                <div class="fila-cuenta">
                  <div class="field"><label [for]="'ce' + i">Entidad</label><input [id]="'ce' + i" [name]="'ce' + i" [(ngModel)]="n.entidad" placeholder="Nequi" list="entidades"></div>
                  <div class="field"><label [for]="'ct' + i">Titular</label><input [id]="'ct' + i" [name]="'ct' + i" [(ngModel)]="n.titular"></div>
                  <div class="field"><label [for]="'cn' + i">Número</label><input [id]="'cn' + i" [name]="'cn' + i" [(ngModel)]="n.numero"></div>
                  <label class="check"><input type="checkbox" [name]="'ca' + i" [(ngModel)]="n.activa"> Activa</label>
                  <button class="btn bad" type="button" (click)="c.cuentas.splice(i, 1)" aria-label="Quitar cuenta">✕</button>
                </div>
              }
              <datalist id="entidades"><option value="Nequi"></option><option value="Daviplata"></option><option value="Bancolombia"></option><option value="Llave Bre-B"></option></datalist>
              <div><button class="btn" type="button" (click)="c.cuentas.push({ id: null, entidad: 'Nequi', titular: '', numero: '', activa: true })">+ Cuenta</button></div>
              <label class="check"><input type="checkbox" name="cEfe" [(ngModel)]="c.efectivo"> Aceptar efectivo</label>
            </div>
          </div>
        </div>

        <div class="two">
          <!-- Pedidos -->
          <div class="panel">
            <h3>Cómo recibes pedidos</h3>
            <label class="check"><input type="checkbox" name="cAbierto" [(ngModel)]="c.abierto"> Recibir pedidos en línea</label>
            <span class="hint">Apágalo para pausar la tienda (vacaciones, sin insumos…). El menú se sigue viendo.</span>
            <div class="seg-entrega">
              <label><input type="radio" name="cModo" value="INMEDIATO" [(ngModel)]="c.modoPedido"><b>Entrega inmediata</b><span class="muted">Comidas rápidas, restaurantes: se pide en tu horario y llega en minutos.</span></label>
              <label><input type="radio" name="cModo" value="PROGRAMADO" [(ngModel)]="c.modoPedido"><b>Entrega programada</b><span class="muted">Postres, tortas, mercados: se pide durante la semana y se entrega un día fijo.</span></label>
            </div>

            @if (c.modoPedido === 'INMEDIATO') {
              <div class="row2">
                <div class="field"><label for="cTmin">Tiempo de entrega desde (min)</label><input id="cTmin" name="cTmin" type="number" min="0" [(ngModel)]="c.tiempoMin"></div>
                <div class="field"><label for="cTmax">Hasta (min)</label><input id="cTmax" name="cTmax" type="number" min="0" [(ngModel)]="c.tiempoMax"></div>
              </div>
              <span class="flabel">Horario de atención</span>
              @for (h of c.horarios; track h.dia) {
                <div class="fila-horario">
                  <b>{{ dias[h.dia] }}</b>
                  <label class="check"><input type="checkbox" [name]="'ha' + h.dia" [(ngModel)]="h.activo"> Abre</label>
                  <input type="time" [name]="'hab' + h.dia" [(ngModel)]="h.abre" [disabled]="!h.activo" [attr.aria-label]="dias[h.dia] + ' abre'">
                  <input type="time" [name]="'hci' + h.dia" [(ngModel)]="h.cierra" [disabled]="!h.activo" [attr.aria-label]="dias[h.dia] + ' cierra'">
                </div>
              }
              <span class="hint">Si cierras después de medianoche (ej. 6:00 p. m. a 2:00 a. m.), pon la hora de cierre tal cual.</span>
            } @else {
              <div class="row2">
                <div class="field"><label for="cDia">Día de entrega</label>
                  <select id="cDia" name="cDia" [(ngModel)]="c.diaEntrega">
                    @for (d of [1,2,3,4,5,6,7]; track d) { <option [ngValue]="d">{{ dias[d] }}</option> }
                  </select></div>
                <div class="field"><label for="cCierreD">Cierre de pedidos</label>
                  <select id="cCierreD" name="cCierreD" [(ngModel)]="c.cierreDiasAntes">
                    <option [ngValue]="0">El mismo día</option>
                    <option [ngValue]="1">1 día antes</option>
                    <option [ngValue]="2">2 días antes</option>
                    <option [ngValue]="3">3 días antes</option>
                  </select></div>
              </div>
              <div class="field"><label for="cHora">Hora de cierre (0 a 23)</label><input id="cHora" name="cHora" type="number" min="0" max="23" [(ngModel)]="c.cierreHora">
                <span class="hint">{{ resumenProgramado() }}</span></div>
              <div class="field"><label for="cFranjas">Horas de entrega <span class="hint">(una por línea, opcional)</span></label>
                <textarea id="cFranjas" name="cFranjas" [(ngModel)]="franjasTexto" placeholder="Mañana · 9 a 12&#10;Tarde · 2 a 6"></textarea></div>
            }
            <div class="field"><label for="cMin">Pedido mínimo <span class="hint">(0 = sin mínimo)</span></label><input id="cMin" name="cMin" type="number" min="0" step="1000" [(ngModel)]="c.pedidoMinimo"></div>
          </div>

          <!-- Entrega -->
          <div class="panel">
            <h3>Entregas</h3>
            <label class="check"><input type="checkbox" name="cDomi" [(ngModel)]="c.domicilioActivo"> Hacemos domicilios</label>
            @if (c.domicilioActivo) {
              <div class="field"><label for="cDomV">Valor del domicilio</label><input id="cDomV" name="cDomV" type="number" min="0" step="500" [(ngModel)]="c.domicilioValor">
                <span class="hint">Se cobra cuando no tienes zonas. Con zonas, cada una tiene su valor.</span></div>
              @if (estado.tieneModulo(M.zonas)) {
              <span class="flabel">Zonas o barrios <span class="hint">(opcional)</span></span>
              @for (z of c.zonas; track $index; let i = $index) {
                <div class="fila-zona">
                  <div class="field"><label [for]="'zn' + i">Zona</label><input [id]="'zn' + i" [name]="'zn' + i" [(ngModel)]="z.nombre" placeholder="Centro"></div>
                  <div class="field"><label [for]="'zv' + i">Valor</label><input [id]="'zv' + i" [name]="'zv' + i" type="number" min="0" step="500" [(ngModel)]="z.valor"></div>
                  <label class="check"><input type="checkbox" [name]="'za' + i" [(ngModel)]="z.activa"> Activa</label>
                  <button class="btn bad" type="button" (click)="c.zonas.splice(i, 1)" aria-label="Quitar zona">✕</button>
                </div>
              }
              <div><button class="btn" type="button" (click)="c.zonas.push({ id: null, nombre: '', valor: c.domicilioValor, activa: true })">+ Zona</button></div>
              }
            }
            <label class="check"><input type="checkbox" name="cRec" [(ngModel)]="c.recogerActivo"> El cliente puede recoger en el local</label>
            @if (c.recogerActivo && !c.direccion) { <span class="err">Escribe la dirección del local en «Contacto».</span> }

            <span class="sec-titulo">Reportes</span>
            <div class="field"><label for="cOper">Gasto operativo por unidad vendida <span class="hint">(gas, energía, empaques…)</span></label>
              <input id="cOper" name="cOper" type="number" min="0" step="10" [(ngModel)]="c.costoOperativoUnidad">
              <span class="hint">Se resta de la ganancia en «Ventas». Déjalo en 0 si ya lo incluyes en el costo de cada producto.</span></div>
          </div>
        </div>

        <div class="toolbar" style="position:sticky;bottom:0;background:var(--bg);padding-block:10px;margin:0;z-index:5">
          <button class="btn main" type="submit" [disabled]="guardando()" style="padding:10px 18px;font-size:15px">{{ guardando() ? 'Guardando…' : 'Guardar cambios' }}</button>
          @if (error()) { <span class="err">{{ error() }}</span> }
        </div>
      </form>
    } @else if (error()) {
      <div class="alerta mala">{{ error() }}</div>
    }

    <div class="two" style="margin-block:16px 40px">
      <form class="panel" (ngSubmit)="crearAdmin(fa)" #fa="ngForm">
        <h3>Administradores</h3>
        <p class="muted">Todos pueden ver pedidos y cambiar la tienda.</p>
        @for (a of admins(); track a.id) { <div class="row"><b>{{ a.nombre }}</b><span class="muted">usuario {{ a.usuario }}</span></div> }
        <div class="row2">
          <div class="field"><label for="aNombre">Nombre</label><input id="aNombre" name="aNombre" [(ngModel)]="nuevoAdmin.nombre"></div>
          <div class="field"><label for="aUsuario">Usuario</label><input id="aUsuario" name="aUsuario" autocomplete="off" [(ngModel)]="nuevoAdmin.usuario"></div>
        </div>
        <div class="field"><label for="aClave">Clave <span class="hint">(mínimo 8 caracteres)</span></label><input id="aClave" name="aClave" type="password" autocomplete="new-password" [(ngModel)]="nuevoAdmin.clave"></div>
        @if (errorAdmin()) { <p class="err">{{ errorAdmin() }}</p> }
        <div><button class="btn main" type="submit">Agregar administrador</button></div>
      </form>

      <form class="panel" (ngSubmit)="cambiarClave(fk)" #fk="ngForm">
        <h3>Cambiar mi clave</h3>
        <div class="field"><label for="kActual">Clave actual</label><input id="kActual" name="kActual" type="password" autocomplete="current-password" [(ngModel)]="clave.actual"></div>
        <div class="field"><label for="kNueva">Clave nueva <span class="hint">(mínimo 8 caracteres)</span></label><input id="kNueva" name="kNueva" type="password" autocomplete="new-password" [(ngModel)]="clave.nueva"></div>
        @if (errorClave()) { <p class="err">{{ errorClave() }}</p> }
        <div><button class="btn main" type="submit">Cambiar clave</button></div>
      </form>
    </div>
  `,
})
export class ConfigPage {
  private api = inject(AdminApi);
  private avisos = inject(Avisos);
  protected estado = inject(EstadoTienda);
  protected readonly M = MODULOS;
  protected subiendoLogo = signal(false);

  protected dias = DIAS;
  protected config = signal<ConfigAdmin | null>(null);
  protected franjasTexto = '';
  protected guardando = signal(false);
  protected error = signal('');
  protected clave = { actual: '', nueva: '' };
  protected errorClave = signal('');
  protected admins = signal<AdminUsuario[]>([]);
  protected nuevoAdmin = { nombre: '', usuario: '', clave: '' };
  protected errorAdmin = signal('');
  private version = signal(0);

  /** Colores de la vista previa; se recalculan al mover los selectores. */
  protected muestra = computed(() => {
    this.version();
    const c = this.config();
    const c1 = valido(c?.colorPrimario) ? c!.colorPrimario : '#E9A23B';
    const c2 = valido(c?.colorSecundario) ? c!.colorSecundario : '#3A2620';
    return { c1, c2, t1: textoSobre(c1), t2: textoSobre(c2) };
  });

  constructor() {
    this.api.config().subscribe({ next: (c) => this.cargar(c), error: (e) => this.error.set(mensajeError(e)) });
    this.api.administradores().subscribe((l) => this.admins.set(l));
  }

  private cargar(c: ConfigAdmin): void {
    this.franjasTexto = c.franjas.join('\n');
    this.config.set(structuredClone(c));
  }

  protected refrescar(): void {
    this.version.update((v) => v + 1);
  }

  protected resumenProgramado(): string {
    const c = this.config();
    if (!c) return '';
    const dia = (c.diaEntrega - Number(c.cierreDiasAntes) + 7 - 1) % 7 + 1;
    return `Entregas los ${DIAS[c.diaEntrega]!.toLowerCase()} y recibes pedidos hasta el ${DIAS[dia]!.toLowerCase()} a las ${c.cierreHora}:00.`;
  }

  protected guardar(): void {
    const c = this.config();
    if (!c) return;
    if (!valido(c.colorPrimario) || !valido(c.colorSecundario)) { this.error.set('Los colores deben tener el formato #RRGGBB.'); return; }
    const datos: ConfigAdmin = {
      ...c,
      whatsapp: c.whatsapp.replace(/\D/g, ''),
      tiempoMin: Number(c.tiempoMin) || 0, tiempoMax: Number(c.tiempoMax) || 0,
      cierreHora: Number(c.cierreHora), cierreDiasAntes: Number(c.cierreDiasAntes), diaEntrega: Number(c.diaEntrega),
      pedidoMinimo: Number(c.pedidoMinimo) || 0, domicilioValor: Number(c.domicilioValor) || 0,
      costoOperativoUnidad: Number(c.costoOperativoUnidad) || 0,
      franjas: this.franjasTexto.split('\n').map((s) => s.trim()).filter(Boolean),
      zonas: c.zonas.filter((z) => z.nombre.trim()).map((z) => ({ ...z, nombre: z.nombre.trim(), valor: Number(z.valor) || 0 })),
      cuentas: c.cuentas.map((n) => ({ ...n, entidad: n.entidad.trim(), titular: n.titular.trim(), numero: n.numero.trim() })),
    };
    this.guardando.set(true);
    this.error.set('');
    this.api.guardarConfig(datos).subscribe({
      next: (r) => {
        this.cargar(r);
        this.guardando.set(false);
        this.avisos.mostrar('Cambios guardados');
        this.estado.cargar(); // aplica la nueva marca en el panel y la tienda
      },
      error: (e) => { this.error.set(mensajeError(e)); this.guardando.set(false); },
    });
  }

  protected subirLogo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) { this.error.set('El logo debe pesar menos de 2 MB.'); return; }
    this.subiendoLogo.set(true);
    this.api.subirLogo(archivo).subscribe({
      next: (r) => this.logoCambiado(r.logoUrl, 'Logo actualizado'),
      error: (e) => { this.error.set(mensajeError(e)); this.subiendoLogo.set(false); },
    });
  }

  protected quitarLogo(): void {
    this.api.quitarLogo().subscribe({
      next: (r) => this.logoCambiado(r.logoUrl, 'Logo quitado'),
      error: (e) => this.error.set(mensajeError(e)),
    });
  }

  /** Solo cambia el logo: lo demás que el administrador esté editando se conserva. */
  private logoCambiado(logoUrl: string | null, aviso: string): void {
    this.config.update((c) => c && { ...c, logoUrl });
    this.subiendoLogo.set(false);
    this.error.set('');
    this.avisos.mostrar(aviso);
    this.estado.cargar();
  }

  protected crearAdmin(form: NgForm): void {
    const a = this.nuevoAdmin;
    if (!a.nombre.trim() || !a.usuario.trim() || a.clave.length < 8) {
      this.errorAdmin.set('Escribe nombre, usuario y una clave de al menos 8 caracteres.');
      return;
    }
    this.api.crearAdmin(a.usuario.trim(), a.nombre.trim(), a.clave).subscribe({
      next: (n) => {
        this.admins.update((l) => [...l, n]);
        form.resetForm();
        this.nuevoAdmin = { nombre: '', usuario: '', clave: '' };
        this.errorAdmin.set('');
        this.avisos.mostrar(`${n.nombre} ya puede entrar al panel`);
      },
      error: (e) => this.errorAdmin.set(mensajeError(e)),
    });
  }

  protected cambiarClave(form: NgForm): void {
    if (!this.clave.actual || this.clave.nueva.length < 8) { this.errorClave.set('Escribe la clave actual y una nueva de al menos 8 caracteres.'); return; }
    this.api.cambiarClave(this.clave.actual, this.clave.nueva).subscribe({
      next: () => { form.resetForm(); this.clave = { actual: '', nueva: '' }; this.errorClave.set(''); this.avisos.mostrar('Clave cambiada'); },
      error: (e) => this.errorClave.set(mensajeError(e)),
    });
  }
}

function valido(color: string | undefined): boolean {
  return !!color && /^#[0-9a-fA-F]{6}$/.test(color);
}
