// Tiny logger: timestamps + level. Swap for pino/winston in production.
const log = (level, ...args) =>
  console[level === 'error' ? 'error' : 'log'](`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args);

module.exports = {
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
