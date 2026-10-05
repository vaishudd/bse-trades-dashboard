require('dotenv').config();
const express = require('express');
const tradesRouter = require('./routes/trades');

function createApp() {
  const app = express();
  app.use('/', tradesRouter);
  app.get('/health', (_req, res) => res.json({ ok: true }));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 6000;
  const server = createApp().listen(port, () => {
    console.log(`Mock BSE API on :${port} (default delay ${process.env.BSE_DELAY_MS ?? 15000} ms)`);
  });
  // The whole point of this mock is a response that takes up to 15 minutes,
  // so switch off Node's built-in per-request/socket timeouts for it.
  server.requestTimeout = 0;
  server.setTimeout(0);
}

module.exports = { createApp };
