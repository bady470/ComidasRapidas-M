# Leinei · plataforma de tiendas en línea para varias empresas

Una sola plataforma donde cada empresa (comidas rápidas, postres, panaderías, restaurantes, mercados…) tiene **su propia tienda en línea, su propio portal de pedidos y su propia base de datos**. El dueño de la plataforma (superadmin) crea las empresas, les activa módulos y vigila su estado. El cliente final solo ve la marca de la empresa.

| Quién | Dónde | Qué hace |
|---|---|---|
| **Cliente** | `/{empresa}` o el dominio propio de la empresa | Ve el menú, personaliza productos, pide a domicilio o para recoger, paga por transferencia o en efectivo y sigue su pedido |
| **Empresa** (administrador) | `/{empresa}/admin` | Ve y mueve los pedidos, registra pedidos por WhatsApp, arma su catálogo, promociones, horarios, domicilios, pagos y su marca |
| **Superadmin** (dueño de la plataforma) | `/superadmin` | Crea empresas, las suspende o reactiva, activa módulos, cambia su marca y dominio, restablece claves y revisa el aprovisionamiento |

La plataforma arranca **sin empresas**: la primera se crea desde `/superadmin → Nueva empresa`.

```
leinei-marca-blanca/
├── docker-compose.yml   ← Tres contenedores: db, backend y frontend
├── ejemplos/            ← Datos de ejemplo para cargar en la base de una empresa
├── backend/             ← Java 21 + Spring Boot 4.1.1 + Liquibase + PostgreSQL (Dockerfile propio)
└── frontend/            ← Angular 22 servido por Nginx: tienda, portal y superadmin (Dockerfile propio)
```

---

## 1. Arquitectura: una base de datos por empresa

```mermaid
flowchart LR
  C[Cliente] -->|/{empresa}| W[Angular]
  E[Empresa] -->|/{empresa}/admin| W
  S[Superadmin] -->|/superadmin| W
  W -->|/api/t/{empresa}/public/**| API[Spring Boot]
  W -->|/api/t/{empresa}/admin/** token de la empresa| API
  W -->|/api/plataforma/** token del superadmin| API
  API -->|empresas, marca, módulos, conexiones cifradas| CTRL[(db_leinei_control)]
  API -->|pool por empresa, rol app| DB1[(db_cliente_la_parrilla)]
  API --> DB2[(db_cliente_…)]
  PLANT[(db_leinei_plantilla)] -. CREATE DATABASE … TEMPLATE .-> DB1
```

- **`db_leinei_control`** (esquema `plataforma`): empresas, marca (nombre comercial, colores, logo, dominio propio), módulos por empresa, conexiones con claves **cifradas con AES-256-GCM**, versión del esquema de cada base, solicitudes de aprovisionamiento, superadmins y auditoría.
- **`db_leinei_plantilla`**: la estructura completa de una empresa, al día con la última migración. Nadie se conecta a ella salvo la plataforma.
- **`db_cliente_<identificador>`**: una base por empresa con los esquemas `plataforma` (auditoría), `cliente` (configuración, horarios, zonas, cuentas de pago, administradores) y `producto` (catálogo, promociones y pedidos). Nunca se usa el esquema `public`.

### Cómo se enruta cada petición

1. `EmpresaFilter` lee `/api/t/{empresa}/…`, busca la empresa en el registro (caché de 15 s sobre la base de control) y la deja en el contexto del hilo. Si no existe responde 404; si está suspendida, 403; si todavía se está preparando, 409.
2. `EnrutadorDataSource` entrega una conexión del **pool de esa empresa** (HikariCP, creado la primera vez con el rol `app` y su clave descifrada). En cada conexión se fija `leinei.usuario` para que la auditoría sepa quién hizo el cambio.
3. El token del portal se valida **en la base de esa empresa**: el token de una empresa no sirve en otra. El del superadmin se valida en la base de control.
4. Los módulos se revisan en el backend (`EmpresaContexto.exigirModulo`): si el plan no incluye un módulo, la API responde 403 aunque alguien llame directo a la ruta. El portal además oculta lo que no aplica.

### Aprovisionamiento de una empresa

Al guardar una empresa nueva, el superadmin solo crea la solicitud; un proceso en segundo plano (`ProcesoAprovisionamiento`, cada 4 s, `FOR UPDATE SKIP LOCKED`) la toma y ejecuta, con credenciales **owner**:

