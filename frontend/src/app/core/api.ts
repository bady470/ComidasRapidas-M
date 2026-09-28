import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminUsuario, Catalogo, CategoriaAdmin, ConfigAdmin, Cotizacion, CrearPedido, EstadoPago, EstadoPedido, ItemPedido,
  PedidoAdmin, PedidoCreado, PedidoManual, Produccion, ProductoAdmin, ProductoForm, PromocionAdmin, PromocionForm,
  Seguimiento, Sesion, TipoEntrega,
} from './modelos';

const API = environment.apiUrl;

/** Dirección pública de una imagen subida (logo o foto de producto). */
export function urlImagen(id: number | null | undefined): string | null {
  return id ? `${API}/public/archivos/${id}` : null;
}

/** Saca el mensaje que manda la API ({detail}) o uno genérico si no hay conexión. */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    const detalle = (e.error as { detail?: string } | null)?.detail;
    if (detalle) return detalle;
  }
  return 'Algo salió mal. Intenta de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class TiendaApi {
  private http = inject(HttpClient);

  catalogo(): Observable<Catalogo> {
    return this.http.get<Catalogo>(`${API}/public/catalogo`);
  }
  cotizar(items: ItemPedido[], tipoEntrega: TipoEntrega | null, zonaId: number | null): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${API}/public/cotizar`, { items, tipoEntrega, zonaId });
  }
  crearPedido(p: CrearPedido): Observable<PedidoCreado> {
    return this.http.post<PedidoCreado>(`${API}/public/pedidos`, p);
  }
  seguimiento(codigo: string, celular: string): Observable<Seguimiento> {
    const params = new HttpParams().set('celular', celular);
    return this.http.get<Seguimiento>(`${API}/public/pedidos/${encodeURIComponent(codigo)}`, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);
  private base = `${API}/admin`;

  // ---- Sesión y administradores
  login(usuario: string, clave: string): Observable<Sesion> {
    return this.http.post<Sesion>(`${this.base}/auth/login`, { usuario, clave });
  }
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }
  cambiarClave(actual: string, nueva: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/clave`, { actual, nueva });
  }
  administradores(): Observable<AdminUsuario[]> {
    return this.http.get<AdminUsuario[]>(`${this.base}/auth/usuarios`);
  }
  crearAdmin(usuario: string, nombre: string, clave: string): Observable<AdminUsuario> {
    return this.http.post<AdminUsuario>(`${this.base}/auth/usuarios`, { usuario, nombre, clave });
  }

  // ---- Imágenes
  subirImagen(archivo: File): Observable<{ id: number }> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<{ id: number }>(`${this.base}/archivos`, datos);
  }

  // ---- Pedidos
  pedidos(filtro: { fecha?: string; estado?: EstadoPedido; q?: string }): Observable<PedidoAdmin[]> {
    let params = new HttpParams();
    if (filtro.fecha) params = params.set('fecha', filtro.fecha);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.q) params = params.set('q', filtro.q);
    return this.http.get<PedidoAdmin[]>(`${this.base}/pedidos`, { params });
  }
  crearPedidoManual(p: PedidoManual): Observable<PedidoAdmin> {
    return this.http.post<PedidoAdmin>(`${this.base}/pedidos`, p);
  }
  cambiarEstado(id: number, estado: EstadoPedido, nota = ''): Observable<PedidoAdmin> {
    return this.http.patch<PedidoAdmin>(`${this.base}/pedidos/${id}/estado`, { estado, nota });
  }
  cambiarPago(id: number, estadoPago: EstadoPago): Observable<PedidoAdmin> {
    return this.http.patch<PedidoAdmin>(`${this.base}/pedidos/${id}/pago`, { estadoPago });
  }

  // ---- Reportes
  fechas(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/reportes/fechas`);
  }
  produccion(fecha: string): Observable<Produccion> {
    return this.http.get<Produccion>(`${this.base}/reportes/produccion`, { params: { fecha } });
  }

  // ---- Categorías
  categorias(): Observable<CategoriaAdmin[]> {
    return this.http.get<CategoriaAdmin[]>(`${this.base}/categorias`);
  }
  guardarCategoria(id: number | null, c: { nombre: string; activa: boolean; orden: number }): Observable<CategoriaAdmin[]> {
    return id ? this.http.put<CategoriaAdmin[]>(`${this.base}/categorias/${id}`, c)
              : this.http.post<CategoriaAdmin[]>(`${this.base}/categorias`, c);
  }
  eliminarCategoria(id: number): Observable<CategoriaAdmin[]> {
    return this.http.delete<CategoriaAdmin[]>(`${this.base}/categorias/${id}`);
  }

  // ---- Productos
  productos(): Observable<ProductoAdmin[]> {
    return this.http.get<ProductoAdmin[]>(`${this.base}/productos`);
  }
  guardarProducto(id: number | null, p: ProductoForm): Observable<ProductoAdmin> {
    return id ? this.http.put<ProductoAdmin>(`${this.base}/productos/${id}`, p)
              : this.http.post<ProductoAdmin>(`${this.base}/productos`, p);
  }
  disponible(id: number, disponible: boolean): Observable<ProductoAdmin> {
    return this.http.patch<ProductoAdmin>(`${this.base}/productos/${id}/disponible`, { disponible });
  }
  eliminarProducto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/productos/${id}`);
  }

  // ---- Promociones
  promociones(): Observable<PromocionAdmin[]> {
    return this.http.get<PromocionAdmin[]>(`${this.base}/promociones`);
  }
  guardarPromocion(id: number | null, p: PromocionForm): Observable<PromocionAdmin> {
    return id ? this.http.put<PromocionAdmin>(`${this.base}/promociones/${id}`, p)
              : this.http.post<PromocionAdmin>(`${this.base}/promociones`, p);
  }
  activarPromocion(id: number, activa: boolean): Observable<PromocionAdmin> {
    return this.http.patch<PromocionAdmin>(`${this.base}/promociones/${id}/activa`, { activa });
  }
  eliminarPromocion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/promociones/${id}`);
  }

  // ---- Configuración
  config(): Observable<ConfigAdmin> {
    return this.http.get<ConfigAdmin>(`${this.base}/config`);
  }
  guardarConfig(c: ConfigAdmin): Observable<ConfigAdmin> {
    return this.http.put<ConfigAdmin>(`${this.base}/config`, c);
  }
}
