'use strict';

const express = require('express');
const router = express.Router();

const platosApiController = require('../../controllers/api/platosApiController');

// GET /api/v1/platos  — listar todos los platos (soporta ?categoria=CAT001)
router.get('/', platosApiController.listarPlatos);

// POST /api/v1/platos  — crear un plato
router.post('/', platosApiController.crearPlato);

// PUT /api/v1/platos/:id  — editar un plato
router.put('/:id', platosApiController.editarPlato);

// DELETE /api/v1/platos/:id  — eliminar un plato
router.delete('/:id', platosApiController.eliminarPlato);

// GET /api/v1/platos/:id  — obtener un plato por ID
router.get('/:id', platosApiController.obtenerPlatoPorId);

module.exports = router;



