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
const { Wallets, Player, User, FinancialReport } = require('../models');
const GameConfig = require('../models/gameConfig.model');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, selections, cashierId, potentialWinnings, roundId, gameType, playerId, deviceId } = req.body;
  let { stake } = req.body;
  // Fetch the user (cashier) by ID
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
  }

  // Validate balance and stake
  const userWallet = user.wallets[0];
  let { balance } = userWallet;

  stake = Number(stake);
  balance = Number(balance);

  // eslint-disable-next-line no-restricted-globals
  if (typeof balance !== 'number' || typeof stake !== 'number' || isNaN(balance) || isNaN(stake)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid balance or stake amount');
  }

  if (balance - stake < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Bet cannot be placed, insufficient funds');
  }

  // Update wallet balance
  await walletService.updateWallet(userWallet.id, balance - stake);

  // Create the bet
  let betPlaced = {};
  if (gameType === 'shootout') {
    betPlaced = await betsService.createBetPlacedForPlayer(stake, gameType, roundId, cashierId, playerId, deviceId);
  } else {
    betPlaced = await betsService.createBetPlaced(result, stake, selections, cashierId, potentialWinnings, roundId);
  }
  // Respond with the created bet
  res.status(httpStatus.CREATED).send(betPlaced);
});

const createBetPlacedForPlayer = catchAsync(async (req, res) => {
  const session = await mongoose.startSession(); // Start a Mongoose session
  session.startTransaction(); // Begin a transaction

  try {
    const { cashierId, roundId, gameType, playerId, deviceId } = req.body;
    let { stake } = req.body;

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
      await Player.findOneAndUpdate({ _id: player.id }, { freebet: false }, { session });
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

    // console.log(freebet);

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

    financialReportService.getAndUpdateStake(cashierId);

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

const getBetHistory = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['betType', 'cashierId', 'stake', 'payout', 'gameType']);
  const { startDate, endDate } = req.query;
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const result = await betsService.getBetHistoryReport(filter, options, startDate, endDate);
  res.send(result);
});

