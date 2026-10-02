// Tipos que devuelve la API de Spring Boot (ver co.leinei.api.web.dto).

export type EstadoPedido = 'NUEVO' | 'CONFIRMADO' | 'PREPARANDO' | 'EN_CAMINO' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
export type EstadoPago = 'PENDIENTE' | 'POR_CONFIRMAR' | 'RECIBIDO';

export const NOMBRE_PAGO: Record<EstadoPago, string> = {
  PENDIENTE: 'Sin pagar',
  POR_CONFIRMAR: 'Comprobante por revisar',
  RECIBIDO: 'Pagado',
};
export type MetodoPago = 'CUENTA' | 'EFECTIVO' | 'EN_LINEA';
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

/** Módulos que el superadmin activa por empresa (coinciden con plataforma.tbl_modulos). */
export const MODULOS = {
  tienda: 'tienda',
  opciones: 'opciones',
  promociones: 'promociones',
  zonas: 'zonas',
  reportes: 'reportes',
  pedidoManual: 'pedido_manual',
  pagosEnLinea: 'pagos_en_linea',
  caja: 'caja',
  cocina: 'cocina',
  clientes: 'clientes',
  mapas: 'mapas',
} as const;

export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ---------- Público ----------
export interface Cuenta { id: number; entidad: string; titular: string; numero: string; }
export interface Zona { id: number; nombre: string; valor: number; }
export interface HorarioDia { dia: number; activo: boolean; abre: string; cierra: string; }

export interface Tienda {
  identificador: string;
  nombre: string; eslogan: string; tituloPortada: string; mensaje: string; logoUrl: string | null;
  colorPrimario: string; colorSecundario: string;
  whatsapp: string; direccion: string; ciudad: string; instagram: string;
  abierto: boolean; modoPedido: ModoPedido; recibePedidos: boolean; enHorario: boolean;
  fechaServicio: string; cierre: string | null; proximaApertura: string | null;
  tiempoMin: number; tiempoMax: number; franjas: string[]; pedidoMinimo: number; horarios: HorarioDia[];
  domicilioActivo: boolean; domicilioValor: number; zonas: Zona[]; recogerActivo: boolean;
  efectivo: boolean; cuentas: Cuenta[];
  /** Módulos del plan de la empresa (ver MODULOS). */
  modulos: string[];
  /** Pago en línea con pasarela; null si la tienda no lo ofrece ahora. */
  pagoEnLinea: PagoEnLineaPublico | null;
  /** Modo «estamos llenos» vigente (los tiempos y el domicilio de arriba ya lo tienen en cuenta). */
  saturacion: Saturacion;
  /** Cómo se cobra el domicilio: valor fijo, por zona o por distancia en el mapa. */
  entrega: EntregaPublica;
}

// ---------- Mapas ----------
export interface Tramo { hastaKm: number; valor: number; }
export interface EntregaPublica { modo: 'FIJO' | 'ZONAS' | 'DISTANCIA'; localLat: number | null; localLng: number | null; tramos: Tramo[]; radioKm: number | null; }
export interface ConfigMapa { localLat: number | null; localLng: number | null; modo: 'FIJO' | 'DISTANCIA'; tramos: Tramo[]; seguimientoVivo: boolean; }
export interface Repartidor { lat: number; lng: number; actualizado: string; }
export interface MapaSeguimiento { localLat: number | null; localLng: number | null; entregaLat: number | null; entregaLng: number | null; repartidor: Repartidor | null; }
export interface PedidoReparto {
  codigo: string; estado: EstadoPedido; cliente: string; celular: string; direccion: string; barrio: string; referencia: string;
  notas: string; lat: number | null; lng: number | null; total: number; cobrar: number; productos: string;
}
export interface Reparto { domiciliario: string; tienda: string; localLat: number | null; localLng: number | null; seguimientoVivo: boolean; pedidos: PedidoReparto[]; }
export interface UbicacionDomiciliario { id: number; nombre: string; lat: number; lng: number; actualizado: string; vigente: boolean; enCamino: number; }

export interface Saturacion {
  minutosExtra: number; demoraHasta: string | null; domiciliosPausadosHasta: string | null; pedidosPausadosHasta: string | null;
}

