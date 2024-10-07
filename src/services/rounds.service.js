/* eslint-disable no-param-reassign */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
// const httpStatus = require('http-status');
const { Rounds } = require('../models');
// const ApiError = require('../utils/ApiError');
const generateRandomId = require('../utils/randomId');
const { updateBetsAndCalculateWinnings } = require('./bets.service');

/**
 * Create a round
 * @param {Object} body
 * @returns {Promise<Rounds>}
 */
const createRound = async (body) => {
  return Rounds.create(body);
};

/**
 * Query for rounds
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryRounds = async (filter, options) => {
  const rounds = await Rounds.paginate(filter, options);
  return rounds;
};

const getRounds = async (filter, options) => {
  const rounds = await Rounds.find(filter, options);
  return rounds;
};

/**
 * Get round by id
 * @param {ObjectId} id
 * @returns {Promise<Rounds>}
 */
const getRoundById = async (id) => {
  return Rounds.findById(id);
};

// Helper function to generate a unique round ID
const generateUniqueRoundId = async (superAgentId, gameType, session) => {
  let roundId;
  let exists;
  do {
    roundId = generateRandomId();
    exists = await Rounds.findOne({ roundId, superAgentId, gameType }).session(session);
  } while (exists);
  return roundId;
};

// Helper function to retry a transaction on transient errors
const withRetryTransaction = async (transactionFn, maxRetries = 3) => {
  let retries = 0;
  while (retries < maxRetries) {
    const session = await Rounds.startSession();
    session.startTransaction();

    try {
      const result = await transactionFn(session); // Execute the transaction logic
      await session.commitTransaction(); // Commit if successful
      return result; // Return the result
    } catch (error) {
      await session.abortTransaction(); // Abort if an error occurs
      if (error.hasErrorLabel('TransientTransactionError') && retries < maxRetries) {
        retries += 1;
        console.log(`Transaction aborted. Retrying transaction (${retries}/${maxRetries})...`);
      } else {
        throw error; // Throw error if not retryable or max retries exceeded
      }
    } finally {
      session.endSession(); // End the session
    }
  }
};

// The main startGame function with retry logic
const startGame = async (superAgentId, gameType) => {
  if (!superAgentId) return;

  return withRetryTransaction(async (session) => {
    // Find all running rounds (roundHasEnded is false)
    const runningRounds = await Rounds.find({ roundHasEnded: false, superAgentId, gameType }).limit(3).session(session);

    const roundsToSave = [];

    if (runningRounds.length === 0) {
      // No running rounds, create three new rounds with orders 1, 2, and 3
      for (let i = 1; i <= 3; i++) {
        const roundId = await generateUniqueRoundId(superAgentId, gameType, session);
        const newRound = new Rounds({ roundId, order: i, superAgentId, gameType });
        roundsToSave.push(newRound);
      }
    } else if (runningRounds.length < 3) {
      // Shift existing orders (2 -> 1, 3 -> 2)
      runningRounds.forEach((round) => {
        round.order = round.order === 3 ? 2 : 1;
        roundsToSave.push(round);
      });

      // Create a new round with order 3
      const roundId = await generateUniqueRoundId(superAgentId, gameType, session);
      const newRound = new Rounds({ roundId, order: 3, superAgentId, gameType });
      roundsToSave.push(newRound);
    }

    if (roundsToSave.length > 0) {
      await Rounds.bulkSave(roundsToSave, { session }); // Save all in one go
    }

    return roundsToSave.length ? roundsToSave.map((round) => round.roundId) : runningRounds.map((round) => round.roundId);
  });
};

const closeGame = async (superAgentId, roundId, odd) => {
  if (!superAgentId || !roundId) return;

  const session = await Rounds.startSession(); // Start a new session
  session.startTransaction(); // Start a transaction

  try {
    odd = Number(odd);

    // Update the round to mark it as ended
    const updatedRound = await Rounds.findOne({ superAgentId, roundId, roundHasEnded: false });

    if (!updatedRound) return;
    delete updatedRound.roundHasEnded;
    delete updatedRound.order;

    updatedRound.roundHasEnded = true;
    updatedRound.order = 0;
    updatedRound.odd = odd;

    updatedRound.save();

    if (updatedRound) {
      await updateBetsAndCalculateWinnings(roundId, odd);
    } else {
      console.error(`Failed to close round ${roundId}. Round not found or already ended.`);
    }

    await session.commitTransaction(); // Commit the transaction if successful
  } catch (error) {
    await session.abortTransaction(); // Abort the transaction in case of an error
    console.log(`Error closing round ${roundId}:`, error);
  } finally {
    session.endSession(); // End the session
  }
};

module.exports = {
  createRound,
  queryRounds,
  getRoundById,
  getRounds,
  startGame,
  closeGame,
};
