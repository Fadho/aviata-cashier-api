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
const { Wallets, Player, User, Freebet, FreebetWinners } = require('../models');
const axios = require('axios');

/**
 * Create Bet Placed for third party (agent)
 */
const createBetPlacedForThirdParty = catchAsync(async (req, res) => {
  const { result, selections, cashierId, potentialWinnings, roundId, gameType, currency } = req.body;
  let { stake } = req.body;
  let { thirdParty } = req.user;
  // Fetch the user (cashier) by ID
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
  }

  if (!(user.agentId === thirdParty._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to place bet for this third party');
  }

  //check third party wallet balance (agent must have a single wallet)
  // let { balance } = Number(thirdParty.wallets[0]);

  // if (isNaN(balance) || isNaN(stake) || balance < stake) {
  //   throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient funds or invalid stake amount');
  // }

  // Deduct stake from third party wallet
  // balance -= stake;
  // await walletService.updateWallet(thirdParty.wallets[0]._id, { balance });

  //query thirdparty debit endpoint
  const response = await axios.post(thirdParty.endpoint + '/debit', { stake, gameType, currency });

  if (response.status !== 200) {
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
    let { thirdParty } = req.user;
    // Fetch the user (cashier) by ID
    const user = await userService.getUserById(cashierId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
    }

    if (!(user.agentId === thirdParty._id)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Unauthorized to place bet for this third party');
    }

    //check third party wallet balance (agent must have a single wallet)
    // let { balance } = Number(thirdParty.wallets[0]);

    // if (isNaN(balance) || isNaN(stake) || balance < stake) {
    //   throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient funds or invalid stake amount');
    // }

    // Deduct stake from third party wallet
    // balance -= stake;
    // await walletService.updateWallet(thirdParty.wallets[0]._id, { balance });

    //query thirdparty debit endpoint
    const response = await axios.post(thirdParty.endpoint + '/debit', { stake, gameType, currency });

    if (response.status !== 200) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Error debiting third party wallet');
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

    // Fetch cashier by cashierId
    const cashier = await User.findById(cashierId).session(session);
    if (!cashier) {
      throw new ApiError(httpStatus.NOT_FOUND, 'cashier with provided ID not found');
    }

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
    await session.abortTransaction();
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

module.exports = {
  createBetPlacedForThirdParty,
  createBetPlacedForThirdPartyPlayer,
  cashoutPlayerBet,
};
