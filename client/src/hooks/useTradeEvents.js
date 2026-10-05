import { useEffect, useRef, useState } from 'react';
import { EVENTS_URL } from '../services/api';

/**
 * Opens ONE Server-Sent Events connection for the lifetime of the dashboard.
 * The server pushes events; the browser never asks "is it done yet?" (no polling).
 *
 * handlers: { onOpen, onPullStarted, onTradesUpdated, onPullFailed }
 *
 * Note: EventSource reconnects by itself (using the server's `retry: 3000` hint) after
 * network drops or a server restart. onOpen fires again on each reconnect, which lets the
 * caller catch up on anything it missed while disconnected.
 */
export function useTradeEvents(handlers) {
  const [connected, setConnected] = useState(false);

  // Always call the latest handlers without tearing down the connection on every render.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const source = new EventSource(EVENTS_URL);

    source.onopen = () => {
      setConnected(true);
      handlersRef.current.onOpen?.();
    };
    source.onerror = () => setConnected(false); // the browser retries automatically

    const listen = (eventName, handlerName) => {
      source.addEventListener(eventName, (event) => {
        try {
          handlersRef.current[handlerName]?.(JSON.parse(event.data));
        } catch {
          /* ignore a malformed payload instead of crashing the UI */
        }
      });
    };

    listen('pull-started', 'onPullStarted');
    listen('trades-updated', 'onTradesUpdated'); // <-- the "new trades are ready" event
    listen('pull-failed', 'onPullFailed');

    return () => source.close(); // cleanup on unmount
  }, []);

  return { connected };
}
