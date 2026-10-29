'use strict';

const Cliente = require('../../models/Cliente');
const { nextSequentialId } = require('../../utils/ids');

/**
 * GET /api/v1/clientes
 */
async function listar(req, res) {
  try {
    const { clientes } = req.app.locals.context;
    const { cedula } = req.query;

    const query = {};
    if (cedula) {
      query.cedula = String(cedula).trim();
    }

    const docs = await clientes.find(query).sort({ _id: 1 }).toArray();
    const clientesList = docs.map(doc => Cliente.fromDatabase(doc).toJSON());

    return res.status(200).json({
      success: true,
      data: clientesList
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: `Error al obtener clientes: ${error.message}` }
    });
  }
}

/**
 * GET /api/v1/clientes/:id
 */
async function obtenerPorId(req, res) {
  try {
    const { clientes } = req.app.locals.context;
    const doc = await clientes.findOne({ _id: req.params.id });

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: `Cliente con ID '${req.params.id}' no encontrado.` }
      });
    }

    return res.status(200).json({
      success: true,
      data: Cliente.fromDatabase(doc).toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: `Error al consultar cliente: ${error.message}` }
    });
  }
}

/**
 * POST /api/v1/clientes
 */
async function crear(req, res) {
  try {
    const { clientes } = req.app.locals.context;
    
    // Instanciar el modelo con los datos del request
    const cliente = new Cliente(req.body);

    // 1. Validar reglas de dominio del modelo
    const validacion = cliente.validar();
    if (!validacion.esValido) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Error de validación en los datos del cliente.',
          details: validacion.errors
        }
      });
    }

    // 2. Validar regla de unicidad en BD
    const existente = await clientes.findOne({ cedula: cliente.cedula });
    if (existente) {
      return res.status(409).json({
        success: false,
        error: { message: `Ya existe un cliente registrado con la cédula '${cliente.cedula}'.` }
      });
    }

    // 3. Asignar ID correlativo
    cliente.id_cliente = await nextSequentialId(clientes, 'CLI');

    // 4. Persistir en MongoDB
    await clientes.insertOne(cliente.toDatabaseDocument());

    return res.status(201).json({
      success: true,
      data: cliente.toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: `Error al crear cliente: ${error.message}` }
    });
  }
}

/**
 * PUT /api/v1/clientes/:id
 */
async function actualizar(req, res) {
  try {
    const { clientes } = req.app.locals.context;
    const { id } = req.params;

    const docExistente = await clientes.findOne({ _id: id });
    if (!docExistente) {
      return res.status(404).json({
        success: false,
        error: { message: `Cliente con ID '${id}' no encontrado.` }
      });
    }

    const clienteActual = Cliente.fromDatabase(docExistente);

    // Actualizar campos si vienen en el body
    if (req.body.nombre !== undefined) clienteActual.nombre = req.body.nombre;
    if (req.body.apellido !== undefined) clienteActual.apellido = req.body.apellido;
    if (req.body.cedula !== undefined) clienteActual.cedula = req.body.cedula;
    if (req.body.telefono !== undefined) clienteActual.telefono = req.body.telefono;
    if (req.body.correo !== undefined) clienteActual.correo = req.body.correo;

    const validacion = clienteActual.validar();
    if (!validacion.esValido) {
      return res.status(400).json({
        success: false,
        error: { message: 'Error de validación al actualizar cliente.', details: validacion.errors }
      });
    }

    // Si cambió la cédula, validar que no choque con otro
    if (clienteActual.cedula !== docExistente.cedula) {
      const repetida = await clientes.findOne({ cedula: clienteActual.cedula, _id: { $ne: id } });
      if (repetida) {
        return res.status(409).json({
          success: false,
          error: { message: `La cédula '${clienteActual.cedula}' ya pertenece a otro cliente.` }
        });
      }
    }

    await clientes.updateOne({ _id: id }, { $set: clienteActual.toDatabaseDocument() });

    return res.status(200).json({
      success: true,
      data: clienteActual.toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: `Error al actualizar cliente: ${error.message}` }
    });
  }
}

/**
 * DELETE /api/v1/clientes/:id
 */
async function eliminar(req, res) {
  try {
    const { clientes, facturas } = req.app.locals.context;
    const { id } = req.params;

    const doc = await clientes.findOne({ _id: id });
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: { message: `Cliente con ID '${id}' no encontrado.` }
      });
    }

    // Regla de integridad de negocio: no eliminar clientes con facturas
    if (facturas) {
      const tieneFacturas = await facturas.findOne({
        $or: [{ 'cliente._id': id }, { 'cliente.id_cliente': id }, { 'cliente.cedula': doc.cedula }]
      });
      if (tieneFacturas) {
        return res.status(409).json({
          success: false,
          error: { message: 'No se puede eliminar el cliente porque tiene facturas registradas a su nombre.' }
        });
      }
    }

    await clientes.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      data: { message: `Cliente '${id}' eliminado con éxito.` }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: `Error al eliminar cliente: ${error.message}` }
    });
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar
};
