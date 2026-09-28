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
├── docker-compose.yml   ← PostgreSQL + la app en un contenedor
├── Dockerfile           ← Construye frontend y backend en una sola imagen
├── ejemplos/            ← Datos de ejemplo para cargar en la base de una empresa
├── backend/             ← Java 21 + Spring Boot 4.1.1 + Liquibase + PostgreSQL
└── frontend/            ← Angular 22: tienda, portal de la empresa y superadmin
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
| GET | `/archivos/{id}` | Foto de un producto |

**Portal de la empresa (token)** — `/api/t/{empresa}/admin`

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` · `/auth/clave` | Sesión y cambio de clave |
| GET/POST | `/auth/usuarios` | Administradores de la empresa |
| GET/POST | `/pedidos` | Lista con filtros y pedido manual (módulo `pedido_manual`) |
| PATCH | `/pedidos/{id}/estado` · `/pedidos/{id}/pago` | Estado y pago |
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

## 3. Correrlo en tu computador

### Con Docker (todo junto)

```bash
docker compose up -d --build
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
