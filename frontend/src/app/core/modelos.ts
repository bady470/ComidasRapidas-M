// Tipos que devuelve la API de Spring Boot (ver co.leinei.api.web.dto).

export type EstadoPedido = 'NUEVO' | 'CONFIRMADO' | 'PREPARANDO' | 'EN_CAMINO' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
export type EstadoPago = 'PENDIENTE' | 'RECIBIDO';
export type MetodoPago = 'CUENTA' | 'EFECTIVO';
export type TipoEntrega = 'DOMICILIO' | 'RECOGER';
export type ModoPedido = 'INMEDIATO' | 'PROGRAMADO';
export type TipoPromocion = 'COMBO' | 'PORCENTAJE' | 'PRECIO_ESPECIAL' | 'ENVIO_GRATIS';

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  NUEVO: 'Nuevo',
  CONFIRMADO: 'Confirmado',
  PREPARANDO: 'Preparando',
  EN_CAMINO: 'En camino',
  LISTO: 'Listo para recoger',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Texto del botón que lleva el pedido al siguiente estado. */
export const ACCION_HACIA: Partial<Record<EstadoPedido, string>> = {
  CONFIRMADO: 'Confirmar',
  PREPARANDO: 'Empezar a preparar',
  EN_CAMINO: 'Salió a domicilio',
  LISTO: 'Listo para recoger',
  ENTREGADO: 'Marcar entregado',
};

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ---------- Público ----------
export interface Cuenta { id: number; entidad: string; titular: string; numero: string; }
export interface Zona { id: number; nombre: string; valor: number; }
export interface HorarioDia { dia: number; activo: boolean; abre: string; cierra: string; }

export interface Tienda {
  nombre: string; eslogan: string; tituloPortada: string; mensaje: string; logoId: number | null;
  colorPrimario: string; colorSecundario: string;
  whatsapp: string; direccion: string; ciudad: string; instagram: string;
  abierto: boolean; modoPedido: ModoPedido; recibePedidos: boolean; enHorario: boolean;
  fechaServicio: string; cierre: string | null; proximaApertura: string | null;
  tiempoMin: number; tiempoMax: number; franjas: string[]; pedidoMinimo: number; horarios: HorarioDia[];
  domicilioActivo: boolean; domicilioValor: number; zonas: Zona[]; recogerActivo: boolean;
  efectivo: boolean; cuentas: Cuenta[];
}

export interface Categoria { id: number; nombre: string; }
export interface Opcion { id: number; nombre: string; precioExtra: number; disponible: boolean; }
export interface Grupo { id: number; nombre: string; minimo: number; maximo: number; opciones: Opcion[]; }

export interface Producto {
  id: number; categoriaId: number | null; nombre: string; descripcion: string; precio: number; precioHoy: number;
  imagenId: number | null; etiqueta: string; disponible: boolean; grupos: Grupo[];
}

export interface Promocion {
  id: number; nombre: string; descripcion: string; tipo: TipoPromocion; cantidad: number | null;
  precio: number | null; porcentaje: number | null; minimo: number; productoId: number | null; productoIds: number[];
}

export interface Catalogo { tienda: Tienda; categorias: Categoria[]; productos: Producto[]; promociones: Promocion[]; }

export interface ItemPedido { productoId: number; cantidad: number; opcionIds: number[]; }

export interface LineaCotizada {
  productoId: number; opcionIds: number[]; nombre: string; detalle: string; precioLista: number; precioBase: number;
  extras: number; precioUnitario: number; costoUnitario: number; cantidad: number; subtotal: number;
}

export interface Cotizacion {
  lineas: LineaCotizada[]; cantidadTotal: number; subtotalLista: number; ahorroPrecioEspecial: number;
  subtotal: number; descuento: number; promocion: string; envioGratis: boolean; domicilio: number;
  total: number; costoTotal: number;
}

export interface CrearPedido {
  items: ItemPedido[]; tipoEntrega: TipoEntrega; zonaId: number | null; nombre: string; celular: string;
  barrio: string; direccion: string; referencia: string; franja: string; metodoPago: MetodoPago;
  cuentaId: number | null; notas: string;
}

export interface PedidoCreado {
  codigo: string; fechaEntrega: string; franja: string; tipoEntrega: TipoEntrega; modoPedido: ModoPedido;
  tiempoMin: number; tiempoMax: number; total: number; metodoPago: MetodoPago;
  cuentaEntidad: string; cuentaTitular: string; cuentaNumero: string; whatsappTienda: string; direccionTienda: string;
}

