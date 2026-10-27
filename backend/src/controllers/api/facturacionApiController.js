'use strict';

const {
  mapCliente,
  mapEmpleado,
  mapEmpresa,
  mapPlato
} = require('../../utils/documents');
const { roundMoney, toDecimal128 } = require('../../utils/format');
const { nextSequentialId } = require('../../utils/ids');
const { createHttpError } = require('../../utils/http');
const Factura = require('../../models/Factura');

function serializarFactura(documento) {
  return Factura.fromDatabase(documento).toJSON();
}

function leerId(valor, campo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw createHttpError(400, `El campo ${campo} es obligatorio.`);
  }
  return valor.trim();
}

function leerFecha(valor, campo, esHasta = false) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw createHttpError(400, `El filtro ${campo} debe ser una fecha válida.`);
  }

  const texto = valor.trim();
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const fecha = new Date(texto);

  if (
    Number.isNaN(fecha.getTime()) ||
    (soloFecha && fecha.toISOString().slice(0, 10) !== texto)
  ) {
    throw createHttpError(400, `El filtro ${campo} debe ser una fecha válida.`);
  }

  if (soloFecha && esHasta) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    return { fecha, exclusivo: true };
  }

  return { fecha, exclusivo: false };
}

function construirFiltroFechas(query) {
  const desdeTexto = query.desde;
  const hastaTexto = query.hasta;
  const desde = desdeTexto === undefined ? null : leerFecha(desdeTexto, 'desde');
  const hasta = hastaTexto === undefined ? null : leerFecha(hastaTexto, 'hasta', true);

  if (
    desde &&
    hasta &&
    (desde.fecha > hasta.fecha ||
      (desde.fecha.getTime() === hasta.fecha.getTime() && hasta.exclusivo))
  ) {
    throw createHttpError(400, 'El filtro desde no puede ser posterior al filtro hasta.');
  }

  if (!desde && !hasta) return {};

  const rango = {};
  if (desde) rango.$gte = desde.fecha;
  if (hasta) rango[hasta.exclusivo ? '$lt' : '$lte'] = hasta.fecha;
  return { fecha: rango };
}

function distribuirImporte(importe, subtotales) {
  const centavosTotales = Math.round(importe * 100);
  const pesos = subtotales.map((subtotal) => Math.round(subtotal * 100));
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);

  if (pesoTotal === 0 || centavosTotales === 0) {
    return pesos.map(() => 0);
  }

  const asignaciones = pesos.map((peso, indice) => {
    const exacta = (centavosTotales * peso) / pesoTotal;
    const base = Math.floor(exacta);
    return { indice, centavos: base, residuo: exacta - base };
  });

  let pendientes = centavosTotales - asignaciones.reduce((suma, item) => suma + item.centavos, 0);
  const prioridad = [...asignaciones].sort(
    (a, b) => b.residuo - a.residuo || a.indice - b.indice
  );

  for (let i = 0; i < pendientes; i += 1) {
    prioridad[i].centavos += 1;
  }

  const importes = Array(pesos.length).fill(0);
  for (const item of asignaciones) {
    importes[item.indice] = item.centavos / 100;
  }
  return importes;
}

async function listar(req, res) {
  const documentos = await req.app.locals.context.facturas
    .find(construirFiltroFechas(req.query))
    .sort({ fecha: -1 })
    .toArray();

  return res.json({ success: true, data: documentos.map(serializarFactura) });
}

async function detalle(req, res) {
  const documento = await req.app.locals.context.facturas.findOne({ _id: req.params.id });
  if (!documento) {
    throw createHttpError(404, 'La factura solicitada no existe.');
  }

  return res.json({ success: true, data: serializarFactura(documento) });
}

