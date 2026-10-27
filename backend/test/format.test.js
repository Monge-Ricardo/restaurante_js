'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Decimal128 } = require('mongodb');
const {
  toNumber,
  roundMoney,
  toDecimal128,
  formatMoney,
  parseDecimal,
  formatDate,
  formatDateTime,
  logoSrc
} = require('../src/utils/format');

test('toNumber normaliza números, textos, Decimal128 y valores vacíos', () => {
  assert.equal(toNumber(12.5), 12.5);
  assert.equal(toNumber(' 8.25 '), 8.25);
  assert.equal(toNumber(Decimal128.fromString('19.90')), 19.9);
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber('no es número'), 0);
  assert.equal(toNumber(Infinity), 0);
});

test('roundMoney redondea a dos decimales', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(1.1 + 2.2), 3.3);
  assert.equal(roundMoney('4.999'), 5);
});

test('toDecimal128 escribe valores monetarios con dos decimales', () => {
  const valor = toDecimal128(15.5);
  assert.ok(valor instanceof Decimal128);
  assert.equal(valor.toString(), '15.50');
});

test('formatMoney y parseDecimal respetan el formato del sistema', () => {
  assert.equal(formatMoney(5), '5.00');
  assert.equal(formatMoney(Decimal128.fromString('7.456')), '7.46');
  assert.equal(parseDecimal('12,50'), 12.5);
  assert.equal(parseDecimal(''), 0);
  assert.equal(parseDecimal('texto'), 0);
});

test('formatDate y formatDateTime usan dd/MM/yyyy HH:mm', () => {
  const fecha = new Date(2025, 2, 9, 14, 5, 7);
  assert.equal(formatDate(fecha), '09/03/2025');
  assert.equal(formatDateTime(fecha), '09/03/2025 14:05');
  assert.equal(formatDateTime('fecha inválida'), '');
});

test('logoSrc distingue rutas, Data URI y Base64 puro', () => {
  assert.equal(logoSrc('/Uploads/Logos/LOC001.png'), '/Uploads/Logos/LOC001.png');
  assert.equal(logoSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(logoSrc('A'.repeat(120)), `data:image/png;base64,${'A'.repeat(120)}`);
  assert.equal(logoSrc(''), null);
  assert.equal(logoSrc(null), null);
  assert.equal(logoSrc({}), null);
});
