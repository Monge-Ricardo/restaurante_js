// Llamar las dependencias necesarias para las pruebas
const request = require('supertest'); // Cliente HTTP para pruebas
const config = require('../../src/config');
const { createApp } = require('../../src/app');
const { MongoContext } = require('../../src/db/mongoContext');

let app;
let context;

beforeAll(async () => {
  context = await MongoContext.connect(config.mongoUri, config.mongoDbName);
  app = createApp({ context });
});

afterAll(async () => {
  if (context) {
    await context.close();
  }
});

describe('Categorias API (Conexión Real a Base de Datos)', () => {

  // ==========================================
  // PRUEBAS DE ÉXITO
  // ==========================================

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
    await context.categorias.deleteOne({ nombre: 'Postres Especiales' });

    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'Postres Especiales' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Postres Especiales');
  });

  // PRUEBA 4 (ÉXITO): Actualizar una categoría existente devuelve status 200
  test('PUT /api/v1/categorias/:id debe actualizar el nombre de la categoría y retornar status 200', async () => {
    const cat = await context.categorias.findOne({ nombre: 'Postres Especiales' });

    const res = await request(app)
      .put(`/api/v1/categorias/${cat._id}`)
      .send({ nombre: 'Postres Gourmet' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Postres Gourmet');
  });

  // PRUEBA 5 (ÉXITO): Eliminar una categoría sin platos asociados devuelve status 200
  test('DELETE /api/v1/categorias/:id debe eliminar la categoría y retornar status 200', async () => {
    const cat = await context.categorias.findOne({ nombre: 'Postres Gourmet' });

    const res = await request(app).delete(`/api/v1/categorias/${cat._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('eliminada con éxito');
  });

  // ==========================================
  // PRUEBAS DE FRACASO
  // ==========================================

  // PRUEBA 6 (FRACASO): Buscar una categoría inexistente en la BD devuelve 404
  test('GET /api/v1/categorias/:id debe retornar 404 si la categoría no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/categorias/CAT_NO_EXISTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 7 (FRACASO): Intentar registrar una categoría con nombre de 1 sola letra devuelve 400
  test('POST /api/v1/categorias debe retornar 400 si el nombre tiene menos de 2 letras', async () => {
    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'A' });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 8 (FRACASO): Intentar registrar una categoría con nombre duplicado devuelve 409
  test('POST /api/v1/categorias debe retornar 409 si el nombre ya existe en la BD', async () => {
    const res = await request(app).post('/api/v1/categorias').send({ nombre: 'Entradas' });
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 9 (FRACASO): Actualizar una categoría con ID inexistente devuelve 404
  test('PUT /api/v1/categorias/:id debe retornar 404 si la categoría a actualizar no existe', async () => {
    const res = await request(app)
      .put('/api/v1/categorias/CAT_NO_EXISTE_999')
      .send({ nombre: 'Inexistente' });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 10 (FRACASO): Actualizar una categoría con nombre inválido devuelve 400
  test('PUT /api/v1/categorias/:id debe retornar 400 si el nuevo nombre es inválido', async () => {
    const res = await request(app)
      .put('/api/v1/categorias/CAT001')
      .send({ nombre: 'A' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 11 (FRACASO): Actualizar una categoría con nombre ya existente devuelve 409
  test('PUT /api/v1/categorias/:id debe retornar 409 si el nombre ya le pertenece a otra categoría', async () => {
    const res = await request(app)
      .put('/api/v1/categorias/CAT001')
      .send({ nombre: 'Sopas' }); // 'Sopas' ya existe en CAT002

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 12 (FRACASO): Eliminar una categoría inexistente devuelve 404
  test('DELETE /api/v1/categorias/:id debe retornar 404 si la categoría no existe', async () => {
    const res = await request(app).delete('/api/v1/categorias/CAT_NO_EXISTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

});
