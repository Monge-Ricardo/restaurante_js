'use strict';

class Empresa {
  constructor({ id_empresa = null, ruc = '', nombre = '', logo = null } = {}) {
    this.id_empresa = id_empresa;
    this.ruc = ruc;
    this.nombre = nombre;
    this.logo = logo;
  }

  static fromDocument(doc) {
    if (!doc) return null;
    return new Empresa({
      id_empresa: doc._id ?? doc.id_empresa ?? null,
      ruc: doc.ruc ?? '',
      nombre: doc.nombre ?? '',
      logo: doc.logo ?? null
    });
  }

  toDocument() {
    return {
      _id: this.id_empresa,
      ruc: this.ruc,
      nombre: this.nombre,
      logo: this.logo
    };
  }
}

module.exports = Empresa;
