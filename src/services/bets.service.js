/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const mongoose = require('mongoose');
const { differenceInHours } = require('date-fns');
const { Tickets, GameConfig, Rounds, Player, TicketsArchive } = require('../models');
const walletService = require('./wallet.service');
const logger = require('../config/logger');
const { userService } = require('.');
const financialReportService = require('./financialReport.service');
const gameReportService = require('./gameReport.service');

/**
 * create a new ticket
 * @param {string} result
 * @param {number} stake
 * @param {number} winnings
 * @param {ObjectId[]} selections
 * @param {ObjectId} cashierId
 * @returns {Promise<Tickets>}
 */
const createBetPlaced = async (result, stake, selections, cashierId, potentialWinnings, roundId, gameType) => {
  const minNumber = 1000000000; // Minimum 10-digit number
  const maxNumber = 9999999999; // Maximum 10-digit number
  const ticketId = Math.floor(minNumber + Math.random() * (maxNumber - minNumber + 1)).toString();

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
      gameType,
    });
  }
  return Tickets.create({
    result,
    stake,
    selections,
    cashierId,
    ticketId,
    betType: 'single',
    potentialWinnings,
    roundId,
    gameType,
  });
};

/**
 * create a new ticket
 * @param {number} stake
 * @param {string} gameType
 * @param {string} roundId
 * @param {ObjectId} cashierId
 * @param {ObjectId} playerId
 * @param {ObjectId} deviceId
 * @returns {Promise<Tickets>}
 */
