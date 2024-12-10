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

    numberOfTransactions: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    totalDeposit: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },

    totalWithdrawal: {
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
    jackpot1Payout: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    jackpot2Payout: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    jackpot3Payout: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    jackpot1Contributions: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    jackpot2Contributions: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
      // required: true,
    },
    jackpot3Contributions: {
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

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }
  // {
  //   timestamps: true,
  // }
);

// Pre-save middleware to calculate profit
financialReportSchema.pre('save', function (next) {
  // Profit calculation logic
  //   const totalJackpotPayout = this.jackpot1Payout + this.jackpot2Payout + this.jackpot3Payout;
  //   const totalJackpotContributions = this.jackpot1Contributions + this.jackpot2Contributions + this.jackpot3Contributions;

  this.profit = this.totalDeposit - this.totalWithdrawal;
  this.profitInUSD = this.profit / 1500;

  next(); // Proceed with saving the document
});

financialReportSchema.pre('update', () => {
  this.updateOne({}, { $set: { updatedAt: new Date() } });
});
// add plugin that converts mongoose to json
financialReportSchema.plugin(toJSON);
financialReportSchema.plugin(paginate);

/**
 * @typedef FinancialReport
 */
const FinancialReport = mongoose.model('FinancialReport', financialReportSchema);

module.exports = FinancialReport;
