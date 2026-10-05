const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema(
  {
    // unique:true creates a unique index -> the database itself prevents duplicates
    tradeId: { type: String, required: true, unique: true, trim: true },
    client: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    timestamp: { type: Date, required: true },
  },
  { versionKey: false }
);

// Dashboard lists newest first, so index the sort key.
tradeSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Trade', tradeSchema);
