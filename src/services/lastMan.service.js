/* eslint-disable no-restricted-syntax */

const mongoose = require('mongoose');
const { LastManWinners, LastMan, Player, User } = require('../models');

/**
 * drop lastMan
 * @param {string} id
 * @returns {Promise<LastManWinners>}
 */
const dropLastMan = async (id, deviceId, playerId, numberOfPlayers) => {
  const session = await mongoose.startSession(); // Start a MongoDB session
  session.startTransaction(); // Begin a transaction

  try {
    // Find the player
    const player = await Player.findOne({ playerId, deviceId }).session(session);
    if (!player) throw new Error('Player not found');

    // Find the lastMan
    const lastMan = await LastMan.findById(id).session(session);
    if (!lastMan) throw new Error('LastMan not found');

    let lastManAmount = lastMan.dropAmount;
    let lastManPercentage = 0;

    if (numberOfPlayers >= 8) {
      lastManPercentage = lastMan.eightPlayersPercentage;
    } else if (numberOfPlayers >= 5) {
      lastManAmount *= lastMan.fivePlayersPercentage;
      lastManPercentage = lastMan.fivePlayersPercentage;
    } else if (numberOfPlayers >= 3) {
      lastManAmount *= lastMan.threePlayersPercentage;
      lastManPercentage = lastMan.threePlayersPercentage;
    } else {
      lastManAmount *= 0;
      lastManPercentage = 0;
    }

    // Update player's wallet
    player.wallet += lastManAmount;
    await player.save({ session });

    // save lastman winner
    const [winner] = await LastManWinners.create(
      [
        {
          dropAmount: lastManAmount,
          lastManPercentage,
          gameType: lastMan.gameType,
          deviceId,
          cashierId: player.cashierId,
        },
      ],
      { session }
    );

    // Commit the transaction if everything is successful
    await session.commitTransaction();

    return winner;
  } catch (error) {
    // Rollback the transaction in case of any errors
    await session.abortTransaction();
    // console.log(`Error in dropLastMan: ${error}`);
    throw new Error('Error processing lastMan drop');
  } finally {
    // End the session to free up resources
    session.endSession();
  }
};

/**
 * create a new lastMan
 * @param {string} agentId
 * @param {string} gameType
 * @param {string} lastManName
 * @returns {Promise<LastMan>}
 */
const createLastMan = async (agentId, gameType) => {
  return LastMan.create({
    agentId,
    gameType,
  });
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<LastManWinners[]>}
 */
const findLastMan = async ({ agentId, gameType }) => {
  return LastMan.find({ agentId, gameType });
};
/**
 * update lastMan by lastManId
 * @param {ObjectId} id
 * @param {Object} body
 * @returns {Promise<LastManWinners>}
 */
const updateAgentLastMan = async (id, body, isSuper) => {
  const updateLastMan = await LastMan.findOneAndUpdate(id, body, { new: true });
  const subAgentIds = isSuper
    ? await User.find({ superAgentId: updateLastMan.agentId })
        .select('_id')
        .lean()
        .map((user) => user._id)
    : await User.find({ agentId: updateLastMan.agentId })
        .select('_id')
        .lean()
        .map((user) => user._id);
  subAgentIds.forEach((el) => {
    LastMan.findOneAndUpdate({ agentId: el }, body, { new: true });
  });
  return updateLastMan;
};

const getLastManHistory = async (filter, startDate, endDate) => {
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
  const tickets = await LastManWinners.find(filter);
  return tickets;
};

const getUpdatedLastManHistory = async (filter, cashierId, startDate, endDate) => {
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
          updatedAt: {
            $gte: startDateWithoutTime,
            $lte: endDateWithoutTime,
          },
        }),
      ...filter,
    };
    // eslint-disable-next-line no-param-reassign
    filter = dateFilter;
  }
  const lastManWinners = await LastManWinners.find(filter)
    .populate({
      path: 'deviceId',
      match: { cashierId: mongoose.Types.ObjectId(cashierId) },
      select: '_id cashierId',
    })
    .then((docs) => docs.filter((doc) => doc.deviceId !== null));
  return lastManWinners;
};

const getAgentLastMan = async (agentId, gameType) => {
  let lastMan = await LastMan.find({ agentId, gameType });
  if (!lastMan.length) {
    lastMan = await createLastMan(agentId, gameType);
    return lastMan;
  }
  return lastMan[0];
};

const updateLastManContributions = async (lastManId, lastManContributions, deviceId, gameType) => {
  const lastMan = await LastMan.findOne({ _id: lastManId });

  let activeContribution;

  if (lastMan) {
    activeContribution = await LastManWinners.findOne({ active: true, gameType, deviceId });

    if (activeContribution) {
      activeContribution = await LastManWinners.findOneAndUpdate(
        { _id: activeContribution._id },
        { lastManContributions: activeContribution.lastManContributions + Number(lastManContributions) },
        { new: true }
      );
    } else {
      activeContribution = await LastManWinners.create({
        active: true,
        lastManContributions,
        deviceId,
        gameType,
      });
    }
  }

  return activeContribution;
};

const getAgentLastManContributions = async (deviceId, gameType) => {
  let lastMan = await LastManWinners.findOne({ active: true, deviceId, gameType });

  if (!lastMan) {
    lastMan = await LastManWinners.create({ active: true, deviceId, gameType });
    lastMan = lastMan._doc;
  }

  return lastMan;
};

module.exports = {
  createLastMan,
  findLastMan,
  updateAgentLastMan,
  dropLastMan,
  getLastManHistory,
  getAgentLastMan,
  updateLastManContributions,
  getAgentLastManContributions,
  getUpdatedLastManHistory,
};
