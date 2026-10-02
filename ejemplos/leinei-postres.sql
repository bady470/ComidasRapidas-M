-- Ejemplo: Leinei · postres fríos en vaso (entrega programada los domingos).
--
-- 1. Crea la empresa desde el superadmin (/superadmin → Nueva empresa) con el identificador
--    «leinei-postres» («leinei» solo está reservado para la plataforma), nombre comercial «Leinei»,
--    colores #1D4ED8 / #0F172A y entrega programada.
-- 2. Cuando la empresa quede «Activa», carga este archivo en SU base:
--      psql -h localhost -U leinei -d db_cliente_leinei_postres -f ejemplos/leinei-postres.sql
-- Todo se puede cambiar después desde el portal (/leinei-postres/admin).

UPDATE cliente.tbl_configuraciones SET
    eslogan = 'Postres fríos en vaso · Valledupar',
    titulo_portada = 'Postres fríos en vaso, listos para el domingo',
    mensaje = 'Preparamos el sábado en la noche y entregamos el domingo bien fríos.',
    whatsapp = '3023510238',
    ciudad = 'Valledupar',
    modo_pedido = 'PROGRAMADO',
    dia_entrega = 7,          -- domingo
    cierre_dias_antes = 1,    -- sábado
    cierre_hora = 21,         -- 9:00 p. m.
    franjas = E'Mañana · 9 a 12\nTarde · 2 a 6',
    tiene_domicilio = TRUE,
    domicilio_valor = 3000,
    tiene_recogida = FALSE,
    tiene_efectivo = FALSE,
    costo_operativo_unidad = 67  -- $2.000 de gas y energía por cada 30 vasos
WHERE id = 1;

INSERT INTO cliente.tbl_cuentas_pago (entidad, titular, numero, orden) VALUES
    ('Nequi', 'Neider', '3023510238', 1),
    ('Nequi', 'Leidi',  '3238134059', 2);

INSERT INTO producto.tbl_categorias (nombre, orden) VALUES ('Postres fríos', 1);

INSERT INTO producto.tbl_productos (slug, categoria_id, nombre, descripcion, precio, costo, etiqueta, orden) VALUES
    ('mousse-de-maracuya', (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Postres fríos'), 'Mousse de maracuyá',
     'Mousse suave de maracuyá con leche condensada y crema, y salsa de maracuyá con semillas encima. Vaso de 5 oz.',
     6000, 3330, 'Fresco y ácido', 1),
    ('postre-de-oreo', (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Postres fríos'), 'Postre de Oreo',
     'Capas de galleta Oreo triturada y crema de queso, con una Oreo entera encima. Vaso de 5 oz.',
     7500, 4530, 'Por capas', 2),
    ('postre-de-milo', (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Postres fríos'), 'Postre de Milo',
     'Galletas María, crema de Milo y Milo en polvo por encima. Vaso de 5 oz.',
     6000, 3830, 'Con galletas María', 3);

INSERT INTO producto.tbl_promociones (nombre, descripcion, tipo, cantidad, precio, es_activa, es_destacada)
VALUES ('Combo 3 postres', 'Lleva 3 postres, del sabor que quieras, por $17.000.', 'COMBO', 3, 17000, TRUE, TRUE);
