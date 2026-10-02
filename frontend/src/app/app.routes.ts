import { Routes } from '@angular/router';
import { esDominioPropio, esRutaDeEmpresa, fijarEmpresa } from './core/empresa';
import { soloAdmin, soloSuperadmin } from './core/sesion';

/**
 * Rutas de una empresa: su tienda y su portal de pedidos.
 * Se montan en /{empresa}/… o, en el dominio propio de la empresa, en la raíz.
 * Los títulos se completan con el nombre del negocio (ver core/titulo.ts).
 */
function rutasEmpresa(): Routes {
  return [
    // Página del domiciliario (su link personal de reparto): sin sesión, el link es la clave.
    { path: 'reparto/:token', title: 'Reparto', loadComponent: () => import('./tienda/reparto').then((m) => m.RepartoPage) },
    { path: 'admin/entrar', title: 'Entrar al portal', loadComponent: () => import('./admin/login').then((m) => m.LoginPage) },
    {
      path: 'admin',
      canActivate: [soloAdmin],
      loadComponent: () => import('./admin/admin-layout').then((m) => m.AdminLayout),
      children: [
        { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
        { path: 'pedidos', title: 'Pedidos', loadComponent: () => import('./admin/pedidos').then((m) => m.PedidosPage) },
        { path: 'estadisticas', title: 'Estadísticas', loadComponent: () => import('./admin/estadisticas').then((m) => m.EstadisticasPage) },
        { path: 'caja', title: 'Cierre de caja', loadComponent: () => import('./admin/caja').then((m) => m.CajaPage) },
        { path: 'cocina', title: 'Cocina', loadComponent: () => import('./admin/cocina').then((m) => m.CocinaPage) },
        { path: 'clientes', title: 'Clientes', loadComponent: () => import('./admin/clientes').then((m) => m.ClientesPage) },
        { path: 'ventas', title: 'Ventas', loadComponent: () => import('./admin/produccion').then((m) => m.ProduccionPage) },
        { path: 'productos', title: 'Productos', loadComponent: () => import('./admin/productos').then((m) => m.ProductosPage) },
        { path: 'categorias', title: 'Categorías', loadComponent: () => import('./admin/categorias').then((m) => m.CategoriasPage) },
        { path: 'banners', title: 'Banners', loadComponent: () => import('./admin/banners').then((m) => m.BannersPage) },
        { path: 'promociones', title: 'Promociones', loadComponent: () => import('./admin/promociones').then((m) => m.PromocionesPage) },
        { path: 'domiciliarios', title: 'Domiciliarios', loadComponent: () => import('./admin/domiciliarios').then((m) => m.DomiciliariosPage) },
        { path: 'tienda', title: 'Mi tienda', loadComponent: () => import('./admin/config').then((m) => m.ConfigPage) },
        { path: 'mapa', title: 'Domicilios y mapa', loadComponent: () => import('./admin/mapa-config').then((m) => m.MapaConfigPage) },
        { path: 'pagos-en-linea', title: 'Pagos en línea', loadComponent: () => import('./admin/pagos-en-linea').then((m) => m.PagosEnLineaPage) },
      ],
    },
    {
      path: '',
      loadComponent: () => import('./tienda/tienda-layout').then((m) => m.TiendaLayout),
      children: [
        { path: '', title: '', loadComponent: () => import('./tienda/catalogo').then((m) => m.CatalogoPage) },
        { path: 'carrito', title: 'Tu pedido', loadComponent: () => import('./tienda/carrito-page').then((m) => m.CarritoPage) },
        { path: 'pedido/:codigo', title: 'Seguimiento', loadComponent: () => import('./tienda/seguimiento').then((m) => m.SeguimientoPage) },
        { path: 'seguimiento', title: 'Seguimiento', loadComponent: () => import('./tienda/seguimiento').then((m) => m.SeguimientoPage) },
        { path: '**', redirectTo: '' },
      ],
    },
  ];
}

export const routes: Routes = [
  // Superadmin: administra todas las empresas de la plataforma.
  { path: 'superadmin/entrar', title: 'Entrar', loadComponent: () => import('./superadmin/login').then((m) => m.SuperLoginPage) },
  {
    path: 'superadmin',
    canActivate: [soloSuperadmin],
    loadComponent: () => import('./superadmin/layout').then((m) => m.SuperLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'empresas' },
      { path: 'empresas', title: 'Empresas', loadComponent: () => import('./superadmin/empresas').then((m) => m.EmpresasPage) },
      { path: 'empresas/nueva', title: 'Nueva empresa', loadComponent: () => import('./superadmin/nueva').then((m) => m.NuevaEmpresaPage) },
      { path: 'empresas/:uuid', title: 'Empresa', loadComponent: () => import('./superadmin/detalle').then((m) => m.DetalleEmpresaPage) },
      { path: 'correo', title: 'Correo de envío', loadComponent: () => import('./superadmin/correo').then((m) => m.CorreoPage) },
      { path: 'pagos', title: 'Pagos en línea', loadComponent: () => import('./superadmin/pagos').then((m) => m.PagosPage) },
      { path: 'planes', title: 'Planes', loadComponent: () => import('./superadmin/planes').then((m) => m.PlanesPage) },
      { path: 'biblioteca', title: 'Productos precargados', loadComponent: () => import('./superadmin/biblioteca').then((m) => m.BibliotecaPage) },
      { path: 'cuenta', title: 'Mi cuenta', loadComponent: () => import('./superadmin/cuenta').then((m) => m.CuentaPage) },
    ],
  },

  // Dominio propio de una empresa (pedidos.minegocio.com): tienda en la raíz.
  { path: '', canMatch: [esDominioPropio], children: rutasEmpresa() },

  // Dirección de la plataforma: /{empresa} tienda y /{empresa}/admin portal.
  { path: ':empresa', canMatch: [esRutaDeEmpresa], canActivate: [fijarEmpresa], children: rutasEmpresa() },

  // Página de inicio de la plataforma.
  { path: '', pathMatch: 'full', title: 'Inicio', loadComponent: () => import('./inicio').then((m) => m.InicioPage) },
  { path: '**', redirectTo: '' },
];
