import { Injectable, signal } from '@angular/core';

export interface EventoTiempoReal { tipo: string; datos: Record<string, unknown>; }

export interface OpcionesCanal {
  /** Token para el encabezado Authorization (portal y superadmin). */
  token?: () => string | null;
  alEvento: (e: EventoTiempoReal) => void;
  /** Al reconectarse después de un corte: conviene recargar por si se perdió algo. */
  alReconectar?: () => void;
}

/**
 * Cliente de tiempo real (Server-Sent Events) sobre fetch, para poder enviar el token en un encabezado
 * (EventSource no lo permite y el token no debe viajar en la dirección).
 * Se reconecta solo, con espera creciente, y deja de intentarlo si el servidor dice que no hay permiso.
 */
export function escucharCanal(url: string, op: OpcionesCanal, conectado?: (v: boolean) => void): () => void {
  let cerrado = false;
  let control: AbortController | null = null;
  let espera = 1000;
  let yaConecto = false;
  let reintento: ReturnType<typeof setTimeout> | undefined;

  const conectar = async (): Promise<void> => {
    if (cerrado) return;
    control = new AbortController();
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      const token = op.token?.();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const r = await fetch(url, { headers, signal: control.signal, cache: 'no-store' });
      if (r.status === 401 || r.status === 403 || r.status === 404) { conectado?.(false); return; }
      if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);
      conectado?.(true);
      if (yaConecto) op.alReconectar?.();
      yaConecto = true;
      espera = 1000;
      await leer(r.body, op.alEvento);
      throw new Error('fin');
    } catch {
      conectado?.(false);
      if (cerrado) return;
      reintento = setTimeout(conectar, espera);
      espera = Math.min(espera * 2, 30_000);
    }
  };

  // Al volver a la pestaña después de un rato, se reconecta de inmediato.
  const alVolver = (): void => {
    if (document.visibilityState === 'visible' && !cerrado && reintento) {
      clearTimeout(reintento);
      reintento = undefined;
      espera = 1000;
      void conectar();
    }
  };
  document.addEventListener('visibilitychange', alVolver);
  void conectar();

  return () => {
    cerrado = true;
    clearTimeout(reintento);
    control?.abort();
    document.removeEventListener('visibilitychange', alVolver);
    conectado?.(false);
  };
}

/** Lee el flujo "event: x / data: {...}" línea por línea. */
async function leer(cuerpo: ReadableStream<Uint8Array>, alEvento: (e: EventoTiempoReal) => void): Promise<void> {
  const lector = cuerpo.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  let tipo = 'message';
  let datos = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) return;
    pendiente += decodificador.decode(value, { stream: true });
    let fin: number;
    while ((fin = pendiente.indexOf('\n')) >= 0) {
      const linea = pendiente.slice(0, fin).replace(/\r$/, '');
      pendiente = pendiente.slice(fin + 1);
      if (linea === '') {
        if (datos) {
          let objeto: Record<string, unknown> = {};
          try { objeto = JSON.parse(datos) as Record<string, unknown>; } catch { /* datos vacíos */ }
          alEvento({ tipo, datos: objeto });
        }
        tipo = 'message';
        datos = '';
      } else if (linea.startsWith('event:')) {
        tipo = linea.slice(6).trim();
      } else if (linea.startsWith('data:')) {
        datos += (datos ? '\n' : '') + linea.slice(5).trimStart();
      }
    }
  }
}

/** Estado de la conexión para mostrar el indicador «En vivo». */
@Injectable({ providedIn: 'root' })
export class EstadoConexion {
  readonly enVivo = signal(false);
}
