const request = require('supertest');
const { createApp } = require('../server');

describe('GET /getTrades (mock BSE)', () => {
  const app = createApp();

  test('returns seeded trades with the required fields', async () => {
    const res = await request(app).get('/getTrades?delayMs=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trades.length).toBeGreaterThanOrEqual(1000);
    expect(Object.keys(res.body.trades[0]).sort()).toEqual(
      ['client', 'price', 'quantity', 'symbol', 'timestamp', 'tradeId']
    );
  });

  test('data is deterministic and tradeIds are unique', async () => {
    const a = await request(app).get('/getTrades?delayMs=0');
    const b = await request(app).get('/getTrades?delayMs=0');
    expect(a.body.trades).toEqual(b.body.trades);
    const ids = new Set(a.body.trades.map((t) => t.tradeId));
    expect(ids.size).toBe(a.body.trades.length);
  });

  test('honours the configured delay', async () => {
    const start = Date.now();
    await request(app).get('/getTrades?delayMs=300');
    expect(Date.now() - start).toBeGreaterThanOrEqual(290);
  });

  test('fail=true returns 500', async () => {
    const res = await request(app).get('/getTrades?delayMs=0&fail=true');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
