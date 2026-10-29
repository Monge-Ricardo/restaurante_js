'use strict';

const { crearRouterCrud } = require('./crudRouter');
const controller = require('../../controllers/api/ClientesApiController');

module.exports = crearRouterCrud(controller);
