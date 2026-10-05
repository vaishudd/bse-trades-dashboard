const express = require('express');
const { generateTrades } = require('../data/generateTrades');

const MAX_DELAY_MS = 15 * 60 * 1000; // 900000 = the real-world worst case

// Generate once at startup: same data on every request.
const TRADES = generateTrades(3000);

function resolveDelay(queryValue) {
  const envDelay = Number(process.env.BSE_DELAY_MS ?? 15000);
  const requested = queryValue !== undefined ? Number(queryValue) : envDelay;
  if (!Number.isFinite(requested) || requested < 0) return envDelay;
  return Math.min(requested, MAX_DELAY_MS);
}

const router = express.Router();

/**
 * GET /getTrades
 *   ?delayMs=NUMBER  override the env delay for this request (capped at 15 min)
 *   ?fail=true       respond 500 after the delay (to test failure handling)
 *
 * The delay is what simulates the slow real BSE API.
 */
router.get('/getTrades', (req, res) => {
  const delayMs = resolveDelay(req.query.delayMs);
  const shouldFail = req.query.fail === 'true';

  const timer = setTimeout(() => {
    if (shouldFail) {
      return res.status(500).json({ success: false, message: 'Simulated BSE failure' });
    }
    return res.json({ success: true, trades: TRADES });
  }, delayMs);

  // If the caller gives up, stop the timer so we don't leak it.
  res.on('close', () => clearTimeout(timer));
});

module.exports = router;
