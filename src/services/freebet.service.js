/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

const axios = require('axios');
const mongoose = require('mongoose');
const { randomInt } = require('crypto');
const { FreebetWinners, Freebet, Player, User, Tickets } = require('../models');
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

    // console.log(freebet, freebetWinners);

    if (!freebetWinners || freebetWinners.freebetContributions < freebetAmount)
      throw new Error('No active freebet winner found / freebetContributions < freebetAmount');

    // Update player freebet
    await Player.findOneAndUpdate(
      { _id: player._id },
      {
        freebet: true,
      },
      { new: true, session }
    );

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

    try {
      await axios.post(`${config.websocket_url}/drop-freebet`, {
        playerId,
        deviceId,
        freebetAmount,
      });
    } catch (axiosError) {
      console.error(`WebSocket server call failed:`, axiosError);
      throw new Error('Failed to notify WebSocket server');
    }

    // Commit the transaction if everything is successful
    await session.commitTransaction();

    // Log the winner for debugging
    // console.log('winner: ', winner);

    return winner;
  } catch (error) {
    // Rollback the transaction in case of any errors
    await session.abortTransaction();
    console.error(`Error in dropFreebet:`, error);
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
const updateAgentFreebet = async (id, body, isSuperAgent, isSuperUser) => {
  const updateFreebet = await Freebet.findOne({ _id: id });
  let subAgentIds;

  if (isSuperUser) {
    subAgentIds = await User.find({ role: 'admin' }).select('_id').lean();
  } else {
    subAgentIds = isSuperAgent
      ? await User.find({ superAgentId: updateFreebet.agentId }).select('_id').lean()
      : await User.find({ agentId: updateFreebet.agentId }).select('_id').lean();
  }

  if (subAgentIds)
    await Promise.all(
      subAgentIds.map(async (user) => {
        const existingFreebet = await Freebet.findOne({ agentId: user._id, gameType: updateFreebet.gameType });

        if (existingFreebet) {
          // Update existing jackpot
          await Freebet.findOneAndUpdate({ _id: existingFreebet._id }, body);
        } else {
          // Create new jackpot with inherited data
          await Freebet.create({
            agentId: user._id,
            gameType: updateFreebet.gameType,
            ...body,
          });
        }
      })
    );
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
  const freebet = await Freebet.find({ agentId, gameType });
  if (freebet.length) return freebet[0];

  const user = await User.find({ _id: agentId }).select('_id agentId superAgentId role');

  if (user[0].role === 'super') {
    // Create default jackpots
    const freebetData = await Freebet.create({ agentId, gameType });

    return freebetData;
  }

  if (!user[0]) {
    return;
  }
  // eslint-disable-next-line no-useless-return
  // Only support specific game types
  if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

  let parentFreebet = await Freebet.find({ agentId: user[0].agentId, gameType });
  if (!parentFreebet) {
    const suser = await User.find({ role: 'super' }).select('_id');
    parentFreebet = user[0].superAgentId
      ? await Freebet.find({ agentId: user[0].superAgentId, gameType })
      : await Freebet.find({ agentId: suser[0]._id, gameType });
  }

  delete parentFreebet.agentId;
  const freebetData = await Freebet.create({ agentId, ...parentFreebet });

  return freebetData;
};

const updateFreebetContributions = async (freebetId, freebetContributions, deviceId, gameType, roundId) => {
  const freebet = await Freebet.findOne({ _id: freebetId });
  const roudBets = await Tickets.find({ roundId });
  const players = [];
  roudBets.forEach((bet) => {
    players.push(bet.playerId);
  });

  let activeContribution;

  if (freebet) {
    activeContribution = await FreebetWinners.findOne({ active: true, gameType, deviceId });
    console.log(activeContribution);

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

    if (activeContribution.freebetContributions >= freebet.dropAmount) {
      await dropFreebet(freebetId, deviceId, players[players.length > 1 ? randomInt(players.length) : 0]);
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
