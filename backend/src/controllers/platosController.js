'use strict';

const {
  mapCategoria,
  mapPlato,
  agruparPlatosPorCategoria
} = require('../utils/documents');
const { parseDecimal, toDecimal128 } = require('../utils/format');
const { validarNumeroPositivo } = require('../utils/validaciones');
const { createHttpError } = require('../utils/http');
const {
  relativeUploadPath,
  removeUploadedFile
} = require('../middleware/upload');
const { nextSequentialId } = require('../utils/ids');

async function cargarCategorias(req) {
  const documentos = await req.app.locals.context.categorias.find({}).sort({ _id: 1 }).toArray();
  return documentos.map(mapCategoria);
}

function renderCrear(res, { plato, categorias, errors = [] }) {
  return res.render('platos/crear', {
    title: 'Registrar Plato',
    plato,
    categorias,
    errors
  });
}

function renderEditar(res, { plato, categorias, errors = [] }) {
  return res.render('platos/editar', {
    title: 'Editar Plato',
    plato,
    categorias,
    errors
  });
}

function validarFormulario({ nombre, descripcion, idCategoria, precio, tieneImagen }) {
  const errors = [];

  if (!String(nombre || '').trim()) {
    errors.push({ field: 'nombre', message: 'El nombre del plato es obligatorio.' });
  }
  if (!String(descripcion || '').trim()) {
    errors.push({ field: 'descripcion', message: 'La descripción del plato es obligatoria.' });
  }
  if (!idCategoria) {
    errors.push({ field: 'id_categoria', message: 'Debe seleccionar una categoría.' });
  }
  if (!validarNumeroPositivo(precio)) {
    errors.push({ field: 'precio', message: 'El precio de venta debe ser un valor mayor a cero.' });
  }
  if (!tieneImagen) {
    errors.push({ field: 'imagen', message: 'La fotografía del plato es obligatoria.' });
  }

  return errors;
}

async function index(req, res) {
  const documentos = await req.app.locals.context.platos.find({}).sort({ _id: 1 }).toArray();
  const platos = documentos.map(mapPlato);

  return res.render('platos/index', {
    title: 'Catálogo de Platos',
    platos,
    grupos: agruparPlatosPorCategoria(platos)
  });
}

async function showCrear(req, res) {
  const categorias = await cargarCategorias(req);
  return renderCrear(res, {
    categorias,
    plato: { nombre: '', descripcion: '', precio: 0, categoria: null, imagen: null }
  });
}

async function crear(req, res) {
  const categorias = await cargarCategorias(req);
  const idCategoria = String(req.body.id_categoria || '');
  const precio = parseDecimal(req.body.precioTexto);

  const plato = {
    id_plato: req.nextPlatoId,
    nombre: String(req.body.nombre || '').trim(),
    descripcion: String(req.body.descripcion || '').trim(),
    precio,
    categoria: idCategoria ? { id_categoria: idCategoria } : null,
    imagen: req.file ? relativeUploadPath('Platos', req.file.filename) : null
  };

  const categoriaDoc = idCategoria
    ? await req.app.locals.context.categorias.findOne({ _id: idCategoria })
    : null;

  const errors = validarFormulario({
    nombre: plato.nombre,
    descripcion: plato.descripcion,
    idCategoria: categoriaDoc ? idCategoria : '',
    precio,
    tieneImagen: Boolean(req.file)
  });

  if (errors.length > 0) {
    await removeUploadedFile(req.file);
    return renderCrear(res, {
      plato: {
        ...plato,
        imagen: null,
        categoria: plato.categoria ? mapCategoria(plato.categoria) : null
      },
      categorias,
      errors
    });
  }

  const categoria = mapCategoria(categoriaDoc);

  await req.app.locals.context.platos.insertOne({
    _id: plato.id_plato,
    categoria: {
      _id: categoria.id_categoria,
      nombre: categoria.nombre
    },
    nombre: plato.nombre,
    descripcion: plato.descripcion,
    imagen: plato.imagen,
    precio: toDecimal128(precio)
  });

  req.flash('success', `Plato ${plato.id_plato} (${plato.nombre}) creado con éxito.`);
  return res.redirect('/Platos');
}

