const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Creates a short-lived JWT for authenticating with the VF Engine.
 * @returns {string}
 */
const issueEngineToken = () => {
  return jwt.sign({ operatorId: config.vfengine.operatorId }, config.vfengine.jwtSecret, { expiresIn: '8h' });
};

/**
 * Returns an axios instance pre-configured with the VF Engine base URL.
 * A fresh token is injected per request to avoid using expired tokens.
 * @returns {import('axios').AxiosInstance}
 */
const client = () =>
  (() => {
    const instance = axios.create({
      baseURL: config.vfengine.baseUrl,
      timeout: 10000,
    });

    // Enforce VF Engine auth token on every outbound request, even if callers pass custom headers.
    instance.interceptors.request.use((reqConfig) => {
      const nextConfig = reqConfig;
      nextConfig.headers = {
        ...(nextConfig.headers || {}),
        Authorization: `Bearer ${issueEngineToken()}`,
      };
      return nextConfig;
    });

    return instance;
  })();

// ─── Fixtures & Schedule ─────────────────────────────────────────────────────

const getTeams = (league) => {
  const params = {};
  if (league) params.league = league;
  return client().get('/api/teams', { params });
};

const getSchedule = (league) => {
  const params = {};
  if (league) params.league = league;
  return client().get('/api/schedule', { params });
};

const getResults = (date, startTime) => {
  const params = {};
  if (date) params.date = date;
  if (startTime) params.startTime = startTime;
  return client().get('/api/results', { params });
};

const getPublicLeagues = () => client().get('/api/leagues');

const initMatch = (body) => client().post('/api/match/init', body);

const startMatch = () => client().post('/api/match/start');

const quickStartMatch = (body) => client().post('/api/match/quick-start', body);

// ─── Odds ─────────────────────────────────────────────────────────────────────

const getPrematchOdds = (homeTeam, awayTeam) => client().get('/api/prematch/odds', { params: { homeTeam, awayTeam } });

const getMatchOdds = () => client().get('/api/match/odds');

const getMatchState = () => client().get('/api/match/state');

// ─── Cashier / Terminal Display ───────────────────────────────────────────────

const getLeagueMatches = (league) => {
  const params = {};
  if (league) params.league = league;
  return client().get('/api/league/matches', { params });
};

const getMatchOddsById = (matchId, league) => {
  const params = {};
  if (league) params.league = league;
  return client().get(`/api/league/matches/${encodeURIComponent(matchId)}/odds`, { params });
};

const getPrematchSchedule = (league) => {
  const params = {};
  if (league) params.league = league;
  return client().get('/api/league/prematch/schedule', { params });
};

// ─── Bets ─────────────────────────────────────────────────────────────────────

const resolveEngineTimestamp = (clientTimestamp) => {
  const offset = Number(config.vfengine.clockOffsetMs || 0);
  const parsed = Number(clientTimestamp);

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed + offset);
  }

  return Date.now() + offset;
};

const placeBet = (body) =>
  client().post('/api/bets/place', {
    ...body,
    client_timestamp: resolveEngineTimestamp(body && body.client_timestamp),
  });

const placeLiveBet = (body) =>
  client().post('/api/live/bet', {
    ...body,
    client_timestamp: resolveEngineTimestamp(body && body.client_timestamp),
  });

const validateLiveBet = (body) =>
  client().post('/api/live/bet/validate', {
    odds: body.odds,
    auto_accept_changes: body.auto_accept_changes,
    client_timestamp: resolveEngineTimestamp(body && body.client_timestamp),
  });

const getBetHistory = (page, limit) => client().get('/api/bets/history', { params: { page, limit } });

const voidBet = (betId, reason) => client().post(`/api/bets/${encodeURIComponent(betId)}/void`, { reason });

// ─── Admin — Margins ──────────────────────────────────────────────────────────

const getMargins = () => client().get('/api/admin/margins');

const previewMargin = (margin) => client().get('/api/admin/margins/preview', { params: { margin } });

const updateMatchMargin = (matchId, margin) =>
  client().put(`/api/admin/match/${encodeURIComponent(matchId)}/margin`, { margin });

// ─── Admin — Leagues ──────────────────────────────────────────────────────────

const getLeagues = () => client().get('/api/admin/leagues');

const getLeagueProgression = (league) => {
  const params = {};
  if (league) params.league = league;
  return client().get('/api/admin/leagues/progression', { params });
};

