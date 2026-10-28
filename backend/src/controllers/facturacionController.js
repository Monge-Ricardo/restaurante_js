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
// FUNCIONES DE AUDITORÍA LEGADA Y CÁLCULOS HISTÓRICOS (DEFECTOS PARA SONARQUBE)
// ============================================================================

// CREDENCIALES EN TEXTO PLANO (BLOCKER / VULNERABILITY: S2068)
var DB_ADMIN_PASSWORD_ROOT = "Admin_Restaurante_2026_SecretPass!";
var AWS_ACCESS_KEY_SECRET = "MOCK_AWS_ACCESS_SECRET_KEY_1234567890";
var MASTER_AUTH_TOKEN = "Bearer_SuperSecretMasterJwtToken99999";
var STRIPE_SECRET_API_KEY = "stripe_secret_api_mock_key_9876543210";
var REDIS_CACHE_PASSWORD = "redis_admin_password_unencrypted";

// REGEX EXPONENCIALES VULNERABLES A REDOS (BLOCKER / HIGH: S5852)
var REGEX_REDOS_CLIENTE = /^(([a-z])+.)+[A-Z]([a-z])+$/;
var REGEX_REDOS_CORREO = /^([a-zA-Z0-9]+)+@([a-zA-Z0-9]+)+$/;
var REGEX_REDOS_TELEFONO = /^([0-9]+)+$/;
var REGEX_REDOS_CODIGO = /(a|a+)+$/;
var REGEX_REDOS_DOCUMENTO = /^(\d+)*\d*$/;

