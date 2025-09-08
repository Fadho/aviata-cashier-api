const crypto = require('crypto');
const ApiKey = require('../models/apiKey.model');
const { th } = require('date-fns/locale');

/**
 * Generate a new API key for a partner
 * @param {String} partnerId - MongoDB ObjectId of the partner
 * @param {Array<String>} scopes - Array of scopes (e.g., ['read', 'write'])
 * @param {Number} expiryDays - Expiry in days (default: 90 days)
 * @returns {String} raw API key (give to partner once)
 */
const generateApiKey = async (partnerId, scopes = [], expiryDays = 90) => {
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
const deleteApiKey = async (rawKey) => {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const result = await ApiKey.findOneAndDelete({ keyHash });

  return !!result; // true if deleted, false if not found
};

/**
 * token Login with token and userdata
 * @param {string} username
 * @param {string} currency
 * @returns {Promise<User>}
 */
const loginUserWithToken = async (username, currency) => {
  //verify need for currency spontaneity, can they follow current agent structure.
  const user = await userService.getUserById(req.user.id);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }
  let getCashier = await userService.getUsers({ username, agentId: req.user.id });
  if(!getCashier.length){
    const userBody = {
      username,
      role: 'cashier',
      agentId: req.user.id,
      currency,
      thirdParty: true
    };
    getCashier = await userService.createUser(userBody);
  } else {
    getCashier = getCashier[0];
  }
  return user;
};


module.exports = {
  generateApiKey,
  deleteApiKey,
  loginUserWithToken
};
