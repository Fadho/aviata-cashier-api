/* eslint-disable no-restricted-syntax */

const { JackpotWinners } = require('../models');
const { userService } = require('.');

/**
 * drop jackpot
 * @param {string} id
 * @returns {Promise<JackpotWinners>}
 */
// const dropJackpot = async (id) => {
//   return JackpotWinners.findById(id).populate('currencyId');
// };



/**
 * create a new jackpot
 * @param {object} balance
 * @param {boolean} primary
 * @param {ObjectId} userId
 * @param {ObjectId} currencyId
 * @returns {Promise<JackpotWinners>}
 */
const createJackpot = async (currencyId, userId, balance, primary) => {
  let wallet;
  if (primary) {
    wallet = await JackpotWinners.create({ currencyId, userId, balance, primaryJackpot: true });
  } else {
    wallet = await JackpotWinners.create({ currencyId, balance, userId });
  }

  return userService.getAndUpdateJackpot(userId, wallet._id);
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<JackpotWinners[]>}
 */
const findJackpot = async (currencyId, userId, primary) => {
  if (primary) return JackpotWinners.find({ userId, primaryJackpot: true });
  return JackpotWinners.find({ currencyId, userId });
};
/**
 * update a wallet
 * @param {ObjectId} id
 * @param {number} balance
 * @returns {Promise<JackpotWinners>}
 */
const updateJackpot = async (id, balance) => {
  return JackpotWinners.findByIdAndUpdate(id, { balance }, { new: true });
};

module.exports = {
  createJackpot,
  findJackpot,
  updateJackpot,
  getJackpotById,
};
