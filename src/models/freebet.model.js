const mongoose = require('mongoose');

const freebetSettingsSchema = mongoose.Schema({
  percentageContributions: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 0,
  },
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
 * @typedef FreebetSettings
 */
const FreebetSettings = mongoose.model('FreebetSettings', freebetSettingsSchema);

module.exports = FreebetSettings;
