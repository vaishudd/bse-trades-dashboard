const Trade = require('../models/Trade');

const CHUNK_SIZE = 1000;
const MAX_LIST_LIMIT = 10000;

function isValidTrade(t) {
  return Boolean(
    t &&
      typeof t.tradeId === 'string' && t.tradeId.trim() &&
      typeof t.client === 'string' &&
      typeof t.symbol === 'string' &&
      Number.isFinite(t.quantity) &&
      Number.isFinite(t.price) &&
      !Number.isNaN(Date.parse(t.timestamp))
  );
}

function toUpsertOp(t) {
  return {
    updateOne: {
      filter: { tradeId: t.tradeId.trim() },
      update: {
        $set: {
          client: t.client.trim(),
          symbol: t.symbol.trim().toUpperCase(),
          quantity: t.quantity,
          price: t.price,
          timestamp: new Date(t.timestamp),
        },
      },
      upsert: true, // insert if new, update if tradeId already exists -> no duplicates
    },
  };
}

/** Bulk upsert in chunks so thousands of trades are stored in a few round trips. */
async function upsertTrades(rawTrades) {
  const valid = rawTrades.filter(isValidTrade);
  let inserted = 0;
  let modified = 0;

  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const ops = valid.slice(i, i + CHUNK_SIZE).map(toUpsertOp);
    const result = await Trade.bulkWrite(ops, { ordered: false });
    inserted += result.upsertedCount;
    modified += result.modifiedCount;
  }
  return { received: rawTrades.length, stored: valid.length, skipped: rawTrades.length - valid.length, inserted, modified };
}

const countTrades = () => Trade.countDocuments();

async function listTrades(limit = MAX_LIST_LIMIT) {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
  return Trade.find({}, { _id: 0 }).sort({ timestamp: -1 }).limit(safeLimit).lean();
}

async function getTradeStats() {
  const [totalTrades, clients, symbols] = await Promise.all([
    Trade.countDocuments(),
    Trade.distinct('client'),
    Trade.distinct('symbol'),
  ]);
  return { totalTrades, clientCount: clients.length, symbolCount: symbols.length };
}

module.exports = { upsertTrades, countTrades, listTrades, getTradeStats, isValidTrade, MAX_LIST_LIMIT };
