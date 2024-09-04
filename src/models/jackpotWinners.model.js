const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const jackpotWinnersSchema = mongoose.Schema(
  {
    JackpotAmount: {
      type: mongoose.SchemaTypes.Number,
      required: true,
    },
    JackpotType: {
      type: mongoose.SchemaTypes.String,
      enum: ['bronze', 'silver', 'gold'],
      required: true,
    },

    playerId: {
      type: mongoose.SchemaTypes.String,
      required: true,
    },
    username: {
      type: mongoose.SchemaTypes.String,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
jackpotWinnersSchema.plugin(toJSON);
jackpotWinnersSchema.plugin(paginate);

/**
 * @typedef JackpotWinners
 */
const JackpotWinners = mongoose.model('JackpotWinners', jackpotWinnersSchema);

module.exports = JackpotWinners;
