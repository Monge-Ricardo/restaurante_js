#!/usr/bin/env python3
"""Genera el informe PDF de pruebas estaticas del modulo de platos.

El informe usa exclusivamente capturas reales de terminal y del editor
guardadas en informe_platos/capturas.
"""

from __future__ import annotations

import html
import subprocess
from pathlib import Path

BASE = Path('/home/alejandro/Documentos/Universidad_AlejandroObando/Pruebas_Software/Proyecto_PrimerParcialPruebas/restaurante_js')
REPORT_DIR = BASE / 'informe_platos'
CAPTURAS = REPORT_DIR / 'capturas'
HTML_OUT = REPORT_DIR / 'informe.html'
PDF_OUT = REPORT_DIR / 'Pruebas_estaticas_platos.pdf'
CHROME = Path('/home/alejandro/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome')

IMG = {
    'install': '01_npm_install.png',
    'audit': '02b_npm_audit_fix_completo.png',
    'lint': '03_lint_platos.png',
    'lint_fix': '04_lint_platos_fix.png',
    'tests': '05_test_platos.png',
    'coverage': '06_cobertura_platos.png',
    'test_top': '07_codigo_test_top.png',
    'test_exitos': '08_codigo_test_exitos.png',
    'test_fracasos': '10_codigo_test_fracasos_404.png',
    'controller_top': '11_codigo_controlador_top.png',
    'controller_validacion': '13_codigo_controlador_validacion.png',
    'package_scripts': '14_codigo_package_scripts.png',
    'package_lint': '15_codigo_package_lint.png',
}


def img(key: str, width: str, alt: str) -> str:
    src = CAPTURAS / IMG[key]
    if not src.exists():
        raise FileNotFoundError(src)
    return f'<img class="shot" src="capturas/{html.escape(IMG[key])}" style="width:{width}" alt="{html.escape(alt)}">'


def figure(key: str, width: str, caption: str, alt: str) -> str:
    return f'''<figure>
  {img(key, width, alt)}
  <figcaption>{caption}</figcaption>
</figure>'''


def footer(number: int) -> str:
    return f'<div class="footer"><span>Pruebas Estáticas</span><span>{number}</span></div>'


def page(number: int, content: str) -> str:
    return f'<section class="page">\n{content}\n{footer(number)}\n</section>'


CSS = r'''
@page { size: 210mm 297mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #171717; }
body {
  font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
  font-size: 10.6pt;
  line-height: 1.45;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page {
  position: relative;
  width: 210mm;
  height: 297mm;
  padding: 16mm 18mm 18mm 18mm;
  page-break-after: always;
  overflow: hidden;
  background: #fff;
}
.page:last-child { page-break-after: auto; }
h1 {
  margin: 0 0 3mm 0;
  font-size: 25pt;
  line-height: 1.1;
  letter-spacing: -0.4pt;
}
.subtitle {
  margin: 0 0 10mm 0;
  color: #3b3b3b;
  font-size: 11.2pt;
  line-height: 1.4;
  max-width: 168mm;
}
h2 {
  margin: 7mm 0 3mm 0;
  font-size: 14.2pt;
  line-height: 1.2;
  font-weight: 700;
}
h2:first-child { margin-top: 0; }
p { margin: 0 0 3.2mm 0; }
.lead { color: #2f2f2f; }
.note { color: #444; font-size: 9.8pt; }
.cmd { margin: 3mm 0 2.5mm 0; font-size: 10.4pt; }
code {
  font-family: "DejaVu Sans Mono", "Liberation Mono", monospace;
  font-size: 9.6pt;
  background: #f1f1f1;
  border-radius: 1.4mm;
  padding: 0.3mm 1.2mm;
}
figure {
  margin: 2mm 0 4mm 0;
  text-align: center;
}
.shot {
  display: block;
  max-width: 174mm;
  height: auto;
  margin: 0 auto;
  border: 0.35mm solid #222;
  border-radius: 1.2mm;
  background: #111;
}
figcaption {
  margin: 1.8mm auto 0 auto;
  max-width: 166mm;
  color: #555;
  font-size: 8.8pt;
  line-height: 1.35;
  text-align: center;
}
ul, ol { margin: 2mm 0 3mm 0; padding-left: 7mm; }
li { margin: 0 0 1.6mm 0; }
.success li strong, .fail li strong { font-weight: 700; }
.info-table {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 4mm 0;
  font-size: 9.6pt;
}
.info-table th, .info-table td {
  border: 0.25mm solid #b8b8b8;
  padding: 1.5mm 2mm;
  text-align: left;
}
.info-table th { background: #ededed; font-weight: 700; }
.info-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.ok { color: #137333; font-weight: 700; }
.footer {
  position: absolute;
  left: 18mm;
  right: 18mm;
  bottom: 7mm;
  display: flex;
  justify-content: space-between;
  color: #555;
  font-size: 9.2pt;
}
.small { font-size: 9.5pt; }
.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5mm;
}
.centered { text-align: center; }
'''


