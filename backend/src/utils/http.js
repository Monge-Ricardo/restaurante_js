'use strict';

/**
 * Express 4 no captura automáticamente los rechazos de promesas.
 * Este wrapper envía los errores al middleware de errores.
 */
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(status, message, apiCode) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  if (apiCode) error.apiCode = apiCode;
  return error;
}

module.exports = { asyncHandler, createHttpError };
