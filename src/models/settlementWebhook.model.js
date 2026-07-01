const mongoose = require('mongoose');

const settlementWebhookSchema = mongoose.Schema(
  {
    deliveryHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.SchemaTypes.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: String,
    completedAt: {
      type: Date,
      index: { expires: '30d' },
    },
  },
  { timestamps: true }
);

const SettlementWebhook = mongoose.model('SettlementWebhook', settlementWebhookSchema);

module.exports = SettlementWebhook;
