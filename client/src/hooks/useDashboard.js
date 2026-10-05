import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStatus, fetchTrades, startPull } from '../services/api';
import { useTradeEvents } from './useTradeEvents';

const EMPTY_STATS = { totalTrades: 0, clientCount: 0, symbolCount: 0 };
const INITIAL_STATUS = { state: 'idle', job: null, lastSuccessfulPullAt: null };

/** All dashboard state and behaviour in one place; components stay presentational. */
export function useDashboard() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // { type: 'info' | 'success' | 'error', text }
  const [starting, setStarting] = useState(false);

  // If two refreshes overlap, only the newest one may update the screen.
  const latestRequestId = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    try {
      const [tradesRes, statusRes] = await Promise.all([fetchTrades(), fetchStatus()]);
      if (requestId !== latestRequestId.current) return;
      setTrades(tradesRes.trades);
      setStats(tradesRes.stats);
      setStatus({ state: statusRes.state, job: statusRes.job, lastSuccessfulPullAt: statusRes.lastSuccessfulPullAt });
      setError(null);
    } catch (err) {
      if (requestId === latestRequestId.current) setError(err.message);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, []);

  // 1) Open instantly: load what is ALREADY stored. Works even while a pull is running.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 2) Real-time updates: this is exactly where the browser receives the server's events.
  const { connected } = useTradeEvents({
    // Fires on first connect AND every automatic reconnect: one fetch to catch up. Not polling.
    onOpen: refresh,

    onPullStarted: ({ jobId, startedAt }) => {
      setStatus((prev) => ({ ...prev, state: 'pulling', job: { jobId, status: 'running', startedAt } }));
      setNotice((prev) => (prev?.type === 'info' ? prev : null)); // drop a stale result message
    },

    // The long BSE pull finished and the trades are saved in MongoDB -> fetch them. No page refresh.
    onTradesUpdated: ({ count }) => {
      setNotice({ type: 'success', text: `Pull completed. ${count} trades are now stored.` });
      refresh();
    },

    onPullFailed: ({ error: reason }) => {
      setNotice({ type: 'error', text: `Trade pull failed: ${reason}` });
      refresh();
    },
  });

  // 3) Start a pull: the server answers in milliseconds (202); the slow work runs on the server.
  const handleStartPull = useCallback(async () => {
    setStarting(true);
    setNotice(null);
    try {
      const { jobId } = await startPull();
      setNotice({ type: 'info', text: `Trade pull started in background. (${jobId})` });
      // Do not overwrite a newer status (e.g. an instant completion) for the same job.
      setStatus((prev) =>
        prev.job?.jobId === jobId ? prev : { ...prev, state: 'pulling', job: { jobId, status: 'running' } }
      );
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      if (err.status === 409) refresh(); // another tab already started one: sync our status
    } finally {
      setStarting(false);
    }
  }, [refresh]);

  return { trades, stats, status, loading, error, notice, connected, starting, refresh, handleStartPull };
}
