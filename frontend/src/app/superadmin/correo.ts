import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaApi, mensajeError } from '../core/api';
import { Avisos } from '../core/avisos';
import { ConfigCorreo, ConfigCorreoForm } from '../core/modelos';

const PROVEEDORES = [
  { nombre: 'Gmail', host: 'smtp.gmail.com', puerto: 587, seguridad: 'STARTTLS' as const, nota: 'Usa una «contraseña de aplicación» (Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones), no tu clave normal.' },
  { nombre: 'Outlook / Microsoft 365', host: 'smtp.office365.com', puerto: 587, seguridad: 'STARTTLS' as const, nota: 'Usa tu correo completo como usuario. Si tienes verificación en dos pasos, crea una contraseña de aplicación.' },
  { nombre: 'Zoho', host: 'smtp.zoho.com', puerto: 465, seguridad: 'SSL' as const, nota: 'Usa tu correo completo como usuario y una contraseña de aplicación.' },
  { nombre: 'Hostinger / cPanel', host: 'smtp.hostinger.com', puerto: 465, seguridad: 'SSL' as const, nota: 'Usa el correo que creaste en tu hosting y su clave. El servidor suele ser mail.tudominio.com.' },
];

/** La cuenta de correo desde la que la plataforma envía los datos de acceso a las empresas. */
@Component({
  selector: 'app-correo',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error()) { <div class="alerta mala" style="margin-bottom:12px">{{ error() }}</div> }

    @if (config(); as c) {
      <div class="alerta" [class.buena]="c.configurado" [class.aviso]="!c.configurado" style="margin-bottom:16px">
        @if (c.configurado) {
          Correo listo{{ c.origen === 'ENTORNO' ? ' (usando las variables del servidor)' : '' }}: al crear una empresa se le envían sus datos de acceso.
        } @else {
          Todavía no hay una cuenta de correo. Sin ella, las empresas se crean igual pero los datos de acceso no se envían.
        }
      </div>
    }

    <div class="dos-col">
      <form class="panel" (ngSubmit)="guardar()">
        <h3>Cuenta que envía los correos</h3>
        <div class="field"><span class="flabel">Proveedor <span class="hint">(rellena el servidor por ti)</span></span>
          <div class="chips">
            @for (p of proveedores; track p.nombre) {
              <button type="button" class="chip" [class.hot]="proveedorActual() === p.nombre" (click)="usar(p)">{{ p.nombre }}</button>
            }
          </div>
          @if (nota()) { <span class="hint">{{ nota() }}</span> }
        </div>
        <div class="row2">
          <div class="field"><label for="cHost">Servidor SMTP</label><input id="cHost" name="cHost" autocomplete="off" [(ngModel)]="f.host" placeholder="smtp.gmail.com"></div>
          <div class="row2">
            <div class="field"><label for="cPuerto">Puerto</label><input id="cPuerto" name="cPuerto" type="number" [(ngModel)]="f.puerto"></div>
            <div class="field"><label for="cSeg">Seguridad</label>
              <select id="cSeg" name="cSeg" [(ngModel)]="f.seguridad">
                <option value="STARTTLS">STARTTLS (587)</option><option value="SSL">SSL/TLS (465)</option><option value="NINGUNA">Ninguna</option>
              </select></div>
          </div>
        </div>
        <div class="row2">
          <div class="field"><label for="cUsuario">Usuario (correo)</label><input id="cUsuario" name="cUsuario" type="email" autocomplete="off" [(ngModel)]="f.usuario" placeholder="ventas@midominio.com"></div>
          <div class="field"><label for="cClave">Contraseña</label>
            <input id="cClave" name="cClave" type="password" autocomplete="new-password" [(ngModel)]="f.clave"
                   [placeholder]="config()?.tieneClave ? '•••••••• (guardada; escribe otra para cambiarla)' : 'Contraseña o contraseña de aplicación'">
            <span class="hint">Se guarda cifrada y nunca se vuelve a mostrar.</span></div>
        </div>
        <div class="row2">
          <div class="field"><label for="cDe">Remitente <span class="hint">(opcional)</span></label><input id="cDe" name="cDe" [(ngModel)]="f.remitente" placeholder="Mi Plataforma <ventas@midominio.com>"></div>
          <div class="field"><label for="cUrl">Dirección de la plataforma</label><input id="cUrl" name="cUrl" [(ngModel)]="f.urlPublica" placeholder="https://pedidos.midominio.com">
            <span class="hint">Es la que aparece en los enlaces del correo.</span></div>
        </div>
        <div class="row"><button class="btn main" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button></div>
      </form>

      <div class="panel">
        <h3>Enviar un correo de prueba</h3>
        <p class="muted">Guarda primero la cuenta y luego comprueba que funciona: te llega un mensaje de prueba.</p>
        <div class="field"><label for="cPrueba">Enviar a</label><input id="cPrueba" name="cPrueba" type="email" [ngModel]="destino()" (ngModelChange)="destino.set($event)" placeholder="tu@correo.com"></div>
        <div><button class="btn" type="button" [disabled]="probando() || !destino()" (click)="probar()">{{ probando() ? 'Enviando…' : 'Enviar prueba' }}</button></div>
        @if (resultado(); as r) { <div class="alerta" [class.buena]="r.enviado" [class.mala]="!r.enviado">{{ r.mensaje }}</div> }
      </div>
    </div>
  `,
  styles: `
    .dos-col { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 900px) { .dos-col { grid-template-columns: 1fr; } }
    .chip { border: 0; cursor: pointer; font-family: inherit; }
  `,
})
export class CorreoPage {
  private api = inject(PlataformaApi);
  private avisos = inject(Avisos);

  protected readonly proveedores = PROVEEDORES;
  protected config = signal<ConfigCorreo | null>(null);
  protected error = signal('');
  protected guardando = signal(false);
  protected probando = signal(false);
  protected destino = signal('');
  protected resultado = signal<{ enviado: boolean; mensaje: string } | null>(null);
  protected nota = signal('');
  protected f: ConfigCorreoForm = { host: '', puerto: 587, seguridad: 'STARTTLS', usuario: '', clave: '', remitente: '', urlPublica: '' };

  constructor() {
    this.api.correo().subscribe({ next: (c) => this.cargar(c), error: (e) => this.error.set(mensajeError(e)) });
  }

  private cargar(c: ConfigCorreo): void {
    this.config.set(c);
    this.f = { host: c.host, puerto: c.puerto, seguridad: c.seguridad, usuario: c.usuario, clave: '', remitente: c.remitente, urlPublica: c.urlPublica };
    if (!this.destino()) this.destino.set(c.usuario);
  }

  protected proveedorActual(): string {
    return PROVEEDORES.find((p) => p.host === this.f.host.trim().toLowerCase())?.nombre ?? '';
  }

  protected usar(p: (typeof PROVEEDORES)[number]): void {
    this.f.host = p.host;
    this.f.puerto = p.puerto;
    this.f.seguridad = p.seguridad;
    this.nota.set(p.nota);
  }

  protected guardar(): void {
    this.error.set('');
    this.guardando.set(true);
    this.api.guardarCorreo({ ...this.f, puerto: Number(this.f.puerto) || 587 }).subscribe({
      next: (c) => { this.guardando.set(false); this.cargar(c); this.avisos.mostrar('Cuenta de correo guardada'); },
      error: (e) => { this.guardando.set(false); this.error.set(mensajeError(e)); },
    });
  }

  protected probar(): void {
    this.resultado.set(null);
    this.probando.set(true);
    this.api.probarCorreo(this.destino().trim()).subscribe({
      next: (r) => { this.probando.set(false); this.resultado.set(r); },
      error: (e) => { this.probando.set(false); this.error.set(mensajeError(e)); },
    });
  }
}
