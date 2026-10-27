# Informe del port: Restaurante_MongoDB_GR07 → RestauranteJS

## 1. Resumen ejecutivo

Se portó el sistema **Restaurante_MongoDB_GR07**, originalmente desarrollado en **ASP.NET MVC 5 con C# y MongoDB**, a una aplicación **Node.js + Express + MongoDB** ubicada en `D:\Repositorios\RepositorioClaude\RestauranteJS`.

El port conserva:

- Las rutas públicas del sistema original (`/Account/Login`, `/Home/Index`, `/Clientes`, `/Empresas/...`, `/Platos/...`, `/Facturacion/...`).
- Los nombres de las colecciones de MongoDB (`Categorias`, `Clientes`, `Platos`, `Empleados`, `Empresas`, `Facturas`).
- Los identificadores secuenciales con prefijo (`CAT###`, `CLI###`, `PLA###`, `LOC###`, `EMP###`, `FAC###`).
- Los documentos con `_id` de tipo texto y los campos monetarios guardados como `Decimal128`.
- Las reglas de facturación: IVA del 15 %, tarifa de servicio del 10 % y totales con dos decimales.
- Las vistas y la lógica de permisos por empleado.

Además se incorporaron mejoras de seguridad y robustez: tokens CSRF, regeneración de sesión al iniciar sesión, validación de archivos subidos, nombres de archivo saneados, validación de entrada en el servidor, manejo centralizado de errores y arranque controlado cuando MongoDB no está disponible.

## 2. Fuente y alcance

**Proyecto fuente:** `D:\Repositorios\RepositorioClaude\Restaurante_MongoDB_GR07\Restaurante_MongoDB_GR07`

**Proyecto destino:** `D:\Repositorios\RepositorioClaude\RestauranteJS`

Se revisaron y portaron modelos, controladores, utilidades, configuración de rutas, vistas Razor, hoja de estilos y archivos JavaScript del proyecto original. No se copiaron credenciales de MongoDB Atlas ni archivos generados por Visual Studio (`bin`, `obj`, `packages`, `.vs`).

## 3. Arquitectura resultante

```text
Navegador
   │
   ▼
Express 4
   ├─ Sesión con express-session
   ├─ CSRF por sesión
   ├─ Middleware de autenticación y permisos
   ├─ Rutas con los nombres originales
   ├─ Controladores
   ├─ Vistas EJS
   └─ MongoDB Driver 6
          │
          ▼
      MongoDB
```

Puntos de entrada:

- `server.js`: conecta a MongoDB, ejecuta el inicializador, crea la aplicación y abre el puerto.
- `src/app.js`: configura Express, archivos estáticos, sesión, CSRF, flash, helpers de vistas, rutas y errores.
- `src/routes/index.js`: concentra el mapa de rutas y el orden de los middleware.

## 4. Equivalencias entre el proyecto C# y el proyecto Node.js

### 4.1 Modelos y acceso a datos

