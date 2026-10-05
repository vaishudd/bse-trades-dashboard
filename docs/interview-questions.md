# Interview questions and simple answers

**Core idea to repeat:** long-running external API → background processing → database → real-time event → dashboard update.

---

### 1. Why did you use background processing?
The BSE call can take 15 minutes, far longer than any browser request can survive. Running it in the background separates the slow work from the user's request: the user gets an instant answer and the server finishes the job on its own.

### 2. Why can't the frontend directly call the BSE API?
Mainly the 30-second limit: the connection would be killed. Also, a closed tab would lose the result, every user would trigger their own slow pull, nothing would be stored for the next visitor, and in real life BSE credentials must stay on the server.

### 3. How does the 30-second timeout affect the architecture?
It forces every browser-facing request to be short. So the browser only makes quick calls (read stored trades, start a job, read status), and the long wait is moved into a backend worker.

### 4. Why did you use SSE?
The server only needs to push "new trades are ready" to the browser. SSE is built for one-way push, uses plain HTTP, reconnects automatically, and needs no library. The SSE connection is separate from the BSE call, so the dashboard stays connected while processing happens.

### 5. Why not polling?
Polling sends repeated requests even when nothing changed, wastes resources, and adds delay. It was also explicitly not allowed. With SSE the server speaks only when something happens.

### 6. Why not WebSockets?
WebSockets are two-way, but the browser never needs to send messages over the live channel; it uses normal POST and GET. WebSockets need an upgrade handshake and manual reconnect logic. SSE is simpler and easier to explain.

### 7. How does the dashboard receive new trades?
The server sends a small `trades-updated` event over SSE. The `onTradesUpdated` handler in `useDashboard.js` then calls `GET /api/trades` once and updates the table. No refresh.

### 8. What happens if the BSE API fails?
The worker catches the error, marks the job `failed` with a safe message (like "BSE API timed out"), and publishes `pull-failed`. The dashboard shows the reason, keeps the old trades visible, and the user can start a new pull because the lock is released.

### 9. What happens if MongoDB fails?
At startup the server fails fast (5 s). While running, read endpoints return `503 Database temporarily unavailable`, and the dashboard shows an error with Retry (or a banner above the old data). If it fails while a pull is saving, the pull is reported as failed; in the worst case the job row stays `running` until the next restart or stale-job check.

### 10. How do you prevent duplicate pulls?
Two layers. An in-memory lock is set before the first `await`, so two simultaneous requests can't both pass. And MongoDB has a partial unique index that allows only one job with status `running`, which also protects against multiple server instances. The second request gets `409`.

### 11. How do you prevent duplicate trades?
`tradeId` has a unique index, and trades are saved with `bulkWrite` upserts keyed on `tradeId`. Pulling the same trade again updates it instead of inserting a copy.

### 12. How would you scale this system?
Use a durable queue (BullMQ + Redis) with multiple workers, Redis pub/sub so SSE events reach clients on any API instance, server-side pagination for the table, and a load balancer with proxy buffering disabled for the SSE route.

### 13. What happens if the backend restarts during a pull?
The in-flight request to BSE dies with the process. The job stays `running` in MongoDB, so on startup I mark leftover running jobs as `failed`. The user can start a new pull. Already stored trades are untouched. In production, a queue would persist and retry the job.

### 14. How would you use Redis/BullMQ in production?
The API would add a "pull" job to a BullMQ queue and return the job ID. Separate worker processes take jobs from the queue, with retries, backoff and concurrency limits, and survive restarts. Redis pub/sub would carry the "trades-updated" event to every API instance.

### 15. How would you handle millions of trades?
Don't send everything to the browser: paginate, search and sort on the server using indexes, and use a virtualized table. Compute stats with aggregation. Insert in chunks (already done) or stream the response. Consider partitioning or archiving old data.

### 16. How would authentication be added?
Log users in (session cookie or JWT) and protect `/api/*` with middleware, with a role check on starting pulls. `EventSource` can't set custom headers, so use an HTTP-only cookie, or a short-lived token for the stream. Add rate limiting too.