1. `CREATE DATABASE db_cliente_x TEMPLATE db_leinei_plantilla` (con candado para que nadie toque la plantilla mientras se clona, y reintentos).
2. Crea o renueva tres roles con claves aleatorias: `rl_x_owner` (dueño del esquema), `rl_x_app` (solo datos: SELECT/INSERT/UPDATE/DELETE) y `rl_x_lectura` (solo lectura).
3. Permisos: `REVOKE` a `PUBLIC`, permisos por esquema, privilegios por defecto y `search_path`. Ningún rol de una empresa puede entrar a otra base, ni a la de control, ni a la plantilla.
4. Siembra la tienda inicial (modo de pedido, WhatsApp, ciudad, dirección, domicilio y recogida) y su primer administrador.
5. Guarda la conexión cifrada, la versión del esquema y los módulos, y deja la empresa **activa**.

Cada paso queda en el registro que el superadmin ve en vivo en el detalle de la empresa. Si algo falla, la empresa queda en «Error al preparar» y se puede **reintentar**: todos los pasos se pueden repetir sin romper nada.

### Migraciones (Liquibase)

- `backend/src/main/resources/db/changelog/control/` → base de control.
- `backend/src/main/resources/db/changelog/empresa/` → estructura de cada empresa.

Al arrancar, `ArranquePlataforma` migra la base de control, crea y migra la plantilla, y luego **migra la base de cada empresa** existente y registra la versión aplicada. Para cambiar la estructura de las empresas se agrega un `changeSet` nuevo en `empresa/`; nunca se edita uno ya aplicado.

### Convenciones de la base

Tablas `tbl_` en plural, índices `idx_`, funciones `fn_`, triggers `trg_`. Todas las tablas tienen `id` y `uuid`; toda llave foránea tiene su índice; fechas terminan en `_en` (`creado_en`, `entrega_en`) y los booleanos empiezan por `es_` o `tiene_`.

**Auditoría inmutable:** cada cambio en tablas de negocio queda en `plataforma.tbl_auditoria` (qué tabla, qué operación, antes, después, usuario de la app y rol de base de datos). La tabla no se puede modificar, borrar ni truncar, ni siquiera por el dueño del esquema; en la base de control se omiten las claves cifradas, los hashes y el logo.

### Módulos

| Código | Qué habilita |
|---|---|
| `tienda` | Tienda, pedidos y portal (siempre incluido) |
| `opciones` | Grupos de opciones por producto (tamaños, adiciones, «sin cebolla») |
| `promociones` | Combos, porcentajes, precios especiales y domicilio gratis |
| `zonas` | Valor de domicilio por zona o barrio |
| `reportes` | Ventas del día, costos y ganancia |
| `pedido_manual` | Registrar pedidos que llegan por WhatsApp o teléfono |

### Direcciones y dominio propio

- Plataforma: `https://tu-plataforma.com/{empresa}` (tienda) y `/{empresa}/admin` (portal).
- Dominio propio: si la empresa tiene `pedidos.laparrilla.com` y ese dominio apunta al mismo servidor, la app lo reconoce al abrir (`/api/plataforma/publico/dominio`) y muestra la tienda en la raíz (`/`, `/carrito`, `/admin`).
- El carrito, los datos del cliente, los pedidos recientes y la sesión del portal se guardan **separados por empresa** en el navegador.

### Pagos por transferencia, avisos y domiciliarios

1. Si el cliente escoge transferencia, el botón dice **«Hacer pedido y pagar»**. Al confirmar ve **«Pagar pedido»**: la cuenta, el valor y un botón para **adjuntar el comprobante** (foto, captura o PDF). También puede hacerlo después desde «Mi pedido».
2. Al adjuntarlo, el pago queda **«Comprobante por revisar»** y la empresa recibe un **aviso en su portal** (con sonido y, si lo activa, notificación del navegador): «Pago reportado P-XXXX · $…».
3. En **Pedidos → Por pagar** están todos los pedidos sin pagar **de cualquier día**; no desaparecen al cambiar de día. Desde ahí: **Ver comprobante**, **Confirmar pago** o **No llegó el pago**.
4. En **Domiciliarios** se registran las personas que llevan los pedidos; en cada pedido a domicilio se escoge quién lo lleva y se le envía el pedido por WhatsApp. El cliente ve en su seguimiento quién le lleva el pedido.

Los comprobantes se guardan aparte de las fotos del menú (`producto.tbl_comprobantes_pago`) y solo los puede ver la empresa.

### Tiempo real

Todo se actualiza solo, sin recargar, con **Server-Sent Events** (`co.leinei.api.tiemporeal`):

