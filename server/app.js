const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./utils/errorHandler');

// Separated from server.js so tests can import the app without opening a port.
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