p1 = f'''
<h1>Pruebas Estáticas</h1>
<p class="subtitle">Configuración de dependencias para trabajar con Jest, Supertest y ESLint</p>

<h2>npm ESLint</h2>
<p class="lead">El proyecto incorpora scripts específicos para el módulo de platos: lint, corrección automática, pruebas y cobertura. El código de la captura corresponde a <code>backend/package.json</code>.</p>
{figure('package_scripts', '112mm', '<code>backend/package.json</code>: scripts <code>test:platos</code>, <code>test:platos:coverage</code> y <code>test:coverage:platos</code>.', 'Scripts de pruebas de platos en package.json')}
<p class="cmd"><code>npm install</code> → descarga las dependencias necesarias dentro de la carpeta <code>node_modules</code>.</p>
{figure('install', '145mm', 'Instalación de dependencias en una terminal real del proyecto.', 'Terminal con npm install')}
<p class="note">La instalación se ejecutó en <code>backend/</code>, el workspace que contiene Express, MongoDB, Jest y Supertest.</p>
'''

p2 = f'''
<h2>npm audit fix</h2>
<p class="lead"><code>npm audit fix</code> → corrige vulnerabilidades conocidas utilizando paquetes en versiones estables.</p>
{figure('audit', '155mm', 'Salida completa de <code>npm audit fix</code>: 6 vulnerabilidades de severidad baja en <code>deepmerge</code>, dependencia transitiva de Jest.', 'Terminal con npm audit fix')}
<p class="note">No se aplicó <code>npm audit fix --force</code>: la salida advierte que instalaría <code>jest@25.1.0</code>, un cambio incompatible con la versión actual del proyecto.</p>

<h2>npm run lint:platos</h2>
<p class="lead">Revisión de variables sin usar, sintaxis o errores de tipiado en el controlador, las rutas, el modelo y la suite de pruebas.</p>
{figure('lint', '145mm', '<code>npm run lint:platos</code> terminó sin errores ni advertencias para los cinco archivos analizados.', 'Terminal con npm run lint:platos')}
'''

p3 = f'''
<h2>npm run lint:platos:fix</h2>
<p class="lead">Corrección automática de los problemas que ESLint puede resolver sin intervención manual.</p>
{figure('lint_fix', '145mm', 'La corrección automática no reportó errores pendientes. El lint del módulo quedó limpio.', 'Terminal con npm run lint:platos:fix')}
<p class="note">Archivos revisados: <code>platosApiController.js</code>, <code>platosController.js</code>, <code>platosRoutes.js</code>, <code>Plato.js</code> y <code>test/api/platos.test.js</code>.</p>

<h2>Scripts de lint del módulo</h2>
<p>Los dos scripts siguientes concentran la verificación y la corrección automática del módulo de platos.</p>
{figure('package_lint', '112mm', '<code>backend/package.json</code>: definición de <code>lint:platos</code> y <code>lint:platos:fix</code> junto con las dependencias de desarrollo.', 'Scripts de lint en package.json')}
'''

p4 = f'''
<h2>Jest + Supertest</h2>
<p class="lead">Suite <code>backend/test/api/platos.test.js</code>: conexión real a MongoDB Atlas, CRUD completo y validación de respuestas de error.</p>
{figure('test_top', '112mm', 'Preparación de la suite: conexión a MongoDB Atlas, creación de la aplicación y limpieza del plato de prueba en <code>afterAll</code>.', 'Código inicial de platos.test.js')}

<h2>Éxitos</h2>
<ol class="success">
  <li><strong>GET</strong> <code>/api/v1/platos</code>: devuelve <strong>200</strong> y una lista JSON.</li>
  <li><strong>POST</strong> <code>/api/v1/platos</code>: crea un plato válido y devuelve <strong>201</strong>.</li>
  <li><strong>GET</strong> <code>/api/v1/platos/:id</code>: consulta el plato recién creado y devuelve <strong>200</strong>.</li>
  <li><strong>PUT</strong> <code>/api/v1/platos/:id</code>: actualiza nombre y precio, y devuelve <strong>200</strong>.</li>
  <li><strong>DELETE</strong> <code>/api/v1/platos/:id</code>: elimina el plato y devuelve <strong>200</strong>.</li>
</ol>
<p class="note">La suite usa la base de datos real y elimina los documentos creados durante la ejecución para no dejar datos residuales.</p>
'''

