/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { betsService, userService, walletService, currencyService } = require('../services');
const { Wallets } = require('../models');
const logger = require('../config/logger');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, selections, cashierId, potentialWinnings, roundId } = req.body;
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
  const betPlaced = await betsService.createBetPlaced(result, stake, selections, cashierId, potentialWinnings, roundId);

  // Respond with the created bet
  res.status(httpStatus.CREATED).send(betPlaced);
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
  const filter = pick(req.query, ['betType', 'cashierId', 'stake', 'payout']);
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
    const { startDate, endDate, betType } = req.query;
    const cashierId = req.user.id;
    let betHistory = [];
    const user = await userService.getUserById(cashierId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
    }
    betHistory = await betsService.getBetHistory({ cashierId, ...(betType && { betType }) }, startDate, endDate);

    const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
    const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);
    const totalClosedPayout = betHistory.reduce((count, bet) => {
      return bet.payout ? count + bet.winnings : count + 0;
    }, 0);
    const totalOpenPayout = betHistory.reduce((count, bet) => {
      return bet.payout ? count + 0 : count + bet.winnings;
    }, 0);

    const data = {
      totalWinnings,
      totalStake,
      numberOfBets: betHistory.length,
      name: user.name,
      profit: Number(totalStake) - Number(totalWinnings),
      totalClosedPayout,
      totalOpenPayout,
      availableBalance: user.wallets[0].balance,
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
    let betHistory = [];

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
        betHistory = await betsService.getBetHistory(
          { cashierId: userItem.id, ...(betType && { betType }) },
          startDate,
          endDate
        );

        const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
        const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);
        const totalClosedPayout = betHistory.reduce((count, bet) => {
          return bet.payout ? count + bet.winnings : count + 0;
        }, 0);
        const totalOpenPayout = betHistory.reduce((count, bet) => {
          return !bet.payout ? count + bet.winnings : count + 0;
        }, 0);

        return {
          totalWinnings,
          totalStake,
          numberOfBets: betHistory.length,
          name: userItem.name,
          clientType,
          profit: Number(totalStake) - Number(totalWinnings),
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
    const { startDate, endDate, betType, agentId } = req.query;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    let initialAgents;

    // Fetch agents at the top level (with no parent agent)
    if (req.user.role === 'super') {
      initialAgents = await userService.queryUsers(
        { agentId: agentId ? { agentId } : { $exists: false }, role: 'admin' },
        options
      );
    } else {
      // Use req.user as the initial agent if their role is not 'super'
      initialAgents = !agentId
        ? { results: [req.user] }
        : await userService.queryUsers({ _id: agentId, agentId: req.user._id, role: 'admin' }, options);
    }

    const getUserHierarchy = async (parentId) => {
      const agents = await userService.queryUsers({ agentId: parentId, role: 'admin' }, options);
      const hierarchy = {};

      for (const agent of agents.results) {
        hierarchy[agent.name] = {
          // eslint-disable-next-line no-use-before-define
          cashiers: await getCashiers(agent._id),
          agents: await getUserHierarchy(agent._id),
          totals: {},
        };
      }

      return hierarchy;
    };

    // eslint-disable-next-line no-shadow
    const getCashiers = async (agentId) => {
      const cashiers = await userService.queryUsers({ agentId, role: 'cashier' }, options);
      const cashierReports = {};

      for (const cashier of cashiers.results) {
        const cashierBets = await betsService.getBetHistory(
          { cashierId: cashier._id, ...(betType && { betType }) },
          startDate,
          endDate
        );

        const userWallets = await Wallets.find({ userId: cashier._id }).populate('currencyId');

        for (const wallet of userWallets) {
          if (!wallet.currencyId) return;
          const { currencyCode } = wallet.currencyId.country[0];

          if (!cashierReports[cashier.name]) {
            cashierReports[cashier.name] = {};
          }

          if (!cashierReports[cashier.name][currencyCode]) {
            cashierReports[cashier.name][currencyCode] = {
              totalWinnings: 0,
              totalStake: 0,
              numberOfBets: 0,
              profit: 0,
              totalClosedPayout: 0,
              totalOpenPayout: 0,
            };
          }

          const currencyReport = cashierReports[cashier.name][currencyCode];

          cashierBets.forEach((bet) => {
            currencyReport.totalWinnings += bet.winnings;
            currencyReport.totalStake += bet.stake;
            currencyReport.numberOfBets += 1;
            currencyReport.totalClosedPayout += bet.payout ? bet.winnings : 0;
            currencyReport.totalOpenPayout += !bet.payout ? bet.winnings : 0;
            currencyReport.profit = currencyReport.totalStake - currencyReport.totalWinnings;
          });
        }
      }

      return cashierReports;
    };

    const aggregateTotals = (report) => {
      const totals = {};

      if (report.cashiers) {
        for (const cashier of Object.values(report.cashiers)) {
          for (const [currency, currencyReport] of Object.entries(cashier)) {
            if (!totals[currency]) {
              totals[currency] = {
                totalWinnings: 0,
                totalStake: 0,
                numberOfBets: 0,
                profit: 0,
                totalClosedPayout: 0,
                totalOpenPayout: 0,
              };
            }

            totals[currency].totalWinnings += currencyReport.totalWinnings;
            totals[currency].totalStake += currencyReport.totalStake;
            totals[currency].numberOfBets += currencyReport.numberOfBets;
            totals[currency].totalClosedPayout += currencyReport.totalClosedPayout;
            totals[currency].totalOpenPayout += currencyReport.totalOpenPayout;
            totals[currency].profit = totals[currency].totalStake - totals[currency].totalWinnings;
          }
        }
      }

      if (report.agents) {
        for (const agent of Object.values(report.agents)) {
          const agentTotals = aggregateTotals(agent);
          for (const [currency, currencyReport] of Object.entries(agentTotals)) {
            if (!totals[currency]) {
              totals[currency] = {
                totalWinnings: 0,
                totalStake: 0,
                numberOfBets: 0,
                profit: 0,
                totalClosedPayout: 0,
                totalOpenPayout: 0,
              };
            }

            totals[currency].totalWinnings += currencyReport.totalWinnings;
            totals[currency].totalStake += currencyReport.totalStake;
            totals[currency].numberOfBets += currencyReport.numberOfBets;
            totals[currency].totalClosedPayout += currencyReport.totalClosedPayout;
            totals[currency].totalOpenPayout += currencyReport.totalOpenPayout;
            totals[currency].profit = totals[currency].totalStake - totals[currency].totalWinnings;
          }
        }
      }

      return totals;
    };

    const convertToPrimaryCurrency = (totals, exchangeRates, primaryCurrency) => {
      const convertedTotals = {
        [primaryCurrency]: {
          totalWinnings: 0,
          totalStake: 0,
          numberOfBets: 0,
          profit: 0,
          totalClosedPayout: 0,
          totalOpenPayout: 0,
        },
      };

      for (const [currency, currencyReport] of Object.entries(totals)) {
        const exchangeRate = exchangeRates[currency];
        const conversionRate = exchangeRate / exchangeRates[primaryCurrency];

        convertedTotals[primaryCurrency].totalWinnings += currencyReport.totalWinnings * conversionRate;
        convertedTotals[primaryCurrency].totalStake += currencyReport.totalStake * conversionRate;
        convertedTotals[primaryCurrency].numberOfBets += currencyReport.numberOfBets;
        convertedTotals[primaryCurrency].totalClosedPayout += currencyReport.totalClosedPayout * conversionRate;
        convertedTotals[primaryCurrency].totalOpenPayout += currencyReport.totalOpenPayout * conversionRate;
        convertedTotals[primaryCurrency].profit =
          convertedTotals[primaryCurrency].totalStake - convertedTotals[primaryCurrency].totalWinnings;
      }

      // Format numbers to two decimal places
      for (const key in convertedTotals[primaryCurrency]) {
        if (typeof convertedTotals[primaryCurrency][key] === 'number') {
          convertedTotals[primaryCurrency][key] = convertedTotals[primaryCurrency][key].toFixed(2);
        }
      }

      return convertedTotals;
    };

    const hierarchy = {};
    for (const agent of initialAgents.results) {
      const exchangeRates = {};
      const currencies = await currencyService.getCurrencies();
      // Fetch all relevant exchange rates for the agent's wallets
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
      primaryCurrency = primaryCurrency.country[0].currencyCode; // Assuming the first primary wallet's currency as primary

      hierarchy[agent.name] = {
        cashiers: await getCashiers(agent._id),
        agents: await getUserHierarchy(agent._id),
        totals: {},
      };
      hierarchy[agent.name].totals = aggregateTotals(hierarchy[agent.name]);
      hierarchy[agent.name].totalsInPrimaryCurrency = convertToPrimaryCurrency(
        hierarchy[agent.name].totals,
        exchangeRates,
        primaryCurrency
      );
    }

    return res.status(httpStatus.CREATED).send(hierarchy);
  } catch (error) {
    logger.error(error);
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
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

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  getFinancialReports,
  getGamingActivity,
  cancelTicket,
  cashoutTicket,
  payoutTicket,
  cashierReport,
};
