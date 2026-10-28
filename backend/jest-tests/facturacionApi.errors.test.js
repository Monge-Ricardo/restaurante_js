'use strict';

const request = require('supertest');
const { Decimal128 } = require('mongodb');
const { createApp } = require('../src/app');

function createCursor(documents = []) {
  let resultados = [...documents];

  return {
    sort(orden) {
      const [campo, direccion] = Object.entries(orden)[0];
      resultados.sort((a, b) => {
        const valorA = a[campo] instanceof Date ? a[campo].getTime() : String(a[campo]);
        const valorB = b[campo] instanceof Date ? b[campo].getTime() : String(b[campo]);
        if (valorA === valorB) return 0;
        return (valorA < valorB ? -1 : 1) * direccion;
      });
      return this;
    },
    limit(cantidad) {
      resultados = resultados.slice(0, cantidad);
      return this;
    },
    toArray: async () => resultados,
    next: async () => resultados[0] || null
  };
}

function emptyCollection(documents = []) {
  return {
    findOne: async ({ _id } = {}) => documents.find((document) => document._id === _id) || null,
    find: () => createCursor(documents),
    updateOne: async () => ({ matchedCount: 0 }),
    insertOne: async () => ({ acknowledged: true })
  };
}

function facturaFixture(id, fecha, estado = 'EMITIDA') {
  return {
    _id: id,
    fecha: new Date(fecha),
    estado,
    cliente: { id_cliente: 'CLI001', nombre: 'Ana', apellido: 'Paz' },
    empleado: { id_emple: 'EPL001', nombre: 'Luis', apellido: 'Vera' },
    empresa: { id_empresa: 'EMP001', nombre: 'Restaurante' },
    detalleFacturas: []
  };
}

function createContext(overrides = {}) {
  return {
    facturas: { ...emptyCollection(), ...overrides.facturas },
    clientes: { ...emptyCollection(), ...overrides.clientes },
    empresas: { ...emptyCollection(), ...overrides.empresas },
    empleados: { ...emptyCollection(), ...overrides.empleados },
    platos: { ...emptyCollection(), ...overrides.platos }
  };
}

function createRequest(context = createContext()) {
  return request(createApp({ context }));
}

