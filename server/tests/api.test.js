const request = require('supertest');
const config = require('../config/env');
const Trade = require('../models/Trade');
const Job = require('../models/Job');
const { upsertTrades } = require('../services/tradeService');
const { startTestEnv, stopTestEnv, waitForEvent, waitForIdle, openSse } = require('./helpers');

let env;
let api;

// Point the backend at the mock BSE with a chosen query string (delay / failure).
const useBse = (query) => { config.bseApiUrl = `http://127.0.0.1:${env.mockPort}/getTrades${query}`; };

beforeAll(async () => {
  env = await startTestEnv();
  api = request(`http://127.0.0.1:${env.apiPort}`);
}, 120000); // first run may download a MongoDB binary

afterAll(async () => { await stopTestEnv(env); });
beforeEach(async () => { await Promise.all([Trade.deleteMany({}), Job.deleteMany({})]); });
afterEach(async () => { await waitForIdle(); });

describe('GET /api/trades', () => {
  test('returns stored trades (newest first) with stats, and never calls the BSE API', async () => {
    config.bseApiUrl = 'http://127.0.0.1:1/getTrades'; // nothing listens here: proves BSE is not involved
    await Trade.insertMany([
      { tradeId: 'T1', client: 'A', symbol: 'TCS', quantity: 10, price: 100, timestamp: '2026-10-05T10:00:00Z' },
      { tradeId: 'T2', client: 'B', symbol: 'INFY', quantity: 20, price: 200, timestamp: '2026-10-05T11:00:00Z' },
      { tradeId: 'T3', client: 'A', symbol: 'TCS', quantity: 30, price: 300, timestamp: '2026-10-05T12:00:00Z' },
    ]);

    const res = await api.get('/api/trades');

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.trades.map((t) => t.tradeId)).toEqual(['T3', 'T2', 'T1']);
    expect(res.body.trades[0]._id).toBeUndefined();
    expect(res.body.stats).toEqual({ totalTrades: 3, clientCount: 2, symbolCount: 2 });
  });

  test('returns an empty list when nothing is stored', async () => {
    const res = await api.get('/api/trades');
    expect(res.status).toBe(200);
    expect(res.body.trades).toEqual([]);
  });

  test('rejects an invalid limit with 400', async () => {
    const res = await api.get('/api/trades?limit=abc');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/trades/pull', () => {
  test('returns 202 with a jobId immediately, while BSE is still working', async () => {
    useBse('?delayMs=1500');
    const finished = waitForEvent('trades-updated');

    const start = Date.now();
    const res = await api.post('/api/trades/pull');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ success: true, message: 'Trade pull started' });
    expect(res.body.jobId).toMatch(/^job-/);
    expect(elapsed).toBeLessThan(1000); // far less than the 1500 ms BSE delay

    const job = await Job.findOne({ jobId: res.body.jobId });
    expect(job.status).toBe('running'); // still in progress after we already got our answer

    await finished;
  });

  test('background pull eventually stores the trades and completes the job', async () => {
    useBse('?delayMs=200');
    const finished = waitForEvent('trades-updated');

    const { body } = await api.post('/api/trades/pull');
    const event = await finished;

    expect(event).toMatchObject({ jobId: body.jobId, count: 3000 });
    expect(await Trade.countDocuments()).toBe(3000);

    const job = await Job.findOne({ jobId: body.jobId });
    expect(job.status).toBe('completed');
    expect(job.tradeCount).toBe(3000);
    expect(job.completedAt).toBeInstanceOf(Date);

    const status = await api.get('/api/trades/status');
    expect(status.body.state).toBe('completed');
    expect(status.body.lastSuccessfulPullAt).toBeTruthy();
  });

  test('a second pull while one is running gets 409', async () => {
    useBse('?delayMs=600');
    const finished = waitForEvent('trades-updated');

    const first = await api.post('/api/trades/pull');
    const second = await api.post('/api/trades/pull');

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ success: false, message: 'A trade pull is already in progress.' });
    expect(await Job.countDocuments({ status: 'running' })).toBe(1);

    await finished;
  });

  test('two simultaneous requests: exactly one starts, one is rejected', async () => {
    useBse('?delayMs=300');
    const finished = waitForEvent('trades-updated');

    const results = await Promise.all([api.post('/api/trades/pull'), api.post('/api/trades/pull')]);

    expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
    await finished;
  });

  test('pulling the same data again does not create duplicate trades', async () => {
    useBse('?delayMs=0');
    for (let i = 0; i < 2; i++) {
      const finished = waitForEvent('trades-updated');
      expect((await api.post('/api/trades/pull')).status).toBe(202);
      await finished;
      await waitForIdle();
    }
    expect(await Trade.countDocuments()).toBe(3000);
    expect(await Job.countDocuments({ status: 'completed' })).toBe(2);
  });

  test('malformed JSON body gives 400', async () => {
    const res = await api.post('/api/trades/pull').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON body');
  });
});

