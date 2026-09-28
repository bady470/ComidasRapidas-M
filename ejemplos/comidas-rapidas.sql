-- Ejemplo: negocio de comidas rápidas con entrega inmediata, horario, zonas de domicilio,
-- recogida en el local y productos con tamaños y adiciones.
-- Úsalo sobre una base recién creada, después de arrancar la API una vez:
--   psql -h localhost -U leinei -d leinei -f ejemplos/comidas-rapidas.sql

UPDATE config_tienda SET
    nombre = 'La Parrilla Express',
    eslogan = 'Hamburguesas y perros a la parrilla',
    titulo_portada = 'Hamburguesas a la parrilla, en tu casa en minutos',
    mensaje = 'Pide en línea, paga como quieras y síguelo hasta tu puerta.',
    color_primario = '#E4572E',
    color_secundario = '#1F2A36',
    whatsapp = '3001234567',
    direccion = 'Calle 16 # 9-40, local 2',
    ciudad = 'Valledupar',
    instagram = 'laparrillaexpress',
    modo_pedido = 'INMEDIATO',
    tiempo_min = 30,
    tiempo_max = 45,
    pedido_minimo = 15000,
    domicilio_activo = TRUE,
    domicilio_valor = 4000,
    recoger_activo = TRUE,
    efectivo = TRUE,
    costo_operativo_unidad = 300
WHERE id = 1;

-- Martes a jueves 5 p. m. a 11 p. m.; viernes y sábado hasta la 1 a. m.; domingo 4 a 10; lunes cerrado.
UPDATE horario SET activo = FALSE WHERE dia = 1;
UPDATE horario SET activo = TRUE, abre = '17:00', cierra = '23:00' WHERE dia IN (2, 3, 4);
UPDATE horario SET activo = TRUE, abre = '17:00', cierra = '01:00' WHERE dia IN (5, 6);
UPDATE horario SET activo = TRUE, abre = '16:00', cierra = '22:00' WHERE dia = 7;

INSERT INTO zona_envio (nombre, valor, orden) VALUES
    ('Centro', 3000, 1), ('Novalito', 4000, 2), ('Los Mayales', 5000, 3), ('Villa Castro', 6000, 4);

INSERT INTO cuenta_pago (entidad, titular, numero, orden) VALUES
    ('Nequi', 'La Parrilla Express', '3001234567', 1),
    ('Bancolombia', 'La Parrilla Express SAS', 'Ahorros 123-456789-01', 2);

INSERT INTO categoria (nombre, orden) VALUES ('Hamburguesas', 1), ('Perros calientes', 2), ('Acompañantes', 3), ('Bebidas', 4);

INSERT INTO producto (slug, categoria_id, nombre, descripcion, precio, costo, etiqueta, orden) VALUES
    ('clasica',  (SELECT id FROM categoria WHERE nombre = 'Hamburguesas'), 'Hamburguesa clásica',
     'Carne de res a la parrilla de 150 g, queso, lechuga, tomate y salsa de la casa.', 16000, 7000, 'Más pedida', 1),
    ('doble',    (SELECT id FROM categoria WHERE nombre = 'Hamburguesas'), 'Hamburguesa doble',
     'Doble carne de 150 g, doble queso, tocineta y cebolla caramelizada.', 24000, 11000, '', 2),
    ('perro',    (SELECT id FROM categoria WHERE nombre = 'Perros calientes'), 'Perro caliente',
     'Salchicha americana, papita ripio, queso rallado y salsas.', 11000, 4500, '', 1),
    ('papas',    (SELECT id FROM categoria WHERE nombre = 'Acompañantes'), 'Papas a la francesa',
     'Porción de papas crocantes con sal de la casa.', 6000, 2000, '', 1),
    ('gaseosa',  (SELECT id FROM categoria WHERE nombre = 'Bebidas'), 'Gaseosa 400 ml',
     'Coca-Cola, Colombiana o Sprite.', 4000, 2200, '', 1);

-- Opciones de la hamburguesa clásica y la doble
DO $$
DECLARE p BIGINT; g BIGINT;
BEGIN
  FOREACH p IN ARRAY ARRAY[(SELECT id FROM producto WHERE slug = 'clasica'), (SELECT id FROM producto WHERE slug = 'doble')] LOOP
    INSERT INTO grupo_opcion (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Término de la carne', 1, 1, 1) RETURNING id INTO g;
    INSERT INTO opcion (grupo_id, nombre, precio_extra, orden) VALUES (g, 'Término medio', 0, 1), (g, 'Tres cuartos', 0, 2), (g, 'Bien asada', 0, 3);

    INSERT INTO grupo_opcion (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Adiciones', 0, 4, 2) RETURNING id INTO g;
    INSERT INTO opcion (grupo_id, nombre, precio_extra, orden) VALUES
      (g, 'Extra queso', 2500, 1), (g, 'Tocineta', 3000, 2), (g, 'Huevo frito', 2000, 3), (g, 'Carne extra', 7000, 4);

    INSERT INTO grupo_opcion (producto_id, nombre, minimo, maximo, orden) VALUES (p, 'Sin…', 0, 3, 3) RETURNING id INTO g;
    INSERT INTO opcion (grupo_id, nombre, precio_extra, orden) VALUES (g, 'Sin cebolla', 0, 1), (g, 'Sin tomate', 0, 2), (g, 'Sin salsas', 0, 3);
  END LOOP;

  -- Papas: tamaño
  INSERT INTO grupo_opcion (producto_id, nombre, minimo, maximo, orden)
    VALUES ((SELECT id FROM producto WHERE slug = 'papas'), 'Tamaño', 1, 1, 1) RETURNING id INTO g;
  INSERT INTO opcion (grupo_id, nombre, precio_extra, orden) VALUES (g, 'Personal', 0, 1), (g, 'Para compartir', 5000, 2);

  -- Gaseosa: sabor
  INSERT INTO grupo_opcion (producto_id, nombre, minimo, maximo, orden)
    VALUES ((SELECT id FROM producto WHERE slug = 'gaseosa'), 'Sabor', 1, 1, 1) RETURNING id INTO g;
  INSERT INTO opcion (grupo_id, nombre, precio_extra, orden) VALUES (g, 'Coca-Cola', 0, 1), (g, 'Colombiana', 0, 2), (g, 'Sprite', 0, 3);
END $$;

INSERT INTO promocion (nombre, descripcion, tipo, cantidad, precio, activa, destacada)
VALUES ('2 hamburguesas clásicas', 'Dos hamburguesas clásicas por $28.000. Las adiciones se cobran aparte.', 'COMBO', 2, 28000, TRUE, TRUE);
INSERT INTO promocion_producto (promocion_id, producto_id)
VALUES ((SELECT id FROM promocion WHERE nombre = '2 hamburguesas clásicas'), (SELECT id FROM producto WHERE slug = 'clasica'));

INSERT INTO promocion (nombre, descripcion, tipo, minimo, activa, destacada)
VALUES ('Domicilio gratis', 'En pedidos desde $50.000.', 'ENVIO_GRATIS', 50000, TRUE, TRUE);