export type AccionSaturacion = 'DEMORA' | 'PAUSAR_DOMICILIOS' | 'PAUSAR_PEDIDOS' | 'QUITAR_DEMORA' | 'REANUDAR_DOMICILIOS' | 'REANUDAR_PEDIDOS' | 'NORMAL';

// ---------- Estadísticas y cierre de caja ----------
export interface ResumenVentas {
  ventas: number; pedidos: number; ticketPromedio: number; unidades: number; ganancia: number; cobrado: number;
  porCobrar: number; cancelados: number; clientes: number; clientesNuevos: number; domicilios: number;
}
export interface ParteVentas { clave: string; nombre: string; pedidos: number; total: number; }
export interface Estadisticas {
  desde: string; hasta: string; anteriorDesde: string; anteriorHasta: string;
  actual: ResumenVentas; anterior: ResumenVentas;
  dias: { fecha: string; ventas: number; pedidos: number }[];
  productos: { nombre: string; unidades: number; ventas: number }[];
  horas: { hora: number; pedidos: number; ventas: number }[];
  semana: { dia: number; pedidos: number; ventas: number }[];
  pagos: ParteVentas[]; entrega: ParteVentas[]; origen: ParteVentas[];
}

export interface CierreCaja {
  baseInicial: number; gastos: number; notaGastos: string; efectivoContado: number; efectivoEsperado: number;
  diferencia: number; nota: string; cerradoPor: string; cerradoEn: string;
}
export interface Caja {
  fecha: string; pedidos: number; ventas: number; efectivoRecibido: number; transferencias: number; enLinea: number; porCobrar: number;
  medios: { clave: string; nombre: string; pedidos: number; recibido: number; pendiente: number }[];
  domiciliarios: { id: number; nombre: string; pedidos: number; entregados: number; efectivoACobrar: number; efectivoCobrado: number; domicilios: number }[];
  pendientes: { id: number; codigo: string; cliente: string; total: number; medio: string; estadoPago: EstadoPago; estado: EstadoPedido }[];
  cierre: CierreCaja | null; fechas: string[];
}
// ---------- Cocina y clientes ----------
export type ModoImpresion = 'APAGADA' | 'MANUAL' | 'AUTOMATICA';
export interface ConfigCocina {
  modo: ModoImpresion; momento: 'NUEVO' | 'CONFIRMADO'; esperaPago: boolean; papel: 58 | 80; copias: number; precios: boolean; pie: string;
}
export interface ClienteResumen {
  celular: string; nombre: string; pedidos: number; total: number; ticketPromedio: number; primero: string; ultimo: string;
  diasSinPedir: number; favorito: string; ultimoContacto: string | null; volvio: boolean;
}
export interface Clientes {
  resumen: { total: number; frecuentes: number; nuevosMes: number; dormidos: number; contactados: number; recuperados: number };
  lista: ClienteResumen[]; mensaje: string;
}

export interface CierreCajaForm { baseInicial: number; gastos: number; notaGastos: string; efectivoContado: number; nota: string; }

// ---------- Pagos en línea ----------
export type Proveedor = 'WOMPI' | 'BOLD';
export type Ambiente = 'PRUEBAS' | 'PRODUCCION';
export type ModalidadPago = 'APAGADO' | 'PROPIA' | 'PLATAFORMA';
export type EstadoTransaccion = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO' | 'ERROR' | 'VENCIDO';
export type Liquidacion = 'NO_APLICA' | 'POR_LIQUIDAR' | 'LIQUIDADO';

export const NOMBRE_TRANSACCION: Record<EstadoTransaccion, string> = {
  PENDIENTE: 'Esperando el pago',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Reversado',
  ERROR: 'Con error',
  VENCIDO: 'Vencido',
};

export const NOMBRE_MODALIDAD: Record<ModalidadPago, string> = {
  APAGADO: 'Apagado',
  PROPIA: 'Cuenta propia de la empresa',
  PLATAFORMA: 'Cuenta de la plataforma',
};

export interface PagoEnLineaPublico { proveedor: Proveedor; nombre: string; medios: string; }

export interface EstadoPagoEnLinea {
  proveedor: Proveedor; nombre: string; estado: EstadoTransaccion; medio: string; detalle: string;
  intentos: number; actualizado: string;
}

