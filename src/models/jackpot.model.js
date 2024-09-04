const mongoose = require('mongoose');

const jackpotSettingsSchema = mongoose.Schema({
  percentageContributions: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 1,
  },
  jackpotName: {
    type: mongoose.SchemaTypes.String,
    required: true,
    unique: true,
  },
  lowLimitAmount: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 1000,
  },
  highLimitAmount: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 2000,
  },
  minDisplayAmount: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 800,
  },
  minStakeToWin: {
    type: mongoose.SchemaTypes.Array,
    required: true,
    default: [50, 100, 200, 500],
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
 * @typedef JackpotSettings
 */
const JackpotSettings = mongoose.model('JackpotSettings', jackpotSettingsSchema);

module.exports = JackpotSettings;