export interface EventoPublico { estado: EstadoPedido; mensaje: string; nota: string; fecha: string; }

export interface Seguimiento {
  codigo: string; estado: EstadoPedido; estadoMensaje: string; estadoPago: EstadoPago; tipoEntrega: TipoEntrega;
  flujo: EstadoPedido[]; fechaEntrega: string; franja: string; nombre: string; barrio: string; zona: string;
  items: { nombre: string; detalle: string; cantidad: number; precioUnitario: number }[];
  subtotal: number; descuento: number; promocion: string; domicilio: number; total: number;
  metodoPago: MetodoPago; cuentaEntidad: string; cuentaTitular: string; cuentaNumero: string;
  eventos: EventoPublico[]; creado: string; direccionTienda: string;
}

// ---------- Administración ----------
export interface AdminUsuario { id: number; usuario: string; nombre: string; }
export interface Sesion { token: string; nombre: string; usuario: string; expira: string; }

export interface PedidoAdmin {
  id: number; codigo: string; creado: string; fechaEntrega: string; franja: string;
  tipoEntrega: TipoEntrega; zona: string; flujo: EstadoPedido[];
  clienteNombre: string; clienteCelular: string; barrio: string; direccion: string; referencia: string; notas: string;
  items: { productoId: number | null; nombre: string; detalle: string; cantidad: number; precioUnitario: number; costoUnitario: number }[];
  subtotal: number; descuento: number; promocion: string; domicilio: number; total: number; costoTotal: number;
  metodoPago: MetodoPago; cuentaEntidad: string; cuentaTitular: string; cuentaNumero: string;
  estadoPago: EstadoPago; estado: EstadoPedido; origen: 'WEB' | 'WHATSAPP';
  eventos: { estado: EstadoPedido; nota: string; autor: string; fecha: string }[];
}

export interface PedidoManual {
  items: ItemPedido[]; tipoEntrega: TipoEntrega; zonaId: number | null; nombre: string; celular: string;
  barrio: string; direccion: string; franja: string; metodoPago: MetodoPago; cuentaId: number | null;
  fechaEntrega: string | null; notas: string;
}

export interface CategoriaAdmin { id: number; nombre: string; activa: boolean; orden: number; productos: number; }

export interface OpcionAdmin { id: number | null; nombre: string; precioExtra: number; disponible: boolean; }
export interface GrupoAdmin { id: number | null; nombre: string; minimo: number; maximo: number; opciones: OpcionAdmin[]; }

export interface ProductoAdmin {
  id: number; slug: string; categoriaId: number | null; nombre: string; descripcion: string; precio: number;
  costo: number; imagenId: number | null; etiqueta: string; disponible: boolean; orden: number; grupos: GrupoAdmin[];
}

export type ProductoForm = Omit<ProductoAdmin, 'id' | 'slug'>;

export interface PromocionAdmin extends Promocion {
  activa: boolean; destacada: boolean; desde: string | null; hasta: string | null; vigente: boolean;
}

export type PromocionForm = Omit<PromocionAdmin, 'id' | 'vigente'>;

export interface CuentaAdmin { id: number | null; entidad: string; titular: string; numero: string; activa: boolean; }
export interface ZonaAdmin { id: number | null; nombre: string; valor: number; activa: boolean; }

export interface ConfigAdmin {
  nombre: string; eslogan: string; tituloPortada: string; mensaje: string; logoId: number | null;
  colorPrimario: string; colorSecundario: string;
  whatsapp: string; direccion: string; ciudad: string; instagram: string;
  abierto: boolean; modoPedido: ModoPedido; tiempoMin: number; tiempoMax: number;
  diaEntrega: number; cierreDiasAntes: number; cierreHora: number; franjas: string[]; pedidoMinimo: number;
  horarios: HorarioDia[];
  domicilioActivo: boolean; domicilioValor: number; zonas: ZonaAdmin[]; recogerActivo: boolean;
  efectivo: boolean; cuentas: CuentaAdmin[]; costoOperativoUnidad: number;
}

export interface Produccion {
  fecha: string; pedidos: number; unidades: number; ventasProductos: number; domicilios: number;
  costoProductos: number; costoOperativo: number; ganancia: number; cobrado: number; porCobrar: number;
  domicilio: number; recoger: number;
  productos: { nombre: string; unidades: number; ventas: number; costo: number; ganancia: number }[];
  detalle: { nombre: string; detalle: string; unidades: number }[];
  pagos: { cuenta: string; pedidos: number; total: number; recibido: number }[];
}
