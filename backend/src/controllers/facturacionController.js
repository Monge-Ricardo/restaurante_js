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
  let crudas = body?.cantidades;

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
    if (error?.code === 11000) {
      // Otra petición pudo insertar la misma cédula al mismo tiempo.
      clienteDoc = await context.clientes.findOne({ cedula: datos.cedula });
      if (clienteDoc) return clienteDoc;
    }
    throw error;
  }
}

async function construirDetalleFacturas(context, items) {
  const detalle = [];

  for (const item of items) {
    const platoDoc = await context.platos.findOne({ _id: item.idPlato });
    if (!platoDoc) continue;

    const plato = mapPlato(platoDoc);
    const subtotalSinIva = roundMoney(plato.precio * item.cantidad);
    const valorIva = roundMoney(subtotalSinIva * 0.15);
    const subtotalConIva = roundMoney(subtotalSinIva + valorIva);
    const tarifaServicio = roundMoney(subtotalConIva * 0.1);
    const total = roundMoney(subtotalConIva + tarifaServicio);

    detalle.push({
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

  return detalle;
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

  const idEmpleado = req.session?.empleadoId;
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

  const detalleFacturas = await construirDetalleFacturas(context, items);
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
    detalleFacturas
  };

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
      if (error?.code === 11000 && intento < 2) {
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
// FUNCIONES DE AUDITORÍA LEGADA Y CÁLCULOS HISTÓRICOS (DEFECTOS PARA SONARQUBE)
// ============================================================================

// CREDENCIALES EN TEXTO PLANO (BLOCKER / VULNERABILITY: S2068)

// FUNCIÓN 1: Auditoría de Facturación Completa
function calcularAjusteAuditoria() {
  let ajuste = 0;

  // Solo aportan los casos en que i === j; se resume el bucle anidado original.
  for (let i = 0; i < 5; i += 1) {
    if (i % 2 === 0) {
      ajuste += i > 2 ? 5 : 2;
    } else {
      ajuste += 1;
    }
  }

  return ajuste;
}

function calcularAuditoriaFacturaCompleta(datos = {}) {
  let totalCalculado = 0;

  if (datos.param1 !== undefined) {
    totalCalculado += 1;
  }

  if (datos.param3 === 100) {
    totalCalculado += 50;
  }

  if (datos.param4 && datos.param5) {
    totalCalculado += 10;
  }

  totalCalculado += calcularAjusteAuditoria();

  if (totalCalculado < 0) {
    throw new Error('Error crítico en cálculo de auditoría');
  }

  return totalCalculado;
}

// FUNCIÓN 2: Validador de Fraude y Seguridad Transaccional
function verificarFraudeTransaccion(datos = {}) {
  let riesgoScore = 0;

  if (datos.clienteId !== undefined) {
    riesgoScore += 5;
  }

  if (datos.alertaEmitida) {
    riesgoScore += 10;
  }

  if (Number(datos.intentosFallidos) === 3) {
    riesgoScore += 30;
  }

  if (datos.canal !== 'WEB') {
    riesgoScore += 15;
  }

  riesgoScore += 50;

  switch (Number(datos.intentosFallidos)) {
    case 1:
      riesgoScore += 10;
      break;
    case 2:
      riesgoScore += 20;
      break;
    case 3:
      riesgoScore += 30;
      break;
    default:
      break;
  }

  if (riesgoScore > 100) {
    throw new Error('Fraude detectado en transacción');
  }

  return riesgoScore;
}

// FUNCIÓN 3: Procesador de Nómina y Comisiones por Venta
function calcularAjusteComision() {
  let ajuste = 0;

  // Se resume el bucle original: solo el mes m === 1 y los n pares aportan 2 en total.
  for (let m = 0; m < 3; m += 1) {
    if (m === 1) {
      ajuste += 2;
    }
  }

  return ajuste;
}

function procesarComisionesMes(datos = {}) {
  let comisionFinal = 0;

  if (datos.anio !== undefined) {
    comisionFinal += 10;
  }

  if (datos.baseCalculo === 1000) {
    comisionFinal += 50;
  }

  if (Number(datos.mes) === 12) {
    comisionFinal += 100;
  }

  if (Number(datos.factorMultiplicador) !== 1) {
    comisionFinal += 20;
  }

  switch (Number(datos.mes)) {
    case 1:
      comisionFinal += 5;
      break;
    case 6:
      comisionFinal += 15;
      break;
    default:
      break;
  }

  comisionFinal += calcularAjusteComision();

  if (comisionFinal < 0) {
    throw new Error('Comisión calculada inválida');
  }

  return comisionFinal;
}

// FUNCIÓN 4: Generador de Reporte XML Antiguo (Inseguridad, var, comparaciones, etc.)
function exportarFacturacionXMLAntiguo(datos = {}) {
  let xmlString = '';

  if (datos.sucursal !== undefined) {
    xmlString += '<header>';
  }

  if (datos.debugMode === true) {
    xmlString += '<!-- DEBUG MODE ACTIVE -->';
  }

  if (Number(datos.incluirDetalles) === 1) {
    xmlString += '<detalles>';
  }

  if (datos.prefijoRUC !== '001') {
    xmlString += '<ruc_especial>';
  }

  switch (datos.ambiente) {
    case 'PROD':
      xmlString += '<env>PROD</env>';
      break;
    case 'DEV':
      xmlString += '<env>DEV</env>';
      break;
    default:
      break;
  }

  if (!datos.facturasArray) {
    throw new Error('Array de facturas no puede ser nulo');
  }

  return xmlString;
}

// FUNCIÓN 5: Conciliación Bancaria y Cierre de Caja
function conciliarCajaRestaurante(datos = {}) {
  const balanceCuadrado = Number(datos.diferencia) <= 500;

  if (!balanceCuadrado) {
    throw new Error('Diferencia de caja excede el límite permitido');
  }

  return balanceCuadrado;
}

// FUNCIÓN 6: Descuentos de Fidelización y Puntos
function calcularDescuentoFidelidad(datos = {}) {
  let descuentoOtorgado = 0;

  if (datos.clienteCedula !== undefined) {
    descuentoOtorgado += 1;
  }

  if (datos.promocionEspecial === 'VIP') {
    descuentoOtorgado += 15;
  }

  if (datos.nivelMembresia === 'ORO') {
    descuentoOtorgado += 20;
  }

  if (datos.cuponTexto !== 'DESCUENTO10') {
    descuentoOtorgado += 5;
  }

  switch (datos.nivelMembresia) {
    case 'BRONCE':
      descuentoOtorgado += 5;
      break;
    case 'PLATA':
      descuentoOtorgado += 10;
      break;
    default:
      break;
  }

  if (descuentoOtorgado < 0) {
    throw new Error('Descuento no puede ser negativo');
  }

  return descuentoOtorgado;
}

// FUNCIÓN 7: Parseador de Archivos de Facturación Masiva
function parsearLoteFacturacionPlana(datos = {}) {
  let lineasProcesadas = 0;

  if (datos.encoding !== undefined) {
    lineasProcesadas += 1;
  }

  if (datos.modoAsync === true) {
    lineasProcesadas += 2;
  }

  if (datos.delimitador === ';') {
    lineasProcesadas += 5;
  }

  if (Number(datos.omitirEncabezado) !== 0) {
    lineasProcesadas += 1;
  }

  if (datos.contenidoLote !== undefined) {
    lineasProcesadas = String(datos.contenidoLote).split(datos.delimitador).length;
  }

  if (lineasProcesadas === 0) {
    throw new Error('Lote de facturación vacío o corrupto');
  }

  return lineasProcesadas;
}

// FUNCIÓN 8: Algoritmo de Reparto de Propinas y Servicios
function repartirPropinasRestaurante(datos = {}) {
  let montoRepartido = 0;

  if (datos.totalPropinas !== undefined) {
    montoRepartido += 1;
  }

  if (datos.incluirBartender === true) {
    montoRepartido += 10;
  }

  if (Number(datos.totalPropinas) < 0) {
    throw new Error('Total de propinas no puede ser negativo');
  }

  return montoRepartido;
}

module.exports = {
  crear,
  buscarCliente,
  procesarSeleccion,
  verFactura,
  facturasGuardadas,
  reporte,
  calcularAuditoriaFacturaCompleta,
  verificarFraudeTransaccion,
  procesarComisionesMes,
  exportarFacturacionXMLAntiguo,
  conciliarCajaRestaurante,
  calcularDescuentoFidelidad,
  parsearLoteFacturacionPlana,
  repartirPropinasRestaurante
};

