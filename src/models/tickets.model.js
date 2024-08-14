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
    ticketId: {
      type: mongoose.SchemaTypes.String,
      unique: true,
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
        winnings: {
          type: Number,
        },
      },
    ],
    stake: {
      type: Number,
      required: true,
    },
    winnings: {
      type: Number,
      default: 0,
      required: true,
    },
    potentialWinnings: {
      type: Number,
      required: true,
    },
    deviceId: {
      type: String,
      // required: true,
    },
    gameType: {
      type: String,
      // required: true,
    },
    result: {
      type: String,
      enum: ['win', 'loss'],
    },
    roundHasEnded: {
      type: Boolean,
      default: false,
      required: true,
    },
    gameOutcome: {
      type: String,
    },
    payout: {
      type: Boolean,
      default: false,
      required: true,
    },
    payoutDate: {
      type: Date,
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
 * @typedef Tickets
 */
const Tickets = mongoose.model('Tickets', ticketSchema);

module.exports = Tickets;
