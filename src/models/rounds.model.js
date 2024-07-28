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
