'use strict';

const { toNumber, roundMoney } = require('./format');

/**
 * Mapeadores de documentos MongoDB -> objetos usados por las vistas.
 * En el proyecto C# los campos [BsonId] se guardan como _id; aquí se expone
 * el mismo nombre que usaba el modelo (id_plato, id_cliente, etc.).
 */

function mapCategoria(doc) {
  if (!doc) return null;
  return {
    id_categoria: doc._id ?? doc.id_categoria ?? null,
    nombre: doc.nombre ?? ''
  };
}

function mapCliente(doc) {
  if (!doc) return null;
  return {
    id_cliente: doc._id ?? doc.id_cliente ?? null,
    nombre: doc.nombre ?? '',
    apellido: doc.apellido ?? '',
    telefono: doc.telefono ?? null,
    correo: doc.correo ?? null,
    cedula: doc.cedula ?? ''
  };
}

function mapEmpleado(doc) {
  if (!doc) return null;
  return {
    id_emple: doc._id ?? doc.id_emple ?? null,
    nombre: doc.nombre ?? '',
    apellido: doc.apellido ?? '',
    cedula: doc.cedula ?? '',
    sexo: doc.sexo ?? '',
    estado_civil: doc.estado_civil ?? '',
    telefono: doc.telefono ?? null,
    cargo: doc.cargo ?? '',
    usuario: doc.usuario ?? null,
    permisos: Array.isArray(doc.permisos) ? doc.permisos : []
  };
}

function mapEmpresa(doc) {
  if (!doc) return null;
  return {
    id_empresa: doc._id ?? doc.id_empresa ?? null,
    ruc: doc.ruc ?? '',
    nombre: doc.nombre ?? '',
    logo: doc.logo ?? null
  };
}

function mapPlato(doc) {
  if (!doc) return null;
  return {
    id_plato: doc._id ?? doc.id_plato ?? null,
    categoria: mapCategoria(doc.categoria),
    nombre: doc.nombre ?? '',
    descripcion: doc.descripcion ?? '',
    imagen: doc.imagen ?? null,
    precio: toNumber(doc.precio)
  };
}

function mapDetalleFactura(detalle) {
  if (!detalle) return null;
  return {
    plato: detalle.plato
      ? {
          id_plato: detalle.plato.id_plato ?? null,
          nombre: detalle.plato.nombre ?? '',
          precio: toNumber(detalle.plato.precio)
        }
      : null,
    cantidad: Number(detalle.cantidad) || 0,
    subtotal_sin_iva: toNumber(detalle.subtotal_sin_iva),
    valor_iva: toNumber(detalle.valor_iva),
    subtotal_con_iva: toNumber(detalle.subtotal_con_iva),
    tarifa_servicio: toNumber(detalle.tarifa_servicio),
    total: toNumber(detalle.total)
  };
}

function mapFactura(doc) {
  if (!doc) return null;
  const fecha = doc.fecha instanceof Date ? doc.fecha : new Date(doc.fecha);

  return {
    id_factura: doc._id ?? doc.id_factura ?? null,
    cliente: doc.cliente ?? null,
    empleado: doc.empleado ?? null,
    empresa: doc.empresa ?? null,
    fecha: Number.isNaN(fecha.getTime()) ? new Date(0) : fecha,
    detalleFacturas: Array.isArray(doc.detalleFacturas)
      ? doc.detalleFacturas.map(mapDetalleFactura).filter(Boolean)
      : []
  };
}

function sumarDetalles(factura) {
  const detalles = factura?.detalleFacturas ?? [];
  return detalles.reduce(
    (acumulado, detalle) => ({
      subtotal: roundMoney(acumulado.subtotal + toNumber(detalle.subtotal_sin_iva)),
      iva: roundMoney(acumulado.iva + toNumber(detalle.valor_iva)),
      servicio: roundMoney(acumulado.servicio + toNumber(detalle.tarifa_servicio)),
      total: roundMoney(acumulado.total + toNumber(detalle.total))
    }),
    { subtotal: 0, iva: 0, servicio: 0, total: 0 }
  );
}

/**
 * Equivalente a la agrupación LINQ de Views/Platos/Index.cshtml.
 */
function agruparPlatosPorCategoria(platos) {
  const grupos = new Map();

  for (const plato of platos) {
    const categoria = plato.categoria || { id_categoria: null, nombre: 'Sin categoría' };
    const clave = categoria.id_categoria ?? '__sin_categoria__';
    if (!grupos.has(clave)) {
      grupos.set(clave, { id_categoria: categoria.id_categoria, nombre: categoria.nombre, platos: [] });
    }
    grupos.get(clave).platos.push(plato);
  }

  return Array.from(grupos.values());
}

/**
 * Equivalente a la construcción de CategoriaPlatos en FacturacionController.Crear.
 */
function categoriasConPlatos(categorias, platos) {
  return categorias.map((categoria) => ({
    id_categoria: categoria.id_categoria,
    nombre: categoria.nombre,
    platos: platos.filter(
      (plato) => plato.categoria && plato.categoria.id_categoria === categoria.id_categoria
    )
  }));
}

module.exports = {
  mapCategoria,
  mapCliente,
  mapEmpleado,
  mapEmpresa,
  mapPlato,
  mapDetalleFactura,
  mapFactura,
  sumarDetalles,
  agruparPlatosPorCategoria,
  categoriasConPlatos
};