export interface Llaves {
  proveedor: Proveedor; ambiente: Ambiente; llavePublica: string;
  llavePrivada: string; secretoIntegridad: string; secretoEventos: string;
}

export interface LlavesGuardadas {
  proveedor: Proveedor; nombreProveedor: string; ambiente: Ambiente; llavePublica: string;
  tieneLlavePrivada: boolean; tieneSecretoIntegridad: boolean; tieneSecretoEventos: boolean;
}

export interface TotalesPagos { aprobados: number; montoAprobado: number; comisiones: number; porLiquidar: number; liquidado: number; }

export interface ConfigPagosEmpresa {
  modalidad: ModalidadPago; proveedor: Proveedor; moduloActivo: boolean; editablePorEmpresa: boolean; pausado: boolean;
  comisionPorcentaje: number; comisionFija: number; llaves: LlavesGuardadas;
  listo: boolean; motivo: string; urlEventos: string; totales: TotalesPagos;
}

export interface ConfigPagosEmpresaForm {
  modalidad: ModalidadPago; proveedor: Proveedor; editablePorEmpresa: boolean; pausado: boolean;
  comisionPorcentaje: number; comisionFija: number; llaves: Llaves | null;
}

export interface PasarelaPlataforma {
  llaves: LlavesGuardadas; activa: boolean; completa: boolean; faltante: string | null; urlEventos: string; empresasUsandola: number;
}

export interface TransaccionPago {
  uuid: string; empresa: string; empresaNombre: string; referencia: string; codigoPedido: string; proveedor: Proveedor;
  modalidad: 'PROPIA' | 'PLATAFORMA'; ambiente: Ambiente; monto: number; estado: EstadoTransaccion; medio: string; detalle: string;
  comision: number; neto: number; liquidacion: Liquidacion; creado: string; aprobado: string | null; liquidado: string | null;
  liquidadoPor: string | null; notaLiquidacion: string;
}

export interface PortalPagos { config: ConfigPagosEmpresa; recientes: TransaccionPago[]; }
export interface Recaudos { lista: TransaccionPago[]; totales: TotalesPagos; }

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
  /** Punto de entrega en el mapa (domicilio por distancia). */
  lat?: number | null; lng?: number | null;
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
  tieneComprobante: boolean; pagoReportado: string | null;
  domiciliarioNombre: string; domiciliarioCelular: string;
  /** Último intento de pago en línea (null si nunca intentó pagar en línea). */
  pagoEnLinea: EstadoPagoEnLinea | null;
  /** Mapa del pedido (null si la empresa no tiene mapas). */
  mapa: MapaSeguimiento | null;
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
  tieneComprobante: boolean; pagoReportado: string | null;
  domiciliarioId: number | null; domiciliarioNombre: string; domiciliarioCelular: string;
  entregaLat: number | null; entregaLng: number | null; distanciaKm: number | null;
}

/** token: el de su link de reparto (/reparto/{token}). */
export interface Domiciliario { id: number; nombre: string; celular: string; activo: boolean; token: string | null; }

export interface Notificacion {
  id: number; tipo: 'PEDIDO_NUEVO' | 'PAGO_REPORTADO' | 'PAGO_RECIBIDO' | 'PAGO_REVERSADO'; pedidoId: number | null; codigo: string;
  titulo: string; mensaje: string; leida: boolean; creado: string;
}

export interface Avisos { noLeidas: number; porPagar: number; porConfirmar: number; lista: Notificacion[]; }

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
  /** Solo lectura: el logo se cambia con subirLogo/quitarLogo. */
  nombre: string; eslogan: string; tituloPortada: string; mensaje: string; logoUrl: string | null;
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

// ---------- Plataforma (superadmin) ----------
export type EstadoEmpresa = 'pendiente_aprovisionamiento' | 'aprovisionando' | 'activa' | 'suspendida' | 'error_aprovisionamiento';

export const NOMBRE_ESTADO_EMPRESA: Record<EstadoEmpresa, string> = {
  pendiente_aprovisionamiento: 'En cola',
  aprovisionando: 'Preparando',
  activa: 'Activa',
  suspendida: 'Suspendida',
  error_aprovisionamiento: 'Error al preparar',
};

