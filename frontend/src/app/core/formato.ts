import { Pipe, PipeTransform } from '@angular/core';
import { Promocion } from './modelos';

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function dinero(n: number | null | undefined): string {
  return '$' + pesos.format(Math.round(n ?? 0));
}

/** "2026-09-27" → fecha local, sin corrimiento por zona horaria. */
export function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function diaLargo(iso: string): string {
  return aFecha(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function diaCorto(iso: string): string {
  return aFecha(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function horaCorta(isoInstante: string): string {
  return new Date(isoInstante).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function celular(t: string): string {
  return (t ?? '').replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{0,4}).*$/, '$1 $2 $3').trim();
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/57${(numero ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
}

/** "14:30" → "2:30 p. m." */
export function horaTexto(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** Instante → "hoy a las 10:00 a. m.", "mañana a las…" o "el jueves a las…". */
export function cuando(isoInstante: string): string {
  const f = new Date(isoInstante);
  const hoy = new Date();
  const dias = Math.round((new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime()
    - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
  const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  if (dias === 0) return `hoy a las ${hora}`;
  if (dias === 1) return `mañana a las ${hora}`;
  return `el ${f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${hora}`;
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}

export function etiquetaPromo(p: Promocion): string {
  switch (p.tipo) {
    case 'COMBO': return `${p.cantidad} x ${dinero(p.precio)}`;
    case 'PORCENTAJE': return `-${p.porcentaje}%`;
    case 'PRECIO_ESPECIAL': return dinero(p.precio);
    case 'ENVIO_GRATIS': return 'Envío gratis';
  }
}

export async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

@Pipe({ name: 'dinero' })
export class DineroPipe implements PipeTransform {
  transform(n: number | null | undefined): string { return dinero(n); }
}

@Pipe({ name: 'diaLargo' })
export class DiaLargoPipe implements PipeTransform {
  transform(iso: string): string { return iso ? diaLargo(iso) : ''; }
}

@Pipe({ name: 'diaCorto' })
export class DiaCortoPipe implements PipeTransform {
  transform(iso: string): string { return iso ? diaCorto(iso) : ''; }
}

@Pipe({ name: 'hora' })
export class HoraPipe implements PipeTransform {
  transform(iso: string): string { return iso ? horaCorta(iso) : ''; }
}

@Pipe({ name: 'celular' })
export class CelularPipe implements PipeTransform {
  transform(t: string): string { return celular(t); }
}
