import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap, catchError } from 'rxjs';
import { Logo } from '../compartido/logo';
import { SelectorModulos } from '../compartido/selector-modulos';
import { SelectorPlan } from '../compartido/selector-plan';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { identificadorValido } from '../core/empresa';
import { CrearEmpresa, ModuloPlataforma, Plan } from '../core/modelos';
import { dinero } from '../core/formato';
import { textoSobre } from '../core/tema';

/**
 * Alta de una empresa. Al guardar, la plataforma prepara en segundo plano su base de datos,
 * sus usuarios, su tienda inicial y su administrador; el detalle muestra el avance.
 */
@Component({
  selector: 'app-nueva-empresa',
  imports: [FormsModule, RouterLink, Logo, SelectorPlan, SelectorModulos],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="crear()" class="nueva">
      <div class="panel">
        <h3>Datos básicos</h3>
        <div class="row2">
          <div class="field"><label for="eNombre">Nombre del negocio</label>
            <input id="eNombre" name="eNombre" autocomplete="off" [(ngModel)]="f.nombreComercial" (ngModelChange)="sugerirIdentificador()" placeholder="Ej: La Parrilla Express"></div>
          <div class="field"><label for="eId">Identificador (dirección)</label>
            <input id="eId" name="eId" autocomplete="off" [(ngModel)]="f.identificador" (ngModelChange)="identificadorTocado = true">
            <span class="hint">Tienda <b class="num">/{{ f.identificador || '…' }}</b> · Portal <b class="num">/{{ f.identificador || '…' }}/admin</b>. No se cambia después.</span>
            @if (f.identificador && !identificadorValido(f.identificador)) { <span class="err">Identificador no válido o reservado.</span> }</div>
        </div>
        <div class="field"><span class="flabel">Tipo de venta</span>
          <div class="seg-entrega">
            <label><input type="radio" name="eModo" value="INMEDIATO" [(ngModel)]="f.modoPedido"><b>Entrega inmediata</b><span class="muted">Comidas rápidas, restaurantes.</span></label>
            <label><input type="radio" name="eModo" value="PROGRAMADO" [(ngModel)]="f.modoPedido"><b>Entrega programada</b><span class="muted">Postres, tortas, mercados.</span></label>
          </div>
        </div>
      </div>

      <div class="panel">
        <h3>Plan</h3>
        <app-selector-plan [planes]="planesActivos()" [(plan)]="f.plan" [(ciclo)]="f.cicloFacturacion" (elegido)="aplicarPlan($event)" />
        <span class="hint">Cada plan trae sus módulos; puedes ajustarlos abajo en «Módulos». Los precios se cambian en «Planes».</span>
      </div>

      <div class="panel">
        <h3>Administrador de la empresa</h3>
        <div class="row2">
          <div class="field"><label for="aNombre">Nombre del responsable</label><input id="aNombre" name="aNombre" autocomplete="off" [(ngModel)]="f.adminNombre"></div>
          <div class="field"><label for="eWa">WhatsApp</label><input id="eWa" name="eWa" inputmode="tel" [(ngModel)]="f.whatsapp" placeholder="3001234567"></div>
        </div>
        <div class="field"><label for="eCorreo">Correo del responsable</label>
          <input id="eCorreo" name="eCorreo" type="email" autocomplete="off" [(ngModel)]="f.responsableCorreo" placeholder="correo@negocio.com">
          <span class="hint">Se le envían los datos de acceso (usuario, clave y direcciones) al crear la empresa.</span></div>
        <div class="row2">
          <div class="field"><label for="aUsuario">Usuario</label><input id="aUsuario" name="aUsuario" autocomplete="off" [(ngModel)]="f.adminUsuario"></div>
          <div class="field"><label for="aClave">Clave</label>
            <div class="row"><input id="aClave" name="aClave" autocomplete="off" [(ngModel)]="f.adminClave" style="flex:1;min-width:0">
              <button class="btn" type="button" (click)="generarClave()">Generar</button></div></div>
        </div>
        <span class="hint">Con este usuario la empresa entra a su portal. Mínimo 8 caracteres; cópiala ahora, después solo se puede restablecer.</span>
      </div>

      <div class="panel mas-lista">
        <details class="mas">
          <summary><b>Marca</b><span class="muted">Colores, logo y dominio propio</span><span class="muestra-colores"><i [style.background]="f.colorPrimario"></i><i [style.background]="f.colorSecundario"></i></span></summary>
          <div class="mas-cuerpo">
            <div class="field"><span class="flabel">Paleta</span>
              <div class="paletas">
                @for (p of paletas; track p.nombre) {
                  <button type="button" class="paleta" [attr.aria-pressed]="f.colorPrimario === p.c1 && f.colorSecundario === p.c2" [attr.aria-label]="p.nombre" [title]="p.nombre" (click)="aplicarPaleta(p)">
                    <i [style.background]="p.c1"></i><i [style.background]="p.c2"></i>
                  </button>
                }
              </div>
            </div>
            <div class="row2">
              <div class="field"><label for="eC1">Color principal</label>
                <div class="row"><input id="eC1" name="eC1" type="color" [(ngModel)]="f.colorPrimario" style="width:48px;height:38px;padding:2px">
                  <input name="eC1t" [(ngModel)]="f.colorPrimario" aria-label="Código del color principal" style="flex:1;min-width:0"></div></div>
              <div class="field"><label for="eC2">Color secundario</label>
                <div class="row"><input id="eC2" name="eC2" type="color" [(ngModel)]="f.colorSecundario" style="width:48px;height:38px;padding:2px">
                  <input name="eC2t" [(ngModel)]="f.colorSecundario" aria-label="Código del color secundario" style="flex:1;min-width:0"></div></div>
            </div>
            <div class="row2">
              <div class="field"><span class="flabel">Logo <span class="hint">(opcional)</span></span>
                <div class="subir">
                  <app-logo [logoUrl]="vistaLogo()" [nombre]="f.nombreComercial" [style.background]="f.colorSecundario" [style.color]="texto(f.colorSecundario)" style="width:44px;height:44px;border-radius:8px" />
                  <label class="btn" style="cursor:pointer">{{ logo ? 'Cambiar' : 'Elegir imagen' }}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="elegirLogo($event)"></label>
                  @if (logo) { <button class="linkbtn" type="button" (click)="quitarLogo()">Quitar</button> }
                </div></div>
              <div class="field"><label for="eDom">Dominio propio <span class="hint">(opcional)</span></label>
                <input id="eDom" name="eDom" [(ngModel)]="f.dominioPropio" placeholder="pedidos.minegocio.com"></div>
            </div>
          </div>
        </details>

        <details class="mas">
          <summary><b>Tienda y entrega</b><span class="muted">{{ resumenEntrega() }}</span></summary>
          <div class="mas-cuerpo">
            <div class="row2">
              <div class="field"><label for="eCiudad">Ciudad</label><input id="eCiudad" name="eCiudad" [(ngModel)]="f.ciudad"></div>
              <div class="field"><label for="eDir">Dirección del local</label><input id="eDir" name="eDir" [(ngModel)]="f.direccion"></div>
            </div>
            <div class="row" style="gap:20px">
              <label class="check"><input type="checkbox" name="eDomi" [(ngModel)]="f.tieneDomicilio"> Hace domicilios</label>
              <label class="check"><input type="checkbox" name="eRec" [(ngModel)]="f.tieneRecogida"> Recogen en el local</label>
            </div>
            @if (f.tieneDomicilio) {
              <div class="field" style="max-width:260px"><label for="eDomV">Valor del domicilio</label><input id="eDomV" name="eDomV" type="number" min="0" step="500" [(ngModel)]="f.domicilioValor"></div>
            }
            <span class="hint">Horarios, cuentas de pago y catálogo los configura la empresa desde su portal (o tú, con los productos precargados).</span>
          </div>
        </details>

        <details class="mas">
          <summary><b>Datos de la empresa</b><span class="muted">Razón social, NIT, contacto y notas</span></summary>
          <div class="mas-cuerpo">
            <div class="row2">
              <div class="field"><label for="eRazon">Razón social <span class="hint">(si lo dejas vacío usa el nombre del negocio)</span></label><input id="eRazon" name="eRazon" [(ngModel)]="f.razonSocial"></div>
              <div class="field"><label for="eNit">NIT</label><input id="eNit" name="eNit" [(ngModel)]="f.nit"></div>
            </div>
            <div class="row2">
              <div class="field"><label for="eCel">Celular del responsable</label><input id="eCel" name="eCel" inputmode="tel" [(ngModel)]="f.responsableCelular"></div>
            </div>
            <div class="field"><label for="eNotas">Notas internas <span class="hint">(solo las ves tú)</span></label><textarea id="eNotas" name="eNotas" [(ngModel)]="f.notas" style="min-height:56px"></textarea></div>
          </div>
        </details>

        <details class="mas">
          <summary><b>Módulos</b><span class="muted">{{ cantidadModulos() }} de {{ modulos().length }} incluidos</span></summary>
          <div class="mas-cuerpo">
            <app-selector-modulos [modulos]="modulos()" [(elegidos)]="elegidos" [plan]="planElegido()" />
          </div>
        </details>
      </div>

      <div class="barra-crear">
        <span class="muted">{{ resumenFinal() }}</span>
        @if (error()) { <span class="err">{{ error() }}</span> }
        <span class="spacer"></span>
        <a class="btn" routerLink="/superadmin/empresas">Cancelar</a>
        <button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Creando…' : 'Crear empresa' }}</button>
      </div>
    </form>
  `,
})
export class NuevaEmpresaPage {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);
  private router = inject(Router);

  protected readonly identificadorValido = identificadorValido;
  protected readonly texto = textoSobre;
  protected modulos = signal<ModuloPlataforma[]>([]);
  protected planes = signal<Plan[]>([]);
  protected elegidos = signal(new Set<string>());
  protected guardando = signal(false);
  protected error = signal('');
  protected vistaLogo = signal<string | null>(null);
  protected logo: File | null = null;
  protected identificadorTocado = false;

  protected f: CrearEmpresa = {
    identificador: '', razonSocial: '', nit: '', responsableNombre: '', responsableCorreo: '', responsableCelular: '',
    plan: '', cicloFacturacion: 'MENSUAL', notas: '', nombreComercial: '', colorPrimario: '#1D4ED8', colorSecundario: '#0F172A', dominioPropio: '',
    modoPedido: 'INMEDIATO', whatsapp: '', ciudad: '', direccion: '',
    tieneDomicilio: true, tieneRecogida: true, domicilioValor: 0,
    modulos: [], adminNombre: '', adminUsuario: 'admin', adminClave: '',
  };

  constructor() {
    this.api.modulos().subscribe({
      next: (l) => {
        this.modulos.set(l);
        this.elegidos.set(new Set(l.map((m) => m.codigo))); // por defecto, todo el plan
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
    this.api.planes().subscribe({
      next: (l) => {
        this.planes.set(l);
        const primero = l.find((p) => p.activo);
        if (primero && !this.f.plan) { this.f.plan = primero.codigo; this.aplicarPlan(primero); }
      },
      error: (e) => this.error.set(mensajeError(e)),
    });
    this.generarClave();
  }

  protected planElegido(): Plan | null { return this.planes().find((p) => p.codigo === this.f.plan) ?? null; }
  protected planesActivos(): Plan[] { return this.planes().filter((p) => p.activo); }

  /** Al elegir un plan, los módulos se ajustan a los que incluye. */
  protected aplicarPlan(p: Plan): void {
    this.elegidos.set(new Set(p.modulos));
  }

  protected resumenFinal(): string {
    if (!this.f.nombreComercial) return 'Completa el nombre del negocio y el responsable.';
    const p = this.planes().find((x) => x.codigo === this.f.plan);
    const precio = p ? ` · ${p.nombre} ${dinero(this.f.cicloFacturacion === 'ANUAL' ? p.precioAnual : p.precioMensual)}/${this.f.cicloFacturacion === 'ANUAL' ? 'año' : 'mes'}` : '';
    return `${this.f.nombreComercial} · /${this.f.identificador}${precio}`;
  }

  protected readonly paletas = [
    { nombre: 'Azul', c1: '#1D4ED8', c2: '#0F172A' }, { nombre: 'Rojo', c1: '#DC2626', c2: '#1F2937' },
    { nombre: 'Naranja', c1: '#EA580C', c2: '#292524' }, { nombre: 'Verde', c1: '#15803D', c2: '#14532D' },
    { nombre: 'Turquesa', c1: '#0D9488', c2: '#134E4A' }, { nombre: 'Morado', c1: '#7C3AED', c2: '#1E1B4B' },
    { nombre: 'Rosa', c1: '#DB2777', c2: '#3B0764' }, { nombre: 'Dorado', c1: '#CA8A04', c2: '#1C1917' },
  ];

  protected aplicarPaleta(p: { c1: string; c2: string }): void {
    this.f.colorPrimario = p.c1;
    this.f.colorSecundario = p.c2;
  }

  protected cantidadModulos(): number {
    return this.modulos().filter((m) => m.esBase || this.elegidos().has(m.codigo)).length;
  }

  protected resumenEntrega(): string {
    const p: string[] = [];
    if (this.f.tieneDomicilio) p.push('Domicilio');
    if (this.f.tieneRecogida) p.push('Recoger en el local');
    return p.length ? p.join(' · ') : 'Sin forma de entrega';
  }

  protected sugerirIdentificador(): void {
    if (this.identificadorTocado) return;
    this.f.identificador = this.f.nombreComercial.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  }

  protected generarClave(): void {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const azar = crypto.getRandomValues(new Uint32Array(12));
    this.f.adminClave = Array.from(azar, (n) => letras[n % letras.length]).join('');
  }

  protected elegirLogo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    if (!archivo) return;
    if (archivo.size > 2 * 1024 * 1024) { this.error.set('El logo debe pesar menos de 2 MB.'); return; }
    this.quitarLogo();
    this.logo = archivo;
    this.vistaLogo.set(URL.createObjectURL(archivo));
  }

  protected quitarLogo(): void {
    const v = this.vistaLogo();
    if (v) URL.revokeObjectURL(v);
    this.logo = null;
    this.vistaLogo.set(null);
  }

  protected crear(): void {
    const f = this.f;
    const faltan = [
      [!f.nombreComercial.trim(), 'el nombre del negocio'], [!f.adminNombre.trim(), 'el nombre del responsable'],
    ].filter(([falta]) => falta).map(([, q]) => q);
    if (faltan.length) { this.error.set('Falta ' + faltan.join(', ') + '.'); return; }
    if (!identificadorValido(f.identificador)) { this.error.set('Revisa el identificador.'); return; }
    if (!f.plan) { this.error.set('Elige un plan.'); return; }
    if (!f.tieneDomicilio && !f.tieneRecogida) { this.error.set('Activa al menos una forma de entrega.'); return; }
    if (f.adminClave.length < 8) { this.error.set('La clave del administrador debe tener al menos 8 caracteres.'); return; }

    const datos: CrearEmpresa = {
      ...f,
      razonSocial: f.razonSocial.trim() || f.nombreComercial.trim(),
      responsableNombre: f.adminNombre.trim(),
      responsableCelular: f.responsableCelular || f.whatsapp.replace(/\D/g, ''),
      whatsapp: f.whatsapp.replace(/\D/g, ''),
      domicilioValor: Number(f.domicilioValor) || 0,
      dominioPropio: f.dominioPropio.trim().toLowerCase(),
      modulos: this.modulos().filter((m) => m.esBase || this.elegidos().has(m.codigo)).map((m) => m.codigo),
    };
    this.guardando.set(true);
    this.error.set('');
    this.api.crearEmpresa(datos).pipe(
      switchMap((r) => forkJoin({
        empresa: of(r.empresa),
        correo: of(r.correo),
        // Si el logo falla, la empresa ya quedó creada: se avisa y se puede subir desde el detalle.
        logo: this.logo ? this.api.subirLogo(r.empresa.uuid, this.logo).pipe(catchError(() => of(null))) : of(null),
      })),
    ).subscribe({
      next: ({ empresa, correo, logo }) => {
        const partes = [`Preparando ${empresa.nombreComercial}…`];
        if (correo === 'ENVIADO') partes.push(`Datos enviados a ${datos.responsableCorreo}.`);
        else if (correo === 'NO_CONFIGURADO') partes.push('El correo no está configurado en el servidor: copia los datos de acceso.');
        else if (correo === 'FALLO') partes.push('No se pudo enviar el correo: copia los datos de acceso.');
        if (this.logo && !logo) partes.push('El logo no se pudo subir: súbelo desde el detalle.');
        this.avisos.mostrar(partes.join(' '));
        this.quitarLogo();
        this.router.navigate(['/superadmin/empresas', empresa.uuid], { state: { clave: datos.adminClave, usuario: datos.adminUsuario } });
      },
      error: (e) => { this.error.set(mensajeError(e)); this.guardando.set(false); },
    });
  }
}
