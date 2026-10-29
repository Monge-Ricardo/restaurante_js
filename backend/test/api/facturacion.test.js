'use strict';

const request = require('supertest');
const config = require('../../src/config');
const { MongoContext } = require('../../src/db/mongoContext');
const { createApp } = require('../../src/app');

jest.setTimeout(30000);

const databaseName = process.env.MONGODB_DB || 'Restaurante_GR07';
const coleccionesPrueba = ['facturas', 'clientes', 'empresas', 'empleados', 'platos'];
let context;
let app;

function crearFactura(id) {
  return {
    _id: id,
    fecha: new Date('2026-10-28T12:00:00.000Z'),
    estado: 'EMITIDA',
    cliente: { id_cliente: 'CLI001', nombre: 'Ana', apellido: 'Paz' },
    empleado: { id_emple: 'EMP001', nombre: 'Luis', apellido: 'Sol' },
    empresa: { id_empresa: 'EMPRESA001', nombre: 'Restaurante de prueba' },
    detalleFacturas: []
  };
}

async function limpiarDatosDePrueba() {
  await Promise.all(coleccionesPrueba.map((coleccion) => context[coleccion].deleteMany({})));
}

async function crearReferencias() {
  await Promise.all([
    context.clientes.insertOne({
      _id: 'CLI001',
      cedula: '0000000001',
      nombre: 'Ana',
      apellido: 'Paz',
      telefono: '0990000000',
      correo: 'ana@example.test'
    }),
    context.empresas.insertOne({
      _id: 'EMPRESA001',
      ruc: '0000000000001',
      nombre: 'Restaurante de prueba'
    }),
    context.empleados.insertOne({
      _id: 'EMP001',
      nombre: 'Luis',
      apellido: 'Sol',
      cargo: 'Mesero'
    }),
    context.platos.insertOne({ _id: 'PLA001', nombre: 'Plato de prueba', precio: 10 })
  ]);
}

describe('API REST de facturación', () => {
  beforeAll(async () => {
    const uri = process.env.MONGODB_URI;

    if (config.isProduction) {
      throw new Error('Las pruebas de facturación no se pueden ejecutar en producción.');
    }
    if (!uri) {
      throw new Error('Configura MONGODB_TEST_URI con la URI de MongoDB para pruebas.');
    }

    context = await MongoContext.connect(uri, databaseName);
    app = createApp({ context });
  });

  beforeEach(async () => {
    await limpiarDatosDePrueba();
  });

  afterAll(async () => {
    if (!context) return;

    try {
      await limpiarDatosDePrueba();
    } finally {
      await context.close();
    }
  });

  describe('casos exitosos', () => {
    test('lista las facturas guardadas en MongoDB', async () => {
      await context.facturas.insertOne(crearFactura('FAC001'));

      const response = await request(app).get('/api/v1/facturas');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ id_factura: 'FAC001' })])
      );
    });

    test('consulta una factura por su identificador', async () => {
      await context.facturas.insertOne(crearFactura('FAC002'));

      const response = await request(app).get('/api/v1/facturas/FAC002');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(expect.objectContaining({ id_factura: 'FAC002' }));
    });

    test('crea una factura y la guarda en MongoDB', async () => {
      await crearReferencias();

      const response = await request(app)
        .post('/api/v1/facturas')
        .send({
          idCliente: 'CLI001',
          idEmpresa: 'EMPRESA001',
          idEmpleado: 'EMP001',
          detalles: [{ idPlato: 'PLA001', cantidad: 2 }]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const guardada = await context.facturas.findOne({ _id: response.body.data.id_factura });
      expect(guardada).toEqual(expect.objectContaining({ estado: 'EMITIDA' }));
    });

    test('anula una factura existente', async () => {
      await context.facturas.insertOne(crearFactura('FAC003'));

      const response = await request(app).delete('/api/v1/facturas/FAC003');
      const guardada = await context.facturas.findOne({ _id: 'FAC003' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('ANULADA');
      expect(guardada.estado).toBe('ANULADA');
    });
  });

  describe('casos de falla', () => {
    test.each([
      ['una fecha inválida', '/api/v1/facturas?desde=no-es-fecha', 400, 'FECHA_DESDE_INVALIDA'],
      ['una factura inexistente', '/api/v1/facturas/FAC999', 404, 'FACTURA_NO_ENCONTRADA']
    ])('rechaza %s', async (_caso, ruta, estado, codigo) => {
      const response = await request(app).get(ruta);

      expect(response.status).toBe(estado);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(codigo);
    });

    test.each([
      ['el cliente requerido', {}, 'ID_CLIENTE_REQUERIDO'],
      [
        'los detalles requeridos',
        { idCliente: 'CLI001', idEmpresa: 'EMPRESA001', idEmpleado: 'EMP001', detalles: [] },
        'DETALLES_REQUERIDOS'
      ]
    ])('no crea una factura si faltan %s', async (_caso, datos, codigo) => {
      const response = await request(app).post('/api/v1/facturas').send(datos);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(codigo);
    });

    test('rechaza la creación si el cliente no existe en MongoDB', async () => {
      const response = await request(app)
        .post('/api/v1/facturas')
        .send({
          idCliente: 'CLI999',
          idEmpresa: 'EMPRESA001',
          idEmpleado: 'EMP001',
          detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('CLIENTE_NO_ENCONTRADO');
    });
  });
});
