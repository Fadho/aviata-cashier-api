const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const transferHistorySchema = mongoose.Schema({
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
      transferHistoryCode: {
        type: String,
        required: true,
      },
      transferHistorySymbol: {
        type: String,
      },
    },
  ],
});

// add plugin that converts mongoose to json
transferHistorySchema.plugin(toJSON);
transferHistorySchema.plugin(paginate);

/**
 * @typedef TransferHistory
 */
const TransferHistory = mongoose.model('TransferHistory', transferHistorySchema);

module.exports = TransferHistory;
