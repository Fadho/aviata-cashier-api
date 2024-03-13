const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBetPlaced = {
  body: Joi.object().keys({
    selections: Joi.array().items(Joi.string().required().custom(objectId)).required(),
    result: Joi.string().required().valid('win', 'loss'),
    winnings: Joi.number().required(),
    stake: Joi.number().required(),
    cashierId: Joi.string().required().custom(objectId),
  }),
};
const fetchBetPlaced = {
  query: Joi.object().keys({
    selections: Joi.array().items(Joi.string().custom(objectId)),
    result: Joi.string(),
    winnings: Joi.number(),
    stake: Joi.number(),
    cashierId: Joi.string(),
  }),
};

const getBetPlacedById = {
  params: Joi.object().keys({
    betPlacedId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
};
