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

describe('Clientes API (Conexión Real a Base de Datos)', () => {

  // ==========================================
  // PRUEBAS DE ÉXITO
  // ==========================================

  // PRUEBA 1 (ÉXITO): Listar clientes devuelve status 200
  test('GET /api/v1/clientes debe retornar status 200 y formato JSON', async () => {
    const res = await request(app).get('/api/v1/clientes');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // PRUEBA 2 (ÉXITO): Listar clientes filtrando por cédula en query param
  test('GET /api/v1/clientes?cedula=... debe filtrar y retornar status 200', async () => {
    const res = await request(app).get('/api/v1/clientes?cedula=1710034065');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // PRUEBA 3 (ÉXITO): Crear un cliente con datos válidos devuelve status 201
  test('POST /api/v1/clientes debe crear un cliente válido y retornar status 201', async () => {
    await context.clientes.deleteOne({ cedula: '1710034065' });

    const nuevoCliente = {
      nombre: 'Juan',
      apellido: 'Perez',
      cedula: '1710034065',
      telefono: '0991234567',
      correo: 'juan.perez@test.com'
    };

    const res = await request(app).post('/api/v1/clientes').send(nuevoCliente);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cedula).toBe('1710034065');
  });

  // PRUEBA 4 (ÉXITO): Consultar el cliente por su ID devuelve status 200
  test('GET /api/v1/clientes/:id debe retornar status 200 para el cliente creado', async () => {
    const clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });

    const res = await request(app).get(`/api/v1/clientes/${clienteEnBd._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Juan');
  });

  // PRUEBA 5 (ÉXITO): Actualizar un cliente existente devuelve status 200
  test('PUT /api/v1/clientes/:id debe actualizar los datos del cliente y retornar status 200', async () => {
    const clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });

    const res = await request(app)
      .put(`/api/v1/clientes/${clienteEnBd._id}`)
      .send({ nombre: 'Juan Modificado', telefono: '0999999999' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Juan Modificado');
  });

  // PRUEBA 6 (ÉXITO): Eliminar un cliente existente devuelve status 200
  test('DELETE /api/v1/clientes/:id debe eliminar el cliente y retornar status 200', async () => {
    const clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });

    const res = await request(app).delete(`/api/v1/clientes/${clienteEnBd._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('eliminado con éxito');
  });

  // ==========================================
  // PRUEBAS DE FRACASO
  // ==========================================

  // PRUEBA 7 (FRACASO): Buscar un cliente con un ID inexistente devuelve 404
  test('GET /api/v1/clientes/:id debe retornar 404 si el cliente no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/clientes/CLI_INEXISTENTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 8 (FRACASO): Intentar crear cliente con cédula inválida devuelve 400
  test('POST /api/v1/clientes debe retornar 400 si la cédula es inválida', async () => {
    const clienteInvalido = {
      nombre: 'Carlos',
      apellido: 'Lopez',
      cedula: '12345'
    };

    const res = await request(app).post('/api/v1/clientes').send(clienteInvalido);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 9 (FRACASO): Intentar crear un cliente con cédula duplicada devuelve 409
  test('POST /api/v1/clientes debe retornar 409 si la cédula ya existe en la BD', async () => {
    // Primero aseguramos que exista
    await context.clientes.deleteOne({ cedula: '1710034065' });
    await request(app).post('/api/v1/clientes').send({
      nombre: 'Base',
      apellido: 'Test',
      cedula: '1710034065'
    });

    // Intentamos duplicar
    const res = await request(app).post('/api/v1/clientes').send({
      nombre: 'Duplicado',
      apellido: 'Test',
      cedula: '1710034065'
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 10 (FRACASO): Actualizar con ID inexistente devuelve 404
  test('PUT /api/v1/clientes/:id debe retornar 404 si el cliente a editar no existe', async () => {
    const res = await request(app)
      .put('/api/v1/clientes/CLI_NO_EXISTE_999')
      .send({ nombre: 'Test' });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 11 (FRACASO): Actualizar con datos inválidos devuelve 400
  test('PUT /api/v1/clientes/:id debe retornar 400 si los nuevos datos son inválidos', async () => {
    // Aseguramos que el cliente exista en BD
    let clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });
    if (!clienteEnBd) {
      await request(app).post('/api/v1/clientes').send({
        nombre: 'Juan',
        apellido: 'Perez',
        cedula: '1710034065'
      });
      clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });
    }

    const res = await request(app)
      .put(`/api/v1/clientes/${clienteEnBd._id}`)
      .send({ cedula: '999_INVALIDA' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 12 (FRACASO): Eliminar un cliente con ID inexistente devuelve 404
  test('DELETE /api/v1/clientes/:id debe retornar 404 si el cliente a eliminar no existe', async () => {
    const res = await request(app).delete('/api/v1/clientes/CLI_NO_EXISTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

});