const getGamingActivity = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, username, betType, clientType } = req.query;
    let betHistory = [];
    let cancelledbetHistory = [];
    if ((!startDate || !endDate) && !username && !betType && !clientType) {
      betHistory = await betsService.getBetHistory({});
      cancelledbetHistory = await betsService.getCancelledBetHistory({});
    }

    if (startDate && endDate) {
      if (username) {
        const user = await userService.getUserByUsername(username);
        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
        }
        betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
        cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: user.id, startDate, endDate });
      }
      if (clientType) {
        const user = await userService.getUserByRole(clientType);
        if (!user.length) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
        }
        const bets = await Promise.all(
          user.map(async (userItem) => {
            betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });
            cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: userItem.id, startDate, endDate });

            const sumofStakes = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
            const winCount = betHistory.reduce((count, bet) => count + bet.potentialWinnings, 0);

            return {
              potentialWinnings: winCount,
              totalStake: sumofStakes,
              numberOfBets: betHistory.length,
            };
          })
        );
        const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
        const winnings = bets.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
        const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
        const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
        const response = {
          numberOfBets,
          winnings,
          ggr: (Number(winnings) / Number(totalStake)) * 100,
          turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
          margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(3)),
        };
        return res.status(httpStatus.CREATED).send(response);
      }
      if (betType) {
        betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
        cancelledbetHistory = await betsService.getCancelledBetHistory({ startDate, endDate, betType });
      }
      betHistory = await betsService.getBetHistory({ startDate, endDate });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ startDate, endDate });
    }
    if (username) {
      const user = await userService.getUserByUsername(username);
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
      }
      betHistory = await betsService.getBetHistory({ cashierId: user.id });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: user.id });
    }
    if (clientType) {
      const user = await userService.getUserByRole(clientType);
      if (!user.length) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
      }
      const bets = await Promise.all(
        user.map(async (userItem) => {
          betHistory = await betsService.getBetHistory({ cashierId: userItem.id });
          cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: userItem.id });

          const sumofStakes = betHistory.reduce((accumulator, obj) => {
            return accumulator + obj.stake;
          }, 0);
          const winCount = betHistory.reduce((count, bet) => {
            return count + bet.potentialWinnings;
          }, 0);

          return {
            potentialWinnings: winCount,
            totalStake: sumofStakes,
            numberOfBets: betHistory.length,
          };
        })
      );
      const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);

      const winnings = bets.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
      const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
      const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
        turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
        margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(2)),
      };
      return res.status(httpStatus.CREATED).send(response);
    }
    if (betType) {
      betHistory = await betsService.getBetHistory({ betType });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ betType });
    }

    const cashierData = {};

    for (const bet of betHistory) {
      const cashier = await userService.getUserById(bet.cashierId);

      if (!cashierData[cashier.name]) {
        cashierData[cashier.name] = {
          potentialWinnings: 0,
          numberOfBets: 0,
          totalStake: 0,
        };
      }

      cashierData[cashier.name].totalStake += bet.stake;
      cashierData[cashier.name].potentialWinnings += bet.potentialWinnings;
      cashierData[cashier.name].numberOfBets = betHistory.length;
    }

    const mappedBetHistory = Object.values(cashierData);
    const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
    const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);

    const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
    const response = {
      numberOfBets: betHistory.length,
      winnings,
      ggr: Number(((Number(winnings) / Number(totalStake)) * 100).toFixed(3)),
      turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
      margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(3)),
    };

    return res.status(httpStatus.CREATED).send(response);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const cashierReport = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, gameType } = req.query;
    const cashierId = req.user.id;
    // let betHistory = [];
    const [user, betHistory, players] = await Promise.all([
      userService.getUserById(cashierId),
      betsService.getBetHistory({ cashierId, ...(betType && { betType }) }, startDate, endDate),
      Player.find({ cashierId }),
    ]);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
    }
    const cashierJackpotWinners = await jackpotService.getJackpotHistory(
      { cashierId, ...(gameType && { gameType }) },
      startDate,
      endDate
    );

    const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
    const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);
    const totalClosedPayout = betHistory.reduce((count, bet) => {
      return bet.payout ? count + bet.winnings : count + 0;
    }, 0);
    const totalOpenPayout = betHistory.reduce((count, bet) => {
      return bet.payout ? count + 0 : count + bet.winnings;
    }, 0);
    const totalPlayerWallets = players.reduce((accumulator, obj) => accumulator + obj.wallet, 0);
    const totalPlayerBonus = players.reduce((accumulator, obj) => accumulator + obj.bonus, 0);

    let jackpot1Payout = 0;
    let jackpot1Contributions = 0;
    let jackpot2Payout = 0;
    let jackpot2Contributions = 0;
    let jackpot3Payout = 0;
    let jackpot3Contributions = 0;

    cashierJackpotWinners.forEach((jackpot) => {
      if (jackpot.jackpotType === 'Bronze') {
        jackpot1Payout += jackpot.jackpotAmount;
        jackpot1Contributions += jackpot.jackpotContributions;
      } else if (jackpot.jackpotType === 'Silver') {
        jackpot2Payout += jackpot.jackpotAmount;
        jackpot2Contributions += jackpot.jackpotContributions;
      } else if (jackpot.jackpotType === 'Gold') {
        jackpot3Payout += jackpot.jackpotAmount;
        jackpot3Contributions += jackpot.jackpotContributions;
      }
    });

    const data = {
      totalWinnings,
      totalStake,
      numberOfBets: betHistory.length,
      name: user.name,
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
      availableBalance: user.wallets[0].balance,
      jackpot1Payout,
      jackpot2Payout,
      jackpot3Payout,
      jackpot1Contributions,
      jackpot2Contributions,
      jackpot3Contributions,
    };
    return res.status(httpStatus.OK).send(data);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getAccountingReports = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, clientType, cashierId } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    const users = await userService.queryUsers(
      {
        ...(clientType && { role: clientType }),
        ...(cashierId && { _id: cashierId }),
      },
      options
    );
    const user = users.results;
    if (!user.length) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
    }
    const bets = await Promise.all(
      user.map(async (userItem) => {
        const betHistory = await betsService.getBetHistory(
          { cashierId: userItem.id, ...(betType && { betType }) },
          startDate,
          endDate
        );

        const game = await GameConfig.findOne({ agentId: userItem.agentId });

        const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
        const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);
        const totalClosedPayout = betHistory.reduce((count, bet) => {
          return bet.payout ? count + bet.winnings : count + 0;
        }, 0);
        const totalOpenPayout = betHistory.reduce((count, bet) => {
          return !bet.payout ? count + bet.winnings : count + 0;
        }, 0);

        let impWinnings = totalWinnings;

        if (game.payoutMode === 'Manual') {
          impWinnings = betHistory.reduce((count, bet) => {
            return bet.payout ? count + bet.winnings : count + 0;
          }, 0);
        }

        return {
          totalWinnings: Number(impWinnings),
          totalStake,
          numberOfBets: betHistory.length,
          name: userItem.name,
          clientType,
          profit: Number(totalStake) - Number(impWinnings),
          totalClosedPayout,
          totalOpenPayout,
          availableBalance: userItem.wallet,
        };
      })
    );
    return res.status(httpStatus.CREATED).send(bets);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getFinancialReports = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, agentId, gameType } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let initialAgents;
    const pagination = {};
    let paginationCheck = false;

    if (req.user.role === 'super') {
      initialAgents = await userService.queryUsers({ agentId: agentId || { $exists: false }, role: 'admin' }, options);
      pagination.page = initialAgents.page;
      pagination.limit = initialAgents.limit;
      pagination.totalPages = initialAgents.totalPages;
      pagination.totalResults = initialAgents.totalResults;
    } else {
      initialAgents = !agentId
        ? { results: [req.user] }
        : await userService.queryUsers({ _id: agentId, agentId: req.user._id, role: 'admin' }, options);
    }

    const cache = { agents: {}, cashiers: {} };

    const currencies = await currencyService.getCurrencies();
    const exchangeRates = {};
    for (const currency of currencies) {
      if (currency) {
        const { exchangeRate } = currency;
        const { currencyCode } = currency.country[0];
        exchangeRates[currencyCode] = exchangeRate;
      }
    }

    const house = await userService.getUserByRole('super');
    const primaryWallet = await walletService.findWallet(null, house[0].id, true);
    let primaryCurrency = await currencyService.getCurrencyById(primaryWallet[0].currencyId);
    primaryCurrency = primaryCurrency.country[0].currencyCode;

    const getUserHierarchy = async (parentId) => {
      if (cache.agents[parentId]) return cache.agents[parentId];

      const agents = await userService.queryUsers({ agentId: parentId, role: 'admin' }, options);
      const hierarchy = {};
      if (!(req.user.role === 'super') && !paginationCheck) {
        pagination.page = agents.page;
        pagination.limit = agents.limit;
        pagination.totalPages = agents.totalPages;
        pagination.totalResults = agents.totalResults;
        paginationCheck = true;
      }

      const agentsPromises = agents.results.map(async (agent) => {
        hierarchy[agent.name] = {
          cashiers: await getCashiers(agent._id),
          agents: await getUserHierarchy(agent._id),
          totals: {},
        };
      });

      await Promise.all(agentsPromises);
      cache.agents[parentId] = hierarchy;
      return hierarchy;
    };

    const getCashiers = async (agentId) => {
      if (cache.cashiers[agentId]) return cache.cashiers[agentId];

      const cashiers = await userService.queryUsers({ agentId, role: 'cashier' }, options);
      const cashierReports = {};

      const cashiersPromises = cashiers.results.map(async (cashier) => {
        const [cashierBets, cashierJackpotWinners, userWallets, players, transactions] = await Promise.all([
          betsService.getBetHistory1(
            { cashierId: cashier._id, ...(betType && { betType }), ...(gameType && { gameType }) },
            startDate,
            endDate
          ),
          jackpotService.getUpdatedJackpotHistory({ ...(gameType && { gameType }) }, cashier._id, startDate, endDate),
          Wallets.find({ userId: cashier._id }).populate('currencyId'),
          Player.find({ cashierId: cashier._id }),
          transferHistoryService.queryTransferHistorys(
            { agent: cashier._id, ...(gameType && { gameType }) },
            { limit: 1000000 },
            startDate,
            endDate
          ),
        ]);

        for (const wallet of userWallets) {
          if (!wallet.currencyId) continue;
          const { currencyCode } = wallet.currencyId.country[0];
          if (!cashierReports[cashier.name]) cashierReports[cashier.name] = {};
          if (!cashierReports[cashier.name][currencyCode]) {
            cashierReports[cashier.name][currencyCode] = {
              totalWinnings: 0,
              totalStake: 0,
              numberOfBets: 0,
              profit: 0,
              jackpot1Payout: 0,
              jackpot2Payout: 0,
              jackpot3Payout: 0,
              jackpot1Contributions: 0,
              jackpot2Contributions: 0,
              jackpot3Contributions: 0,
              totalClosedPayout: 0,
              totalOpenPayout: 0,
              profitPrimary: 0,
              totalBonusAwarded: 0,
              totalPlayerWallets: 0,
              totalPlayerBonus: 0,
            };
          }
          const currencyReport = cashierReports[cashier.name][currencyCode];
          cashierJackpotWinners.forEach((jackpot) => {
            if (jackpot.jackpotType === 'Bronze') {
              currencyReport.jackpot1Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot1Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            } else if (jackpot.jackpotType === 'Silver') {
              currencyReport.jackpot2Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot2Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            } else if (jackpot.jackpotType === 'Gold') {
              currencyReport.jackpot3Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot3Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            }
          });
          const rate = exchangeRates[currencyCode] || 1;
          const conversionRate = exchangeRates[primaryCurrency] / rate;

          players.forEach((player) => {
            currencyReport.totalPlayerWallets += player.wallet;
            currencyReport.totalPlayerBonus += player.bonus;
          });

          transactions.results.forEach((transaction) => {
            currencyReport.totalBonusAwarded += Number(transaction.bonus ? transaction.bonus : 0);
          });

          cashierBets.forEach((bet) => {
            currencyReport.totalWinnings += bet.winnings;
            currencyReport.totalStake += bet.stake;
            currencyReport.numberOfBets += 1;
            currencyReport.profit =
              currencyReport.totalStake -
              currencyReport.totalWinnings -
              (currencyReport.totalPlayerWallets + (currencyReport.totalBonusAwarded - currencyReport.totalPlayerBonus)) -
              currencyReport.jackpot1Payout -
              currencyReport.jackpot2Payout -
              currencyReport.jackpot3Payout;
            currencyReport.profitPrimary =
              (currencyReport.totalStake -
                currencyReport.totalWinnings -
                currencyReport.totalPlayerWallets -
                (currencyReport.totalPlayerWallets + (currencyReport.totalBonusAwarded - currencyReport.totalPlayerBonus)) -
                currencyReport.jackpot1Payout -
                currencyReport.jackpot2Payout -
                currencyReport.jackpot3Payout) *
              conversionRate;
          });
        }
      });

      await Promise.all(cashiersPromises);
      cache.cashiers[agentId] = cashierReports;
      return cashierReports;
    };

    const aggregateTotals = async (report) => {
      const totals = {};

      if (report.cashiers) {
        for (const cashier of Object.values(report.cashiers)) {
          for (const [currency, currencyReport] of Object.entries(cashier)) {
            if (!totals[currency]) totals[currency] = { ...currencyReport };
            else {
              const rate = exchangeRates[currency] || 1;
              const conversionRate = exchangeRates[primaryCurrency] / rate;
              totals[currency].totalWinnings += currencyReport.totalWinnings;
              totals[currency].totalStake += currencyReport.totalStake;
              totals[currency].numberOfBets += currencyReport.numberOfBets;
              totals[currency].jackpot1Payout += currencyReport.jackpot1Payout;
              totals[currency].jackpot2Payout += currencyReport.jackpot2Payout;
              totals[currency].jackpot3Payout += currencyReport.jackpot3Payout;
              totals[currency].jackpot1Contributions += currencyReport.jackpot1Contributions;
              totals[currency].jackpot2Contributions += currencyReport.jackpot2Contributions;
              totals[currency].jackpot3Contributions += currencyReport.jackpot3Contributions;
              totals[currency].totalPlayerWallets += currencyReport.totalPlayerWallets;
              totals[currency].totalPlayerBonus += currencyReport.totalPlayerBonus;
              totals[currency].profit =
                totals[currency].totalStake -
                totals[currency].totalWinnings +
                totals[currency].jackpot1Payout +
                totals[currency].jackpot2Payout +
                totals[currency].jackpot3Payout -
                totals[currency].totalPlayerWallets -
                totals[currency].totalPlayerBonus;
              totals[currency].profitPrimary =
                (totals[currency].totalStake -
                  totals[currency].totalWinnings +
                  totals[currency].jackpot1Payout +
                  totals[currency].jackpot2Payout +
                  totals[currency].jackpot3Payout -
                  totals[currency].totalPlayerWallets -
                  totals[currency].totalPlayerBonus) *
                conversionRate;
            }
          }
        }
      }

      if (report.agents) {
        for (const agent of Object.values(report.agents)) {
          await aggregateTotals(agent);
        }
      }

      return totals;
    };

    const hierarchyReports = {};
    for (const agent of initialAgents.results) {
      hierarchyReports[agent.name] = {
        agents: await getUserHierarchy(agent._id),
        cashiers: await getCashiers(agent._id),
      };
    }

    res.json({ hierarchy: hierarchyReports, pagination });
  } catch (error) {
    // console.log(error);
    res.status(500).send({ error: 'Error generating financial report' });
  }
});