p5 = f'''
<h2>Ejecución de la suite</h2>
<p class="lead">Resultado de <code>npm run test:platos</code> con Jest y Supertest.</p>
{figure('tests', '145mm', 'Salida real de Jest: 8 pruebas ejecutadas, 8 aprobadas, sin fallos ni snapshots pendientes.', 'Terminal con la ejecución de las 8 pruebas')}
<p class="note"><strong>8/8 pruebas aprobadas.</strong> La ejecución incluye los cinco casos de éxito del CRUD y los tres casos de fracaso controlado.</p>

<h2>Casos de éxito en el código</h2>
{figure('test_exitos', '110mm', 'Implementación de los casos de éxito: listar, crear, consultar por ID, actualizar y eliminar.', 'Código de los casos de éxito')}
'''

p6 = f'''
<h2>Fracasos controlados</h2>
<p class="lead">Las pruebas de fracaso comprueban que la API rechace las peticiones inválidas y no altere la base de datos.</p>
<ol class="fail">
  <li><strong>GET</strong> <code>/api/v1/platos/PLA_NO_EXISTE_999</code>: devuelve <strong>404</strong> y <code>success: false</code>.</li>
  <li><strong>POST</strong> <code>/api/v1/platos</code> con <code>precio: 0</code>: devuelve <strong>400</strong> y el campo <code>precio</code>.</li>
  <li><strong>POST</strong> <code>/api/v1/platos</code> con <code>CAT_NO_EXISTE_999</code>: devuelve <strong>400</strong> y el campo <code>id_categoria</code>.</li>
</ol>
{figure('test_fracasos', '118mm', 'Casos de fracaso en el código: recurso inexistente y precio no positivo. La tercera prueba valida una categoría inexistente.', 'Código de los casos de fracaso')}
<p class="note">Estas pruebas también finalizaron correctamente: el resultado esperado es una respuesta de error, no una excepción.</p>
'''

p7 = f'''
<h2>Controlador de platos</h2>
<p class="lead">El controlador implementa las operaciones CRUD y las reglas de negocio del módulo: validación de campos, precio positivo y existencia de la categoría.</p>
{figure('controller_top', '104mm', 'Inicio de <code>platosApiController.js</code>: utilidades de mapeo, respuestas de error de MongoDB y consulta de platos.', 'Código inicial del controlador')}
{figure('controller_validacion', '104mm', 'Validaciones de <code>crearPlato</code>: el precio debe ser mayor a 0 y la categoría debe existir en la base de datos.', 'Validaciones del controlador')}
<p class="note">Rutas cubiertas: <code>GET /api/v1/platos</code>, <code>GET /api/v1/platos/:id</code>, <code>POST /api/v1/platos</code>, <code>PUT /api/v1/platos/:id</code> y <code>DELETE /api/v1/platos/:id</code>.</p>
'''

p8 = f'''
<h2>Cobertura</h2>
<p class="lead">Resultado de <code>npm run test:coverage:platos</code>, limitado al controlador y a las rutas del módulo de platos.</p>
{figure('coverage', '170mm', 'Reporte de cobertura de Jest: 54.16% de sentencias y 55.08% de líneas en el conjunto analizado; las rutas alcanzan 100%.', 'Cobertura de pruebas de platos')}

<h2>Resumen de cobertura</h2>
<table class="info-table">
  <thead><tr><th>Archivo / conjunto</th><th>% Stmts</th><th>% Branch</th><th>% Funcs</th><th>% Lines</th></tr></thead>
  <tbody>
    <tr><td>All files</td><td class="num">54.16</td><td class="num">32.35</td><td class="num">75.00</td><td class="num">55.08</td></tr>
    <tr><td><code>platosApiController.js</code></td><td class="num">50.45</td><td class="num">32.35</td><td class="num">75.00</td><td class="num">51.37</td></tr>
    <tr><td><code>platosRoutes.js</code></td><td class="num">100.00</td><td class="num">100.00</td><td class="num">100.00</td><td class="num">100.00</td></tr>
  </tbody>
</table>
<p class="note">Las líneas sin cubrir corresponden principalmente a ramas de error de MongoDB y a la función auxiliar <code>calcularCaloriasAlergenos</code>, que no forma parte del CRUD probado en esta suite.</p>
'''


PAGES = [p1, p2, p3, p4, p5, p6, p7, p8]

doc = f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Pruebas Estáticas - Platos</title>
<style>{CSS}</style>
</head>
<body>
{''.join(page(i + 1, content) for i, content in enumerate(PAGES))}
</body>
</html>
'''

REPORT_DIR.mkdir(parents=True, exist_ok=True)
HTML_OUT.write_text(doc, encoding='utf-8')

cmd = [
    str(CHROME),
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--no-pdf-header-footer',
    f'--print-to-pdf={PDF_OUT}',
    HTML_OUT.as_uri(),
]
subprocess.run(cmd, check=True)
print(PDF_OUT)
