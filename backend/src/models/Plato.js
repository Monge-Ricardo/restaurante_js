'use strict';

const { parseDecimal, toDecimal128 } = require('../utils/format');
const { mapCategoria, mapPlato } = require('../utils/documents');

class Plato {
    constructor({
        id_plato = null,
        nombre = '',
        descripcion = '',
        precio = 0,
        categoria = null,
        imagen = null
    } = {}) {
        this.id_plato = id_plato;
        this.nombre = String(nombre || '').trim();
        this.descripcion = String(descripcion || '').trim();
        this.precio = parseDecimal(precio);
        this.categoria = mapCategoria(categoria);
        this.imagen = imagen || null;
    }

    validar() {
        const errors = [];

        if (!this.nombre) {
            errors.push({
                field: 'nombre',
                message: 'El nombre del plato es obligatorio.'
            });
        }

        if (!this.descripcion) {
            errors.push({
                field: 'descripcion',
                message: 'La descripción es obligatoria.'
            });
        }

        if (!Number.isFinite(this.precio) || this.precio <= 0) {
            errors.push({
                field: 'precio',
                message: 'El precio debe ser mayor a cero.'
            });
        }

        if (!this.categoria?.id_categoria) {
            errors.push({
                field: 'id_categoria',
                message: 'La categoría es obligatoria.'
            });
        }

        return { esValido: errors.length === 0, errors };
    }

    toDatabaseDocument() {
        return {
            _id: this.id_plato,
            nombre: this.nombre,
            descripcion: this.descripcion,
            precio: toDecimal128(this.precio),
            categoria: this.categoria
                ? {
                    _id: this.categoria.id_categoria,
                    nombre: this.categoria.nombre
                }
                : null,
            imagen: this.imagen
        };
    }

    static fromDatabase(doc) {
        if (!doc) return null;

        return new Plato({
            ...doc,
            id_plato: doc._id ?? doc.id_plato
        });
    }

    toJSON() {
        return mapPlato(this.toDatabaseDocument());
    }
}

module.exports = Plato;