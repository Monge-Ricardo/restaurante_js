'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Decimal128 } = require('mongodb');
const {
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
} = require('../src/utils/documents');

test('los mapeadores exponen los nombres usados por las vistas C#', () => {
  assert.deepEqual(mapCategoria({ _id: 'CAT001', nombre: 'Entradas' }), {
    id_categoria: 'CAT001',
    nombre: 'Entradas'
  });

  assert.deepEqual(
    mapCliente({
      _id: 'CLI001',
      nombre: 'Consumidor',
      apellido: 'Final',
      cedula: '9999999999',
      telefono: '0999999999',
      correo: 'consumidorfinal@restaurante.com'
    }),
    {
      id_cliente: 'CLI001',
      nombre: 'Consumidor',
      apellido: 'Final',
      telefono: '0999999999',
      correo: 'consumidorfinal@restaurante.com',
      cedula: '9999999999'
    }
  );

  assert.equal(mapEmpresa({ _id: 'LOC001', ruc: '0999999999001', nombre: 'Monster' }).id_empresa, 'LOC001');
  assert.equal(mapEmpleado({ _id: 'EMP001', usuario: { correo: 'admin@restaurante.com' } }).usuario.correo, 'admin@restaurante.com');
});

test('mapPlato convierte el precio Decimal128 a Number', () => {
  const plato = mapPlato({
    _id: 'PLA001',
    nombre: 'Ceviche',
    descripcion: 'Pescado fresco',
    imagen: '/Uploads/Platos/PLA001_ceviche.jpg',
    precio: Decimal128.fromString('12.75'),
    categoria: { _id: 'CAT001', nombre: 'Entradas' }
  });

  assert.equal(plato.id_plato, 'PLA001');
  assert.equal(plato.precio, 12.75);
  assert.equal(plato.categoria.id_categoria, 'CAT001');
});

test('mapFactura normaliza fecha, detalles y totales', () => {
  const factura = mapFactura({
    _id: 'FAC001',
    fecha: new Date(2025, 0, 10, 18, 30),
    cliente: { id_cliente: 'CLI001', nombre: 'Ana', apellido: 'Pérez' },
    empleado: { id_emple: 'EMP001', nombre: 'Admin' },
    empresa: { id_empresa: 'LOC001', nombre: 'Monster' },
    detalleFacturas: [
      {
        plato: { id_plato: 'PLA001', nombre: 'Ceviche', precio: Decimal128.fromString('10.00') },
        cantidad: 2,
        subtotal_sin_iva: Decimal128.fromString('20.00'),
        valor_iva: Decimal128.fromString('3.00'),
        subtotal_con_iva: Decimal128.fromString('23.00'),
        tarifa_servicio: Decimal128.fromString('2.30'),
        total: Decimal128.fromString('25.30')
      }
    ]
  });

  assert.equal(factura.id_factura, 'FAC001');
  assert.equal(factura.detalleFacturas[0].plato.precio, 10);
  assert.equal(factura.detalleFacturas[0].total, 25.3);
  assert.equal(factura.empleado.nombre, 'Admin');
});

test('sumarDetalles acumula subtotal, IVA, servicio y total', () => {
  const factura = {
    detalleFacturas: [
      {
        subtotal_sin_iva: 10,
        valor_iva: 1.5,
        tarifa_servicio: 1.15,
        total: 12.65
      },
      {
        subtotal_sin_iva: 20,
        valor_iva: 3,
        tarifa_servicio: 2.3,
        total: 25.3
      }
    ]
  };

  assert.deepEqual(sumarDetalles(factura), {
    subtotal: 30,
    iva: 4.5,
    servicio: 3.45,
    total: 37.95
  });
});

test('agruparPlatosPorCategoria y categoriasConPlatos respetan el orden', () => {
  const entradas = { id_categoria: 'CAT001', nombre: 'Entradas' };
  const bebidas = { id_categoria: 'CAT002', nombre: 'Bebidas' };

  const platos = [
    { id_plato: 'PLA001', categoria: entradas },
    { id_plato: 'PLA002', categoria: bebidas },
    { id_plato: 'PLA003', categoria: entradas },
    { id_plato: 'PLA004', categoria: null }
  ];

  const grupos = agruparPlatosPorCategoria(platos);
  assert.equal(grupos.length, 3);
  assert.equal(grupos[0].platos.length, 2);
  assert.equal(grupos[2].nombre, 'Sin categoría');

  const categorias = categoriasConPlatos(
    [
      { id_categoria: 'CAT001', nombre: 'Entradas' },
      { id_categoria: 'CAT002', nombre: 'Bebidas' }
    ],
    platos
  );

  assert.equal(categorias[0].platos.length, 2);
  assert.equal(categorias[1].platos.length, 1);
});

test('mapDetalleFactura tolera platos y valores ausentes', () => {
  const detalle = mapDetalleFactura({ cantidad: null, total: null });
  assert.equal(detalle.cantidad, 0);
  assert.equal(detalle.total, 0);
  assert.equal(detalle.plato, null);
});
