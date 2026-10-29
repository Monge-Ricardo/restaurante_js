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

  // PRUEBA 1 (ÉXITO): Listar clientes devuelve status 200
  test('GET /api/v1/clientes debe retornar status 200 y formato JSON', async () => {
    const res = await request(app).get('/api/v1/clientes');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });


  // PRUEBA 2 (ÉXITO): Crear un cliente con datos válidos devuelve status 201
  test('POST /api/v1/clientes debe crear un cliente válido y retornar status 201', async () => {
    // Limpiamos por si existía de una prueba anterior
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

  // PRUEBA 3 (ÉXITO): Consultar el cliente recién creado por su ID devuelve status 200
  test('GET /api/v1/clientes/:id debe retornar status 200 para el cliente creado', async () => {
    const clienteEnBd = await context.clientes.findOne({ cedula: '1710034065' });

    const res = await request(app).get(`/api/v1/clientes/${clienteEnBd._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Juan');
  });

  // ==========================================
  // PRUEBAS DE FRACASO (3)
  // ==========================================

  // PRUEBA 4 (FRACASO): Buscar un cliente con un ID inexistente devuelve 404
  test('GET /api/v1/clientes/:id debe retornar 404 si el cliente no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/clientes/CLI_INEXISTENTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 5 (FRACASO): Intentar crear cliente con cédula inválida devuelve 400
  test('POST /api/v1/clientes debe retornar 400 si la cédula es inválida', async () => {
    const clienteInvalido = {
      nombre: 'Carlos',
      apellido: 'Lopez',
      cedula: '12345' // Cédula no válida en Ecuador
    };

    const res = await request(app).post('/api/v1/clientes').send(clienteInvalido);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // PRUEBA 6 (FRACASO): Intentar crear un cliente con cédula duplicada devuelve 409
  test('POST /api/v1/clientes debe retornar 409 si la cédula ya existe en la BD', async () => {
    const clienteDuplicado = {
      nombre: 'Juan Duplicado',
      apellido: 'Perez',
      cedula: '1710034065' // Ya insertado en la Prueba 2
    };

    const res = await request(app).post('/api/v1/clientes').send(clienteDuplicado);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

});
