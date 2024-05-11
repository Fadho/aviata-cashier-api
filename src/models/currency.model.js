const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const currencySchema = mongoose.Schema({
  decimals: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 10,
  },
  exchangeRate: {
    type: mongoose.SchemaTypes.Number,
    required: true,
    default: 30,
  },
  updateType: {
    type: mongoose.SchemaTypes.Number,
    required: true,
  },
  status: {
    type: mongoose.SchemaTypes.String,
    ref: 'User',
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
/**
 * @typedef Currency
 */
const Currency = mongoose.model('Currency', currencySchema);

module.exports = Currency;