export interface Superadmin { uuid: string; usuario: string; nombre: string; }
export interface ModuloPlataforma { codigo: string; nombre: string; descripcion: string; esBase: boolean; }
export interface ResumenPlataforma { total: number; activas: number; suspendidas: number; enPreparacion: number; conError: number; }

export interface EmpresaResumen {
  uuid: string; identificador: string; nombreComercial: string; razonSocial: string; estado: EstadoEmpresa;
  plan: string | null; colorPrimario: string; colorSecundario: string; logoUrl: string | null;
  dominioPropio: string | null; modulos: string[]; creadoEn: string;
  cicloFacturacion: CicloFacturacion; precioPlan: number;
}

export interface EmpresaDetalle {
  uuid: string; identificador: string; razonSocial: string; nit: string | null;
  responsableNombre: string; responsableCorreo: string | null; responsableCelular: string | null;
  plan: string | null; estado: EstadoEmpresa; notas: string | null; creadoEn: string;
  nombreComercial: string; colorPrimario: string; colorSecundario: string; logoUrl: string | null;
  dominioPropio: string | null; modulos: string[];
  conexion: { host: string; puerto: number; nombreBase: string; usuarioOwner: string; usuarioApp: string; usuarioLectura: string } | null;
  versiones: { ultimaMigracionAplicada: string; aplicadaEn: string }[];
  aprovisionamiento: { estado: string; intentos: number; pasoActual: string | null; registro: string | null; actualizadoEn: string } | null;
  cicloFacturacion: CicloFacturacion; precioPlan: number;
}

export interface ActualizarEmpresa {
  razonSocial: string; nit: string; responsableNombre: string; responsableCorreo: string; responsableCelular: string;
  plan: string; cicloFacturacion: CicloFacturacion; notas: string; nombreComercial: string; colorPrimario: string; colorSecundario: string; dominioPropio: string;
}

export interface CrearEmpresa extends ActualizarEmpresa {
  identificador: string;
  modoPedido: ModoPedido; whatsapp: string; ciudad: string; direccion: string;
  tieneDomicilio: boolean; tieneRecogida: boolean; domicilioValor: number;
  modulos: string[];
  adminNombre: string; adminUsuario: string; adminClave: string;
}

// ---- Biblioteca de productos precargados (superadmin)
export interface BibOpcion { nombre: string; precioExtra: number; }
export interface BibGrupo { nombre: string; minimo: number; maximo: number; opciones: BibOpcion[]; }
export interface BibItem {
  slug: string; categoria: string; nombre: string; descripcion: string; precio: number; costo: number;
  imagen: string; etiqueta: string; filtros: string[]; grupos: BibGrupo[];
}
export interface BibCategoria { nombre: string; orden: number; cantidad: number; }
export interface Biblioteca { categorias: BibCategoria[]; filtros: string[]; productos: BibItem[]; }
export interface ResultadoBiblioteca { importados: number; omitidos: number; categoriasNuevas: number; }

// ---- Planes comerciales
export type CicloFacturacion = 'MENSUAL' | 'ANUAL';
export interface Plan {
  codigo: string; nombre: string; descripcion: string; precioMensual: number; precioAnual: number;
  modulos: string[]; activo: boolean;
}
export type PlanForm = Plan;
export type EstadoCorreo = 'ENVIADO' | 'NO_CONFIGURADO' | 'SIN_CORREO' | 'FALLO';
export interface EmpresaCreada { empresa: EmpresaDetalle; correo: EstadoCorreo; }

// ---- Correo de envío (superadmin)
export type SeguridadCorreo = 'STARTTLS' | 'SSL' | 'NINGUNA';
export interface ConfigCorreo {
  host: string; puerto: number; seguridad: SeguridadCorreo; usuario: string; tieneClave: boolean;
  remitente: string; urlPublica: string; configurado: boolean; origen: 'PANEL' | 'ENTORNO' | 'NINGUNO';
}
export interface ConfigCorreoForm {
  host: string; puerto: number; seguridad: SeguridadCorreo; usuario: string; clave: string; remitente: string; urlPublica: string;
}
export interface ResultadoPrueba { enviado: boolean; mensaje: string; }
