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
 * create a new shop account
 * @param {object} balance
 * @param {boolean} primary
 * @param {ObjectId} userId
 * @param {ObjectId} currencyId
 * @returns {Promise<JackpotWinners>}
 */
const createWallet = async (currencyId, userId, balance, primary) => {
  let wallet;
  if (primary) {
    wallet = await JackpotWinners.create({ currencyId, userId, balance, primaryWallet: true });
  } else {
    wallet = await JackpotWinners.create({ currencyId, balance, userId });
  }

  return userService.getAndUpdateWallet(userId, wallet._id);
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<JackpotWinners[]>}
 */
const findWallet = async (currencyId, userId, primary) => {
  if (primary) return JackpotWinners.find({ userId, primaryWallet: true });
  return JackpotWinners.find({ currencyId, userId });
};
/**
 * update a wallet
 * @param {ObjectId} id
 * @param {number} balance
 * @returns {Promise<JackpotWinners>}
 */
const updateWallet = async (id, balance) => {
  return JackpotWinners.findByIdAndUpdate(id, { balance }, { new: true });
};

module.exports = {
  createWallet,
  findWallet,
  updateWallet,
  getWalletById,
};
