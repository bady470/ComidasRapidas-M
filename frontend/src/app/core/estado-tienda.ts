import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TiendaApi, mensajeError } from './api';
import { Carrito } from './carrito';
import { EmpresaActual } from './empresa';
import { Catalogo } from './modelos';
import { Tema } from './tema';

/**
 * Catálogo y marca de la empresa actual, compartidos entre páginas de la tienda y del portal.
 * Se recarga al volver a la pestaña y se reinicia al pasar a otra empresa.
 */
@Injectable({ providedIn: 'root' })
export class EstadoTienda {
  private api = inject(TiendaApi);
  private carrito = inject(Carrito);
  private tema = inject(Tema);
  private titulo = inject(Title);
  private emp = inject(EmpresaActual);

  readonly catalogo = signal<Catalogo | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');

  /** Empresa de la que se pidió el catálogo por última vez. */
  private cargadaPara = '';

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.catalogo()) this.cargar();
    });
    // Al cambiar de empresa (/una → /otra) se descarta lo de la anterior.
    effect(() => {
      const slug = this.emp.slug();
      untracked(() => {
        if (slug === this.cargadaPara) return;
        const habiaTienda = this.cargadaPara !== '';
        this.catalogo.set(null);
        this.error.set('');
        this.carrito.recargar();
        if (habiaTienda && slug) this.cargar();
      });
    });
  }

  /** Carga el catálogo si todavía no está el de la empresa actual. */
  asegurar(): void {
    if (!this.catalogo() || this.cargadaPara !== this.emp.slug()) this.cargar();
  }

  cargar(): void {
    const slug = this.emp.slug();
    if (!slug) return;
    if (slug !== this.cargadaPara) { this.catalogo.set(null); this.carrito.recargar(); }
    this.cargadaPara = slug;
    this.cargando.set(true);
    this.api.catalogo().subscribe({
      next: (c) => {
        if (this.emp.slug() !== slug) return; // respuesta de una empresa que ya se dejó
        this.catalogo.set(c);
        this.error.set('');
        this.cargando.set(false);
        this.tema.aplicar(c.tienda);
        this.titular(this.pagina);
        this.carrito.limpiar(c.productos);
      },
      error: (e) => {
        if (this.emp.slug() !== slug) return;
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  /** true si el plan de la empresa incluye el módulo. */
  tieneModulo(codigo: string): boolean {
    return this.catalogo()?.tienda.modulos?.includes(codigo) ?? false;
  }

  private pagina = '';

  /** Título de la pestaña: "Página · Nombre del negocio" (o "Página · Leinei" fuera de una tienda). */
  titular(pagina = ''): void {
    this.pagina = pagina;
    const nombre = this.emp.slug() ? this.catalogo()?.tienda.nombre ?? '' : 'Leinei';
    this.titulo.setTitle([pagina, nombre].filter(Boolean).join(' · ') || 'Leinei');
  }
}
