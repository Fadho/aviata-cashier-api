const Joi = require('joi');
const { objectId } = require('./custom.validation');

const turboSoccerSelection = Joi.object()
  .keys({
    matchId: Joi.string().required(),
    market: Joi.string().required(),
    selection: Joi.string().required(),
    requested_odds: Joi.number(),
    is_banker: Joi.boolean(),
    homeTeam: Joi.string(),
    awayTeam: Joi.string(),
    client_timestamp: Joi.number().integer(),
  })
  .unknown(true);

const turboSoccerBetCommon = {
  gameType: Joi.string().valid('turbo-soccer').required(),
  stake: Joi.number().positive().required(),
  cashierId: Joi.string().required().custom(objectId),
  userId: Joi.string(),
  client_timestamp: Joi.number().integer(),
  auto_accept_changes: Joi.boolean(),
  prematch: Joi.boolean(),
  type: Joi.string().lowercase().valid('single', 'accumulator', 'combinator', 'system'),
  systemSize: Joi.number().integer().min(1),
};

const turboSoccerSingleBet = Joi.object()
  .keys({
    ...turboSoccerBetCommon,
    type: Joi.string().lowercase().valid('single'),
    matchId: Joi.string().required(),
    market: Joi.string().required(),
    selection: Joi.string().required(),
    requested_odds: Joi.number(),
    homeTeam: Joi.string(),
    awayTeam: Joi.string(),
    selections: Joi.any().forbidden(),
  })
  .unknown(true);

const turboSoccerMultiBet = Joi.object()
  .keys({
    ...turboSoccerBetCommon,
    selections: Joi.array().items(turboSoccerSelection).min(1).required(),
    matchId: Joi.string(),
    market: Joi.string(),
    selection: Joi.string(),
    requested_odds: Joi.number(),
  })
  .unknown(true);

const validateTurboSoccerSelectionTypeRules = (value, helpers) => {
  const count = Array.isArray(value.selections) ? value.selections.length : 0;
  if (!count) return value;

  const resolvedType = value.type || (count === 1 ? 'single' : 'accumulator');
  const bankerCount = value.selections.filter((selection) => selection && selection.is_banker === true).length;
  const regularCount = count - bankerCount;

  if (resolvedType === 'single' && count !== 1) {
    return helpers.error('any.invalid', { message: 'single requires exactly 1 selection' });
  }

  if ((resolvedType === 'accumulator' || resolvedType === 'combinator') && count < 2) {
    return helpers.error('any.invalid', {
      message: `${resolvedType} requires at least 2 selections`,
    });
  }

  if (resolvedType === 'system') {
    if (count < 2) {
      return helpers.error('any.invalid', { message: 'system requires at least 2 selections' });
    }

    if (!Number.isInteger(value.systemSize)) {
      return helpers.error('any.invalid', { message: 'system requires systemSize' });
    }

    if (regularCount < 1) {
      return helpers.error('any.invalid', { message: 'system requires at least 1 non-banker selection' });
    }

    if (value.systemSize > regularCount) {
      return helpers.error('any.invalid', {
        message: 'systemSize cannot exceed the number of non-banker selections',
      });
    }
  }

  return value;
};

const genericBetPlaced = Joi.object().keys({
  // Selections array - each item contains match/market metadata + odds/stake
  selections: Joi.array().items(
    Joi.object().keys({
      odd: Joi.number().required(),
      stake: Joi.number().required(),
      homeTeam: Joi.string(),
      awayTeam: Joi.string(),
      market: Joi.string(),
      selection: Joi.string(),
      oddsTaken: Joi.number(),
      betCategory: Joi.string().valid('PREMATCH', 'LIVE'),
    })
  ),
  potentialWinnings: Joi.number().required(),
  stake: Joi.number().required(),
  cashierId: Joi.string().required().custom(objectId),
  roundId: Joi.string().required(),
  gameType: Joi.string(),
  currency: Joi.string(),
});

const createBetPlaced = {
  body: Joi.alternatives().try(
    turboSoccerSingleBet,
    turboSoccerMultiBet.custom(validateTurboSoccerSelectionTypeRules),
    genericBetPlaced
  ),
};

    // Selections array — each item contains match/market metadata + odds/stake
const createBetPlacedPlayer = {
  body: Joi.object().keys({
    stake: Joi.number().required(),
    cashierId: Joi.string().required().custom(objectId),
    playerId: Joi.string().required(),
    deviceId: Joi.string().custom(objectId),
    roundId: Joi.string().required(),
    gameType: Joi.string(),
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
    gameType: Joi.string(),
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
    gameType: Joi.string(),
    betType: Joi.string(),
    startDate: Joi.string(),
    thirdParty: Joi.boolean(),
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
const cashoutPlayerTicket = {
  body: Joi.object().keys({
    odd: Joi.number().required(),
    ticketId: Joi.string().custom(objectId).required(),
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
  createBetPlacedPlayer,
  cashoutPlayerTicket,
};
