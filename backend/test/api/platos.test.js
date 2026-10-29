// Llamar las dependencias necesarias para las pruebas
const request = require('supertest'); // Cliente HTTP para pruebas
const config = require('../../src/config');
const { createApp } = require('../../src/app');
const { MongoContext } = require('../../src/db/mongoContext');

let app;
let context;
let platoCreado;

const PLATO_PRUEBA = {
  nombre: 'Plato de Prueba Estatica',
  descripcion: 'Plato creado por las pruebas automáticas',
  precio: 4.5,
  id_categoria: 'CAT001'
};

beforeAll(async () => {
  // Conexión real a la base de datos MongoDB Atlas
  context = await MongoContext.connect(config.mongoUri, config.mongoDbName);
  app = createApp({ context });

  // Limpieza por si quedó un plato de una ejecución anterior
  await context.platos.deleteMany({ nombre: PLATO_PRUEBA.nombre });
});

afterAll(async () => {
  if (context) {
    if (platoCreado?.id_plato) {
      await context.platos.deleteOne({ _id: platoCreado.id_plato });
    }
    await context.platos.deleteMany({
      nombre: {
        $in: [
          PLATO_PRUEBA.nombre,
          'Plato de Prueba Estatica Actualizado'
        ]
      }
    });
    await context.close();
  }
});

describe('Platos API (Conexión Real a Base de Datos)', () => {

  // PRUEBA 1 (ÉXITO): Listar platos devuelve status 200
  test('GET /api/v1/platos debe retornar status 200 y formato JSON', async () => {
    const res = await request(app).get('/api/v1/platos');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // PRUEBA 2 (ÉXITO): Crear un plato con datos válidos devuelve status 201
  test('POST /api/v1/platos debe crear un plato válido y retornar status 201', async () => {
    const res = await request(app).post('/api/v1/platos').send(PLATO_PRUEBA);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe(PLATO_PRUEBA.nombre);
    expect(res.body.data.precio).toBe(PLATO_PRUEBA.precio);

    platoCreado = res.body.data;
  });

  // PRUEBA 3 (ÉXITO): Consultar el plato recién creado por su ID devuelve status 200
  test('GET /api/v1/platos/:id debe retornar status 200 para el plato creado', async () => {
    const res = await request(app).get(`/api/v1/platos/${platoCreado.id_plato}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe(PLATO_PRUEBA.nombre);
  });

  // PRUEBA 4 (ÉXITO): Actualizar el plato creado devuelve status 200
  test('PUT /api/v1/platos/:id debe actualizar el plato y retornar status 200', async () => {
    const res = await request(app)
      .put(`/api/v1/platos/${platoCreado.id_plato}`)
      .send({
        nombre: 'Plato de Prueba Estatica Actualizado',
        precio: 5.75
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Plato de Prueba Estatica Actualizado');
    expect(res.body.data.precio).toBe(5.75);
  });

  // PRUEBA 5 (ÉXITO): Eliminar el plato creado devuelve status 200
  test('DELETE /api/v1/platos/:id debe eliminar el plato y retornar status 200', async () => {
    const res = await request(app).delete(`/api/v1/platos/${platoCreado.id_plato}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('eliminado');
  });

  // ==========================================
  // PRUEBAS DE FRACASO (3)
  // ==========================================

  // PRUEBA 6 (FRACASO): Buscar un plato inexistente en la BD devuelve 404
  test('GET /api/v1/platos/:id debe retornar 404 si el plato no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/platos/PLA_NO_EXISTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 7 (FRACASO): Intentar crear un plato con precio 0 devuelve 400
  test('POST /api/v1/platos debe retornar 400 si el precio no es mayor a 0', async () => {
    const res = await request(app).post('/api/v1/platos').send({
      ...PLATO_PRUEBA,
      nombre: 'Plato con precio inválido',
      precio: 0
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.field).toBe('precio');
  });

  // PRUEBA 8 (FRACASO): Intentar crear un plato con una categoría inexistente devuelve 400
  test('POST /api/v1/platos debe retornar 400 si la categoría no existe en la BD', async () => {
    const res = await request(app).post('/api/v1/platos').send({
      ...PLATO_PRUEBA,
      nombre: 'Plato con categoría inválida',
      id_categoria: 'CAT_NO_EXISTE_999'
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.field).toBe('id_categoria');
  });

});
