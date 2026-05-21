const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const walletService = require('./wallet.service');
const vfengineService = require('./vfengine.service');
const logger = require('../config/logger');
const Tickets = require('../models/tickets.model');
const User = require('../models/user.model');

const GAME_TYPE = 'turbo-soccer';

const resolveAcceptedOdds = (source, fallbackOdds) => {
  if (source && source.accepted_odds != null) return Number(source.accepted_odds);
  if (source && source.final_odds != null) return Number(source.final_odds);
  return Number(fallbackOdds);
};

const getSelectionStake = (totalStake, selectionCount) => {
  if (!selectionCount || selectionCount < 1) return totalStake;
  return totalStake / selectionCount;
};

const toTicketSelections = (vfResponse, betBody, stake) => {
  const isMulti = Array.isArray(betBody.selections) && betBody.selections.length > 0;
  const betCategory = betBody.prematch === false ? 'LIVE' : 'PREMATCH';

  if (!isMulti) {
    const acceptedOdds = resolveAcceptedOdds(vfResponse, betBody.requested_odds);
    return [
      {
        homeTeam: vfResponse.homeTeam || betBody.homeTeam,
        awayTeam: vfResponse.awayTeam || betBody.awayTeam,
        market: vfResponse.market || betBody.market,
        selection: vfResponse.selection || betBody.selection,
        odd: acceptedOdds,
        oddsTaken: acceptedOdds,
        betCategory,
        stake,
      },
    ];
  }

  const responseSelections = Array.isArray(vfResponse.selections) ? vfResponse.selections : [];
  const requestSelections = betBody.selections || [];
  const selectionStake = getSelectionStake(stake, requestSelections.length || responseSelections.length || 1);

  return requestSelections.map((selectionBody, index) => {
    const selectionResponse = responseSelections[index] || {};
    const acceptedOdds = resolveAcceptedOdds(selectionResponse, selectionBody.requested_odds);

    return {
      homeTeam: selectionResponse.homeTeam || selectionBody.homeTeam,
      awayTeam: selectionResponse.awayTeam || selectionBody.awayTeam,
      market: selectionResponse.market || selectionBody.market,
      selection: selectionResponse.selection || selectionBody.selection,
      odd: acceptedOdds,
      oddsTaken: acceptedOdds,
      betCategory,
      stake: selectionStake,
    };
  });
};

const getPotentialWinnings = (vfResponse, stake, selections) => {
  const enginePotentialReturn = Number(vfResponse.potentialReturn);
  if (!Number.isNaN(enginePotentialReturn) && Number.isFinite(enginePotentialReturn) && enginePotentialReturn > 0) {
    return enginePotentialReturn;
  }

  const totalOdds = Number(vfResponse.totalOdds);
  if (!Number.isNaN(totalOdds) && Number.isFinite(totalOdds) && totalOdds > 0) {
    return stake * totalOdds;
  }

  const singleOdds = Number(vfResponse.accepted_odds);
  if (!Number.isNaN(singleOdds) && Number.isFinite(singleOdds) && singleOdds > 0) {
    return stake * singleOdds;
  }

  if (Array.isArray(selections) && selections.length > 0) {
    const multipliedOdds = selections.reduce((acc, s) => acc * (Number(s.oddsTaken) || 1), 1);
    return stake * multipliedOdds;
  }

  return 0;
};

/**
 * Maps an error from the VF Engine axios response to a local ApiError.
 * @param {import('axios').AxiosError} err
 * @returns {ApiError}
 */
const mapVfEngineError = (err) => {
  const { response = {} } = err;
  const { status } = response;
  const { code, error: errMsg } = response.data || {};
  const message = errMsg || 'VF Engine request failed';

  if (code === 'MARKET_SUSPENDED') {
    return new ApiError(httpStatus.FORBIDDEN, 'Markets are suspended — please wait', true, '', code);
  }
  if (code === 'MARKET_CLOSED') {
    return new ApiError(httpStatus.BAD_REQUEST, 'Market is closed', true, '', code);
  }
  if (code === 'NO_ACTIVE_MATCH' || message.toLowerCase().includes('no active match')) {
    return new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'No active match — betting is currently unavailable',
      true,
      '',
      code || 'NO_ACTIVE_MATCH'
    );
  }
  if (code === 'ODDS_CHANGED') {
    const apiErr = new ApiError(httpStatus.CONFLICT, 'Odds have changed', true, '', code);
    const data = response.data || {};
    apiErr.currentOdds = data.current_odds;
    return apiErr;
  }
  if (status === httpStatus.NOT_FOUND) {
    return new ApiError(httpStatus.NOT_FOUND, message);
  }
  return new ApiError(status || httpStatus.BAD_GATEWAY, message);
};

