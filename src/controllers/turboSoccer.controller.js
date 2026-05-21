const crypto = require('crypto');
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const logger = require('../config/logger');
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

const formatEngineRoute = (axiosConfig = {}, fallbackMethod = 'GET') => {
  const method = (axiosConfig.method || fallbackMethod || 'GET').toUpperCase();
  const base = axiosConfig.baseURL || '';
  const url = axiosConfig.url || '';
  return `${method} ${base}${url}`.trim();
};

/**
 * Wraps a vfengineService call, maps axios errors to ApiErrors, and proxies the result.
 */
const proxyVf = (fn) =>
  catchAsync(async (req, res) => {
    try {
      const vfRes = await fn(req);
      proxyResponse(res, vfRes);
    } catch (err) {
      const cashierRoute = `${req.method} ${req.originalUrl}`;
      const engineRoute = formatEngineRoute(err.config, req.method);
      if (err.response) {
        // eslint-disable-next-line prefer-destructuring
        const data = err.response.data;
        logger.error(
          '[VF Engine error] cashierRoute=%s engineRoute=%s status=%s reason=%s code=%s payload=%j',
          cashierRoute,
          engineRoute,
          err.response.status,
          (data && (data.error || data.message)) || err.message || 'Unknown VF Engine error',
          (data && data.code) || err.code || 'UNKNOWN',
          data || {}
        );
        const message = (data && (data.error || data.message)) || 'VF Engine error';
        const apiErr = new ApiError(err.response.status, message, true, '', data && data.code ? data.code : null);
        if (data && data.current_odds != null) {
          apiErr.currentOdds = data.current_odds;
        }
        throw apiErr;
      }
      const unreachableDetails = {
        message: err.message || 'No error message from axios',
        code: err.code || 'UNKNOWN',
        syscall: err.syscall || '',
        address: err.address || '',
        port: err.port || '',
      };
      logger.error(
        '[VF Engine unreachable] cashierRoute=%s engineRoute=%s reason=%s details=%j',
        cashierRoute,
        engineRoute,
        unreachableDetails.message,
        unreachableDetails
      );
      throw new ApiError(httpStatus.BAD_GATEWAY, 'VF Engine is unreachable');
    }
  });

const buildVFootballLauncherUrl = (token) => {
  const normalizedBaseUrl = config.gameLauncherUrl.endsWith('/') ? config.gameLauncherUrl : `${config.gameLauncherUrl}/`;
  return `${normalizedBaseUrl}player.html?token=${encodeURIComponent(token)}`;
};

// ─── Fixtures & Schedule ─────────────────────────────────────────────────────

const getTeams = proxyVf((req) => vfengineService.getTeams(req.query.league));

const getSchedule = proxyVf((req) => vfengineService.getSchedule(req.query.league));

const getResults = proxyVf((req) => vfengineService.getResults(req.query.date, req.query.startTime));

const getAvailableLeagues = proxyVf(() => vfengineService.getPublicLeagues());

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
    logger.warn('[SettlementWebhook] Missing signature header');
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
    logger.warn('[SettlementWebhook] Invalid signature', { signature });
    return res.status(httpStatus.UNAUTHORIZED).json({ success: false, error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (_) {
    logger.error('[SettlementWebhook] Failed to parse JSON payload');
    return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Invalid JSON payload' });
  }

  logger.info('[SettlementWebhook] Received valid settlement webhook', {
    matchId: payload.matchId,
    fixtureId: payload.fixtureId,
    leagueName: payload.leagueName,
    betCount: Array.isArray(payload.bets) ? payload.bets.length : 0,
  });

  // Respond immediately to prevent VF Engine retry loops; process asynchronously
  res.status(httpStatus.OK).json({ received: true });

  // Process settlement asynchronously with error logging
  turboSoccerService.processSettlement(payload).catch((err) => {
    logger.error('[SettlementWebhook] Unexpected error during settlement processing', {
      matchId: payload.matchId,
      leagueName: payload.leagueName,
      error: err.message,
      stack: err.stack,
    });
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

const getLeagueProgression = proxyVf((req) => vfengineService.getLeagueProgression(req.query.league));

const persistLeagueProgression = proxyVf(() => vfengineService.persistLeagueProgression());

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
  getAvailableLeagues,
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
  getLeagueProgression,
  persistLeagueProgression,
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
