/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const mongoose = require('mongoose');
const { differenceInHours } = require('date-fns');
const { Tickets, GameConfig } = require('../models');
const walletService = require('./wallet.service');
const logger = require('../config/logger');
const { userService } = require('.');

/**
 * create a new ticket
 * @param {string} result
 * @param {number} stake
 * @param {number} winnings
 * @param {ObjectId[]} selections
 * @param {ObjectId} cashierId
 * @returns {Promise<Tickets>}
 */
const createBetPlaced = async (result, stake, selections, cashierId, potentialWinnings, roundId) => {
  // const timestamp = new Date().getTime(); // Get current timestamp
  const ticketId = String(Math.floor(Math.random() * 10));
  // timestamp.toString();

  if (selections.length > 1) {
    return Tickets.create({
      result,
      stake,
      selections,
      cashierId,
      ticketId,
      betType: 'multiple',
      potentialWinnings,
      roundId,
    });
  }
  return Tickets.create({ result, stake, selections, cashierId, ticketId, betType: 'single', potentialWinnings, roundId });
};

/**
 * create a new shop account
 * @returns {Promise<Tickets>}
 */

const fetchBetPlaced = async () => {
  return Tickets.find();
};

/**
 * create a new shop account
 * @param {Object} filter
 * @returns {Promise<Tickets>}
 */
const getCancelledBetHistory = async ({ startDate, endDate, betType, cashierId }) => {
  const query = {};
  if (!startDate || !endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }

    return Tickets.find({
      ...query,
      cancelled: true,
    });
  }
  if (startDate && endDate) {
    if (betType) {
      query.betType = betType;
    }

    if (cashierId) {
      query.cashierId = cashierId;
    }
    if (!betType && !cashierId) {
      const bets = await Tickets.find({
        cancelled: true,
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
      return bets;
    }

    return Tickets.find({
      ...query,
      cancelled: true,

      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
  }
};

/**
 * Get Bets History
 * @param {Object} filter
 * @param {Object} options
 * @param {String} startDate
 * @param {String} endDate
 * @returns {Promise<Tickets>}
 */
const getBetHistoryReport = async (filter, options, startDate, endDate) => {
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
  const tickets = await Tickets.paginate(filter, options);
  return tickets;
};

const getBetHistory = async (filter, startDate, endDate) => {
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
  const tickets = await Tickets.find(filter);
  return tickets;
};

/**
 * calculate outcome for each bet
 * @param {String} roundId
 * @param {Number}  odd
 * @returns {Promise<Tickets>}
 */

async function updateBetsAndCalculateWinnings(roundId, odd) {
  const maxRetries = 3; // Maximum number of retries
  let currentAttempt = 0;

  while (currentAttempt < maxRetries) {
    const session = await mongoose.startSession();
    let transactionSuccessful = false;
    try {
      session.startTransaction();

      const bets = await Tickets.find({ roundId }).session(session);
      for (const bet of bets) {
        let cumulativeWinnings = 0;
        let atLeastOneSelectionWins = false;

        // eslint-disable-next-line no-continue
        if (bet.roundHasEnded) continue;

        for (const selection of bet.selections) {
          if (selection.odd < odd) {
            selection.winnings = selection.stake * selection.odd;
            cumulativeWinnings += selection.winnings;
            atLeastOneSelectionWins = true;
          } else {
            selection.winnings = 0;
          }
        }

        bet.winnings = cumulativeWinnings;
        bet.result = atLeastOneSelectionWins ? 'win' : 'loss';
        bet.roundHasEnded = true;
        bet.gameOutcome = odd;

        // Save bet with session
        await bet.save({ session });

        const user = await userService.getUserById(bet.cashierId, { session });
        const gameConfig = await GameConfig.find({ agentId: user.agentId }).session(session);

        // Update user's wallet if payout mode is Manual
        if (gameConfig[0].payoutMode === 'Manual' && bet.result === 'win') {
          logger.info('Manual Payout');
          let { balance } = user.wallets[0];
          balance = Number(balance);

          // eslint-disable-next-line no-restricted-globals
          if (typeof balance !== 'number' || isNaN(balance)) {
            logger.info('Invalid balance');
            return;
          }

          balance += Number(bet.winnings);

          await walletService.updateWallet(user.wallets[0].id, balance, { session });
        }
      }

      await session.commitTransaction();
      transactionSuccessful = true; // Mark the transaction as successful
      break; // Break the loop on successful transaction
    } catch (error) {
      if (!transactionSuccessful) {
        await session.abortTransaction();
      }
      if (error.code === 112) {
        // Write conflict error code in MongoDB
        logger.warn(`Write conflict detected. Attempt ${currentAttempt + 1} failed. Retrying...`);
      } else if (currentAttempt === maxRetries - 1) {
        logger.error('Max retries reached. Transaction failed:', error);
        throw error; // Throw error on last attempt
      } else {
        logger.warn(`Attempt ${currentAttempt + 1} failed. Retrying...`, error);
      }
    } finally {
      session.endSession();
      currentAttempt++;
    }
  }
}

/**
 * Payout Ticket
 * @param {ObjectId} id
 * @returns {Promise<Tickets>}
 */

const payoutTicket = async (id) => {
  const ticket = await Tickets.findOne({ ticketId: id });
  if (!ticket) {
    return { ticket: null, message: 'Invalid ticket' };
  }

  const user = await userService.getUserById(ticket.cashierId);
  const gameConfig = await GameConfig.findOne({ agentId: user.agentId });
  const currentDateTime = new Date();

  if (differenceInHours(currentDateTime, ticket.createdAt) > 48) {
    return { ticket, message: 'Ticket has expired' };
  }

  if (!ticket.roundHasEnded) {
    return { ticket, message: 'Round has not ended yet.' };
  }

  if (ticket.payout) {
    const readableDate = ticket.payoutDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
    const readableTime = ticket.payoutDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const readableCustomDateTime = `${readableDate}, ${readableTime}`;
    return { ticket, message: `Payout has been collected at ${readableCustomDateTime}` };
  }

  await Tickets.updateOne({ ticketId: id }, { payout: true, payoutDate: Date.now() }, { new: true });

  if (gameConfig.payoutMode === 'Automatic') {
    logger.info('Automatic Payout');
    let balance = Number(user.wallets[0].balance);

    // eslint-disable-next-line no-restricted-globals
    if (isNaN(balance)) {
      logger.info('Invalid balance');
      return { ticket, message: 'Invalid balance' };
    }

    balance += Number(ticket.winnings);
    await walletService.updateWallet(user.wallets[0].id, balance);
  }

  return {
    ticket,
    message: 'Payout verified - proceed with payment',
  };
};

module.exports = payoutTicket;

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<Tickets>}
 */
const cancelTicket = async (id) => {
  return Tickets.findByIdAndUpdate(id, { cancelled: true }, { new: true });
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<Tickets>}
 */
const getBetPlacedById = async (id) => {
  return Tickets.findOne({ ticketId: id });
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getBetHistoryReport,
  cancelTicket,
  payoutTicket,
  getCancelledBetHistory,
  updateBetsAndCalculateWinnings,
};
