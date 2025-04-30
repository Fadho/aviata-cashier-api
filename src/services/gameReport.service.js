/* eslint-disable no-param-reassign */
const { GameReport, Player, Tickets, TicketsArchive } = require('../models');
const transferHistoryService = require('./transferHistory.service');
const jackpotService = require('./jackpot.service');
// const { getBetHistory1 } = require('./bets.service');

const getBetHistory1 = async (filter, startDate, endDate) => {
  const startDateWithoutTime = new Date(startDate);
  //   startDateWithoutTime.setHours(0, 0, 0, 0);
  //   startDateWithoutTime.setDate(startDateWithoutTime.getHours() + 1);
  const endDateWithoutTime = new Date(endDate);
  endDateWithoutTime.setHours(0, 0, 0, 0);
  endDateWithoutTime.setDate(endDateWithoutTime.getDate() + 1);
  endDateWithoutTime.setHours(endDateWithoutTime.getHours() + 1);

  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      ...(startDate &&
        endDate && {
          createdAt: {
            $gte: startDateWithoutTime,
            $lt: endDateWithoutTime,
          },
        }),
      ...filter,
    };
    // eslint-disable-next-line no-param-reassign
    filter = dateFilter;
  }
  const tickets = await Tickets.find(filter);
  const ticketsArchive = await TicketsArchive.find(filter);
  return [...tickets, ...ticketsArchive];
};

/**
 * Get and update financial report - stake
 * @param {Object} financialReportBody
 * @returns {Promise<GameReport>}
 */
const getAndUpdateStake = async (cashierId, gameType) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight
  let numberOfBets = 0;
  let totalWinnings = 0;
  let totalStake = 0;
  let totalPlayerBonus = 0;
  let totalPlayerWallets = 0;
  let jackpot1Payout = 0;
  let jackpot2Payout = 0;
  let jackpot3Payout = 0;
  let jackpot1Contributions = 0;
  let jackpot2Contributions = 0;
  let jackpot3Contributions = 0;

  const [players, tickets, cashierJackpotWinners] = await Promise.all([
    Player.find({ cashierId, gameType }),
    getBetHistory1({ cashierId, gameType }, today, today),
    jackpotService.getUpdatedJackpotHistory({}, cashierId, today, today),
  ]);
  players.forEach((player) => {
    totalPlayerWallets += Number(player.wallet);
    totalPlayerBonus += Number(player.bonus);
  });
  tickets.forEach((ticket) => {
    totalStake += Number(ticket.stake ? ticket.stake : 0);
    totalWinnings += Number(ticket.winnings ? ticket.winnings : 0);
    numberOfBets += 1;
  });

  cashierJackpotWinners.forEach((jackpot) => {
    if (jackpot.jackpotType === 'Bronze') {
      jackpot1Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      jackpot1Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    } else if (jackpot.jackpotType === 'Silver') {
      jackpot2Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      jackpot2Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    } else if (jackpot.jackpotType === 'Gold') {
      jackpot3Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      jackpot3Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    }
  });

  const gameReport = await GameReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!gameReport) {
    return GameReport.create({
      cashierId,
      numberOfBets,
      gameType,
      totalWinnings,
      totalStake,
      totalPlayerWallets,
      totalPlayerBonus,
      jackpot1Payout,
      jackpot2Payout,
      jackpot3Payout,
      jackpot1Contributions,
      jackpot2Contributions,
      jackpot3Contributions,
    });
  }
  return GameReport.findByIdAndUpdate(
    gameReport._id,
    {
      numberOfBets,
      totalWinnings,
      totalStake,
      totalPlayerWallets,
      totalPlayerBonus,
      jackpot1Payout,
      jackpot2Payout,
      jackpot3Payout,
      jackpot1Contributions,
      jackpot2Contributions,
      jackpot3Contributions,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - player wallets
 * @param {Object} financialReportBody
 * @returns {Promise<GameReport>}
 */
const getAndUpdatePlayerWallets = async (cashierId, gameType, winnings) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight
  let totalPlayerWallets = 0;
  let totalPlayerBonus = 0;
  let totalBonusAwarded = 0;
  const totalWinnings = 0;

  const [players, transactions] = await Promise.all([
    Player.find({ cashierId }),
    transferHistoryService.queryTransferHistorys({ agent: cashierId }, { limit: 1000000 }, today, today),
  ]);
  players.forEach((player) => {
    totalPlayerWallets += Number(player.wallet);
    totalPlayerBonus += Number(player.bonus);
  });
  transactions.results.forEach((transaction) => {
    totalBonusAwarded += Number(transaction.bonus ? transaction.bonus : 0);
  });

  const gameReport = await GameReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!gameReport) {
    return GameReport.create({
      cashierId,
      gameType,
      totalPlayerWallets,
      totalPlayerBonus,
      totalBonusAwarded,
      totalWinnings,
    });
  }
  return GameReport.findByIdAndUpdate(
    gameReport._id,
    {
      $set: {
        totalPlayerWallets,
        totalPlayerBonus,
        totalBonusAwarded,
      },
      $inc: {
        totalWinnings,
      },
    },
    { new: true }
  );
};

/**
 * Get and update transactions report - totalDeposits, totalWithdrawals, totalBonusAwarded
 * @param {Object} financialReportBody
 * @returns {Promise<GameReport>}
 */
