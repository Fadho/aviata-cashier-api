const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const gameSchema = mongoose.Schema({
  roundWaitTimeValue: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 10,
  },
  timerCountdownValue: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 30,
  },
  roundBetsLimit: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 10,
  },
  agentId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
});

// add plugin that converts mongoose to json
gameSchema.plugin(toJSON);
/**
 * @typedef Game
 */
const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
