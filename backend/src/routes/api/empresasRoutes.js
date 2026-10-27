'use strict';

const express = require('express');
const { asyncHandler } = require('../../utils/http');
const empresasApiController = require('../../controllers/api/empresasApiContrller');
const { requireDb } = require('../../middleware/auth');
const { handleUpload, removeUploadedFile } = require('../../middleware/upload');
const { logosUpload } = require('../../middleware/upload');

const router = express.Router();

function handleLogoUpload(field = 'logo') {
  return (req, res, next) => {
    return handleUpload(logosUpload, field, '/api/v1/empresas')(req, res, (err) => {
      if (err) {
        return removeUploadedFile(req.file)
          .catch(() => {})
          .finally(() => next(err));
      }
      return next();
    });
  };
}

router.get('/', requireDb, asyncHandler(empresasApiController.list));
router.get('/:id', requireDb, asyncHandler(empresasApiController.getById));
router.post('/', requireDb, handleLogoUpload('logo'), asyncHandler(empresasApiController.create));
router.put('/:id', requireDb, handleLogoUpload('logo'), asyncHandler(empresasApiController.update));
router.delete('/:id', requireDb, asyncHandler(empresasApiController.remove));

module.exports = router;
