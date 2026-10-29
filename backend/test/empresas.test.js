'use strict';

const empresasApiController = require('../src/controllers/api/EmpresasApiController');

describe('API Empresas', () => {
  test('GET /empresas retorna 200', async () => {
    const store = new Map([['LOC001', { _id: 'LOC001', ruc: '0999999999001', nombre: 'Restaurante Demo', logo: '/Uploads/Logos/LOC001.png' }]]);
    const context = {
      empresas: {
        find: () => ({ sort: () => ({ toArray: async () => Array.from(store.values()).map(d => ({ ...d })) }) })
      }
    };
    const req = { app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.list(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /empresas/:id retorna 200', async () => {
    const store = new Map([['LOC001', { _id: 'LOC001', ruc: '0999999999001', nombre: 'Restaurante Demo', logo: '/Uploads/Logos/LOC001.png' }]]);
    const context = { empresas: { findOne: async (f) => store.get(f._id) ? { ...store.get(f._id) } : null } };
    const req = { params: { id: 'LOC001' }, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.getById(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /empresas crea y guarda en MongoDB', async () => {
    const store = new Map();
    const context = {
      empresas: {
        find: (f, o) => {
          if (o && o.projection) return { sort: () => ({ limit: () => ({ next: async () => null }) }) };
          return { sort: () => ({ toArray: async () => [] }) };
        },
        findOne: async (f) => (f && f._id ? (store.get(f._id) ? { ...store.get(f._id) } : null) : null),
        insertOne: async (d) => { store.set(d._id, { ...d }); return { acknowledged: true }; }
      }
    };
    const req = { body: { ruc: '0999999999001', nombre: 'Restaurante Demo' }, file: { filename: 'LOC001.png' }, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.create(req, res, next);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(store.has('LOC001')).toBe(true);
    expect(store.get('LOC001').nombre).toBe('Restaurante Demo');
  });

  test('POST /empresas sin logo retorna 400', async () => {
    const store = new Map();
    const context = {
      empresas: {
        find: (f, o) => {
          if (o && o.projection) return { sort: () => ({ limit: () => ({ next: async () => null }) }) };
          return { sort: () => ({ toArray: async () => [] }) };
        },
        findOne: async () => null,
        insertOne: async (d) => { store.set(d._id, { ...d }); return { acknowledged: true }; }
      }
    };
    const req = { body: { ruc: '0999999999001', nombre: 'Restaurante Demo' }, file: null, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.create(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /empresas/:id no existe retorna 404', async () => {
    const context = { empresas: { findOne: async () => null } };
    const req = { params: { id: 'LOC999' }, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn((e) => { res._err = e; });
    await empresasApiController.getById(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._err.status).toBe(404);
  });

  test('PUT /empresas/:id actualiza en MongoDB', async () => {
    const store = new Map([['LOC001', { _id: 'LOC001', ruc: '0999999999001', nombre: 'Restaurante Demo', logo: '/Uploads/Logos/LOC001.png' }]]);
    const context = {
      empresas: {
        findOne: async (f) => store.get(f._id) ? { ...store.get(f._id) } : null,
        replaceOne: async (f, d) => { store.set(f._id, { ...d }); return { acknowledged: true }; }
      }
    };
    const req = { params: { id: 'LOC001' }, body: { ruc: '0999999999001', nombre: 'Actualizado' }, file: null, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.update(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(store.get('LOC001').nombre).toBe('Actualizado');
  });

  test('PUT /empresas/:id no existe retorna 404', async () => {
    const context = { empresas: { findOne: async () => null, replaceOne: async () => ({ acknowledged: true }) } };
    const req = { params: { id: 'LOC999' }, body: { ruc: '0999999999001', nombre: 'x' }, file: null, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn((e) => { res._err = e; });
    await empresasApiController.update(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._err.status).toBe(404);
  });

  test('DELETE /empresas/:id elimina de MongoDB', async () => {
    const store = new Map([['LOC001', { _id: 'LOC001', ruc: '0999999999001', nombre: 'Restaurante Demo', logo: '/Uploads/Logos/LOC001.png' }]]);
    const context = {
      empresas: {
        findOne: async (f) => store.get(f._id) ? { ...store.get(f._id) } : null,
        deleteOne: async (f) => { store.delete(f._id); return { acknowledged: true }; }
      }
    };
    const req = { params: { id: 'LOC001' }, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn();
    await empresasApiController.remove(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(store.has('LOC001')).toBe(false);
  });

  test('DELETE /empresas/:id no existe retorna 404', async () => {
    const context = { empresas: { findOne: async () => null, deleteOne: async () => ({ acknowledged: true }) } };
    const req = { params: { id: 'LOC999' }, app: { locals: { context } } };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
    const next = jest.fn((e) => { res._err = e; });
    await empresasApiController.remove(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._err.status).toBe(404);
  });
});
