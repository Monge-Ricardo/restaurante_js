'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

let preparado = false;

function horaActual() {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}.${String(ahora.getMilliseconds()).padStart(3, '0')}`;
}

/**
 * Equivalente al log de App_Data/buscar_cliente.log.
 */
async function logBuscarCliente(mensaje) {
  try {
    if (!preparado) {
      await fs.promises.mkdir(config.logsDir, { recursive: true });
      preparado = true;
    }

    const linea = `${horaActual()} | ${mensaje}\n`;
    await fs.promises.appendFile(path.join(config.logsDir, 'buscar_cliente.log'), linea, 'utf8');
  } catch (error) {
    // El log no debe romper la búsqueda del cliente.
    console.warn(`[log] No se pudo escribir buscar_cliente.log: ${error.message}`);
  }
}

module.exports = { logBuscarCliente };
