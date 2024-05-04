/* eslint-disable no-restricted-syntax */

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
  if (selections.length > 1) {
    return Tickets.create({
      result,
      stake,
      selections,
      cashierId,
      betType: 'multiple',
      potentialWinnings,
      roundId,
    });
  }
  return Tickets.create({ result, stake, selections, cashierId, betType: 'single', potentialWinnings, roundId });
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
  // Find all bets for the provided cashierId and roundId
  // const bets = await Tickets.find({ cashierId, roundId });
  const bets = await Tickets.find({ cashierId, roundId });
  // Loop through each bet
  for (const bet of bets) {
    let cumulativeWinnings = 0;
    let atLeastOneSelectionWins = false;

    // Loop through each selection in the bet
    for (const selection of bet.selections) {
      // Calculate user winnings based on the selection odd and the provided odd
      if (selection.odd < odd) {
        selection.winnings = selection.stake * selection.odd;
        cumulativeWinnings += selection.winnings;
        atLeastOneSelectionWins = true;
      } else {
        selection.winnings = 0; // If the selection odd is not less than the provided odd, set winnings to 0
      }
    }

    // Update cumulative winnings and result for the bet
    bet.winnings = cumulativeWinnings;
    bet.result = atLeastOneSelectionWins ? 'win' : 'loss';

    // Save the updated bet object to the database
    return bet.save();
  }
}

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<Tickets>}
 */
const payoutTicket = async (id) => {
  const ticket = await Tickets.findById(id);

  if (ticket) {
    // eslint-disable-next-line no-extra-boolean-cast
    if (ticket.winnings === Number) return { ticket, message: 'Round has not ended yet.' };
    if (ticket.payout) return { ticket, message: `Payout as been collected` };
    return {
      ticket: await Tickets.findByIdAndUpdate(id, { payout: true }, { new: true }),
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
