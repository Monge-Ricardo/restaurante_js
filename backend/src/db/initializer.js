'use strict';

const bcrypt = require('bcryptjs');
const { seedAdminPassword, seedCajeroPassword } = require('../config');

const COLLECTIONS = ['Categorias', 'Clientes', 'Platos', 'Empleados', 'Empresas', 'Facturas'];

const PERMISOS_ADMIN = [
  'admin',
  'facturar',
  'ver_reportes',
  'ver_cliente',
  'crear_cliente',
  'editar_cliente',
  'eliminar_cliente',
  'ver_platos',
  'crear_plato',
  'editar_plato',
  'eliminar_plato',
  'ver_empresa',
  'crear_empresa',
  'editar_empresa',
  'eliminar_empresa'
];

const CATEGORIAS_INICIALES = [
  { _id: 'CAT001', nombre: 'Entradas' },
  { _id: 'CAT002', nombre: 'Sopas' },
  { _id: 'CAT003', nombre: 'Platos Fuertes' },
  { _id: 'CAT004', nombre: 'Postres' },
  { _id: 'CAT005', nombre: 'Bebidas' }
];

async function crearColecciones(db) {
  const existentes = new Set(await db.listCollections({}, { nameOnly: true }).toArray().then((items) => items.map((item) => item.name)));

  for (const nombre of COLLECTIONS) {
    if (!existentes.has(nombre)) {
      await db.createCollection(nombre);
      existentes.add(nombre);
    }
  }
}

async function crearIndices(context, logger = console) {
  const indices = [
    {
      coleccion: context.clientes,
      nombre: 'cedula_unica',
      spec: { cedula: 1 },
      options: { unique: true, sparse: true }
    },
    {
      coleccion: context.empleados,
      nombre: 'cedula_unica',
      spec: { cedula: 1 },
      options: { unique: true, sparse: true }
    },
    {
      coleccion: context.empresas,
      nombre: 'ruc_unico',
      spec: { ruc: 1 },
      options: { unique: true, sparse: true }
    },
    {
      coleccion: context.facturas,
      nombre: 'fecha_desc',
      spec: { fecha: -1 },
      options: {}
    }
  ];

  for (const item of indices) {
    try {
      await item.coleccion.createIndex(item.spec, { name: item.nombre, ...item.options });
    } catch (error) {
      // Igual que en el proyecto original, un índice incompatible no debe impedir el arranque.
      logger.warn(`[MongoDB] No se pudo crear el índice ${item.nombre}: ${error.message}`);
    }
  }
}

async function sembrarEmpleado(context, empleado, logger = console) {
  const existente = await context.empleados.findOne({ 'usuario.correo': empleado.usuario.correo });
  if (existente) {
    return false;
  }

  try {
    await context.empleados.insertOne({
      ...empleado,
      usuario: {
        ...empleado.usuario,
        password: bcrypt.hashSync(empleado.usuario.password, 10)
      }
    });
    logger.info(`[MongoDB] Empleado sembrado: ${empleado.usuario.correo}`);
    return true;
  } catch (error) {
    // Un _id ya ocupado por otro documento no debe impedir el arranque.
    if (error?.code === 11000) {
      logger.warn(`[MongoDB] No se pudo sembrar ${empleado.usuario.correo}: el _id ${empleado._id} ya existe.`);
      return false;
    }
    throw error;
  }
}

/**
 * Equivalente a Models/DatabaseInitializer.cs.
 */
async function initializeDatabase(context, logger = console) {
  if (!seedAdminPassword || !seedCajeroPassword) {
    throw new Error('Configura SEED_ADMIN_PASSWORD y SEED_CAJERO_PASSWORD en el archivo .env.');
  }

  await crearColecciones(context.db);
  await crearIndices(context, logger);

  await sembrarEmpleado(context, {
    _id: 'EMP001',
    nombre: 'Admin',
    apellido: 'Sistema',
    cedula: '9999999999',
    sexo: 'N/A',
    estado_civil: 'N/A',
    telefono: '0000000000',
    cargo: 'Administrador',
    usuario: { correo: 'admin@restaurante.com', password: seedAdminPassword },
    permisos: PERMISOS_ADMIN
  }, logger);

  await sembrarEmpleado(context, {
    _id: 'EMP002',
    nombre: 'Carlos',
    apellido: 'Cajero',
    cedula: '1712345678',
    sexo: 'M',
    estado_civil: 'Soltero',
    telefono: '0991234567',
    cargo: 'Cajero',
    usuario: { correo: 'cajero@restaurante.com', password: seedCajeroPassword },
    permisos: ['facturar', 'ver_reportes']
  }, logger);

  let totalCategorias = 0;
  try {
    totalCategorias = await context.categorias.countDocuments({});
  } catch (error) {
    // Compatibilidad con documentos antiguos que no pudieran deserializarse.
    logger.warn(`[MongoDB] Se recreará la colección Categorias: ${error.message}`);
    await context.db.dropCollection('Categorias').catch(() => {});
    await context.db.createCollection('Categorias');
  }

  if (totalCategorias === 0) {
    await context.categorias.insertMany(CATEGORIAS_INICIALES);
    logger.info('[MongoDB] Categorías iniciales sembradas.');
  }
}

module.exports = {
  initializeDatabase,
  PERMISOS_ADMIN,
  CATEGORIAS_INICIALES
};
