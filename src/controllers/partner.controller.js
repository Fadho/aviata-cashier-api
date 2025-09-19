const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { generateApiKey, deleteApiKey, getApiKeys } = require('../services/partner.service');

// Generate and manage API keys for partners, multi-keys per partner 
// to allow key rotation and revocation without downtime.
// Create, delete, list keys.

/**
 * Generate API Key
 */
const createApiKey = async (req, res, next) => {
  try {
    const apiKey = await generateApiKey(req.user._id);
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
    const { apiKey } = req.body;
    if (!apiKey) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'API key is required');
    }
    await deleteApiKey(req.user.id, apiKey);
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
    const apiKeys = await getApiKeys(req.user.id);
    res.status(httpStatus.OK).send({ apiKeys });
 m  } catch (error) {
    next(error);
  }
};

module.exports = { createApiKey, removeApiKey, listApiKeys };
