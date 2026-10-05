# Video walkthrough script (target: about 4.5 minutes)

## Before you record

- MongoDB running. `mock-bse/.env` has `BSE_DELAY_MS=15000`.
- Seed once: `npm run seed --prefix server`.
- Layout: terminal on the left, browser on the right. Increase font sizes.
- Browser: **two tabs** of `http://localhost:5173`, DevTools open on the **Network** tab (filter: Fetch/XHR, plus "All" for the `events` stream).
- Have these files ready in your editor: `workers/pullWorker.js`, `models/Job.js`, `models/Trade.js`, `controllers/tradeController.js`, `services/sseHub.js`, `hooks/useDashboard.js`.
- Do one dry run first. Stop all servers before you start recording.

---

## 0:00 – 0:30  Introduction (face or title slide)

**Say:**
"Hi, I'm ___. This is my solution to the BSE trades assessment. The problem: BSE can take up to fifteen minutes to return trades, but our network kills any HTTP connection that stays open for more than thirty seconds. So the dashboard can't just call BSE and wait. It has to open instantly, show trades we already have, and show new trades the moment a long pull finishes, with no refresh and no polling."

## 0:30 – 1:15  Architecture (show `docs/architecture.md` diagram)

**Say:**
"Because the BSE API can take fifteen minutes while our network allows only thirty-second HTTP connections, I separated the long-running operation from the browser request. The browser starts a background job and gets an immediate response. The backend performs the slow operation, stores the result in MongoDB, and then sends a real-time SSE event to connected dashboards."

**Point at the diagram while saying:** "Dashboard to Express: short requests only. The worker calls BSE. Results go to MongoDB. An event goes out over SSE. The dashboard then fetches the new data."

"I chose SSE because updates only flow from server to browser, it avoids polling, it reconnects automatically, and it's separate from the BSE call."

## 1:15 – 1:45  Start the application (terminal)

**Run and narrate:**
```bash
npm run mock                  # "mock BSE on 6000, 15 second delay for the demo"
npm run server                # "backend on 5000, connected to MongoDB"
npm run client                # "React dashboard on 5173"
```
**Say:** "For the demo the delay is fifteen seconds. For the real scenario it's one environment variable: BSE_DELAY_MS equals 900000, which is fifteen minutes."

## 1:45 – 2:15  Dashboard opens instantly (browser)

Open the dashboard. **Say:**
"The dashboard opened immediately and shows three thousand trades already stored in MongoDB. Status is Idle, header says Connected, which means the SSE connection is open. In the Network tab, this `events` request stays open. That is the SSE stream." Show search, filter by a symbol, and click a column to sort.

## 2:15 – 3:15  Start the pull (the key moment)

Position both browser tabs side by side. Click **Start Trade Pull** in tab 1.

**Say:**
"I click Start Trade Pull. Look at the Network tab: the POST came back in a few milliseconds with a 202 and a job ID. The browser is not waiting for BSE. Both tabs now show Pulling because the server pushed a pull-started event."

Try clicking the button again / the other tab. **Say:** "The button is disabled, and even through the API a second pull returns 409, because only one pull may run at a time."

**While waiting (about 15 s), say:**
"The dashboard stays fully usable. Existing trades remain visible, I can search and sort, and there's no page refresh. The slow request is happening in the backend worker, not in the browser. In the terminal you can see the worker waiting on BSE."

Point at the Network tab: **"Notice there are no repeating requests. No polling."**

## 3:15 – 3:45  Pull completes

**Say:**
"The mock BSE has responded. Both tabs switched to Completed on their own, the last-updated time changed, and a message says the pull completed. This happened through the SSE event, not polling and not a refresh. In the Network tab you can see exactly one new request to /api/trades, made because the event arrived."

Show the terminal log line for the completed pull. Mention: "The same trades pulled again don't create duplicates because trades are upserted by trade ID."

## 3:45 – 4:30  Code walkthrough (editor, about 10 seconds each)

1. **`controllers/tradeController.js` → `postPull`:** "Creates the job and returns 202 straight away."
2. **`workers/pullWorker.js`:** "`startPull` starts `runPull` without awaiting it. `runPull` calls BSE, bulk-upserts into MongoDB, marks the job completed, and publishes the event. On failure it marks the job failed and publishes pull-failed. The lock is set before the first await, so two clicks can't both start a pull."
3. **`models/Trade.js` and `models/Job.js`:** "Unique index on trade ID prevents duplicates. A partial unique index allows only one running job, even across instances."
4. **`services/sseHub.js`:** "Keeps every open connection and broadcasts each event to all of them. That's how multiple tabs update."
5. **`hooks/useDashboard.js` → `onTradesUpdated`:** "This is where the browser receives the event and fetches the new trades."

## 4:30 – 5:00  Conclusion

**Say:**
"To summarize: the browser only makes short requests. The fifteen-minute call runs in a background worker, results are stored in MongoDB, and SSE tells every open dashboard when new data is ready. That respects the thirty-second network limit, keeps the dashboard instantly usable, and needs no polling, no cron and no refresh. For production I'd add a BullMQ and Redis queue, Redis pub/sub for multiple servers, and authentication. Thanks for watching."

---

## If something goes wrong while recording

| Problem | Quick fix |
|---|---|
| Header says Disconnected | Backend is not running |
| "Could not reach BSE API" | Mock BSE is not running |
| Pull seems stuck at 15 s | Check `mock-bse/.env` delay was saved and the mock restarted |
| Want to show a failure | In `server/.env` set `BSE_API_URL=http://localhost:6000/getTrades?fail=true`, restart the backend |
