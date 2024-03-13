const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const Cashier = require('../models/cashier.model');

/**
 * create a new shop account
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {ObjectId} shopId
 * @returns {Promise<Cashier>}
 */
const createCashier = async (name, email, password, shopId) => {
  if (await Cashier.isEmailTaken(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return Cashier.create({ name, email, password, shopId });
};

module.exports = {
  createCashier,
};
