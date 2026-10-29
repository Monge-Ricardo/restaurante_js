'use strict';

/**
 * Port de utils/Validaciones.cs y de Scripts/validaciones.js.
 * Las mismas reglas se usan en el servidor y en el navegador.
 */

function validarCedula(cedula) {
  if (typeof cedula !== 'string' || !/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number.parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) {
    return false;
  }

  const tercerDigito = Number.parseInt(cedula.charAt(2), 10);
  if (tercerDigito > 5) {
    return false;
  }

  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let numero = Number.parseInt(cedula.charAt(i), 10);
    if (i % 2 === 0) {
      numero *= 2;
      if (numero > 9) {
        numero -= 9;
      }
    }
    suma += numero;
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificador = Number.parseInt(cedula.charAt(9), 10);

  return digitoCalculado === digitoVerificador;
}

function calcularDigitoVerificador(ruc, coeficientes, longitud) {
  let suma = 0;

  for (let i = 0; i < longitud; i += 1) {
    suma += Number.parseInt(ruc.charAt(i), 10) * coeficientes[i];
  }

  let verificador = 11 - (suma % 11);
  if (verificador === 11) verificador = 0;
  return verificador;
}

function validarRucPersonaNatural(ruc) {
  return validarCedula(ruc.substring(0, 10));
}

function validarRucEntidadPublica(ruc) {
  const verificador = calcularDigitoVerificador(ruc, [3, 2, 7, 6, 5, 4, 3, 2], 8);
  if (verificador === 10) return false;
  return verificador === Number.parseInt(ruc.charAt(8), 10);
}

function validarRucSociedadPrivada(ruc) {
  const verificador = calcularDigitoVerificador(ruc, [4, 3, 2, 7, 6, 5, 4, 3, 2], 9);
  if (verificador === 10) return false;
  return verificador === Number.parseInt(ruc.charAt(9), 10);
}

function validarRuc(ruc) {
  if (typeof ruc !== 'string' || ruc.length !== 13 || !/^\d{13}$/.test(ruc)) {
    return false;
  }

  const provincia = Number.parseInt(ruc.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) {
    return false;
  }

  const establecimiento = ruc.substring(10, 13);
  if (establecimiento === '000') {
    return false;
  }

  const tercerDigito = Number.parseInt(ruc.charAt(2), 10);

  // Persona natural
  if (tercerDigito >= 0 && tercerDigito <= 5) {
    return validarRucPersonaNatural(ruc);
  }

  // Entidad pública
  if (tercerDigito === 6) {
    return validarRucEntidadPublica(ruc);
  }

  // Sociedad privada
  if (tercerDigito === 9) {
    return validarRucSociedadPrivada(ruc);
  }

  return false;
}

function validarCorreo(correo) {
  if (typeof correo !== 'string' || correo.trim() === '') {
    return false;
  }

  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(correo.trim());
}

function validarTextoLimpio(texto, minLength, maxLength) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    return false;
  }

  if (minLength && typeof minLength === 'object') {
    ({ minLength, maxLength } = minLength);
  }

  if (!Number.isInteger(minLength) || !Number.isInteger(maxLength)) {
    return false;
  }

  const limpio = texto.trim();
  if (limpio.length < minLength || limpio.length > maxLength) {
    return false;
  }

  return /^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s'-]+$/.test(limpio);
}

function validarNumeroPositivo(numero) {
  if (numero === null || numero === undefined || Number.isNaN(Number(numero))) {
    return false;
  }

  return Number.parseFloat(numero) > 0;
}

module.exports = {
  validarCedula,
  validarRuc,
  validarCorreo,
  validarTextoLimpio,
  validarNumeroPositivo
};
