const mongoose = require('mongoose');
const { allowedPartnerApiScopes, defaultPartnerApiScopes } = require('../config/partner');

const apiKeySchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    keyName: {
      type: String,
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
      enum: allowedPartnerApiScopes,
      default: defaultPartnerApiScopes,
    },
    expiresAt: {
      type: Date,
    },
    lastUsedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

apiKeySchema.index({ partnerId: 1, keyName: 1 });

/**
 * @typedef ApiKey
 */

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

module.exports = ApiKey;
