require('dotenv').config();

// One place that reads process.env, so the rest of the code imports `config`.
module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bse-trades',
  bseApiUrl: process.env.BSE_API_URL || 'http://localhost:6000/getTrades',
  // 20 minutes: longer than the worst-case 15 minute BSE pull.
  bseRequestTimeoutMs: Number(process.env.BSE_REQUEST_TIMEOUT_MS) || 20 * 60 * 1000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
