'use strict';

module.exports = {
  testEnvironment: 'node',
  // Identifica los tests de Jest (pueden ser .jest.js o estar dentro de test/api/)
  testMatch: [
    '<rootDir>/test/**/*.jest.js',
    '<rootDir>/test/api/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'clientesCategorias.test.js' // Ignora el test nativo de node:test
  ]
};