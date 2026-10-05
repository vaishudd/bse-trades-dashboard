/**
 * Deterministic trade generator.
 * Uses a seeded PRNG (mulberry32) so every run returns the SAME trades.
 * That matters: re-pulling must produce the same tradeIds, which lets the
 * backend's upsert prove duplicates are not created.
 */
const SYMBOLS = {
  RELIANCE: 2450, TCS: 3800, INFY: 1500, HDFCBANK: 1650, ICICIBANK: 1100,
  SBIN: 780, ITC: 440, LT: 3500, AXISBANK: 1150, BHARTIARTL: 1400,
  KOTAKBANK: 1800, WIPRO: 480, MARUTI: 11000, TITAN: 3300, ONGC: 270,
};
const SYMBOL_NAMES = Object.keys(SYMBOLS);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateTrades(count = 3000, seed = 42) {
  const rand = mulberry32(seed);
  const baseTime = Date.UTC(2026, 9, 5, 3, 45, 0); // 05 Oct 2026, 09:15 IST
  const trades = [];

  for (let i = 0; i < count; i++) {
    const symbol = SYMBOL_NAMES[Math.floor(rand() * SYMBOL_NAMES.length)];
    const drift = 1 + (rand() - 0.5) * 0.04; // +/- 2% around base price
    trades.push({
      tradeId: `TRD${String(10001 + i)}`,
      client: `Client${String(1 + Math.floor(rand() * 50)).padStart(3, '0')}`,
      symbol,
      quantity: (1 + Math.floor(rand() * 50)) * 10,
      price: Math.round(SYMBOLS[symbol] * drift * 100) / 100,
      timestamp: new Date(baseTime + i * 7000).toISOString(), // one trade / 7s
    });
  }
  return trades;
}

module.exports = { generateTrades };
