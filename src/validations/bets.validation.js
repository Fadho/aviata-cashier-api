const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBetPlaced = {
  body: Joi.object().keys({
    selections: Joi.array().items(Joi.object().keys({ odd: Joi.number().required(), stake: Joi.number().required() })),
    potentialWinnings: Joi.number().required(),
    stake: Joi.number().required(),
    cashierId: Joi.string().required().custom(objectId),
    roundId: Joi.string().required(),
  }),
};
const fetchBetPlaced = {
  query: Joi.object().keys({
    selections: Joi.array().items(Joi.string().custom(objectId)),
    result: Joi.string(),
    potentialWinnings: Joi.number(),
    stake: Joi.number(),
    cashierId: Joi.string(),
  }),
};
const getBetHistory = {
  query: Joi.object().keys({
    stake: Joi.number(),
    payout: Joi.boolean(),
    clientType: Joi.string(),
    cashierId: Joi.string().custom(objectId),
    betType: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
    sortBy: Joi.string(),
    populate: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};
const getAccountingReports = {
  query: Joi.object().keys({
    clientType: Joi.string(),
    cashierId: Joi.string().custom(objectId),
    agentId: Joi.string().custom(objectId),
    betType: Joi.string(),
    startDate: Joi.string(),
    endDate: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getBetPlacedById = {
  params: Joi.object().keys({
    id: Joi.string(),
  }),
};
const cancelTicket = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};
const cashoutTicket = {
  body: Joi.object().keys({
    odd: Joi.number().required(),
    roundId: Joi.string().required(),
  }),
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  cancelTicket,
  cashoutTicket,
};
