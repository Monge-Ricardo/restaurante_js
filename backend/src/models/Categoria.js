'use strict';

const { validarTextoLimpio } = require('../utils/validaciones');

/**
 * Modelo de Dominio: Categoria
 */
class Categoria {
  constructor({ id_categoria = null, nombre = '' }) {
    this.id_categoria = id_categoria;
    this.nombre = String(nombre || '').trim();
  }

  validar() {
    const errors = [];
    if (!validarTextoLimpio(this.nombre, { minLength: 2, maxLength: 50 })) {
      errors.push({ field: 'nombre', message: 'El nombre de la categoría es obligatorio (mínimo 2 letras).' });
    }
    return {
      esValido: errors.length === 0,
      errors
    };
  }

  toDatabaseDocument() {
    return {
      _id: this.id_categoria,
      nombre: this.nombre
    };
  }

  static fromDatabase(doc) {
    if (!doc) return null;
    return new Categoria({
      id_categoria: doc._id ?? doc.id_categoria,
      nombre: doc.nombre
    });
  }

  toJSON() {
    return {
      id_categoria: this.id_categoria,
      nombre: this.nombre
    };
  }
}

module.exports = Categoria;
