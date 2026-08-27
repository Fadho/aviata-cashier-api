/* eslint-disable no-continue */
/* eslint-disable no-shadow */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const {
  betsService,
  userService,
  walletService,
  currencyService,
  jackpotService,
  transferHistoryService,
  freebetService,
  // financialReportService,
} = require('../services');
const financialReportService = require('../services/financialReport.service');
const turboSoccerService = require('../services/turboSoccer.service');
const { Wallets, Player, User, Freebet, FreebetWinners } = require('../models');
const axios = require('axios');
const logger = require('../config/logger');

/**
 * Create Bet Placed for third party (agent)
 */
const createBetPlacedForThirdParty = catchAsync(async (req, res) => {
  const { result, selections, cashierId, potentialWinnings, roundId, gameType, currency } = req.body;
  let { stake } = req.body;
  // req.user is the partner/agent resolved by apiKeyAuth()
  const agent = req.user;
  // Fetch the user (cashier) by ID
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
  }

  if (!user.agentId || user.agentId.toString() !== agent._id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to place bet for this third party');
  }

  if (gameType === 'turbo-soccer') {
    const userWallet = await walletService.getWalletById(user.wallets[0]);
    if (!userWallet) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Cashier wallet not found');
    }

    const vfResponse = await turboSoccerService.placeBet(userWallet, req.body, cashierId);
    res.status(httpStatus.OK).send(vfResponse);
    return;
  }

  // Debit third-party wallet via the agent's configured endpoint
  if (!agent.endpoint) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Third-party agent has no configured endpoint');
  }
  try {
    await axios.post(`${agent.endpoint}/debit`, { stake, gameType, currency }, { timeout: 5000 });
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Error debiting third party wallet');
  }

  // Create the bet
  let betPlaced = await betsService.createBetPlaced(
    result,
    stake,
    selections,
    cashierId,
    potentialWinnings,
    roundId,
    gameType
  );

  // Respond with the created bet
  res.status(httpStatus.CREATED).send(betPlaced);

  // Get jackpot contributions
  const jackpotContributions = await jackpotService.getAgentJackpots(user.agentId, gameType);

  const bronzeJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Bronze');
  const silverJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Silver');
  const goldJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Gold');

  // Update jackpot contributions
  jackpotService.updateJackpotContributionsForCashier(
    bronzeJackpot._id,
    bronzeJackpot.percentageContributions * stake,
    silverJackpot._id,
    silverJackpot.percentageContributions * stake,
    goldJackpot._id,
    goldJackpot.percentageContributions * stake,
    cashierId,
    gameType,
    betPlaced._id
  );

  financialReportService.getAndUpdateStake(cashierId, gameType);
});

