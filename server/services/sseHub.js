const eventBus = require('./eventBus');

const HEARTBEAT_MS = 20000;
const clients = new Set(); // one entry per open dashboard tab
let heartbeatTimer = null;

// SSE wire format: "event: <name>\ndata: <json>\n\n"
const formatEvent = (name, payload) => `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;

function writeToClient(res, text) {
  try {
    res.write(text);
  } catch (_err) {
    clients.delete(res); // broken connection: drop it, never crash the broadcast
  }
}

function broadcast(name, payload) {
  const message = formatEvent(name, payload);
  for (const res of clients) writeToClient(res, message);
}

// A comment line (starts with ":") is ignored by EventSource but keeps idle proxies from
// closing the stream. Server-side keep-alive only: it carries no data and the browser does no polling.
function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const res of clients) writeToClient(res, ': heartbeat\n\n');
  }, HEARTBEAT_MS);
  heartbeatTimer.unref();
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function addClient(res) {
  clients.add(res);
  startHeartbeat();
}

function removeClient(res) {
  clients.delete(res);
  if (clients.size === 0) stopHeartbeat();
}

function closeAll() {
  for (const res of clients) res.end();
  clients.clear();
  stopHeartbeat();
}

// Every event published on the bus is forwarded to all connected dashboards.
eventBus.subscribe(({ name, payload }) => broadcast(name, payload));

module.exports = { addClient, removeClient, broadcast, closeAll, clientCount: () => clients.size };
