const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createGameConfig = {
  body: Joi.object().keys({
    ticketStakeMin: Joi.number(),
    ticketStakeMax: Joi.number(),
    ticketSizeMin: Joi.number(),
    ticketSizeMax: Joi.number(),
    quickPick: Joi.array(),
    gameType: Joi.string().required(),
    agentId: Joi.string().required(),
  }),
};

const createGameData = {
  body: Joi.object().keys({
    roundWaitTimeValue: Joi.number(),
    timerCountdownValue: Joi.number(),
    roundBetsLimit: Joi.number(),
    gameType: Joi.string().required(),
    agentId: Joi.string().required(),
  }),
};

const getgame = {
  params: Joi.object().keys({
    agentId: Joi.string().custom(objectId).required(),
    gameType: Joi.string().required(),
  }),
};

const getAgentJackpots = {
  body: Joi.object().keys({
    agentId: Joi.string().custom(objectId).required(),
    gameType: Joi.string().required(),
  }),
};

const updateJackpot = {
  body: Joi.object().keys({
    jackpotId: Joi.string().custom(objectId).required(),
    percentageContributions: Joi.number(),
    lowLimitAmount: Joi.number(),
    highLimitAmount: Joi.number(),
    minDisplayAmount: Joi.number(),
    minStakeToWin: Joi.number(),
    startTime: Joi.string(),
    endTime: Joi.string(),
  }),
};

const dropJackpot = {
  body: Joi.object().keys({
    jackpotId: Joi.string().custom(objectId).required(),
    deviceId: Joi.string().custom(objectId).required(),
    playerId: Joi.number().required(),
    jackpotAmount: Joi.number().required(),
  }),
};

const updateAgentContribution = {
  body: Joi.object().keys({
    bronzeJackpotId: Joi.required().custom(objectId),
    bronzeContributions: Joi.number(),
    silverJackpotId: Joi.required().custom(objectId),
    silverContributions: Joi.number(),
    goldJackpotId: Joi.required().custom(objectId),
    goldContributions: Joi.number(),
    deviceId: Joi.required().custom(objectId),
    gameType: Joi.string(),
  }),
};

const updateGameData = {
  params: Joi.object().keys({
    agentId: Joi.required().custom(objectId).required(),
    gameType: Joi.string().required(),
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
    gameType: Joi.string().required(),
  }),
  body: Joi.object()
    .keys({
      ticketStakeMin: Joi.number(),
      ticketStakeMax: Joi.number(),
      ticketSizeMin: Joi.number(),
      ticketSizeMax: Joi.number(),
      quickPick: Joi.array(),
      depositBonus: Joi.number(),
    })
    .min(1),
};

module.exports = {
  createGameConfig,
  createGameData,
  getgame,
  updateGameConfig,
  updateGameData,
  updateJackpot,
  getAgentJackpots,
  dropJackpot,
  updateAgentContribution,
};
