const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const playerTransferRequestSchema = mongoose.Schema(
  {
    playerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Player',
      required: true,
    },
    deviceId: {
      type: mongoose.SchemaTypes.String,
      required: true,
    },
    requestType: {
      type: mongoose.SchemaTypes.String,
      enum: ['deposit', 'withdrawal'],
      required: true,
    },
    amount: {
      type: mongoose.SchemaTypes.Number,
      required: true,
    },
    currencyId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Currency',
    },
    status: {
      type: mongoose.SchemaTypes.String,
      enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      required: true,
    },
    gameType: {
      type: mongoose.SchemaTypes.String,
    },
    code: {
      type: mongoose.SchemaTypes.String,
    },
    transactionId: {
      type: mongoose.SchemaTypes.String,
      ref: 'TransferHistory',
      unique: true,
      sparse: true,
    },
    approvedBy: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    rejectionReason: {
      type: mongoose.SchemaTypes.String,
    },
    notes: {
      type: mongoose.SchemaTypes.String,
    },
    metadata: {
      type: mongoose.SchemaTypes.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
playerTransferRequestSchema.plugin(toJSON);
playerTransferRequestSchema.plugin(paginate);

/**
 * @typedef PlayerTransferRequest
 */
const PlayerTransferRequest = mongoose.model('PlayerTransferRequest', playerTransferRequestSchema);

module.exports = PlayerTransferRequest;
