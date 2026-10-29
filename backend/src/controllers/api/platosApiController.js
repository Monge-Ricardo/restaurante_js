'use strict';




const Plato = require('../../models/Plato');
const { mapPlato, mapCategoria } = require('../../utils/documents');
const { parseDecimal, toDecimal128 } = require('../../utils/format');
const { validarNumeroPositivo } = require('../../utils/validaciones');
const { nextSequentialId } = require('../../utils/ids');

function respuestaPlatoNoEncontrado(res, id) {
  return res.status(404).json({
    success: false,
    message: `El plato con ID '${id}' no existe.`
  });
}

function respuestaErrorMongo(res, error) {
  if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
    return res.status(503).json({
      success: false,
      message: 'Servicio no disponible. No se pudo conectar a la base de datos.'
    });
  }

  if (error.name === 'MongoServerError' && error.code === 50) {
    return res.status(504).json({
      success: false,
      message: 'La consulta tardó demasiado tiempo. Intente de nuevo.'
    });
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/platos
// GET /api/v1/platos?categoria=CAT001
// ─────────────────────────────────────────────────────────────────────────────
async function listarPlatos(req, res, next) {
  try {
    const { categoria } = req.query;
    const filtro = {};

    // Filtrar por categoría si se envía como query param
    if (categoria) {
      filtro['categoria._id'] = categoria;
    }

    const docs = await req.app.locals.context.platos
      .find(filtro)
      .sort({ _id: 1 })
      .toArray();

    return res.json({
      success: true,
      data: docs.map(mapPlato)
    });
  } catch (error) {
    const respuesta = respuestaErrorMongo(res, error);
    if (respuesta) return respuesta;

    // Cualquier otro error inesperado
    console.error('Error en listarPlatos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener los platos.'
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/platos/:id
// ─────────────────────────────────────────────────────────────────────────────
async function obtenerPlatoPorId(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await req.app.locals.context.platos.findOne({ _id: id });

    if (!doc) {
      return respuestaPlatoNoEncontrado(res, id);
    }

    return res.json({
      success: true,
      data: mapPlato(doc)
    });
  } catch (error) {
    const respuesta = respuestaErrorMongo(res, error);
    if (respuesta) return respuesta;

    console.error('Error en obtenerPlatoPorId:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener el plato.'
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/platos
// Body JSON: { nombre, descripcion, precio, id_categoria, imagen? }
// ─────────────────────────────────────────────────────────────────────────────
async function crearPlato(req, res, next) {
  try {
    const { nombre, descripcion, id_categoria, imagen } = req.body;
    const precio = parseDecimal(req.body.precio);

    // Validaciones de campos obligatorios
    if (!String(nombre || '').trim()) {
      return res.status(400).json({
        success: false,
        field: 'nombre',
        message: 'El nombre del plato es obligatorio.'
      });
    }

    if (!String(descripcion || '').trim()) {
      return res.status(400).json({
        success: false,
        field: 'descripcion',
        message: 'La descripción del plato es obligatoria.'
      });
    }

    if (!id_categoria) {
      return res.status(400).json({
        success: false,
        field: 'id_categoria',
        message: 'El campo id_categoria es obligatorio.'
      });
    }

    // Regla crítica: validar que el precio sea mayor a 0
    if (!validarNumeroPositivo(precio)) {
      return res.status(400).json({
        success: false,
        field: 'precio',
        message: 'El precio debe ser un número mayor a 0.'
      });
    }

    // Regla crítica: verificar que la categoría exista
    const categoriaDoc = await req.app.locals.context.categorias.findOne({
      _id: id_categoria
    });

    if (!categoriaDoc) {
      return res.status(400).json({
        success: false,
        field: 'id_categoria',
        message: `La categoría con ID '${id_categoria}' no existe.`
      });
    }

    // Generar ID secuencial con prefijo PLA (PLA001, PLA002, ...)
    const nuevoId = await nextSequentialId(
      req.app.locals.context.platos,
      'PLA'
    );

    const categoria = mapCategoria(categoriaDoc);

    const nuevoPlatoDoc = {
      _id: nuevoId,
      nombre: String(nombre).trim(),
      descripcion: String(descripcion).trim(),
      categoria: {
        _id: categoria.id_categoria,
        nombre: categoria.nombre
      },
      precio: toDecimal128(precio), // Regla crítica: guardar como Decimal128
      imagen: imagen || null
    };

    await req.app.locals.context.platos.insertOne(nuevoPlatoDoc);

    return res.status(201).json({
      success: true,
      message: `Plato '${nuevoId}' creado exitosamente.`,
      data: mapPlato(nuevoPlatoDoc)
    });
  } catch (error) {
    return next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/platos/:id
// Body JSON (campos opcionales): { nombre?, descripcion?, precio?, id_categoria?, imagen? }
// ─────────────────────────────────────────────────────────────────────────────
async function editarPlato(req, res, next) {
  try {
    const { id } = req.params;

    const platoExistente = await req.app.locals.context.platos.findOne({
      _id: id
    });

    if (!platoExistente) {
      return respuestaPlatoNoEncontrado(res, id);
    }

    const updates = {};

    if (req.body.nombre !== undefined) {
      updates.nombre = String(req.body.nombre).trim();
    }

    if (req.body.descripcion !== undefined) {
      updates.descripcion = String(req.body.descripcion).trim();
    }

    if (req.body.imagen !== undefined) {
      updates.imagen = req.body.imagen;
    }

    // Si actualiza precio: validar y guardar como Decimal128
    if (req.body.precio !== undefined) {
      const precio = parseDecimal(req.body.precio);

      if (!validarNumeroPositivo(precio)) {
        return res.status(400).json({
          success: false,
          field: 'precio',
          message: 'El precio debe ser un número mayor a 0.'
        });
      }

      updates.precio = toDecimal128(precio);
    }

    // Si actualiza categoría: verificar que exista
    if (req.body.id_categoria !== undefined) {
      const catDoc = await req.app.locals.context.categorias.findOne({
        _id: req.body.id_categoria
      });

      if (!catDoc) {
        return res.status(400).json({
          success: false,
          field: 'id_categoria',
          message: `La categoría '${req.body.id_categoria}' no existe.`
        });
      }

      const cat = mapCategoria(catDoc);
      updates.categoria = { _id: cat.id_categoria, nombre: cat.nombre };
    }

    await req.app.locals.context.platos.updateOne(
      { _id: id },
      { $set: updates }
    );

    const platoActualizado = await req.app.locals.context.platos.findOne({
      _id: id
    });

    return res.json({
      success: true,
      message: `Plato '${id}' actualizado correctamente.`,
      data: mapPlato(platoActualizado)
    });
  } catch (error) {
    return next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/platos/:id
// ─────────────────────────────────────────────────────────────────────────────
async function eliminarPlato(req, res, next) {
  try {
    const { id } = req.params;

    const resultado = await req.app.locals.context.platos.deleteOne({
      _id: id
    });

    if (resultado.deletedCount === 0) {
      return respuestaPlatoNoEncontrado(res, id);
    }

    return res.json({
      success: true,
      message: `Plato '${id}' eliminado con éxito.`
    });
  } catch (error) {
    return next(error);
  }
}

function calcularCaloriasAlergenos(idPlato, datos = {}) {
  let balanceNutricional = 0;

  if (idPlato) {
    balanceNutricional += 1;
  }

  const sodio = Number(datos.sodio);
  if (!Number.isNaN(sodio) && sodio > 0) {
    balanceNutricional += sodio;
  }

  if (datos.esVegano === true) {
    balanceNutricional += 10;
  }

  if (datos.calorias === 500) {
    balanceNutricional += 20;
  }

  if (datos.tieneGluten) {
    balanceNutricional += 5;
  }

  switch (datos.origenIngrediente) {
    case 'LOCAL':
      balanceNutricional += 5;
      break;
    case 'IMPORTADO':
      balanceNutricional += 10;
      break;
    default:
      balanceNutricional += 1;
      break;
  }

  balanceNutricional += 12;

  if (balanceNutricional < 0) {
    throw new Error('Error en balance nutricional del plato');
  }

  return balanceNutricional;
}

module.exports = {
  listarPlatos,
  obtenerPlatoPorId,
  crearPlato,
  editarPlato,
  eliminarPlato,
  calcularCaloriasAlergenos
};


