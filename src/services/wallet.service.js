/* eslint-disable no-restricted-syntax */

const { Wallets } = require('../models');

/**
 * create a new shop account
 * @param {string} id
 * @returns {Promise<Wallets>}
 */
const getWalletById = async (id) => {
  return Wallets.findById(id);
};
/**
 * create a new shop account
 * @param {object} balance
 * @param {boolean} primary
 * @param {ObjectId} userId
 * @param {ObjectId} currencyId
 * @returns {Promise<Wallets>}
 */
const createWallet = async (currencyId, userId, balance, primary) => {
  if (primary) {
    return Wallets.create({ currencyId, userId, balance, primaryWallet: true });
  }
  return Wallets.create({ currencyId, balance, userId });
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<Wallets[]>}
 */
const findWallet = async (currencyId, userId, primary) => {
  if (primary) return Wallets.find({ userId, primaryWallet: true });
  return Wallets.find({ currencyId, userId });
};
/**
 * create a new shop account
 * @param {ObjectId} id
 * @param {number} balance
 * @returns {Promise<Wallets>}
 */
const updateWallet = async (id, balance) => {
  return Wallets.findByIdAndUpdate(id, { balance }, { new: true });
};

module.exports = {
  createWallet,
  findWallet,
  updateWallet,
  getWalletById,
};
