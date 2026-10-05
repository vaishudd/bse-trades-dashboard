const mongoose = require('mongoose');

const JOB_STATUSES = ['pending', 'running', 'completed', 'failed'];

const jobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true },
    status: { type: String, enum: JOB_STATUSES, default: 'pending' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    tradeCount: { type: Number, default: 0 },
    error: { type: String }, // short, safe message only, never a stack trace
  },
  { versionKey: false }
);

jobSchema.index({ startedAt: -1 });

// Database-level guard against concurrent pulls: MongoDB itself refuses a second
// document with status "running". Works even if two server instances race.
jobSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'running' }, name: 'only_one_running_job' }
);

module.exports = mongoose.model('Job', jobSchema);
module.exports.JOB_STATUSES = JOB_STATUSES;
