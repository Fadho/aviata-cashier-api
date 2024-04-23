const Bets = require('../models/bets.model');

/**
 * create a new shop account
 * @param {string} result
 * @param {number} stake
 * @param {number} winnings
 * @param {ObjectId[]} selections
 * @param {ObjectId} cashierId
 * @returns {Promise<Bets>}
 */
const createBetPlaced = async (result, stake, winnings, selections, cashierId) => {
  if (selections.length > 1) {
    return Bets.create({ result, stake, winnings, selections, cashierId, betType: 'multiple' });
  }
  return Bets.create({ result, stake, winnings, selections, cashierId, betType: 'single' });
};

/**
 * create a new shop account
 * @returns {Promise<Bets>}
 */

const fetchBetPlaced = async () => {
  return Bets.find();
};

/**
 * create a new shop account
 * @param {Object} filter
 * @returns {Promise<Bets>}
 */
const getBetHistory = async ({ startDate, endDate, betType, cashierId }) => {
  const query = {};
  if (!startDate || !endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }

    return Bets.find({
      ...query,
    });
  }
  if (startDate && endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }
    if (!betType && !cashierId) {
      const bets = await Bets.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
      return bets;
    }

    return Bets.find({
      ...query,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
  }
};
/**
 * create a new shop account
 * @param {Object} filter
 * @returns {Promise<Bets>}
 */
const getAccountingReports = async ({ startDate, endDate, betType, cashierId }) => {
  const query = {};
  if (!startDate || !endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }

    return Bets.find({
      ...query,
    });
  }
  if (startDate && endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }
    if (!betType && !cashierId) {
      const bets = await Bets.find({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
      return bets;
    }

    return Bets.find({
      ...query,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
  }
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<Bets>}
 */
const getBetPlacedById = async (id) => {
  return Bets.findById(id);
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
};
