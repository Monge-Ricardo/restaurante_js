# RestauranteJS

Port a **Node.js + Express + MongoDB** del proyecto **Restaurante_MongoDB_GR07** (ASP.NET MVC 5 + MongoDB), conservando las rutas, los nombres de las colecciones, los identificadores secuenciales y las reglas de negocio del sistema original.

## Tecnologías

- Node.js 18 o superior
- Express 4
- MongoDB Driver 6
- EJS (vistas del servidor)
- express-session
- Multer (subida de imágenes)
- bcryptjs
- dotenv

## Requisitos

1. Node.js 18+.
2. Una instancia de MongoDB local o una cadena de conexión de MongoDB Atlas.
3. Copiar `.env.example` como `.env` y ajustar los valores.

```bash
npm.cmd install
npm.cmd start
```

La aplicación queda disponible en `http://localhost:3000` y la ruta raíz redirige al login, igual que el proyecto original.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | Cadena de conexión de MongoDB. |
| `MONGODB_DB` | `Restaurante_GR07` | Nombre de la base de datos. |
| `MONGODB_TIMEOUT_MS` | `5000` | Tiempo máximo de espera al conectar. |
| `SESSION_SECRET` | valor de desarrollo | Secreto de la cookie de sesión. Obligatorio en producción. |
| `PORT` | `3000` | Puerto HTTP. |
| `NODE_ENV` | `development` | `development` o `production`. |

> Las credenciales de MongoDB Atlas del proyecto original no se copiaron al repositorio. Configúralas en tu `.env` local.

## Usuarios sembrados

Al iniciar con una base vacía se crean automáticamente:

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `admin@restaurante.com` | `admin123` | Administrador (todos los permisos) |
| `cajero@restaurante.com` | `cajero123` | Cajero (`facturar`, `ver_reportes`) |

También se crean las colecciones, los índices y las cinco categorías iniciales (`CAT001` a `CAT005`).

## Rutas principales

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/` | Redirige a `/Account/Login`. |
| GET/POST | `/Account/Login` | Inicio y envío del formulario de acceso. |
| GET | `/Account/Logout` | Cierra la sesión. |
| GET | `/Home/Index` | Panel principal. |
| GET | `/Clientes` | Listado de clientes. |
| GET | `/Empresas` | Listado de locales. |
| GET/POST | `/Empresas/Crear` | Registrar local con logotipo. |
| GET/POST | `/Empresas/Editar/:id` | Editar local. |
| GET/POST | `/Empresas/Eliminar/:id` | Eliminar local. |
| GET | `/Platos` | Catálogo agrupado por categoría. |
| GET/POST | `/Platos/Crear` | Registrar plato con fotografía. |
| GET/POST | `/Platos/Editar/:id` | Editar plato. |
| GET/POST | `/Platos/Eliminar/:id` | Eliminar plato. |
| GET | `/Facturacion/Crear` | Punto de venta. |
| GET | `/Facturacion/BuscarCliente?cedula=...` | Búsqueda JSON de cliente. |
| POST | `/Facturacion/ProcesarSeleccion` | Genera la factura. |
| GET | `/Facturacion/VerFactura/:id` | Detalle imprimible de la factura. |
| GET | `/Facturacion/FacturasGuardadas` | Historial de facturas. |
| GET | `/Facturacion/Reporte` | Alias del historial (compatibilidad). |

## Estructura

```text
RestauranteJS/
├─ server.js                 # Arranque: conexión, inicialización y puerto
├─ src/
│  ├─ app.js                 # Configuración de Express, sesión, CSRF y helpers
│  ├─ config/                # Variables de entorno y límites de subida
│  ├─ controllers/           # Account, Home, Clientes, Empresas, Platos, Facturación
│  ├─ db/                    # Contexto MongoDB e inicializador
│  ├─ middleware/            # Auth/permisos, CSRF, flash, uploads y errores
│  ├─ routes/                # Mapa de rutas
│  └─ utils/                 # Formatos, IDs, documentos, validaciones y logs
├─ views/                    # Vistas EJS
├─ public/
│  ├─ content/               # Bootstrap y CSS propio
│  ├─ scripts/               # validaciones.js y scripts de formularios
│  └─ uploads/               # Logos y fotos de platos
└─ test/                     # Pruebas con node:test
```

## Comandos

```bash
npm.cmd start     # Servidor en modo normal
npm.cmd run dev   # Servidor con recarga automática
npm.cmd test      # Pruebas unitarias y de renderizado de vistas
```

## Documentación adicional

- [`INFORME.md`](INFORME.md): detalle del port, equivalencias con C#, cambios y verificaciones.
