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

const multiSelectionLeg = Joi.object().keys({
  matchId: Joi.string().required(),
  market: Joi.string().required(),
  selection: Joi.string().required(),
  requested_odds: Joi.number(),
  homeTeam: Joi.string(),
  awayTeam: Joi.string(),
  client_timestamp: Joi.number().integer(),
});

const placeBetCommon = {
  stake: Joi.number().positive().required(),
  cashierId: Joi.string().required(),
  userId: Joi.string(),
  client_timestamp: Joi.number().integer(),
  auto_accept_changes: Joi.boolean(),
  prematch: Joi.boolean(),
};

const placeBetSingleSchema = Joi.object().keys({
  ...placeBetCommon,
  matchId: Joi.string().required(),
  market: Joi.string().required(),
  selection: Joi.string().required(),
  requested_odds: Joi.number(),
  selections: Joi.any().forbidden(),
});

const placeBetMultiSchema = Joi.object().keys({
  ...placeBetCommon,
  selections: Joi.array().items(multiSelectionLeg).min(1).required(),
  matchId: Joi.string(),
  market: Joi.string(),
  selection: Joi.string(),
  requested_odds: Joi.number(),
});

const placeBet = {
  body: Joi.alternatives().try(placeBetSingleSchema, placeBetMultiSchema),
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
    startTime: Joi.string(),
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

const registerWebhook = {
  body: Joi.object().keys({
    targetUrl: Joi.string().uri().required(),
    secret: Joi.string().min(32).required(),
    description: Joi.string(),
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
});

const printThermal = {
  body: thermalPayload,
};

const reprintThermal = {
  body: thermalPayload,
};

// ─── Settlement Webhook ──────────────────────────────────────────────────────

const settlementWebhookPayload = {
  body: Joi.object().keys({
    event: Joi.string().valid('MATCH_SETTLED').required(),
    matchId: Joi.string().required(),
    homeTeam: Joi.string(),
    awayTeam: Joi.string(),
    finalScore: Joi.object().keys({
      home: Joi.number().integer().required(),
      away: Joi.number().integer().required(),
    }),
    settledAt: Joi.date().iso(),
    leagueName: Joi.string()
      .uppercase()
      .valid(...LEAGUES)
      .allow(null),
    fixtureId: Joi.string(),
    summary: Joi.object().keys({
      settled: Joi.number().integer(),
      won: Joi.number().integer(),
      lost: Joi.number().integer(),
      voided: Joi.number().integer(),
    }),
    bets: Joi.array()
      .items(
        Joi.object().keys({
          betId: Joi.string().required(),
          market: Joi.string(),
          selection: Joi.string(),
          oddsTaken: Joi.number(),
          stake: Joi.number().required(),
          result: Joi.string().valid('WON', 'LOST', 'VOID').insensitive().required(),
          payout: Joi.number().min(0).required(),
        })
      )
      .required(),
  }),
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
  registerWebhook,
  initMatch,
  quickStartMatch,
  // Chapter 10
  printTicket,
  printThermal,
  reprintThermal,
  // Settlement Webhook
  settlementWebhookPayload,
};