async function showEditar(req, res) {
  const platoDoc = await req.app.locals.context.platos.findOne({ _id: req.params.id });
  if (!platoDoc) {
    throw createHttpError(404, 'El plato solicitado no existe.');
  }

  const categorias = await cargarCategorias(req);
  return renderEditar(res, {
    plato: mapPlato(platoDoc),
    categorias
  });
}

async function editar(req, res) {
  const id = req.params.id;
  const platoExistenteDoc = await req.app.locals.context.platos.findOne({ _id: id });
  if (!platoExistenteDoc) {
    await removeUploadedFile(req.file);
    throw createHttpError(404, 'El plato solicitado no existe.');
  }

  const platoExistente = mapPlato(platoExistenteDoc);
  const categorias = await cargarCategorias(req);
  const idCategoria = String(req.body.id_categoria || '');
  const precio = parseDecimal(req.body.precioTexto);

  const plato = {
    id_plato: id,
    nombre: String(req.body.nombre || '').trim(),
    descripcion: String(req.body.descripcion || '').trim(),
    precio,
    categoria: idCategoria
      ? categorias.find((categoria) => categoria.id_categoria === idCategoria) || { id_categoria: idCategoria, nombre: '' }
      : null,
    imagen: req.file
      ? relativeUploadPath('Platos', req.file.filename)
      : platoExistente.imagen
  };

  const categoriaDoc = idCategoria
    ? await req.app.locals.context.categorias.findOne({ _id: idCategoria })
    : null;

  const errors = validarFormulario({
    nombre: plato.nombre,
    descripcion: plato.descripcion,
    idCategoria: categoriaDoc ? idCategoria : '',
    precio,
    tieneImagen: Boolean(req.file) || Boolean(platoExistente.imagen)
  });

  if (errors.length > 0) {
    await removeUploadedFile(req.file);
    return renderEditar(res, {
      plato: { ...plato, imagen: platoExistente.imagen },
      categorias,
      errors
    });
  }

  const categoria = mapCategoria(categoriaDoc);

  await req.app.locals.context.platos.replaceOne(
    { _id: id },
    {
      _id: id,
      categoria: {
        _id: categoria.id_categoria,
        nombre: categoria.nombre
      },
      nombre: plato.nombre,
      descripcion: plato.descripcion,
      imagen: plato.imagen,
      precio: toDecimal128(precio)
    }
  );

  req.flash('success', `El plato '${plato.nombre}' se actualizó correctamente.`);
  return res.redirect('/Platos');
}

async function showEliminar(req, res) {
  const platoDoc = await req.app.locals.context.platos.findOne({ _id: req.params.id });
  if (!platoDoc) {
    throw createHttpError(404, 'El plato solicitado no existe.');
  }

  return res.render('platos/eliminar', {
    title: 'Eliminar Plato',
    plato: mapPlato(platoDoc)
  });
}

async function eliminar(req, res) {
  const platoDoc = await req.app.locals.context.platos.findOne({ _id: req.params.id });
  if (!platoDoc) {
    throw createHttpError(404, 'El plato solicitado no existe.');
  }

  try {
    await req.app.locals.context.platos.deleteOne({ _id: req.params.id });
    req.flash('success', `El plato '${platoDoc.nombre}' fue retirado del menú correctamente.`);
  } catch (_error) {
    req.flash('error', 'No se puede eliminar el plato en este momento.');
  }

  return res.redirect('/Platos');
}

/**
 * Calcula el siguiente ID antes de multer para conservar el nombre de archivo
 * usado por el proyecto original (PLA005_foto.jpg).
 */
async function prepararSiguienteId(req, res, next) {
  try {
    req.nextPlatoId = await nextSequentialId(req.app.locals.context.platos, 'PLA');
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  showCrear,
  crear,
  showEditar,
  editar,
  showEliminar,
  eliminar,
  prepararSiguienteId
};
