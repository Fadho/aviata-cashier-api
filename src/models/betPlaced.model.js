const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const betPlacedSchema = mongoose.Schema(
  {
    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Cashier',
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
betPlacedSchema.plugin(toJSON);
betPlacedSchema.plugin(paginate);

/**
 * @typedef BetPlaced
 */
const BetPlaced = mongoose.model('BetPlaced', betPlacedSchema);

module.exports = BetPlaced;
