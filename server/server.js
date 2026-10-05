const config = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');
const { createApp } = require('./app');
const { failStaleRunningJobs } = require('./services/jobService');
const sseHub = require('./services/sseHub');
const logger = require('./utils/logger');

async function main() {
  await connectDb();

  // A job still "running" at boot belongs to a previous process that died.
  const recovered = await failStaleRunningJobs();
  if (recovered > 0) logger.warn(`Marked ${recovered} interrupted job(s) as failed`);

  const server = createApp().listen(config.port, () => logger.info(`API listening on :${config.port}`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    sseHub.closeAll(); // open SSE streams would otherwise keep the server alive
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Startup failed:', err.message);
  process.exit(1);
});
