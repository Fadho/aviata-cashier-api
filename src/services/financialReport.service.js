/* eslint-disable no-param-reassign */
const { FinancialReport, Player, Tickets, TicketsArchive } = require('../models');
const transferHistoryService = require('./transferHistory.service');
const jackpotService = require('./jackpot.service');
const { freebetService } = require('.');
const logger = require('../config/logger');
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
 * @returns {Promise<FinancialReport>}
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
  let totalDeposit = 0;
  let totalWithdrawal = 0;

  const [players, tickets, cashierJackpotWinners] = await Promise.all([
    Player.find({ cashierId, gameType }),
    getBetHistory1({ cashierId, gameType }, today, today),
    jackpotService.getUpdatedJackpotHistory({gameType}, cashierId, today, today),
  ]);
  if (gameType==='aviatax'){
      players.forEach((player) => {
      totalPlayerWallets += Number(player.wallet);
      totalPlayerBonus += Number(player.bonus);
    });
  }
 
  tickets.forEach((ticket) => {
    totalStake += Number(ticket.stake ? ticket.stake : 0);
    totalWinnings += Number(ticket.winnings ? ticket.winnings : 0);
    numberOfBets += 1;

    if (gameType==='aviata'){
      totalDeposit += Number(ticket.stake ? ticket.stake : 0);
      totalWithdrawal += Number(ticket.winnings ? (-1*ticket.winnings) : 0); //totalWithdrawal is a negative value
    }
  });


  cashierJackpotWinners.forEach((jackpot) => {
    if (jackpot.jackpotType === 'Bronze') {
      jackpot1Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      totalWithdrawal += jackpot.jackpotAmount ? (-1*jackpot.jackpotAmount) : 0;
      jackpot1Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    } else if (jackpot.jackpotType === 'Silver') {
      jackpot2Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      totalWithdrawal += jackpot.jackpotAmount ? (-1*jackpot.jackpotAmount) : 0;
      jackpot2Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    } else if (jackpot.jackpotType === 'Gold') {
      jackpot3Payout += jackpot.jackpotAmount ? jackpot.jackpotAmount : 0;
      totalWithdrawal += jackpot.jackpotAmount ? (-1*jackpot.jackpotAmount) : 0;
      jackpot3Contributions += jackpot.active ? jackpot.jackpotContributions : 0;
    }
  });

  const payload = {
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
    };
  const payload_aviata = {
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
      totalDeposit,
      totalWithdrawal
    };

  const financialReport = await FinancialReport.findOne({ cashierId, gameType, createdAt: { $gte: today } });
  if (!financialReport) {
    return FinancialReport.create(gameType==='aviata' ? payload_aviata : payload);
  }

  const update = {
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
  }

  const update_aviata = {
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
    totalDeposit,
    totalWithdrawal
  }

  return FinancialReport.findByIdAndUpdate(
    financialReport._id, gameType==='aviata' ? update_aviata : update,
    { new: true }
  );
};

/**
 * Get and update financial report - player wallets
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdatePlayerWallets = async (cashierId, gameType, winnings) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight
  let totalPlayerWallets = 0;
  let totalPlayerBonus = 0;
  let totalBonusAwarded = 0;
  // const totalWinnings = 0;

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

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      gameType,
      totalPlayerWallets,
      totalPlayerBonus,
      totalBonusAwarded,
      totalWinnings: winnings,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      $set: {
        totalPlayerWallets,
        totalPlayerBonus,
        totalBonusAwarded,
      },
      $inc: {
        totalWinnings: winnings,
      },
    },
    { new: true }
  );
};

/**
 * Get and update transactions report - totalDeposits, totalWithdrawals, totalBonusAwarded
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateTotalTransactions = async (cashierId, gameType) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight
  let totalDeposit = 0;
  let totalWithdrawal = 0;
  let totalBonusAwarded = 0;

  const transactions = await transferHistoryService.queryTransferHistorys(
    { agent: cashierId, gameType },
    { limit: 1000000 },
    today,
    today,
    gameType
  );

  transactions.results.forEach((transaction) => {
    totalDeposit += Number(transaction.deposit ? transaction.deposit : 0);
    totalWithdrawal += Number(transaction.withdrawal ? transaction.withdrawal : 0);
    totalBonusAwarded += Number(transaction.bonus ? transaction.bonus : 0);
  });

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      totalDeposit,
      totalWithdrawal,
      totalBonusAwarded,
      gameType,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      totalDeposit,
      totalWithdrawal,
      totalBonusAwarded,
    },
    { new: true }
  );
};

/**
 * Get and update financial report - freebets
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateFreebets = async (cashierId, gameType, freebetAmount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      gameType,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      $inc: {
        totalFreebetAwarded: freebetAmount,
      },
    },
    { new: true }
  );
};

/**
 * Get and update financial report - freebets
 * @param {Object} financialReportBody
 * @returns {Promise<FinancialReport>}
 */
