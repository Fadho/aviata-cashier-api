const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const ticketSchema = mongoose.Schema(
  {
    roundId: {
      type: String,
      required: true,
    },
    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Cashier',
      required: true,
    },
    betType: {
      type: String,
      lowercase: true,
      enum: ['single', 'multiple'],
      required: true,
    },
    selections: [
      {
        odd: {
          type: Number,
          required: true,
        },
        stake: {
          type: Number,
          required: true,
        },
      },
    ],
    stake: {
      type: Number,
      required: true,
    },
    potentialWinnings: {
      type: Number,
      required: true,
    },
    result: {
      type: String,
      enum: ['win', 'loss'],
    },
    payout: {
      type: String,
      enum: ['close', 'open'],
      default: 'open',
      required: true,
    },
    cancelled: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
ticketSchema.plugin(toJSON);
ticketSchema.plugin(paginate);

/**
 * @typedef BetPlaced
 */
const Tickets = mongoose.model('Tickets', ticketSchema);

module.exports = Tickets;
