const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const currencySchema = mongoose.Schema({
  decimals: {
    type: mongoose.SchemaTypes.Number,
    required: true,
  },
  exchangeRate: {
    type: mongoose.SchemaTypes.Number,
    required: true,
  },
  updateType: {
    type: mongoose.SchemaTypes.String,
    required: true,
  },
  status: {
    type: mongoose.SchemaTypes.String,
    required: true,
  },
  countryId: {
    type: mongoose.SchemaTypes.String,
    required: true,
  },
  country: [
    {
      name: {
        type: String,
        required: true,
      },
      currencyCode: {
        type: String,
        required: true,
      },
      currencySymbol: {
        type: String,
      },
    },
  ],
});

// add plugin that converts mongoose to json
currencySchema.plugin(toJSON);
currencySchema.plugin(paginate);

/**
 * @typedef Currency
 */
const Currency = mongoose.model('Currency', currencySchema);

module.exports = Currency;
