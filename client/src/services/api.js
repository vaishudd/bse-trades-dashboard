// Every call here is SHORT-LIVED (10s cap). The slow BSE call never happens in the browser.
const BASE_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 10000;

export const EVENTS_URL = `${BASE_URL}/api/events`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check that the backend is running.', 0);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON body: handled below */
  }

  if (!response.ok) {
    throw new ApiError(body?.message || `Request failed (${response.status})`, response.status);
  }
  return body;
}

export const fetchTrades = () => request('/api/trades');
export const fetchStatus = () => request('/api/trades/status');
export const startPull = () => request('/api/trades/pull', { method: 'POST' });
