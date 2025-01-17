/* eslint-disable no-restricted-syntax */

const axios = require('axios');
const mongoose = require('mongoose');
const { FreebetWinners, Freebet, Player, User } = require('../models');
const config = require('../config/config');

/**
 * drop freebet
 * @param {string} id
 * @returns {Promise<FreebetWinners>}
 */
const dropFreebet = async (id, deviceId, playerId) => {
  const session = await mongoose.startSession(); // Start a MongoDB session
  session.startTransaction(); // Begin a transaction

  try {
    // Find the player
    const player = await Player.findOne({ playerId, deviceId }).session(session);
    if (!player) throw new Error('Player not found');

    // Find the freebet
    const freebet = await Freebet.findById(id).session(session);
    if (!freebet) throw new Error('Freebet not found');

    const freebetAmount = freebet.dropAmount;

    // Find active freebet winners
    const freebetWinners = await FreebetWinners.findOne({
      active: true,
      gameType: freebet.gameType,
      deviceId,
    }).session(session);

    if (!freebetWinners || freebetWinners.freebetContributions < freebetAmount)
      throw new Error('No active freebet winner found');

    // Update player's wallet
    player.freebet = true;
    await player.save({ session });

    // Update the freebet winner to mark as inactive and record details
    const winner = await FreebetWinners.findOneAndUpdate(
      { _id: freebetWinners._id, active: true },
      {
        dropAmount: freebetAmount,
        playerId,
        cashierId: player.cashierId,
        active: false,
      },
      { new: true, session }
    );

    if (!winner) throw new Error('Failed to update freebet winner');

    // Notify the WebSocket server about the freebet drop
    await axios.post(`${config.websocket_url}/drop-freebet`, {
      playerId,
      deviceId,
      freebetAmount,
    });

    // Commit the transaction if everything is successful
    await session.commitTransaction();

    // Log the winner for debugging
    // console.log('winner: ', winner);

    return winner;
  } catch (error) {
    // Rollback the transaction in case of any errors
    await session.abortTransaction();
    // console.log(`Error in dropFreebet: ${error}`);
    throw new Error('Error processing freebet drop');
  } finally {
    // End the session to free up resources
    session.endSession();
  }
};

/**
 * create a new freebet
 * @param {string} agentId
 * @param {string} gameType
 * @param {string} freebetName
 * @returns {Promise<Freebet>}
 */
const createFreebet = async (agentId, gameType) => {
  return Freebet.create({
    agentId,
    gameType,
  });
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<FreebetWinners[]>}
 */
const findFreebet = async ({ agentId, gameType }) => {
  return Freebet.find({ agentId, gameType });
};
/**
 * update freebet by freebetId
 * @param {ObjectId} id
 * @param {Object} body
 * @returns {Promise<FreebetWinners>}
 */
const updateAgentFreebet = async (id, body, isSuper) => {
  const updateFreebet = await Freebet.findOneAndUpdate(id, body, { new: true });
  const subAgentIds = isSuper
    ? await User.find({ superAgentId: updateFreebet.agentId })
        .select('_id')
        .lean()
        .map((user) => user._id)
    : await User.find({ agentId: updateFreebet.agentId })
        .select('_id')
        .lean()
        .map((user) => user._id);
  subAgentIds.forEach((el) => {
    Freebet.findOneAndUpdate({ agentId: el }, body, { new: true });
  });
  return updateFreebet;
};

const getFreebetHistory = async (filter, startDate, endDate) => {
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
  const tickets = await FreebetWinners.find(filter);
  return tickets;
};

const getUpdatedFreebetHistory = async (filter, cashierId, startDate, endDate) => {
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
  const freebetWinners = await FreebetWinners.find(filter)
    .populate({
      path: 'deviceId',
      match: { cashierId: mongoose.Types.ObjectId(cashierId) },
      select: '_id cashierId',
    })
    .then((docs) => docs.filter((doc) => doc.deviceId !== null));
  return freebetWinners;
};

const getAgentFreebets = async (agentId, gameType) => {
  let freebet = await Freebet.find({ agentId, gameType });
  if (!freebet.length) {
    freebet = await createFreebet(agentId, gameType);
    return freebet;
  }
  return freebet[0];
};

const updateFreebetContributions = async (freebetId, freebetContributions, deviceId, gameType) => {
  const freebet = await Freebet.findOne({ _id: freebetId });

  let activeContribution;

  console.log(freebetId, freebetContributions, deviceId, gameType);

  if (freebet) {
    activeContribution = await FreebetWinners.findOne({ active: true, gameType, deviceId });

    console.log('found active freebetWinners', activeContribution);

    if (activeContribution) {
      activeContribution = await FreebetWinners.findOneAndUpdate(
        { _id: activeContribution._id },
        { freebetContributions: activeContribution.freebetContributions + Number(freebetContributions) },
        { new: true }
      );
    } else {
      activeContribution = await FreebetWinners.create({
        active: true,
        freebetContributions,
        deviceId,
        gameType,
      });
    }
  }

  return activeContribution;
};

const getAgentFreebetContributions = async (deviceId, gameType) => {
  let freebet = await FreebetWinners.findOne({ active: true, deviceId, gameType });

  if (!freebet) {
    freebet = await FreebetWinners.create({ active: true, deviceId, gameType });
    freebet = freebet._doc;
  }

  return freebet;
};

module.exports = {
  createFreebet,
  findFreebet,
  updateAgentFreebet,
  dropFreebet,
  getFreebetHistory,
  getAgentFreebets,
  updateFreebetContributions,
  getAgentFreebetContributions,
  getUpdatedFreebetHistory,
};