| Canal | Quién lo escucha | Qué avisa |
|---|---|---|
| `GET /api/t/{empresa}/admin/eventos` (token) | Portal de la empresa | Pedido nuevo, cambio de estado, pago reportado o confirmado, domiciliario asignado, avisos, catálogo |
| `GET /api/t/{empresa}/public/eventos` | Tienda | Cambió un producto, un precio, una promoción, el horario o la marca |
| `GET /api/t/{empresa}/public/pedidos/{codigo}/eventos?celular=` | Seguimiento del cliente | Su pedido cambió (estado, pago, domiciliario) |
| `GET /api/plataforma/eventos` (token) | Superadmin | Empresa creada, cada paso del aprovisionamiento, cambios de estado, marca o módulos |

Por los canales solo viajan avisos pequeños (`{"id": 12, "codigo": "P-ABC234", "motivo": "pago"}`); al recibirlos, la página vuelve a pedir los datos con su sesión. Los avisos se envían después de guardar (al confirmar la transacción). El navegador se reconecta solo si se cae la conexión, y cada página muestra el indicador **«En vivo»**. Nginx sirve estas rutas sin búfer. Con varias instancias de la API detrás de un balanceador hay que reenviar los avisos entre ellas (por ejemplo con `LISTEN/NOTIFY` de PostgreSQL o Redis).

### Seguridad

- Tokens de sesión aleatorios; en la base solo se guarda su hash SHA-256. Claves con BCrypt.
- La clave de cada base de empresa se cifra con `LEINEI_LLAVE_MAESTRA`; la API nunca la devuelve.
- Precios, descuentos y disponibilidad los calcula siempre la API. El cliente nunca ve costos ni datos de otros clientes; el seguimiento pide código **y** celular.
- Imágenes PNG, JPG o WebP de hasta 2 MB, validadas por su contenido.

### Fuera del código (infraestructura recomendada en producción)

- Un pooler delante de PostgreSQL (RDS Proxy o PgBouncer) cuando haya muchas empresas.
- Base de datos en red privada / VPN, con `sslmode=verify-full` en `DB_PARAMS`.
- `LEINEI_LLAVE_MAESTRA`, credenciales owner y app en un gestor de secretos (por ejemplo AWS Secrets Manager).
- Usuario owner con `CREATEDB` y `CREATEROLE`, no superusuario; y un usuario app aparte para la base de control (`DB_APP_USER`).

---

## 2. API

Los errores llegan como `{ "status": 400, "detail": "Mensaje para mostrar" }` y el frontend muestra `detail` tal cual.

**Tienda (sin login)** — `/api/t/{empresa}/public`

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/catalogo` | Marca, disponibilidad, módulos, categorías, productos y promociones |
| POST | `/cotizar` | Total del carrito según entrega y zona |
| POST | `/pedidos` | Crea el pedido y devuelve el código |
| GET | `/pedidos/{codigo}?celular=` | Seguimiento |
| POST | `/pedidos/{codigo}/comprobante?celular=` | Adjuntar el comprobante de la transferencia (imagen o PDF, hasta 5 MB) |
| GET | `/archivos/{id}` | Foto de un producto |

**Portal de la empresa (token)** — `/api/t/{empresa}/admin`

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` · `/auth/clave` | Sesión y cambio de clave |
| GET/POST | `/auth/usuarios` | Administradores de la empresa |
| GET/POST | `/pedidos` | Lista con filtros y pedido manual (módulo `pedido_manual`) |
| PATCH | `/pedidos/{id}/estado` · `/pedidos/{id}/pago` | Estado y pago (`PENDIENTE`, `POR_CONFIRMAR`, `RECIBIDO`) |
| GET | `/pedidos?porPagar=true` | Todos los pedidos sin pagar, de cualquier día |
| GET | `/pedidos/{id}/comprobante` | Ver el comprobante que adjuntó el cliente |
| PATCH | `/pedidos/{id}/domiciliario` | Asignar o quitar el domiciliario |
| GET/POST/PUT | `/domiciliarios` | Domiciliarios (se desactivan, no se borran) |
| GET · POST | `/avisos` · `/avisos/leidos` | Avisos del portal (pedido nuevo, pago reportado) y conteo de pedidos por pagar |
| GET | `/reportes/fechas` · `/reportes/produccion?fecha=` | Días con pedidos y ventas del día (módulo `reportes`) |
| CRUD | `/categorias`, `/productos`, `/promociones` | Catálogo |
| POST | `/archivos` | Subir foto de producto |
| POST/DELETE | `/marca/logo` | Logo de la empresa |
| GET/PUT | `/config` | Configuración de la tienda (el nombre y los colores se guardan en la plataforma) |

