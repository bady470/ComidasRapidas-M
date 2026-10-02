import { Directive, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';
import { gsap } from 'gsap';

/** Quien pidió «reducir movimiento» en su sistema no ve animaciones. */
export function sinMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Entrada suave de un grupo de elementos (sube y aparece, uno tras otro). */
export function entrar(el: Element | Element[] | NodeListOf<Element> | null, opciones: { y?: number; x?: number; escala?: number; duracion?: number; escalon?: number; retraso?: number } = {}): void {
  if (!el || sinMovimiento()) return;
  const lista = el instanceof Element ? [el] : Array.from(el);
  if (!lista.length) return;
  gsap.fromTo(lista,
    { opacity: 0, y: opciones.y ?? 14, x: opciones.x ?? 0, scale: opciones.escala ?? 1 },
    { opacity: 1, y: 0, x: 0, scale: 1, duration: opciones.duracion ?? 0.45, stagger: opciones.escalon ?? 0.06, delay: opciones.retraso ?? 0, ease: 'power2.out', clearProps: 'opacity,transform' });
}

/** Revela los elementos que cumplen `selector` cuando entran en pantalla al hacer scroll (una sola vez). */
export function revelarAlDesplazar(raiz: Element, selector: string): () => void {
  if (sinMovimiento() || typeof IntersectionObserver === 'undefined') return () => undefined;
  const visto = new WeakSet<Element>();
  const io = new IntersectionObserver((entradas) => {
    const nuevos = entradas.filter((e) => e.isIntersecting).map((e) => e.target);
    nuevos.forEach((n) => io.unobserve(n));
    entrar(nuevos, { y: 22, escalon: 0.07, duracion: 0.5 });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  const mirar = () => raiz.querySelectorAll(selector).forEach((n) => {
    if (visto.has(n)) return;
    visto.add(n);
    // Lo que ya está a la vista no se anima: solo lo que viene al desplazarse.
    const r = n.getBoundingClientRect();
    if (r.top > innerHeight) { (n as HTMLElement).style.opacity = '0'; io.observe(n); }
  });
  mirar();
  const mo = new MutationObserver(mirar);
  mo.observe(raiz, { childList: true, subtree: true });
  return () => { io.disconnect(); mo.disconnect(); };
}

/** `<div animar>` hace entrar al elemento; `animar="hijos"` hace entrar a sus hijos directos, escalonados. */
@Directive({ selector: '[animar]' })
export class Animar {
  readonly animar = input<'' | 'hijos'>('');
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  constructor() {
    afterNextRender(() => entrar(this.animar() === 'hijos' ? Array.from(this.el.children) : this.el));
  }
}

/** `<span [contar]="n">` muestra el número subiendo desde el valor anterior hasta `n`. */
@Directive({ selector: '[contar]' })
export class Contar {
  readonly contar = input.required<number>();
  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private actual = { v: 0 };
  constructor() {
    effect(() => {
      const meta = this.contar();
      if (sinMovimiento()) { this.actual.v = meta; this.pintar(); return; }
      gsap.to(this.actual, { v: meta, duration: 0.8, ease: 'power2.out', onUpdate: () => this.pintar() });
    });
  }
  private pintar(): void { this.el.textContent = Math.round(this.actual.v).toLocaleString('es-CO'); }
}
