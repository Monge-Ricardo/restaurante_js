'use strict';

const { MongoClient } = require('mongodb');

/**
 * Equivalente a Models/MongoDbContext.cs.
 * Mantiene una única conexión y expone las colecciones usadas por el sistema.
 */
class MongoContext {
  constructor(client, db) {
    this.client = client;
    this.db = db;
  }

  static async connect(uri, dbName, options = {}) {
    const client = new MongoClient(uri, options);
    await client.connect();
    const db = client.db(dbName);
    return new MongoContext(client, db);
  }

  get categorias() {
    return this.db.collection('Categorias');
  }

  get clientes() {
    return this.db.collection('Clientes');
  }

  get platos() {
    return this.db.collection('Platos');
  }

  get empleados() {
    return this.db.collection('Empleados');
  }

  get empresas() {
    return this.db.collection('Empresas');
  }

  get facturas() {
    return this.db.collection('Facturas');
  }

  async close() {
    await this.client.close();
  }
}

module.exports = { MongoContext };
