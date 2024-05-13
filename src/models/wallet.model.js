const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const walletSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    currencyId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Currency',
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    pending_commission: {
      type: mongoose.SchemaTypes.String,
    },
    primaryWallet: {
      type: mongoose.SchemaTypes.Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
walletSchema.plugin(toJSON);
walletSchema.plugin(paginate);

/**
 * @typedef Wallets
 */
const Wallets = mongoose.model('Wallets', walletSchema);

module.exports = Wallets;