const getAndUpdateLastMan = async (cashierId, gameType, LastManAmount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const financialReport = await FinancialReport.findOne({ cashierId, createdAt: { $gte: today } });
  if (!financialReport) {
    return FinancialReport.create({
      cashierId,
      gameType,
    });
  }
  return FinancialReport.findByIdAndUpdate(
    financialReport._id,
    {
      $inc: {
        totalLastManAwarded: LastManAmount,
      },
    },
    { new: true }
  );
};

/**
 * Query for financialReports
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryFinancialReports = async (filter, options) => {
  const financialReports = await FinancialReport.paginate(filter, options);
  return financialReports;
};

const getFinancialReports = async (filter, startDate, endDate) => {
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
  const financialReports = await FinancialReport.find(filter);
  return financialReports;
};

const getAndUpdateStakeByDay = async (cashierId,  gameType, startDate, endDate) => {
  try {
    const startDateWithoutTime = new Date(startDate);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(23, 59, 59, 999);

    console.log('getAndUpdateStakeByDay', cashierId, gameType, startDateWithoutTime, endDateWithoutTime); 

    const [tickets, cashierJackpotWinners] = await Promise.all([
      getBetHistory1({ cashierId, gameType }, startDate, endDate),
      jackpotService.getUpdatedJackpotHistory(
        { gameType },
        cashierId,
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
      profit: 0,
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

    if (gameType==='aviata'){
      aggregates.totalDeposit = aggregates.totalStake;
      aggregates.totalWithdrawal = -1 * (aggregates.totalWinnings);
    } 

    const financialReport = await FinancialReport.findOne({
      cashierId,
      gameType,
      createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime },
    });
    
    if (!financialReport)
      return FinancialReport.create(
        { cashierId, ...aggregates, profit: aggregates.profit, gameType, createdAt: startDateWithoutTime } // Include createdAt for backdated reports
      );
    return FinancialReport.updateOne(
      { cashierId, gameType, createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime } },
      { ...aggregates, profit: aggregates.profit },
      { new: true }
    );

    // return financialReport;
  } catch (error) {
    logger.error('Error in getAndUpdateStakeByDay:', error);
  }
};

const getAndUpdateTotalTransactionsByDay = async (cashierId, gameType, startDate, endDate) => {
  try {
    const startDateWithoutTime = new Date(startDate);
    // startDateWithoutTime.setHours(0, 0, 0, 0);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(23, 59, 59, 999);

    const transactions = await transferHistoryService.queryTransferHistorys(
      { agent: cashierId, gameType },
      { limit: 1000000 },
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
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

     const financialReport = await FinancialReport.findOne({
      cashierId,
      gameType,
      createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime },
    });

     if (gameType==='aviatax')
      aggregates.profit = aggregates.totalDeposit - aggregates.totalWithdrawal;

    if (!financialReport)
      return FinancialReport.create(
        { cashierId, ...aggregates, gameType, createdAt: startDateWithoutTime } // Include createdAt for backdated reports
      );
    return FinancialReport.updateOne(
      { cashierId, gameType, createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime } },
      { ...aggregates },
      { new: true }
    );
  } catch (error) {
    logger.error('Error in getAndUpdateTotalTransactionsByDay:', error);
  }
};

//fetch financial reports for given cashier and date range
const getFinancialReportsByDay = async (cashierId, gameType, startDate, endDate) => {
  try {
    const startDateWithoutTime = new Date(startDate);
    startDateWithoutTime.setHours(0, 0, 0, 0);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(23, 59, 59, 999);

    const financialReports = await FinancialReport.find({
      cashierId,
      ...(gameType && { gameType }),
      createdAt: { $gte: startDateWithoutTime, $lte: endDateWithoutTime },
    }).sort({ createdAt: 1 }); // Sort by date ascending

      console.log('getFinancialReportsByDay', cashierId, gameType, startDateWithoutTime, endDateWithoutTime, financialReports);
    return financialReports;
  } catch (error) {
    logger.error('Error in getFinancialReportsByDay:', error);
    throw error; // Re-throw the error after logging it
  }

};
module.exports = {
  queryFinancialReports,
  getAndUpdateStake,
  getFinancialReports,
  getAndUpdatePlayerWallets,
  getAndUpdateTotalTransactions,
  getAndUpdateFreebets,
  getAndUpdateLastMan,
  getAndUpdateStakeByDay,
  getAndUpdateTotalTransactionsByDay,
  getFinancialReportsByDay
};
