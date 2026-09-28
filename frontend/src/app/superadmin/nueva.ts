import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap, catchError } from 'rxjs';
import { Logo } from '../compartido/logo';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { identificadorValido } from '../core/empresa';
import { CrearEmpresa, ModuloPlataforma } from '../core/modelos';
import { textoSobre } from '../core/tema';

/**
 * Alta de una empresa. Al guardar, la plataforma prepara en segundo plano su base de datos,
 * sus usuarios, su tienda inicial y su administrador; el detalle muestra el avance.
 */
@Component({
  selector: 'app-nueva-empresa',
  imports: [FormsModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (ngSubmit)="crear()" class="stack" style="gap:16px;margin-bottom:40px">
      <div class="two">
        <div class="panel">
          <h3>Empresa</h3>
          <div class="field"><label for="eRazon">Razón social</label><input id="eRazon" name="eRazon" [(ngModel)]="f.razonSocial"></div>
          <div class="row2">
            <div class="field"><label for="eNit">NIT <span class="hint">(opcional)</span></label><input id="eNit" name="eNit" [(ngModel)]="f.nit"></div>
            <div class="field"><label for="ePlan">Plan <span class="hint">(opcional)</span></label><input id="ePlan" name="ePlan" [(ngModel)]="f.plan" placeholder="Básico, Pro…"></div>
          </div>
          <div class="field"><label for="eResp">Responsable</label><input id="eResp" name="eResp" [(ngModel)]="f.responsableNombre"></div>
          <div class="row2">
            <div class="field"><label for="eCorreo">Correo</label><input id="eCorreo" name="eCorreo" type="email" [(ngModel)]="f.responsableCorreo"></div>
            <div class="field"><label for="eCel">Celular</label><input id="eCel" name="eCel" inputmode="tel" [(ngModel)]="f.responsableCelular"></div>
          </div>
          <div class="field"><label for="eNotas">Notas internas <span class="hint">(solo las ves tú)</span></label><textarea id="eNotas" name="eNotas" [(ngModel)]="f.notas"></textarea></div>
        </div>

        <div class="panel">
          <h3>Marca y dirección</h3>
          <div class="field"><label for="eNombre">Nombre comercial</label>
            <input id="eNombre" name="eNombre" [(ngModel)]="f.nombreComercial" (ngModelChange)="sugerirIdentificador()"></div>
          <div class="field"><label for="eId">Identificador</label>
            <input id="eId" name="eId" autocomplete="off" [(ngModel)]="f.identificador" (ngModelChange)="identificadorTocado = true">
            <span class="hint">Tienda: <b class="num">/{{ f.identificador || '…' }}</b> · Portal: <b class="num">/{{ f.identificador || '…' }}/admin</b>.
              Minúsculas, números y guiones; no se puede cambiar después.</span>
            @if (f.identificador && !identificadorValido(f.identificador)) { <span class="err">Identificador no válido o reservado.</span> }</div>
          <div class="row2">
            <div class="field"><label for="eC1">Color principal</label>
              <div class="row"><input id="eC1" name="eC1" type="color" [(ngModel)]="f.colorPrimario" style="width:52px;height:40px;padding:2px">
                <input name="eC1t" [(ngModel)]="f.colorPrimario" aria-label="Código del color principal" style="flex:1;min-width:0"></div></div>
            <div class="field"><label for="eC2">Color secundario</label>
              <div class="row"><input id="eC2" name="eC2" type="color" [(ngModel)]="f.colorSecundario" style="width:52px;height:40px;padding:2px">
                <input name="eC2t" [(ngModel)]="f.colorSecundario" aria-label="Código del color secundario" style="flex:1;min-width:0"></div></div>
          </div>
          <div class="field"><span class="flabel">Logo <span class="hint">(opcional, se sube al crear)</span></span>
            <div class="subir">
              <app-logo [logoUrl]="vistaLogo()" [nombre]="f.nombreComercial" [style.background]="f.colorSecundario" [style.color]="texto(f.colorSecundario)" style="width:56px;height:56px;border-radius:14px" />
              <label class="btn" style="cursor:pointer">{{ logo ? 'Cambiar' : 'Elegir imagen' }}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden (change)="elegirLogo($event)"></label>
              @if (logo) { <button class="linkbtn" type="button" (click)="quitarLogo()">Quitar</button> }
            </div></div>
          <div class="field"><label for="eDom">Dominio propio <span class="hint">(opcional)</span></label>
            <input id="eDom" name="eDom" [(ngModel)]="f.dominioPropio" placeholder="pedidos.minegocio.com">
            <span class="hint">El dominio debe apuntar a este servidor. La tienda también queda en /{{ f.identificador || '…' }}.</span></div>
        </div>
      </div>

      <div class="two">
        <div class="panel">
          <h3>Tienda inicial</h3>
          <div class="seg-entrega">
            <label><input type="radio" name="eModo" value="INMEDIATO" [(ngModel)]="f.modoPedido"><b>Entrega inmediata</b><span class="muted">Comidas rápidas, restaurantes.</span></label>
            <label><input type="radio" name="eModo" value="PROGRAMADO" [(ngModel)]="f.modoPedido"><b>Entrega programada</b><span class="muted">Postres, tortas, mercados.</span></label>
          </div>
          <div class="row2">
            <div class="field"><label for="eWa">WhatsApp</label><input id="eWa" name="eWa" inputmode="tel" [(ngModel)]="f.whatsapp" placeholder="3001234567"></div>
            <div class="field"><label for="eCiudad">Ciudad</label><input id="eCiudad" name="eCiudad" [(ngModel)]="f.ciudad"></div>
          </div>
          <div class="field"><label for="eDir">Dirección del local</label><input id="eDir" name="eDir" [(ngModel)]="f.direccion"></div>
          <label class="check"><input type="checkbox" name="eDomi" [(ngModel)]="f.tieneDomicilio"> Hace domicilios</label>
          @if (f.tieneDomicilio) {
            <div class="field"><label for="eDomV">Valor del domicilio</label><input id="eDomV" name="eDomV" type="number" min="0" step="500" [(ngModel)]="f.domicilioValor"></div>
          }
          <label class="check"><input type="checkbox" name="eRec" [(ngModel)]="f.tieneRecogida"> El cliente puede recoger en el local</label>
          <span class="hint">El resto (horarios, cuentas de pago, catálogo) lo configura la empresa desde su portal.</span>
        </div>

        <div class="panel">
          <h3>Administrador de la empresa</h3>
          <p class="muted" style="font-size:14px">Con este usuario la empresa entra a su portal para ver pedidos y armar su tienda.</p>
          <div class="field"><label for="aNombre">Nombre</label><input id="aNombre" name="aNombre" [(ngModel)]="f.adminNombre"></div>
          <div class="row2">
            <div class="field"><label for="aUsuario">Usuario</label><input id="aUsuario" name="aUsuario" autocomplete="off" [(ngModel)]="f.adminUsuario"></div>
            <div class="field"><label for="aClave">Clave</label>
              <div class="row"><input id="aClave" name="aClave" autocomplete="off" [(ngModel)]="f.adminClave" style="flex:1;min-width:0">
                <button class="btn" type="button" (click)="generarClave()">Generar</button></div></div>
          </div>
          <span class="hint">Mínimo 8 caracteres. Cópiala ahora: después solo se puede restablecer.</span>
        </div>
      </div>

      <div class="panel">
        <h3>Módulos</h3>
        <div class="modulos">
          @for (m of modulos(); track m.codigo) {
            <label>
              <input type="checkbox" [name]="'m-' + m.codigo" [checked]="m.esBase || elegidos().has(m.codigo)" [disabled]="m.esBase" (change)="alternar(m.codigo)">
              <b>{{ m.nombre }}</b>
              <span class="muted">{{ m.descripcion }}{{ m.esBase ? ' · Siempre incluido' : '' }}</span>
            </label>
          }
        </div>
      </div>

      <div class="toolbar" style="position:sticky;bottom:0;background:var(--bg);padding-block:10px;margin:0;z-index:5">
        <button class="btn main" type="submit" [disabled]="guardando()" style="padding:10px 18px;font-size:15px">{{ guardando() ? 'Creando…' : 'Crear empresa' }}</button>
        @if (error()) { <span class="err">{{ error() }}</span> }
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
  protected elegidos = signal(new Set<string>());
  protected guardando = signal(false);
  protected error = signal('');
  protected vistaLogo = signal<string | null>(null);
  protected logo: File | null = null;
  protected identificadorTocado = false;

  protected f: CrearEmpresa = {
    identificador: '', razonSocial: '', nit: '', responsableNombre: '', responsableCorreo: '', responsableCelular: '',
    plan: '', notas: '', nombreComercial: '', colorPrimario: '#E9A23B', colorSecundario: '#3A2620', dominioPropio: '',
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
    this.generarClave();
  }

  protected sugerirIdentificador(): void {
    if (this.identificadorTocado) return;
    this.f.identificador = this.f.nombreComercial.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  }

  protected alternar(codigo: string): void {
    const s = new Set(this.elegidos());
    if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
    this.elegidos.set(s);
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
      [!f.razonSocial.trim(), 'la razón social'], [!f.responsableNombre.trim(), 'el responsable'],
      [!f.nombreComercial.trim(), 'el nombre comercial'], [!f.adminNombre.trim(), 'el nombre del administrador'],
    ].filter(([falta]) => falta).map(([, q]) => q);
    if (faltan.length) { this.error.set('Falta ' + faltan.join(', ') + '.'); return; }
    if (!identificadorValido(f.identificador)) { this.error.set('Revisa el identificador.'); return; }
    if (!f.tieneDomicilio && !f.tieneRecogida) { this.error.set('Activa al menos una forma de entrega.'); return; }
    if (f.adminClave.length < 8) { this.error.set('La clave del administrador debe tener al menos 8 caracteres.'); return; }

    const datos: CrearEmpresa = {
      ...f,
      whatsapp: f.whatsapp.replace(/\D/g, ''),
      domicilioValor: Number(f.domicilioValor) || 0,
      dominioPropio: f.dominioPropio.trim().toLowerCase(),
      modulos: this.modulos().filter((m) => m.esBase || this.elegidos().has(m.codigo)).map((m) => m.codigo),
    };
    this.guardando.set(true);
    this.error.set('');
    this.api.crearEmpresa(datos).pipe(
      switchMap((e) => forkJoin({
        empresa: of(e),
        // Si el logo falla, la empresa ya quedó creada: se avisa y se puede subir desde el detalle.
        logo: this.logo ? this.api.subirLogo(e.uuid, this.logo).pipe(catchError(() => of(null))) : of(null),
      })),
    ).subscribe({
      next: ({ empresa, logo }) => {
        this.avisos.mostrar(this.logo && !logo
          ? 'Empresa creada. El logo no se pudo subir: súbelo desde el detalle.'
          : `Preparando ${empresa.nombreComercial}…`);
        this.quitarLogo();
        this.router.navigate(['/superadmin/empresas', empresa.uuid], { state: { clave: datos.adminClave, usuario: datos.adminUsuario } });
      },
      error: (e) => { this.error.set(mensajeError(e)); this.guardando.set(false); },
    });
  }
}