const getAndUpdateTotalTransactions = async (cashierId, gameType) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalBonusAwarded = 0;

  const transactions = await transferHistoryService.queryTransferHistorys(
    { agent: cashierId, gameType },
    { limit: 1000000 },
    today,
    today,
    gameType
  );

  transactions.results.forEach((transaction) => {
    totalDeposits += Number(transaction.deposit ? transaction.deposit : 0);
    totalWithdrawals += Number(transaction.withdrawal ? transaction.withdrawal : 0);
    totalBonusAwarded += Number(transaction.bonus ? transaction.bonus : 0);
  });

  const gameReport = await GameReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!gameReport) {
    return GameReport.create({
      cashierId,
      totalDeposits,
      totalWithdrawals,
      totalBonusAwarded,
      gameType,
    });
  }
  return GameReport.findByIdAndUpdate(
    gameReport._id,
    {
      totalDeposits,
      totalWithdrawals,
      totalBonusAwarded,
    },
    { new: true }
  );
};

/**
 * Query for gameReports
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryFinancialReports = async (filter, options) => {
  const gameReports = await GameReport.paginate(filter, options);
  return gameReports;
};

const getGameReports = async (filter, startDate, endDate) => {
  const startDateWithoutTime = new Date(startDate);
  startDateWithoutTime.setHours(0, 0, 0, 0);
  const endDateWithoutTime = new Date(endDate);
  endDateWithoutTime.setHours(0, 0, 0, 0);
  endDateWithoutTime.setDate(endDateWithoutTime.getDate() + 1);

  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      ...(startDate &&
        endDate && {
          createdAt: {
            $gte: startDateWithoutTime,
            $lte: endDateWithoutTime,
          },
        }),
      ...filter,
    };
    // eslint-disable-next-line no-param-reassign
    filter = dateFilter;
  }
  const gameReports = await GameReport.find(filter);
  return gameReports;
};

const getAndUpdateStakeByDay = async (cashierId, startDate, endDate, gameType) => {
  try {
    const startDateWithoutTime = new Date(startDate);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(23, 59, 59, 999);

    const [tickets, cashierJackpotWinners] = await Promise.all([
      getBetHistory1({ cashierId }, startDate, endDate),
      jackpotService.getUpdatedJackpotHistory(
        {},
        cashierId,
        gameType,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ),
    ]);

    if (!tickets.length && !cashierJackpotWinners.length) return;

    // Initialize aggregations
    const aggregates = {
      numberOfBets: 0,
      totalWinnings: 0,
      totalStake: 0,
      jackpot1Payout: 0,
      jackpot2Payout: 0,
      jackpot3Payout: 0,
      jackpot1Contributions: 0,
      jackpot2Contributions: 0,
      jackpot3Contributions: 0,
    };

    tickets.forEach((ticket) => {
      aggregates.totalStake += Number(ticket.stake || 0);
      aggregates.totalWinnings += Number(ticket.winnings || 0);
      aggregates.numberOfBets += 1;
    });

    cashierJackpotWinners.forEach((jackpot) => {
      const jackpotMapping = {
        Bronze: { payout: 'jackpot1Payout', contributions: 'jackpot1Contributions' },
        Silver: { payout: 'jackpot2Payout', contributions: 'jackpot2Contributions' },
        Gold: { payout: 'jackpot3Payout', contributions: 'jackpot3Contributions' },
      };

      const type = jackpotMapping[jackpot.jackpotType];
      if (type) {
        aggregates[type.payout] += jackpot.jackpotAmount || 0;
        aggregates[type.contributions] += jackpot.active ? jackpot.jackpotContributions || 0 : 0;
      }
    });

    const gameReport = await GameReport.findOne({
      cashierId,
      gameType,
      createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime },
    });
    if (!gameReport)
      return GameReport.create(
        { cashierId, ...aggregates, gameType, createdAt: startDateWithoutTime } // Include createdAt for backdated reports
      );

    return GameReport.updateOne(
      { cashierId, createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime }, gameType },
      { ...aggregates },
      { new: true }
    );

    // return gameReport;
  } catch (error) {
    console.error('Error in getAndUpdateStakeByDay:', error);
  }
};

const getAndUpdateTotalTransactionsByDay = async (cashierId, startDate, endDate) => {
  try {
    const startDateWithoutTime = new Date(startDate);
    // startDateWithoutTime.setHours(0, 0, 0, 0);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(23, 59, 59, 999);

    const transactions = await transferHistoryService.queryTransferHistorys(
      { agent: cashierId },
      { limit: 1000000 },
      startDate,
      endDateWithoutTime
    );
    if (!transactions.results.length) return;

    // Aggregate totals
    const aggregates = transactions.results.reduce(
      (totals, transaction) => {
        totals.totalDeposit += Number(transaction.deposit || 0);
        totals.totalWithdrawal += Number(transaction.withdrawal || 0);
        totals.totalBonusAwarded += Number(transaction.bonus || 0);
        totals.numberOfTransactions += 1;
        return totals;
      },
      { totalDeposit: 0, totalWithdrawal: 0, totalBonusAwarded: 0, numberOfTransactions: 0 }
    );
    // console.log(aggregates, cashierId, startDateWithoutTime);

    const gameReport = await GameReport.findOne({
      cashierId,
      createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime },
    });

    if (!gameReport)
      return GameReport.create(
        { cashierId, ...aggregates, createdAt: startDateWithoutTime } // Include createdAt for backdated reports
      );

    return GameReport.findOneAndUpdate(
      { cashierId, createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime } },
      { ...aggregates },
      { new: true }
    );
  } catch (error) {
    console.error('Error in getAndUpdateTotalTransactionsByDay:', error);
  }
};

module.exports = {
  queryFinancialReports,
  getAndUpdateStake,
  getGameReports,
  getAndUpdatePlayerWallets,
  getAndUpdateTotalTransactions,
  getAndUpdateStakeByDay,
  getAndUpdateTotalTransactionsByDay,
};
