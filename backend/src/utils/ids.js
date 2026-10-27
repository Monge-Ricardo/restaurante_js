'use strict';

const path = require('path');

function escapeRegex(texto) {
  return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Equivalente a la generación de IDs secuenciales del proyecto original:
 * busca el último _id con el prefijo y suma 1. Ej.: PLA001 -> PLA002.
 */
async function nextSequentialId(collection, prefix, padding = 3) {
  const regex = new RegExp(`^${escapeRegex(prefix)}\\d+$`);
  const ultimo = await collection
    .find({ _id: { $regex: regex } }, { projection: { _id: 1 } })
    .sort({ _id: -1 })
    .limit(1)
    .next();

  let siguiente = 1;
  if (ultimo && typeof ultimo._id === 'string' && ultimo._id.startsWith(prefix)) {
    const numero = Number.parseInt(ultimo._id.substring(prefix.length), 10);
    if (Number.isInteger(numero)) {
      siguiente = numero + 1;
    }
  }

  return `${prefix}${String(siguiente).padStart(padding, '0')}`;
}

/**
 * Evita path traversal y caracteres problemáticos en nombres de archivo.
 */
function sanitizeFileName(originalName) {
  const nombre = path.basename(String(originalName || ''));
  const extensionOriginal = path.extname(nombre);
  const extension = extensionOriginal.toLowerCase();
  const base = path
    .basename(nombre, extensionOriginal)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return {
    base: base || 'archivo',
    extension
  };
}

function buildUploadFileName(prefix, originalName) {
  const { base, extension } = sanitizeFileName(originalName);
  return `${prefix}_${base}${extension}`;
}

module.exports = {
  escapeRegex,
  nextSequentialId,
  sanitizeFileName,
  buildUploadFileName
};
