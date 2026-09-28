-- Ejemplo: negocio de comidas rápidas con entrega inmediata, horario, zonas de domicilio,
-- recogida en el local y productos con tamaños y adiciones.
--
-- 1. Crea la empresa desde el superadmin (/superadmin → Nueva empresa) con el identificador
--    «la-parrilla», nombre comercial «La Parrilla Express» y colores #E4572E / #1F2A36.
--    El nombre, los colores y el logo viven en la plataforma y se editan desde ahí o desde el portal.
-- 2. Cuando la empresa quede «Activa», carga este archivo en SU base (los guiones pasan a guion bajo):
--      psql -h localhost -U leinei -d db_cliente_la_parrilla -f ejemplos/comidas-rapidas.sql

UPDATE cliente.tbl_configuraciones SET
    eslogan = 'Hamburguesas y perros a la parrilla',
    titulo_portada = 'Hamburguesas a la parrilla, en tu casa en minutos',
    mensaje = 'Pide en línea, paga como quieras y síguelo hasta tu puerta.',
    whatsapp = '3001234567',
    direccion = 'Calle 16 # 9-40, local 2',
    ciudad = 'Valledupar',
    instagram = 'laparrillaexpress',
    modo_pedido = 'INMEDIATO',
    tiempo_minimo = 30,
    tiempo_maximo = 45,
    pedido_minimo = 15000,
    tiene_domicilio = TRUE,
    domicilio_valor = 4000,
    tiene_recogida = TRUE,
    tiene_efectivo = TRUE,
    costo_operativo_unidad = 300
WHERE id = 1;

-- Martes a jueves 5 p. m. a 11 p. m.; viernes y sábado hasta la 1 a. m.; domingo 4 a 10; lunes cerrado.
UPDATE cliente.tbl_horarios SET es_activo = FALSE WHERE dia = 1;
UPDATE cliente.tbl_horarios SET es_activo = TRUE, abre = '17:00', cierra = '23:00' WHERE dia IN (2, 3, 4);
UPDATE cliente.tbl_horarios SET es_activo = TRUE, abre = '17:00', cierra = '01:00' WHERE dia IN (5, 6);
UPDATE cliente.tbl_horarios SET es_activo = TRUE, abre = '16:00', cierra = '22:00' WHERE dia = 7;

INSERT INTO cliente.tbl_zonas_envio (nombre, valor, orden) VALUES
    ('Centro', 3000, 1), ('Novalito', 4000, 2), ('Los Mayales', 5000, 3), ('Villa Castro', 6000, 4);

INSERT INTO cliente.tbl_cuentas_pago (entidad, titular, numero, orden) VALUES
    ('Nequi', 'La Parrilla Express', '3001234567', 1),
    ('Bancolombia', 'La Parrilla Express SAS', 'Ahorros 123-456789-01', 2);

INSERT INTO producto.tbl_categorias (nombre, orden) VALUES ('Hamburguesas', 1), ('Perros calientes', 2), ('Acompañantes', 3), ('Bebidas', 4);

INSERT INTO producto.tbl_productos (slug, categoria_id, nombre, descripcion, precio, costo, etiqueta, orden) VALUES
    ('clasica',  (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Hamburguesas'), 'Hamburguesa clásica',
     'Carne de res a la parrilla de 150 g, queso, lechuga, tomate y salsa de la casa.', 16000, 7000, 'Más pedida', 1),
    ('doble',    (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Hamburguesas'), 'Hamburguesa doble',
     'Doble carne de 150 g, doble queso, tocineta y cebolla caramelizada.', 24000, 11000, '', 2),
    ('perro',    (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Perros calientes'), 'Perro caliente',
     'Salchicha americana, papita ripio, queso rallado y salsas.', 11000, 4500, '', 1),
    ('papas',    (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Acompañantes'), 'Papas a la francesa',
     'Porción de papas crocantes con sal de la casa.', 6000, 2000, '', 1),
    ('gaseosa',  (SELECT id FROM producto.tbl_categorias WHERE nombre = 'Bebidas'), 'Gaseosa 400 ml',
     'Coca-Cola, Colombiana o Sprite.', 4000, 2200, '', 1);

-- Opciones de la hamburguesa clásica y la doble
DO $$
DECLARE p BIGINT; g BIGINT;
BEGIN
  FOREACH p IN ARRAY ARRAY[(SELECT id FROM producto.tbl_productos WHERE slug = 'clasica'), (SELECT id FROM producto.tbl_productos WHERE slug = 'doble')] LOOP
    INSERT INTO producto.tbl_grupos_opciones (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Término de la carne', 1, 1, 1) RETURNING id INTO g;
    INSERT INTO producto.tbl_opciones (grupo_opcion_id, nombre, precio_extra, orden) VALUES (g, 'Término medio', 0, 1), (g, 'Tres cuartos', 0, 2), (g, 'Bien asada', 0, 3);

    INSERT INTO producto.tbl_grupos_opciones (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Adiciones', 0, 4, 2) RETURNING id INTO g;
    INSERT INTO producto.tbl_opciones (grupo_opcion_id, nombre, precio_extra, orden) VALUES
      (g, 'Extra queso', 2500, 1), (g, 'Tocineta', 3000, 2), (g, 'Huevo frito', 2000, 3), (g, 'Carne extra', 7000, 4);

    INSERT INTO producto.tbl_grupos_opciones (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Sin…', 0, 3, 3) RETURNING id INTO g;
    INSERT INTO producto.tbl_opciones (grupo_opcion_id, nombre, precio_extra, orden) VALUES (g, 'Sin cebolla', 0, 1), (g, 'Sin tomate', 0, 2), (g, 'Sin salsas', 0, 3);
  END LOOP;

  -- Papas: tamaño
  INSERT INTO producto.tbl_grupos_opciones (producto_id, nombre, minimo, maximo, orden)
    VALUES ((SELECT id FROM producto.tbl_productos WHERE slug = 'papas'), 'Tamaño', 1, 1, 1) RETURNING id INTO g;
  INSERT INTO producto.tbl_opciones (grupo_opcion_id, nombre, precio_extra, orden) VALUES (g, 'Personal', 0, 1), (g, 'Para compartir', 5000, 2);

  -- Gaseosa: sabor
  INSERT INTO producto.tbl_grupos_opciones (producto_id, nombre, minimo, maximo, orden)
    VALUES ((SELECT id FROM producto.tbl_productos WHERE slug = 'gaseosa'), 'Sabor', 1, 1, 1) RETURNING id INTO g;
  INSERT INTO producto.tbl_opciones (grupo_opcion_id, nombre, precio_extra, orden) VALUES (g, 'Coca-Cola', 0, 1), (g, 'Colombiana', 0, 2), (g, 'Sprite', 0, 3);
END $$;

INSERT INTO producto.tbl_promociones (nombre, descripcion, tipo, cantidad, precio, es_activa, es_destacada)
VALUES ('2 hamburguesas clásicas', 'Dos hamburguesas clásicas por $28.000. Las adiciones se cobran aparte.', 'COMBO', 2, 28000, TRUE, TRUE);
INSERT INTO producto.tbl_promociones_productos (promocion_id, producto_id)
VALUES ((SELECT id FROM producto.tbl_promociones WHERE nombre = '2 hamburguesas clásicas'), (SELECT id FROM producto.tbl_productos WHERE slug = 'clasica'));

INSERT INTO producto.tbl_promociones (nombre, descripcion, tipo, minimo, es_activa, es_destacada)
VALUES ('Domicilio gratis', 'En pedidos desde $50.000.', 'ENVIO_GRATIS', 50000, TRUE, TRUE);
