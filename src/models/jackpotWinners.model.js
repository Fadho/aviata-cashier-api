const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const jackpotWinnersSchema = mongoose.Schema(
  {
    jackpotAmount: {
      type: mongoose.SchemaTypes.Number,
      required: true,
    },

    jackpotType: {
      type: mongoose.SchemaTypes.String,
      // enum: ['Bronze', 'Silver', 'Gold'],
      required: true,
    },

    playerId: {
      type: mongoose.SchemaTypes.String,
      ref: 'Player',
      required: true,
    },

    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },

    deviceId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'GameDevice',
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
