import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Logo } from '../compartido/logo';
import { SelectorModulos } from '../compartido/selector-modulos';
import { SelectorPlan } from '../compartido/selector-plan';
import { PlataformaApi, mensajeError } from '../core/api';
import { enVivoPlataforma } from './en-vivo';
import { PagosEmpresa } from './pagos-empresa';
import { Avisos } from '../core/avisos';
import { DineroPipe, HoraPipe } from '../core/formato';
import { ActualizarEmpresa, EmpresaDetalle, EstadoEmpresa, ModuloPlataforma, NOMBRE_ESTADO_EMPRESA, Plan } from '../core/modelos';

const EN_PREPARACION: EstadoEmpresa[] = ['pendiente_aprovisionamiento', 'aprovisionando'];

/** Detalle de una empresa: estado del aprovisionamiento, datos, marca, módulos y acciones. */
@Component({
  selector: 'app-detalle-empresa',
  imports: [FormsModule, RouterLink, Logo, HoraPipe, DineroPipe, SelectorPlan, SelectorModulos, PagosEmpresa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p style="margin-bottom:10px"><a class="linkbtn" routerLink="/superadmin/empresas">← Empresas</a></p>
    @if (error() && !empresa()) { <div class="alerta mala">{{ error() }}</div> }

    @if (empresa(); as e) {
      <div class="admin-h" style="padding-top:4px">
        <div class="empresa-fila">
          <app-logo [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" style="width:52px;height:52px;border-radius:14px" />
          <div class="stack" style="gap:2px">
            <h1>{{ e.nombreComercial }}</h1>
            <div class="row" style="gap:8px"><span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span>
              <span class="muted num">/{{ e.identificador }}</span>
              <span class="muted">· Plan {{ nombrePlan(e.plan) }} · {{ e.precioPlan | dinero }}/{{ e.cicloFacturacion === 'ANUAL' ? 'año' : 'mes' }}</span></div>
          </div>
        </div>
        <div class="row" style="flex-wrap:wrap;gap:6px">
          @if (e.estado === 'activa') {
            <a class="btn" [href]="'/' + e.identificador" target="_blank" rel="noopener">Ver tienda</a>
            <a class="btn" [href]="'/' + e.identificador + '/admin'" target="_blank" rel="noopener">Portal de pedidos</a>
            <button class="btn bad" type="button" (click)="suspender()">Suspender</button>
          }
          @if (e.estado === 'suspendida') { <button class="btn okb" type="button" (click)="accion(api.activar(e.uuid), 'Empresa reactivada')">Reactivar</button> }
          @if (e.estado === 'error_aprovisionamiento') { <button class="btn main" type="button" (click)="accion(api.reintentar(e.uuid), 'Se volvió a poner en cola')">Reintentar</button> }
        </div>
      </div>

      @if (credenciales(); as k) {
        <div class="alerta buena" style="margin-bottom:16px">
          Acceso del administrador: usuario <b class="num">{{ k.usuario }}</b> · clave <b class="num">{{ k.clave }}</b>.
          Cópialo ahora; no se vuelve a mostrar.
          <button class="btn" type="button" style="margin-left:8px" (click)="credenciales.set(null)">Listo</button>
        </div>
      }
      @if (e.estado === 'suspendida') { <div class="alerta aviso" style="margin-bottom:16px">La tienda y el portal de esta empresa no están disponibles mientras esté suspendida.</div> }

      @if (e.aprovisionamiento; as a) {
        @if (enPreparacion() || e.estado === 'error_aprovisionamiento') {
          <div class="panel" style="margin-bottom:16px">
            <h3>{{ enPreparacion() ? 'Preparando la empresa…' : 'La preparación falló' }}</h3>
            <p class="muted" style="font-size:14px">
              Paso: <b>{{ a.pasoActual || 'en cola' }}</b> · intentos {{ a.intentos }} · {{ a.actualizadoEn | hora }}
              @if (enPreparacion()) { · <span class="en-vivo" [class.off]="!vivo.enVivo()">{{ vivo.enVivo() ? 'En vivo' : 'Reconectando' }}</span> }
            </p>
            @if (a.registro) { <pre class="registro">{{ a.registro }}</pre> }
          </div>
        }
      }

      <div class="two">
        <form class="panel" (ngSubmit)="guardar()">
          <h3>Datos y marca</h3>
          <div class="field"><label for="dNombre">Nombre comercial</label><input id="dNombre" name="dNombre" [(ngModel)]="f.nombreComercial"></div>
          <div class="field"><label for="dRazon">Razón social</label><input id="dRazon" name="dRazon" [(ngModel)]="f.razonSocial"></div>
          <div class="row2">
            <div class="field"><label for="dNit">NIT</label><input id="dNit" name="dNit" [(ngModel)]="f.nit"></div>
          </div>
          <div class="field"><span class="flabel">Plan y facturación</span>
            <app-selector-plan [planes]="planesVisibles()" [(plan)]="f.plan" [(ciclo)]="f.cicloFacturacion" (elegido)="elegidos.set(modulosDe($event))" />
            <span class="hint">Al cambiar de plan, los módulos de abajo se ajustan a los que incluye; revísalos y pulsa «Guardar módulos» para aplicarlos.</span></div>
          <div class="field"><label for="dResp">Responsable</label><input id="dResp" name="dResp" [(ngModel)]="f.responsableNombre"></div>
          <div class="row2">
            <div class="field"><label for="dCorreo">Correo</label><input id="dCorreo" name="dCorreo" type="email" [(ngModel)]="f.responsableCorreo"></div>
            <div class="field"><label for="dCel">Celular</label><input id="dCel" name="dCel" [(ngModel)]="f.responsableCelular"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="dC1">Color principal</label>
              <div class="row"><input id="dC1" name="dC1" type="color" [(ngModel)]="f.colorPrimario" style="width:52px;height:40px;padding:2px">
                <input name="dC1t" [(ngModel)]="f.colorPrimario" aria-label="Código del color principal" style="flex:1;min-width:0"></div></div>
            <div class="field"><label for="dC2">Color secundario</label>
              <div class="row"><input id="dC2" name="dC2" type="color" [(ngModel)]="f.colorSecundario" style="width:52px;height:40px;padding:2px">
                <input name="dC2t" [(ngModel)]="f.colorSecundario" aria-label="Código del color secundario" style="flex:1;min-width:0"></div></div>
          </div>
          <div class="field"><label for="dDom">Dominio propio</label><input id="dDom" name="dDom" [(ngModel)]="f.dominioPropio" placeholder="pedidos.minegocio.com"></div>
          <div class="field"><label for="dNotas">Notas internas</label><textarea id="dNotas" name="dNotas" [(ngModel)]="f.notas"></textarea></div>
          @if (errorDatos()) { <p class="err">{{ errorDatos() }}</p> }
          <div><button class="btn main" type="submit" [disabled]="ocupado()">Guardar datos</button></div>
        </form>

        <div class="stack" style="gap:16px">
          <div class="panel">
            <h3>Logo</h3>
            <div class="subir">
              <app-logo [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" style="width:64px;height:64px;border-radius:14px" />
              <label class="btn" style="cursor:pointer">{{ e.logoUrl ? 'Cambiar logo' : 'Subir logo' }}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="subirLogo($event)"></label>
              @if (e.logoUrl) { <button class="linkbtn" type="button" (click)="accion(api.quitarLogo(e.uuid), 'Logo quitado')">Quitar</button> }
            </div>
          </div>

          <div class="panel">
            <h3>Módulos</h3>
            <app-selector-modulos [modulos]="modulos()" [(elegidos)]="elegidos" [plan]="planActual()" />
            <div><button class="btn main" type="button" [disabled]="ocupado() || !modulosCambiados()" (click)="guardarModulos()">Guardar módulos</button></div>
          </div>

          @if (e.estado === 'activa') {
            <div class="panel">
              <h3>Productos precargados</h3>
              <p class="muted">Salchipapas, hamburguesas, perros, pizzas, bebidas y más, con fotos y precios listos para asignarle a esta empresa.</p>
              <div><a class="btn main" [routerLink]="['/superadmin/biblioteca']" [queryParams]="{ empresa: e.uuid }">Elegir productos</a></div>
            </div>
            <form class="panel" (ngSubmit)="restablecer(fk)" #fk="ngForm">
              <h3>Clave de un administrador</h3>
              <p class="muted" style="font-size:14px">Si la empresa olvidó su clave, asígnale una nueva y compártela.</p>
              <div class="row2">
                <div class="field"><label for="kUsuario">Usuario</label><input id="kUsuario" name="kUsuario" autocomplete="off" [(ngModel)]="clave.usuario"></div>
                <div class="field"><label for="kNueva">Clave nueva</label><input id="kNueva" name="kNueva" autocomplete="off" [(ngModel)]="clave.nueva"></div>
              </div>
              @if (errorClave()) { <p class="err">{{ errorClave() }}</p> }
              <div><button class="btn main" type="submit">Asignar clave</button></div>
            </form>
          }
        </div>
      </div>

      @if (e.estado === 'activa' || e.estado === 'suspendida') {
        <div style="margin-top:16px"><app-pagos-empresa [uuid]="e.uuid" /></div>
      }

      <div class="two" style="margin-block:16px 40px">
        <div class="panel">
          <h3>Base de datos</h3>
          @if (e.conexion; as c) {
            <dl class="datos">
              <dt>Servidor</dt><dd class="num">{{ c.host }}:{{ c.puerto }}</dd>
              <dt>Base</dt><dd class="num">{{ c.nombreBase }}</dd>
              <dt>Dueño</dt><dd class="num">{{ c.usuarioOwner }}</dd>
              <dt>Aplicación</dt><dd class="num">{{ c.usuarioApp }}</dd>
              <dt>Lectura</dt><dd class="num">{{ c.usuarioLectura }}</dd>
            </dl>
            <span class="hint">Las claves están cifradas en la base de control y no se muestran.</span>
          } @else { <p class="muted">Todavía no se ha creado.</p> }
        </div>
        <div class="panel">
          <h3>Versión del esquema</h3>
          @for (v of e.versiones; track $index) {
            <div class="row" style="justify-content:space-between"><span class="num">{{ v.ultimaMigracionAplicada }}</span><span class="muted">{{ v.aplicadaEn | hora }}</span></div>
          } @empty { <p class="muted">Sin migraciones aplicadas.</p> }
          <dl class="datos" style="margin-top:8px"><dt>Creada</dt><dd>{{ e.creadoEn | hora }}</dd></dl>
        </div>
      </div>
    }
  `,
})
export class DetalleEmpresaPage {
  protected api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  readonly uuid = input.required<string>();

  protected empresa = signal<EmpresaDetalle | null>(null);
  protected modulos = signal<ModuloPlataforma[]>([]);
  protected elegidos = signal(new Set<string>());
  protected error = signal('');
  protected errorDatos = signal('');
  protected errorClave = signal('');
  protected ocupado = signal(false);
  protected credenciales = signal<{ usuario: string; clave: string } | null>(null);
  protected f: ActualizarEmpresa = vacio();
  protected clave = { usuario: '', nueva: '' };
  protected vivo: { enVivo: () => boolean };

  protected enPreparacion = computed(() => EN_PREPARACION.includes(this.empresa()?.estado as EstadoEmpresa));
  protected modulosCambiados = computed(() => {
    const e = this.empresa();
    if (!e) return false;
    const actuales = new Set(e.modulos);
    const elegidos = this.elegidos();
    return this.modulos().some((m) => !m.esBase && actuales.has(m.codigo) !== elegidos.has(m.codigo));
  });

  protected planes = signal<Plan[]>([]);
  /** Los planes activos, más el que la empresa ya tiene aunque esté desactivado. */
  protected planesVisibles = computed(() => this.planes().filter((p) => p.activo || p.codigo === this.empresa()?.plan));
  protected planActual(): Plan | null { return this.planes().find((p) => p.codigo === this.f.plan) ?? null; }
  protected modulosDe(p: Plan): Set<string> { return new Set(p.modulos); }
  protected nombrePlan(codigo: string | null): string {
    return this.planes().find((p) => p.codigo === codigo)?.nombre ?? codigo ?? '';
  }

  constructor() {
    // Clave del administrador recién creada (llega desde "Nueva empresa").
    const estado = history.state as { usuario?: string; clave?: string } | null;
    if (estado?.usuario && estado.clave) this.credenciales.set({ usuario: estado.usuario, clave: estado.clave });
    if (estado?.clave) {
      // Se quita del historial para que no vuelva a aparecer al recargar.
      history.replaceState({ ...estado, usuario: undefined, clave: undefined }, '');
    }

    this.api.modulos().subscribe((l) => this.modulos.set(l));
    this.api.planes().subscribe((l) => this.planes.set(l));
    effect(() => {
      const uuid = this.uuid();
      untracked(() => this.cargar(uuid, true));
    });
    // En vivo: cada paso del aprovisionamiento y cada cambio de estado se ve al instante.
    this.vivo = enVivoPlataforma(() => this.cargar(this.uuid(), false));
    const t = setInterval(() => { if (this.enPreparacion()) this.cargar(this.uuid(), false); }, 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  private cargar(uuid: string, formulario: boolean): void {
    this.api.empresa(uuid).subscribe({
      next: (e) => this.mostrar(e, formulario),
      error: (err) => this.error.set(mensajeError(err)),
    });
  }

  /** Muestra la empresa; el formulario solo se reemplaza si se pide (para no borrar lo que se está escribiendo). */
  private mostrar(e: EmpresaDetalle, formulario = true): void {
    this.empresa.set(e);
    this.error.set('');
    this.elegidos.set(new Set(e.modulos));
    if (formulario) {
      this.f = {
        razonSocial: e.razonSocial, nit: e.nit ?? '', responsableNombre: e.responsableNombre,
        responsableCorreo: e.responsableCorreo ?? '', responsableCelular: e.responsableCelular ?? '', plan: e.plan ?? 'basico', cicloFacturacion: e.cicloFacturacion,
        notas: e.notas ?? '', nombreComercial: e.nombreComercial, colorPrimario: e.colorPrimario,
        colorSecundario: e.colorSecundario, dominioPropio: e.dominioPropio ?? '',
      };
    }
  }

  protected nombreEstado(e: EstadoEmpresa): string {
    return NOMBRE_ESTADO_EMPRESA[e] ?? e;
  }

  /** Ejecuta una acción que devuelve la empresa actualizada. */
  protected accion(obs: Observable<EmpresaDetalle>, aviso: string, formulario = false): void {
    this.ocupado.set(true);
    obs.subscribe({
      next: (e) => { this.mostrar(e, formulario); this.ocupado.set(false); this.avisos.mostrar(aviso); },
      error: (err) => { this.avisos.mostrar(mensajeError(err)); this.ocupado.set(false); },
    });
  }

  protected guardar(): void {
    const e = this.empresa();
    if (!e) return;
    if (!/^#[0-9a-fA-F]{6}$/.test(this.f.colorPrimario) || !/^#[0-9a-fA-F]{6}$/.test(this.f.colorSecundario)) {
      this.errorDatos.set('Los colores deben tener el formato #RRGGBB.');
      return;
    }
    this.errorDatos.set('');
    this.ocupado.set(true);
    this.api.actualizarEmpresa(e.uuid, { ...this.f, dominioPropio: this.f.dominioPropio.trim().toLowerCase() }).subscribe({
      next: (r) => { this.mostrar(r); this.ocupado.set(false); this.avisos.mostrar('Datos guardados'); },
      error: (err) => { this.errorDatos.set(mensajeError(err)); this.ocupado.set(false); },
    });
  }

  protected guardarModulos(): void {
    const e = this.empresa();
    if (!e) return;
    const lista = this.modulos().filter((m) => m.esBase || this.elegidos().has(m.codigo)).map((m) => m.codigo);
    this.accion(this.api.guardarModulos(e.uuid, lista), 'Módulos actualizados');
  }

  protected subirLogo(ev: Event): void {
    const e = this.empresa();
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!e || !archivo) return;
    if (archivo.size > 2 * 1024 * 1024) { this.avisos.mostrar('El logo debe pesar menos de 2 MB.'); return; }
    this.accion(this.api.subirLogo(e.uuid, archivo), 'Logo actualizado');
  }

  protected suspender(): void {
    const e = this.empresa();
    if (!e) return;
    // Sin diálogos del navegador: se pide confirmar con un segundo clic.
    if (!this.confirmando) {
      this.confirmando = true;
      this.avisos.mostrar('Vuelve a tocar «Suspender» para confirmar.');
      setTimeout(() => (this.confirmando = false), 4000);
      return;
    }
    this.confirmando = false;
    this.accion(this.api.suspender(e.uuid), 'Empresa suspendida');
  }
  private confirmando = false;

  protected restablecer(form: NgForm): void {
    const e = this.empresa();
    if (!e) return;
    if (!this.clave.usuario.trim() || this.clave.nueva.length < 8) {
      this.errorClave.set('Escribe el usuario y una clave de al menos 8 caracteres.');
      return;
    }
    this.api.claveAdmin(e.uuid, this.clave.usuario.trim(), this.clave.nueva).subscribe({
      next: () => {
        this.avisos.mostrar(`Clave asignada a ${this.clave.usuario.trim()}`);
        form.resetForm();
        this.clave = { usuario: '', nueva: '' };
        this.errorClave.set('');
      },
      error: (err) => this.errorClave.set(mensajeError(err)),
    });
  }
}

function vacio(): ActualizarEmpresa {
  return {
    razonSocial: '', nit: '', responsableNombre: '', responsableCorreo: '', responsableCelular: '', plan: 'basico', cicloFacturacion: 'MENSUAL', notas: '',
    nombreComercial: '', colorPrimario: '#1D4ED8', colorSecundario: '#0F172A', dominioPropio: '',
  };
}
