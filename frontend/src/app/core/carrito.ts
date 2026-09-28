import { Injectable, computed, signal } from '@angular/core';
import { claveLocal } from './empresa';
import { ItemPedido, Producto } from './modelos';

/** Una línea del carrito: el mismo producto con opciones distintas son líneas distintas. */
export interface LineaCarrito { clave: string; productoId: number; opcionIds: number[]; cantidad: number; }

export function claveLinea(productoId: number, opcionIds: number[]): string {
  return productoId + ':' + [...opcionIds].sort((a, b) => a - b).join(',');
}

/** Carrito del cliente. Se guarda en el navegador, uno por empresa. */
@Injectable({ providedIn: 'root' })
export class Carrito {
  readonly lineas = signal<LineaCarrito[]>(leer());
  readonly totalUnidades = computed(() => this.lineas().reduce((a, l) => a + l.cantidad, 0));
  readonly items = computed<ItemPedido[]>(() =>
    this.lineas().map((l) => ({ productoId: l.productoId, cantidad: l.cantidad, opcionIds: l.opcionIds })));

  /** Unidades de un producto sumando todas sus variantes. */
  cantidadDe(productoId: number): number {
    return this.lineas().filter((l) => l.productoId === productoId).reduce((a, l) => a + l.cantidad, 0);
  }

  agregar(productoId: number, opcionIds: number[], cantidad = 1): void {
    const clave = claveLinea(productoId, opcionIds);
    const lista = [...this.lineas()];
    const i = lista.findIndex((l) => l.clave === clave);
    if (i >= 0) lista[i] = { ...lista[i], cantidad: Math.min(99, lista[i].cantidad + cantidad) };
    else lista.push({ clave, productoId, opcionIds: [...opcionIds].sort((a, b) => a - b), cantidad: Math.min(99, cantidad) });
    this.guardar(lista);
  }

  cambiar(clave: string, delta: number): void {
    const lista = this.lineas()
      .map((l) => (l.clave === clave ? { ...l, cantidad: Math.max(0, Math.min(99, l.cantidad + delta)) } : l))
      .filter((l) => l.cantidad > 0);
    this.guardar(lista);
  }

  /** Para productos sin opciones: quita una unidad de su única línea. */
  quitarUno(productoId: number): void {
    const l = [...this.lineas()].reverse().find((x) => x.productoId === productoId);
    if (l) this.cambiar(l.clave, -1);
  }

  /** Quita productos agotados o que ya no existen y opciones que ya no están. */
  limpiar(productos: Producto[]): void {
    const porId = new Map(productos.map((p) => [p.id, p]));
    const lista = this.lineas().filter((l) => {
      const p = porId.get(l.productoId);
      if (!p || !p.disponible) return false;
      const validas = new Set(p.grupos.flatMap((g) => g.opciones.filter((o) => o.disponible).map((o) => o.id)));
      return l.opcionIds.every((id) => validas.has(id));
    });
    if (lista.length !== this.lineas().length) this.guardar(lista);
  }

  /** Lee el carrito de la empresa actual (al entrar a otra tienda). */
  recargar(): void {
    this.lineas.set(leer());
  }

  vaciar(): void {
    this.guardar([]);
  }

  private guardar(v: LineaCarrito[]): void {
    this.lineas.set(v);
    try { localStorage.setItem(claveLocal('carrito'), JSON.stringify(v)); } catch { /* sin almacenamiento */ }
  }
}

function leer(): LineaCarrito[] {
  try {
    const v = JSON.parse(localStorage.getItem(claveLocal('carrito')) ?? '[]') as LineaCarrito[];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
