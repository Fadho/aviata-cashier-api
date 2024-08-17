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

const startGame = async (superAgentId, gameType) => {
  if (!superAgentId) return;
  // Find all rounds that are currently running (roundHasEnded is false)
  const runningRounds = await Rounds.find({ roundHasEnded: false, superAgentId, gameType }).limit(3);
  // console.log(runningRounds.length, runningRounds);

  if (runningRounds.length === 0) {
    // No running rounds, create three new rounds with orders 1, 2, and 3
    for (let i = 1; i <= 3; i++) {
      let roundId = generateRandomId();
      let exists = await Rounds.findOne({ roundId, superAgentId, gameType });

      // Ensure the new round ID is unique
      while (exists) {
        roundId = generateRandomId();
        exists = await Rounds.findOne({ roundId, superAgentId, gameType });
      }

      // Create the new round with the appropriate order
      const newRound = await Rounds.create({ roundId, order: i, superAgentId, gameType });
      runningRounds.push(newRound); // Add the new round to the runningRounds list
    }
    return runningRounds.map((round) => round.roundId);
  }
  if (runningRounds.length < 3) {
    // Shift orders: 2 becomes 1, 3 becomes 2
    runningRounds.forEach((round) => {
      if (round.order === 3) {
        round.order = 2;
      } else if (round.order === 2) {
        round.order = 1;
      }
      round.save(); // Save the updated order
    });

    // Create and assign a new round with order 3
    let roundId = generateRandomId();
    let exists = await Rounds.findOne({ roundId, superAgentId, gameType });
    const exists2 = await Rounds.findOne({ order: 3, superAgentId, gameType });

    // Ensure the new round ID is unique
    while (exists) {
      roundId = generateRandomId();
      exists = await Rounds.findOne({ roundId, superAgentId, gameType });
    }

    if (exists2) {
      runningRounds.push(exists2); // Add the new round to the runningRounds list
      return runningRounds.map((round) => round.roundId);
    }

    // Create the new round with order 3
    const newRound = await Rounds.create({ roundId, order: 3, superAgentId, gameType });
    runningRounds.push(newRound); // Add the new round to the runningRounds list
  }

  return runningRounds.map((round) => round.roundId);
};

// const startGame = async (superAgentId, gameType) => {
//   if (!superAgentId) return;

//   // Find all rounds that are currently running (roundHasEnded is false)
//   let runningRounds = await Rounds.find({ roundHasEnded: false, superAgentId, gameType }).sort({ order: 1 });

//   // If more than three rounds are running, end the excess rounds
//   if (runningRounds.length > 3) {
//     const excessRounds = runningRounds.slice(3);
//     await Rounds.updateMany(
//       { _id: { $in: excessRounds.map((round) => round._id) } },
//       { roundHasEnded: true }
//     );
//     runningRounds = runningRounds.slice(0, 3);
//   }

//   if (runningRounds.length === 0) {
//     // No running rounds, create three new rounds with orders 1, 2, and 3
//     for (let i = 1; i <= 3; i++) {
//       let roundId = generateRandomId();
//       let exists = await Rounds.findOne({ roundId, superAgentId, gameType });

//       // Ensure the new round ID is unique
//       while (exists) {
//         roundId = generateRandomId();
//         exists = await Rounds.findOne({ roundId, superAgentId, gameType });
//       }

//       // Create the new round with the appropriate order
//       const newRound = await Rounds.create({ roundId, order: i, superAgentId, gameType });
//       runningRounds.push(newRound); // Add the new round to the runningRounds list
//     }
//   } else if (runningRounds.length < 3) {
//     // Ensure each order 1, 2, 3 is filled
//     const existingOrders = runningRounds.map((round) => round.order);

//     // Shift orders: 2 becomes 1, 3 becomes 2
//     runningRounds.forEach((round) => {
//       if (round.order === 3) {
//         round.order = 2;
//       } else if (round.order === 2) {
//         round.order = 1;
//       }
//       round.save(); // Save the updated order
//     });

//     // Create and assign new rounds to fill missing orders
//     for (let i = 1; i <= 3; i++) {
//       if (!existingOrders.includes(i)) {
//         let roundId = generateRandomId();
//         let exists = await Rounds.findOne({ roundId, superAgentId, gameType });

//         // Ensure the new round ID is unique
//         while (exists) {
//           roundId = generateRandomId();
//           exists = await Rounds.findOne({ roundId, superAgentId, gameType });
//         }

//         // Check if a round with order 3 already exists
//         if (i === 3) {
//           const existingOrder3 = await Rounds.findOne({ order: 3, superAgentId, gameType });
//           if (existingOrder3) {
//             runningRounds.push(existingOrder3); // Add the existing round with order 3
//             continue;
//           }
//         }

//         // Create the new round with the appropriate order
//         const newRound = await Rounds.create({ roundId, order: i, superAgentId, gameType });
//         runningRounds.push(newRound); // Add the new round to the runningRounds list
//       }
//     }
//   }

//   // Ensure only three running rounds are returned
//   return runningRounds.slice(0, 3).map((round) => round.roundId);
// };


const closeGame = async (superAgentId, roundId, odd) => {
  if (!superAgentId || !roundId) return;
  console.log(superAgentId, roundId, odd);
  await Rounds.findOneAndUpdate(
    { superAgentId, roundId, roundHasEnded: false },
    { superAgentId, roundId, odd, order: 0, roundHasEnded: true },
    { new: true }
  );
  updateBetsAndCalculateWinnings(roundId, odd);
};

module.exports = {
  createRound,
  queryRounds,
  getRoundById,
  getRounds,
  startGame,
  closeGame,
};
