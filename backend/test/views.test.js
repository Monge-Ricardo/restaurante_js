'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ejs = require('ejs');
const {
  formatMoney,
  formatDate,
  formatDateTime,
  logoSrc
} = require('../src/utils/format');
const { sumarDetalles } = require('../src/utils/documents');
const config = require('../src/config');

const viewsDir = path.join(config.frontendDir, 'views');

const categoria = { id_categoria: 'CAT001', nombre: 'Entradas', platos: [] };
const plato = {
  id_plato: 'PLA001',
  nombre: 'Ceviche',
  descripcion: 'Pescado fresco con limón',
  imagen: '/Uploads/Platos/PLA001_ceviche.jpg',
  precio: 12.75,
  categoria
};

categoria.platos.push(plato);

const cliente = {
  id_cliente: 'CLI001',
  nombre: 'Consumidor',
  apellido: 'Final',
  cedula: '9999999999',
  telefono: '0999999999',
  correo: 'consumidorfinal@restaurante.com'
};

const empresa = {
  id_empresa: 'LOC001',
  ruc: '0999999999001',
  nombre: 'Monster',
  logo: '/Uploads/Logos/LOC001_monster.png'
};

const factura = {
  id_factura: 'FAC001',
  fecha: new Date(2025, 0, 10, 18, 30),
  cliente,
  empleado: { id_emple: 'EMP001', nombre: 'Admin', apellido: 'Sistema', cargo: 'Administrador' },
  empresa,
  detalleFacturas: [
    {
      plato: { id_plato: 'PLA001', nombre: 'Ceviche', precio: 12.75 },
      cantidad: 2,
      subtotal_sin_iva: 25.5,
      valor_iva: 3.83,
      subtotal_con_iva: 29.33,
      tarifa_servicio: 2.93,
      total: 32.26
    }
  ]
};

const base = {
  title: 'Prueba',
  currentUser: { nombreCompleto: 'Admin Sistema', cargo: 'Administrador' },
  tienePermiso: () => true,
  flash: null,
  csrfToken: 'token-csrf',
  formatMoney,
  formatDate,
  formatDateTime,
  logoSrc,
  fieldError: (errors, field) =>
    Array.isArray(errors) ? errors.find((item) => item.field === field) || null : null
};

const casos = [
  ['account/login', { ...base, title: 'Login', error: null, correo: '' }],
  ['error', { ...base, status: 404, message: 'No encontrado', detail: null }],
  ['home/index', { ...base, title: 'Panel Principal' }],
  ['clientes/index', { ...base, clientes: [cliente], error: null }],
  ['empresas/index', { ...base, empresas: [empresa], error: null }],
  ['empresas/crear', { ...base, empresa: { ruc: '', nombre: '' }, errors: [] }],
  ['empresas/editar', { ...base, empresa, errors: [] }],
  ['empresas/eliminar', { ...base, empresa }],
  ['platos/index', { ...base, platos: [plato], grupos: [{ ...categoria, platos: [plato] }] }],
  ['platos/crear', { ...base, plato: { nombre: '', descripcion: '', precio: 0, categoria: null }, categorias: [categoria], errors: [] }],
  ['platos/editar', { ...base, plato, categorias: [categoria], errors: [] }],
  ['platos/eliminar', { ...base, plato }],
  [
    'facturacion/crear',
    {
      ...base,
      title: 'Punto de Venta - Facturación',
      categorias: [categoria],
      clientePorDefecto: cliente,
      empresas: [empresa]
    }
  ],
  [
    'facturacion/verFactura',
    { ...base, title: 'Factura FAC001', factura, resumen: sumarDetalles(factura) }
  ],
  [
    'facturacion/facturasGuardadas',
    { ...base, title: 'Facturas Guardadas', facturas: [factura] }
  ]
];

for (const [vista, locales] of casos) {
  test(`la vista ${vista} se renderiza sin errores`, async () => {
    const html = await ejs.renderFile(path.join(viewsDir, `${vista}.ejs`), locales);
    assert.equal(typeof html, 'string');
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Restaurante GR07'));
  });
}

test('las vistas de facturación muestran los datos esperados', async () => {
  const crearHtml = await ejs.renderFile(path.join(viewsDir, 'facturacion/crear.ejs'), casos[12][1]);
  assert.ok(crearHtml.includes('name="cantidades[PLA001]"'));
  assert.ok(crearHtml.includes('Cargar Consumidor Final'));

  const verHtml = await ejs.renderFile(path.join(viewsDir, 'facturacion/verFactura.ejs'), casos[13][1]);
  assert.ok(verHtml.includes('FACTURA'));
  assert.ok(verHtml.includes('Ceviche'));
  assert.ok(verHtml.includes('$32.26'));

  const listaHtml = await ejs.renderFile(path.join(viewsDir, 'facturacion/facturasGuardadas.ejs'), casos[14][1]);
  assert.ok(listaHtml.includes('FAC001'));
  assert.ok(listaHtml.includes('Ver Detalle'));
});
