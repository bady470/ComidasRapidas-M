import { Injectable, inject, signal } from '@angular/core';
import { AdminApi } from './api';
import { Avisos as Toast } from './avisos';
import { apiEmpresa, claveLocal } from './empresa';
import { Avisos, Notificacion } from './modelos';
import { SesionAdmin } from './sesion';
import { escucharCanal } from './tiempo-real';

/** Un cambio en un pedido (nuevo, estado, pago, domiciliario) que llegó por el canal en vivo. */
export interface CambioPedido { id: number; codigo: string; motivo: string; n: number; }

/**
 * Avisos del portal de la empresa: pedidos nuevos y comprobantes de pago recibidos.
 * Revisa el servidor cada 15 segundos mientras el portal está abierto; cuando llega algo nuevo muestra un aviso,
 * suena y, si el administrador lo permitió, manda una notificación del navegador (aunque esté en otra pestaña).
 */
@Injectable({ providedIn: 'root' })
export class AvisosPortal {
  private api = inject(AdminApi);
  private toast = inject(Toast);
  private sesion = inject(SesionAdmin);

  /** Conexión en vivo con el servidor (indicador «En vivo»). */
  readonly enVivo = signal(false);
  /** Último pedido que cambió (las páginas recargan y lo resaltan). */
  readonly cambioPedido = signal<CambioPedido | null>(null);
  /** Cambió el catálogo o la configuración (desde otra pestaña, otro administrador o el superadmin). */
  readonly cambioCatalogo = signal(0);
  readonly cambioDomiciliarios = signal(0);
  private cerrarCanal: (() => void) | null = null;
  private contador = 0;

  readonly datos = signal<Avisos | null>(null);
  /** Cambia cada vez que llega un aviso nuevo (las páginas lo usan para recargar). */
  readonly version = signal(0);
  readonly permiso = signal<NotificationPermission | 'no-soportado'>(
    typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission);

  private timer: ReturnType<typeof setInterval> | undefined;
  private empresa = '';

  /** Arranca la revisión periódica (la llama el layout del portal). */
  iniciar(empresa: string): void {
    if (this.timer && this.empresa === empresa) return;
    this.detener();
    this.empresa = empresa;
    this.datos.set(null);
    this.revisar(true);
    // Todo llega en vivo; esta revisión lenta solo cubre cortes de conexión.
    this.timer = setInterval(() => this.revisar(false), 60_000);
    this.cerrarCanal = escucharCanal(`${apiEmpresa()}/admin/eventos`, {
      token: () => this.sesion.token(),
      alEvento: (e) => {
        if (e.tipo === 'pedido') {
          const d = e.datos as { id?: number; codigo?: string; motivo?: string };
          this.cambioPedido.set({ id: Number(d.id), codigo: String(d.codigo ?? ''), motivo: String(d.motivo ?? ''), n: ++this.contador });
          this.revisar(false);
        } else if (e.tipo === 'avisos') {
          this.revisar(false);
        } else if (e.tipo === 'catalogo') {
          this.cambioCatalogo.update((v) => v + 1);
        } else if (e.tipo === 'domiciliarios') {
          this.cambioDomiciliarios.update((v) => v + 1);
        }
      },
      // Tras un corte se recarga todo por si se perdió algún aviso.
      alReconectar: () => {
        this.revisar(false);
        this.cambioPedido.set({ id: 0, codigo: '', motivo: 'reconexion', n: ++this.contador });
      },
    }, (v) => this.enVivo.set(v));
  }

  detener(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    this.cerrarCanal?.();
    this.cerrarCanal = null;
  }

  revisar(primeraVez = false): void {
    this.api.avisos().subscribe({
      next: (a) => this.recibir(a, primeraVez),
      error: () => { /* sin conexión o sesión vencida: el interceptor se encarga */ },
    });
  }

  /** Marca como leídos todos los avisos que se ven ahora. */
  marcarLeidos(): void {
    const ultimo = this.datos()?.lista[0]?.id;
    if (!ultimo || !this.datos()?.noLeidas) return;
    this.api.marcarLeidos(ultimo).subscribe({ next: (a) => this.datos.set(a), error: () => {} });
  }

  async activarNotificaciones(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.permiso.set(await Notification.requestPermission());
  }

  private recibir(a: Avisos, primeraVez: boolean): void {
    const ultimoVisto = Number(leer(claveLocal('ultimo-aviso')) ?? 0);
    const nuevas = a.lista.filter((n) => n.id > ultimoVisto && !n.leida);
    this.datos.set(a);
    if (a.lista[0]) guardar(claveLocal('ultimo-aviso'), String(Math.max(ultimoVisto, a.lista[0].id)));
    if (!nuevas.length) return;
    this.version.update((v) => v + 1);
    // Al abrir el portal no se repiten en ráfaga los avisos viejos: solo se resume.
    if (primeraVez && ultimoVisto === 0) return;
    const principal = nuevas.find((n) => n.tipo === 'PAGO_REPORTADO') ?? nuevas[0]!;
    this.toast.mostrar(nuevas.length > 1 ? `${principal.titulo} (+${nuevas.length - 1} más)` : principal.titulo);
    sonar();
    this.notificarNavegador(nuevas);
  }

  private notificarNavegador(nuevas: Notificacion[]): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    for (const n of nuevas.slice(0, 3)) {
      try { new Notification(n.titulo, { body: n.mensaje, tag: 'leinei-' + n.id }); } catch { /* algunos celulares no lo permiten */ }
    }
  }
}

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function guardar(clave: string, valor: string): void {
  try { localStorage.setItem(clave, valor); } catch { /* nada */ }
}

/** Dos tonos cortos; si el navegador bloquea el sonido, no pasa nada. */
function sonar(): void {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 1180 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.16);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.17);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* sin audio */ }
}