const getFinancialReports1 = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, agentId, gameType } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let initialAgents;
    const pagination = {};
    let paginationCheck = false;

    if (req.user.role === 'super') {
      initialAgents = await userService.queryUsers({ agentId: agentId || { $exists: false }, role: 'admin' }, options);
      pagination.page = initialAgents.page;
      pagination.limit = initialAgents.limit;
      pagination.totalPages = initialAgents.totalPages;
      pagination.totalResults = initialAgents.totalResults;
    } else {
      initialAgents = !agentId
        ? { results: [req.user] }
        : await userService.queryUsers({ _id: agentId, agentId: req.user._id, role: 'admin' }, options);
    }

    const cache = { agents: {}, cashiers: {} };

    const currencies = await currencyService.getCurrencies();
    const exchangeRates = {};
    for (const currency of currencies) {
      if (currency) {
        const { exchangeRate } = currency;
        const { currencyCode } = currency.country[0];
        exchangeRates[currencyCode] = exchangeRate;
      }
    }

    const house = await userService.getUserByRole('super');
    const primaryWallet = await walletService.findWallet(null, house[0].id, true);
    let primaryCurrency = await currencyService.getCurrencyById(primaryWallet[0].currencyId);
    primaryCurrency = primaryCurrency.country[0].currencyCode;

    const getUserHierarchy = async (parentId) => {
      if (cache.agents[parentId]) return cache.agents[parentId];

      const agents = await userService.queryUsers({ agentId: parentId, role: 'admin' }, options);
      const hierarchy = {};
      if (!(req.user.role === 'super') && !paginationCheck) {
        pagination.page = agents.page;
        pagination.limit = agents.limit;
        pagination.totalPages = agents.totalPages;
        pagination.totalResults = agents.totalResults;
        paginationCheck = true;
      }

      const agentsPromises = agents.results.map(async (agent) => {
        hierarchy[agent.name] = {
          cashiers: await getCashiers(agent._id),
          agents: await getUserHierarchy(agent._id),
          totals: {},
        };
      });

      await Promise.all(agentsPromises);
      cache.agents[parentId] = hierarchy;
      return hierarchy;
    };

    const getCashiers = async (agentId) => {
      if (cache.cashiers[agentId]) return cache.cashiers[agentId];

      const cashiers = await userService.queryUsers({ agentId, role: 'cashier' }, options);
      const cashierReports = {};

      const cashiersPromises = cashiers.results.map(async (cashier) => {
        const [cashierBets, cashierJackpotWinners, userWallets, players, transactions] = await Promise.all([
          betsService.getBetHistory1(
            { cashierId: cashier._id, ...(betType && { betType }), ...(gameType && { gameType }) },
            startDate,
            endDate
          ),
          jackpotService.getUpdatedJackpotHistory({ ...(gameType && { gameType }) }, cashier._id, startDate, endDate),
          Wallets.find({ userId: cashier._id }).populate('currencyId'),
          Player.find({ cashierId: cashier._id }),
          transferHistoryService.queryTransferHistorys(
            { agent: cashier._id, ...(gameType && { gameType }) },
            { limit: 1000000 },
            startDate,
            endDate
          ),
        ]);

        for (const wallet of userWallets) {
          if (!wallet.currencyId) continue;
          const { currencyCode } = wallet.currencyId.country[0];
          if (!cashierReports[cashier.name]) cashierReports[cashier.name] = {};
          if (!cashierReports[cashier.name][currencyCode]) {
            cashierReports[cashier.name][currencyCode] = {
              totalWinnings: 0,
              totalStake: 0,
              numberOfBets: 0,
              profit: 0,
              jackpot1Payout: 0,
              jackpot2Payout: 0,
              jackpot3Payout: 0,
              jackpot1Contributions: 0,
              jackpot2Contributions: 0,
              jackpot3Contributions: 0,
              totalClosedPayout: 0,
              totalOpenPayout: 0,
              profitPrimary: 0,
              totalBonusAwarded: 0,
              totalPlayerWallets: 0,
              totalPlayerBonus: 0,
            };
          }
          const currencyReport = cashierReports[cashier.name][currencyCode];
          cashierJackpotWinners.forEach((jackpot) => {
            if (jackpot.jackpotType === 'Bronze') {
              currencyReport.jackpot1Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot1Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            } else if (jackpot.jackpotType === 'Silver') {
              currencyReport.jackpot2Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot2Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            } else if (jackpot.jackpotType === 'Gold') {
              currencyReport.jackpot3Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              currencyReport.jackpot3Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
            }
          });
          const rate = exchangeRates[currencyCode] || 1;
          const conversionRate = exchangeRates[primaryCurrency] / rate;

          players.forEach((player) => {
            currencyReport.totalPlayerWallets = player.wallet;
            currencyReport.totalPlayerBonus = player.bonus;
          });

          transactions.forEach((transaction) => {
            currencyReport.totalBonusAwarded += transaction.bonus;
          });

          cashierBets.forEach((bet) => {
            currencyReport.totalWinnings += bet.winnings;
            currencyReport.totalStake += bet.stake;
            currencyReport.numberOfBets += 1;
            currencyReport.profit =
              currencyReport.totalStake -
              currencyReport.totalWinnings -
              currencyReport.totalPlayerWallets -
              (currencyReport.totalBonusAwarded - currencyReport.totalPlayerBonus) -
              currencyReport.jackpot1Payout -
              currencyReport.jackpot2Payout -
              currencyReport.jackpot3Payout;
            currencyReport.profitPrimary =
              (currencyReport.totalStake -
                currencyReport.totalWinnings -
                currencyReport.totalPlayerWallets -
                (currencyReport.totalBonusAwarded - currencyReport.totalPlayerBonus) -
                currencyReport.jackpot1Payout -
                currencyReport.jackpot2Payout -
                currencyReport.jackpot3Payout) *
              conversionRate;
          });
        }
      });

      await Promise.all(cashiersPromises);
      cache.cashiers[agentId] = cashierReports;
      return cashierReports;
    };

    const aggregateTotals = async (report) => {
      const totals = {};

      if (report.cashiers) {
        for (const cashier of Object.values(report.cashiers)) {
          for (const [currency, currencyReport] of Object.entries(cashier)) {
            if (!totals[currency]) totals[currency] = { ...currencyReport };
            else {
              const rate = exchangeRates[currency] || 1;
              const conversionRate = exchangeRates[primaryCurrency] / rate;
              totals[currency].totalWinnings += currencyReport.totalWinnings;
              totals[currency].totalStake += currencyReport.totalStake;
              totals[currency].numberOfBets += currencyReport.numberOfBets;
              totals[currency].jackpot1Payout += currencyReport.jackpot1Payout;
              totals[currency].jackpot2Payout += currencyReport.jackpot2Payout;
              totals[currency].jackpot3Payout += currencyReport.jackpot3Payout;
              totals[currency].jackpot1Contributions += currencyReport.jackpot1Contributions;
              totals[currency].jackpot2Contributions += currencyReport.jackpot2Contributions;
              totals[currency].jackpot3Contributions += currencyReport.jackpot3Contributions;
              totals[currency].totalPlayerWallets += currencyReport.totalPlayerWallets;
              totals[currency].totalPlayerBonus += currencyReport.totalPlayerBonus;
              totals[currency].profit =
                totals[currency].totalStake -
                totals[currency].totalWinnings +
                totals[currency].jackpot1Payout +
                totals[currency].jackpot2Payout +
                totals[currency].jackpot3Payout -
                totals[currency].totalPlayerWallets -
                totals[currency].totalPlayerBonus;
              totals[currency].profitPrimary =
                (totals[currency].totalStake -
                  totals[currency].totalWinnings +
                  totals[currency].jackpot1Payout +
                  totals[currency].jackpot2Payout +
                  totals[currency].jackpot3Payout -
                  totals[currency].totalPlayerWallets -
                  totals[currency].totalPlayerBonus) *
                conversionRate;
            }
          }
        }
      }

      if (report.agents) {
        for (const agent of Object.values(report.agents)) {
          await aggregateTotals(agent);
        }
      }

      return totals;
    };

    const hierarchyReports = {};
    for (const agent of initialAgents.results) {
      hierarchyReports[agent.name] = {
        agents: await getUserHierarchy(agent._id),
        cashiers: await getCashiers(agent._id),
      };
    }

    res.json({ hierarchy: hierarchyReports, pagination });
  } catch (error) {
    res.status(500).send({ error: 'Error generating financial report' });
  }
});

