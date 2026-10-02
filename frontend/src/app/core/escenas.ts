import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sinMovimiento } from './animar';

/**
 * Escenas de scroll para la tienda, al estilo de las páginas de Elementor: secciones que se quedan fijas
 * mientras la animación avanza al ritmo del dedo o la rueda (scrub), en vez de animaciones que solo «aparecen».
 *
 * Reglas:
 *  - Lo pesado (fijar secciones) solo en pantallas de 900 px o más; en el celular se usa una versión liviana.
 *  - Quien pidió «reducir movimiento» no ve nada de esto: el contenido queda quieto y completo.
 *  - Todo se crea dentro de un gsap.matchMedia y se deshace con la función que se devuelve.
 */

const ESCRITORIO = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';
const CELULAR = '(max-width: 899px) and (prefers-reduced-motion: no-preference)';

export function montarEscenas(raiz: HTMLElement): () => void {
  gsap.registerPlugin(ScrollTrigger);
  if (sinMovimiento()) return () => undefined;
  const mm = gsap.matchMedia();

  mm.add(ESCRITORIO, () => {
    // En el orden en que aparecen en la página: cada sección fija corre a las de abajo y ScrollTrigger
    // calcula los puntos de inicio en el orden en que se crean.
    portadaFija(raiz);
    pasosFijos(raiz);
    galeriaHorizontal(raiz);
  });
  mm.add(CELULAR, () => {
    portadaLiviana(raiz);
  });
  // En cualquier tamaño: títulos que suben palabra por palabra y fotos que se destapan.
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    titulosPorPalabras(raiz);
    fotosConCortina(raiz);
  });

  // Las imágenes cambian el alto de la página al cargar: los puntos de inicio se recalculan.
  const recalcular = () => ScrollTrigger.refresh();
  addEventListener('load', recalcular, { once: true });
  const t = setTimeout(recalcular, 600);
  return () => { clearTimeout(t); removeEventListener('load', recalcular); mm.revert(); };
}

/** Portada «shell»: se queda fija, el marco se encoge a una tarjeta, el texto se va y las fotos se dispersan. */
function portadaFija(raiz: HTMLElement): void {
  const lp = raiz.querySelector<HTMLElement>('.lp');
  if (!lp) return;
  const fotos = lp.querySelectorAll<HTMLElement>('.lp-foto');
  const t = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: lp, start: 'top top', end: '+=75%', scrub: 0.6, pin: true, anticipatePin: 1 },
  });
  t.fromTo(lp, { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: 'inset(5% 4% 5% 4% round 36px)' }, 0)
    .fromTo(lp.querySelector('.lp-texto'), { yPercent: 0, autoAlpha: 1 }, { yPercent: -18, autoAlpha: 0 }, 0.15)
    .fromTo(lp.querySelectorAll('.lp-blob'), { scale: 1 }, { scale: 1.8 }, 0);
  // Cada foto sale hacia su lado, gira un poco y crece: como el collage de Elementor abriéndose.
  const rumbos = [{ xPercent: -55, yPercent: -20, rotation: -14 }, { xPercent: 60, yPercent: -35, rotation: 12 }, { xPercent: 50, yPercent: 30, rotation: -8 }];
  // Valores de inicio explícitos: la entrada de la portada también anima la escala y no deben pisarse.
  fotos.forEach((f, i) => t.fromTo(f, { xPercent: 0, yPercent: 0, rotation: 0, scale: 1 }, { ...rumbos[i % rumbos.length], scale: 1.18 }, 0));
}

/** Celular: sin fijar nada (se siente pesado con el dedo); solo profundidad suave al bajar. */
function portadaLiviana(raiz: HTMLElement): void {
  const lp = raiz.querySelector<HTMLElement>('.lp');
  if (!lp) return;
  const al = { trigger: lp, start: 'top top', end: 'bottom top', scrub: true };
  gsap.to(lp.querySelector('.lp-fotos'), { yPercent: -12, ease: 'none', scrollTrigger: al });
  gsap.to(lp.querySelector('.lp-texto'), { yPercent: 8, opacity: 0.4, ease: 'none', scrollTrigger: al });
}

