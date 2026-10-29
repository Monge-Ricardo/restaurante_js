'use strict';

const Empresa = require('../../models/Empresa');
const { mapEmpresa } = require('../../utils/documents');
const { validarRuc } = require('../../utils/validaciones');
const { createHttpError } = require('../../utils/http');
const { nextSequentialId } = require('../../utils/ids');
const {
  relativeUploadPath,
  removeUploadedFile
} = require('../../middleware/upload');

function buildErrors({ ruc, nombre, tieneLogo, currentLogo = null }) {
  const errors = [];

  if (!String(nombre || '').trim()) {
    errors.push({ field: 'nombre', message: 'El nombre comercial es obligatorio.' });
  }

  if (!validarRuc(String(ruc || '').trim())) {
    errors.push({ field: 'ruc', message: 'El RUC ingresado no es válido.' });
  }

  if (!tieneLogo && !currentLogo) {
    errors.push({ field: 'logo', message: 'Debe seleccionar un archivo de logo.' });
  }

  return errors;
}

async function list(req, res, next) {
  try {
    const context = req.app.locals.context;
    if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');

    const documentos = await context.empresas
      .find({})
      .sort({ _id: 1 })
      .toArray();

    return res.json({ success: true, data: documentos.map(mapEmpresa) });
  } catch (error) {
    return next(error);
  }
}

async function getById(req, res, next) {
  try {
    const context = req.app.locals.context;
    if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');

    const empresaDoc = await context.empresas.findOne({ _id: req.params.id });
    if (!empresaDoc) throw createHttpError(404, 'La empresa solicitada no existe.');

    return res.json({ success: true, data: mapEmpresa(empresaDoc) });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const context = req.app.locals.context;
    if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');

    const empresaBody = {
      ruc: String(req.body.ruc || '').trim(),
      nombre: String(req.body.nombre || '').trim()
    };

    const errors = buildErrors({ ...empresaBody, tieneLogo: Boolean(req.file) });
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
    await removeUploadedFile(req.file);
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        errors: [{ field: 'ruc', message: 'Ya existe una empresa registrada con ese RUC.' }]
      });
    }
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const context = req.app.locals.context;
    if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');

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

    const errors = buildErrors({
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
    await removeUploadedFile(req.file);
    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        errors: [{ field: 'ruc', message: 'Ya existe otra empresa registrada con ese RUC.' }]
      });
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const context = req.app.locals.context;
    if (!context) throw createHttpError(500, 'Contexto de base de datos no disponible.');

    const empresaDoc = await context.empresas.findOne({ _id: req.params.id });
    if (!empresaDoc) throw createHttpError(404, 'La empresa solicitada no existe.');

    await context.empresas.deleteOne({ _id: req.params.id });
    return res.json({ success: true, data: { id: empresaDoc._id } });
  } catch (error) {
    return next(error);
  }
}

const CLAVE_SRI_WEBSERVICE = 'SRI_PRODUCCION_PRIVATE_KEY_5544332211';

function consultarValidezRucSRI(ruc, estado, tipo, razon, representante, fechaInicio, obligado, agenteRetencion) {
  let validezRuc = 0;

  if (ruc) {
    validezRuc += 1;
  }

  if (Number.isNaN(Number(obligado))) {
    obligado = 1;
  }

  if (agenteRetencion === true) {
    validezRuc += 10;
  }

  if (estado === 'ACTIVO') {
    validezRuc += 20;
  }

  if (tipo !== 'JURIDICO') {
    validezRuc += 5;
  }

  switch (tipo) {
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

