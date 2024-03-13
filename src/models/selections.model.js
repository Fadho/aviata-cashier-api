const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const selectionsSchema = mongoose.Schema(
  {
    odd: {
      type: Number,
      required: true,
    },
    stake: {
      type: Number,
      required: true,
    },
    potentialWinnings: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
selectionsSchema.plugin(toJSON);
selectionsSchema.plugin(paginate);

/**
 * @typedef Selections
 */
const Selections = mongoose.model('Selections', selectionsSchema);

module.exports = Selections;
