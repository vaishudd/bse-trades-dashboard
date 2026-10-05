const { MongoMemoryServer } = require('mongodb-memory-server');
const http = require('http');
const { connectDb, disconnectDb } = require('../config/db');
const { createApp } = require('../app');
const { createApp: createMockBseApp } = require('../../mock-bse/server');
const eventBus = require('../services/eventBus');
const sseHub = require('../services/sseHub');
const { isPullRunning } = require('../workers/pullWorker');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = (app) => new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const close = (server) => new Promise((resolve) => server.close(resolve));

/** Real in-memory MongoDB + the real mock BSE + the real API, all on random ports. */
async function startTestEnv() {
  const mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri());
  const mockServer = await listen(createMockBseApp());
  const apiServer = await listen(createApp());
  return { mongod, mockServer, apiServer, mockPort: mockServer.address().port, apiPort: apiServer.address().port };
}

async function stopTestEnv(env) {
  sseHub.closeAll();
  await close(env.apiServer);
  await close(env.mockServer);
  await disconnectDb();
  await env.mongod.stop();
}

/** Resolves with the payload of the next event published on the bus. Register BEFORE triggering it. */
function waitForEvent(name, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let unsubscribe;
    const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Timed out waiting for "${name}"`)); }, timeoutMs);
    unsubscribe = eventBus.subscribe(({ name: n, payload }) => {
      if (n === name) { clearTimeout(timer); unsubscribe(); resolve(payload); }
    });
  });
}

// Test-only helper so one test's background job never leaks into the next.
async function waitForIdle(timeoutMs = 20000) {
  const start = Date.now();
  while (isPullRunning()) {
    if (Date.now() - start > timeoutMs) throw new Error('Background pull did not finish');
    await sleep(20);
  }
}

/** A real browser-like SSE client over HTTP, to prove events travel through the actual stream. */
function openSse(port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/events' }, (res) => {
      let buffer = '';
      const listeners = [];
      res.setEncoding('utf8');
      res.on('data', (chunk) => { buffer += chunk; listeners.forEach((fn) => fn()); });
      resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'],
        text: () => buffer,
        waitFor(text, ms = 15000) {
          return new Promise((ok, fail) => {
            const timer = setTimeout(() => fail(new Error(`Timed out waiting for "${text}". Got: ${buffer}`)), ms);
            const check = () => { if (buffer.includes(text)) { clearTimeout(timer); ok(buffer); } };
            listeners.push(check);
            check();
          });
        },
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
  });
}

module.exports = { startTestEnv, stopTestEnv, waitForEvent, waitForIdle, openSse, sleep };
