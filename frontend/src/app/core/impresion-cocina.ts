import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AdminApi } from './api';
import { Avisos as Toast } from './avisos';
import { AvisosPortal, CambioPedido } from './avisos-portal';
import { imprimirComanda } from './comanda';
import { claveLocal } from './empresa';
import { EstadoTienda } from './estado-tienda';
import { ConfigCocina, MODULOS, PedidoAdmin } from './modelos';

/** Si no hay configuración guardada todavía. */
const POR_DEFECTO: ConfigCocina = { modo: 'APAGADA', momento: 'NUEVO', esperaPago: true, papel: 80, copias: 1, precios: true, pie: '' };

/**
 * Impresión de comandas en el portal.
 *  - MANUAL: botón «Imprimir comanda» en cada pedido.
 *  - AUTOMATICA: solo imprime el equipo donde se activó «Este equipo imprime» (así no sale doble si hay varios
 *    computadores abiertos). Imprime los pedidos que lleguen desde que se activó, una sola vez cada uno (se recuerda
 *    en este navegador), al llegar o al confirmarse según la configuración, y si se pide, cuando el pago en línea
 *    ya está confirmado.
 */
@Injectable({ providedIn: 'root' })
export class ImpresionCocina {
  private api = inject(AdminApi);
  private avisos = inject(AvisosPortal);
  private estado = inject(EstadoTienda);
  private toast = inject(Toast);

  readonly config = signal<ConfigCocina>(POR_DEFECTO);
  readonly esteEquipo = signal(false);
  private activadoEn = 0;
  private impresos = new Set<number>();
  private empresa = '';

  constructor() {
    effect(() => {
      const cambio = this.avisos.cambioPedido();
      untracked(() => { if (cambio) this.alCambiar(cambio); });
    });
    // Se carga cuando cambia la configuración (otro equipo la guardó) o cuando ya se sabe si la empresa tiene el módulo.
    effect(() => {
      this.avisos.cambioCocina();
      this.estado.tieneModulo(MODULOS.cocina);
      untracked(() => this.cargar());
    });
  }

  /** La llama el layout del portal al entrar a una empresa. */
  iniciar(empresa: string): void {
    if (this.empresa === empresa) return;
    this.empresa = empresa;
    this.esteEquipo.set(leer(claveLocal('imprime-aqui')) === '1');
    this.activadoEn = Number(leer(claveLocal('imprime-desde')) ?? 0);
    this.impresos = new Set(JSON.parse(leer(claveLocal('comandas-impresas')) ?? '[]') as number[]);
    this.cargar();
  }

  private cargar(): void {
    if (!this.empresa || !this.estado.tieneModulo(MODULOS.cocina)) return;
    this.api.configCocina().subscribe({ next: (c) => this.config.set(c), error: () => {} });
  }

  /** Activa o apaga la impresión automática en ESTE equipo. Solo imprime lo que llegue de ahora en adelante. */
  usarEsteEquipo(si: boolean): void {
    this.esteEquipo.set(si);
    guardar(claveLocal('imprime-aqui'), si ? '1' : '0');
    if (si) {
      this.activadoEn = Date.now();
      guardar(claveLocal('imprime-desde'), String(this.activadoEn));
    }
  }

  /** Impresión a mano (botón). */
  imprimir(p: PedidoAdmin): void {
    const t = this.estado.catalogo()?.tienda;
    imprimirComanda(p, this.config(), t?.nombre ?? '', t?.modoPedido === 'PROGRAMADO');
    this.marcar(p.id);
  }

  yaImpreso(id: number): boolean { return this.impresos.has(id); }

  private alCambiar(c: CambioPedido): void {
    const cfg = this.config();
    if (cfg.modo !== 'AUTOMATICA' || !this.esteEquipo() || !this.estado.tieneModulo(MODULOS.cocina)) return;
    if (c.motivo === 'reconexion') {
      // Tras un corte, se revisan los pedidos recientes por si llegó alguno mientras tanto.
      this.api.pedidos({}).subscribe({ next: (l) => l.forEach((p) => this.quizasImprimir(p)), error: () => {} });
      return;
    }
    if (!c.codigo || this.impresos.has(c.id)) return;
    this.api.pedidos({ q: c.codigo }).subscribe({
      next: (l) => { const p = l.find((x) => x.id === c.id); if (p) this.quizasImprimir(p); },
      error: () => {},
    });
  }

  private quizasImprimir(p: PedidoAdmin): void {
    const cfg = this.config();
    if (this.impresos.has(p.id) || new Date(p.creado).getTime() < this.activadoEn) return;
    if (p.estado === 'CANCELADO' || p.estado === 'ENTREGADO') return;
    if (cfg.momento === 'CONFIRMADO' && p.estado === 'NUEVO') return;
    if (cfg.esperaPago && p.metodoPago === 'EN_LINEA' && p.estadoPago !== 'RECIBIDO') return;
    this.imprimir(p);
    this.toast.mostrar(`Comanda ${p.codigo} enviada a la impresora`);
  }

  private marcar(id: number): void {
    this.impresos.add(id);
    // Se guardan los últimos 300 para no crecer sin fin.
    guardar(claveLocal('comandas-impresas'), JSON.stringify([...this.impresos].slice(-300)));
  }
}

function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function guardar(clave: string, valor: string): void {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}
