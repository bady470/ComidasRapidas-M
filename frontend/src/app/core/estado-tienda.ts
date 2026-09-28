import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TiendaApi, mensajeError } from './api';
import { Carrito } from './carrito';
import { Catalogo } from './modelos';
import { Tema } from './tema';

/** Catálogo y marca de la tienda, compartidos entre páginas. Se recarga al volver a la pestaña. */
@Injectable({ providedIn: 'root' })
export class EstadoTienda {
  private api = inject(TiendaApi);
  private carrito = inject(Carrito);
  private tema = inject(Tema);
  private titulo = inject(Title);

  readonly catalogo = signal<Catalogo | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.catalogo()) this.cargar();
    });
  }

  cargar(): void {
    this.cargando.set(true);
    this.api.catalogo().subscribe({
      next: (c) => {
        this.catalogo.set(c);
        this.error.set('');
        this.cargando.set(false);
        this.tema.aplicar(c.tienda);
        this.titular(this.pagina);
        this.carrito.limpiar(c.productos);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  private pagina = '';

  /** Título de la pestaña: "Página · Nombre del negocio". */
  titular(pagina = ''): void {
    this.pagina = pagina;
    const nombre = this.catalogo()?.tienda.nombre ?? '';
    this.titulo.setTitle([pagina, nombre].filter(Boolean).join(' · ') || 'Tienda');
  }
}
