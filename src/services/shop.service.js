const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const Shop = require('../models/shop.model');

/**
 * create a new shop account
 * @param {string} name
 * @param {string} email
 * @param {string} phone
 * @returns {Promise<Shop>}
 */
const createShop = async (name, email, phone) => {
  if (await Shop.isEmailTaken(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return Shop.create({ name, email, phone });
};

module.exports = {
  createShop,
};
