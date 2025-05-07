const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const feedbackSchema = mongoose.Schema({
  cashierId: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  },
  issue: {
    type: mongoose.SchemaTypes.String,
    required: true,
  },
  related: {
    type: mongoose.SchemaTypes.String,
    enum: ['Gameplay', 'Jackpot', 'Freebet', 'LastMan', 'Final Round Bonus'],
    required: true,
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

// add plugin that converts mongoose to json
feedbackSchema.plugin(toJSON);
/**
 * @typedef Feedback
 */
const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
