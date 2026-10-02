import { ConfigCocina, PedidoAdmin } from './modelos';

/**
 * Comanda para impresora térmica (58 u 80 mm). Se imprime desde el navegador con un iframe oculto: no hace falta
 * instalar nada. Si Chrome se abre con la opción --kiosk-printing, imprime directo sin mostrar el diálogo.
 */

const PESOS = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const HORA = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const DIA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function e(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function pago(p: PedidoAdmin): string {
  if (p.estadoPago === 'RECIBIDO') return `PAGADO · ${p.metodoPago === 'EFECTIVO' ? 'efectivo' : p.metodoPago === 'EN_LINEA' ? 'en línea' : e(p.cuentaEntidad)}`;
  if (p.metodoPago === 'EFECTIVO') return `COBRAR ${PESOS.format(p.total)} EN EFECTIVO`;
  if (p.metodoPago === 'EN_LINEA') return 'PAGO EN LÍNEA (sin confirmar)';
  return `TRANSFERENCIA ${e(p.cuentaEntidad)} (${p.estadoPago === 'POR_CONFIRMAR' ? 'comprobante por revisar' : 'sin pagar'})`;
}

/** HTML de una copia de la comanda. */
function copia(p: PedidoAdmin, cfg: ConfigCocina, tienda: string, numero: number, total: number, programado: boolean): string {
  const items = p.items.map((i) => `
    <div class="item"><b>${i.cantidad} ×</b> <b>${e(i.nombre)}</b>${cfg.precios ? `<span class="der">${PESOS.format(i.precioUnitario * i.cantidad)}</span>` : ''}
      ${i.detalle ? `<div class="det">${e(i.detalle)}</div>` : ''}</div>`).join('');
  const entrega = p.tipoEntrega === 'DOMICILIO'
    ? `<div class="bloque">DOMICILIO</div>
       <div>${e(p.direccion)}${p.zona || p.barrio ? ', ' + e(p.zona || p.barrio) : ''}</div>
       ${p.referencia ? `<div class="det">${e(p.referencia)}</div>` : ''}
       ${p.domiciliarioNombre ? `<div>Lleva: <b>${e(p.domiciliarioNombre)}</b></div>` : ''}`
    : `<div class="bloque">RECOGE EN EL LOCAL</div>`;
  const totales = cfg.precios ? `
    <div class="linea"></div>
    ${p.descuento ? `<div>${e(p.promocion) || 'Descuento'}<span class="der">−${PESOS.format(p.descuento)}</span></div>` : ''}
    ${p.tipoEntrega === 'DOMICILIO' ? `<div>Domicilio<span class="der">${PESOS.format(p.domicilio)}</span></div>` : ''}
    <div class="total">TOTAL<span class="der">${PESOS.format(p.total)}</span></div>` : '';
  return `
  <section${numero > 1 ? ' class="salto"' : ''}>
    <div class="centro tienda">${e(tienda)}</div>
    <div class="centro codigo">${e(p.codigo)}</div>
    <div class="centro">${HORA.format(new Date(p.creado))}${p.origen === 'WHATSAPP' ? ' · WhatsApp' : ' · Tienda en línea'}${total > 1 ? ` · copia ${numero} de ${total}` : ''}</div>
    ${programado ? `<div class="centro"><b>Entrega: ${DIA.format(new Date(p.fechaEntrega + 'T12:00:00Z'))}${p.franja ? ' · ' + e(p.franja) : ''}</b></div>` : ''}
    <div class="linea"></div>
    <div><b>${e(p.clienteNombre)}</b>${p.clienteCelular ? ' · ' + e(p.clienteCelular) : ''}</div>
    ${entrega}
    <div class="linea"></div>
    ${items}
    ${p.notas ? `<div class="nota">NOTA: ${e(p.notas)}</div>` : ''}
    ${totales}
    <div class="pago">${pago(p)}</div>
    ${cfg.pie ? `<div class="centro pie">${e(cfg.pie)}</div>` : ''}
  </section>`;
}

/** Documento completo (todas las copias) listo para imprimir. */
export function htmlComanda(p: PedidoAdmin, cfg: ConfigCocina, tienda: string, programado = false): string {
  const ancho = cfg.papel === 58 ? 48 : 72;          // área imprimible en mm
  const letra = cfg.papel === 58 ? 11 : 13;
  const copias = Array.from({ length: Math.max(1, Math.min(3, cfg.copias)) }, (_, i) => copia(p, cfg, tienda, i + 1, cfg.copias, programado)).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comanda ${e(p.codigo)}</title><style>
    @page { size: ${cfg.papel}mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body { margin: 0; width: ${ancho}mm; font: 600 ${letra}px/1.35 ui-monospace, 'Courier New', monospace; color: #000; }
    .centro { text-align: center; }
    .tienda { font-size: ${letra + 2}px; font-weight: 800; }
    .codigo { font-size: ${letra + 12}px; font-weight: 900; letter-spacing: .04em; margin: 2px 0; }
    .linea { border-top: 1px dashed #000; margin: 5px 0; }
    .bloque { margin: 4px 0 2px; padding: 2px 4px; background: #000; color: #fff; font-weight: 900; text-align: center; }
    .item { margin: 3px 0; font-size: ${letra + 1}px; }
    .det { font-weight: 500; padding-left: 10px; font-size: ${letra - 1}px; }
    .der { float: right; }
    .nota { margin: 6px 0; padding: 4px; border: 2px solid #000; font-weight: 800; }
    .total { font-size: ${letra + 3}px; font-weight: 900; margin-top: 3px; }
    .pago { margin-top: 6px; padding: 3px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; text-align: center; font-weight: 900; }
    .pie { margin-top: 6px; font-weight: 500; }
    .salto { break-before: page; page-break-before: always; }
  </style></head><body>${copias}</body></html>`;
}

/** Imprime la comanda sin abrir otra ventana. */
export function imprimirComanda(p: PedidoAdmin, cfg: ConfigCocina, tienda: string, programado = false): void {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  Object.assign(marco.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' });
  document.body.appendChild(marco);
  const doc = marco.contentDocument!;
  doc.open();
  doc.write(htmlComanda(p, cfg, tienda, programado));
  doc.close();
  const quitar = () => setTimeout(() => marco.remove(), 1000);
  marco.contentWindow!.addEventListener('afterprint', quitar);
  setTimeout(() => marco.remove(), 120_000); // por si el navegador no avisa al terminar
  // Un momento para que el navegador arme el documento antes de imprimir.
  setTimeout(() => { marco.contentWindow!.focus(); marco.contentWindow!.print(); }, 150);
}