/** «Los favoritos»: la sección se queda fija y la franja avanza de lado mientras se baja. */
function galeriaHorizontal(raiz: HTMLElement): void {
  const sec = raiz.querySelector<HTMLElement>('.fav');
  const pista = sec?.querySelector<HTMLElement>('.fav-pista');
  if (!sec || !pista) return;
  const fila = pista.querySelector<HTMLElement>('.fav-fila');
  if (!fila) return;
  // Lo que sobra de la fila frente al ancho visible de la sección.
  const recorrido = () => Math.max(0, fila.scrollWidth - sec.clientWidth);
  if (recorrido() < 40) return; // cabe entera: no hay nada que recorrer
  sec.classList.add('fav-fija');
  gsap.to(fila, {
    x: () => -recorrido(), ease: 'none',
    scrollTrigger: {
      trigger: sec, start: 'top top', end: () => '+=' + recorrido(), scrub: 0.8, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (st) => sec.style.setProperty('--avance', String(st.progress)),
    },
  });
}

/** Pasos para pedir: fijos, cada uno entra a su turno y la línea que los une se va llenando. */
function pasosFijos(raiz: HTMLElement): void {
  const sec = raiz.querySelector<HTMLElement>('.pasos-escena');
  if (!sec || getComputedStyle(sec).display === 'none') return;
  const pasos = sec.querySelectorAll<HTMLElement>('.paso');
  const t = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + pasos.length * 45 + '%', scrub: 0.7, pin: true, anticipatePin: 1 },
  });
  t.fromTo(sec.querySelector('.pasos-linea i'), { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: pasos.length }, 0);
  pasos.forEach((p, i) => {
    t.fromTo(p, { autoAlpha: 0.15, y: 50, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6 }, i * 0.9)
      .fromTo(p.querySelector('.n'), { scale: 0.4, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, i * 0.9 + 0.1);
  });
}

/** Los títulos marcados con .palabras suben palabra por palabra, como una cortina de texto. */
function titulosPorPalabras(raiz: HTMLElement): void {
  raiz.querySelectorAll<HTMLElement>('.palabras').forEach((titulo) => {
    const palabras = titulo.querySelectorAll('.pal > i');
    if (!palabras.length) return;
    gsap.fromTo(palabras, { yPercent: 110, rotation: 4 }, {
      yPercent: 0, rotation: 0, duration: 0.8, ease: 'power4.out', stagger: 0.06,
      scrollTrigger: { trigger: titulo, start: 'top 88%', once: true },
    });
  });
  // Encabezados de cada categoría (su texto viene del negocio): se destapan de abajo hacia arriba.
  ScrollTrigger.batch(Array.from(raiz.querySelectorAll('.seccion .sec-h h2')).filter(debajo), {
    start: 'top 90%', once: true,
    onEnter: (lote) => gsap.fromTo(lote, { clipPath: 'inset(0 0 100% 0)', y: 30 }, { clipPath: 'inset(0 0 0% 0)', y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'clipPath,transform' }),
  });
}

/** Fotos de los productos: se destapan con una cortina y un pequeño zoom al entrar en pantalla. */
function fotosConCortina(raiz: HTMLElement): void {
  const fotos = Array.from(raiz.querySelectorAll<HTMLElement>('.item-foto .art, .fav-foto')).filter(debajo);
  gsap.set(fotos, { clipPath: 'inset(100% 0% 0% 0%)' });
  ScrollTrigger.batch(fotos, {
    start: 'top 92%', once: true,
    onEnter: (lote) => {
      gsap.to(lote, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut', stagger: 0.08, clearProps: 'clipPath' });
      gsap.fromTo(lote.map((f) => f.querySelector('app-foto') ?? f), { scale: 1.25 }, { scale: 1, duration: 1.2, ease: 'power3.out', stagger: 0.08, clearProps: 'transform' });
    },
  });
}

/** Solo se anima lo que está más abajo de la pantalla: lo que ya se ve al cargar queda quieto. */
function debajo(el: Element): boolean {
  return el.getBoundingClientRect().top > innerHeight * 0.9;
}

/** Parte un texto en palabras para el efecto de cortina (se usa desde las plantillas: @for de palabras). */
export function palabras(texto: string): string[] {
  return texto.trim().split(/\s+/).filter(Boolean);
}
