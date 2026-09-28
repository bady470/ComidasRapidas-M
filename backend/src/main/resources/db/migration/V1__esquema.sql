-- Leinei · esquema de la tienda (marca blanca).
-- Una instalación = un negocio. Todo lo que ve el cliente se configura desde el panel.
-- El dinero se guarda en pesos enteros.

-- Imágenes subidas desde el panel (logo y fotos de productos). Se guardan en la base
-- para que la app funcione en cualquier hosting sin disco persistente.
CREATE TABLE archivo (
    id              BIGSERIAL PRIMARY KEY,
    tipo_contenido  VARCHAR(40) NOT NULL,
    datos           BYTEA       NOT NULL,
    tamano          INTEGER     NOT NULL,
    creado          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE config_tienda (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    -- Marca
    nombre                  VARCHAR(80)  NOT NULL,
    eslogan                 VARCHAR(160) NOT NULL DEFAULT '',
    titulo_portada          VARCHAR(120) NOT NULL DEFAULT '',
    mensaje                 VARCHAR(400) NOT NULL DEFAULT '',
    logo_id                 BIGINT REFERENCES archivo(id) ON DELETE SET NULL,
    color_primario          VARCHAR(7)   NOT NULL DEFAULT '#E9A23B',
    color_secundario        VARCHAR(7)   NOT NULL DEFAULT '#3A2620',
    -- Contacto
    whatsapp                VARCHAR(20)  NOT NULL DEFAULT '',
    direccion               VARCHAR(160) NOT NULL DEFAULT '',
    ciudad                  VARCHAR(80)  NOT NULL DEFAULT '',
    instagram               VARCHAR(60)  NOT NULL DEFAULT '',
    -- Pedidos
    abierto                 BOOLEAN      NOT NULL DEFAULT TRUE,
    modo_pedido             VARCHAR(12)  NOT NULL DEFAULT 'INMEDIATO' CHECK (modo_pedido IN ('INMEDIATO','PROGRAMADO')),
    tiempo_min              SMALLINT     NOT NULL DEFAULT 30,
    tiempo_max              SMALLINT     NOT NULL DEFAULT 45,
    dia_entrega             SMALLINT     NOT NULL DEFAULT 7 CHECK (dia_entrega BETWEEN 1 AND 7),
    cierre_dias_antes       SMALLINT     NOT NULL DEFAULT 1 CHECK (cierre_dias_antes BETWEEN 0 AND 6),
    cierre_hora             SMALLINT     NOT NULL DEFAULT 21 CHECK (cierre_hora BETWEEN 0 AND 23),
    franjas                 TEXT         NOT NULL DEFAULT '',
    pedido_minimo           INTEGER      NOT NULL DEFAULT 0,
    -- Entrega
    domicilio_activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    domicilio_valor         INTEGER      NOT NULL DEFAULT 0 CHECK (domicilio_valor >= 0),
    recoger_activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Pagos
    efectivo                BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Reportes
    costo_operativo_unidad  INTEGER      NOT NULL DEFAULT 0,
    actualizado             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Horario de atención para el modo INMEDIATO. dia: 1 = lunes … 7 = domingo.
-- Si "cierra" es menor que "abre", el turno pasa la medianoche.
CREATE TABLE horario (
    dia     SMALLINT PRIMARY KEY CHECK (dia BETWEEN 1 AND 7),
    activo  BOOLEAN NOT NULL DEFAULT TRUE,
    abre    TIME    NOT NULL DEFAULT '10:00',
    cierra  TIME    NOT NULL DEFAULT '22:00'
);

-- Zonas o barrios con su valor de domicilio. Sin zonas se cobra domicilio_valor.
CREATE TABLE zona_envio (
    id      BIGSERIAL PRIMARY KEY,
    nombre  VARCHAR(80) NOT NULL,
    valor   INTEGER     NOT NULL CHECK (valor >= 0),
    activa  BOOLEAN     NOT NULL DEFAULT TRUE,
    orden   INTEGER     NOT NULL DEFAULT 0
);

-- Cuentas para transferir: Nequi, Daviplata, Bancolombia, llaves Bre-B…
CREATE TABLE cuenta_pago (
    id        BIGSERIAL PRIMARY KEY,
    entidad   VARCHAR(40) NOT NULL,
    titular   VARCHAR(80) NOT NULL,
    numero    VARCHAR(40) NOT NULL,
    activa    BOOLEAN     NOT NULL DEFAULT TRUE,
    orden     INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE categoria (
    id      BIGSERIAL PRIMARY KEY,
    nombre  VARCHAR(60) NOT NULL,
    activa  BOOLEAN     NOT NULL DEFAULT TRUE,
    orden   INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE producto (
    id            BIGSERIAL PRIMARY KEY,
    slug          VARCHAR(60)  NOT NULL UNIQUE,
    categoria_id  BIGINT REFERENCES categoria(id) ON DELETE SET NULL,
    nombre        VARCHAR(80)  NOT NULL,
    descripcion   VARCHAR(400) NOT NULL DEFAULT '',
    precio        INTEGER      NOT NULL CHECK (precio > 0),
    costo         INTEGER      NOT NULL DEFAULT 0 CHECK (costo >= 0),
    imagen_id     BIGINT REFERENCES archivo(id) ON DELETE SET NULL,
    etiqueta      VARCHAR(40)  NOT NULL DEFAULT '',
    disponible    BOOLEAN      NOT NULL DEFAULT TRUE,
    orden         INTEGER      NOT NULL DEFAULT 0,
    creado        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_producto_categoria ON producto (categoria_id);

-- Grupos de opciones de un producto: "Tamaño" (escoge 1), "Adiciones" (hasta 5), "Salsas"…
CREATE TABLE grupo_opcion (
    id           BIGSERIAL PRIMARY KEY,
    producto_id  BIGINT      NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    nombre       VARCHAR(60) NOT NULL,
    minimo       SMALLINT    NOT NULL DEFAULT 0 CHECK (minimo >= 0),
    maximo       SMALLINT    NOT NULL DEFAULT 1 CHECK (maximo >= 1),
    orden        INTEGER     NOT NULL DEFAULT 0,
    CHECK (minimo <= maximo)
);
CREATE INDEX idx_grupo_producto ON grupo_opcion (producto_id);

CREATE TABLE opcion (
    id            BIGSERIAL PRIMARY KEY,
    grupo_id      BIGINT      NOT NULL REFERENCES grupo_opcion(id) ON DELETE CASCADE,
    nombre        VARCHAR(60) NOT NULL,
    precio_extra  INTEGER     NOT NULL DEFAULT 0 CHECK (precio_extra >= 0),
    disponible    BOOLEAN     NOT NULL DEFAULT TRUE,
    orden         INTEGER     NOT NULL DEFAULT 0
);
CREATE INDEX idx_opcion_grupo ON opcion (grupo_id);

CREATE TABLE promocion (
    id           BIGSERIAL PRIMARY KEY,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  VARCHAR(300) NOT NULL DEFAULT '',
    tipo         VARCHAR(20)  NOT NULL CHECK (tipo IN ('COMBO','PORCENTAJE','PRECIO_ESPECIAL','ENVIO_GRATIS')),
    cantidad     INTEGER,
    precio       INTEGER,
    porcentaje   INTEGER CHECK (porcentaje IS NULL OR porcentaje BETWEEN 1 AND 90),
    minimo       INTEGER NOT NULL DEFAULT 0,
    producto_id  BIGINT REFERENCES producto(id) ON DELETE CASCADE,
    activa       BOOLEAN NOT NULL DEFAULT TRUE,
    destacada    BOOLEAN NOT NULL DEFAULT TRUE,
    desde        DATE,
    hasta        DATE,
    creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Productos a los que aplica un combo o un porcentaje. Sin filas = aplica a todos.
CREATE TABLE promocion_producto (
    promocion_id BIGINT NOT NULL REFERENCES promocion(id) ON DELETE CASCADE,
    producto_id  BIGINT NOT NULL REFERENCES producto(id)  ON DELETE CASCADE,
    PRIMARY KEY (promocion_id, producto_id)
);

CREATE TABLE pedido (
    id                   BIGSERIAL PRIMARY KEY,
    codigo               VARCHAR(12)  NOT NULL UNIQUE,
    creado               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    actualizado          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Día de servicio: día de entrega en modo programado, día del pedido en modo inmediato.
    fecha_entrega        DATE         NOT NULL,
    franja               VARCHAR(60)  NOT NULL DEFAULT '',
    tipo_entrega         VARCHAR(10)  NOT NULL CHECK (tipo_entrega IN ('DOMICILIO','RECOGER')),
    zona                 VARCHAR(80)  NOT NULL DEFAULT '',
    cliente_nombre       VARCHAR(80)  NOT NULL,
    cliente_celular      VARCHAR(10)  NOT NULL DEFAULT '',
    barrio               VARCHAR(80)  NOT NULL DEFAULT '',
    direccion            VARCHAR(160) NOT NULL DEFAULT '',
    referencia           VARCHAR(160) NOT NULL DEFAULT '',
    notas                VARCHAR(300) NOT NULL DEFAULT '',
    subtotal             INTEGER      NOT NULL,
    descuento            INTEGER      NOT NULL DEFAULT 0,
    promocion_aplicada   VARCHAR(80)  NOT NULL DEFAULT '',
    domicilio            INTEGER      NOT NULL DEFAULT 0,
    total                INTEGER      NOT NULL,
    costo_total          INTEGER      NOT NULL DEFAULT 0,
    metodo_pago          VARCHAR(10)  NOT NULL CHECK (metodo_pago IN ('CUENTA','EFECTIVO')),
    cuenta_entidad       VARCHAR(40)  NOT NULL DEFAULT '',
    cuenta_titular       VARCHAR(80)  NOT NULL DEFAULT '',
    cuenta_numero        VARCHAR(40)  NOT NULL DEFAULT '',
    estado_pago          VARCHAR(10)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_pago IN ('PENDIENTE','RECIBIDO')),
    estado               VARCHAR(12)  NOT NULL DEFAULT 'NUEVO'
                         CHECK (estado IN ('NUEVO','CONFIRMADO','PREPARANDO','EN_CAMINO','LISTO','ENTREGADO','CANCELADO')),
    origen               VARCHAR(10)  NOT NULL DEFAULT 'WEB' CHECK (origen IN ('WEB','WHATSAPP'))
);
CREATE INDEX idx_pedido_entrega ON pedido (fecha_entrega);
CREATE INDEX idx_pedido_estado  ON pedido (estado);

CREATE TABLE pedido_item (
    id               BIGSERIAL PRIMARY KEY,
    pedido_id        BIGINT       NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    producto_id      BIGINT       REFERENCES producto(id) ON DELETE SET NULL,
    nombre           VARCHAR(80)  NOT NULL,
    detalle          VARCHAR(400) NOT NULL DEFAULT '',
    precio_unitario  INTEGER      NOT NULL,
    costo_unitario   INTEGER      NOT NULL DEFAULT 0,
    cantidad         INTEGER      NOT NULL CHECK (cantidad > 0)
);
CREATE INDEX idx_item_pedido ON pedido_item (pedido_id);

-- Historial de estados: es lo que ve el cliente en el seguimiento.
CREATE TABLE pedido_evento (
    id         BIGSERIAL PRIMARY KEY,
    pedido_id  BIGINT       NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    estado     VARCHAR(12)  NOT NULL,
    nota       VARCHAR(200) NOT NULL DEFAULT '',
    autor      VARCHAR(80)  NOT NULL DEFAULT '',
    creado     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_evento_pedido ON pedido_evento (pedido_id);

CREATE TABLE admin_usuario (
    id         BIGSERIAL PRIMARY KEY,
    usuario    VARCHAR(40)  NOT NULL UNIQUE,
    nombre     VARCHAR(80)  NOT NULL,
    clave_hash VARCHAR(100) NOT NULL,
    activo     BOOLEAN      NOT NULL DEFAULT TRUE,
    creado     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sesiones del panel. Se guarda el hash SHA-256 del token, nunca el token.
CREATE TABLE admin_sesion (
    id          BIGSERIAL PRIMARY KEY,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    admin_id    BIGINT      NOT NULL REFERENCES admin_usuario(id) ON DELETE CASCADE,
    creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira      TIMESTAMPTZ NOT NULL
);