function expectApiError(response, status, code) {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({
    success: false,
    code,
    error: expect.any(String)
  });
}

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('errores específicos de la API REST de facturación', () => {
  test('rechaza un filtro desde con formato de fecha inválido', async () => {
    const response = await createRequest().get('/api/v1/facturas?desde=no-es-fecha');

    expectApiError(response, 400, 'FECHA_DESDE_INVALIDA');
  });

  test('rechaza un filtro hasta con formato de fecha inválido', async () => {
    const response = await createRequest().get('/api/v1/facturas?hasta=no-es-fecha');

    expectApiError(response, 400, 'FECHA_HASTA_INVALIDA');
  });

  test('rechaza un rango en el que desde es posterior a hasta', async () => {
    const response = await createRequest().get(
      '/api/v1/facturas?desde=2026-10-20&hasta=2026-10-10'
    );

    expectApiError(response, 400, 'RANGO_FECHAS_INVALIDO');
  });

  test('devuelve JSON_INVALIDO para un cuerpo JSON mal formado', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .set('Content-Type', 'application/json')
      .send('{"idCliente":');

    expectApiError(response, 400, 'JSON_INVALIDO');
  });

  test('identifica una ruta API inexistente con ENDPOINT_API_NO_ENCONTRADO', async () => {
    const response = await createRequest().get('/api/v1/no-existe');

    expectApiError(response, 404, 'ENDPOINT_API_NO_ENCONTRADO');
  });

  test('devuelve FACTURA_NO_ENCONTRADA al consultar un identificador inexistente', async () => {
    const response = await createRequest().get('/api/v1/facturas/FAC999');

    expectApiError(response, 404, 'FACTURA_NO_ENCONTRADA');
  });

  test('identifica específicamente el idCliente obligatorio al emitir', async () => {
    const response = await createRequest().post('/api/v1/facturas').send({});

    expectApiError(response, 400, 'ID_CLIENTE_REQUERIDO');
  });

  test('identifica específicamente el idEmpresa obligatorio al emitir', async () => {
    const response = await createRequest().post('/api/v1/facturas').send({ idCliente: 'CLI001' });

    expectApiError(response, 400, 'ID_EMPRESA_REQUERIDO');
  });

  test('identifica específicamente el idEmpleado obligatorio al emitir', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({ idCliente: 'CLI001', idEmpresa: 'EMP001' });

    expectApiError(response, 400, 'ID_EMPLEADO_REQUERIDO');
  });

  test('rechaza una factura sin detalles con DETALLES_REQUERIDOS', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({ idCliente: 'CLI001', idEmpresa: 'EMP001', idEmpleado: 'EPL001', detalles: [] });

    expectApiError(response, 400, 'DETALLES_REQUERIDOS');
  });

  test('rechaza un elemento de detalles que no sea un objeto', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [null]
      });

    expectApiError(response, 400, 'DETALLE_INVALIDO');
  });

  test('identifica específicamente el idPlato obligatorio en un detalle', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ cantidad: 2 }]
      });

    expectApiError(response, 400, 'ID_PLATO_REQUERIDO');
  });

  test('rechaza una cantidad que no sea entero positivo', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA001', cantidad: 0 }]
      });

    expectApiError(response, 400, 'CANTIDAD_INVALIDA');
  });

  test('devuelve CLIENTE_NO_ENCONTRADO cuando el cliente no existe', async () => {
    const response = await createRequest()
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI404',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
      });

    expectApiError(response, 404, 'CLIENTE_NO_ENCONTRADO');
  });

  test('devuelve EMPRESA_NO_ENCONTRADA cuando la empresa no existe', async () => {
    const context = createContext({ clientes: { findOne: async () => ({ _id: 'CLI001' }) } });
    const response = await createRequest(context)
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP404',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
      });

    expectApiError(response, 404, 'EMPRESA_NO_ENCONTRADA');
  });

  test('devuelve EMPLEADO_NO_ENCONTRADO cuando el empleado no existe', async () => {
    const context = createContext({
      clientes: { findOne: async () => ({ _id: 'CLI001' }) },
      empresas: { findOne: async () => ({ _id: 'EMP001' }) }
    });
    const response = await createRequest(context)
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL404',
        detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
      });

    expectApiError(response, 404, 'EMPLEADO_NO_ENCONTRADO');
  });

  test('devuelve PLATO_NO_ENCONTRADO cuando un plato solicitado no existe', async () => {
    const context = createContext({
      clientes: { findOne: async () => ({ _id: 'CLI001' }) },
      empresas: { findOne: async () => ({ _id: 'EMP001' }) },
      empleados: { findOne: async () => ({ _id: 'EPL001' }) }
    });
    const response = await createRequest(context)
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA404', cantidad: 1 }]
      });

    expectApiError(response, 404, 'PLATO_NO_ENCONTRADO');
  });

  test('devuelve PRECIO_PLATO_INVALIDO si el plato tiene un precio no válido', async () => {
    const context = createContext({
      clientes: { findOne: async () => ({ _id: 'CLI001' }) },
      empresas: { findOne: async () => ({ _id: 'EMP001' }) },
      empleados: { findOne: async () => ({ _id: 'EPL001' }) },
      platos: { findOne: async () => ({ _id: 'PLA001', nombre: 'Plato', precio: -1 }) }
    });
    const response = await createRequest(context)
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA001', cantidad: 1 }]
      });

    expectApiError(response, 422, 'PRECIO_PLATO_INVALIDO');
  });

  test('devuelve FACTURA_NO_ENCONTRADA al anular una factura inexistente', async () => {
    const response = await createRequest().delete('/api/v1/facturas/FAC999');

    expectApiError(response, 404, 'FACTURA_NO_ENCONTRADA');
  });

  test('devuelve BASE_DATOS_NO_DISPONIBLE si la API no tiene conexión configurada', async () => {
    const response = await createRequest(null).get('/api/v1/facturas');

    expectApiError(response, 503, 'BASE_DATOS_NO_DISPONIBLE');
  });
});

