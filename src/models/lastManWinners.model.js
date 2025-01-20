const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const lastManWinnersSchema = mongoose.Schema(
  {
    dropAmount: {
      type: mongoose.SchemaTypes.Number,
    },

    lastManPercentage: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    gameType: {
      type: mongoose.SchemaTypes.String,
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
lastManWinnersSchema.plugin(toJSON);
lastManWinnersSchema.plugin(paginate);

/**
 * @typedef LastManWinners
 */
const LastManWinners = mongoose.model('LastManWinners', lastManWinnersSchema);

module.exports = LastManWinners;
