/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
const mongoose = require('mongoose');
const { Tickets } = require('../models');

/**
 * create a new shop account
 * @param {string} result
 * @param {number} stake
 * @param {number} winnings
 * @param {ObjectId[]} selections
 * @param {ObjectId} cashierId
 * @returns {Promise<Tickets>}
 */
const createBetPlaced = async (result, stake, selections, cashierId, potentialWinnings, roundId) => {
  const timestamp = new Date().getTime(); // Get current timestamp
  const ticketId = timestamp.toString();

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
 * create a new shop account
 * @param {Object} filter
 * @returns {Promise<Tickets>}
 */
const getBetHistory = async ({ startDate, endDate, betType, cashierId }) => {
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
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
      return bets;
    }

    return Tickets.find({
      ...query,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
  }
};

/**
 * create a new shop account
 * @param {String} cashierId
 * @param {String} roundId
 * @param {Number}  odd
 * @returns {Promise<Tickets>}
 */

async function updateBetsAndCalculateWinnings(cashierId, roundId, odd) {
  const session = await mongoose.startSession();
  session.startTransaction();
  const maxRetries = 3; // Maximum number of retries
  let currentAttempt = 0;

  while (currentAttempt < maxRetries) {
    try {
      const bets = await Tickets.find({ cashierId, roundId }).session(session);
      for (const bet of bets) {
        let cumulativeWinnings = 0;
        let atLeastOneSelectionWins = false;

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

        // eslint-disable-next-line no-await-in-loop
        await bet.save({ session });
      }
      await session.commitTransaction();
      break; // Break the loop on successful transaction
    } catch (error) {
      await session.abortTransaction();
      if (currentAttempt === maxRetries - 1) throw error; // Throw error on last attempt
    } finally {
      currentAttempt++;
    }
  }
  session.endSession();
}

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<Tickets>}
 */
const payoutTicket = async (id) => {
  let ticket = await Tickets.find({ ticketId: id });
  // eslint-disable-next-line prefer-destructuring
  ticket = ticket[0];

  if (ticket) {
    if (!ticket.roundHasEnded) return { ticket, message: 'Round has not ended yet.' };
    if (ticket.payout) return { ticket, message: `Payout as been collected` };

    ticket = await Tickets.updateOne({ ticketId: id }, { payout: true }, { new: true });

    return {
      ticket,
      message: `Payout verified - proceed with payment`,
    };
  }

  return { ticket: null, message: 'invalid ticket' };
};
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
  return Tickets.findById(id);
};

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  cancelTicket,
  payoutTicket,
  getCancelledBetHistory,
  updateBetsAndCalculateWinnings,
};
