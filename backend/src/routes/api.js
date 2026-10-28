'use strict';

const express = require('express');
const router = express.Router();


// Ruta de comprobación de salud de la API
router.get('/health', (_req, res) => {
  return res.json({
    success: true,
    data: {
      status: 'API REST online',
      timestamp: new Date().toISOString()
    }
  });
});

// Los módulos de cada integrante se montan aquí:
router.use('/empresas', require('./api/empresasRoutes'));
// router.use('/platos', require('./api/platosRoutes'));


// Los módulos de cada integrante se montan aquí:
// Módulos REST
router.use('/clientes', require('./api/clientesRoutes'));
router.use('/categorias', require('./api/categoriasRoutes'));

// Rutas de compañeros (pendientes de conectar):
// router.use('/empresas', require('./api/empresasRoutes'));
router.use('/platos', require('./api/platosRoutes'));
router.use('/facturas', require('./api/facturacionRoutes'));

module.exports = router;
