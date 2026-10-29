'use strict';

const express = require('express');

/**
 * Construye un router CRUD estándar para los controladores de la API
 * que comparten los mismos cinco métodos.
 */
function crearRouterCrud(controller) {
  const router = express.Router();

  router.get('/', controller.listar);
  router.get('/:id', controller.obtenerPorId);
  router.post('/', controller.crear);
  router.put('/:id', controller.actualizar);
  router.delete('/:id', controller.eliminar);

  return router;
}

module.exports = { crearRouterCrud };
