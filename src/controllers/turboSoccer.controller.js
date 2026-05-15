const crypto = require('crypto');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { userService, walletService } = require('../services');
const vfengineService = require('../services/vfengine.service');
const turboSoccerService = require('../services/turboSoccer.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Proxies a VF Engine response directly to the client.
 * @param {import('express').Response} res
 * @param {import('axios').AxiosResponse} vfRes
 */
const proxyResponse = (res, vfRes) => res.status(vfRes.status).json(vfRes.data);

/**
 * Wraps a vfengineService call, maps axios errors to ApiErrors, and proxies the result.
 */
const proxyVf = (fn) =>
  catchAsync(async (req, res) => {
    try {
      const vfRes = await fn(req);
      // eslint-disable-next-line no-console
      console.log('[VF Engine response]', vfRes.status, JSON.stringify(vfRes.data));
      proxyResponse(res, vfRes);
    } catch (err) {
      if (err.response) {
        // eslint-disable-next-line prefer-destructuring
        const data = err.response.data;
        // eslint-disable-next-line no-console
        console.error('[VF Engine error]', err.response.status, JSON.stringify(data));
        const message = (data && (data.error || data.message)) || 'VF Engine error';
        throw new ApiError(err.response.status, message);
      }
      // eslint-disable-next-line no-console
      console.error('[VF Engine unreachable]', err.message);
      throw new ApiError(httpStatus.BAD_GATEWAY, 'VF Engine is unreachable');
    }
  });

const buildVFootballLauncherUrl = (token) => {
  const normalizedBaseUrl = config.gameLauncherUrl.endsWith('/') ? config.gameLauncherUrl : `${config.gameLauncherUrl}/`;
  return `${normalizedBaseUrl}player.html?token=${encodeURIComponent(token)}`;
};

// ─── Fixtures & Schedule ─────────────────────────────────────────────────────

const getTeams = proxyVf(() => vfengineService.getTeams());

const getSchedule = proxyVf(() => vfengineService.getSchedule());

const getResults = proxyVf((req) => vfengineService.getResults(req.query.date, req.query.startTime));

const getLeagueMatches = proxyVf((req) => vfengineService.getLeagueMatches(req.query.league));

const getMatchOddsById = proxyVf((req) => vfengineService.getMatchOddsById(req.params.matchId, req.query.league));

const getPrematchSchedule = proxyVf((req) => vfengineService.getPrematchSchedule(req.query.league));

const getPrematchOdds = proxyVf((req) => vfengineService.getPrematchOdds(req.query.homeTeam, req.query.awayTeam));

const getMatchOdds = proxyVf(() => vfengineService.getMatchOdds());

const getMatchState = proxyVf(() => vfengineService.getMatchState());

// ─── Bets ─────────────────────────────────────────────────────────────────────

const placeBet = catchAsync(async (req, res) => {
  const { cashierId } = req.body;
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier not found');
  }
  const userWallet = await walletService.getWalletById(user.wallets[0]);
  if (!userWallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier wallet not found');
  }
  const vfResponse = await turboSoccerService.placeBet(userWallet, req.body, cashierId);
  res.status(httpStatus.OK).json(vfResponse);
});

const placeLiveBet = catchAsync(async (req, res) => {
  const { cashierId } = req.body;
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier not found');
  }
  const userWallet = await walletService.getWalletById(user.wallets[0]);
  if (!userWallet) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier wallet not found');
  }
  const vfResponse = await turboSoccerService.placeLiveBet(userWallet, req.body, cashierId);
  res.status(httpStatus.OK).json(vfResponse);
});

const validateLiveBet = proxyVf((req) => vfengineService.validateLiveBet(req.body));

const getBetHistory = proxyVf((req) =>
  vfengineService.getBetHistory(
    req.query.page != null ? String(req.query.page) : undefined,
    req.query.limit != null ? String(req.query.limit) : undefined
  )
);

const voidBet = catchAsync(async (req, res) => {
  const result = await turboSoccerService.voidBet(req.params.betId, req.body.reason);
  res.status(httpStatus.OK).json(result);
});

// ─── WebSocket Token ──────────────────────────────────────────────────────────

/**
 * Issues a short-lived JWT for the terminal to connect directly to the VF Engine WebSocket.
 */
const getWsConnectionInfo = catchAsync(async (req, res) => {
  const token = vfengineService.issueEngineToken();
  res.status(httpStatus.OK).json({
    success: true,
    wsUrl: config.vfengine.baseUrl,
    token,
  });
});

/**
 * Returns a launcher URL for the authenticated cashier to open VFootball.
 */
const getVFootballGameLauncher = catchAsync(async (req, res) => {
  const token = vfengineService.issueEngineToken();
  const url = buildVFootballLauncherUrl(token);

  res.status(httpStatus.OK).json({
    success: true,
    token,
    url,
  });
});

// ─── Settlement Webhook ───────────────────────────────────────────────────────

