const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const freebetWinnersSchema = mongoose.Schema(
  {
    dropAmount: {
      type: mongoose.SchemaTypes.Number,
    },

    freebetContributions: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    gameType: {
      type: mongoose.SchemaTypes.String,
      required: true,
    },

    active: {
      type: mongoose.SchemaTypes.Boolean,
      default: false,
      required: true,
    },

    playerId: {
      type: mongoose.SchemaTypes.String,
      ref: 'Player',
    },

    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
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
freebetWinnersSchema.plugin(toJSON);
freebetWinnersSchema.plugin(paginate);

/**
 * @typedef FreebetWinners
 */
const FreebetWinners = mongoose.model('FreebetWinners', freebetWinnersSchema);

module.exports = FreebetWinners;
