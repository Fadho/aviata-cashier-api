const BetPlaced = require('../models/betPlaced.model');

/**
 * create a new shop account
 * @param {string} result
 * @param {number} stake
 * @param {number} winnings
 * @param {ObjectId[]} selections
 * @param {ObjectId} cashierId
 * @returns {Promise<BetPlaced>}
 */
const createBetPlaced = async (result, stake, winnings, selections, cashierId) => {
  return BetPlaced.create({ result, stake, winnings, selections, cashierId });
};

/**
 * create a new shop account
 * @returns {Promise<BetPlaced>}
 */

const fetchBetPlaced = async () => {
  return BetPlaced.find();
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<BetPlaced>}
 */
const getBetPlacedById = async (id) => {
  return BetPlaced.findById(id);
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
};
