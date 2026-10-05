const crypto = require('crypto');
const Job = require('../models/Job');
const config = require('../config/env');
const { fetchTradesFromBse } = require('../services/bseClient');
const { upsertTrades, countTrades } = require('../services/tradeService');
const { failStaleRunningJobs } = require('../services/jobService');
const eventBus = require('../services/eventBus');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const ALREADY_RUNNING = 'A trade pull is already in progress.';
const DUPLICATE_KEY = 11000;

// Set SYNCHRONOUSLY before the first `await`. Node runs one piece of JS at a time,
// so two simultaneous requests cannot both pass the check below.
let pullInFlight = false;

const createRunningJob = () =>
  Job.create({ jobId: `job-${crypto.randomUUID()}`, status: 'running', startedAt: new Date() });

async function createJobOrConflict() {
  try {
    return await createRunningJob();
  } catch (err) {
    if (err.code !== DUPLICATE_KEY) throw err;
    // The database already has a "running" job. If it is older than the longest possible
    // pull it is a leftover from a crash: clean it and retry once. Otherwise it is real.
    const cleaned = await failStaleRunningJobs({ olderThanMs: config.bseRequestTimeoutMs + 60000 });
    if (cleaned === 0) throw new AppError(409, ALREADY_RUNNING);
    try {
      return await createRunningJob();
    } catch (retryErr) {
      if (retryErr.code === DUPLICATE_KEY) throw new AppError(409, ALREADY_RUNNING); // lost a race
      throw retryErr;
    }
  }
}

/**
 * Starts a pull and returns IMMEDIATELY with the jobId.
 * `done` resolves when the background work finishes (tests await it; the controller ignores it).
 */
async function startPull() {
  if (pullInFlight) throw new AppError(409, ALREADY_RUNNING);
  pullInFlight = true;

  let job;
  try {
    job = await createJobOrConflict();
  } catch (err) {
    pullInFlight = false;
    throw err;
  }

  eventBus.publish('pull-started', { jobId: job.jobId, startedAt: job.startedAt });
  logger.info(`Pull ${job.jobId} started`);

  // NOT awaited by the caller: this is the background part.
  const done = runPull(job.jobId).finally(() => {
    pullInFlight = false;
  });
  return { jobId: job.jobId, done };
}

/** The long-running work. Never throws: every outcome is recorded and published. */
async function runPull(jobId) {
  try {
    const rawTrades = await fetchTradesFromBse(); // may take up to 15 minutes
    const summary = await upsertTrades(rawTrades);
    await Job.updateOne(
      { jobId },
      { $set: { status: 'completed', completedAt: new Date(), tradeCount: summary.stored } }
    );
    const totalStored = await countTrades();
    logger.info(`Pull ${jobId} completed`, summary);
    eventBus.publish('trades-updated', { jobId, count: totalStored, fetched: summary.stored });
  } catch (err) {
    logger.error(`Pull ${jobId} failed`, err);
    const safeMessage = err.safeMessage || 'Trade pull failed due to an internal error';
    try {
      await Job.updateOne(
        { jobId },
        { $set: { status: 'failed', completedAt: new Date(), error: safeMessage } }
      );
    } catch (dbErr) {
      logger.error(`Could not record failure for ${jobId}`, dbErr);
    }
    eventBus.publish('pull-failed', { jobId, error: safeMessage });
  }
}

const isPullRunning = () => pullInFlight;

module.exports = { startPull, runPull, isPullRunning };
