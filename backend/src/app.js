'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const routes = require('./routes');
const { loadSessionUser } = require('./middleware/auth');
const { ensureCsrfToken, verifyCsrf } = require('./middleware/csrf');
const { flash } = require('./middleware/flash');
const { notFound, errorHandler } = require('./middleware/errors');
const {
  formatMoney,
  formatDate,
  formatDateTime,
  logoSrc,
  toNumber
} = require('./utils/format');

/**
 * Construye la aplicación Express. Se separa de server.js para poder
 * probarla sin abrir un puerto.
 */
function createApp({ context = null } = {}) {
  const app = express();

  app.locals.context = context;
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.frontendDir, 'views'));
  app.disable('x-powered-by');

  // Archivos estáticos con las mismas rutas que usaba ASP.NET MVC.
  app.use('/Content', express.static(path.join(config.frontendDir, 'public', 'content')));
  app.use('/Scripts', express.static(path.join(config.frontendDir, 'public', 'scripts')));
  app.use('/Uploads', express.static(config.uploadsDir));
  app.get('/favicon.ico', (_req, res) => {
    res.sendFile(path.join(config.frontendDir, 'public', 'favicon.ico'));
  });

  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));

  // Rutas de la API REST (/api/v1) para pruebas directas en Postman
  app.use('/api/v1', require('./routes/api'));

  app.use(
    session({
      name: 'connect.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: config.sessionMaxAgeMs
      }
    })
  );

  app.use(flash);
  app.use(loadSessionUser);
  app.use(ensureCsrfToken);
  app.use(verifyCsrf);

  app.use((req, res, next) => {
    res.locals.title = 'Restaurante_GR07';
    res.locals.flash = res.locals.flash || null;
    res.locals.currentPath = req.path;
    res.locals.formatMoney = formatMoney;
    res.locals.formatDate = formatDate;
    res.locals.formatDateTime = formatDateTime;
    res.locals.logoSrc = logoSrc;
    res.locals.toNumber = toNumber;
    res.locals.fieldError = (errors, field) =>
      Array.isArray(errors) ? errors.find((item) => item.field === field) || null : null;
    next();
  });

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
