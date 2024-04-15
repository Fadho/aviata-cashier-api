const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const betsSchema = mongoose.Schema(
  {
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
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'Selections',
      },
    ],
    stake: {
      type: Number,
      required: true,
    },
    winnings: {
      type: Number,
      required: true,
    },
    result: {
      type: String,
      enum: ['win', 'loss'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
betsSchema.plugin(toJSON);
betsSchema.plugin(paginate);

/**
 * @typedef BetPlaced
 */
const Bets = mongoose.model('Bets', betsSchema);

module.exports = Bets;
