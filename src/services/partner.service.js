const crypto = require('crypto');
const ApiKey = require('../models/apiKey.model');
const { userService, walletService, currencyService } = require('.');
const { default: axios } = require('axios');
const { Currency, Wallets } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

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
  if (!findCurrency) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Currency not found');
  }
  const thirdParty = await userService.getUserById(thirdPartyId);
  if (!thirdParty) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }
  let getCashier = await userService.getUsers({ username, agentId: thirdPartyId });
  if (!getCashier.length) {
    const sanitizedUsername = username.replace(/[^a-z0-9]/gi, '');
    const userBody = {
      username,
      name: `${thirdPartyId}-${username}`,
      email: `${sanitizedUsername}@${thirdPartyId}.noreply.com`,
      password: `${crypto.randomBytes(6).toString('hex')}A1`,
      role: 'cashier',
      agentId: thirdPartyId,
      superAgentId: thirdParty.superAgentId ? thirdParty.superAgentId : thirdPartyId,
      thirdParty: true,
      currency,
    };
    getCashier = await userService.createUser(userBody);
    await walletService.createWallet(findCurrency._id, getCashier._id, 0, true);
    getCashier = await userService.getUserById(getCashier._id);
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

  const cashier = await axios.post(`${thirdParty.endpoint}/userDetails`, { username });
  return cashier.data;
};

/**
 * Find or create a cashier by username under the given agent, sync wallet balance.
 * @param {Object} agent - The partner/agent User document (from apiKeyAuth, i.e. req.user)
 * @param {string} partnerCashierUsername
 * @param {number} wallet - Balance to set (synced on every call)
 * @returns {Promise<User>} The cashier document
 */
const launchGame = async (agent, partnerCashierUsername, wallet) => {
  const username = partnerCashierUsername.trim().toLowerCase();

  const cashiers = await userService.getUsers({ username, agentId: agent._id });

  let cashier;

  if (!cashiers.length) {
    // Look up the currency document for wallet creation
    const currency = await Currency.findOne({ 'country.currencyCode': agent.currency });
    if (!currency) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Currency '${agent.currency}' not found`);
    }

    const sanitizedUsername = username.replace(/[^a-z0-9]/g, '');
    const userBody = {
      username,
      name: `${agent._id}-${username}`,
      email: `${sanitizedUsername}@${agent._id}.noreply.com`,
      password: crypto.randomBytes(8).toString('hex'),
      role: 'cashier',
      agentId: agent._id,
      superAgentId: agent.superAgentId || agent._id,
      thirdParty: true,
      currency: agent.currency,
    };

    cashier = await userService.createUser(userBody);
    await walletService.createWallet(currency._id, cashier._id, wallet, true);
    // Re-fetch to get populated wallets
    cashier = await userService.getUserById(cashier._id);
  } else {
    cashier = cashiers[0];
    // Sync the wallet balance on every call
    await Wallets.findOneAndUpdate({ userId: cashier._id }, { balance: wallet });
  }

  return cashier;
};

module.exports = {
  generateApiKey,
  deleteApiKey,
  loginUserWithToken,
  getApiKeys,
  getThirdPartyCashierDetails,
  launchGame,
};
