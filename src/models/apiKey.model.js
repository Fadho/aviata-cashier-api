const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const apiKeySchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
    scopes: {
      type: [String],
      default: [],
    },
    expiresAt: {
      type: Date,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * @typedef ApiKey
 */

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
