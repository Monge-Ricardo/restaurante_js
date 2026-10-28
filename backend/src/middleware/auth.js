'use strict';

function loadSessionUser(req, res, next) {
  const session = req.session || {};
  res.locals.currentUser = session.empleadoId
    ? {
        id: session.empleadoId,
        nombreCompleto: session.nombreEmpleado || '',
        cargo: session.cargoEmpleado || '',
        correo: session.correoEmpleado || ''
      }
    : null;
  res.locals.permisos = Array.isArray(session.permisos) ? session.permisos : [];
  res.locals.tienePermiso = (permiso) =>
    res.locals.permisos.includes(permiso) || res.locals.permisos.includes('admin');
  next();
}

function isJsonRequest(req) {
  return (
    req.xhr ||
    req.path.toLowerCase().includes('buscarcliente') ||
    req.accepts(['html', 'json']) === 'json'
  );
}

/**
 * Equivalente al atributo [Authorize] de ASP.NET MVC.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.empleadoId) {
    return next();
  }

  if (isJsonRequest(req)) {
    return res.status(401).json({
      encontrado: false,
      code: 'AUTENTICACION_REQUERIDA',
      error: 'No autenticado.'
    });
  }

  return res.redirect('/Account/Login');
}

/**
 * Equivalente a utils/RequirePermisoAttribute.cs.
 * Si el usuario está autenticado pero no tiene el permiso, responde 403.
 */
function requirePermiso(permiso) {
  return (req, res, next) => {
    if (!req.session || !req.session.empleadoId) {
      return requireAuth(req, res, next);
    }

    const permisos = Array.isArray(req.session.permisos) ? req.session.permisos : [];
    if (permisos.includes(permiso) || permisos.includes('admin')) {
      return next();
    }

    if (isJsonRequest(req)) {
      return res.status(403).json({
        encontrado: false,
        code: 'PERMISO_INSUFICIENTE',
        error: 'No tiene permiso para acceder a este recurso.'
      });
    }

    const error = new Error('No tiene permiso para acceder a este recurso.');
    error.status = 403;
    error.expose = true;
    return next(error);
  };
}

function requireDb(req, res, next) {
  if (!req.app.locals.context) {
    const error = new Error(
      'No hay conexión con MongoDB. Verifica MONGODB_URI en el archivo .env e inicia el servidor nuevamente.'
    );
    error.status = 503;
    error.expose = true;
    error.apiCode = 'BASE_DATOS_NO_DISPONIBLE';
    return next(error);
  }

  return next();
}

module.exports = {
  loadSessionUser,
  requireAuth,
  requirePermiso,
  requireDb
};
