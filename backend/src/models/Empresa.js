'use strict';

const { validarRuc } = require('../utils/validaciones');

class Empresa {
  constructor({ id_empresa = null, ruc = '', nombre = '', logo = null } = {}) {
    this.id_empresa = id_empresa ? String(id_empresa) : null;
    this.ruc = String(ruc || '').trim();
    this.nombre = String(nombre || '').trim();
    this.logo = logo ? String(logo) : null;
  }

  validar() {
    const errors = [];

    if (!this.nombre) {
      errors.push({ field: 'nombre', message: 'El nombre comercial es obligatorio.' });
    }

    if (!validarRuc(this.ruc)) {
      errors.push({ field: 'ruc', message: 'El RUC ingresado no es válido.' });
    }

    if (!this.logo) {
      errors.push({ field: 'logo', message: 'Debe seleccionar un archivo de logo.' });
    }

    return {
      esValido: errors.length === 0,
      errors
    };
  }

  toDatabaseDocument() {
    return {
      _id: this.id_empresa,
      ruc: this.ruc,
      nombre: this.nombre,
      logo: this.logo
    };
  }

  static fromDatabase(doc) {
    if (!doc) return null;
    return new Empresa({
      id_empresa: doc._id ?? doc.id_empresa ?? null,
      ruc: doc.ruc ?? '',
      nombre: doc.nombre ?? '',
      logo: doc.logo ?? null
    });
  }

  static fromDocument(doc) {
    return Empresa.fromDatabase(doc);
  }

  toDocument() {
    return this.toDatabaseDocument();
  }

  toJSON() {
    return {
      id_empresa: this.id_empresa,
      ruc: this.ruc,
      nombre: this.nombre,
      logo: this.logo
    };
  }
}

module.exports = Empresa;

