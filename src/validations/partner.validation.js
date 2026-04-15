const Joi = require('joi');
const { objectId } = require('./custom.validation');

const removeApiKey = {
  body: Joi.object().keys({
    apiKeyId: Joi.string().custom(objectId).required(),
  }),
};

const getThirdPartyCashierDetails = {
  body: Joi.object().keys({
    username: Joi.string().required(),
  }),
};

const launchGame = {
  body: Joi.object().keys({
    partner_cashier_username: Joi.string().required(),
    wallet: Joi.number().required(),
  }),
};

module.exports = {
  removeApiKey,
  getThirdPartyCashierDetails,
  launchGame,
};
