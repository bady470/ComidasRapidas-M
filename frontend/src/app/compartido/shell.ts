import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { entrar } from '../core/animar';
import { Icono } from './icono';
import { Logo } from './logo';

export interface ItemMenu {
  /** Ruta relativa a la sección (por ejemplo «pedidos»). */
  ruta: string;
  texto: string;
  icono: string;
  /** Número o texto pequeño a la derecha (por ejemplo los pedidos por pagar). */
  insignia?: string | number | null;
  exacto?: boolean;
}
export interface GrupoMenu { titulo?: string; items: ItemMenu[]; }

/**
 * Marco de los paneles (portal de la empresa y superadmin): menú lateral, barra superior y contenido,
 * con el estilo de las plantillas de administración tipo Mantis. Los botones de la barra superior entran por
 * <ng-content select="[acciones]"> y la página por el contenido normal.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, Icono, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt" [class.mt-abierto]="abierto()">
      <aside class="mt-side" aria-label="Menú principal">
        <a class="mt-brand" [routerLink]="inicio()">
          <app-logo [logoUrl]="logoUrl()" [nombre]="marca()" />
          <span class="mt-marca"><b>{{ marca() }}</b><small>{{ subtitulo() }}</small></span>
        </a>
        <nav class="mt-nav" #menu>
          @for (g of grupos(); track $index) {
            @if (g.titulo) { <div class="mt-grupo">{{ g.titulo }}</div> }
            @for (i of g.items; track i.ruta) {
              <a class="mt-item" [routerLink]="i.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: !!i.exacto }" (click)="abierto.set(false)">
                <app-icono [nombre]="i.icono" />
                <span class="mt-texto">{{ i.texto }}</span>
                @if (i.insignia) { <span class="mt-insignia num">{{ i.insignia }}</span> }
              </a>
            }
          }
        </nav>
        <div class="mt-pie">
          <div class="mt-usuario">
            <span class="mt-avatar" aria-hidden="true">{{ inicial() }}</span>
            <span class="mt-quien"><b>{{ usuario() }}</b><small>{{ rol() }}</small></span>
          </div>
          <button class="mt-salir" type="button" (click)="salir.emit()" aria-label="Salir" title="Salir"><app-icono nombre="salir" /></button>
        </div>
      </aside>
      @if (abierto()) { <div class="mt-velo" (click)="abierto.set(false)" aria-hidden="true"></div> }

      <div class="mt-main">
        <header class="mt-top">
          <button class="mt-menu" type="button" (click)="abierto.set(!abierto())" aria-label="Abrir el menú"><app-icono nombre="menu" /></button>
          <h1 class="mt-titulo">{{ titulo() }}</h1>
          <span class="spacer"></span>
          <div class="mt-acciones"><ng-content select="[acciones]" /></div>
        </header>
        <main class="mt-contenido" #contenido><ng-content /></main>
      </div>
    </div>
  `,
})
export class Shell {
  readonly marca = input('');
  readonly subtitulo = input('');
  readonly logoUrl = input<string | null | undefined>(null);
  readonly grupos = input<GrupoMenu[]>([]);
  readonly usuario = input('');
  readonly rol = input('');
  /** Ruta a la que lleva el logo. */
  readonly inicio = input<string | string[]>('/');
  readonly salir = output<void>();

  protected abierto = signal(false);
  private raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private router = inject(Router);
  private url = signal(this.router.url);

  protected inicial = computed(() => (this.usuario().trim()[0] ?? '?').toUpperCase());

  /** El nombre de la sección activa se toma del menú: la ruta actual termina en la ruta del ítem. */
  protected titulo = computed(() => {
    const u = this.url().split('?')[0].replace(/\/+$/, '');
    let mejor: ItemMenu | null = null;
    for (const g of this.grupos()) for (const i of g.items) {
      if ((u.endsWith('/' + i.ruta) || u.includes('/' + i.ruta + '/')) && (!mejor || i.ruta.length > mejor.ruta.length)) mejor = i;
    }
    return mejor?.texto ?? this.grupos()[0]?.items[0]?.texto ?? '';
  });

  constructor() {
    // Al abrir el panel, el menú entra escalonado; al cambiar de sección, el contenido entra suave.
    afterNextRender(() => {
      entrar(this.raiz.querySelectorAll('.mt-item'), { x: -10, y: 0, escalon: 0.04, duracion: 0.4 });
      this.animarContenido();
    });
    const sub = this.router.events.subscribe((e: unknown) => {
      if (e instanceof NavigationEnd) { this.url.set(this.router.url); this.animarContenido(); }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Hace entrar los bloques de la página actual (esperando a que la ruta pinte su contenido). */
  private animarContenido(): void {
    requestAnimationFrame(() => {
      const c = this.raiz.querySelector('.mt-contenido');
      if (!c) return;
      const bloques: Element[] = [];
      for (const hijo of Array.from(c.children)) {
        if (hijo.tagName === 'ROUTER-OUTLET') continue;
        bloques.push(...(hijo.children.length ? Array.from(hijo.children) : [hijo]));
      }
      entrar(bloques.slice(0, 14), { y: 12, escalon: 0.05, duracion: 0.4 });
    });
  }
}
