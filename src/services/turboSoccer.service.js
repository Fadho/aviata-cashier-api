const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const walletService = require('./wallet.service');
const vfengineService = require('./vfengine.service');
const Tickets = require('../models/tickets.model');
const User = require('../models/user.model');

const GAME_TYPE = 'turbo-soccer';

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

  await Tickets.create({
    roundId: vfResponse.matchId || betBody.matchId || 'vf-turbo',
    cashierId,
    ticketId: vfResponse.bet_id,
    betType: 'single',
    selections: [
      {
        homeTeam: vfResponse.homeTeam || betBody.homeTeam,
        awayTeam: vfResponse.awayTeam || betBody.awayTeam,
        market: vfResponse.market || betBody.market,
        selection: vfResponse.selection || betBody.selection,
        odd: vfResponse.accepted_odds,
        oddsTaken: vfResponse.accepted_odds,
        betCategory: betBody.prematch === false ? 'LIVE' : 'PREMATCH',
        stake,
      },
    ],
    stake,
    winnings: 0,
    potentialWinnings: stake * vfResponse.accepted_odds,
    gameType: GAME_TYPE,
    roundHasEnded: false,
    payout: false,
    cancelled: false,
    vfBetId: vfResponse.bet_id,
    matchId: vfResponse.matchId || betBody.matchId,
  });

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
 * @param {{ betId: string, result: string, payout: number }} bet
 * @param {Date} now
 * @returns {Promise<void>}
 */
const applyBetSettlement = async (bet, now) => {
  const result = bet.result ? bet.result.toUpperCase() : null;
  const payoutAmount = Number(bet.payout) || 0;

  const update = { roundHasEnded: true, result: null, winnings: 0 };

  if (result === 'WON') {
    update.result = 'win';
    update.winnings = payoutAmount;
    update.payout = true;
    update.payoutDate = now;
  } else if (result === 'LOST') {
    update.result = 'loss';
    update.winnings = 0;
  } else if (result === 'VOID') {
    update.cancelled = true;
    update.result = null;
    update.winnings = 0;
    update.payout = true;
    update.payoutDate = now;
  }

  const ticket = await Tickets.findOneAndUpdate(
    { vfBetId: bet.betId, gameType: GAME_TYPE, roundHasEnded: false, cancelled: false },
    update,
    { new: true }
  );
  if (!ticket) return; // unknown or already settled

  const creditAmount = resolveCreditAmount(result, payoutAmount);
  if (creditAmount > 0) {
    const cashier = await User.findById(ticket.cashierId).select('wallets').populate('wallets');
    if (cashier && cashier.wallets && cashier.wallets.length > 0) {
      const cashierWallet = cashier.wallets[0];
      const currentBalance = Number(cashierWallet.balance);
      await walletService.updateWallet(cashierWallet.id, currentBalance + creditAmount);
    }
  }
};

const processSettlement = async (payload) => {
  // VF Engine posts a SettlementWebhookPayload with event='MATCH_SETTLED' and a
  // bets[] array. Each entry: { betId, market, oddsTaken, stake, result, payout }
  // result values: 'WON' | 'LOST' | 'VOID'
  if (payload.event && payload.event !== 'MATCH_SETTLED') return;
  if (!Array.isArray(payload.bets)) return;

  const now = new Date();
  // Process sequentially to avoid wallet-balance races for bets belonging to the same cashier
  await payload.bets.reduce((chain, bet) => chain.then(() => applyBetSettlement(bet, now)), Promise.resolve());
};

module.exports = {
  placeBet,
  placeLiveBet,
  voidBet,
  processSettlement,
};
