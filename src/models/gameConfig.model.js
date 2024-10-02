const mongoose = require('mongoose');

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
  payoutMode: {
    type: String,
    enum: ['Manual', 'Automatic'],
    default: 'Manual',
    required: true,
  },
  agentId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  },
  gameType: {
    type: mongoose.SchemaTypes.String,
    // required: true,
  },
  depositBonus: {
    type: mongoose.SchemaTypes.Number,
    default: 2,
  },
});
/**
 * @typedef GameConfig
 */
const GameConfig = mongoose.model('GameConfig', gameConfigSchema);

module.exports = GameConfig;
