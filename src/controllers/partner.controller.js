const httpStatus = require('http-status');
const { generateApiKey, deleteApiKey, getApiKeys, getAvailableGames } = require('../services/partner.service');

// Generate and manage API keys for partners, multi-keys per partner
// to allow key rotation and revocation without downtime.
// Create, delete, list keys.

/**
 * Generate API Key
 */
const createApiKey = async (req, res, next) => {
  try {
    const { keyName, scopes, expiryDays } = req.body;
    const apiKey = await generateApiKey(req.user, keyName, scopes, expiryDays);
    res.status(httpStatus.CREATED).send({ apiKey });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete API Key
 */
const removeApiKey = async (req, res, next) => {
  try {
    const { apiKeyId } = req.body;
    // if (!apiKey) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'API key is required');
    // }
    await deleteApiKey(req.user, apiKeyId);
    res.status(httpStatus.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
};

/**
 * List API Key
 */
const listApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await getApiKeys(req.user);
    res.status(httpStatus.OK).send({ apiKeys });
  } catch (error) {
    next(error);
  }
};

const listAvailableGames = async (req, res, next) => {
  try {
    const games = await getAvailableGames(req.user);
    res.status(httpStatus.OK).send({ games });
  } catch (error) {
    next(error);
  }
};

module.exports = { createApiKey, removeApiKey, listApiKeys, listAvailableGames };
