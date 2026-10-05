const sseHub = require('../services/sseHub');

// GET /api/events  -> opens ONE long-lived stream per dashboard tab.
// This connection is separate from the BSE call: it just waits and receives pushes.
function streamEvents(_req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop nginx-style proxies from buffering the stream
  });
  res.write('retry: 3000\n\n'); // browser waits 3s before auto-reconnecting
  res.write(': connected\n\n');

  sseHub.addClient(res);
  // 'close' on the response fires when the client goes away (tab closed / network dropped).
  // (The request object's 'close' event has changed meaning across Node versions.)
  res.on('close', () => sseHub.removeClient(res));
}

module.exports = { streamEvents };
