'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

const projectRoot = path.join(__dirname, '..', '..');
const repoRoot = path.join(projectRoot, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultSecret = 'restaurante-gr07-dev-secret';

if (nodeEnv === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === defaultSecret)) {
  throw new Error('SESSION_SECRET debe configurarse con un valor seguro en producción.');
}

module.exports = {
  projectRoot,
  repoRoot,
  frontendDir: path.join(repoRoot, 'frontend'),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  mongoDbName: process.env.MONGODB_DB || 'Restaurante_GR07',
  mongoTimeoutMs: Number(process.env.MONGODB_TIMEOUT_MS) || 5000,
  sessionSecret: process.env.SESSION_SECRET || defaultSecret,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || '',
  seedCajeroPassword: process.env.SEED_CAJERO_PASSWORD || '',
  sessionMaxAgeMs: 30 * 60 * 1000,
  uploadsDir: path.join(repoRoot, 'frontend', 'public', 'uploads'),
  logsDir: path.join(projectRoot, 'logs'),
  maxUploadBytes: 5 * 1024 * 1024,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
};
