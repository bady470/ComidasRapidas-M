import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Icono } from '../compartido/icono';
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

type Pestana = 'resumen' | 'datos' | 'plan' | 'pagos' | 'acceso' | 'tecnico';

/**
 * Detalle de una empresa, ordenado en pestañas: un resumen para ubicarse, y aparte lo que se edita (datos y marca,
 * plan y módulos), los pagos, el acceso del administrador y lo técnico (base de datos y migraciones).
 */
@Component({
  selector: 'app-detalle-empresa',
  imports: [FormsModule, RouterLink, Icono, Logo, HoraPipe, DineroPipe, SelectorPlan, SelectorModulos, PagosEmpresa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="linkbtn sa-volver" routerLink="/superadmin/empresas"><app-icono nombre="flecha" [tam]="14" /> Todas las empresas</a>
    @if (error() && !empresa()) { <div class="alerta mala">{{ error() }}</div> }

    @if (empresa(); as e) {
      <!-- Cabecera con los colores de la marca: quién es, en qué estado está y lo que se hace con un clic -->
      <section class="sa-cab" [style.--c1]="e.colorPrimario" [style.--c2]="e.colorSecundario">
        <div class="sa-cab-id">
          <app-logo class="sa-logo enorme" [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" />
          <div class="sa-cab-txt">
            <h2>{{ e.nombreComercial }}</h2>
            <div class="sa-cab-meta">
              <span [class]="'st st-' + e.estado">{{ nombreEstado(e.estado) }}</span>
              <span class="num">/{{ e.identificador }}</span>
              <span>Plan {{ nombrePlan(e.plan) }} · {{ e.precioPlan | dinero }}/{{ e.cicloFacturacion === 'ANUAL' ? 'año' : 'mes' }}</span>
            </div>
          </div>
        </div>
        <div class="sa-cab-acc">
          @if (e.estado === 'activa') {
            <a class="btn" [href]="'/' + e.identificador" target="_blank" rel="noopener"><app-icono nombre="tienda" /> Tienda</a>
            <a class="btn" [href]="'/' + e.identificador + '/admin'" target="_blank" rel="noopener"><app-icono nombre="externo" /> Portal</a>
            <button class="btn bad" type="button" (click)="suspender()"><app-icono nombre="pausa" /> {{ confirmar() ? '¿Seguro? Toca otra vez' : 'Suspender' }}</button>
          }
          @if (e.estado === 'suspendida') { <button class="btn main" type="button" (click)="accion(api.activar(e.uuid), 'Empresa reactivada')"><app-icono nombre="ok" /> Reactivar</button> }
          @if (e.estado === 'error_aprovisionamiento') { <button class="btn main" type="button" (click)="accion(api.reintentar(e.uuid), 'Se volvió a poner en cola')">Reintentar</button> }
        </div>
      </section>

      @if (credenciales(); as k) {
        <div class="alerta buena sa-credenciales">
          <span>Acceso del administrador: usuario <b class="num">{{ k.usuario }}</b> · clave <b class="num">{{ k.clave }}</b>. Cópialo ahora; no se vuelve a mostrar.</span>
          <button class="btn" type="button" (click)="credenciales.set(null)">Listo</button>
        </div>
      }
      @if (e.estado === 'suspendida') { <div class="alerta aviso">La tienda y el portal de esta empresa no están disponibles mientras esté suspendida.</div> }

      @if (e.aprovisionamiento; as a) {
        @if (enPreparacion() || e.estado === 'error_aprovisionamiento') {
          <div class="panel sa-prep" [class.mal]="e.estado === 'error_aprovisionamiento'">
            <h3>{{ enPreparacion() ? 'Preparando la empresa…' : 'La preparación falló' }}</h3>
            <p class="muted">
              Paso: <b>{{ a.pasoActual || 'en cola' }}</b> · intentos {{ a.intentos }} · {{ a.actualizadoEn | hora }}
              @if (enPreparacion()) { · <span class="en-vivo" [class.off]="!vivo.enVivo()">{{ vivo.enVivo() ? 'En vivo' : 'Reconectando' }}</span> }
            </p>
            @if (enPreparacion()) { <div class="sa-barra animada"><i></i></div> }
            @if (a.registro) { <pre class="registro">{{ a.registro }}</pre> }
          </div>
        }
      }

      <nav class="sa-tabs" aria-label="Secciones de la empresa">
        @for (t of pestanas(); track t.k) {
          <button type="button" [attr.aria-pressed]="pestana() === t.k" (click)="pestana.set(t.k)">
            <app-icono [nombre]="t.icono" [tam]="16" /> {{ t.t }}
          </button>
        }
      </nav>

      @switch (pestana()) {
        @case ('resumen') {
          <div class="sa-resumen">
            <div class="panel sa-ficha">
              <h3><app-icono nombre="cuenta" /> Responsable</h3>
              <dl class="datos">
                <dt>Nombre</dt><dd>{{ e.responsableNombre || '—' }}</dd>
                <dt>Correo</dt><dd>@if (e.responsableCorreo) { <a [href]="'mailto:' + e.responsableCorreo">{{ e.responsableCorreo }}</a> } @else { — }</dd>
                <dt>Celular</dt><dd class="num">{{ e.responsableCelular || '—' }}</dd>
                <dt>Razón social</dt><dd>{{ e.razonSocial }}{{ e.nit ? ' · NIT ' + e.nit : '' }}</dd>
              </dl>
              <div><button class="linkbtn" type="button" (click)="pestana.set('datos')">Editar datos</button></div>
            </div>
            <div class="panel sa-ficha">
              <h3><app-icono nombre="planes" /> Plan</h3>
              <div class="sa-precio"><b class="num">{{ e.precioPlan | dinero }}</b><span class="muted">/{{ e.cicloFacturacion === 'ANUAL' ? 'año' : 'mes' }}</span></div>
              <p class="muted">{{ nombrePlan(e.plan) }} · {{ modulosActivos() }} módulo{{ modulosActivos() === 1 ? '' : 's' }} activo{{ modulosActivos() === 1 ? '' : 's' }}</p>
              <div><button class="linkbtn" type="button" (click)="pestana.set('plan')">Cambiar plan o módulos</button></div>
            </div>
            <div class="panel sa-ficha">
              <h3><app-icono nombre="enlace" /> Direcciones</h3>
              <dl class="datos">
                <dt>Tienda</dt><dd class="num"><a [href]="'/' + e.identificador" target="_blank" rel="noopener">/{{ e.identificador }}</a></dd>
                <dt>Portal</dt><dd class="num"><a [href]="'/' + e.identificador + '/admin'" target="_blank" rel="noopener">/{{ e.identificador }}/admin</a></dd>
                <dt>Dominio</dt><dd>{{ e.dominioPropio || 'Sin dominio propio' }}</dd>
                <dt>Creada</dt><dd>{{ e.creadoEn | hora }}</dd>
              </dl>
            </div>
            @if (e.estado === 'activa') {
              <div class="panel sa-ficha sa-accion">
                <h3><app-icono nombre="biblioteca" /> Productos precargados</h3>
                <p class="muted">Salchipapas, hamburguesas, perros, pizzas, bebidas y más, con fotos y precios listos para asignarle a esta empresa.</p>
                <div><a class="btn main" [routerLink]="['/superadmin/biblioteca']" [queryParams]="{ empresa: e.uuid }">Elegir productos</a></div>
              </div>
            }
            @if (e.notas) {
              <div class="panel sa-ficha">
                <h3><app-icono nombre="nota" /> Notas internas</h3>
                <p class="sa-notas">{{ e.notas }}</p>
              </div>
            }
          </div>
        }

        @case ('datos') {
          <div class="two">
            <form class="panel" (ngSubmit)="guardar()">
              <h3>Datos de la empresa</h3>
              <div class="field"><label for="dNombre">Nombre comercial</label><input id="dNombre" name="dNombre" [(ngModel)]="f.nombreComercial"></div>
              <div class="row2">
                <div class="field"><label for="dRazon">Razón social</label><input id="dRazon" name="dRazon" [(ngModel)]="f.razonSocial"></div>
                <div class="field"><label for="dNit">NIT</label><input id="dNit" name="dNit" [(ngModel)]="f.nit"></div>
              </div>
              <div class="field"><label for="dResp">Responsable</label><input id="dResp" name="dResp" [(ngModel)]="f.responsableNombre"></div>
              <div class="row2">
                <div class="field"><label for="dCorreo">Correo</label><input id="dCorreo" name="dCorreo" type="email" [(ngModel)]="f.responsableCorreo"></div>
                <div class="field"><label for="dCel">Celular</label><input id="dCel" name="dCel" [(ngModel)]="f.responsableCelular"></div>
              </div>
              <div class="field"><label for="dDom">Dominio propio <span class="hint">(opcional)</span></label><input id="dDom" name="dDom" [(ngModel)]="f.dominioPropio" placeholder="pedidos.minegocio.com"></div>
              <div class="field"><label for="dNotas">Notas internas <span class="hint">(solo las ve el superadmin)</span></label><textarea id="dNotas" name="dNotas" [(ngModel)]="f.notas"></textarea></div>
              @if (errorDatos()) { <p class="err">{{ errorDatos() }}</p> }
              <div><button class="btn main" type="submit" [disabled]="ocupado()">Guardar datos</button></div>
            </form>

            <div class="stack" style="gap:16px">
              <form class="panel" (ngSubmit)="guardar()">
                <h3>Marca</h3>
                <!-- Vista previa: así se ven la barra y el botón de la tienda con estos colores -->
                <div class="sa-muestra" [style.--c1]="f.colorPrimario" [style.--c2]="f.colorSecundario" aria-hidden="true">
                  <span class="sa-muestra-barra"><app-logo class="sa-logo" [logoUrl]="e.logoUrl" [nombre]="f.nombreComercial || e.nombreComercial" [style.background]="f.colorSecundario" /> <b>{{ f.nombreComercial || e.nombreComercial }}</b></span>
                  <span class="sa-muestra-btn">Hacer pedido</span>
                </div>
                <div class="row2">
                  <div class="field"><label for="dC1">Color principal</label>
                    <div class="row"><input id="dC1" name="dC1" type="color" [(ngModel)]="f.colorPrimario" style="width:52px;height:40px;padding:2px">
                      <input name="dC1t" [(ngModel)]="f.colorPrimario" aria-label="Código del color principal" style="flex:1;min-width:0"></div></div>
                  <div class="field"><label for="dC2">Color secundario</label>
                    <div class="row"><input id="dC2" name="dC2" type="color" [(ngModel)]="f.colorSecundario" style="width:52px;height:40px;padding:2px">
                      <input name="dC2t" [(ngModel)]="f.colorSecundario" aria-label="Código del color secundario" style="flex:1;min-width:0"></div></div>
                </div>
                <div><button class="btn main" type="submit" [disabled]="ocupado()">Guardar colores</button></div>
              </form>
              <div class="panel">
                <h3>Logo</h3>
                <div class="subir">
                  <app-logo [logoUrl]="e.logoUrl" [nombre]="e.nombreComercial" [style.background]="e.colorSecundario" style="width:64px;height:64px;border-radius:14px" />
                  <label class="btn" style="cursor:pointer">{{ e.logoUrl ? 'Cambiar logo' : 'Subir logo' }}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="subirLogo($event)"></label>
                  @if (e.logoUrl) { <button class="linkbtn" type="button" (click)="accion(api.quitarLogo(e.uuid), 'Logo quitado')">Quitar</button> }
                </div>
                <span class="hint">PNG, JPG o WebP de máximo 2 MB.</span>
              </div>
            </div>
          </div>
        }

        @case ('plan') {
          <div class="two">
            <form class="panel" (ngSubmit)="guardar()">
              <h3>Plan y facturación</h3>
              <app-selector-plan [planes]="planesVisibles()" [(plan)]="f.plan" [(ciclo)]="f.cicloFacturacion" (elegido)="elegidos.set(modulosDe($event))" />
              <span class="hint">Al cambiar de plan, los módulos de al lado se ajustan a los que incluye: revísalos y pulsa «Guardar módulos».</span>
              <div><button class="btn main" type="submit" [disabled]="ocupado()">Guardar plan</button></div>
            </form>
            <div class="panel">
              <h3>Módulos</h3>
              <app-selector-modulos [modulos]="modulos()" [(elegidos)]="elegidos" [plan]="planActual()" />
              <div><button class="btn main" type="button" [disabled]="ocupado() || !modulosCambiados()" (click)="guardarModulos()">Guardar módulos</button></div>
            </div>
          </div>
        }

        @case ('pagos') {
          <app-pagos-empresa [uuid]="e.uuid" />
        }

        @case ('acceso') {
          <form class="panel sa-angosto" (ngSubmit)="restablecer(fk)" #fk="ngForm">
            <h3>Clave de un administrador</h3>
            <p class="muted">Si la empresa olvidó su clave, asígnale una nueva y compártela por un medio seguro.</p>
            <div class="row2">
              <div class="field"><label for="kUsuario">Usuario</label><input id="kUsuario" name="kUsuario" autocomplete="off" [(ngModel)]="clave.usuario"></div>
              <div class="field"><label for="kNueva">Clave nueva <span class="hint">(mínimo 8)</span></label><input id="kNueva" name="kNueva" autocomplete="off" [(ngModel)]="clave.nueva"></div>
            </div>
            @if (errorClave()) { <p class="err">{{ errorClave() }}</p> }
            <div><button class="btn main" type="submit">Asignar clave</button></div>
          </form>
        }

        @case ('tecnico') {
          <div class="two">
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
      }
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

  protected pestana = signal<Pestana>('resumen');
  /** Pagos y acceso solo tienen sentido cuando la empresa ya existe del todo (activa o suspendida). */
  protected pestanas = computed(() => {
    const estado = this.empresa()?.estado;
    const lista = estado === 'activa' || estado === 'suspendida';
    return [
      { k: 'resumen' as Pestana, t: 'Resumen', icono: 'casa' },
      { k: 'datos' as Pestana, t: 'Datos y marca', icono: 'tienda' },
      { k: 'plan' as Pestana, t: 'Plan y módulos', icono: 'planes' },
      ...(lista ? [{ k: 'pagos' as Pestana, t: 'Pagos', icono: 'pagos' }, { k: 'acceso' as Pestana, t: 'Acceso', icono: 'candado' }] : []),
      { k: 'tecnico' as Pestana, t: 'Técnico', icono: 'biblioteca' },
    ];
  });
  protected modulosActivos = computed(() => {
    const e = this.empresa();
    return e ? this.modulos().filter((m) => !m.esBase && e.modulos.includes(m.codigo)).length : 0;
  });

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
    // Sin diálogos del navegador: el mismo botón pide confirmar con un segundo clic.
    if (!this.confirmar()) {
      this.confirmar.set(true);
      setTimeout(() => this.confirmar.set(false), 4000);
      return;
    }
    this.confirmar.set(false);
    this.accion(this.api.suspender(e.uuid), 'Empresa suspendida');
  }
  protected confirmar = signal(false);

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
