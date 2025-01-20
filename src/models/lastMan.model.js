const mongoose = require('mongoose');

const lastManSchema = mongoose.Schema({
  dropAmount: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 0,
  },
  minStakeToWin: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 20,
  },
  threePlayersPercentage: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 0.3,
  },
  fivePlayersPercentage: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 0.5,
  },
  eightPlayersPercentage: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 1,
  },
  agentId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  },
  gameType: {
    type: mongoose.SchemaTypes.String,
    default: 'aviata',
  },
});
/**
 * @typedef LastMan
 */
const LastMan = mongoose.model('LastMan', lastManSchema);

module.exports = LastMan;