### 17. How would you deploy this?
Build the React app (`vite build`) and serve it from a CDN or Nginx. Run the Node API with a process manager or in a container behind HTTPS, use MongoDB Atlas, keep secrets in environment variables, and configure the reverse proxy not to buffer `/api/events`.

### 18. What are the limitations of SSE?
It's one-way and text-only. Browsers limit connections per domain on HTTP/1.1. Proxies can buffer or close idle streams (hence the keep-alive). It can't set custom auth headers. Events sent while disconnected are lost, so I refetch on every reconnect (and `Last-Event-ID` replay would be a further improvement).

### 19. Why is the initial dashboard API separate from `/getTrades`?
`/getTrades` is the slow external call. `/api/trades` reads already-stored data from MongoDB in milliseconds. Keeping them separate lets the dashboard open instantly and means a slow or failing BSE can never break the page.

### 20. Explain the complete request flow from clicking "Start Pull" until new trades appear.
1. Browser sends `POST /api/trades/pull`.
2. The server checks no pull is running, creates a `running` Job, starts the worker without awaiting it, and returns `202` with a `jobId`.
3. A `pull-started` event goes to all open tabs, which show "Pulling".
4. The worker calls BSE (up to 15 min) from the backend.
5. It bulk-upserts the trades into MongoDB and marks the job `completed`.
6. It publishes `trades-updated`; the SSE hub writes it to every open tab.
7. Each dashboard receives the event, calls `GET /api/trades`, and the table updates, with no refresh and no polling.

---

## More questions an interviewer may ask

### 21. Why return 202 instead of 200?
202 means "accepted for processing, not finished". It tells the client the work continues in the background.

### 22. Isn't your SSE connection also long-lived? Doesn't the 30-second rule kill it?
Fair point. If the network really kills every connection at 30 s, the stream drops. I handle that: `EventSource` reconnects automatically, and on each reconnect the dashboard does one catch-up fetch, so no update is missed. The server also sends a keep-alive comment every 20 s for idle proxies. The key difference is that no browser request ever has to wait for the 15-minute work.

### 23. Isn't the 20-second heartbeat a scheduler or polling?
No. It writes a tiny comment line on already-open streams to keep the connection alive. It carries no data, pulls nothing from BSE, and the browser does nothing in response. It is a connection keep-alive, not a data refresh.

### 24. What race conditions did you think about?
Two simultaneous pull requests (in-memory lock before the first `await`, plus the DB unique index); overlapping refreshes in the UI (a request counter so only the newest response updates the screen); an event arriving while the POST response is still in flight (the UI won't overwrite newer status); a crash leaving a job `running` (startup recovery and stale-job cleanup).

### 25. Why MongoDB?
It was requested, and it fits well: flexible documents, easy bulk upserts, and a unique index for duplicate prevention. A relational database would work too.

### 26. What if the user closes the tab during a pull?
Nothing is lost. The pull runs on the server regardless. When the user returns, the dashboard loads the stored data and the current job status.

### 27. How did you test it?
Jest and Supertest against an in-memory MongoDB, the real mock BSE and the real API. Tests cover the stored-trades endpoint, the immediate 202, background storing, duplicate and simultaneous pulls, no duplicate trades, BSE failure, SSE delivery to multiple tabs, and input validation. I also did a manual end-to-end run with two browser tabs.

### 28. Why an in-memory event bus?
It is the simplest thing that works for one server process and keeps the worker independent of HTTP. With several instances I would replace it with Redis pub/sub.

### 29. Why send a small event and then fetch, instead of sending the trades in the event?
One source of truth (the API), small messages, and it works the same after a reconnect. Pushing 3,000 trades through the stream would be heavy and could go stale.

### 30. What would you improve with more time?
A durable queue (BullMQ), progress events, pull history, authentication and rate limiting, server-side pagination, `Last-Event-ID` replay, and metrics and alerting.
