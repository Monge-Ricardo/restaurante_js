'use strict';

const { mapCliente } = require('../utils/documents');

async function index(req, res) {
  try {
    const documentos = await req.app.locals.context.clientes
      .find({})
      .sort({ _id: 1 })
      .toArray();

    return res.render('clientes/index', {
      title: 'Clientes Registrados',
      clientes: documentos.map(mapCliente),
      error: null
    });
  } catch (error) {
    // Igual que el controlador original: se muestra la vista vacía con el error.
    return res.render('clientes/index', {
      title: 'Clientes Registrados',
      clientes: [],
      error: `Error al obtener la lista de clientes: ${error.message}`
    });
  }
}

module.exports = { index };
