'use strict';

const request = require('supertest');
const { Decimal128 } = require('mongodb');
const config = require('../../src/config');
const { MongoContext } = require('../../src/db/mongoContext');
const { createApp } = require('../../src/app');

jest.setTimeout(30000);

const databaseName = process.env.MONGODB_TEST_DB || 'Restaurante_GR07_Facturacion_TEST';
let context;
let app;

function facturaFixture(id) {
  return {
    _id: id,
    fecha: new Date('2026-10-28T12:00:00.000Z'),
    estado: 'EMITIDA',
    cliente: { id_cliente: 'CLI001', nombre: 'Ana', apellido: 'Paz' },
    empleado: { id_emple: 'EPL001', nombre: 'Luis', apellido: 'Vera', cargo: 'Cajero' },
    empresa: { id_empresa: 'EMP001', nombre: 'Restaurante', ruc: '1234567890001' },
    detalleFacturas: [
      {
        plato: {
          id_plato: 'PLA001',
          nombre: 'Ceviche',
          precio: Decimal128.fromString('10.00')
        },
        cantidad: 1,
        subtotal_sin_iva: Decimal128.fromString('10.00'),
        valor_iva: Decimal128.fromString('1.50'),
        subtotal_con_iva: Decimal128.fromString('11.50'),
        tarifa_servicio: Decimal128.fromString('1.00'),
        total: Decimal128.fromString('12.50')
      }
    ]
  };
}

async function seedDatosParaEmitir() {
  await Promise.all([
    context.clientes.insertOne({
      _id: 'CLI001',
      nombre: 'Ana',
      apellido: 'Paz',
      cedula: '1234567890',
      telefono: '0990000000',
      correo: 'ana@example.com'
    }),
    context.empresas.insertOne({ _id: 'EMP001', nombre: 'Restaurante', ruc: '1234567890001' }),
    context.empleados.insertOne({
      _id: 'EPL001',
      nombre: 'Luis',
      apellido: 'Vera',
      cargo: 'Cajero'
    }),
    context.platos.insertOne({
      _id: 'PLA001',
      nombre: 'Ceviche',
      precio: Decimal128.fromString('10.00')
    })
  ]);
}

function expectApiError(response, status, code) {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({
    success: false,
    code,
    error: expect.any(String)
  });
}

beforeAll(async () => {
  if (config.isProduction) {
    throw new Error('Las pruebas de integración de facturación no deben ejecutarse en producción.');
  }

  if (!/test/i.test(databaseName)) {
    throw new Error('MONGODB_TEST_DB debe identificar una base de pruebas e incluir "test" en su nombre.');
  }

  const mongoUri = process.env.MONGODB_TEST_URI;
  if (!mongoUri) {
    throw new Error('Configura MONGODB_TEST_URI en backend/.env para conectar la base de pruebas.');
  }

  context = await MongoContext.connect(mongoUri, databaseName, {
    serverSelectionTimeoutMS: config.mongoTimeoutMs
  });
  app = createApp({ context });
}, 30000);

afterAll(async () => {
  if (!context) return;

  try {
    await Promise.all([
      context.facturas.deleteMany({}),
      context.clientes.deleteMany({}),
      context.empresas.deleteMany({}),
      context.empleados.deleteMany({}),
      context.platos.deleteMany({})
    ]);
  } finally {
    await context.close();
  }
}, 30000);

beforeEach(async () => {
  await Promise.all([
    context.facturas.deleteMany({}),
    context.clientes.deleteMany({}),
    context.empresas.deleteMany({}),
    context.empleados.deleteMany({}),
    context.platos.deleteMany({})
  ]);
});

describe('API REST de facturación con MongoDB de pruebas', () => {
  describe('casos exitosos', () => {
    test('lista facturas persistidas en MongoDB', async () => {
      await context.facturas.insertOne(facturaFixture('FAC001'));

      const response = await request(app).get('/api/v1/facturas');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({ id_factura: 'FAC001', estado: 'EMITIDA' });
    });

    test('consulta una factura persistida por su identificador', async () => {
      await context.facturas.insertOne(facturaFixture('FAC002'));

      const response = await request(app).get('/api/v1/facturas/FAC002');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ id_factura: 'FAC002', estado: 'EMITIDA' });
      expect(response.body.data.totales).toEqual({ subtotal: 10, iva: 1.5, servicio: 1, total: 12.5 });
    });

    test('emite y persiste una factura con referencias existentes', async () => {
      await seedDatosParaEmitir();

      const response = await request(app)
        .post('/api/v1/facturas')
        .send({
          idCliente: 'CLI001',
          idEmpresa: 'EMP001',
          idEmpleado: 'EPL001',
          detalles: [{ idPlato: 'PLA001', cantidad: 2 }]
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id_factura).toMatch(/^FAC\d+$/);
      const facturaPersistida = await context.facturas.findOne({ _id: response.body.data.id_factura });
      expect(facturaPersistida).toMatchObject({ estado: 'EMITIDA' });
      expect(facturaPersistida.detalleFacturas[0].total.toString()).toBe('25.00');
    });

    test('anula una factura persistida sin eliminarla', async () => {
      await context.facturas.insertOne(facturaFixture('FAC003'));

      const response = await request(app).delete('/api/v1/facturas/FAC003');
      const facturaPersistida = await context.facturas.findOne({ _id: 'FAC003' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('ANULADA');
      expect(facturaPersistida.estado).toBe('ANULADA');
    });
  });

  describe('casos de falla', () => {
    test('rechaza filtros con una fecha inválida', async () => {
      const response = await request(app).get('/api/v1/facturas?desde=no-es-fecha');

      expectApiError(response, 400, 'FECHA_DESDE_INVALIDA');
    });

    test('devuelve error al consultar una factura inexistente', async () => {
      const response = await request(app).get('/api/v1/facturas/FAC999');

      expectApiError(response, 404, 'FACTURA_NO_ENCONTRADA');
    });

    test('rechaza una emisión sin identificador de cliente', async () => {
      const response = await request(app).post('/api/v1/facturas').send({});

      expectApiError(response, 400, 'ID_CLIENTE_REQUERIDO');
    });

    test('rechaza la emisión cuando el cliente no existe en MongoDB', async () => {
      const response = await request(app)
        .post('/api/v1/facturas')
        .send({
          idCliente: 'CLI404',
          idEmpresa: 'EMP001',
          idEmpleado: 'EPL001',
          detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
        });

      expectApiError(response, 404, 'CLIENTE_NO_ENCONTRADO');
    });
  });
});
