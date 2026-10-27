'use strict';

const { validarCedula, validarCorreo, validarTextoLimpio } = require('../utils/validaciones');

/**
 * Modelo de Dominio: Cliente
 * Representa la entidad y centraliza sus reglas de validación de negocio.
 */
class Cliente {
  constructor({ id_cliente = null, nombre = '', apellido = '', cedula = '', telefono = null, correo = null }) {
    this.id_cliente = id_cliente;
    this.nombre = String(nombre || '').trim();
    this.apellido = String(apellido || '').trim();
    this.cedula = String(cedula || '').trim();
    this.telefono = telefono ? String(telefono).trim() : null;
    this.correo = correo ? String(correo).trim() : null;
  }

  /**
   * Valida las reglas de negocio de la entidad.
   * Retorna { esValido: boolean, errors: Array<{ field, message }> }
   */
  validar() {
    const errors = [];

    if (!validarTextoLimpio(this.nombre, { minLength: 2, maxLength: 60 })) {
      errors.push({ field: 'nombre', message: 'El nombre es obligatorio (mínimo 2 letras).' });
    }
    if (!validarTextoLimpio(this.apellido, { minLength: 2, maxLength: 60 })) {
      errors.push({ field: 'apellido', message: 'El apellido es obligatorio (mínimo 2 letras).' });
    }
    if (!validarCedula(this.cedula)) {
      errors.push({ field: 'cedula', message: 'Cédula ecuatoriana inválida (debe tener 10 dígitos y dígito verificador correcto).' });
    }
    if (this.correo && !validarCorreo(this.correo)) {
      errors.push({ field: 'correo', message: 'Formato de correo electrónico inválido.' });
    }

    return {
      esValido: errors.length === 0,
      errors
    };
  }

  /**
   * Convierte la instancia al formato exacto que guarda el documento en MongoDB.
   */
  toDatabaseDocument() {
    return {
      _id: this.id_cliente,
      nombre: this.nombre,
      apellido: this.apellido,
      cedula: this.cedula,
      telefono: this.telefono,
      correo: this.correo
    };
  }

  /**
   * Reconstruye una instancia desde un documento obtenido de MongoDB.
   */
  static fromDatabase(doc) {
    if (!doc) return null;
    return new Cliente({
      id_cliente: doc._id ?? doc.id_cliente,
      nombre: doc.nombre,
      apellido: doc.apellido,
      cedula: doc.cedula,
      telefono: doc.telefono,
      correo: doc.correo
    });
  }

  /**
   * Serializa al formato JSON de salida para la API REST.
   */
  toJSON() {
    return {
      id_cliente: this.id_cliente,
      nombre: this.nombre,
      apellido: this.apellido,
      cedula: this.cedula,
      telefono: this.telefono,
      correo: this.correo
    };
  }
}

module.exports = Cliente;
