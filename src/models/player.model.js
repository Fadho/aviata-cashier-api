const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const playerSchema = mongoose.Schema(
  {
    playerId: {
      type: mongoose.SchemaTypes.Number,
      required: true,
    },

    wallet: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
    },

    deviceId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'GameDevice',
    },

    agentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },

    superAgentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
playerSchema.plugin(toJSON);
playerSchema.plugin(paginate);

/**
 * @typedef Player
 */
const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