/**
 * Receives HMAC-SHA256 signed settlement payloads from the VF Engine.
 * IMPORTANT: Route must be mounted with express.raw({ type: 'application/json' })
 * so req.body is a raw Buffer for signature verification.
 */
const handleSettlementWebhook = (req, res) => {
  const signature = req.headers['x-signature'];
  if (!signature) {
    return res.status(httpStatus.UNAUTHORIZED).json({ success: false, error: 'Missing signature' });
  }

  const expected = `sha256=${crypto.createHmac('sha256', config.vfengine.webhookSecret).update(req.body).digest('hex')}`;

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    valid = false;
  }

  if (!valid) {
    return res.status(httpStatus.UNAUTHORIZED).json({ success: false, error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (_) {
    return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Invalid JSON payload' });
  }

  // Respond immediately to prevent VF Engine retry loops; process asynchronously
  res.status(httpStatus.OK).json({ received: true });

  turboSoccerService.processSettlement(payload).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[TurboSoccer settlement error]', err.message);
  });
};

// ─── Admin — Margins ──────────────────────────────────────────────────────────

const getMargins = proxyVf(() => vfengineService.getMargins());

const previewMargin = proxyVf((req) => vfengineService.previewMargin(req.query.margin));

const updateMatchMargin = proxyVf((req) => vfengineService.updateMatchMargin(req.params.matchId, req.body.margin));

// ─── Admin — Leagues ──────────────────────────────────────────────────────────

const getLeagues = proxyVf(() => vfengineService.getLeagues());

const createLeague = proxyVf((req) => vfengineService.createLeague(req.body));

const getLeague = proxyVf((req) => vfengineService.getLeague(req.params.id));

const deleteLeague = proxyVf((req) => vfengineService.deleteLeague(req.params.id));

const getLeagueSchedule = proxyVf((req) => vfengineService.getLeagueSchedule(req.params.id));

const generateLeagueSchedule = proxyVf((req) => vfengineService.generateLeagueSchedule(req.params.id));

const getLeagueMargin = proxyVf((req) => vfengineService.getLeagueMargin(req.params.id));

const setLeagueMargin = proxyVf((req) => vfengineService.setLeagueMargin(req.params.id, req.body.margin));

// ─── Admin — Accumulator ──────────────────────────────────────────────────────

const getAccumulatorConfig = proxyVf(() => vfengineService.getAccumulatorConfig());

const updateAccumulatorConfig = proxyVf((req) => vfengineService.updateAccumulatorConfig(req.body));

const validateAccumulator = proxyVf((req) => vfengineService.validateAccumulator(req.body));

// ─── Admin — Throttler ────────────────────────────────────────────────────────

const getThrottlerStatus = proxyVf(() => vfengineService.getThrottlerStatus());

// ─── Admin — Webhooks ─────────────────────────────────────────────────────────

const getWebhooks = proxyVf(() => vfengineService.getWebhooks());

const registerWebhook = proxyVf((req) => vfengineService.registerWebhook(req.body));

const deleteWebhook = proxyVf((req) => vfengineService.deleteWebhook(req.params.webhookId));

// ─── Admin — Match Control ────────────────────────────────────────────────────

const initMatch = proxyVf((req) => vfengineService.initMatch(req.body));

const startMatch = proxyVf(() => vfengineService.startMatch());

const quickStartMatch = proxyVf((req) => vfengineService.quickStartMatch(req.body));

// ─── Tickets & Printing (Chapter 10) ─────────────────────────────────────────

const printTicket = proxyVf((req) => vfengineService.printTicket(req.body));

// ─── Thermal Printing (Chapter 10B) ──────────────────────────────────────────

const printThermal = proxyVf((req) => vfengineService.printThermal(req.body));

const reprintThermal = proxyVf((req) => vfengineService.reprintThermal(req.body));

module.exports = {
  // Fixtures
  getTeams,
  getSchedule,
  getResults,
  getLeagueMatches,
  getMatchOddsById,
  getPrematchSchedule,
  getPrematchOdds,
  getMatchOdds,
  getMatchState,
  // Bets
  placeBet,
  placeLiveBet,
  validateLiveBet,
  getBetHistory,
  voidBet,
  // WS token
  getWsConnectionInfo,
  getVFootballGameLauncher,
  // Settlement webhook
  handleSettlementWebhook,
  // Admin — margins
  getMargins,
  previewMargin,
  updateMatchMargin,
  // Admin — leagues
  getLeagues,
  createLeague,
  getLeague,
  deleteLeague,
  getLeagueSchedule,
  generateLeagueSchedule,
  getLeagueMargin,
  setLeagueMargin,
  // Admin — accumulator
  getAccumulatorConfig,
  updateAccumulatorConfig,
  validateAccumulator,
  // Admin — throttler
  getThrottlerStatus,
  // Admin — webhooks
  getWebhooks,
  registerWebhook,
  deleteWebhook,
  // Admin — match control
  initMatch,
  startMatch,
  quickStartMatch,
  // Tickets & Printing (Chapter 10)
  printTicket,
  // Thermal Printing (Chapter 10B)
  printThermal,
  reprintThermal,
};
