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
