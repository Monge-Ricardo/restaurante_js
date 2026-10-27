'use strict';

const config = require('../config');

function notFound(req, res, next) {
  const error = new Error('La página o recurso solicitado no existe.');
  error.status = 404;
  error.expose = true;
  next(error);
}

function errorHandler(error, req, res, _next) {
  if (res.headersSent) {
    return undefined;
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  const message =
    status >= 500 && !error.expose
      ? 'Ocurrió un error interno al procesar la solicitud.'
      : error.message || 'Error inesperado.';

  console.error(`[${status}] ${req.method} ${req.originalUrl} - ${error.stack || error.message}`);

  if (/^\/api\/v1(?:\/|$)/i.test(req.path)) {
    return res.status(status).json({
      success: false,
      error: message
    });
  }

  if (
    req.xhr ||
    req.path.toLowerCase().includes('buscarcliente') ||
    req.accepts(['html', 'json']) === 'json'
  ) {
    return res.status(status).json({
      encontrado: false,
      error: message
    });
  }

  return res.status(status).render('error', {
    title: `Error ${status}`,
    status,
    message,
    detail: config.isProduction ? null : error.stack || null
  });
}

module.exports = { notFound, errorHandler };