const getTransactionReports = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, agentId, gameType } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let initialAgents;
    const pagination = {};
    const cache = { agents: {}, cashiers: {} };

    // Fetch initial agents based on user role
    if (req.user.role === 'super') {
      initialAgents = await userService.queryUsers({ agentId: agentId || { $exists: false }, role: 'admin' }, options);
      Object.assign(pagination, pick(initialAgents, ['page', 'limit', 'totalPages', 'totalResults']));
    } else {
      initialAgents = !agentId
        ? { results: [req.user] }
        : await userService.queryUsers({ _id: agentId, agentId: req.user._id, role: 'admin' }, options);
    }

    // Exchange Rates and Primary Currency Setup
    const exchangeRates = {};
    for (const currency of await currencyService.getCurrencies()) {
      if (currency) exchangeRates[currency.country[0].currencyCode] = currency.exchangeRate;
    }

    const primaryCurrency = (
      await currencyService.getCurrencyById(
        (
          await walletService.findWallet(null, (await userService.getUserByRole('super'))[0].id, true)
        )[0].currencyId
      )
    ).country[0].currencyCode;

    // Helper functions
    const getUserHierarchy = async (parentId) => {
      if (cache.agents[parentId]) return cache.agents[parentId];
      const agents = await userService.queryUsers({ agentId: parentId, role: 'admin' }, options);
      const hierarchy = {};

      await Promise.all(
        agents.results.map(async (agent) => {
          hierarchy[agent.name] = {
            cashiers: await getCashiers(agent._id),
            agents: await getUserHierarchy(agent._id),
            totals: {},
          };
        })
      );
      cache.agents[parentId] = hierarchy;
      return hierarchy;
    };

    const getCashiers = async (agentId) => {
      if (cache.cashiers[agentId]) return cache.cashiers[agentId];

      const cashiers = await userService.queryUsersReturnIds({ agentId, role: 'cashier' });
      const cashierReports = {};

      // console.log('cashiers: ',cashiers)

      await Promise.all(
        cashiers.map(async (cashier) => {
          const [financialReport, userWallets] = await Promise.all([
            financialReportService.getFinancialReports(
              { cashierId: cashier._id, ...(gameType && { gameType }) },
              startDate,
              endDate
            ),
            Wallets.find({ userId: cashier._id }).populate('currencyId'),
          ]);

          // for (const wallet of userWallets) {
          // cashiers can only have 1 wallet
          const wallet = userWallets[0];
          // eslint-disable-next-line no-continue
          if (wallet.currencyId) {
            const { currencyCode } = wallet.currencyId.country[0];
            if (!cashierReports[cashier.name]) cashierReports[cashier.name] = {};
            if (!cashierReports[cashier.name][currencyCode]) {
              cashierReports[cashier.name][currencyCode] = {
                totalDeposit: 0,
                totalWithdrawal: 0,
                totalStake: 0,
                totalBonus: 0,
                numberOfTransactions: 0,
                numberOfBets: 0,
                profit: 0,
                jackpot1Payout: 0,
                jackpot2Payout: 0,
                jackpot3Payout: 0,
                profitPrimary: 0,
                playersWallet: 0,
              };
            }

            const currencyReport = cashierReports[cashier.name][currencyCode];
            const rate = exchangeRates[currencyCode] || 1;
            const conversionRate = exchangeRates[primaryCurrency] / rate;
            financialReport.forEach((report) => {
              currencyReport.totalDeposit += report.totalDeposit;
              currencyReport.totalWithdrawal += report.totalWithdrawal;
              currencyReport.totalStake += report.totalStake;
              currencyReport.numberOfTransactions += report.numberOfTransactions;
              currencyReport.numberOfBets += report.numberOfBets;
              currencyReport.totalBonus += report.totalPlayerBonus;
              currencyReport.profit = currencyReport.totalDeposit + currencyReport.totalWithdrawal;
              currencyReport.profitPrimary = parseFloat((currencyReport.profit * conversionRate).toFixed(3));
              currencyReport.playersWallet += report.totalPlayerWallets;
              currencyReport.jackpot1Payout += report.jackpot1Payout ? report.jackpot1Payout : 0;
              currencyReport.jackpot2Payout += report.jackpot2Payout ? report.jackpot2Payout : 0;
              currencyReport.jackpot3Payout += report.jackpot3Payout ? report.jackpot3Payout : 0;
            });
          }
          // }
        })
      );
      cache.cashiers[agentId] = cashierReports;
      return cashierReports;
    };

    const hierarchyReports = {};
    await Promise.all(
      initialAgents.results.map(async (agent) => {
        hierarchyReports[agent.name] = {
          agents: await getUserHierarchy(agent._id),
          cashiers: await getCashiers(agent._id),
        };
      })
    );

    res.json({ hierarchy: hierarchyReports, pagination });
  } catch (error) {
    res.status(500).send({ error: 'Error generating transaction report' });
  }
});

