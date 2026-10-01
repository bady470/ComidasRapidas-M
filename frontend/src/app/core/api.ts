import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminUsuario, Catalogo, CategoriaAdmin, ConfigAdmin, Cotizacion, CrearPedido, EstadoPago, EstadoPedido, ItemPedido,
  PedidoAdmin, PedidoCreado, PedidoManual, Produccion, ProductoAdmin, ProductoForm, PromocionAdmin, PromocionForm,
  Seguimiento, Sesion, TipoEntrega,
  Avisos, Domiciliario, ActualizarEmpresa, CrearEmpresa, EmpresaDetalle, EmpresaResumen, ModuloPlataforma, ResumenPlataforma, Superadmin, Biblioteca, ResultadoBiblioteca, Plan, EmpresaCreada, ConfigCorreo, ConfigCorreoForm, ResultadoPrueba,
} from './modelos';

import { apiEmpresa } from './empresa';

export { urlImagen } from './empresa';

const API = environment.apiUrl;

/** Saca el mensaje que manda la API ({detail}) o uno genérico si no hay conexión. */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    if (e.status === 502 || e.status === 503 || e.status === 504) {
      return 'El servidor no está disponible en este momento (la API no responde). Intenta de nuevo en un momento.';
    }
    const detalle = (e.error as { detail?: string } | null)?.detail;
    if (detalle) return detalle;
  }
  return 'Algo salió mal. Intenta de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class TiendaApi {
  private http = inject(HttpClient);

  catalogo(): Observable<Catalogo> {
    return this.http.get<Catalogo>(`${apiEmpresa()}/public/catalogo`);
  }
  cotizar(items: ItemPedido[], tipoEntrega: TipoEntrega | null, zonaId: number | null): Observable<Cotizacion> {
    return this.http.post<Cotizacion>(`${apiEmpresa()}/public/cotizar`, { items, tipoEntrega, zonaId });
  }
  crearPedido(p: CrearPedido): Observable<PedidoCreado> {
    return this.http.post<PedidoCreado>(`${apiEmpresa()}/public/pedidos`, p);
  }
  /** El cliente adjunta el comprobante de su transferencia. */
  subirComprobante(codigo: string, celular: string, archivo: File): Observable<Seguimiento> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    const params = new HttpParams().set('celular', celular);
    return this.http.post<Seguimiento>(`${apiEmpresa()}/public/pedidos/${encodeURIComponent(codigo)}/comprobante`, datos, { params });
  }
  seguimiento(codigo: string, celular: string): Observable<Seguimiento> {
    const params = new HttpParams().set('celular', celular);
    return this.http.get<Seguimiento>(`${apiEmpresa()}/public/pedidos/${encodeURIComponent(codigo)}`, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);
  /** Siempre la empresa actual: /api/t/{empresa}/admin */
  private get base(): string { return `${apiEmpresa()}/admin`; }

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

  // ---- Logo del negocio (se guarda en la plataforma, no en la base de la empresa)
  subirLogo(archivo: File): Observable<ConfigAdmin> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<ConfigAdmin>(`${this.base}/marca/logo`, datos);
  }
  quitarLogo(): Observable<ConfigAdmin> {
    return this.http.delete<ConfigAdmin>(`${this.base}/marca/logo`);
  }

  // ---- Pedidos
  pedidos(filtro: { fecha?: string; estado?: EstadoPedido; q?: string; porPagar?: boolean }): Observable<PedidoAdmin[]> {
    let params = new HttpParams();
    if (filtro.porPagar) params = params.set('porPagar', 'true');
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
  /** Comprobante como archivo (con el token del portal); se abre con URL.createObjectURL. */
  comprobante(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/pedidos/${id}/comprobante`, { responseType: 'blob' });
  }
  asignarDomiciliario(id: number, domiciliarioId: number | null): Observable<PedidoAdmin> {
    return this.http.patch<PedidoAdmin>(`${this.base}/pedidos/${id}/domiciliario`, { domiciliarioId });
  }

  // ---- Domiciliarios
  domiciliarios(): Observable<Domiciliario[]> {
    return this.http.get<Domiciliario[]>(`${this.base}/domiciliarios`);
  }
  guardarDomiciliario(id: number | null, d: { nombre: string; celular: string; activo: boolean }): Observable<Domiciliario[]> {
    return id ? this.http.put<Domiciliario[]>(`${this.base}/domiciliarios/${id}`, d)
              : this.http.post<Domiciliario[]>(`${this.base}/domiciliarios`, d);
  }

  // ---- Avisos del portal
  avisos(): Observable<Avisos> {
    return this.http.get<Avisos>(`${this.base}/avisos`);
  }
  marcarLeidos(hastaId: number): Observable<Avisos> {
    return this.http.post<Avisos>(`${this.base}/avisos/leidos`, { hastaId });
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

/** API del superadmin: empresas de la plataforma. */
@Injectable({ providedIn: 'root' })
export class PlataformaApi {
  private http = inject(HttpClient);
  private base = `${API}/plataforma`;

  // ---- Sesión
  login(usuario: string, clave: string): Observable<Sesion> {
    return this.http.post<Sesion>(`${this.base}/auth/login`, { usuario, clave });
  }
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }
  cambiarClave(actual: string, nueva: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/clave`, { actual, nueva });
  }
  superadmins(): Observable<Superadmin[]> {
    return this.http.get<Superadmin[]>(`${this.base}/auth/superadmins`);
  }
  crearSuperadmin(usuario: string, nombre: string, clave: string): Observable<Superadmin> {
    return this.http.post<Superadmin>(`${this.base}/auth/superadmins`, { usuario, nombre, clave });
  }

  // ---- Empresas
  modulos(): Observable<ModuloPlataforma[]> {
    return this.http.get<ModuloPlataforma[]>(`${this.base}/modulos`);
  }
  resumen(): Observable<ResumenPlataforma> {
    return this.http.get<ResumenPlataforma>(`${this.base}/resumen`);
  }
  empresas(): Observable<EmpresaResumen[]> {
    return this.http.get<EmpresaResumen[]>(`${this.base}/empresas`);
  }
  empresa(uuid: string): Observable<EmpresaDetalle> {
    return this.http.get<EmpresaDetalle>(`${this.base}/empresas/${uuid}`);
  }
  crearEmpresa(e: CrearEmpresa): Observable<EmpresaCreada> {
    return this.http.post<EmpresaCreada>(`${this.base}/empresas`, e);
  }
  actualizarEmpresa(uuid: string, e: ActualizarEmpresa): Observable<EmpresaDetalle> {
    return this.http.put<EmpresaDetalle>(`${this.base}/empresas/${uuid}`, e);
  }
  subirLogo(uuid: string, archivo: File): Observable<EmpresaDetalle> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return this.http.post<EmpresaDetalle>(`${this.base}/empresas/${uuid}/logo`, datos);
  }
  quitarLogo(uuid: string): Observable<EmpresaDetalle> {
    return this.http.delete<EmpresaDetalle>(`${this.base}/empresas/${uuid}/logo`);
  }
  guardarModulos(uuid: string, modulos: string[]): Observable<EmpresaDetalle> {
    return this.http.put<EmpresaDetalle>(`${this.base}/empresas/${uuid}/modulos`, { modulos });
  }
  suspender(uuid: string): Observable<EmpresaDetalle> {
    return this.http.post<EmpresaDetalle>(`${this.base}/empresas/${uuid}/suspender`, {});
  }
  activar(uuid: string): Observable<EmpresaDetalle> {
    return this.http.post<EmpresaDetalle>(`${this.base}/empresas/${uuid}/activar`, {});
  }
  reintentar(uuid: string): Observable<EmpresaDetalle> {
    return this.http.post<EmpresaDetalle>(`${this.base}/empresas/${uuid}/reintentar`, {});
  }
  correo(): Observable<ConfigCorreo> {
    return this.http.get<ConfigCorreo>(`${this.base}/correo`);
  }
  guardarCorreo(c: ConfigCorreoForm): Observable<ConfigCorreo> {
    return this.http.put<ConfigCorreo>(`${this.base}/correo`, c);
  }
  probarCorreo(destino: string): Observable<ResultadoPrueba> {
    return this.http.post<ResultadoPrueba>(`${this.base}/correo/prueba`, { destino });
  }
  planes(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.base}/planes`);
  }
  crearPlan(p: Plan): Observable<Plan> {
    return this.http.post<Plan>(`${this.base}/planes`, p);
  }
  guardarPlan(p: Plan): Observable<Plan> {
    return this.http.put<Plan>(`${this.base}/planes/${p.codigo}`, p);
  }
  biblioteca(): Observable<Biblioteca> {
    return this.http.get<Biblioteca>(`${this.base}/biblioteca`);
  }
  imagenBiblioteca(nombre: string): string {
    return `${this.base}/publico/biblioteca/imagenes/${encodeURIComponent(nombre)}`;
  }
  importarBiblioteca(uuid: string, slugs: string[], ajustePorcentaje: number): Observable<ResultadoBiblioteca> {
    return this.http.post<ResultadoBiblioteca>(`${this.base}/empresas/${uuid}/biblioteca`, { slugs, ajustePorcentaje });
  }
  claveAdmin(uuid: string, usuario: string, nueva: string): Observable<void> {
    return this.http.post<void>(`${this.base}/empresas/${uuid}/clave-admin`, { usuario, nueva });
  }
}
