'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { buildUploadFileName } = require('../utils/ids');

const FOLDERS = {
  platos: 'Platos',
  logos: 'Logos'
};

function fileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimeValido = config.allowedImageMimeTypes.includes(file.mimetype);
  const extensionValida = config.allowedImageExtensions.includes(extension);

  if (!mimeValido || !extensionValida) {
    const error = new Error('Solo se permiten imágenes JPG, JPEG, PNG, WEBP o GIF.');
    error.status = 400;
    error.expose = true;
    return callback(error);
  }

  return callback(null, true);
}

function createUploader(folder, prefixResolver) {
  const destination = path.join(config.uploadsDir, folder);
  fs.mkdirSync(destination, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, destination),
    filename: (req, file, callback) => {
      let prefix = 'ARCHIVO';
      try {
        prefix = prefixResolver(req) || prefix;
      } catch (_error) {
        // Si no se pudo resolver el ID se usa un prefijo genérico.
      }
      return callback(null, buildUploadFileName(prefix, file.originalname));
    }
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: config.maxUploadBytes }
  });
}

function relativeUploadPath(folder, filename) {
  return `/Uploads/${folder}/${filename}`;
}

function removeUploadedFile(file) {
  if (!file || !file.path) return Promise.resolve();

  return fs.promises.unlink(file.path).catch((error) => {
    if (error.code !== 'ENOENT') {
      console.warn(`[uploads] No se pudo borrar ${file.path}: ${error.message}`);
    }
  });
}

/**
 * Borra un archivo usando la ruta relativa guardada en MongoDB
 * (/Uploads/Platos/PLA001_foto.jpg). Solo permite rutas dentro de public/uploads.
 */
function removeUploadByRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('/Uploads/')) {
    return Promise.resolve();
  }

  const safeRelative = relativePath.replace(/^\/Uploads\//, '');
  const absolute = path.resolve(config.uploadsDir, safeRelative);
  const uploadsRoot = path.resolve(config.uploadsDir);

  if (!absolute.startsWith(uploadsRoot + path.sep)) {
    return Promise.resolve();
  }

  return fs.promises.unlink(absolute).catch((error) => {
    if (error.code !== 'ENOENT') {
      console.warn(`[uploads] No se pudo borrar ${absolute}: ${error.message}`);
    }
  });
}

/**
 * Envuelve multer para transformar sus errores en mensajes flash amigables.
 */
function handleUpload(uploader, fieldName, redirectResolver) {
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (error) => {
      if (!error) {
        return next();
      }

      let message = error.message || 'No se pudo subir el archivo.';
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        message = `El archivo supera el límite de ${Math.round(config.maxUploadBytes / (1024 * 1024))} MB.`;
      }

      if (req.session && typeof req.flash === 'function') {
        req.flash('error', message);
      }

      const redirectTo =
        typeof redirectResolver === 'function' ? redirectResolver(req) : redirectResolver;
      return res.redirect(redirectTo || req.get('referer') || '/');
    });
  };
}

const platosUpload = createUploader(FOLDERS.platos, (req) => req.params.id || req.nextPlatoId || 'PLA000');
const logosUpload = createUploader(FOLDERS.logos, (req) => req.params.id || req.nextEmpresaId || 'LOC000');

module.exports = {
  FOLDERS,
  platosUpload,
  logosUpload,
  relativeUploadPath,
  removeUploadedFile,
  removeUploadByRelativePath,
  handleUpload
};
