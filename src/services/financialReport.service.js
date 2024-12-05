const httpStatus = require('http-status');
const { FinancialReport } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Get and update financial report - stake
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateStake = async (id, cashierId, stake) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalStake: stake,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalStake: financialReport.totalStake + stake,
      numberOfBets: financialReport.numberOfBets + 1,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - bonus
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateBonusAwarded = async (cashierId, bonus) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { gte: today } });

  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalBonusAwarded: bonus,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalBonusAwarded: financialReport.totalBonusAwarded + bonus,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - bonus
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateBonus = async (cashierId, bonus) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { gte: today } });

  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalPlayerBonus: bonus,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalPlayerBonus: financialReport.totalPlayerBonus + bonus,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - stake
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateWinnings = async (cashierId, winnings) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalWinnings: winnings,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalWinnings: financialReport.totalWinnings + winnings,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - player wallets
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdatePlayerWallets = async (cashierId, balance) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalPlayerWallets: balance,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalPlayerWallets: financialReport.totalPlayerWallets + balance,
    },
    { new: true }
  );
};

/**
 * Create a financialReport
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const createFinancialReport = async (financialReportBody) => {
  if (await FinancialReport.isEmailTaken(financialReportBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return FinancialReport.create(financialReportBody);
};

/**
 * Query for financialReports
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryFinancialReports = async (filter, options) => {
  const financialReports = await FinancialReport.paginate(filter, options);
  return financialReports;
};

const getFinancialReports = async (filter, options) => {
  const financialReports = await FinancialReport.find(filter, options);
  return financialReports;
};

module.exports = {
  createFinancialReport,
  queryFinancialReports,
  getAndUpdateBonus,
  getAndUpdateStake,
  getFinancialReports,
  getAndUpdateBonusAwarded,
  getAndUpdatePlayerWallets,
  getAndUpdateWinnings,
};
