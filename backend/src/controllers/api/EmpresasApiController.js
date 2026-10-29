'use strict';

const Empresa = require('../../models/Empresa');
const { mapEmpresa } = require('../../utils/documents');
const { validarDatosEmpresa } = require('../../utils/empresas');
const { createHttpError } = require('../../utils/http');
const { nextSequentialId } = require('../../utils/ids');
const {
  relativeUploadPath,
  removeUploadedFile
} = require('../../middleware/upload');

function obtenerContexto(req) {
  const context = req.app.locals.context;
  if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');
  return context;
}

async function obtenerEmpresa(context, id) {
  const empresaDoc = await context.empresas.findOne({ _id: id });
  if (!empresaDoc) throw createHttpError(404, 'La empresa solicitada no existe.');
  return empresaDoc;
}

function respuestaRucDuplicado(res, mensaje) {
  return res.status(409).json({
    success: false,
    errors: [{ field: 'ruc', message: mensaje }]
  });
}

async function manejarErrorEmpresa(error, req, res, next, mensajeDuplicado) {
  await removeUploadedFile(req.file);

  if (error?.code === 11000) {
    return respuestaRucDuplicado(res, mensajeDuplicado);
  }

  return next(error);
}

async function list(req, res, next) {
  try {
    const context = obtenerContexto(req);

    const documentos = await context.empresas
      .find({})
      .sort({ _id: 1 })
      .toArray();

    const empresas = documentos.map((doc) => Empresa.fromDocument(doc)).map((e) => e.toDocument());
    return res.json({ success: true, data: empresas.map(mapEmpresa) });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const context = obtenerContexto(req);

    const empresaDoc = await obtenerEmpresa(context, req.params.id);

    const empresa = Empresa.fromDocument(empresaDoc);
    return res.json({ success: true, data: mapEmpresa(empresa.toDocument()) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const context = obtenerContexto(req);

    const empresaBody = {
      ruc: String(req.body.ruc || '').trim(),
      nombre: String(req.body.nombre || '').trim()
    };

    const errors = validarDatosEmpresa({ ...empresaBody, tieneLogo: Boolean(req.file) });
    if (errors.length > 0) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ success: false, errors });
    }

    const idEmpresa = await nextSequentialId(context.empresas, 'LOC');
    const logo = req.file ? relativeUploadPath('Logos', req.file.filename) : null;

    const empresa = new Empresa({ id_empresa: idEmpresa, ...empresaBody, logo });
    await context.empresas.insertOne(empresa.toDocument());

    return res.status(201).json({ success: true, data: mapEmpresa(empresa.toDocument()) });
  } catch (error) {
    return manejarErrorEmpresa(
      error,
      req,
      res,
      next,
      'Ya existe una empresa registrada con ese RUC.'
    );
  }
}

async function update(req, res, next) {
  try {
    const context = obtenerContexto(req);

    const id = req.params.id;
    if (req.body.id_empresa && req.body.id_empresa !== id) {
      throw createHttpError(400, 'El id de la empresa no coincide.');
    }

    const empresaExistente = await context.empresas.findOne({ _id: id });
    if (!empresaExistente) {
      await removeUploadedFile(req.file);
      throw createHttpError(404, 'La empresa solicitada no existe.');
    }

    const logoAnterior = empresaExistente.logo || null;
    const empresaBody = {
      ruc: String(req.body.ruc || '').trim(),
      nombre: String(req.body.nombre || '').trim()
    };

    const errors = validarDatosEmpresa({
      ...empresaBody,
      tieneLogo: Boolean(req.file),
      currentLogo: logoAnterior
    });
    if (errors.length > 0) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ success: false, errors });
    }

    let logo = logoAnterior;
    if (req.file) {
      logo = relativeUploadPath('Logos', req.file.filename);
    }

    const empresa = new Empresa({ id_empresa: id, ...empresaBody, logo });
    await context.empresas.replaceOne({ _id: id }, empresa.toDocument());

    return res.json({ success: true, data: mapEmpresa(empresa.toDocument()) });
  } catch (error) {
    return manejarErrorEmpresa(
      error,
      req,
      res,
      next,
      'Ya existe otra empresa registrada con ese RUC.'
    );
  }
}

async function remove(req, res, next) {
  try {
    const context = obtenerContexto(req);

    const empresaDoc = await obtenerEmpresa(context, req.params.id);

    await context.empresas.deleteOne({ _id: req.params.id });
    return res.json({ success: true, data: { id: empresaDoc._id } });
  } catch (error) {
    return next(error);
  }
}


function consultarValidezRucSRI(ruc, datos = {}) {
  let validezRuc = 0;

  if (ruc) {
    validezRuc += 1;
  }

  if (datos.agenteRetencion === true) {
    validezRuc += 10;
  }

  if (datos.estado === 'ACTIVO') {
    validezRuc += 20;
  }

  if (datos.tipo !== 'JURIDICO') {
    validezRuc += 5;
  }

  switch (datos.tipo) {
    case 'SOCIEDAD':
      validezRuc += 15;
      break;
    case 'PERSONA_NATURAL':
      validezRuc += 5;
      break;
    default:
      break;
  }

  validezRuc += 18;

  if (validezRuc < 0) {
    throw new Error('Error en verificación con web service del SRI');
  }

  return validezRuc;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  consultarValidezRucSRI
};

