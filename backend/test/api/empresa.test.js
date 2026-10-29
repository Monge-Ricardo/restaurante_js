const request = require('supertest');
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

describe('Empresas API (Conexión Real a Base de Datos)', () => {
  test('GET /api/v1/empresas debe retornar status 200 y formato JSON', async () => {
    const res = await request(app).get('/api/v1/empresas');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('POST /api/v1/empresas debe crear una empresa válida y retornar status 201', async () => {
    await context.empresas.deleteOne({ ruc: '0999999999001' });

    const nuevaEmpresa = {
      ruc: '0999999999001',
      nombre: 'Restaurante Demo'
    };

    const res = await request(app)
      .post('/api/v1/empresas')
      .field('ruc', nuevaEmpresa.ruc)
      .field('nombre', nuevaEmpresa.nombre)
      .attach('logo', Buffer.from('test'), { filename: 'logo.png', contentType: 'image/png' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ruc).toBe('0999999999001');

    const empresaEnBd = await context.empresas.findOne({ ruc: '0999999999001' });
    expect(empresaEnBd).not.toBeNull();
    expect(empresaEnBd.nombre).toBe('Restaurante Demo');
  });

  test('GET /api/v1/empresas/:id debe retornar status 200 para la empresa creada', async () => {
    const empresaEnBd = await context.empresas.findOne({ ruc: '0999999999001' });
    expect(empresaEnBd).not.toBeNull();

    const res = await request(app).get(`/api/v1/empresas/${empresaEnBd._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Restaurante Demo');
  });

  test('GET /api/v1/empresas/:id debe retornar 404 si la empresa no existe en la BD', async () => {
    const res = await request(app).get('/api/v1/empresas/LOC_INEXISTENTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/v1/empresas debe retornar 400 si falta el logo', async () => {
    const empresaInvalida = {
      ruc: '0999999999001',
      nombre: 'Restaurante Demo'
    };

    const res = await request(app).post('/api/v1/empresas').send(empresaInvalida);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('PUT /api/v1/empresas/:id debe actualizar la empresa en la BD y retornar status 200', async () => {
    const empresaEnBd = await context.empresas.findOne({ ruc: '0999999999001' });
    expect(empresaEnBd).not.toBeNull();

    const res = await request(app)
      .put(`/api/v1/empresas/${empresaEnBd._id}`)
      .field('ruc', '0999999999001')
      .field('nombre', 'Restaurante Actualizado');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nombre).toBe('Restaurante Actualizado');

    const empresaActualizada = await context.empresas.findOne({ _id: empresaEnBd._id });
    expect(empresaActualizada.nombre).toBe('Restaurante Actualizado');
  });

  test('PUT /api/v1/empresas/:id debe retornar 404 si la empresa no existe', async () => {
    const res = await request(app)
      .put('/api/v1/empresas/LOC_INEXISTENTE_999')
      .field('ruc', '0999999999001')
      .field('nombre', 'Restaurante Actualizado');

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('DELETE /api/v1/empresas/:id debe eliminar la empresa de la BD y retornar status 200', async () => {
    const empresaEnBd = await context.empresas.findOne({ ruc: '0999999999001' });
    expect(empresaEnBd).not.toBeNull();

    const res = await request(app).delete(`/api/v1/empresas/${empresaEnBd._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const empresaEliminada = await context.empresas.findOne({ _id: empresaEnBd._id });
    expect(empresaEliminada).toBeNull();
  });

  test('DELETE /api/v1/empresas/:id debe retornar 404 si la empresa no existe', async () => {
    const res = await request(app).delete('/api/v1/empresas/LOC_INEXISTENTE_999');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
