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

// The main startGame function with a limit of 3 active rounds
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
        const newRound = new Rounds({ roundId, order: i, superAgentId, gameType, roundHasEnded: false });
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
      const newRound = new Rounds({ roundId, order: 3, superAgentId, gameType, roundHasEnded: false });
      roundsToSave.push(newRound);
    }

    // If there are already 3 running rounds, don't create any new ones
    if (runningRounds.length === 3) {
      // console.log('There are already 3 active rounds. No new rounds will be created.');
      return runningRounds.map((round) => round.roundId);
    }

    if (roundsToSave.length > 0) {
      await Rounds.bulkSave(roundsToSave, { session }); // Save all in one go
    }

    return roundsToSave.map((round) => round.roundId);
  });
};

// const startGame = async (superAgentId, gameType) => {
//   if (!superAgentId) return;

//   const session = await Rounds.startSession(); // Start a new session
//   session.startTransaction(); // Start a transaction

//   try {
//     // Find all rounds that are currently running (roundHasEnded is false)
//     const runningRounds = await Rounds.find({ roundHasEnded: false, superAgentId, gameType }).limit(3).session(session);

//     if (runningRounds.length === 0) {
//       // No running rounds, create three new rounds with orders 1, 2, and 3
//       for (let i = 1; i <= 3; i++) {
//         let roundId = generateRandomId();
//         let exists = await Rounds.findOne({ roundId, superAgentId, gameType }).session(session);

//         // Ensure the new round ID is unique
//         while (exists) {
//           roundId = generateRandomId();
//           exists = await Rounds.findOne({ roundId, superAgentId, gameType }).session(session);
//         }

//         // Create the new round with the appropriate order
//         const newRound = await Rounds.create([{ roundId, order: i, superAgentId, gameType }], { session });
//         runningRounds.push(newRound[0]); // Add the new round to the runningRounds list
//       }
//       await session.commitTransaction(); // Commit the transaction
//       session.endSession(); // End the session
//       return runningRounds.map((round) => round.roundId);
//     }

//     if (runningRounds.length < 3) {
//       // Shift orders: 2 becomes 1, 3 becomes 2
//       // eslint-disable-next-line no-restricted-syntax
//       for (const round of runningRounds) {
//         if (round.order === 3) {
//           round.order = 2;
//         } else if (round.order === 2) {
//           round.order = 1;
//         }
//         await round.save({ session }); // Save the updated order
//       }

//       // Create and assign a new round with order 3
//       let roundId = generateRandomId();
//       let exists = await Rounds.findOne({ roundId, superAgentId, gameType }).session(session);
//       const exists2 = await Rounds.findOne({ order: 3, superAgentId, gameType }).session(session);

//       // Ensure the new round ID is unique
//       while (exists) {
//         roundId = generateRandomId();
//         exists = await Rounds.findOne({ roundId, superAgentId, gameType }).session(session);
//       }

//       if (exists2) {
//         runningRounds.push(exists2); // Add the new round to the runningRounds list
//         await session.commitTransaction(); // Commit the transaction
//         session.endSession(); // End the session
//         return runningRounds.map((round) => round.roundId);
//       }

//       // Create the new round with order 3
//       const newRound = await Rounds.create([{ roundId, order: 3, superAgentId, gameType }], { session });
//       runningRounds.push(newRound[0]); // Add the new round to the runningRounds list
//     }

//     await session.commitTransaction(); // Commit the transaction
//     return runningRounds.map((round) => round.roundId);
//   } catch (error) {
//     await session.abortTransaction(); // Abort the transaction in case of an error
//     throw error; // Re-throw the error after aborting
//   } finally {
//     session.endSession(); // End the session
//   }
// };

const closeGame = async (superAgentId, roundId, odd) => {
  if (!superAgentId || !roundId) return;

  try {
    odd = Number(odd);

    // Step 1: Update bets and calculate winnings
    const success = await updateBetsAndCalculateWinnings(roundId, odd);

    if (!success) {
      console.error(`Failed to update bets for round ${roundId}.`);
      return;
    }

    // Step 2: Mark round as ended
    const session = await Rounds.startSession();
    session.startTransaction();
    try {
      let updatedRound = await Rounds.findOne({ superAgentId, roundId, roundHasEnded: false }).session(session);
      if (!updatedRound) {
        updatedRound = await Rounds.create({ superAgentId, roundId, roundHasEnded: true, order: 0, odd }).session(session);
      } else {
        updatedRound.roundHasEnded = true;
        updatedRound.order = 0;
        updatedRound.odd = odd;
        await updatedRound.save({ session });
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      console.error(`Failed to mark round ${roundId} as ended.`, err);
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error(`Error closing round ${roundId}:`, error);
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
