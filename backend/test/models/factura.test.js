'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Decimal128 } = require('mongodb');
const Factura = require('../../src/models/Factura');

test('Factura valida y serializa documentos con importes Decimal128', () => {
  const factura = Factura.fromDatabase({
    _id: 'FAC001',
    fecha: new Date('2026-10-27T12:00:00.000Z'),
    estado: 'EMITIDA',
    cliente: { id_cliente: 'CLI001', nombre: 'Ana' },
    empleado: { id_emple: 'EMP001', nombre: 'Carlos' },
    empresa: { id_empresa: 'LOC001', nombre: 'Restaurante' },
    detalleFacturas: [
      {
        plato: { id_plato: 'PLA001', nombre: 'Ceviche', precio: Decimal128.fromString('10.00') },
        cantidad: 2,
        subtotal_sin_iva: Decimal128.fromString('20.00'),
        valor_iva: Decimal128.fromString('3.00'),
        subtotal_con_iva: Decimal128.fromString('23.00'),
        tarifa_servicio: Decimal128.fromString('2.00'),
        total: Decimal128.fromString('25.00')
      }
    ]
  });

  assert.equal(factura.validar().esValido, true);
  assert.deepEqual(factura.toJSON().totales, {
    subtotal: 20,
    iva: 3,
    servicio: 2,
    total: 25
  });
});

test('Factura rechaza documentos sin cliente ni detalles', () => {
  const factura = new Factura({ id_factura: 'FAC002', empleado: { id_emple: 'EMP001' }, empresa: { id_empresa: 'LOC001' } });
  const resultado = factura.validar();

  assert.equal(resultado.esValido, false);
  assert.ok(resultado.errors.some((error) => error.field === 'cliente'));
  assert.ok(resultado.errors.some((error) => error.field === 'detalleFacturas'));
});