/**
 * Places a pre-match or early in-play Turbo Soccer bet.
 * Debits the cashier wallet, forwards the bet to the VF Engine, and records a
 * local Ticket. Refunds the wallet automatically if the VF Engine rejects the bet.
 *
 * Selection Structure (per selection item in ticket.selections[]):
 * Each selection now includes match and market metadata:
 *   - homeTeam: string      — Team name (from VF Engine response)
 *   - awayTeam: string      — Team name (from VF Engine response)
 *   - market: string        — Market code (e.g. 'match_winner')
 *   - selection: string     — Selection value (e.g. 'home', 'draw', 'away')
 *   - odd: number           — Decimal odds accepted by the engine
 *   - oddsTaken: number     — Same as `odd` (for backward compatibility)
 *   - betCategory: string   — 'PREMATCH' | 'LIVE' (from betBody.prematch flag)
 *   - stake: number         — Portion of stake for this selection
 *
 * @param {object} userWallet - Populated wallet document (user.wallets[0])
 * @param {object} betBody    - Validated request body { matchId, market, selection, stake, ... }
 * @param {string} cashierId  - Cashier user ObjectId (for Ticket FK)
 * @returns {Promise<object>} - VF Engine bet response { bet_id, accepted_odds, ... }
 */
const placeBet = async (userWallet, betBody, cashierId) => {
  const stake = Number(betBody.stake);
  const balance = Number(userWallet.balance);

  if (Number.isNaN(balance) || Number.isNaN(stake)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid balance or stake amount');
  }
  if (balance - stake < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bet cannot be placed, insufficient funds');
  }

  await walletService.updateWallet(userWallet.id, balance - stake);

  let vfResponse;
  try {
    const { data } = await vfengineService.placeBet(betBody);
    vfResponse = data;
  } catch (err) {
    // Compensating write: refund the wallet
    await walletService.updateWallet(userWallet.id, balance);
    throw mapVfEngineError(err);
  }

  const isMulti = Array.isArray(betBody.selections) && betBody.selections.length > 0;
  const selections = toTicketSelections(vfResponse, betBody, stake);
  const matchIdForStorage =
    vfResponse.matchId ||
    betBody.matchId ||
    (Array.isArray(vfResponse.selections) && vfResponse.selections[0] && vfResponse.selections[0].matchId) ||
    (isMulti && betBody.selections[0] && betBody.selections[0].matchId) ||
    null;
  const potentialWinnings = getPotentialWinnings(vfResponse, stake, selections);

  try {
    await Tickets.create({
      roundId: matchIdForStorage || (isMulti ? 'vf-turbo-acca' : 'vf-turbo'),
      cashierId,
      ticketId: vfResponse.bet_id,
      betType: isMulti ? 'multiple' : 'single',
      selections,
      stake,
      winnings: 0,
      potentialWinnings,
      gameType: GAME_TYPE,
      roundHasEnded: false,
      payout: false,
      cancelled: false,
      vfBetId: vfResponse.bet_id,
      matchId: matchIdForStorage,
    });
  } catch (err) {
    // Keep wallet/ticket consistency if local persistence fails after engine acceptance.
    await walletService.updateWallet(userWallet.id, balance);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Bet accepted by engine but could not be recorded locally; wallet has been restored'
    );
  }

  return vfResponse;
};