**Superadmin (token)** — `/api/plataforma`

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` · `/auth/clave` | Sesión y cambio de clave |
| GET/POST | `/auth/superadmins` | Superadmins |
| GET | `/modulos` · `/resumen` | Catálogo de módulos y conteo de empresas por estado |
| GET/POST | `/empresas` | Lista y creación (encola el aprovisionamiento) |
| GET/PUT | `/empresas/{uuid}` | Detalle (conexión sin claves, versiones, registro) y edición |
| POST/DELETE | `/empresas/{uuid}/logo` | Logo |
| PUT | `/empresas/{uuid}/modulos` | Módulos |
| POST | `/empresas/{uuid}/suspender` · `/activar` · `/reintentar` | Estado |
| POST | `/empresas/{uuid}/clave-admin` | Clave nueva para un administrador de la empresa |

**Público de la plataforma** — `GET /api/plataforma/publico/dominio?host=` y `GET /api/plataforma/publico/empresas/{identificador}/logo`.

---

### Planes y correo de bienvenida

- **Planes:** en **Superadmin → Planes** defines cuánto cuesta cada plan por mes y por año, y qué módulos incluye (vienen Básico, Pro y Empresarial con precios de partida que puedes cambiar). Al crear una empresa eliges el plan y si paga **mensual o anual**; la empresa queda con el precio con que se contrató. API: `GET/POST /api/plataforma/planes`, `PUT /api/plataforma/planes/{codigo}`.
- **Correo de bienvenida:** al crear una empresa, si tiene correo, se le envían la dirección de su tienda y su portal, el usuario y la clave del administrador y su plan. Las credenciales del correo remitente se ingresan en **Superadmin → Correo de envío** (servidor, puerto, seguridad, usuario, contraseña, remitente y dirección pública). La contraseña se guarda **cifrada** (AES‑256‑GCM con `LEINEI_LLAVE_MAESTRA`) y nunca se vuelve a mostrar; si dejas el campo vacío al guardar, se conserva la actual. El botón **Enviar prueba** manda un correo de ensayo para confirmar que funciona. En Gmail usa una «contraseña de aplicación». API: `GET/PUT /api/plataforma/correo`, `POST /api/plataforma/correo/prueba`.
  Como respaldo, si el panel no está configurado se usan las variables de entorno `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` y `PUBLIC_URL`. Sin ninguna de las dos, no se envía nada.

- **Diseño y animaciones:** los paneles usan un marco con menú lateral y barra superior que llena todo el ancho y se adapta a celular (menú tipo cajón). Las animaciones usan GSAP (`npm install` lo instala) y se desactivan solas si el sistema pide «reducir movimiento». La tienda de cada empresa abre con una portada tipo landing (estado, tiempo de entrega, fotos de sus productos y «cómo pedir») con los colores de la empresa, y `/` es la landing de la plataforma.
- **Direcciones por correo:** el correo de bienvenida lleva dos direcciones bien separadas: la de los clientes (para publicar; con dominio propio es `https://su-dominio`) y la de ingreso al portal (`…/admin/entrar`, con usuario y clave). Si el dominio se asigna o cambia después, se avisa con un correo aparte. La página `/` solo pide el identificador y ofrece «Ver la tienda» o «Entrar a mi portal»./
- **Módulos por plan:** al elegir un plan, sus módulos se marcan solos; la lista se puede filtrar por «Del plan» y «Extras», y «Restablecer al plan» devuelve la selección original. Cambiar el plan de una empresa existente ajusta la lista y se aplica con «Guardar módulos».
- **Categorías iniciales:** toda empresa nueva trae Hamburguesas, Salchipapas, Perros calientes, Pizzas, Pollo y alitas, Combos, Acompañantes, Bebidas y Postres (las edita, oculta o borra desde su portal).
- **Valor del domicilio:** cada empresa lo cambia desde su portal (Mi tienda → Entrega), con un valor general y, si quiere, un valor distinto por zona.

### Productos precargados (biblioteca)

El superadmin tiene una biblioteca de **68 productos listos** (salchipapas, hamburguesas, perros calientes, pizzas de 10 sabores con tamaños y borde, pollo y alitas, combos, acompañantes, bebidas y postres), con precio, foto, adiciones y etiquetas. En **Productos precargados** se filtra por categoría, etiqueta (picante, vegetariano, para compartir…), precio máximo y texto; se marcan los que se quieren y se asignan a una empresa. Cada empresa recibe **su propia copia** (con su categoría y su imagen) y la edita desde su portal; repetir la asignación no duplica nada. Se puede subir o bajar todos los precios con un porcentaje.

