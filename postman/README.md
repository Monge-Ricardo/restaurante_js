# Probar la API de facturación con Postman

## Preparación

1. Inicia el backend desde `backend` con `npm start` y confirma que aparezca el mensaje de conexión a MongoDB.
2. En Postman selecciona **Import** e importa `Facturacion.postman_collection.json`.
3. Abre las variables de la colección y confirma `baseUrl` (`http://localhost:3000`). Ajusta los IDs para que existan en la base:
   - `idCliente`: cliente existente, normalmente `CLI###`.
   - `idEmpresa`: empresa existente, normalmente `LOC###`.
   - `idEmpleado`: empleado existente, por ejemplo `EMP001`.
   - `idPlato`: plato existente, normalmente `PLA###`.
4. Envía las solicitudes en orden. **POST Emitir factura** guarda automáticamente el ID `FAC###` devuelto en `idFactura`; luego puedes consultar y anular esa factura.

## Endpoints

| Método | Endpoint | Para qué sirve | Resultado esperado |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Confirma que Express está activo. | `200`, JSON con `success: true`. |
| GET | `/api/v1/facturas` | Lista el historial. | `200`, `data` es una lista JSON. |
| GET | `/api/v1/facturas?desde=2026-01-01&hasta=2026-12-31` | Filtra por fechas ISO `YYYY-MM-DD`. | `200`, lista JSON filtrada. |
| GET | `/api/v1/facturas/:id` | Consulta una factura y sus detalles. | `200`; `404` si el ID no existe. |
| POST | `/api/v1/facturas` | Emite una factura. | `201`; `400` para cuerpo inválido, `404` si falta una referencia. |
| DELETE | `/api/v1/facturas/:id` | Anula la factura; no la borra físicamente. | `200` y `estado: "ANULADA"`; `404` si no existe. |

## Cuerpo para emitir

La colección ya incluye este cuerpo y sustituye sus valores por variables:

```json
{
  "idCliente": "CLI001",
  "idEmpresa": "LOC001",
  "idEmpleado": "EMP001",
  "detalles": [
    { "idPlato": "PLA001", "cantidad": 2 }
  ]
}
```

Usa `Content-Type: application/json`. El backend busca los registros por esos IDs, toma el precio del plato desde MongoDB y calcula subtotal, IVA (15%), servicio (10% del subtotal) y total. Los importes se guardan como `Decimal128` con dos decimales.

## Flujo recomendado

1. **GET Salud API**: confirma que el servidor responde.
2. **GET Listar facturas** o **GET Filtrar facturas por fecha**: comprueba que MongoDB responde y muestra JSON.
3. **POST Emitir factura**: crea una factura con las referencias de la colección.
4. **GET Consultar factura emitida**: usa el `FAC###` que Postman guardó automáticamente.
5. **DELETE Anular factura**: verifica que la respuesta cambie el estado a `ANULADA`.

Si una referencia no existe, Postman mostrará un `404` JSON. Puedes verificar los IDs disponibles en MongoDB Compass y actualizar las variables de la colección. No pongas la cadena de MongoDB en Postman: solo el backend la necesita en `backend/.env`.