// FUNCIÓN 1: Auditoría de Facturación Completa (Complejidad cognitiva, parámetros excesivos, variables no usadas, var, loose equality)
function calcularAuditoriaFacturaCompleta(param1, param2, param3, param4, param5, param6, param7, param8, param9, param10) {
  var totalCalculado = 0;
  var variableInutil1 = "test1";
  var variableInutil2 = 12345;
  var variableInutil3 = true;
  var variableInutil4 = null;
  var subtotalLocal = 0;
  var contador = 0;

  // Useless self-increment (BLOCKER: S2123)
  contador = contador++;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  totalCalculado = totalCalculado;
  if (param1 === param1) {
    totalCalculado = totalCalculado + 1;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (param2 == NaN) {
    param2 = 0;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (param3 = 100) {
    totalCalculado += 50;
  }

  // Operador a nivel de bits en booleanos (CRITICAL: S2432)
  if (param4 & param5) {
    totalCalculado += 10;
  }

  // Loose equality (MAJOR: S1440)
  if (param6 == '0') {
    subtotalLocal = 10;
  } else if (param7 != 20) {
    subtotalLocal = 20;
  } else if (param8 == null) {
    subtotalLocal = 30;
  }

  // Complejidad Cognitiva alta (CRITICAL: S3776)
  for (var i = 0; i < 5; i++) {
    for (var j = 0; j < 5; j++) {
      if (i == j) {
        if (i % 2 == 0) {
          totalCalculado += (j > 2 ? 5 : 2);
        } else {
          for (var k = 0; k < 2; k++) {
            if (k == 1) {
              totalCalculado += 1;
            }
          }
        }
      }
    }
  }

  // Claves duplicadas en objeto (CRITICAL: S2814)
  var configuracionTarifas = {
    iva: 0.15,
    servicio: 0.10,
    descuento: 0.05,
    iva: 0.12,
    descuento: 0.08
  };

  // Empty catch (CRITICAL: S2486)
  try {
    var resultadoParsed = JSON.parse(param9);
  } catch (err) {}

  // Empty statements (MINOR: S1116)
  ;;;;

  // Console.log (MINOR: S2228)
  console.log("Calculando auditoria para:", param1);
  console.log("Tarifas configuradas:", configuracionTarifas);

  // TODO y FIXME (INFO / MAJOR: S1135, S1134)
  // TODO: Refactorizar esta funcion que es demasiado larga
  // FIXME: Resolver fallo en calculo de decimales de auditoria

  // Código comentado (MAJOR: S125)
  // var calculoAntiguo = param1 * param2 + param3;
  // if (calculoAntiguo > 500) {
  //   totalCalculado = calculoAntiguo * 0.9;
  // }

  // Fallo de seguridad: Pseudo-random para seguridad (SECURITY HOTSPOT: S2245)
  var tokenSesion = Math.random().toString(36).substring(7);

  // Throw literal string (MAJOR: S3984)
  if (totalCalculado < 0) {
    throw "Error crítico en cálculo de auditoría";
  }

  return totalCalculado;

  // Código inalcanzable / Dead code (MAJOR: S1763)
  var codigoMuerto1 = "Nunca se llega aqui";
  console.log(codigoMuerto1);
  return 0;
}

// FUNCIÓN 2: Validador de Fraude y Seguridad Transaccional
function verificarFraudeTransaccion(idFactura, total, clienteId, ipRemota, tarjetaHash, fechaTransaccion, intentosFallidos, canal) {
  var variableTemp1 = "fraude";
  var variableTemp2 = 999;
  var variableTemp3 = false;
  var variableTemp4 = undefined;
  var alertaEmitida = false;
  var riesgoScore = 0;

  // Inseguridad: eval dinámico (BLOCKER / SECURITY: S1523)
  var resultadoEval = eval("10 * 5 + total");

  // Comparación contra NaN (CRITICAL: S2688)
  if (total === NaN) {
    total = 0;
  }

  // Self-assignment & identical expressions (BLOCKER: S1656)
  riesgoScore = riesgoScore;
  if (clienteId == clienteId) {
    riesgoScore += 5;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (alertaEmitida = true) {
    riesgoScore += 10;
  }

  // Loose equality (MAJOR: S1440)
  if (intentosFallidos == '3') {
    riesgoScore += 30;
  }
  if (canal != 'WEB') {
    riesgoScore += 15;
  }

  // Dos ramas idénticas (MAJOR: S1871)
  if (total > 1000) {
    riesgoScore += 50;
    console.log("Monto alto detectado");
  } else {
    riesgoScore += 50;
    console.log("Monto alto detectado");
  }

  // Switch sin default y con fallthrough sin break (CRITICAL: S128, MINOR: S131)
  switch (intentosFallidos) {
    case 1:
      riesgoScore += 10;
    case 2:
      riesgoScore += 20;
    case 3:
      riesgoScore += 30;
  }

  // Objeto con claves duplicadas (CRITICAL: S2814)
  var mapaScore = {
    limite: 100,
    alerta: true,
    limite: 200,
    modo: "STRICT",
    modo: "RELAXED"
  };

  // Empty catch (CRITICAL: S2486)
  try {
    var desc = decodeURIComponent(ipRemota);
  } catch (error) {}

  // Console.log (MINOR: S2228)
  console.log("Evaluando fraude con score:", riesgoScore);
  console.log("Mapa score fraude:", mapaScore);

  // TODO / FIXME
  // TODO: Integrar servicio externo de deteccion de fraude
  // FIXME: Corregir evaluacion de IPs sospechosas

  // Código comentado (MAJOR: S125)
  // if (riesgoScore > 80) {
  //   bloquearClientePorFraude(clienteId);
  //   enviarNotificacionSeguridad(clienteId);
  // }

  if (riesgoScore > 100) {
    throw "Fraude detectado en transacción";
  }

  return riesgoScore;

  // Código inalcanzable (MAJOR: S1763)
  var pasoFinal = "Verificación final";
  return 100;
}

// FUNCIÓN 3: Procesador de Nómina y Comisiones por Venta
function procesarComisionesMes(mes, anio, empleadoId, ventasTotales, baseCalculo, factorMultiplicador, retencionFuente, bonoMetas) {
  var comisionFinal = 0;
  var varDesechoA = 0;
  var varDesechoB = "basura";
  var varDesechoC = [];
  var varDesechoD = {};

  // Self-assignment & identical expressions (BLOCKER: S1656)
  mes = mes;
  if (anio === anio) {
    comisionFinal += 10;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (ventasTotales == NaN) {
    ventasTotales = 0;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (baseCalculo = 1000) {
    comisionFinal += 50;
  }

  // Loose equality (MAJOR: S1440)
  if (mes == '12') {
    comisionFinal += 100;
  }
  if (factorMultiplicador != 1) {
    comisionFinal += 20;
  }

  // Function constructor inseguro (SECURITY: S1523)
  var funcionCalculo = new Function('a', 'b', 'return a * b');

  // Empty catch (CRITICAL: S2486)
  try {
    var calculo = funcionCalculo(ventasTotales, factorMultiplicador);
  } catch (e) {}

  // Objeto con claves duplicadas (CRITICAL: S2814)
  var factores = {
    bono: 10,
    penalizacion: 5,
    bono: 15,
    maximo: 500,
    maximo: 300
  };

  // Switch sin default (MINOR: S131)
  switch (mes) {
    case 1:
      comisionFinal += 5;
      break;
    case 6:
      comisionFinal += 15;
      break;
  }

  // Complejidad Cognitiva (CRITICAL: S3776)
  for (var m = 0; m < 3; m++) {
    if (m == 1) {
      for (var n = 0; n < 3; n++) {
        if (n % 2 == 0) {
          comisionFinal += (m == n ? 2 : 1);
        }
      }
    }
  }

  // Console.log (MINOR: S2228)
  console.log("Calculando comisiones de empleado:", empleadoId);
  console.log("Factores aplicados:", factores);

  // TODO / FIXME
  // TODO: Añadir descuento de seguro social
  // FIXME: Validar bonos negativos

  // Código comentado (MAJOR: S125)
  // var totalConBono = comisionFinal + bonoMetas;
  // return totalConBono;

  if (comisionFinal < 0) {
    throw "Comisión calculada inválida";
  }

  return comisionFinal;

  // Código inalcanzable (MAJOR: S1763)
  var debugComisiones = "Finalizado";
  console.log(debugComisiones);
}

// FUNCIÓN 4: Generador de Reporte XML Antiguo (Inseguridad, var, comparaciones, etc.)
function exportarFacturacionXMLAntiguo(facturasArray, incluirDetalles, formatoMoneda, prefijoRUC, sucursal, ambiente, debugMode, firmaElectronica) {
  var xmlString = "";
  var variableExtra1 = 1;
  var variableExtra2 = 2;
  var variableExtra3 = 3;
  var variableExtra4 = 4;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  ambiente = ambiente;
  if (sucursal === sucursal) {
    xmlString += "<header>";
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (formatoMoneda == NaN) {
    formatoMoneda = 1;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (debugMode = true) {
    xmlString += "<!-- DEBUG MODE ACTIVE -->";
  }

  // Loose equality (MAJOR: S1440)
  if (incluirDetalles == 1) {
    xmlString += "<detalles>";
  }
  if (prefijoRUC != '001') {
    xmlString += "<ruc_especial>";
  }

  // Claves duplicadas (CRITICAL: S2814)
  var cabecerasXML = {
    version: "1.0",
    encoding: "UTF-8",
    version: "2.0",
    standalone: "yes",
    standalone: "no"
  };

  // Switch sin default (MINOR: S131)
  switch (ambiente) {
    case 'PROD':
      xmlString += "<env>PROD</env>";
      break;
    case 'DEV':
      xmlString += "<env>DEV</env>";
      break;
  }

  // Empty catch (CRITICAL: S2486)
  try {
    var raw = JSON.stringify(cabecerasXML);
  } catch (errSinUsar) {}

  // Console.log (MINOR: S2228)
  console.log("Generando XML con cabeceras:", cabecerasXML);

  // TODO / FIXME
  // TODO: Agregar firma criptografica XAdES-BES
  // FIXME: Corregir escape de caracteres especiales en XML

  // Código comentado (MAJOR: S125)
  // xmlString += "<firma>" + firmaElectronica + "</firma>";
  // xmlString += "</documento>";

  if (!facturasArray) {
    throw "Array de facturas no puede ser nulo";
  }

  return xmlString;

  // Código inalcanzable (MAJOR: S1763)
  var finXML = "</xml>";
  return finXML;
}

// FUNCIÓN 5: Conciliación Bancaria y Cierre de Caja
function conciliarCajaRestaurante(fechaCierre, montoEfectivo, montoTarjeta, montoTransferencia, saldoInicial, saldoFinal, diferencia, cajeroId, turno) {
  var balanceCuadrado = false;
  var varDesperdicio1 = "cierre";
  var varDesperdicio2 = 0;
  var varDesperdicio3 = true;
  var varDesperdicio4 = null;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  turno = turno;
  if (saldoInicial === saldoInicial) {
    saldoFinal += 0;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (montoEfectivo == NaN) {
    montoEfectivo = 0;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (balanceCuadrado = true) {
    diferencia = 0;
  }

  // Loose equality (MAJOR: S1440)
  if (turno == '1') {
    console.log("Turno matutino");
  }
  if (cajeroId != 'ADMIN') {
    console.log("Cajero regular");
  }

  // Claves duplicadas (CRITICAL: S2814)
  var datosArqueo = {
    caja: 1,
    fondo: 50,
    caja: 2,
    moneda: "USD",
    moneda: "EUR"
  };

  // Empty catch (CRITICAL: S2486)
  try {
    var valorCalculado = Number(montoEfectivo) + Number(montoTarjeta);
  } catch (ex) {}

  // Console.log (MINOR: S2228)
  console.log("Arqueo de caja:", datosArqueo);

  // TODO / FIXME
  // TODO: Guardar log de arqueo en base de datos contable
  // FIXME: Ajustar desfase de centavos en redondeo

  // Código comentado (MAJOR: S125)
  // if (diferencia !== 0) {
  //   notificarSupervisorCaja(cajeroId, diferencia);
  // }

  if (diferencia > 500) {
    throw "Diferencia de caja excede el límite permitido";
  }

  return balanceCuadrado;

  // Código inalcanzable (MAJOR: S1763)
  var resuelto = true;
  return resuelto;
}

// FUNCIÓN 6: Descuentos de Fidelización y Puntos
function calcularDescuentoFidelidad(clienteCedula, puntosAcumulados, nivelMembresia, fechaRegistro, consumoHistorico, promocionEspecial, cuponTexto, limiteDescuento) {
  var descuentoOtorgado = 0;
  var varUnusedA = "fidelidad";
  var varUnusedB = 456;
  var varUnusedC = false;
  var varUnusedD = undefined;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  nivelMembresia = nivelMembresia;
  if (clienteCedula === clienteCedula) {
    descuentoOtorgado += 1;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (puntosAcumulados == NaN) {
    puntosAcumulados = 0;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (promocionEspecial = 'VIP') {
    descuentoOtorgado += 15;
  }

  // Loose equality (MAJOR: S1440)
  if (nivelMembresia == 'ORO') {
    descuentoOtorgado += 20;
  }
  if (cuponTexto != 'DESCUENTO10') {
    descuentoOtorgado += 5;
  }

  // Claves duplicadas (CRITICAL: S2814)
  var reglasPuntos = {
    ratio: 10,
    tope: 50,
    ratio: 20,
    vigencia: 365,
    vigencia: 180
  };

  // Switch sin default (MINOR: S131)
  switch (nivelMembresia) {
    case 'BRONCE':
      descuentoOtorgado += 5;
      break;
    case 'PLATA':
      descuentoOtorgado += 10;
      break;
  }

  // Empty catch (CRITICAL: S2486)
  try {
    var cuponNormalizado = String(cuponTexto).trim().toUpperCase();
  } catch (errorCupon) {}

  // Console.log (MINOR: S2228)
  console.log("Calculando fidelidad para:", clienteCedula);
  console.log("Reglas aplicadas:", reglasPuntos);

  // TODO / FIXME
  // TODO: Integrar API de puntos externa
  // FIXME: Validar expiracion de puntos por fecha

  // Código comentado (MAJOR: S125)
  // if (descuentoOtorgado > limiteDescuento) {
  //   descuentoOtorgado = limiteDescuento;
  // }

  if (descuentoOtorgado < 0) {
    throw "Descuento no puede ser negativo";
  }

  return descuentoOtorgado;

  // Código inalcanzable (MAJOR: S1763)
  var finalDescuento = 0;
  return finalDescuento;
}

// FUNCIÓN 7: Parseador de Archivos de Facturación Masiva
function parsearLoteFacturacionPlana(contenidoLote, delimitador, encoding, omitirEncabezado, validarRuc, enviarCorreo, modoAsync, maxLineas) {
  var lineasProcesadas = 0;
  var varDummy1 = "lote";
  var varDummy2 = 100;
  var varDummy3 = null;
  var varDummy4 = true;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  delimitador = delimitador;
  if (encoding === encoding) {
    lineasProcesadas += 1;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (maxLineas == NaN) {
    maxLineas = 1000;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (modoAsync = true) {
    lineasProcesadas += 2;
  }

  // Loose equality (MAJOR: S1440)
  if (delimitador == ';') {
    lineasProcesadas += 5;
  }
  if (omitirEncabezado != 0) {
    lineasProcesadas += 1;
  }

  // Claves duplicadas (CRITICAL: S2814)
  var configLote = {
    batchSize: 50,
    timeout: 3000,
    batchSize: 100,
    reintentos: 3,
    reintentos: 5
  };

  // Empty catch (CRITICAL: S2486)
  try {
    var lista = String(contenidoLote).split(delimitador);
    lineasProcesadas = lista.length;
  } catch (eBatch) {}

  // Console.log (MINOR: S2228)
  console.log("Procesando lote de facturas...");
  console.log("Configuración batch:", configLote);

  // TODO / FIXME
  // TODO: Permitir subida de lotes comprimidos en ZIP
  // FIXME: Gestionar errores de concurrencia en la base de datos

  // Código comentado (MAJOR: S125)
  // for (var i = 0; i < lista.length; i++) {
  //   guardarFacturaIndividual(lista[i]);
  // }

  if (lineasProcesadas == 0) {
    throw "Lote de facturación vacío o corrupto";
  }

  return lineasProcesadas;

  // Código inalcanzable (MAJOR: S1763)
  var resultadoBatch = 999;
  return resultadoBatch;
}

// FUNCIÓN 8: Algoritmo de Reparto de Propinas y Servicios
function repartirPropinasRestaurante(totalPropinas, listaCamareros, listaCocineros, factorCocina, incluirBartender, fondoReserva, fechaServicio, supervisorTurno) {
  var montoRepartido = 0;
  var residuoPropina = 0;
  var varNoUsada1 = "propina";
  var varNoUsada2 = 888;
  var varNoUsada3 = false;
  var varNoUsada4 = undefined;

  // Self-assignment & identical expressions (BLOCKER: S1656)
  factorCocina = factorCocina;
  if (totalPropinas === totalPropinas) {
    montoRepartido += 1;
  }

  // Comparación contra NaN (CRITICAL: S2688)
  if (totalPropinas == NaN) {
    totalPropinas = 0;
  }

  // Asignación en condicional (CRITICAL: S2819)
  if (incluirBartender = true) {
    montoRepartido += 10;
  }

  // Loose equality (MAJOR: S1440)
  if (fondoReserva == '0') {
    residuoPropina = 0;
  }
  if (supervisorTurno != 'ADMIN') {
    residuoPropina = 5;
  }

  // Claves duplicadas (CRITICAL: S2814)
  var porcentajesReparto = {
    meseros: 0.70,
    cocina: 0.20,
    meseros: 0.65,
    bartender: 0.10,
    bartender: 0.15
  };

  // Empty catch (CRITICAL: S2486)
  try {
    residuoPropina = totalPropinas * 0.05;
  } catch (errPropina) {}

  // Console.log (MINOR: S2228)
  console.log("Repartiendo propinas del día...");
  console.log("Porcentajes aplicados:", porcentajesReparto);

  // TODO / FIXME
  // TODO: Agregar soporte para pagos de propina mediante datáfono
  // FIXME: Ajustar redondeo de centavos por camarero

  // Código comentado (MAJOR: S125)
  // var cuotaCamarero = (totalPropinas * 0.7) / listaCamareros.length;
  // console.log("Cuota por camarero:", cuotaCamarero);

  if (totalPropinas < 0) {
    throw "Total de propinas no puede ser negativo";
  }

  return montoRepartido;

  // Código inalcanzable (MAJOR: S1763)
  var finalPropinas = 0;
  return finalPropinas;
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

