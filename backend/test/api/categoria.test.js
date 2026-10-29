// Llamar las dependencias necesarias para las pruebas
const request = require('supertest'); // Cliente HTTP para pruebas
const config = require('../../src/config');
const { createApp } = require('../../src/app');
const { MongoContext } = require('../../src/db/mongoContext');

let app;
let context;

beforeAll(async () => {
  // Conexión real a la base de datos MongoDB Atlas
  context = await MongoContext.connect(config.mongoUri, config.mongoDbName);
  app = createApp({ context });
});

afterAll(async () => {
  // Cerrar la conexión a la base de datos al terminar
  if (context) {
    await context.close();
  }
});

describe('Categorias API (Conexión Real a Base de Datos)', () => {

  // PRUEBA 1 (ÉXITO): Listar categorias existentes en la base de datos devuelve 200
  test('GET /api/v1/categorias debe retornar status 200 y las categorías de la BD', async () => {
    const res = await request(app).get('/api/v1/categorias');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // PRUEBA 2 (ÉXITO): Obtener una categoría existente por su ID (ej. CAT001 - Entradas) devuelve 200
  test('GET /api/v1/categorias/:id debe retornar status 200 para la categoría existente CAT001', async () => {
    const res = await request(app).get('/api/v1/categorias/CAT001');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id_categoria).toBe('CAT001');
    expect(res.body.data.nombre).toBe('Entradas');
  });

  // PRUEBA 3 (ÉXITO): Crear una nueva categoría válida devuelve status 201
  test('POST /api/v1/categorias debe registrar una nueva categoría y retornar status 201', async () => {
    // Limpiamos por si existía de ejecuciones previas
    await context.categorias.deleteOne({ nombre: 'Postres Especiales' });

    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'Postres Especiales' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Postres Especiales');

    // Limpieza posterior
    await context.categorias.deleteOne({ nombre: 'Postres Especiales' });
  });

  // ==========================================
  // PRUEBAS DE FRACASO (3)
  // ==========================================

  // PRUEBA 4 (FRACASO): Buscar una categoría inexistente en la BD devuelve 404
  test('GET /api/v1/categorias/:id debe retornar 404 si la categoría no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/categorias/CAT_NO_EXISTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 5 (FRACASO): Intentar registrar una categoría con nombre de 1 sola letra devuelve 400
  test('POST /api/v1/categorias debe retornar 400 si el nombre tiene menos de 2 letras', async () => {
    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'A' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 6 (FRACASO): Intentar registrar una categoría con nombre duplicado (ej. 'Entradas') devuelve 409
  test('POST /api/v1/categorias debe retornar 409 si el nombre ya existe en la BD', async () => {
    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'Entradas' });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

});
