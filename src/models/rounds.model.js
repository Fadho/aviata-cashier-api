const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const roundsSchema = mongoose.Schema(
  {
    roundId: {
      type: mongoose.SchemaTypes.String,
      unique: true,
    },
    odd: {
      type: mongoose.SchemaTypes.String,
    },
    roundHasEnded: {
      type: mongoose.SchemaTypes.Boolean,
      default: false,
    },
    gameType: {
      type: mongoose.SchemaTypes.String,
    },
    order: {
      type: mongoose.SchemaTypes.Number,
      default: 0, // 3 - upcoming, 2 - next round, 1 - current round, 0 - completed round
    },
    superAgentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'user',
      // required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
roundsSchema.plugin(toJSON);
roundsSchema.plugin(paginate);

/**
 * @typedef Tickets
 */
const Rounds = mongoose.model('Rounds', roundsSchema);

module.exports = Rounds;
