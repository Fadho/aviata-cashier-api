const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const transferHistorySchema = mongoose.Schema({
  agent: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  },
  transactionType: {
    type: mongoose.SchemaTypes.String,
    required: true,
  },
  target: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'User',
    required: true,
  },
  currency: {
    type: mongoose.SchemaTypes.ObjectId,
    ref: 'Currency',
    required: true,
  },
  deposit: {
    type: mongoose.SchemaTypes.Number,
    // required: true,
  },
  withdrawal: {
    type: mongoose.SchemaTypes.Number,
    // required: true,
  },
});

// add plugin that converts mongoose to json
transferHistorySchema.plugin(toJSON);
transferHistorySchema.plugin(paginate);

/**
 * @typedef TransferHistory
 */
const TransferHistory = mongoose.model('TransferHistory', transferHistorySchema);

module.exports = TransferHistory;
