const { AppError } = require('./errors');
const logger = require('./logger');

const DB_ERROR_NAMES = ['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError'];

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
}

// Centralised error handling: every thrown error ends up here.
// Clients only ever get a safe message; details go to the server log.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  let status = 500;
  let message = 'Internal server error';

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  } else if (DB_ERROR_NAMES.includes(err.name) || /buffering timed out/i.test(err.message || '')) {
    status = 503;
    message = 'Database temporarily unavailable';
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
