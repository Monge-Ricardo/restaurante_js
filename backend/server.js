'use strict';

const config = require('./src/config');
const { createApp } = require('./src/app');
const { MongoContext } = require('./src/db/mongoContext');
const { initializeDatabase } = require('./src/db/initializer');

async function main() {
  let context = null;

  try {
    context = await MongoContext.connect(config.mongoUri, config.mongoDbName, {
      serverSelectionTimeoutMS: config.mongoTimeoutMs
    });
    await initializeDatabase(context);
    console.log(`[MongoDB] Conectado a la base de datos "${config.mongoDbName}".`);
  } catch (error) {
    console.error(`[MongoDB] No se pudo inicializar la base de datos: ${error.message}`);
    console.error('[MongoDB] La aplicación iniciará sin base de datos; configura MONGODB_URI en .env.');
    if (context) {
      await context.close().catch(() => {});
      context = null;
    }
  }

  const app = createApp({ context });
  const server = app.listen(config.port, () => {
    console.log(`[HTTP] RestauranteJS disponible en http://localhost:${config.port}`);
  });

  const cerrar = async (senal) => {
    console.log(`\n[HTTP] Cerrando por ${senal}...`);
    server.close(async () => {
      if (context) {
        await context.close().catch(() => {});
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
