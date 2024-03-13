const Selections = require('../models/selections.model');

/**
 * create a new shop account
 * @param {number} odd
 * @param {number} stake
 * @param {number} potentialWinnings
 * @returns {Promise<Selections>}
 */

const createSelection = async (odd, stake, potentialWinnings) => {
  return Selections.create({ odd: Number(odd), stake: Number(stake), potentialWinnings: Number(potentialWinnings) });
};

module.exports = {
  createSelection,
};