const getTransactionReports1 = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, agentId, gameType } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let initialAgents;
    const pagination = {};
    const cache = { agents: {}, cashiers: {} };

    // Fetch initial agents based on user role
    if (req.user.role === 'super') {
      initialAgents = await userService.queryUsers({ agentId: agentId || { $exists: false }, role: 'admin' }, options);
      Object.assign(pagination, pick(initialAgents, ['page', 'limit', 'totalPages', 'totalResults']));
    } else {
      initialAgents = !agentId
        ? { results: [req.user] }
        : await userService.queryUsers({ _id: agentId, agentId: req.user._id, role: 'admin' }, options);
    }

    // Exchange Rates and Primary Currency Setup
    const exchangeRates = {};
    for (const currency of await currencyService.getCurrencies()) {
      if (currency) exchangeRates[currency.country[0].currencyCode] = currency.exchangeRate;
    }

    const primaryCurrency = (
      await currencyService.getCurrencyById(
        (
          await walletService.findWallet(null, (await userService.getUserByRole('super'))[0].id, true)
        )[0].currencyId
      )
    ).country[0].currencyCode;

    // Helper functions
    const getUserHierarchy = async (parentId) => {
      if (cache.agents[parentId]) return cache.agents[parentId];
      const agents = await userService.queryUsers({ agentId: parentId, role: 'admin' }, options);
      const hierarchy = {};

      await Promise.all(
        agents.results.map(async (agent) => {
          hierarchy[agent.name] = {
            cashiers: await getCashiers(agent._id),
            agents: await getUserHierarchy(agent._id),
            totals: {},
          };
        })
      );
      cache.agents[parentId] = hierarchy;
      return hierarchy;
    };

    const getCashiers = async (agentId) => {
      if (cache.cashiers[agentId]) return cache.cashiers[agentId];

      const cashiers = await userService.queryUsers({ agentId, role: 'cashier' }, options);
      const cashierReports = {};

      await Promise.all(
        cashiers.results.map(async (cashier) => {
          const [cashierTransactions, cashierJackpotWinners, userWallets, cashierPlayers] = await Promise.all([
            transferHistoryService.queryTransferHistorys(
              { agent: cashier._id, ...(betType && { betType }), ...(gameType && { gameType }) },
              { limit: 1000000 },
              startDate,
              endDate
            ),
            jackpotService.getUpdatedJackpotHistory({ ...(gameType && { gameType }) }, cashier._id, startDate, endDate),
            Wallets.find({ userId: cashier._id }).populate('currencyId'),
            Player.find({ cashierId: cashier._id }),
          ]);

          // for (const wallet of userWallets) {
          // cashiers can only have 1 wallet
          const wallet = userWallets[0];
          // eslint-disable-next-line no-continue
          if (wallet.currencyId) {
            const { currencyCode } = wallet.currencyId.country[0];
            if (!cashierReports[cashier.name]) cashierReports[cashier.name] = {};
            if (!cashierReports[cashier.name][currencyCode]) {
              cashierReports[cashier.name][currencyCode] = {
                totalDeposit: 0,
                totalWithdrawal: 0,
                totalBonus: 0,
                numberTransactions: 0,
                profit: 0,
                jackpotPayout: 0,
                profitPrimary: 0,
                playersWallet: 0,
              };
            }

            let currencyReport = cashierReports[cashier.name][currencyCode];
            cashierJackpotWinners.forEach((jackpot) => {
              if (jackpot.jackpotType === 'Bronze') {
                currencyReport.jackpotPayout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              } else if (jackpot.jackpotType === 'Silver') {
                currencyReport.jackpotPayout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              } else if (jackpot.jackpotType === 'Gold') {
                currencyReport.jackpotPayout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
              }
            });

            const rate = exchangeRates[currencyCode] || 1;
            const conversionRate = exchangeRates[primaryCurrency] / rate;
            cashierTransactions.results.forEach((bet) => {
              currencyReport.totalDeposit += bet.deposit;
              currencyReport.totalWithdrawal += bet.withdrawal;
              currencyReport.numberTransactions += 1;
              currencyReport.totalBonus += bet.bonus;
              currencyReport.profit = currencyReport.totalDeposit + currencyReport.totalWithdrawal;
              currencyReport.profitPrimary = parseFloat((currencyReport.profit * conversionRate).toFixed(3));
            });
            for (const player of cashierPlayers) {
              currencyReport = cashierReports[cashier.name][currencyCode];
              currencyReport.playersWallet += player.wallet;
            }
          }
          // }
        })
      );
      cache.cashiers[agentId] = cashierReports;
      return cashierReports;
    };

    const hierarchyReports = {};
    await Promise.all(
      initialAgents.results.map(async (agent) => {
        hierarchyReports[agent.name] = {
          agents: await getUserHierarchy(agent._id),
          cashiers: await getCashiers(agent._id),
        };
      })
    );

    res.json({ hierarchy: hierarchyReports, pagination });
  } catch (error) {
    res.status(500).send({ error: 'Error generating transaction report' });
  }
});

