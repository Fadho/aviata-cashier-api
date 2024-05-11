const httpStatus = require('http-status');
const { Currency } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a currency
 * @param {Object} currencyBody
 * @returns {Promise<Currency>}
 */
const createCurrency = async (currencyBody) => {
  if (await Currency.isEmailTaken(currencyBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return Currency.create(currencyBody);
};

/**
 * Query for currencys
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryCurrencys = async (filter, options) => {
  const currencys = await Currency.paginate(filter, options);
  return currencys;
};

/**
 * Query for get currencys where
 * @param {string} role - Mongo filter
 * @returns {Promise<Currency>}
 */
const getCurrencysWhereClientType = async (role) => {
  const currencys = await Currency.find({ role });
  return currencys;
};
/**
 * Get currency by id
 * @param {ObjectId} id
 * @returns {Promise<Currency>}
 */
const getCurrencyById = async (id) => {
  return Currency.findById(id);
};
/**
 * Get currency by currencyname
 * @param {string} currencyname
 * @returns {Promise<Currency>}
 */
const getCurrencyByCurrencyname = async (currencyname) => {
  return Currency.findOne({ name: currencyname });
};
/**
 * Get currency by currencyname
 * @param {string} currencyname
 * @returns {Promise<Currency>}
 */
const getCurrencyByRole = async (role) => {
  return Currency.find({ role });
};
/**
 * Get last admin login
 * @returns {Promise<Currency>}
 */
const getLastAdminLogin = async (currencyId) => {
  const today = new Date(); // Create a Date object for the current date and time
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const currency = await Currency.findById(currencyId);
  if (currency.lastlogin > today) {
    return currency;
  }
};

/**
 * Get currency by email
 * @param {string} email
 * @returns {Promise<Currency>}
 */
const getCurrencyByEmail = async (email) => {
  return Currency.findOne({ email });
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
  queryCurrencys,
  getCurrencyById,
  getLastAdminLogin,
  getCurrencyByEmail,
  updateCurrencyById,
  deleteCurrencyById,
  getCurrencysWhereClientType,
  getCurrencyByCurrencyname,
  getCurrencyByRole,
};
