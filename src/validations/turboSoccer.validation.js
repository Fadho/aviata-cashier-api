const Joi = require('joi');

const LEAGUES = ['FRANCE', 'GERMANY', 'ITALY', 'LALIGA', 'PREMIER'];

const leagueQuery = Joi.object().keys({
  league: Joi.string().valid(...LEAGUES),
});

const teams = {
  query: leagueQuery,
};

const schedule = {
  query: leagueQuery,
};

const leagueMatches = {
  query: leagueQuery,
};

const matchOddsById = {
  params: Joi.object().keys({
    matchId: Joi.string().required(),
  }),
  query: leagueQuery,
};

const prematchSchedule = {
  query: leagueQuery,
};

const multiSelectionLeg = Joi.object()
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

const placeBetCommon = {
  stake: Joi.number().positive().required(),
  cashierId: Joi.string().required(),
  userId: Joi.string(),
  client_timestamp: Joi.number().integer(),
  auto_accept_changes: Joi.boolean(),
  prematch: Joi.boolean(),
  type: Joi.string().lowercase().valid('single', 'accumulator', 'combinator', 'system'),
  systemSize: Joi.number().integer().min(1),
};

const placeBetSingleSchema = Joi.object()
  .keys({
    ...placeBetCommon,
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

const placeBetMultiSchema = Joi.object()
  .keys({
    ...placeBetCommon,
    selections: Joi.array().items(multiSelectionLeg).min(1).required(),
    matchId: Joi.string(),
    market: Joi.string(),
    selection: Joi.string(),
    requested_odds: Joi.number(),
  })
  .unknown(true);

const validateSelectionTypeRules = (value, helpers) => {
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

const placeBet = {
  body: Joi.alternatives().try(placeBetSingleSchema, placeBetMultiSchema.custom(validateSelectionTypeRules)),
};

const placeLiveBet = {
  body: Joi.object().keys({
    matchId: Joi.string(),
    market: Joi.string().required(),
    selection: Joi.string().required(),
    stake: Joi.number().positive().required(),
    odds: Joi.number().required(),
    client_timestamp: Joi.number().integer().required(),
    auto_accept_changes: Joi.boolean(),
    cashierId: Joi.string().required(),
    userId: Joi.string(),
  }),
};

const validateLiveBet = {
  body: Joi.object().keys({
    odds: Joi.number().required(),
    client_timestamp: Joi.number().integer(),
    auto_accept_changes: Joi.boolean(),
  }),
};

const voidBet = {
  params: Joi.object().keys({
    betId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    reason: Joi.string(),
  }),
};

const getResults = {
  query: Joi.object().keys({
    date: Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .description('YYYY-MM-DD'),
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
      .description('HH:MM'),
  }),
};

const betHistory = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

const updateMatchMargin = {
  params: Joi.object().keys({
    matchId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    margin: Joi.number().min(1.0).max(1.3).required(),
  }),
};

const createLeague = {
  body: Joi.object().keys({
    id: Joi.string().required(),
    name: Joi.string().required(),
    teams: Joi.array().items(Joi.string()).min(2).required(),
    matchIntervalMinutes: Joi.number().integer().min(1),
    margin: Joi.number().min(1.0).max(1.3),
  }),
};

const leagueProgression = {
  query: leagueQuery,
};

const setLeagueMargin = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys({
    margin: Joi.number().min(1.0).max(1.3).required(),
  }),
};

const previewMargin = {
  query: Joi.object().keys({
    margin: Joi.number().min(1.0).max(1.3).required(),
  }),
};

const validateAccumulator = {
  body: Joi.object().keys({
    ticketId: Joi.string().required(),
    cashierId: Joi.string().required(),
    stake: Joi.number().positive().required(),
    legs: Joi.array()
      .items(
        Joi.object().keys({
          matchId: Joi.string().required(),
          market: Joi.string().required(),
          selection: Joi.string().required(),
          odds: Joi.number().required(),
        })
      )
      .min(2)
      .required(),
  }),
};

const initMatch = {
  body: Joi.object().keys({
    homeTeam: Joi.string().required(),
    awayTeam: Joi.string().required(),
    matchId: Joi.string().required(),
  }),
};

const quickStartMatch = {
  body: Joi.object().keys({
    homeTeam: Joi.string().required(),
    awayTeam: Joi.string().required(),
  }),
};

// ─── Chapter 10: Tickets & Printing ──────────────────────────────────────────

const selectionItem = Joi.object().keys({
  matchId: Joi.string().required(),
  homeTeam: Joi.string(),
  awayTeam: Joi.string(),
  market: Joi.string().required(),
  selection: Joi.string().required(),
  selection_label: Joi.string(),
  requested_odds: Joi.number(),
  current_odds: Joi.number(),
  match_status: Joi.string(),
});

const printTicket = {
  body: Joi.object().keys({
    ticket_data: Joi.array().items(selectionItem).min(1).required(),
    total_stake: Joi.number().positive().required(),
    client_timestamp: Joi.number().integer(),
    auto_accept_changes: Joi.boolean(),
  }),
};

// ─── Chapter 10B: Thermal Printing ───────────────────────────────────────────

const thermalPayload = Joi.object().keys({
  ticket_id: Joi.string().required(),
  shopId: Joi.string(),
  cashierId: Joi.string(),
  selections: Joi.array().min(1),
  totalOdds: Joi.number(),
  stake: Joi.number().positive(),
  potentialReturn: Joi.number(),
  betType: Joi.string(),
  systemSize: Joi.number(),
  unitStake: Joi.number().allow(null),
  rowStakes: Joi.array(),
  linesGenerated: Joi.number(),
  grMode: Joi.string(),
  bet_lines: Joi.array(),
});

const printThermal = {
  body: thermalPayload,
};

const reprintThermal = {
  body: thermalPayload,
};

// ─── Settlement Webhook ──────────────────────────────────────────────────────

const settledTicketSchema = Joi.object()
  .keys({
    ticket_hash: Joi.string(),
    ticketHash: Joi.string(),
    ticketId: Joi.string(),
    betId: Joi.string(),
    vfBetId: Joi.string(),
    status: Joi.string().valid('WON', 'LOST', 'VOID', 'PENDING', 'win', 'loss', 'void', 'pending').insensitive(),
    result: Joi.string().valid('WON', 'LOST', 'VOID', 'PENDING', 'win', 'loss', 'void', 'pending').insensitive(),
    payout_amount: Joi.number().min(0),
    payoutAmount: Joi.number().min(0),
    payout: Joi.number().min(0),
    market_id: Joi.string(),
    marketId: Joi.string(),
    market: Joi.string(),
    market_leg_result: Joi.string().valid('WON', 'LOST', 'VOID', 'MIXED').insensitive(),
    marketLegResult: Joi.string().valid('WON', 'LOST', 'VOID', 'MIXED').insensitive(),
  })
  .or('ticket_hash', 'ticketHash', 'ticketId', 'betId', 'vfBetId');

const settlementWebhookPayload = {
  body: Joi.object()
    .keys({
      event: Joi.string()
        .valid('MATCH_SETTLED', 'MARKET_SETTLED', 'settlement.complete', 'market.settlement.complete')
        .required(),
      matchId: Joi.string(),
      fixture_id: Joi.string(),
      fixtureId: Joi.string(),
      homeTeam: Joi.string(),
      awayTeam: Joi.string(),
      final_score: Joi.string(),
      finalScore: Joi.object().keys({
        home: Joi.number().integer().required(),
        away: Joi.number().integer().required(),
      }),
      settledAt: Joi.date().iso(),
      resolution_time: Joi.date().iso(),
      resolutionTime: Joi.date().iso(),
      completedAt: Joi.date().iso(),
      market_id: Joi.string(),
      marketId: Joi.string(),
      winning_selection: Joi.string(),
      winningSelection: Joi.string(),
      event_aliases: Joi.array().items(Joi.string()),
      leagueName: Joi.string()
        .uppercase()
        .valid(...LEAGUES)
        .allow(null),
      summary: Joi.object().keys({
        settled: Joi.number().integer(),
        won: Joi.number().integer(),
        lost: Joi.number().integer(),
        voided: Joi.number().integer(),
      }),
      tickets_graded: Joi.array().items(settledTicketSchema),
      ticketsGraded: Joi.array().items(settledTicketSchema),
      ticketsSettled: Joi.array().items(settledTicketSchema),
      bets: Joi.array().items(settledTicketSchema),
    })
    .or('matchId', 'fixture_id', 'fixtureId')
    .or('tickets_graded', 'ticketsGraded', 'ticketsSettled', 'bets'),
};

module.exports = {
  teams,
  schedule,
  leagueMatches,
  matchOddsById,
  prematchSchedule,
  placeBet,
  placeLiveBet,
  validateLiveBet,
  getResults,
  voidBet,
  betHistory,
  updateMatchMargin,
  createLeague,
  setLeagueMargin,
  leagueProgression,
  previewMargin,
  validateAccumulator,
  initMatch,
  quickStartMatch,
  // Chapter 10
  printTicket,
  printThermal,
  reprintThermal,
  // Settlement Webhook
  settlementWebhookPayload,
};
