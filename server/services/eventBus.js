const { EventEmitter } = require('events');

/**
 * In-process publish/subscribe. The worker publishes domain events
 * ("trades-updated") without knowing anything about HTTP or SSE.
 * The SSE hub subscribes and forwards them to browsers.
 * Production upgrade: replace with Redis pub/sub so many server instances share events.
 */
const emitter = new EventEmitter();

module.exports = {
  publish(name, payload) {
    emitter.emit('event', { name, payload });
  },
  subscribe(listener) {
    emitter.on('event', listener);
    return () => emitter.off('event', listener);
  },
};