const getBetPlacedById = catchAsync(async (req, res) => {
  try {
    const betPlaced = await betsService.getBetPlacedById(req.params.id);
    if (!betPlaced) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
    }
    res.status(httpStatus.CREATED).send(betPlaced);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const cancelTicket = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const betPlaced = await betsService.getBetPlacedById(id);
    if (!betPlaced) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
    }
    const betCancelled = await betsService.cancelTicket(id);

    res.status(httpStatus.CREATED).send(betCancelled);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const cashoutTicket = catchAsync(async (req, res) => {
  try {
    const { roundId, odd } = req.body;
    await betsService.updateBetsAndCalculateWinnings(roundId, odd);
    res.status(httpStatus.CREATED).send({ message: 'Bets updated successfully' });
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const payoutTicket = catchAsync(async (req, res) => {
  try {
    const { ticket, message } = await betsService.payoutTicket(req.params.id);

    if (ticket) return res.status(httpStatus.CREATED).send({ ticket, message });
    return res.status(httpStatus.NOT_FOUND).send({ message });
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getCurrentGameState = catchAsync(async (req, res) => {
  const { agentId, gameType } = req.query;
  let betHistory = [];
  let totalDeposit = 0;
  let totalWithdrawal = 0;
  let totalPlayerWallets = 0;

  const startDate = new Date();
  const endDate = new Date();
  startDate.setDate(startDate.getDate() - 2);

  const cashiers = await userService.getUsers({
    role: 'cashier',
    agentId,
  });

  if (cashiers.length < 1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No associated cashiers');
  }
  // eslint-disable-next-line guard-for-in
  for (const cashier in cashiers) {
    betHistory = await financialReportService.getFinancialReports(
      { cashierId: String(cashiers[cashier]._id) },
      startDate,
      endDate
    );

    console.log(betHistory, startDate, endDate);

    totalDeposit += betHistory.reduce((accumulator, obj) => accumulator + obj.totalDeposit, 0);
    totalWithdrawal += betHistory.reduce((count, bet) => count + bet.totalWithdrawal, 0);
    totalPlayerWallets += betHistory.reduce((count, bet) => count + bet.totalPlayerWallets, 0);
  }

  const rtp = (totalWithdrawal + totalPlayerWallets / totalDeposit) * 100;

  return res.status(httpStatus.OK).send({ gameState: rtp });
});

const populateFinancialReports = catchAsync(async (req, res) => {
  async function iterateDateRange(startDate, endDate) {
    // Convert start and end dates to Date objects
    const start = new Date(startDate);
    const stop = new Date(endDate);

    // Fetch all cashiers at once
    const cashiers = await userService.queryUsersReturnIds({ role: 'cashier' });

    if (!cashiers.length) {
      console.log('No cashiers found.');
      return;
    }

    // Generate the date range
    const dates = [];
    for (let d = new Date(start); d <= stop; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d)); // Store a copy of the date
    }

    dates.forEach((date) => {
      cashiers.forEach((cashier) => {
        financialReportService.getAndUpdateStakeByDay(cashier._id, date, date);
        financialReportService.getAndUpdateTotalTransactionsByDay(cashier._id, date, date);
      });
    });
  }

  // Example usage
  const startDate = '2024-11-01';
  const endDate = '2024-11-10';

  // console.log('Start iterateDateRange');
  await iterateDateRange(startDate, endDate);
  // console.log('End iterateDateRange');

  res.status(200).send({ message: 'Financial reports populated successfully.' });
});

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  getFinancialReports,
  getFinancialReports1,
  getTransactionReports,
  getGamingActivity,
  cancelTicket,
  cashoutTicket,
  payoutTicket,
  cashierReport,
  getCurrentGameState,
  cashoutPlayerBet,
  createBetPlacedForPlayer,
  populateFinancialReports,
};
