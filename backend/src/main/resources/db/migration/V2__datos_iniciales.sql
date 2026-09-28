-- Configuración inicial neutra. Cada negocio la cambia desde el panel (pestaña "Tienda").
INSERT INTO config_tienda (id, nombre, eslogan, titulo_portada, mensaje, franjas)
VALUES (1, 'Mi tienda', 'Pide en línea y recibe en casa', 'Pide en línea, fácil y rápido',
        'Escoge tus productos, dinos dónde estás y paga como prefieras.',
        E'Mañana · 9 a 12\nTarde · 2 a 6');

INSERT INTO horario (dia, activo, abre, cierra) VALUES
    (1, TRUE, '10:00', '22:00'), (2, TRUE, '10:00', '22:00'), (3, TRUE, '10:00', '22:00'),
    (4, TRUE, '10:00', '22:00'), (5, TRUE, '10:00', '23:00'), (6, TRUE, '10:00', '23:00'),
    (7, TRUE, '12:00', '21:00');