const persistLeagueProgression = () => client().post('/api/admin/leagues/progression/persist');

const createLeague = (body) => client().post('/api/admin/leagues', body);

const getLeague = (id) => client().get(`/api/admin/leagues/${encodeURIComponent(id)}`);

const deleteLeague = (id) => client().delete(`/api/admin/leagues/${encodeURIComponent(id)}`);

const generateLeagueSchedule = (id) => client().post(`/api/admin/leagues/${encodeURIComponent(id)}/schedule`);

const getLeagueSchedule = (id) => client().get(`/api/admin/leagues/${encodeURIComponent(id)}/schedule`);

const getLeagueMargin = (id) => client().get(`/api/admin/leagues/${encodeURIComponent(id)}/margin`);

const setLeagueMargin = (id, margin) => client().put(`/api/admin/leagues/${encodeURIComponent(id)}/margin`, { margin });

// ─── Admin — Accumulator ──────────────────────────────────────────────────────

const getAccumulatorConfig = () => client().get('/api/admin/accumulator/config');

const updateAccumulatorConfig = (body) => client().put('/api/admin/accumulator/config', body);

const validateAccumulator = (body) => client().post('/api/admin/accumulator/validate', body);

// ─── Admin — Throttler ────────────────────────────────────────────────────────

const getThrottlerStatus = () => client().get('/api/admin/throttler/status');

// ─── Tickets & Printing (Chapter 10) ─────────────────────────────────────────

const printTicket = (body) => client().post('/api/tickets/print', body);

// ─── DO NOT INTEGRATE — VF Engine Ledger/Wallet ─────────────────────────────
// The VF Engine exposes /api/ledger/wallet/* and /api/ledger/ticket/* endpoints.
// These are intentionally NOT integrated. aviata-cashier-api manages its own
// wallet balances and ticket records via its own MongoDB models.
// Never proxy /api/ledger/* through this service.
// Affected endpoints (ignore permanently):
//   POST /api/ledger/wallet/ensure          (ensureWallet)
//   GET  /api/ledger/wallet/:shopId/balance (getWalletBalance)
//   GET  /api/ledger/wallet/by-user/:userId (getWalletByUser)
//   POST /api/ledger/wallet/:shopId/topup   (topupWallet)
//   POST /api/ledger/ticket/print           (ledgerPrintTicket)
//   GET  /api/ledger/ticket/:ticketId       (getLedgerTicket)
//   GET  /api/ledger/shop/:shopId/tickets   (getShopTickets)
//   POST /api/ledger/ticket/:ticketId/settle (settleLedgerTicket)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Thermal Printing (Chapter 10B) ──────────────────────────────────────────

const printThermal = (body) => client().post('/api/print/thermal', body);

const reprintThermal = (body) => client().post('/api/print/thermal/reprint', body);

// ─── Admin — Webhooks ─────────────────────────────────────────────────────────

const getWebhooks = () => client().get('/api/admin/webhooks/settlement');

const registerWebhook = (body) => client().post('/api/admin/webhooks/settlement', body);

const deleteWebhook = (webhookId) => client().delete(`/api/admin/webhooks/settlement/${encodeURIComponent(webhookId)}`);

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  issueEngineToken,
  // Fixtures
  getTeams,
  getSchedule,
  getResults,
  getPublicLeagues,
  initMatch,
  startMatch,
  quickStartMatch,
  // Odds
  getPrematchOdds,
  getMatchOdds,
  getMatchState,
  // Cashier display
  getLeagueMatches,
  getMatchOddsById,
  getPrematchSchedule,
  // Bets
  placeBet,
  placeLiveBet,
  validateLiveBet,
  getBetHistory,
  voidBet,
  // Admin — margins
  getMargins,
  previewMargin,
  updateMatchMargin,
  // Admin — leagues
  getLeagues,
  createLeague,
  getLeague,
  deleteLeague,
  generateLeagueSchedule,
  getLeagueSchedule,
  getLeagueMargin,
  setLeagueMargin,
  // Admin — accumulator
  getAccumulatorConfig,
  updateAccumulatorConfig,
  validateAccumulator,
  // Admin — throttler
  getThrottlerStatus,
  getLeagueProgression,
  persistLeagueProgression,
  // Admin — webhooks
  getWebhooks,
  registerWebhook,
  deleteWebhook,
  // Tickets & Printing (Chapter 10)
  printTicket,
  // Thermal Printing (Chapter 10B)
  printThermal,
  reprintThermal,
};
