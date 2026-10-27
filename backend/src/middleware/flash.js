'use strict';

/**
 * Equivalente a TempData: el mensaje vive durante la redirección y se consume
 * en la siguiente petición.
 */
function flash(req, res, next) {
  if (!req.session) {
    return next();
  }

  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };

  const actual = req.session.flash || null;
  delete req.session.flash;
  res.locals.flash = actual;

  return next();
}

module.exports = { flash };
