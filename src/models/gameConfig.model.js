const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const gameConfigSchema = mongoose.Schema({
  ticketStakeMin: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 100,
  },
  ticketStakeMax: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 10000,
  },
  ticketSizeMin: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 1,
  },
  ticketSizeMax: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 50,
  },
  quickPick: {
    type: mongoose.SchemaTypes.Array,
    required: true,
    default: [50, 100, 200, 500],
  },
  agentId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
});

// add plugin that converts mongoose to json
gameConfigSchema.plugin(toJSON);
/**
 * @typedef GameConfig
 */
const GameConfig = mongoose.model('GameConfig', gameConfigSchema);

module.exports = GameConfig;
