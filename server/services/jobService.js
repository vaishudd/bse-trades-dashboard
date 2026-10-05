const Job = require('../models/Job');

const PUBLIC_FIELDS = { _id: 0, jobId: 1, status: 1, startedAt: 1, completedAt: 1, tradeCount: 1, error: 1 };

const getJob = (jobId) => Job.findOne({ jobId }, PUBLIC_FIELDS).lean();

/**
 * Dashboard-friendly summary:
 *   state: idle | pulling | completed | failed
 *   lastSuccessfulPullAt: when the last completed job finished
 */
async function getStatusSummary() {
  const [latest, lastCompleted] = await Promise.all([
    Job.findOne({}, PUBLIC_FIELDS).sort({ startedAt: -1 }).lean(),
    Job.findOne({ status: 'completed' }, PUBLIC_FIELDS).sort({ completedAt: -1 }).lean(),
  ]);

  let state = 'idle';
  if (latest) state = latest.status === 'running' || latest.status === 'pending' ? 'pulling' : latest.status;

  return { state, job: latest || null, lastSuccessfulPullAt: lastCompleted ? lastCompleted.completedAt : null };
}

/**
 * Jobs left "running" after a crash would block new pulls forever.
 * olderThanMs = 0 -> fail all of them (used at startup).
 */
async function failStaleRunningJobs({ olderThanMs = 0, reason = 'Interrupted: server restarted or job timed out' } = {}) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await Job.updateMany(
    { status: 'running', startedAt: { $lte: cutoff } },
    { $set: { status: 'failed', completedAt: new Date(), error: reason } }
  );
  return result.modifiedCount;
}

module.exports = { getJob, getStatusSummary, failStaleRunningJobs };
