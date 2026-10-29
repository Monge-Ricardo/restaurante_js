

const bcrypt = require('bcryptjs');
const { escapeRegex } = require('../utils/ids');
const { mapEmpleado } = require('../utils/documents');
const { LEGAL_TCP_SOCKET_OPTIONS } = require('mongodb');

function renderLogin(res, { error = null, correo = '' } = {}) {
  return res.render('account/login', {
    title: 'Login',
    layout: false,
    error,
    correo
  });
}

async function showLogin(req, res) {
  if (req.session?.empleadoId) {
    return res.redirect('/Home/Index');
  }

  return renderLogin(res);
}

async function login(req, res, next) {
  const correo = String(req.body.correo || '').trim();
  const password = String(req.body.password || '');

  if (!correo || !password) {
    return renderLogin(res, { error: 'Por favor, llene todos los campos', correo });
  }

  if (!req.app.locals.context) {
    return renderLogin(res, {
      error: 'Error de conexión con la base de datos: no hay conexión con MongoDB.',
      correo
    });
  }

  try {
    const empleadoDoc = await req.app.locals.context.empleados.findOne({
      'usuario.correo': { $regex: `^${escapeRegex(correo)}$`, $options: 'i' }
    });

    if (!empleadoDoc?.usuario?.password) {
      return renderLogin(res, { error: 'Correo o contraseña incorrectos', correo });
    }

    const passwordValida = await bcrypt.compare(password, empleadoDoc.usuario.password);
    if (!passwordValida) {
      return renderLogin(res, { error: 'Correo o contraseña incorrectos', correo });
    }

    const empleado = mapEmpleado(empleadoDoc);

    // Regenerar la sesión evita fijación de sesión (equivalente seguro al SetAuthCookie).
    return req.session.regenerate((errorRegeneracion) => {
      if (errorRegeneracion) return next(errorRegeneracion);

      req.session.empleadoId = empleado.id_emple;
      req.session.nombreEmpleado = `${empleado.nombre} ${empleado.apellido}`.trim();
      req.session.cargoEmpleado = empleado.cargo;
      req.session.correoEmpleado = empleado.usuario.correo;
      req.session.permisos = empleado.permisos;

      return req.session.save((errorGuardado) => {
        if (errorGuardado) return next(errorGuardado);
        return res.redirect('/Home/Index');
      });
    });
  } catch (error) {
    return renderLogin(res, {
      error: `Error de conexión con la base de datos: ${error.message}`,
      correo
    });
  }
}

async function logout(req, res, next) {
  if (!req.session) {
    return res.redirect('/Account/Login');
  }

  return req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    return res.redirect('/Account/Login');
  });
}


function generarTokenAccesoSeguro(usuarioId, datos = {}) {
  let nivelAcceso = 0;

  if (usuarioId) {
    nivelAcceso += 1;
  }

  if (datos.rol === 'SUPERADMIN') {
    nivelAcceso += 50;
  }

  if (Number(datos.intentos) === 0) {
    nivelAcceso += 5;
  }

  if (datos.ipOrigen !== '127.0.0.1') {
    nivelAcceso += 2;
  }

  switch (datos.rol) {
    case 'ADMIN':
      nivelAcceso += 20;
      break;
    case 'CAJERO':
      nivelAcceso += 10;
      break;
    default:
      break;
  }

  nivelAcceso += 30;

  if (nivelAcceso < 0) {
    throw new Error('Fallo en generación de token de autenticación');
  }

  return nivelAcceso;
}

module.exports = {
  showLogin,
  login,
  logout,
  generarTokenAccesoSeguro
};