| Elemento original (C#) | Equivalente en Node.js |
| --- | --- |
| `Models/MongoDbContext.cs` | `src/db/mongoContext.js` |
| `Models/DatabaseInitializer.cs` | `src/db/initializer.js` |
| `Models/Categoria.cs` | `src/utils/documents.js` → `mapCategoria` |
| `Models/CategoriaPlatos.cs` | `src/utils/documents.js` → `categoriasConPlatos` |
| `Models/Cliente.cs` | `src/utils/documents.js` → `mapCliente` |
| `Models/Plato.cs` | `src/utils/documents.js` → `mapPlato` |
| `Models/Empresa.cs` | `src/utils/documents.js` → `mapEmpresa` |
| `Models/Empleado.cs` | `src/utils/documents.js` → `mapEmpleado` |
| `Models/Usuario.cs` | Subdocumento `empleados.usuario` |
| `Models/Factura.cs` | `src/utils/documents.js` → `mapFactura` |
| `Models/DetalleFactura.cs` | `src/utils/documents.js` → `mapDetalleFactura` |

Los documentos siguen usando `_id` como llave primaria de texto. Los mapeadores exponen los nombres que usaban los modelos y las vistas de C#: `id_categoria`, `id_cliente`, `id_plato`, `id_empresa`, `id_emple` e `id_factura`.

### 4.2 Controladores

| Controlador original | Equivalente en Node.js |
| --- | --- |
| `Controllers/AccountController.cs` | `src/controllers/accountController.js` |
| `Controllers/HomeController.cs` | `src/controllers/homeController.js` |
| `Controllers/ClientesController.cs` | `src/controllers/clientesController.js` |
| `Controllers/EmpresasController.cs` | `src/controllers/empresasController.js` |
| `Controllers/PlatosController.cs` | `src/controllers/platosController.js` |
| `Controllers/FacturacionController.cs` | `src/controllers/facturacionController.js` |

### 4.3 Utilidades y configuración

| Elemento original | Equivalente en Node.js |
| --- | --- |
| `utils/Validaciones.cs` | `src/utils/validaciones.js` |
| `Scripts/validaciones.js` | `public/scripts/validaciones.js` |
| `utils/RequirePermisoAttribute.cs` | `src/middleware/auth.js` |
| `App_Start/RouteConfig.cs` | `src/routes/index.js` |
| `App_Start/BundleConfig.cs` | Archivos estáticos en `public/content` y `public/scripts` |
| `Web.config` (cadena de conexión) | Variables de entorno en `.env` |
| `Global.asax.cs` | `server.js` |
| `App_Data/buscar_cliente.log` | `logs/buscar_cliente.log` |
| Vistas `.cshtml` | Vistas `.ejs` |

### 4.4 Vistas

| Vista original | Vista EJS |
| --- | --- |
| `Views/Account/Login.cshtml` | `views/account/login.ejs` |
| `Views/Home/Index.cshtml` | `views/home/index.ejs` |
| `Views/Clientes/Index.cshtml` | `views/clientes/index.ejs` |
| `Views/Empresas/Index.cshtml` | `views/empresas/index.ejs` |
| `Views/Empresas/Crear.cshtml` | `views/empresas/crear.ejs` |
| `Views/Empresas/Editar.cshtml` | `views/empresas/editar.ejs` |
| `Views/Empresas/Eliminar.cshtml` | `views/empresas/eliminar.ejs` |
| `Views/Platos/Index.cshtml` | `views/platos/index.ejs` |
| `Views/Platos/Crear.cshtml` | `views/platos/crear.ejs` |
| `Views/Platos/Editar.cshtml` | `views/platos/editar.ejs` |
| `Views/Platos/Eliminar.cshtml` | `views/platos/eliminar.ejs` |
| `Views/Facturacion/Crear.cshtml` | `views/facturacion/crear.ejs` |
| `Views/Facturacion/VerFactura.cshtml` | `views/facturacion/verFactura.ejs` |
| `Views/Facturacion/FacturasGuardadas.cshtml` | `views/facturacion/facturasGuardadas.ejs` |
| `Views/Shared/_Layout.cshtml` | `views/partials/header.ejs` y `views/partials/footer.ejs` |
| `Views/Shared/Error.cshtml` | `views/error.ejs` |

## 5. Funcionalidades portadas

### 5.1 Autenticación y sesión

- Login por correo y contraseña.
- Verificación de contraseña con **bcrypt**.
- Sesión con `express-session`.
- Datos de sesión equivalentes a los del proyecto original: identificador del empleado, nombre completo, cargo, correo y permisos.
- Redirección al panel después del login.
- Cierre de sesión con destrucción de la sesión y limpieza de la cookie.
- Regeneración de la sesión al autenticarse para evitar fijación de sesión.

### 5.2 Permisos

Se portó el atributo `[RequirePermiso]` como middleware `requirePermiso(permiso)`.

- Si el usuario no está autenticado, se redirige al login.
- Si está autenticado pero no tiene el permiso, se responde con error 403.
- El permiso especial `admin` concede acceso a todos los módulos.
- La navegación del layout se construye según los permisos del usuario.

### 5.3 Inicio

- Panel principal con el nombre del empleado, su cargo y accesos directos a los módulos.
- Los accesos se muestran únicamente si el usuario tiene el permiso correspondiente.

### 5.4 Clientes

- Listado de clientes registrados.
- Vista de solo lectura, igual que el controlador original.
- Manejo de error de base de datos mostrando la lista vacía y un mensaje.

### 5.5 Empresas / locales

- Listado de locales.
- Registro con RUC, nombre comercial y logotipo.
- Edición con reemplazo opcional del logotipo.
- Eliminación con confirmación.
- Validación del RUC ecuatoriano.
- Identificadores secuenciales `LOC###`.
- Logotipos almacenados en `public/uploads/Logos` y servidos en `/Uploads/Logos/...`.
- Índice único de RUC con tolerancia a fallos si ya existen datos incompatibles.

### 5.6 Platos / menú

- Catálogo agrupado por categoría.
- Registro de platos con nombre, descripción, categoría, precio y fotografía.
- Edición y eliminación.
- Validación de precio positivo.
- Identificadores secuenciales `PLA###`.
- Fotografías almacenadas en `public/uploads/Platos` y servidas en `/Uploads/Platos/...`.
- Previsualización de la imagen antes de subirla.

### 5.7 Facturación

- Punto de venta con acordeón por categorías.
- Datos del cliente: cédula, nombre, apellido, teléfono y correo.
- Botón **Cargar Consumidor Final**.
- Búsqueda automática de cliente por cédula a los 10 dígitos, con retardo de 400 ms y spinner.
- Validación de cédula ecuatoriana y correo en el navegador.
- Selección de sucursal emisora.
- Cantidades por plato usando nombres `cantidades[<id_plato>]`, igual que el formulario original.
- Generación de factura con:
  - Subtotal sin IVA por línea.
  - IVA del 15 %.
  - Subtotal con IVA.
  - Tarifa de servicio del 10 % sobre el subtotal con IVA.
  - Total final.
- Identificadores secuenciales `FAC###`.
- Documento de factura con datos incrustados del cliente, empleado y empresa, tal como en el modelo NoSQL original.
- Vista de factura con logotipo, detalles, totales y botón de impresión.
- Historial de facturas ordenado por fecha descendente.
- Ruta `/Facturacion/Reporte` como alias del historial para conservar compatibilidad.

### 5.8 Inicialización de la base de datos

Al arrancar, el sistema:

1. Crea las colecciones si no existen: `Categorias`, `Clientes`, `Platos`, `Empleados`, `Empresas`, `Facturas`.
2. Crea índices:
   - Cédula única y dispersa en `Clientes`.
   - Cédula única y dispersa en `Empleados`.
   - RUC único y disperso en `Empresas`.
   - Índice descendente por fecha en `Facturas`.
3. Siembra el empleado administrador y el cajero si no existen.
4. Siembra las categorías iniciales `CAT001` a `CAT005` si la colección está vacía.

## 6. Compatibilidad de datos

- Los identificadores se guardan como texto en `_id`, igual que los `[BsonId]` del proyecto C#.
- Los valores monetarios se guardan como `Decimal128`.
- Al leer, `toNumber` convierte `Decimal128`, cadenas y números a `Number` para las vistas.
- Al escribir, `toDecimal128` guarda valores con dos decimales.
- Las rutas de archivos se conservan como `/Uploads/Platos/...` y `/Uploads/Logos/...`, por lo que los documentos existentes siguen funcionando.
- Las rutas estáticas `/Content/...` y `/Scripts/...` también se conservan.
- Los nombres de colecciones y de campos se mantienen.

## 7. Cambios y mejoras respecto al proyecto original

### 7.1 Arquitectura

- Se reemplazó ASP.NET MVC por Express 4.
- Se reemplazaron las vistas Razor por EJS.
- Se reemplazó `FormsAuthentication` por `express-session`.
- Se reemplazó la configuración de `Web.config` por variables de entorno.
- Se reemplazó el empaquetado de `BundleConfig` por archivos estáticos.
- Se reemplazó `Global.asax` por el arranque de `server.js`.

### 7.2 Seguridad

- **CSRF:** token por sesión incluido en todos los formularios POST y verificado en el servidor. En formularios multipart se verifica después de Multer, y si falla se elimina el archivo subido.
- **Sesión:** regeneración después del login; cookie `httpOnly`, `sameSite=lax` y `secure` en producción.
- **Contraseñas:** bcrypt, igual que el proyecto original.
- **Búsqueda de cliente:** la ruta `/Facturacion/BuscarCliente` exige autenticación (el original era `[AllowAnonymous]`).
- **Panel principal:** `/Home/Index` exige autenticación.
- **Subidas:** se validan MIME y extensión, se limitan a 5 MB y se sanean los nombres de archivo.
- **Consultas:** la cédula se escapa antes de usarla en expresiones regulares.
- **Validación en servidor:** nombre, descripción, categoría, precio, RUC, cédula, correo, cantidades y empresa.
- **Errores:** mensajes controlados sin exponer detalles internos en producción.

### 7.3 Robustez

- La aplicación inicia aunque MongoDB no esté disponible; las rutas que necesitan base de datos responden 503 con un mensaje claro.
- Se agregó tiempo máximo de espera de conexión configurable (`MONGODB_TIMEOUT_MS`).
- Se manejan errores de Multer y se eliminan archivos huérfanos cuando la validación falla.
- Se reintenta una vez la generación de un ID secuencial de factura si otro usuario insertó el mismo ID al mismo tiempo.
- La creación de índices no impide el arranque si los datos existentes son incompatibles.
- Se agregó un manejador centralizado de errores 404/403/503, con respuesta JSON para la búsqueda de cliente.
- Se agregó una comprobación de tipos en `logoSrc` para tolerar datos históricos inesperados.

### 7.4 Cálculos monetarios

- El proyecto C# usaba `decimal`, que conserva mayor precisión intermedia.
- En Node.js se normalizó el cálculo a dos decimales en cada paso (`roundMoney`) y también al sumar los detalles de la factura, para evitar errores de punto flotante como `3.4499999999999997`.
- El IVA sigue siendo del 15 % y la tarifa de servicio del 10 % sobre el subtotal con IVA.
- La vista muestra todos los valores con dos decimales.

### 7.5 Interfaz

- Se conservó el diseño con Bootstrap 5 y las clases del proyecto original.
- Se agregaron etiquetas `label` asociadas a los campos y textos `aria` en controles relevantes.
- Se ocultaron botones de creación, edición y eliminación cuando el usuario no tiene el permiso, además de la validación en el servidor.
- Se eliminaron los `console.log` de depuración del punto de venta.
- Se agregó CSS de impresión para que la factura se imprima sin navegación ni pie de página.
- Se mantuvo el botón de carga de consumidor final, el spinner y los mensajes de ayuda.

### 7.6 Archivos y configuración

- Los archivos subidos se guardan con un nombre saneado: `<ID>_<nombre>.<extensión>`.
- Se mantiene el almacenamiento en disco local, igual que el proyecto original (no se migró a GridFS).
- No se copiaron credenciales de Atlas. El archivo `.env.example` usa una conexión local por defecto.
- `.env` y `node_modules` están excluidos de Git.

## 8. Diferencias y limitaciones conocidas

1. **Almacén de sesiones:** se usa el `MemoryStore` de `express-session`. Es adecuado para desarrollo o una sola instancia, pero en producción conviene usar `connect-mongo` u otro almacén persistente.
2. **Pruebas contra MongoDB real:** el entorno de desarrollo no tenía una instancia de MongoDB disponible, por lo que la verificación se hizo con pruebas unitarias, renderizado de vistas y arranque del servidor sin base de datos. La conexión real debe validarse configurando `.env`.
3. **Sin pruebas E2E de navegador:** no se agregó Playwright/Selenium. La lógica de los scripts del navegador se revisó y se ejecutó `node --check`, pero no se automatizó un flujo completo de clic.
4. **`Facturacion/Reporte`:** el proyecto original declaraba la acción, pero no incluía una vista `Reporte.cshtml`. En el port se reutiliza la vista del historial de facturas.
5. **Nombres de archivo:** el proyecto original conservaba el nombre original del archivo subido. El port lo sanea para evitar rutas y caracteres problemáticos.
6. **Validación de RUC:** se mantiene la misma regla del proyecto original para persona natural: se valida la cédula de los primeros 10 dígitos y se acepta cualquier código de establecimiento distinto de `000`.
7. **jQuery y validación no intrusiva:** no se portaron porque las vistas del proyecto original usaban principalmente JavaScript nativo para estas pantallas.
8. **Logs:** se conserva el log de búsqueda de clientes en `logs/buscar_cliente.log`, pero no se replican los logs internos de IIS/ASP.NET.

## 9. Verificación realizada

### 9.1 Pruebas automatizadas

```text
npm.cmd test
39 pruebas ejecutadas
39 aprobadas
0 fallidas
```

Cobertura de las pruebas:

- Normalización de números, `Decimal128`, redondeo y formatos de fecha.
- Validación de cédula, RUC, correo, texto y números positivos.
- Mapeo de documentos MongoDB a objetos de vista.
- Sumatorias de factura y agrupación de platos por categoría.
- Generación y saneamiento de identificadores y nombres de archivo.
- Renderizado de todas las vistas EJS con datos de ejemplo.
- Contenido esperado en las vistas de facturación.

### 9.2 Revisión de sintaxis

```text
33 archivos JavaScript revisados con node --check
0 errores de sintaxis
```

### 9.3 Prueba de arranque y rutas

Con el servidor iniciado sin MongoDB:

- `GET /Account/Login` → 200 y token CSRF presente.
- `GET /Content/bootstrap.min.css` → 200.
- `GET /Content/site.css` → 200.
- `GET /Scripts/facturacion-pos.js` → 200.
- `GET /Home/Index` sin sesión → redirección a `/Account/Login`.
- `GET /Facturacion/Crear` sin sesión → redirección a `/Account/Login`.
- `GET /Ruta/Inexistente` → 404.

### 9.4 Dependencias

```text
npm.cmd install
98 paquetes instalados
0 vulnerabilidades reportadas por npm audit
```

## 10. Cómo ejecutar

```bash
cd D:\Repositorios\RepositorioClaude\RestauranteJS
copy .env.example .env
npm.cmd install
npm.cmd start
```

Luego abrir `http://localhost:3000`.

Credenciales iniciales:

- Administrador: `admin@restaurante.com` / `admin123`
- Cajero: `cajero@restaurante.com` / `cajero123`

Si se desea usar la base existente de MongoDB Atlas, configurar `MONGODB_URI` y `MONGODB_DB` en `.env` con las credenciales correspondientes. No se incluyeron credenciales en el código ni en la documentación.

## 11. Conclusión

El port reproduce el flujo completo del sistema original: autenticación, panel, clientes, empresas, platos y facturación con impuestos e historial. La estructura de datos se mantiene compatible con la base existente, y se añadieron controles de seguridad y manejo de errores que no estaban presentes en la versión ASP.NET MVC.

Las tareas pendientes para un despliegue productivo son externalizar las sesiones a un almacén persistente, ejecutar una prueba de integración contra la instancia real de MongoDB y, opcionalmente, agregar pruebas E2E de navegador.
