'use strict';

const {
  mapCategoria,
  mapCliente,
  mapEmpresa,
  mapPlato,
  mapFactura,
  sumarDetalles,
  categoriasConPlatos
} = require('../utils/documents');
const {
  roundMoney,
  toDecimal128
} = require('../utils/format');
const { nextSequentialId, escapeRegex } = require('../utils/ids');
const { logBuscarCliente } = require('../utils/logger');
const { createHttpError } = require('../utils/http');

function extraerCantidades(body) {
  let crudas = body && body.cantidades;

  if (!crudas || typeof crudas !== 'object') {
    crudas = {};
    for (const [clave, valor] of Object.entries(body || {})) {
      const coincidencia = /^cantidades\[([^\]]+)\]$/.exec(clave);
      if (coincidencia) {
        crudas[coincidencia[1]] = valor;
      }
    }
  }

  const items = [];
  for (const [idPlato, valor] of Object.entries(crudas)) {
    const texto = String(valor ?? '').trim();
    if (!/^\d+$/.test(texto)) continue;

    const cantidad = Number.parseInt(texto, 10);
    if (Number.isInteger(cantidad) && cantidad > 0) {
      items.push({ idPlato, cantidad });
    }
  }

  return items;
}

async function crear(req, res) {
  const context = req.app.locals.context;

  const [categoriasDocs, platosDocs] = await Promise.all([
    context.categorias.find({}).sort({ _id: 1 }).toArray(),
    context.platos.find({}).sort({ _id: 1 }).toArray()
  ]);

  const categorias = categoriasDocs.map(mapCategoria);
  const platos = platosDocs.map(mapPlato);

  const [clienteDoc, empresasDocs] = await Promise.all([
    context.clientes.findOne({
      $or: [{ _id: 'CLI001' }, { cedula: '9999999999' }]
    }),
    context.empresas.find({}).sort({ _id: 1 }).toArray()
  ]);

  return res.render('facturacion/crear', {
    title: 'Punto de Venta - Facturación',
    categorias: categoriasConPlatos(categorias, platos),
    clientePorDefecto: mapCliente(clienteDoc),
    empresas: empresasDocs.map(mapEmpresa)
  });
}

async function buscarCliente(req, res) {
  const cedula = String(req.query.cedula || '').trim();

  try {
    await logBuscarCliente(`Cedula recibida: [${cedula || 'NULL'}]`);

    if (!cedula) {
      await logBuscarCliente('Cedula vacia');
      return res.json({ encontrado: false, mensaje: 'Cédula vacía o inválida.' });
    }

    const clienteDoc = await req.app.locals.context.clientes.findOne({
      cedula: { $regex: `^${escapeRegex(cedula)}$` }
    });

    if (!clienteDoc) {
      await logBuscarCliente('Resultado: NO ENCONTRADO');
      return res.json({ encontrado: false });
    }

    const cliente = mapCliente(clienteDoc);
    await logBuscarCliente(`Resultado: ENCONTRADO - ${cliente.nombre}`);

    return res.json({
      encontrado: true,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo
    });
  } catch (error) {
    await logBuscarCliente(`EXCEPTION: ${error.message}`);
    return res.json({ encontrado: false, error: error.message });
  }
}

async function resolverCliente(context, datos) {
  let clienteDoc = await context.clientes.findOne({ cedula: datos.cedula });
  if (clienteDoc) {
    return clienteDoc;
  }

  const nuevoId = await nextSequentialId(context.clientes, 'CLI');
  const nuevoCliente = {
    _id: nuevoId,
    cedula: datos.cedula,
    nombre: datos.nombre || 'Consumidor',
    apellido: datos.apellido || 'Final'
  };

  if (datos.telefono) nuevoCliente.telefono = datos.telefono;
  if (datos.correo) nuevoCliente.correo = datos.correo;

  try {
    await context.clientes.insertOne(nuevoCliente);
    return nuevoCliente;
  } catch (error) {
    if (error && error.code === 11000) {
      // Otra petición pudo insertar la misma cédula al mismo tiempo.
      clienteDoc = await context.clientes.findOne({ cedula: datos.cedula });
      if (clienteDoc) return clienteDoc;
    }
    throw error;
  }
}

