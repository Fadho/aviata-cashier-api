const Joi = require('joi');
const { objectId } = require('./custom.validation');
const { allowedPartnerApiScopes } = require('../config/partner');

const createApiKey = {
  body: Joi.object().keys({
    keyName: Joi.string().trim().min(1).max(100).required(),
    scopes: Joi.array()
      .items(Joi.string().valid(...allowedPartnerApiScopes))
      .min(1)
      .unique(),
    expiryDays: Joi.number().integer().min(1).max(365),
    userId: Joi.string().custom(objectId).optional(),
  }),
};

const removeApiKey = {
  body: Joi.object().keys({
    apiKeyId: Joi.string().custom(objectId).required(),
  }),
};

const getThirdPartyCashierDetails = {
  body: Joi.object().keys({
    username: Joi.string().trim().min(1).max(128).required(),
  }),
};

const launchGame = {
  body: Joi.object().keys({
    partner_cashier_username: Joi.string().trim().min(1).max(128).required(),
    wallet: Joi.number().min(0).max(Number.MAX_SAFE_INTEGER).required(),
    wallet_version: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
  }),
};

module.exports = {
  createApiKey,
  removeApiKey,
  getThirdPartyCashierDetails,
  launchGame,
};
