'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/http');
const { requireAuth, requirePermiso, requireDb } = require('../middleware/auth');
const { verifyCsrfToken } = require('../middleware/csrf');
const {
  platosUpload,
  logosUpload,
  handleUpload,
  removeUploadedFile
} = require('../middleware/upload');

const accountController = require('../controllers/accountController');
const homeController = require('../controllers/homeController');
const clientesController = require('../controllers/clientesController');
const empresasController = require('../controllers/empresasController');
const platosController = require('../controllers/platosController');
const facturacionController = require('../controllers/facturacionController');

const router = express.Router();

/**
 * En formularios multipart el cuerpo se parsea con multer. Si el token CSRF
 * falla después de subir el archivo, se elimina el archivo huérfano.
 */
function verifyMultipartCsrf(req, res, next) {
  return verifyCsrfToken(req, res, (error) => {
    if (!error) return next();
    if (!req.file) return next(error);

    return removeUploadedFile(req.file)
      .catch(() => {})
      .finally(() => next(error));
  });
}

// Rutas de inicio y autenticación
router.get('/', (_req, res) => res.redirect('/Account/Login'));
router.get('/Account/Login', asyncHandler(accountController.showLogin));
router.post('/Account/Login', asyncHandler(accountController.login));
router.get('/Account/Logout', asyncHandler(accountController.logout));
router.get('/Home/Index', requireAuth, asyncHandler(homeController.index));

// Clientes
router.get('/Clientes', requirePermiso('ver_cliente'), requireDb, asyncHandler(clientesController.index));
router.get('/Clientes/Index', requirePermiso('ver_cliente'), requireDb, asyncHandler(clientesController.index));

// Empresas
router.get('/Empresas', requirePermiso('ver_empresa'), requireDb, asyncHandler(empresasController.index));
router.get('/Empresas/Index', requirePermiso('ver_empresa'), requireDb, asyncHandler(empresasController.index));
router.get('/Empresas/Crear', requirePermiso('crear_empresa'), requireDb, asyncHandler(empresasController.showCrear));
router.post(
  '/Empresas/Crear',
  requirePermiso('crear_empresa'),
  requireDb,
  asyncHandler(empresasController.prepararSiguienteId),
  handleUpload(logosUpload, 'logo', '/Empresas/Crear'),
  verifyMultipartCsrf,
  asyncHandler(empresasController.crear)
);
router.get('/Empresas/Editar/:id', requirePermiso('editar_empresa'), requireDb, asyncHandler(empresasController.showEditar));
router.post(
  '/Empresas/Editar/:id',
  requirePermiso('editar_empresa'),
  requireDb,
  handleUpload(logosUpload, 'logo', (req) => `/Empresas/Editar/${encodeURIComponent(req.params.id)}`),
  verifyMultipartCsrf,
  asyncHandler(empresasController.editar)
);
router.get('/Empresas/Eliminar/:id', requirePermiso('eliminar_empresa'), requireDb, asyncHandler(empresasController.showEliminar));
router.post('/Empresas/Eliminar/:id', requirePermiso('eliminar_empresa'), requireDb, asyncHandler(empresasController.eliminar));

// Platos
router.get('/Platos', requirePermiso('ver_platos'), requireDb, asyncHandler(platosController.index));
router.get('/Platos/Index', requirePermiso('ver_platos'), requireDb, asyncHandler(platosController.index));
router.get('/Platos/Crear', requirePermiso('crear_plato'), requireDb, asyncHandler(platosController.showCrear));
router.post(
  '/Platos/Crear',
  requirePermiso('crear_plato'),
  requireDb,
  asyncHandler(platosController.prepararSiguienteId),
  handleUpload(platosUpload, 'fotoArchivo', '/Platos/Crear'),
  verifyMultipartCsrf,
  asyncHandler(platosController.crear)
);
router.get('/Platos/Editar/:id', requirePermiso('editar_plato'), requireDb, asyncHandler(platosController.showEditar));
router.post(
  '/Platos/Editar/:id',
  requirePermiso('editar_plato'),
  requireDb,
  handleUpload(platosUpload, 'fotoArchivo', (req) => `/Platos/Editar/${encodeURIComponent(req.params.id)}`),
  verifyMultipartCsrf,
  asyncHandler(platosController.editar)
);
router.get('/Platos/Eliminar/:id', requirePermiso('eliminar_plato'), requireDb, asyncHandler(platosController.showEliminar));
router.post('/Platos/Eliminar/:id', requirePermiso('eliminar_plato'), requireDb, asyncHandler(platosController.eliminar));

// Facturación
router.get('/Facturacion/Crear', requirePermiso('facturar'), requireDb, asyncHandler(facturacionController.crear));
router.get('/Facturacion/BuscarCliente', requireAuth, requireDb, asyncHandler(facturacionController.buscarCliente));
router.post('/Facturacion/ProcesarSeleccion', requirePermiso('facturar'), requireDb, asyncHandler(facturacionController.procesarSeleccion));
router.get('/Facturacion/VerFactura/:id', requirePermiso('ver_reportes'), requireDb, asyncHandler(facturacionController.verFactura));
router.get('/Facturacion/FacturasGuardadas', requirePermiso('ver_reportes'), requireDb, asyncHandler(facturacionController.facturasGuardadas));
router.get('/Facturacion/Reporte', requirePermiso('ver_reportes'), requireDb, asyncHandler(facturacionController.reporte));

module.exports = router;