describe('flujos exitosos de la API REST de facturación', () => {
  test('GET /facturas lista facturas en orden descendente de fecha', async () => {
    const facturas = [
      facturaFixture('FAC010', '2026-10-10T10:00:00.000Z'),
      facturaFixture('FAC011', '2026-10-12T10:00:00.000Z')
    ];
    const find = jest.fn(() => createCursor(facturas));
    const response = await createRequest(createContext({ facturas: { find } }))
      .get('/api/v1/facturas');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [
        { id_factura: 'FAC011', estado: 'EMITIDA' },
        { id_factura: 'FAC010', estado: 'EMITIDA' }
      ]
    });
    expect(find).toHaveBeenCalledWith({});
  });

  test('GET /facturas aplica un rango de fechas válido con límite superior inclusivo', async () => {
    const find = jest.fn(() => createCursor([]));
    const response = await createRequest(createContext({ facturas: { find } }))
      .get('/api/v1/facturas?desde=2026-10-10&hasta=2026-10-12');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: [] });
    expect(find).toHaveBeenCalledWith({
      fecha: {
        $gte: new Date('2026-10-10T00:00:00.000Z'),
        $lt: new Date('2026-10-13T00:00:00.000Z')
      }
    });
  });

  test('GET /facturas/:id devuelve una factura existente en JSON', async () => {
    const factura = facturaFixture('FAC012', '2026-10-12T10:00:00.000Z');
    factura.detalleFacturas = [
      {
        plato: {
          id_plato: 'PLA001',
          nombre: 'Plato de prueba',
          precio: Decimal128.fromString('10.00')
        },
        cantidad: 2,
        subtotal_sin_iva: Decimal128.fromString('20.00'),
        valor_iva: Decimal128.fromString('3.00'),
        subtotal_con_iva: Decimal128.fromString('23.00'),
        tarifa_servicio: Decimal128.fromString('2.00'),
        total: Decimal128.fromString('25.00')
      }
    ];
    const findOne = jest.fn(async ({ _id }) => (_id === factura._id ? factura : null));
    const response = await createRequest(createContext({ facturas: { findOne } }))
      .get('/api/v1/facturas/FAC012');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id_factura: 'FAC012',
        estado: 'EMITIDA',
        detalleFacturas: [
          {
            plato: { id_plato: 'PLA001', nombre: 'Plato de prueba', precio: 10 },
            cantidad: 2,
            subtotal_sin_iva: 20,
            valor_iva: 3,
            subtotal_con_iva: 23,
            tarifa_servicio: 2,
            total: 25
          }
        ],
        totales: { subtotal: 20, iva: 3, servicio: 2, total: 25 }
      }
    });
    expect(findOne).toHaveBeenCalledWith({ _id: 'FAC012' });
  });

  test('POST /facturas calcula IVA y servicio, guarda la factura y devuelve 201', async () => {
    const cliente = {
      _id: 'CLI001',
      nombre: 'Ana',
      apellido: 'Paz',
      cedula: '1234567890',
      telefono: '0990000000',
      correo: 'ana@example.com'
    };
    const empresa = { _id: 'EMP001', nombre: 'Restaurante', ruc: '1234567890001' };
    const empleado = { _id: 'EPL001', nombre: 'Luis', apellido: 'Vera', cargo: 'Cajero' };
    const plato = { _id: 'PLA001', nombre: 'Plato de prueba', precio: 10 };
    const guardadas = [];
    const insertOne = jest.fn(async (documento) => {
      guardadas.push(documento);
      return { acknowledged: true };
    });
    const context = createContext({
      facturas: {
        find: () => createCursor([{ _id: 'FAC005' }]),
        insertOne
      },
      clientes: { findOne: async ({ _id }) => (_id === cliente._id ? cliente : null) },
      empresas: { findOne: async ({ _id }) => (_id === empresa._id ? empresa : null) },
      empleados: { findOne: async ({ _id }) => (_id === empleado._id ? empleado : null) },
      platos: { findOne: async ({ _id }) => (_id === plato._id ? plato : null) }
    });
    const response = await createRequest(context)
      .post('/api/v1/facturas')
      .send({
        idCliente: 'CLI001',
        idEmpresa: 'EMP001',
        idEmpleado: 'EPL001',
        detalles: [{ idPlato: 'PLA001', cantidad: 2 }]
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id_factura: 'FAC006',
        estado: 'EMITIDA',
        detalleFacturas: [
          {
            cantidad: 2,
            subtotal_sin_iva: 20,
            valor_iva: 3,
            subtotal_con_iva: 23,
            tarifa_servicio: 2,
            total: 25
          }
        ],
        totales: { subtotal: 20, iva: 3, servicio: 2, total: 25 }
      }
    });
    expect(insertOne).toHaveBeenCalledTimes(1);
    expect(guardadas[0]._id).toBe('FAC006');
    expect(guardadas[0].detalleFacturas[0].subtotal_sin_iva.toString()).toBe('20.00');
    expect(guardadas[0].detalleFacturas[0].valor_iva.toString()).toBe('3.00');
    expect(guardadas[0].detalleFacturas[0].tarifa_servicio.toString()).toBe('2.00');
  });

  test('DELETE /facturas/:id anula una factura existente sin borrarla', async () => {
    const factura = facturaFixture('FAC013', '2026-10-12T10:00:00.000Z');
    const updateOne = jest.fn(async (_filtro, actualizacion) => {
      Object.assign(factura, actualizacion.$set);
      return { matchedCount: 1 };
    });
    const findOne = jest.fn(async ({ _id }) => (_id === factura._id ? factura : null));
    const response = await createRequest(
      createContext({ facturas: { updateOne, findOne } })
    ).delete('/api/v1/facturas/FAC013');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { id_factura: 'FAC013', estado: 'ANULADA' }
    });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'FAC013' },
      { $set: { estado: 'ANULADA' } }
    );
    expect(findOne).toHaveBeenCalledWith({ _id: 'FAC013' });
  });
});
