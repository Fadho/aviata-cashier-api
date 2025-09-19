const httpStatus = require('http-status');
const { Currency, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { getAndUpdateWallet } = require('./user.service');
const { createWallet } = require('./wallet.service');

/**
 * Create a currency
 * @param {Object} currencyBody
 * @returns {Promise<Currency>}
 */
const createCurrency = async (currencyBody) => {
  const currency = await Currency.create(currencyBody);
  const user = await User.findOne({ role: 'super' });
  const wallet = await createWallet(currency.id, user.id, 'unlimited', !(user.wallets.length > 0));
  await getAndUpdateWallet(user.id, wallet.id);
  return currency;
};

/**
 * Query for currencies
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryCurrencies = async (filter, options) => {
  const currencies = await Currency.paginate(filter, options);
  return currencies;
};

const getCurrencies = async () => {
  const currencies = await Currency.find();
  return currencies;
};

const getCurrencyById = async (id) => {
  return Currency.findById(id);
};

/**
 * find currency by currencyCode
 * @param {string} currencyCode
 * @returns {Promise<Currency>}
 */
const findByCurrencyCode = function (currencyCode) {
  return this.findOne({ 'country.currencyCode': currencyCode });
};

/**
 * Update currency by id
 * @param {ObjectId} currencyId
 * @param {Object} updateBody
 * @returns {Promise<Currency>}
 */
const updateCurrencyById = async (currencyId, updateBody) => {
  const currency = await getCurrencyById(currencyId);
  if (!currency) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Currency not found');
  }
  if (updateBody.email && (await Currency.isEmailTaken(updateBody.email, currencyId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(currency, updateBody);
  await currency.save();
  return currency;
};

/**
 * Delete currency by id
 * @param {ObjectId} currencyId
 * @returns {Promise<Currency>}
 */
const deleteCurrencyById = async (currencyId) => {
  const currency = await getCurrencyById(currencyId);
  if (!currency) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Currency not found');
  }
  await currency.remove();
  return currency;
};

module.exports = {
  createCurrency,
  queryCurrencies,
  getCurrencies,
  findByCurrencyCode,
  updateCurrencyById,
  deleteCurrencyById,
  getCurrencyById,
};