const createBetPlacedForThirdPartyPlayer = catchAsync(async (req, res) => {
  const session = await mongoose.startSession(); // Start a Mongoose session
  session.startTransaction(); // Begin a transaction

  try {
    const { cashierId, roundId, gameType, playerId, deviceId, currency } = req.body;
    let { stake } = req.body;
    // Fetch the cashier — no auth on this route, so resolve agent from cashier's agentId
    const user = await userService.getUserById(cashierId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
    }

    // Resolve the agent who owns this cashier
    const agent = user.agentId ? await userService.getUserById(user.agentId) : null;

    // Debit the third-party wallet via the agent's configured endpoint (if present)
    if (agent && agent.endpoint) {
      try {
        await axios.post(`${agent.endpoint}/debit`, { stake, gameType, currency }, { timeout: 5000 });
      } catch {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Error debiting third party wallet');
      }
    }

    // Fetch the player by playerId and deviceId
    const player = await Player.findOne({ playerId, deviceId }).session(session);
    if (!player) {
      throw new ApiError(httpStatus.NOT_FOUND, 'player with provided ID not found');
    }
    const checkFreebet = player.freebet;
    if (!player.freebet) {
      // Validate balance and stake
      let balance = Number(player.wallet);
      let bonus = Number(player.bonus);
      // let useBalanceBonus = false;
      let useBonus = false;
      stake = Number(stake);

      if (isNaN(balance) || isNaN(stake) || balance < stake) {
        useBonus = true;
        if (isNaN(bonus + balance) || isNaN(stake) || bonus + balance < stake)
          throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient funds or invalid stake amount');
      }

      if (useBonus) {
        let setStake = stake;
        setStake -= balance;
        balance = 0;
        bonus -= setStake;
      } else {
        balance -= stake;
      }

      // Update wallet balance

      await Player.findOneAndUpdate({ _id: player.id }, { wallet: balance, bonus }, { session });
    } else {
      const freebet = await FreebetWinners.findOne({ playerId: String(player.playerId), deviceId: player.deviceId });

      if (!freebet) {
        throw new ApiError(httpStatus.NOT_FOUND, 'freebet with provided playerId not found');
      }
      await Player.findOneAndUpdate({ _id: player.id }, { freebet: false }, { session });
      financialReportService.getAndUpdateFreebets(cashierId, gameType, freebet.dropAmount);
    }

    // Cashier is already fetched above as `user`
    const cashier = user;

    // Place the bet
    const betPlaced = await betsService.createBetPlacedForPlayer(
      stake,
      checkFreebet,
      gameType,
      roundId,
      cashierId,
      playerId,
      deviceId,
      session
    );

    res.status(httpStatus.CREATED).send(betPlaced);

    // Get jackpot contributions
    const jackpotContributions = await jackpotService.getAgentJackpots(cashier.agentId, gameType, session);
    const bronzeJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Bronze');
    const silverJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Silver');
    const goldJackpot = jackpotContributions.find((obj) => obj.jackpotName === 'Gold');

    // Update jackpot contributions
    jackpotService.updateJackpotContributions(
      bronzeJackpot._id,
      bronzeJackpot.percentageContributions * stake,
      silverJackpot._id,
      silverJackpot.percentageContributions * stake,
      goldJackpot._id,
      goldJackpot.percentageContributions * stake,
      deviceId,
      gameType,
      session
    );

    // Get jackpot contributions
    const freebet = await freebetService.getAgentFreebets(cashier.agentId, gameType, session);

    if (freebet.dropAmount > 1) {
      // Update jackpot contributions
      freebetService.updateFreebetContributions(
        freebet._id,
        freebet.percentageContributions * stake,
        deviceId,
        gameType,
        betPlaced.roundId,
        session
      );
    }

    financialReportService.getAndUpdateStake(cashierId, gameType);
    // gameReportService.getAndUpdateStake(cashierId, gameType);

    // Commit the transaction
    await session.commitTransaction();
  } catch (error) {
    // Roll back transaction if any error occurs
    try {
      await session.abortTransaction();
    } catch (abortError) {
      logger.warn(`Transaction abort skipped in createBetPlacedForThirdPartyPlayer controller: ${abortError.message}`);
    }
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Error placing bet: ${error.message}`);
  } finally {
    // End the session
    session.endSession();
  }
});

const cashoutPlayerBet = catchAsync(async (req, res) => {
  const { ticketId, odd } = req.body;

  const betCashed = await betsService.cashoutBetForPlayer(ticketId, odd);

  if (!betCashed) {
    res.status(httpStatus.NOT_FOUND).send();
  }
  // Respond with the created bet
  res.status(httpStatus.CREATED).send(betCashed);
});

const fetchBetPlaced = catchAsync(async (req, res) => {
  try {
    const betPlaced = await betsService.fetchBetPlaced();
    return res.status(httpStatus.CREATED).send(betPlaced);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

/**
 * Cancel a ticket - verifies the ticket belongs to a cashier under the requesting partner
 */
const cancelTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const betPlaced = await betsService.getBetPlacedById(id);
  if (!betPlaced) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
  }
  // Ensure the ticket belongs to a cashier managed by this partner
  const cashier = await userService.getUserById(betPlaced.cashierId);
  if (!cashier || String(cashier.agentId) !== String(req.user._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to cancel this ticket');
  }
  const betCancelled = await betsService.cancelTicket(id);
  res.status(httpStatus.OK).send(betCancelled);
});

/**
 * Cashier financial report scoped to the requesting partner's cashiers
 */
const cashierReport = catchAsync(async (req, res) => {
  const { startDate, endDate, betType, gameType, cashierId } = req.query;

  if (!cashierId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'cashierId query param is required');
  }

  // Verify the cashier belongs to this partner
  const cashier = await userService.getUserById(cashierId);
  if (!cashier || String(cashier.agentId) !== String(req.user._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cashier not found under this partner');
  }

  const [betHistory, players] = await Promise.all([
    betsService.getBetHistory1(
      { cashierId, ...(betType && { betType }), ...(gameType && { gameType }) },
      startDate,
      endDate
    ),
    Player.find({ cashierId }),
  ]);

  const cashierJackpotWinners = await jackpotService.getJackpotHistory(
    { cashierId, ...(gameType && { gameType }), active: false },
    startDate,
    endDate
  );

  const totalStake = betHistory.reduce((acc, b) => acc + b.stake, 0);
  const totalWinnings = betHistory.reduce((acc, b) => acc + b.winnings, 0);
  const totalClosedPayout = betHistory.reduce((acc, b) => (b.payout ? acc + b.winnings : acc), 0);
  const totalOpenPayout = betHistory.reduce((acc, b) => (!b.payout ? acc + b.winnings : acc), 0);
  const totalPlayerWallets = players.reduce((acc, p) => acc + p.wallet, 0);
  const totalPlayerBonus = players.reduce((acc, p) => acc + p.bonus, 0);

  let jackpot1Payout = 0;
  let jackpot2Payout = 0;
  let jackpot3Payout = 0;
  let jackpot1Contributions = 0;
  let jackpot2Contributions = 0;
  let jackpot3Contributions = 0;

  cashierJackpotWinners.forEach((j) => {
    if (j.jackpotType === 'Bronze') {
      jackpot1Payout += j.jackpotAmount;
      jackpot1Contributions += j.jackpotContributions;
    } else if (j.jackpotType === 'Silver') {
      jackpot2Payout += j.jackpotAmount;
      jackpot2Contributions += j.jackpotContributions;
    } else if (j.jackpotType === 'Gold') {
      jackpot3Payout += j.jackpotAmount;
      jackpot3Contributions += j.jackpotContributions;
    }
  });

  res.status(httpStatus.OK).send({
    totalWinnings,
    totalStake,
    numberOfBets: betHistory.length,
    name: cashier.name,
    profit:
      Number(totalStake) -
      Number(totalWinnings) -
      Number(jackpot1Payout) -
      Number(jackpot2Payout) -
      Number(jackpot3Payout) -
      Number(totalPlayerWallets) -
      Number(totalPlayerBonus),
    totalClosedPayout,
    totalOpenPayout,
    jackpot1Payout,
    jackpot2Payout,
    jackpot3Payout,
    jackpot1Contributions,
    jackpot2Contributions,
    jackpot3Contributions,
  });
});

module.exports = {
  createBetPlacedForThirdParty,
  createBetPlacedForThirdPartyPlayer,
  cashoutPlayerBet,
  cancelTicket,
  cashierReport,
};
