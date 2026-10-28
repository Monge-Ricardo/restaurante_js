'use strict';

const { Decimal128 } = require('mongodb');

/**
 * MongoDB puede devolver Decimal128 (por el atributo [BsonRepresentation(Decimal128)]
 * del proyecto C#). Estas funciones normalizan esos valores a Number para las vistas
 * y los vuelven a convertir a Decimal128 antes de escribir en la base.
 */
function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      try {
        const parsed = value.toNumber();
        return Number.isFinite(parsed) ? parsed : 0;
      } catch (_error) {
        // Continúa con toString().
      }
    }

    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function roundMoney(value) {
  const numero = toNumber(value);
  return Math.round((numero + 1e-9) * 100) / 100;
}

function toDecimal128(value) {
  return Decimal128.fromString(roundMoney(value).toFixed(2));
}

function formatMoney(value) {
  return toNumber(value).toFixed(2);
}

function parseDecimal(texto) {
  if (texto === null || texto === undefined) return 0;
  const limpio = String(texto).trim().replaceAll(/,/g, '.');
  if (limpio === '') return 0;

  const numero = Number.parseFloat(limpio);
  return Number.isFinite(numero) ? numero : 0;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value) {
  if (!value) return '';
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return '';

  return `${pad2(fecha.getDate())}/${pad2(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${pad2(fecha.getHours())}:${pad2(fecha.getMinutes())}`;
}

function formatDate(value) {
  if (!value) return '';
  const fecha = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(fecha.getTime())) return '';

  return `${pad2(fecha.getDate())}/${pad2(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/**
 * Equivalente a la lógica de Views/Facturacion/VerFactura.cshtml para logos guardados
 * como ruta relativa o como Base64.
 */
function logoSrc(logo) {
  if (typeof logo !== 'string') return null;
  const valor = logo.trim();
  if (!valor) return null;
  if (valor.startsWith('data:image')) return valor;
  if (valor.length > 100) return `data:image/png;base64,${valor}`;
  return valor;
}

module.exports = {
  toNumber,
  roundMoney,
  toDecimal128,
  formatMoney,
  parseDecimal,
  formatDateTime,
  formatDate,
  logoSrc
};
