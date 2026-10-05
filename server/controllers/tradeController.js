const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../utils/errors');
const { listTrades, getTradeStats, MAX_LIST_LIMIT } = require('../services/tradeService');
const { getJob, getStatusSummary } = require('../services/jobService');
const { startPull } = require('../workers/pullWorker');

// GET /api/trades  -> reads MongoDB only. Never touches the slow BSE API.
const getTrades = asyncHandler(async (req, res) => {
  let limit = MAX_LIST_LIMIT;
  if (req.query.limit !== undefined) {
    limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1) throw new AppError(400, 'limit must be a positive integer');
  }
  const [trades, stats] = await Promise.all([listTrades(limit), getTradeStats()]);
  res.json({ success: true, count: trades.length, stats, trades });
});

// POST /api/trades/pull  -> starts the job and answers right away (202 Accepted).
const postPull = asyncHandler(async (_req, res) => {
  const { jobId } = await startPull(); // resolves after the job row is created, NOT after BSE finishes
  res.status(202).json({ success: true, message: 'Trade pull started', jobId });
});

// GET /api/trades/status
const getStatus = asyncHandler(async (_req, res) => {
  res.json({ success: true, ...(await getStatusSummary()) });
});

// GET /api/jobs/:jobId
const getJobById = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  if (!/^[\w-]{1,64}$/.test(jobId)) throw new AppError(400, 'Invalid job id');
  const job = await getJob(jobId);
  if (!job) throw new AppError(404, 'Job not found');
  res.json({ success: true, job });
});

module.exports = { getTrades, postPull, getStatus, getJobById };
