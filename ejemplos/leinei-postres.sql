-- Ejemplo: Leinei · postres fríos en vaso (entrega programada los domingos).
-- Úsalo sobre una base recién creada, después de arrancar la API una vez:
--   psql -h localhost -U leinei -d leinei -f ejemplos/leinei-postres.sql
-- Todo se puede cambiar después desde el panel.

UPDATE config_tienda SET
    nombre = 'Leinei',
    eslogan = 'Postres fríos en vaso · Valledupar',
    titulo_portada = 'Postres fríos en vaso, listos para el domingo',
    mensaje = 'Preparamos el sábado en la noche y entregamos el domingo bien fríos.',
    color_primario = '#E9A23B',
    color_secundario = '#3A2620',
    whatsapp = '3023510238',
    ciudad = 'Valledupar',
    modo_pedido = 'PROGRAMADO',
    dia_entrega = 7,          -- domingo
    cierre_dias_antes = 1,    -- sábado
    cierre_hora = 21,         -- 9:00 p. m.
    franjas = E'Mañana · 9 a 12\nTarde · 2 a 6',
    domicilio_activo = TRUE,
    domicilio_valor = 3000,
    recoger_activo = FALSE,
    efectivo = FALSE,
    costo_operativo_unidad = 67  -- $2.000 de gas y energía por cada 30 vasos
WHERE id = 1;

INSERT INTO cuenta_pago (entidad, titular, numero, orden) VALUES
    ('Nequi', 'Neider', '3023510238', 1),
    ('Nequi', 'Leidi',  '3238134059', 2);

INSERT INTO categoria (nombre, orden) VALUES ('Postres fríos', 1);

INSERT INTO producto (slug, categoria_id, nombre, descripcion, precio, costo, etiqueta, orden) VALUES
    ('mousse-de-maracuya', (SELECT id FROM categoria WHERE nombre = 'Postres fríos'), 'Mousse de maracuyá',
     'Mousse suave de maracuyá con leche condensada y crema, y salsa de maracuyá con semillas encima. Vaso de 5 oz.',
     6000, 3330, 'Fresco y ácido', 1),
    ('postre-de-oreo', (SELECT id FROM categoria WHERE nombre = 'Postres fríos'), 'Postre de Oreo',
     'Capas de galleta Oreo triturada y crema de queso, con una Oreo entera encima. Vaso de 5 oz.',
     7500, 4530, 'Por capas', 2),
    ('postre-de-milo', (SELECT id FROM categoria WHERE nombre = 'Postres fríos'), 'Postre de Milo',
     'Galletas María, crema de Milo y Milo en polvo por encima. Vaso de 5 oz.',
     6000, 3830, 'Con galletas María', 3);

INSERT INTO promocion (nombre, descripcion, tipo, cantidad, precio, activa, destacada)
VALUES ('Combo 3 postres', 'Lleva 3 postres, del sabor que quieras, por $17.000.', 'COMBO', 3, 17000, TRUE, TRUE);
