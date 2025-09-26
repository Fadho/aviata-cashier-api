const crypto = require('crypto');
const ApiKey = require('../models/apiKey.model');
const { th } = require('date-fns/locale');
const { userService, walletService, currencyService } = require('.');
const { default: axios } = require('axios');

/**
 * Generate a new API key for a partner
 * @param {String} partnerId - MongoDB ObjectId of the partner
 * @param {Array<String>} scopes - Array of scopes (e.g., ['read', 'write'])
 * @param {Number} expiryDays - Expiry in days (default: 90 days)
 * @returns {String} raw API key (give to partner once)
 */
const generateApiKey = async (partnerId, keyName, scopes = [], expiryDays = 90) => {
  // Generate raw API key
  const rawKey = 'tw_api_' + crypto.randomBytes(32).toString('hex');

  // Hash for DB storage
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // Set expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  // Store in DB
  await ApiKey.create({
    partnerId,
    keyHash,
    keyName,
    scopes,
    status: 'active',
    expiresAt,
  });

  // Return raw key once (do not save raw in DB!)
  return rawKey;
};

/**
 * Delete an API key for a partner
 * @param {String} rawKey - The raw API key (from partner)
 * @returns {Boolean} true if deleted, false if not found
 */
const deleteApiKey = async (apikeyId) => {
  // const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const result = await ApiKey.findOneAndDelete({ _id: apikeyId });

  return !!result; // true if deleted, false if not found
};

/**
 * Find an API key for a partner
 * @param {String} partnerId - MongoDB ObjectId of the partner
 * @returns {Array} List of API keys (hashed) for the partner
 */
const getApiKeys = async (partnerId) => {
  const apiKeys = await ApiKey.find({ partnerId }).select('-keyHash');
  return apiKeys;
};

/**
 * token Login with token and userdata
 * @param {string} username
 * @param {string} currency
 * @returns {Promise<User>}
 */
const loginUserWithToken = async (username, currency, thirdPartyId) => {
  // find currency
  const findCurrency = await currencyService.findByCurrencyCode(currency);
  if (!currency) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Currency not found');
  }
  const thirdParty = await userService.getUserById(thirdPartyId);
  if (!thirdParty) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }
  let getCashier = await userService.getUsers({ username, agentId: thirdPartyId });
  if (!getCashier.length) {
    const userBody = {
      username,
      role: 'cashier',
      agentId: thirdPartyId,
      email: req.user.email,
      superAgentId: req.user.superAgentId ? req.user.superAgentId : thirdPartyId,
      thirdParty: true,
    };
    getCashier = await userService.createUser(userBody);
    const wallet = walletService.createWallet(findCurrency._id, getCashier._id, 0);
    getCashier = await userService.getAndUpdateWallet(getCashier._id, wallet.id);
  } else {
    getCashier = getCashier[0];
  }
  return getCashier;
};

const getThirdPartyCashierDetails = async (thirdPartyId, username) => {
  const thirdParty = await userService.getUserById(thirdPartyId);
  if (!thirdParty) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }

  const cashier = await axios.post(`${thirdParty.url}/userDetails`, { username });
  return cashier.data;
};

module.exports = {
  generateApiKey,
  deleteApiKey,
  loginUserWithToken,
  getApiKeys,
  getThirdPartyCashierDetails,
};
