/* eslint-disable no-restricted-syntax */

const { Wallets } = require('../models');
const { userService } = require('.');

/**
 * create a new shop account
 * @param {string} id
 * @returns {Promise<Wallets>}
 */
const getWalletById = async (id) => {
  return Wallets.findById(id).populate('currencyId');
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
  let wallet;
  if (primary) {
    wallet = await Wallets.create({ currencyId, userId, balance, primaryWallet: true });
  } else {
    wallet = await Wallets.create({ currencyId, balance, userId });
  }

  return userService.getAndUpdateWallet(userId, wallet._id);
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
 * update a wallet
 * @param {ObjectId} id
 * @param {number} balance
 * @returns {Promise<Wallets>}
 */
const updateWallet = async (id, balance) => {
  return Wallets.findByIdAndUpdate(id, { balance }, { new: true });
};

const incrementWallet = async (id, amount) => {
  return Wallets.findByIdAndUpdate(id, { $inc: { balance: amount } }, { new: true });
};

/**
 * Credits a settlement exactly once. The key check, balance increment, and key
 * insertion are one MongoDB document update, so concurrent webhook deliveries
 * cannot credit the same outcome twice.
 */
const creditSettlement = async (id, amount, settlementKey) => {
  return Wallets.findOneAndUpdate(
    { _id: id, settlementCreditKeys: { $ne: settlementKey } },
    {
      $inc: { balance: amount },
      $addToSet: { settlementCreditKeys: settlementKey },
    },
    { new: true }
  );
};

module.exports = {
  createWallet,
  findWallet,
  updateWallet,
  incrementWallet,
  creditSettlement,
  getWalletById,
};