const createBetPlacedForPlayer = async (stake, freebet, gameType, roundId, cashierId, playerId, deviceId) => {
  const session = await mongoose.startSession(); // Start a Mongoose session
  session.startTransaction(); // Start a transaction

  try {
    const minNumber = 1000000000; // Minimum 10-digit number
    const maxNumber = 9999999999; // Maximum 10-digit number
    const ticketId = Math.floor(minNumber + Math.random() * (maxNumber - minNumber + 1)).toString();

    // Create a new ticket in the session
    const ticket = await Tickets.create(
      [
        {
          stake,
          freebet,
          gameType,
          cashierId,
          ticketId,
          betType: 'single',
          playerId,
          roundId,
          deviceId,
        },
      ],
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession(); // End the session

    return ticket[0]; // Return the created ticket
  } catch (error) {
    await session.abortTransaction(); // Abort the transaction on error
    session.endSession();
    throw new Error(`Error creating ticket: ${error.message}`);
  }
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
  // const ticketsArchive = await TicketsArchive.find(filter);
  return tickets;
};

const getBetHistory1 = async (filter, startDate, endDate) => {
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
  const ticketsArchive = await TicketsArchive.find(filter);
  return [...tickets, ...ticketsArchive];
};

/**
 * calculate outcome for each bet
 * @param {String} roundId
 * @param {Number}  odd
 * @returns {Promise<Tickets>}
 */

async function updateBetsAndCalculateWinnings(roundId, odd) {
  const maxRetries = 5;
  let currentAttempt = 0;

  while (currentAttempt < maxRetries) {
    const session = await mongoose.startSession();
    let transactionSuccessful = false;

    try {
      session.startTransaction();

      const bets = await Tickets.find({ roundId, roundHasEnded: false }).session(session);

      if (!bets.length) {
        logger.info(`No bets found for round ${roundId}.`);
        await session.commitTransaction();
        transactionSuccessful = true;
        break;
      }

      for (const bet of bets) {
        let cumulativeWinnings = 0;
        let atLeastOneSelectionWins = false;
        for (const selection of bet.selections) {
          if (selection.odd <= odd) {
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

        if (!bet.gameOutcome) {
          logger.warn(`Invalid gameOutcome for bet ${bet._id}`);
          continue;
        }

        await bet.save({ session });

        const user = await userService.getUserById(bet.cashierId, { session });
        if (!user) {
          logger.warn(`User not found for cashierId: ${bet.cashierId}`);
          continue;
        }

        const gameConfig = await GameConfig.findOne({ agentId: user.agentId }).session(session);

        if (gameConfig?.payoutMode === 'Manual' && bet.result === 'win') {
          logger.info(`Processing manual payout for bet ${bet._id}`);

          let balance = Number(user.wallets?.[0]?.balance || 0);

          if (isNaN(balance)) {
            logger.warn(`Invalid balance for user ${user._id}`);
            continue;
          }

          balance += Number(bet.winnings);
          await walletService.updateWallet(user.wallets[0].id, balance, { session });
        }
      }

      await session.commitTransaction();
      transactionSuccessful = true;

      // Ensure round exists (in case)
      const roundExists = await Rounds.findOne({ roundId }).session(session);
      if (!roundExists) {
        await Rounds.create([{ roundId, odd }], { session });
      }

      await closeOpenBets(); // Optional: manage post-round bet state
      break;
    } catch (error) {
      if (!transactionSuccessful) {
        await session.abortTransaction();
      }

      if (error.code === 112) {
        logger.warn(`Write conflict on round ${roundId}, attempt ${currentAttempt + 1}. Retrying...`);
      } else if (currentAttempt === maxRetries - 1) {
        logger.error(`Max retries reached for round ${roundId}.`, error);
        throw error;
      } else {
        logger.warn(`Attempt ${currentAttempt + 1} failed for round ${roundId}. Retrying...`, error);
      }
    } finally {
      session.endSession();
      currentAttempt++;
    }
  }

  return true;
}

/**
 * cashout bet function for multiplayer games
 * @param {ObjectId} ticketId
 * @param {Number}  odd
 */

const cashoutBetForPlayer = async (ticketId, odd) => {
  const session = await mongoose.startSession(); // Start a session
  session.startTransaction(); // Begin a transaction

  try {
    // Find the bet (ticket) that hasn't ended yet
    const bet = await Tickets.findOne({ _id: ticketId, roundHasEnded: false }).session(session);
    if (!bet) return;
    let player;

    if (isNaN(bet.playerId) && typeof bet.playerId === 'string') {
      player = await Player.findOne({ username: bet.playerId, deviceId: bet.deviceId }).session(session);
    } else {
      // Find the player associated with the bet
      player = await Player.findOne({ playerId: bet.playerId, deviceId: bet.deviceId }).session(session);
    }
    const winnings = bet.freebet ? bet.stake * odd - bet.stake : bet.stake * odd;

    // Update the bet details
    await Tickets.findOneAndUpdate(
      { _id: ticketId, ticketId: bet.ticketId },
      {
        winnings,
        roundHasEnded: true,
        selections: [{ odd, stake: bet.stake }],
        gameOutcome: odd,
      },
      { new: true, session } // Include session in the update
    );

    // Update the player's wallet with the winnings
    const updatedPlayer = await Player.findOneAndUpdate(
      { _id: player.id },
      { wallet: player.wallet + winnings },
      { new: true, session } // Include session in the update
    );

    financialReportService.getAndUpdatePlayerWallets(player.cashierId, bet.gameType, winnings);
    gameReportService.getAndUpdatePlayerWallets(player.cashierId, bet.gameType, winnings);

    // Commit the transaction
    await session.commitTransaction();
    return updatedPlayer;
  } catch (error) {
    // If any error occurs, abort the transaction
    await session.abortTransaction();
    throw new Error(`Error during bet cashout: ${error.message}`);
  } finally {
    session.endSession(); // End the session
  }
};

/**
 * check for open bets after round closes
 * @param {String} roundId
 * @param {Number}  odd
 */

// function checkOpenBets(roundId, odd) {
//   const bets = Tickets.find({ roundId, roundHasEnded: false });
//   if (!bets.length) return;
//   updateBetsAndCalculateWinnings(roundId, odd);
// }

/**
 * check for open bets after round closes
 * @param {String} roundId
 * @param {Number}  odd
 */

const closeOpenBets = async () => {
  // find all open tickets
  const openTickets = await Tickets.aggregate([
    {
      $match: { roundHasEnded: false },
    },
    {
      $group: {
        _id: '$roundId',
      },
    },
    {
      $project: {
        _id: 0,
        roundId: '$_id',
      },
    },
  ]);

  if (!openTickets.length) return;

  // eslint-disable-next-line guard-for-in
  for (const ticket in openTickets) {
    const roundData = await Rounds.find({ roundId: openTickets[ticket].roundId });
    if (roundData.length && roundData[0].roundId) {
      await updateBetsAndCalculateWinnings(roundData[0].roundId, roundData[0].odd);
    }
  }
};

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

  if (!ticket.winnings) {
    return { ticket, message: 'No winnings to payout' };
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

const getBetHistoryByPlayer = async (playerId, filter, options, startDate, endDate) => {
  if (startDate && endDate) {
    const startDateWithoutTime = new Date(startDate);
    startDateWithoutTime.setHours(0, 0, 0, 0);
    const endDateWithoutTime = new Date(endDate);
    endDateWithoutTime.setHours(0, 0, 0, 0);
    endDateWithoutTime.setDate(endDateWithoutTime.getDate() + 1);

    const dateFilter = {
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
  const tickets = await Tickets.paginate({ playerId, ...filter }, options);
  // const tickets = await Tickets.find(filter);
  const ticketsArchive = await TicketsArchive.paginate({ playerId, ...filter }, options);
  return {
    results: [...tickets.results, ...ticketsArchive.results],
    totalPages: tickets.totalPages + ticketsArchive.totalPages,
    page: tickets.page,
    limit: tickets.limit,
    totalResults: tickets.totalResults + ticketsArchive.totalResults,
  };
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getBetHistory1,
  getBetHistoryReport,
  cancelTicket,
  payoutTicket,
  getCancelledBetHistory,
  updateBetsAndCalculateWinnings,
  createBetPlacedForPlayer,
  cashoutBetForPlayer,
  getBetHistoryByPlayer,
};
