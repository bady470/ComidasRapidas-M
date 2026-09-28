import { Routes } from '@angular/router';
import { soloAdmin } from './core/sesion';

// Los títulos se completan con el nombre del negocio (ver core/titulo.ts).
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./tienda/tienda-layout').then((m) => m.TiendaLayout),
    children: [
      { path: '', title: '', loadComponent: () => import('./tienda/catalogo').then((m) => m.CatalogoPage) },
      { path: 'carrito', title: 'Tu pedido', loadComponent: () => import('./tienda/carrito-page').then((m) => m.CarritoPage) },
      { path: 'pedido/:codigo', title: 'Seguimiento', loadComponent: () => import('./tienda/seguimiento').then((m) => m.SeguimientoPage) },
      { path: 'seguimiento', title: 'Seguimiento', loadComponent: () => import('./tienda/seguimiento').then((m) => m.SeguimientoPage) },
    ],
  },
  { path: 'admin/entrar', title: 'Entrar al panel', loadComponent: () => import('./admin/login').then((m) => m.LoginPage) },
  {
    path: 'admin',
    canActivate: [soloAdmin],
    loadComponent: () => import('./admin/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      { path: 'pedidos', title: 'Pedidos', loadComponent: () => import('./admin/pedidos').then((m) => m.PedidosPage) },
      { path: 'ventas', title: 'Ventas', loadComponent: () => import('./admin/produccion').then((m) => m.ProduccionPage) },
      { path: 'productos', title: 'Productos', loadComponent: () => import('./admin/productos').then((m) => m.ProductosPage) },
      { path: 'categorias', title: 'Categorías', loadComponent: () => import('./admin/categorias').then((m) => m.CategoriasPage) },
      { path: 'promociones', title: 'Promociones', loadComponent: () => import('./admin/promociones').then((m) => m.PromocionesPage) },
      { path: 'tienda', title: 'Mi tienda', loadComponent: () => import('./admin/config').then((m) => m.ConfigPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
