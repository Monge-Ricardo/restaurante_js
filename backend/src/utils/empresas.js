'use strict';

const { validarRuc } = require('./validaciones');

/**
 * Validaciones compartidas por el controlador web y la API de empresas.
 */
function validarDatosEmpresa({ ruc, nombre, tieneLogo, currentLogo = null }) {
  const errors = [];

  if (!String(nombre || '').trim()) {
    errors.push({ field: 'nombre', message: 'El nombre comercial es obligatorio.' });
  }

  if (!validarRuc(String(ruc || '').trim())) {
    errors.push({ field: 'ruc', message: 'El RUC ingresado no es válido.' });
  }

  if (!tieneLogo && !currentLogo) {
    errors.push({ field: 'logo', message: 'Debe seleccionar un archivo de logo.' });
  }

  return errors;
}

module.exports = { validarDatosEmpresa };