describe('failure handling', () => {
  test('BSE error: job is marked failed, event is published, nothing is stored, a new pull can start', async () => {
    useBse('?delayMs=0&fail=true');
    const failed = waitForEvent('pull-failed');

    const { body } = await api.post('/api/trades/pull');
    const event = await failed;
    await waitForIdle();

    expect(event).toEqual({ jobId: body.jobId, error: 'BSE API responded with status 500' });
    const job = await Job.findOne({ jobId: body.jobId });
    expect(job.status).toBe('failed');
    expect(job.error).toBe('BSE API responded with status 500');
    expect(await Trade.countDocuments()).toBe(0);
    expect((await api.get('/api/trades/status')).body.state).toBe('failed');

    useBse('?delayMs=0');
    const finished = waitForEvent('trades-updated');
    expect((await api.post('/api/trades/pull')).status).toBe(202);
    await finished;
  });

  test('unreachable BSE: failure message does not leak internals', async () => {
    config.bseApiUrl = 'http://127.0.0.1:1/getTrades';
    const failed = waitForEvent('pull-failed');

    const { body } = await api.post('/api/trades/pull');
    const event = await failed;

    expect(event.error).toBe('Could not reach BSE API');
    const job = await Job.findOne({ jobId: body.jobId }).lean();
    expect(JSON.stringify(job)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1/);
  });
});

describe('real-time SSE', () => {
  test('GET /api/events is an event-stream', async () => {
    const sse = await openSse(env.apiPort);
    expect(sse.status).toBe(200);
    expect(sse.contentType).toMatch(/text\/event-stream/);
    sse.close();
  });

  test('every connected dashboard receives pull-started and trades-updated', async () => {
    useBse('?delayMs=300');
    const tabA = await openSse(env.apiPort);
    const tabB = await openSse(env.apiPort);

    const { body } = await api.post('/api/trades/pull');

    for (const tab of [tabA, tabB]) {
      await tab.waitFor('event: pull-started');
      const text = await tab.waitFor('event: trades-updated');
      expect(text).toContain(`"jobId":"${body.jobId}"`);
      expect(text).toContain('"count":3000');
    }
    tabA.close();
    tabB.close();
  });

  test('a failed pull is pushed to dashboards as pull-failed', async () => {
    useBse('?delayMs=0&fail=true');
    const tab = await openSse(env.apiPort);

    await api.post('/api/trades/pull');
    const text = await tab.waitFor('event: pull-failed');

    expect(text).toContain('BSE API responded with status 500');
    tab.close();
  });
});

describe('job safety nets', () => {
  test('database refuses a second "running" job (unique partial index)', async () => {
    await Job.create({ jobId: 'job-a', status: 'running' });
    await expect(Job.create({ jobId: 'job-b', status: 'running' })).rejects.toMatchObject({ code: 11000 });
  });

  test('a stale running job left by a crash is cleaned up and a new pull starts', async () => {
    await Job.create({ jobId: 'job-stale', status: 'running', startedAt: new Date(Date.now() - 3 * 3600 * 1000) });
    useBse('?delayMs=0');
    const finished = waitForEvent('trades-updated');

    expect((await api.post('/api/trades/pull')).status).toBe(202);
    await finished;

    expect((await Job.findOne({ jobId: 'job-stale' })).status).toBe('failed');
  });

  test('a recent running job owned by someone else blocks a new pull with 409', async () => {
    await Job.create({ jobId: 'job-live', status: 'running', startedAt: new Date() });
    const res = await api.post('/api/trades/pull');
    expect(res.status).toBe(409);
  });
});

describe('other endpoints and validation', () => {
  test('GET /api/jobs/:jobId returns the job, 404 if unknown, 400 if malformed', async () => {
    await Job.create({ jobId: 'job-known', status: 'completed', tradeCount: 5 });
    const found = await api.get('/api/jobs/job-known');
    expect(found.status).toBe(200);
    expect(found.body.job).toMatchObject({ jobId: 'job-known', status: 'completed', tradeCount: 5 });

    expect((await api.get('/api/jobs/job-missing')).status).toBe(404);
    expect((await api.get('/api/jobs/bad%20id')).status).toBe(400);
  });

  test('status is idle when no pull has ever run', async () => {
    const res = await api.get('/api/trades/status');
    expect(res.body).toMatchObject({ success: true, state: 'idle', job: null, lastSuccessfulPullAt: null });
  });

  test('unknown route gives 404 JSON', async () => {
    const res = await api.get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('upsertTrades skips malformed records instead of failing the whole batch', async () => {
    const good = { tradeId: 'G1', client: 'C', symbol: 'tcs', quantity: 1, price: 2, timestamp: '2026-10-05T10:00:00Z' };
    const summary = await upsertTrades([good, { tradeId: '', client: 'C' }, null, { ...good, tradeId: 'G2', price: 'x' }]);
    expect(summary).toMatchObject({ received: 4, stored: 1, skipped: 3, inserted: 1 });
    expect((await Trade.findOne({ tradeId: 'G1' })).symbol).toBe('TCS');
  });
});
