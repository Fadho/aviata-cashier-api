const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createGameConfig = {
  body: Joi.object().keys({
    ticketStakeMin: Joi.number(),
    ticketStakeMax: Joi.number(),
    ticketSizeMin: Joi.number(),
    ticketSizeMax: Joi.number(),
    quickPick: Joi.array(),
    agentId: Joi.string().required(),
  }),
};

const createGameData = {
  body: Joi.object().keys({
    roundWaitTimeValue: Joi.number(),
    timerCountdownValue: Joi.number(),
    roundBetsLimit: Joi.number(),
    agentId: Joi.string().required(),
  }),
};

const getgame = {
  params: Joi.object().keys({
    agentId: Joi.string().custom(objectId).required(),
  }),
};

const updateGameData = {
  params: Joi.object().keys({
    agentId: Joi.required().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      roundWaitTimeValue: Joi.number(),
      timerCountdownValue: Joi.number(),
      roundBetsLimit: Joi.number(),
      rtp: Joi.number(),
    })
    .min(1),
};

const updateGameConfig = {
  params: Joi.object().keys({
    agentId: Joi.required().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      ticketStakeMin: Joi.number(),
      ticketStakeMax: Joi.number(),
      ticketSizeMin: Joi.number(),
      ticketSizeMax: Joi.number(),
      quickPick: Joi.array(),
    })
    .min(1),
};

module.exports = {
  createGameConfig,
  createGameData,
  getgame,
  updateGameConfig,
  updateGameData,
};
