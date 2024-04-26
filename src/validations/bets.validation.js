const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBetPlaced = {
  body: Joi.object().keys({
    selections: Joi.array().items(Joi.object().keys({ odd: Joi.number().required(), stake: Joi.number().required() })),
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
const getBetHistory = {
  query: Joi.object().keys({
    username: Joi.string(),
    clientType: Joi.string(),
    betType: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
  }),
};
const getAccountingReports = {
  query: Joi.object().keys({
    clientType: Joi.string(),
    betType: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
  }),
};

const getBetPlacedById = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};
const cancelTicket = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  cancelTicket,
};
