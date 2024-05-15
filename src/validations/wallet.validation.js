const Joi = require('joi');
const { objectId } = require('./custom.validation');

const convertWallet = {
  body: Joi.object().keys({
    fromCurrencyId: Joi.string().required().custom(objectId),
    toCurrencyId: Joi.string().required().custom(objectId),
    userId: Joi.string().required().custom(objectId),
    amount: Joi.number(),
  }),
};

const createWallet = {
  body: Joi.object().keys({
    currencyId: Joi.string().custom(objectId),
    userId: Joi.string().custom(objectId),
    amount: Joi.number(),
    primaryWallet: Joi.boolean(),
  }),
};

const fundWallet = {
  body: Joi.object().keys({
    currencyId: Joi.string().custom(objectId),
    userId: Joi.string().required().custom(objectId),
    amount: Joi.number(),
  }),
};

module.exports = {
  createWallet,
  fundWallet,
  convertWallet,
};