async function emitir(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const idCliente = leerId(body.idCliente, 'idCliente');
  const idEmpresa = leerId(body.idEmpresa, 'idEmpresa');
  const idEmpleado = leerId(body.idEmpleado, 'idEmpleado');

  if (!Array.isArray(body.detalles) || body.detalles.length === 0) {
    throw createHttpError(400, 'Debes enviar al menos un detalle de factura.');
  }

  const detallesSolicitados = body.detalles.map((detalle, indice) => {
    if (!detalle || typeof detalle !== 'object' || Array.isArray(detalle)) {
      throw createHttpError(400, `El detalle ${indice + 1} no es válido.`);
    }

    const idPlato = leerId(detalle.idPlato, `detalles[${indice}].idPlato`);
    if (!Number.isSafeInteger(detalle.cantidad) || detalle.cantidad <= 0) {
      throw createHttpError(400, `La cantidad del detalle ${indice + 1} debe ser un entero positivo.`);
    }

    return { idPlato, cantidad: detalle.cantidad };
  });

  const context = req.app.locals.context;
  const [clienteDoc, empresaDoc, empleadoDoc] = await Promise.all([
    context.clientes.findOne({ _id: idCliente }),
    context.empresas.findOne({ _id: idEmpresa }),
    context.empleados.findOne({ _id: idEmpleado })
  ]);

  if (!clienteDoc) throw createHttpError(404, `El cliente ${idCliente} no existe.`);
  if (!empresaDoc) throw createHttpError(404, `La empresa ${idEmpresa} no existe.`);
  if (!empleadoDoc) throw createHttpError(404, `El empleado ${idEmpleado} no existe.`);

  const platosDocs = await Promise.all(
    detallesSolicitados.map(({ idPlato }) => context.platos.findOne({ _id: idPlato }))
  );

  const lineas = detallesSolicitados.map((detalle, indice) => {
    const platoDoc = platosDocs[indice];
    if (!platoDoc) throw createHttpError(404, `El plato ${detalle.idPlato} no existe.`);

    const plato = mapPlato(platoDoc);
    if (!Number.isFinite(plato.precio) || plato.precio < 0) {
      throw createHttpError(422, `El plato ${detalle.idPlato} tiene un precio inválido.`);
    }

    return {
      plato,
      cantidad: detalle.cantidad,
      subtotal: roundMoney(plato.precio * detalle.cantidad)
    };
  });

  const subtotalFactura = roundMoney(lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
  const ivaFactura = roundMoney(subtotalFactura * 0.15);
  const servicioFactura = roundMoney(subtotalFactura * 0.1);
  // Reparte los impuestos calculados sobre el subtotal total para conservar los centavos al sumar líneas.
  const ivas = distribuirImporte(ivaFactura, lineas.map((linea) => linea.subtotal));
  const servicios = distribuirImporte(servicioFactura, lineas.map((linea) => linea.subtotal));
  const cliente = mapCliente(clienteDoc);
  const empleado = mapEmpleado(empleadoDoc);
  const empresa = mapEmpresa(empresaDoc);

  const factura = new Factura({
    id_factura: await nextSequentialId(context.facturas, 'FAC'),
    fecha: new Date(),
    estado: 'EMITIDA',
    cliente: {
      id_cliente: cliente.id_cliente,
      cedula: cliente.cedula,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      telefono: cliente.telefono,
      correo: cliente.correo
    },
    empleado: {
      id_emple: empleado.id_emple,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      cargo: empleado.cargo
    },
    empresa: {
      id_empresa: empresa.id_empresa,
      ruc: empresa.ruc,
      nombre: empresa.nombre,
      logo: empresa.logo
    },
    detalleFacturas: lineas.map((linea, indice) => {
      const valorIva = ivas[indice];
      const tarifaServicio = servicios[indice];
      const subtotalConIva = roundMoney(linea.subtotal + valorIva);
      const total = roundMoney(subtotalConIva + tarifaServicio);

      return {
        plato: {
          id_plato: linea.plato.id_plato,
          nombre: linea.plato.nombre,
          precio: toDecimal128(linea.plato.precio)
        },
        cantidad: linea.cantidad,
        subtotal_sin_iva: toDecimal128(linea.subtotal),
        valor_iva: toDecimal128(valorIva),
        subtotal_con_iva: toDecimal128(subtotalConIva),
        tarifa_servicio: toDecimal128(tarifaServicio),
        total: toDecimal128(total)
      };
    })
  });

  const validacion = factura.validar();
  if (!validacion.esValido) {
    throw createHttpError(400, 'La factura calculada no cumple las reglas del modelo.');
  }

  for (let intento = 0; ; intento += 1) {
    try {
      await context.facturas.insertOne(factura.toDatabaseDocument());
      break;
    } catch (error) {
      if (error && error.code === 11000 && intento < 2) {
        factura.id_factura = await nextSequentialId(context.facturas, 'FAC');
        continue;
      }
      throw error;
    }
  }

  return res.status(201).json({ success: true, data: factura.toJSON() });
}

async function anular(req, res) {
  const context = req.app.locals.context;
  const id = req.params.id;
  const resultado = await context.facturas.updateOne(
    { _id: id },
    { $set: { estado: 'ANULADA' } }
  );

  if (resultado.matchedCount === 0) {
    throw createHttpError(404, 'La factura solicitada no existe.');
  }

  const documento = await context.facturas.findOne({ _id: id });
  return res.json({ success: true, data: serializarFactura(documento) });
}

module.exports = { listar, detalle, emitir, anular };
