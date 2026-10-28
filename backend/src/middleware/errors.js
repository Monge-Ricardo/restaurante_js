'use strict';

const config = require('../config');

function notFound(req, res, next) {
  const error = new Error('La página o recurso solicitado no existe.');
  error.status = 404;
  error.expose = true;
  if (/^\/api\/v1(?:\/|$)/i.test(req.path)) {
    error.apiCode = 'ENDPOINT_API_NO_ENCONTRADO';
  }
  next(error);
}

function apiErrorCode(error, status) {
  if (error.apiCode) return error.apiCode;
  if (error.type === 'entity.parse.failed') return 'JSON_INVALIDO';
  if (status === 401) return 'AUTENTICACION_REQUERIDA';
  if (status === 403) return 'PERMISO_INSUFICIENTE';
  if (status === 404) return 'ENDPOINT_API_NO_ENCONTRADO';
  if (status === 400) return 'SOLICITUD_API_INVALIDA';
  return 'ERROR_INTERNO_API';
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
  const apiMessage =
    error.type === 'entity.parse.failed'
      ? 'El cuerpo de la solicitud debe contener JSON válido.'
      : message;

  console.error(`[${status}] ${req.method} ${req.originalUrl} - ${error.stack || error.message}`);

  if (/^\/api\/v1(?:\/|$)/i.test(req.path)) {
    return res.status(status).json({
      success: false,
      code: apiErrorCode(error, status),
      error: apiMessage
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