async function procesarSeleccion(req, res) {
  const context = req.app.locals.context;
  const items = extraerCantidades(req.body);

  if (items.length === 0) {
    req.flash('error', 'Debes seleccionar al menos un plato con una cantidad válida.');
    return res.redirect('/Facturacion/Crear');
  }

  const idEmpresa = String(req.body.id_empresa || '').trim();
  if (!idEmpresa) {
    req.flash('error', 'Debe seleccionar una empresa válida para emitir la factura.');
    return res.redirect('/Facturacion/Crear');
  }

  const cedulaCliente = String(req.body.cedula_cliente || '').trim();
  if (!cedulaCliente) {
    req.flash('error', 'La cédula o identificación del cliente es mandatoria.');
    return res.redirect('/Facturacion/Crear');
  }

  const clienteDoc = await resolverCliente(context, {
    cedula: cedulaCliente,
    nombre: String(req.body.nombre_cliente || '').trim(),
    apellido: String(req.body.apellido_cliente || '').trim(),
    telefono: String(req.body.tel_cliente || '').trim(),
    correo: String(req.body.correo_cliente || '').trim()
  });
  const cliente = mapCliente(clienteDoc);

  const idEmpleado = req.session && req.session.empleadoId;
  if (!idEmpleado) {
    req.flash('error', 'Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.');
    return res.redirect('/Account/Login');
  }

  const [empleadoDoc, empresaDoc] = await Promise.all([
    context.empleados.findOne({ _id: idEmpleado }),
    context.empresas.findOne({ _id: idEmpresa })
  ]);

  if (!empleadoDoc || !empresaDoc) {
    req.flash('error', 'Error al recuperar los datos del emisor. Intente de nuevo.');
    return res.redirect('/Facturacion/Crear');
  }

  const factura = {
    _id: await nextSequentialId(context.facturas, 'FAC'),
    fecha: new Date(),
    cliente: {
      id_cliente: cliente.id_cliente,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo
    },
    empleado: {
      id_emple: empleadoDoc._id,
      nombre: empleadoDoc.nombre,
      apellido: empleadoDoc.apellido,
      cargo: empleadoDoc.cargo
    },
    empresa: {
      id_empresa: empresaDoc._id,
      ruc: empresaDoc.ruc,
      nombre: empresaDoc.nombre,
      logo: empresaDoc.logo
    },
    detalleFacturas: []
  };

  for (const item of items) {
    const platoDoc = await context.platos.findOne({ _id: item.idPlato });
    if (!platoDoc) continue;

    const plato = mapPlato(platoDoc);
    const subtotalSinIva = roundMoney(plato.precio * item.cantidad);
    const valorIva = roundMoney(subtotalSinIva * 0.15);
    const subtotalConIva = roundMoney(subtotalSinIva + valorIva);
    const tarifaServicio = roundMoney(subtotalConIva * 0.1);
    const total = roundMoney(subtotalConIva + tarifaServicio);

    factura.detalleFacturas.push({
      plato: {
        id_plato: plato.id_plato,
        nombre: plato.nombre,
        precio: toDecimal128(plato.precio)
      },
      cantidad: item.cantidad,
      subtotal_sin_iva: toDecimal128(subtotalSinIva),
      valor_iva: toDecimal128(valorIva),
      subtotal_con_iva: toDecimal128(subtotalConIva),
      tarifa_servicio: toDecimal128(tarifaServicio),
      total: toDecimal128(total)
    });
  }

  if (factura.detalleFacturas.length === 0) {
    req.flash('error', 'Los platos seleccionados ya no existen en el menú. Intenta de nuevo.');
    return res.redirect('/Facturacion/Crear');
  }

  // Reintenta una vez si otro usuario generó el mismo ID secuencial al mismo tiempo.
  for (let intento = 0; ; intento += 1) {
    try {
      await context.facturas.insertOne(factura);
      break;
    } catch (error) {
      if (error && error.code === 11000 && intento < 2) {
        factura._id = await nextSequentialId(context.facturas, 'FAC');
        continue;
      }
      throw error;
    }
  }

  return res.redirect(`/Facturacion/VerFactura/${encodeURIComponent(factura._id)}`);
}

async function verFactura(req, res) {
  const facturaDoc = await req.app.locals.context.facturas.findOne({ _id: req.params.id });
  if (!facturaDoc) {
    throw createHttpError(404, 'La factura solicitada no existe.');
  }

  const factura = mapFactura(facturaDoc);

  return res.render('facturacion/verFactura', {
    title: `Factura ${factura.id_factura}`,
    factura,
    resumen: sumarDetalles(factura)
  });
}

async function facturasGuardadas(req, res) {
  const documentos = await req.app.locals.context.facturas
    .find({})
    .sort({ fecha: -1 })
    .toArray();

  return res.render('facturacion/facturasGuardadas', {
    title: 'Facturas Guardadas',
    facturas: documentos.map(mapFactura)
  });
}

async function reporte(req, res) {
  const documentos = await req.app.locals.context.facturas
    .find({})
    .sort({ fecha: -1 })
    .toArray();

  return res.render('facturacion/facturasGuardadas', {
    title: 'Reporte de Facturación',
    facturas: documentos.map(mapFactura)
  });
}

// ============================================================================

module.exports = {
  crear,
  buscarCliente,
  procesarSeleccion,
  verFactura,
  facturasGuardadas,
  reporte
};
