'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeRegex,
  nextSequentialId,
  sanitizeFileName,
  buildUploadFileName
} = require('../src/utils/ids');

function coleccionConUltimo(ultimo) {
  return {
    find() {
      return {
        sort() {
          return this;
        },
        limit() {
          return this;
        },
        async next() {
          return ultimo;
        }
      };
    }
  };
}

test('nextSequentialId continúa la numeración con tres dígitos', async () => {
  assert.equal(await nextSequentialId(coleccionConUltimo({ _id: 'PLA007' }), 'PLA'), 'PLA008');
  assert.equal(await nextSequentialId(coleccionConUltimo({ _id: 'FAC099' }), 'FAC'), 'FAC100');
  assert.equal(await nextSequentialId(coleccionConUltimo(null), 'CLI'), 'CLI001');
});

test('escapeRegex neutraliza caracteres especiales', () => {
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
});

test('sanitizeFileName elimina rutas y caracteres peligrosos', () => {
  assert.deepEqual(sanitizeFileName('../../foto plato.JPG'), {
    base: 'foto_plato',
    extension: '.jpg'
  });
  assert.deepEqual(sanitizeFileName(''), { base: 'archivo', extension: '' });
});

test('buildUploadFileName conserva el prefijo y la extensión', () => {
  assert.equal(buildUploadFileName('PLA001', 'Mi Foto.PNG'), 'PLA001_Mi_Foto.png');
});
