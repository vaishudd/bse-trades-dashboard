const axios = require('axios');
const config = require('../config/env');

// An error whose message is safe to store on the Job and show on the dashboard.
class BseError extends Error {
  constructor(safeMessage, cause) {
    super(safeMessage);
    this.name = 'BseError';
    this.safeMessage = safeMessage;
    this.cause = cause;
  }
}

/**
 * Calls the (slow) BSE API. Only ever called from the BACKGROUND worker.
 * The long timeout is fine here: it is a server-to-server call, not a browser request.
 */
async function fetchTradesFromBse(url = config.bseApiUrl) {
  let response;
  try {
    response = await axios.get(url, {
      timeout: config.bseRequestTimeoutMs,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') throw new BseError('BSE API timed out', err);
    if (err.response) throw new BseError(`BSE API responded with status ${err.response.status}`, err);
    throw new BseError('Could not reach BSE API', err);
  }

  const { success, trades } = response.data || {};
  if (success !== true || !Array.isArray(trades)) {
    throw new BseError('BSE API returned an invalid response');
  }
  return trades;
}

module.exports = { fetchTradesFromBse, BseError };
