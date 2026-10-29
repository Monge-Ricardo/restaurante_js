'use strict';

const crypto = require('node:crypto');

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    return next(new Error('La sesión no está disponible para generar el token CSRF.'));
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function tokensIguales(recibido, esperado) {
  if (typeof recibido !== 'string' || typeof esperado !== 'string' || recibido.length !== esperado.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

function verifyCsrfToken(req, res, next) {
  if (METODOS_SEGUROS.has(req.method)) {
    return next();
  }

  const recibido = req.body?._csrf || req.get('x-csrf-token');
  if (tokensIguales(recibido, req.session?.csrfToken)) {
    return next();
  }

  const error = new Error('Token CSRF inválido o expirado. Recarga la página e inténtalo de nuevo.');
  error.status = 403;
  error.expose = true;
  return next(error);
}

/**
 * Verificación global. Los formularios multipart se verifican después de multer,
 * porque el cuerpo aún no está disponible en este punto.
 */
function verifyCsrf(req, res, next) {
  if (METODOS_SEGUROS.has(req.method) || req.is('multipart/form-data')) {
    return next();
  }

  return verifyCsrfToken(req, res, next);
}

module.exports = {
  ensureCsrfToken,
  verifyCsrf,
  verifyCsrfToken
};
