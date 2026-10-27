'use strict';

const express = require('express');
const { requireDb } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/http');
const facturacionApiController = require('../../controllers/api/facturacionApiController');

const router = express.Router();

router.get('/', requireDb, asyncHandler(facturacionApiController.listar));
router.get('/:id', requireDb, asyncHandler(facturacionApiController.detalle));
router.post('/', requireDb, asyncHandler(facturacionApiController.emitir));
router.delete('/:id', requireDb, asyncHandler(facturacionApiController.anular));

module.exports = router;
