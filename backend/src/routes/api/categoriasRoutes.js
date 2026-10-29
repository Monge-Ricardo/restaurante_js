'use strict';

const { crearRouterCrud } = require('./crudRouter');
const controller = require('../../controllers/api/categoriasApiController');

module.exports = crearRouterCrud(controller);