/**
 * Places an in-play Turbo Soccer bet via the VF Engine Grace Period Middleware.
 * Same wallet debit/refund pattern as placeBet.
 *
 * Ticket selection structure mirrors placeBet — each selection in the array includes:
 *   - homeTeam, awayTeam, market, selection, odd, oddsTaken, betCategory, stake
 *
 * @param {object} userWallet - Populated wallet document
 * @param {object} betBody    - Request body { matchId, market, selection, stake, odds, client_timestamp, ... }
 * @param {string} cashierId  - Cashier user ObjectId
 * @returns {Promise<object>} - VF Engine response { bet_id, final_odds, approved, ... }
 */
const placeLiveBet = async (userWallet, betBody, cashierId) => {
  const stake = Number(betBody.stake);
  const balance = Number(userWallet.balance);

  if (Number.isNaN(balance) || Number.isNaN(stake)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid balance or stake amount');
  }
  if (balance - stake < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bet cannot be placed, insufficient funds');
  }

  await walletService.updateWallet(userWallet.id, balance - stake);

  let vfResponse;
  try {
    const { data } = await vfengineService.placeLiveBet(betBody);
    vfResponse = data;
  } catch (err) {
    await walletService.updateWallet(userWallet.id, balance);
    throw mapVfEngineError(err);
  }

  // Accept both response styles:
  // - Grace middleware: { approved: true|false, final_odds }
  // - Legacy/other engines: { status: 'ACCEPTED', final_odds }
  const isRejected =
    vfResponse.approved === false ||
    vfResponse.status === 'REJECTED' ||
    vfResponse.status === 'DECLINED' ||
    vfResponse.status === 'FAILED';

  if (isRejected) {
    await walletService.updateWallet(userWallet.id, balance);
    throw new ApiError(httpStatus.CONFLICT, vfResponse.message || 'Live bet not approved by engine');
  }

  const finalOdds = Number(vfResponse.final_odds != null ? vfResponse.final_odds : betBody.odds);

  try {
    await Tickets.create({
      // Live bet responses do not include matchId; fall back to the request body value
      roundId: betBody.matchId || 'vf-turbo-live',
      cashierId,
      ticketId: vfResponse.bet_id,
      betType: 'single',
      selections: [
        {
          homeTeam: vfResponse.homeTeam || betBody.homeTeam,
          awayTeam: vfResponse.awayTeam || betBody.awayTeam,
          market: vfResponse.market || betBody.market,
          selection: vfResponse.selection || betBody.selection,
          odd: finalOdds,
          oddsTaken: finalOdds,
          betCategory: 'LIVE',
          stake,
        },
      ],
      stake,
      winnings: 0,
      potentialWinnings: stake * finalOdds,
      gameType: GAME_TYPE,
      roundHasEnded: false,
      payout: false,
      cancelled: false,
      vfBetId: vfResponse.bet_id,
      matchId: betBody.matchId,
    });
  } catch (err) {
    await walletService.updateWallet(userWallet.id, balance);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Live bet accepted by engine but could not be recorded locally; wallet has been restored'
    );
  }

  return vfResponse;
};

/**
 * Administratively voids a PENDING Turbo Soccer bet.
 * Updates the local Ticket, calls the VF Engine void endpoint, and refunds
 * the ORIGINAL cashier's wallet (looked up from the ticket).
 *
 * @param {string} vfBetId - The VF Engine bet_id
 * @param {string} reason  - Optional void reason
 * @returns {Promise<object>}
 */
const voidBet = async (vfBetId, reason) => {
  const ticket = await Tickets.findOne({ vfBetId, gameType: GAME_TYPE });
  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bet not found');
  }
  if (ticket.cancelled || ticket.roundHasEnded) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bet is not eligible for void');
  }

  try {
    await vfengineService.voidBet(vfBetId, reason);
  } catch (err) {
    throw mapVfEngineError(err);
  }

  ticket.cancelled = true;
  ticket.roundHasEnded = true;
  ticket.payout = true;
  ticket.payoutDate = new Date();
  await ticket.save();

  // Refund the cashier who originally placed the bet
  const originalCashier = await User.findById(ticket.cashierId).populate('wallets');
  if (originalCashier && originalCashier.wallets && originalCashier.wallets.length > 0) {
    const cashierWallet = originalCashier.wallets[0];
    const balance = Number(cashierWallet.balance);
    await walletService.updateWallet(cashierWallet.id, balance + ticket.stake);
  }

  return {
    success: true,
    betId: vfBetId,
    status: 'VOID',
    voidReason: reason || null,
    voidedAt: new Date().toISOString(),
  };
};

