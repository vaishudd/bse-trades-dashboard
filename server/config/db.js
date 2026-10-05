const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');
const Trade = require('../models/Trade');
const Job = require('../models/Job');

async function connectDb(uri = config.mongodbUri) {
  // Fail fast (5s) if MongoDB is unreachable instead of hanging.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  // Make sure the unique indexes exist BEFORE we accept requests.
  await Promise.all([Trade.init(), Job.init()]);
  logger.info('MongoDB connected');
}

async function disconnectDb() {
  await mongoose.disconnect();
}

module.exports = { connectDb, disconnectDb };
