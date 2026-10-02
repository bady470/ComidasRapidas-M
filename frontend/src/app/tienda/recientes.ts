import { claveLocal } from '../core/empresa';

/** Pedidos hechos desde este navegador, para que el cliente no tenga que escribir el código. */
export interface PedidoReciente { codigo: string; celular: string; fecha: string; }

const CLAVE = () => claveLocal('pedidos_recientes');

export function pedidosRecientes(): PedidoReciente[] {
  try { return JSON.parse(localStorage.getItem(CLAVE()) ?? '[]') as PedidoReciente[]; }
  catch { return []; }
}

export function guardarPedidoReciente(codigo: string, celular: string): void {
  const lista = [{ codigo, celular, fecha: new Date().toISOString() }, ...pedidosRecientes().filter((p) => p.codigo !== codigo)];
  try { localStorage.setItem(CLAVE(), JSON.stringify(lista.slice(0, 50))); } catch { /* nada */ }
}