/**
 * Processes a settlement payload pushed by the VF Engine webhook.
 * Idempotent — skips bets that have already been settled.
 * Updates local Ticket statuses, credits WON wallets, and refunds VOID stakes.
 *
 * @param {object} payload - SettlementWebhookPayload from the VF Engine
 * @returns {Promise<void>}
 */
/**
 * Resolves the wallet credit amount for a single settled bet.
 * @param {string} result  - Uppercase result: 'WON' | 'LOST' | 'VOID'
 * @param {number} payout  - Engine-reported payout value
 * @returns {number}
 */
const resolveCreditAmount = (result, payout) => {
  if (result === 'WON') return payout;
  return 0;
};

/**
 * Applies a single bet outcome to the local Ticket and credits the wallet if needed.
 * Includes logging for wallet credit failures and settlement tracking.
 *
 * @param {{ betId: string, result: string, payout: number }} bet
 * @param {Date} now
 * @param {string} leagueName - League name for audit trail
 * @param {object} metrics - Settlement metrics accumulator
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const applyBetSettlement = async (bet, now, leagueName, metrics = {}) => {
  const result = bet.result ? bet.result.toUpperCase() : null;
  const payoutAmount = Number(bet.payout) || 0;

  const update = { roundHasEnded: true, result: null, winnings: 0 };

  if (result === 'WON') {
    update.result = 'win';
    update.winnings = payoutAmount;
    update.payout = true;
    update.payoutDate = now;
    // eslint-disable-next-line no-param-reassign
    metrics.wonCount = (metrics.wonCount || 0) + 1;
  } else if (result === 'LOST') {
    update.result = 'loss';
    update.winnings = 0;
    // eslint-disable-next-line no-param-reassign
    metrics.lostCount = (metrics.lostCount || 0) + 1;
  } else if (result === 'VOID') {
    update.cancelled = true;
    update.result = null;
    update.winnings = 0;
    update.payout = true;
    update.payoutDate = now;
    // eslint-disable-next-line no-param-reassign
    metrics.voidedCount = (metrics.voidedCount || 0) + 1;
  }

  const ticket = await Tickets.findOneAndUpdate(
    { vfBetId: bet.betId, gameType: GAME_TYPE, roundHasEnded: false, cancelled: false },
    update,
    { new: true }
  );

  if (!ticket) {
    // Bet not found or already settled
    // eslint-disable-next-line no-param-reassign
    metrics.skippedCount = (metrics.skippedCount || 0) + 1;
    return { success: false, reason: 'already_settled' };
  }

  const creditAmount = resolveCreditAmount(result, payoutAmount);
  if (creditAmount > 0) {
    try {
      const cashier = await User.findById(ticket.cashierId).select('wallets').populate('wallets');

      if (!cashier || !cashier.wallets || cashier.wallets.length === 0) {
        logger.warn('[TurboSoccerSettlement] Wallet not found for cashier', {
          vfBetId: bet.betId,
          cashierId: ticket.cashierId,
          leagueName,
          creditAmount,
          result,
        });
        // eslint-disable-next-line no-param-reassign
        metrics.walletNotFoundCount = (metrics.walletNotFoundCount || 0) + 1;
        return { success: false, reason: 'wallet_not_found' };
      }

      const cashierWallet = cashier.wallets[0];
      const currentBalance = Number(cashierWallet.balance);
      await walletService.updateWallet(cashierWallet.id, currentBalance + creditAmount);

      // eslint-disable-next-line no-param-reassign
      metrics.walletsUpdated = (metrics.walletsUpdated || new Set()).add(ticket.cashierId.toString());
      // eslint-disable-next-line no-param-reassign
      metrics.totalCreditedAmount = (metrics.totalCreditedAmount || 0) + creditAmount;

      return { success: true };
    } catch (err) {
      logger.error('[TurboSoccerSettlement] Failed to credit wallet', {
        vfBetId: bet.betId,
        cashierId: ticket.cashierId,
        leagueName,
        creditAmount,
        error: err.message,
      });
      // eslint-disable-next-line no-param-reassign
      metrics.creditErrorCount = (metrics.creditErrorCount || 0) + 1;
      return { success: false, reason: 'credit_failed', error: err.message };
    }
  }

  return { success: true };
};

/**
 * Processes a settlement payload pushed by the VF Engine webhook.
 * Idempotent — skips bets that have already been settled.
 * Validates payload structure, logs settlement events, tracks metrics.
 * Updates local Ticket statuses, credits WON wallets, and logs outcome.
 *
 * @param {object} payload - SettlementWebhookPayload from the VF Engine
 * @returns {Promise<{ success: boolean, metrics: object, error?: string }>}
 */
