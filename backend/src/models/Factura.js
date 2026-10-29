'use strict';

const { mapFactura, sumarDetalles } = require('../utils/documents');

/**
 * Modelo de dominio de una factura. Conserva la estructura embebida de MongoDB
 * y expone importes normalizados para las respuestas JSON de la API.
 */
class Factura {
  constructor({
    id_factura = null,
    fecha = new Date(),
    cliente = null,
    empleado = null,
    empresa = null,
    detalleFacturas = [],
    estado = 'EMITIDA'
  } = {}) {
    this.id_factura = id_factura;
    this.fecha = fecha instanceof Date ? fecha : new Date(fecha);
    this.cliente = cliente;
    this.empleado = empleado;
    this.empresa = empresa;
    this.detalleFacturas = Array.isArray(detalleFacturas) ? detalleFacturas : [];
    this.estado = String(estado || 'EMITIDA').trim().toUpperCase();
  }

  validar() {
    const errors = [];

    if (typeof this.id_factura !== 'string' || !/^FAC\d+$/.test(this.id_factura)) {
      errors.push({ field: 'id_factura', message: 'El identificador de la factura no es válido.' });
    }
    if (Number.isNaN(this.fecha.getTime())) {
      errors.push({ field: 'fecha', message: 'La fecha de la factura no es válida.' });
    }
    if (!this.cliente?.id_cliente) {
      errors.push({ field: 'cliente', message: 'La factura debe incluir un cliente válido.' });
    }
    if (!this.empleado?.id_emple) {
      errors.push({ field: 'empleado', message: 'La factura debe incluir un empleado válido.' });
    }
    if (!this.empresa?.id_empresa) {
      errors.push({ field: 'empresa', message: 'La factura debe incluir una empresa válida.' });
    }
    if (!Array.isArray(this.detalleFacturas) || this.detalleFacturas.length === 0) {
      errors.push({ field: 'detalleFacturas', message: 'La factura debe incluir al menos un plato.' });
    } else {
      this.detalleFacturas.forEach((detalle, indice) => {
        if (!detalle?.plato?.id_plato) {
          errors.push({ field: `detalleFacturas[${indice}].plato`, message: 'Cada detalle debe referenciar un plato válido.' });
        }
        if (!Number.isSafeInteger(detalle?.cantidad) || detalle.cantidad <= 0) {
          errors.push({ field: `detalleFacturas[${indice}].cantidad`, message: 'La cantidad debe ser un entero positivo.' });
        }
      });
    }
    if (!['EMITIDA', 'ANULADA'].includes(this.estado)) {
      errors.push({ field: 'estado', message: 'El estado de la factura no es válido.' });
    }

    return { esValido: errors.length === 0, errors };
  }

  toDatabaseDocument() {
    return {
      _id: this.id_factura,
      fecha: this.fecha,
      cliente: this.cliente,
      empleado: this.empleado,
      empresa: this.empresa,
      detalleFacturas: this.detalleFacturas,
      estado: this.estado
    };
  }

  static fromDatabase(doc) {
    if (!doc) return null;
    return new Factura({
      id_factura: doc._id ?? doc.id_factura,
      fecha: doc.fecha,
      cliente: doc.cliente,
      empleado: doc.empleado,
      empresa: doc.empresa,
      detalleFacturas: doc.detalleFacturas,
      estado: doc.estado
    });
  }

  toJSON() {
    const factura = mapFactura(this.toDatabaseDocument());
    return {
      ...factura,
      estado: this.estado,
      totales: sumarDetalles(factura)
    };
  }
}

module.exports = Factura;
