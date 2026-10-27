'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validarCedula,
  validarRuc,
  validarCorreo,
  validarTextoLimpio,
  validarNumeroPositivo
} = require('../src/utils/validaciones');

test('validarCedula acepta cédulas ecuatorianas correctas', () => {
  assert.equal(validarCedula('1710034065'), true);
  assert.equal(validarCedula('0926687856'), true);
});

test('validarCedula rechaza formatos y dígitos verificadores inválidos', () => {
  assert.equal(validarCedula('171003406'), false);
  assert.equal(validarCedula('171003406X'), false);
  assert.equal(validarCedula('9910034065'), false);
  assert.equal(validarCedula('1710034066'), false);
  assert.equal(validarCedula('9999999999'), false);
});

test('validarRuc acepta RUC de persona natural', () => {
  assert.equal(validarRuc('1710034065001'), true);
  assert.equal(validarRuc('0999999999001'), true);
});

test('validarRuc rechaza RUC inválidos o incompletos', () => {
  assert.equal(validarRuc('1710034065000'), false);
  assert.equal(validarRuc('171003406500'), false);
  assert.equal(validarRuc('9910034065001'), false);
  assert.equal(validarRuc('1710034066001'), false);
});

test('validarCorreo valida el formato básico', () => {
  assert.equal(validarCorreo('cliente@restaurante.com'), true);
  assert.equal(validarCorreo('cliente@restaurante'), false);
  assert.equal(validarCorreo('cliente restaurante.com'), false);
  assert.equal(validarCorreo(''), false);
});

test('validarTextoLimpio limita longitud y caracteres', () => {
  assert.equal(validarTextoLimpio('Ceviche de camarón', 3, 50), true);
  assert.equal(validarTextoLimpio('AB', 3, 50), false);
  assert.equal(validarTextoLimpio('Precio $5', 3, 50), false);
});

test('validarTextoLimpio acepta el formato de opciones usado por los modelos', () => {
  assert.equal(validarTextoLimpio('Postres', { minLength: 2, maxLength: 50 }), true);
  assert.equal(validarTextoLimpio('A', { minLength: 2, maxLength: 50 }), false);
  assert.equal(validarTextoLimpio('Postres', { minLength: 2 }), false);
});

test('validarNumeroPositivo exige un número mayor que cero', () => {
  assert.equal(validarNumeroPositivo(0.01), true);
  assert.equal(validarNumeroPositivo('2.5'), true);
  assert.equal(validarNumeroPositivo(0), false);
  assert.equal(validarNumeroPositivo(-1), false);
  assert.equal(validarNumeroPositivo('abc'), false);
});
