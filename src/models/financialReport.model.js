const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const financialReportSchema = mongoose.Schema(
  {
    totalStake: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    totalWinnings: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    numberOfBets: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    profit: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    totalPlayerWallets: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    totalBonusAwarded: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    totalPlayerBonus: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    currency: {
      type: mongoose.SchemaTypes.String,
      // required: true,
    },

    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },

    agentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },

    superAgentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
financialReportSchema.plugin(toJSON);
financialReportSchema.plugin(paginate);

/**
 * @typedef FinancialReport
 */
const FinancialReport = mongoose.model('FinancialReport', financialReportSchema);

module.exports = FinancialReport;
