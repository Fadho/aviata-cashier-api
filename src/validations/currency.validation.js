const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createCurrency = {
  body: Joi.object().keys({
    decimals: Joi.number(),
    exchangeRate: Joi.number(),
    updateType: Joi.string(),
    status: Joi.string(),
    countryId: Joi.string(),
    country: Joi.object().keys({
      name: Joi.string(),
      currencyCode: Joi.string(),
      currencySymbol: Joi.string(),
    }),
  }),
};

const getCurrencyById = {
  params: Joi.object().keys({
    agentId: Joi.string().custom(objectId).required(),
  }),
};

const updateCurrency = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      decimals: Joi.number(),
      exchangeRate: Joi.number(),
      updateType: Joi.string(),
      status: Joi.string(),
      countryId: Joi.string(),
      country: Joi.object().keys({
        name: Joi.string(),
        currencyCode: Joi.string(),
        currencySymbol: Joi.string(),
      }),
    })
    .min(1),
};
module.exports = {
  createCurrency,
  getCurrencyById,
  updateCurrency,
};
