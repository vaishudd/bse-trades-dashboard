// Fills MongoDB with the mock BSE trades (delay forced to 0) so the dashboard has data at first load.
// Usage: npm run seed   (mock BSE must be running)
const config = require('../config/env');
const { connectDb, disconnectDb } = require('../config/db');
const { fetchTradesFromBse } = require('../services/bseClient');
const { upsertTrades } = require('../services/tradeService');

(async () => {
  try {
    const url = new URL(config.bseApiUrl);
    url.searchParams.set('delayMs', '0');
    await connectDb();
    const trades = await fetchTradesFromBse(url.toString());
    const summary = await upsertTrades(trades);
    console.log('Seed complete:', summary);
  } catch (err) {
    console.error('Seed failed:', err.safeMessage || err.message);
    process.exitCode = 1;
  } finally {
    await disconnectDb();
  }
})();
