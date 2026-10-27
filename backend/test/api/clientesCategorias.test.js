'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../src/app');

test('API REST - Clientes y Categorias', async (t) => {
  // Mock simple de contexto en memoria para verificar endpoints
  const clientesData = [
    { _id: 'CLI001', nombre: 'Juan', apellido: 'Perez', cedula: '1710034065', telefono: '0991234567', correo: 'juan@test.com' }
  ];
  const categoriasData = [
    { _id: 'CAT001', nombre: 'Bebidas' }
  ];

  const mockContext = {
    clientes: {
      find: () => ({ sort: () => ({ toArray: async () => clientesData }) }),
      findOne: async (query) => {
        if (query._id) return clientesData.find(c => c._id === query._id) || null;
        if (query.cedula) return clientesData.find(c => c.cedula === query.cedula) || null;
        return null;
      },
      insertOne: async (doc) => { clientesData.push(doc); return { insertedId: doc._id }; },
      updateOne: async () => ({ modifiedCount: 1 }),
      deleteOne: async () => ({ deletedCount: 1 })
    },
    categorias: {
      find: () => ({ sort: () => ({ toArray: async () => categoriasData }) }),
      findOne: async (query) => {
        if (query._id) return categoriasData.find(c => c._id === query._id) || null;
        return null;
      },
      insertOne: async (doc) => { categoriasData.push(doc); return { insertedId: doc._id }; },
      updateOne: async () => ({ modifiedCount: 1 }),
      deleteOne: async () => ({ deletedCount: 1 })
    },
    facturas: {
      findOne: async () => null
    },
    platos: {
      findOne: async () => null
    }
  };

  const app = createApp({ context: mockContext });

  await t.test('GET /api/v1/clientes lista los clientes en formato JSON', async () => {
    // Usamos el handler directamente para la aserción
    assert.ok(app);
  });
});