- Datos: `backend/src/main/resources/catalogo-base/` (`catalogo.txt` + `img/*.png`). Se regeneran con `python3 herramientas/generar-biblioteca.py`.
- API: `GET /api/plataforma/biblioteca` · `POST /api/plataforma/empresas/{uuid}/biblioteca` `{slugs, ajustePorcentaje}`.
- Las imágenes son ilustraciones propias; cada empresa puede reemplazarlas por fotos reales.

## 3. Correrlo en tu computador

### Con Docker (tres contenedores)

```bash
docker compose up -d --build
```

| Contenedor | Imagen | Puerto en tu equipo | Qué hace |
|---|---|---|---|
| `leinei-db` | `postgres:17` | 5432 | Base de control, plantilla y una base por empresa |
| `leinei-backend` | `leinei-backend` (`backend/Dockerfile`) | 8081 (solo para pruebas) | API Spring Boot |
| `leinei-frontend` | `leinei-frontend` (`frontend/Dockerfile`) | **8080** | Nginx: sirve Angular y reenvía `/api/**` al backend |

El navegador solo habla con el frontend: Nginx pasa `/api/**` al contenedor del backend (variable `API_URL`, por defecto `http://backend:8080`). Así todo queda en el mismo origen y no hace falta CORS. Cada imagen se puede construir y desplegar por separado:

```bash
docker build -t leinei-backend ./backend
docker build -t leinei-frontend ./frontend
```

Abre `http://localhost:8080/superadmin` y entra con **superadmin** / **cambia-esta-clave** (cámbiala en *Mi cuenta*). Crea la primera empresa; en unos segundos queda activa y puedes abrir su tienda (`/identificador`) y su portal (`/identificador/admin`) con el administrador que definiste.

### En modo desarrollo

Necesitas **JDK 21+**, **Maven 3.9+**, **Node.js 22 LTS o más nuevo** y **Docker Desktop**.

```bash
docker compose up -d db                  # PostgreSQL con db_leinei_control
cd backend && mvn spring-boot:run        # API en http://localhost:8080
cd frontend && npm install && npm start  # app en http://localhost:4200
```

Superadmin en `http://localhost:4200/superadmin`.

**¿Venías de la versión de una sola tienda?** La estructura cambió por completo (base de control + una base por empresa). Borra la base de desarrollo y vuelve a arrancar: `docker compose down -v && docker compose up -d --build`.

### Cargar un ejemplo

Primero crea la empresa desde el superadmin (el archivo de ejemplo dice qué identificador, nombre y colores usar). Cuando esté **activa**, carga los datos en su base:

```bash
# Comidas rápidas: identificador la-parrilla
docker exec -i leinei-db psql -U leinei -d db_cliente_la_parrilla < ejemplos/comidas-rapidas.sql
# Postres con entrega programada: identificador leinei-postres
docker exec -i leinei-db psql -U leinei -d db_cliente_leinei_postres < ejemplos/leinei-postres.sql
```

Pruebas del backend: `cd backend && mvn test`.

---

## 4. Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_PARAMS` | Servidor PostgreSQL y parámetros JDBC (`sslmode=verify-full` en producción) | `localhost` / `5432` / vacío |
| `DB_CONTROL` / `DB_PLANTILLA` | Nombres de la base de control y de la plantilla | `db_leinei_control` / `db_leinei_plantilla` |
| `DB_OWNER_USER` / `DB_OWNER_PASSWORD` | Credenciales owner (crean bases y roles, corren migraciones) | `leinei` / `leinei` |
| `DB_APP_USER` / `DB_APP_PASSWORD` | Usuario solo-datos para la base de control (vacío = usa el owner) | vacío |
| `LEINEI_LLAVE_MAESTRA` | Llave con la que se cifran las claves de cada empresa. **Si se pierde, no se pueden abrir esas bases** | solo para desarrollo |
| `POOL_POR_EMPRESA` | Conexiones máximas por empresa | `4` |
| `APROVISIONAMIENTO_HABILITADO` | `false` para correr el aprovisionamiento en otra instancia | `true` |
| `SUPERADMIN_USER` / `SUPERADMIN_NAME` / `SUPERADMIN_PASSWORD` | Primer superadmin (solo si no hay ninguno) | `superadmin` / `Superadministrador` / `cambia-esta-clave` |
| `CORS_ORIGINS` | Orígenes permitidos si el frontend se sirve aparte | `http://localhost:4200` |
| `PORT` | Puerto HTTP | `8080` |

---

## 5. Siguientes pasos sugeridos

- Límite de intentos en los inicios de sesión y en el seguimiento.
- Avisos automáticos por WhatsApp cuando el pedido cambia de estado.
- Planes con precio y facturación por empresa.
- Copias de seguridad y restauración por empresa desde el superadmin.
