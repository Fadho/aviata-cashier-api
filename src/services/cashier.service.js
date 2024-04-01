const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const User = require('../models/user.model');

/**
 * create a new shop account
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {ObjectId} shopId
 * @returns {Promise<Cashier>}
 */
const createCashier = async (name, email, password, shopId) => {
  if (await User.isEmailTaken(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create({ name, email, password, shopId });
};

module.exports = {
  createCashier,
};