const processSettlement = async (payload) => {
  // Validate payload structure
  if (!payload || typeof payload !== 'object') {
    logger.error('[TurboSoccerSettlement] Invalid payload type', { payload });
    return { success: false, error: 'Invalid payload' };
  }

  // Check event type
  if (payload.event && payload.event !== 'MATCH_SETTLED') {
    logger.warn('[TurboSoccerSettlement] Ignoring non-MATCH_SETTLED event', { event: payload.event });
    return { success: false, reason: 'wrong_event' };
  }

  // Validate bets array
  if (!Array.isArray(payload.bets) || payload.bets.length === 0) {
    logger.warn('[TurboSoccerSettlement] No bets in payload', {
      matchId: payload.matchId,
      hasBets: Array.isArray(payload.bets),
      betCount: Array.isArray(payload.bets) ? payload.bets.length : 0,
    });
    return { success: false, reason: 'no_bets' };
  }

  // Extract league name (from payload or null)
  const leagueName = payload.leagueName || null;

  // Initialize metrics
  const metrics = {
    totalBets: payload.bets.length,
    wonCount: 0,
    lostCount: 0,
    voidedCount: 0,
    skippedCount: 0,
    walletsUpdated: new Set(),
    totalCreditedAmount: 0,
    walletNotFoundCount: 0,
    creditErrorCount: 0,
  };

  logger.info('[TurboSoccerSettlement] Processing started', {
    matchId: payload.matchId,
    fixtureId: payload.fixtureId,
    leagueName,
    totalBets: payload.bets.length,
    finalScore: payload.finalScore,
  });

  const now = new Date();

  // Process sequentially to avoid wallet-balance races for bets belonging to the same cashier
  try {
    await payload.bets.reduce(
      (chain, bet) =>
        chain.then(async () => {
          try {
            await applyBetSettlement(bet, now, leagueName, metrics);
          } catch (err) {
            logger.error('[TurboSoccerSettlement] Error processing bet', {
              vfBetId: bet.betId,
              leagueName,
              error: err.message,
            });
            // eslint-disable-next-line no-param-reassign
            metrics.creditErrorCount = (metrics.creditErrorCount || 0) + 1;
          }
        }),
      Promise.resolve()
    );
  } catch (err) {
    logger.error('[TurboSoccerSettlement] Settlement processing aborted', {
      matchId: payload.matchId,
      leagueName,
      error: err.message,
      processedBets: metrics.wonCount + metrics.lostCount + metrics.voidedCount,
    });
    return { success: false, error: err.message, metrics };
  }

  // Log settlement completion with full audit trail
  logger.info('[TurboSoccerSettlement] Settlement complete', {
    matchId: payload.matchId,
    fixtureId: payload.fixtureId,
    leagueName,
    finalScore: payload.finalScore,
    timestamp: now.toISOString(),
    betsProcessed: {
      total: metrics.totalBets,
      won: metrics.wonCount || 0,
      lost: metrics.lostCount || 0,
      voided: metrics.voidedCount || 0,
      skipped: metrics.skippedCount || 0,
    },
    walletsImpacted: {
      uniqueCashiers: (metrics.walletsUpdated ? metrics.walletsUpdated.size : 0) || 0,
      totalCredited: metrics.totalCreditedAmount || 0,
      notFoundErrors: metrics.walletNotFoundCount || 0,
      creditErrors: metrics.creditErrorCount || 0,
    },
  });

  return { success: true, metrics };
};

module.exports = {
  placeBet,
  placeLiveBet,
  voidBet,
  processSettlement,
};
