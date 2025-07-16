/* eslint-disable no-restricted-syntax */

const axios = require('axios');
const mongoose = require('mongoose');
const { JackpotWinners, Jackpot, Player, User } = require('../models');
const config = require('../config/config');

/**
 * drop jackpot
 * @param {string} id
 * @returns {Promise<JackpotWinners>}
 */
const dropJackpot = async (id, deviceId, playerId, jackpotAmount) => {
  const session = await mongoose.startSession(); // Start a MongoDB session
  session.startTransaction(); // Begin a transaction

  try {
    // Find the player
    const player = await Player.findOne({ playerId, deviceId }).session(session);
    if (!player) throw new Error('Player not found');

    // Find the jackpot
    const jackpot = await Jackpot.findById(id).session(session);
    if (!jackpot) throw new Error('Jackpot not found');

    // Find active jackpot winners
    const jackpotWinners = await JackpotWinners.findOne({
      jackpotType: jackpot.jackpotName,
      active: true,
      gameType: jackpot.gameType,
      deviceId,
    }).session(session);
    if (!jackpotWinners || jackpotWinners.jackpotContributions < jackpotAmount)
      throw new Error('No active jackpot winner found');

    // Time validation
    const today = new Date();
    const extractTime = (date) => ({
      hours: date.getHours(),
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
    });

    if (jackpot.startTime instanceof Date && jackpot.endTime instanceof Date) {
      const startTime = extractTime(jackpot.startTime);
      const endTime = extractTime(jackpot.endTime);
      const currentTime = extractTime(today);

      const isTimeValid = (start, current, end) => {
        return (
          (start.hours < current.hours || (start.hours === current.hours && start.minutes <= current.minutes)) &&
          (current.hours < end.hours || (current.hours === end.hours && current.minutes <= end.minutes))
        );
      };

      if (!isTimeValid(startTime, currentTime, endTime)) {
        throw new Error('Current time is not within jackpot time range');
      }
    }

    // Update player's wallet
    player.wallet += Number(jackpotAmount);
    await player.save({ session });

    // Update the jackpot winner to mark as inactive and record details
    const winner = await JackpotWinners.findOneAndUpdate(
      { _id: jackpotWinners._id, active: true },
      {
        jackpotAmount,
        playerId,
        cashierId: player.cashierId,
        active: false,
      },
      { new: true, session }
    );

    if (!winner) throw new Error('Failed to update jackpot winner');

    // Notify the WebSocket server about the jackpot drop
    await axios.post(`${config.websocket_url}/drop-jackpot`, {
      playerId,
      deviceId,
      jackpotAmount,
      jackpotType: jackpot.jackpotName,
    });

    // Commit the transaction if everything is successful
    await session.commitTransaction();

    // Log the winner for debugging
    // console.log('winner: ', winner);

    return winner;
  } catch (error) {
    // Rollback the transaction in case of any errors
    await session.abortTransaction();
    // console.log(`Error in dropJackpot: ${error.message}`);
    throw new Error('Error processing jackpot drop');
  } finally {
    // End the session to free up resources
    session.endSession();
  }
};

/**
 * create a new jackpot
 * @param {string} agentId
 * @param {string} gameType
 * @param {string} jackpotName
 * @returns {Promise<Jackpot>}
 */
const createJackpot = async (agentId, gameType, jackpotName, startTime, endTime) => {
  return Jackpot.create({
    agentId,
    gameType,
    jackpotName,
    ...(startTime &&
      endTime && {
        startTime,
        endTime,
      }),
  });
};

/**
 * create a new shop account
 * @param {ObjectId} currencyId
 * @param {ObjectId} userId
 * @param {boolean} primary
 * @returns {Promise<JackpotWinners[]>}
 */
const findJackpot = async ({ agentId, gameType }) => {
  return Jackpot.find({ agentId, gameType });
};
/**
 * update jackpot by jackpotId
 * @param {ObjectId} id
 * @param {Object} body
 * @returns {Promise<JackpotWinners>}
 */
const updateAgentJackpot = async (id, body, isSuperAgent, isSuperUser) => {
  const updateJackpot = await Jackpot.findOne({ _id: id });
  let subAgentIds = [];

  if (isSuperUser) {
    subAgentIds = await User.find({ role: 'admin' }).select('_id').lean();
  } else {
    subAgentIds = isSuperAgent
      ? await User.find({ superAgentId: updateJackpot.agentId }).select('_id').lean()
      : await User.find({ agentId: updateJackpot.agentId }).select('_id').lean();
  }

  // console.log(`Updating/creating jackpots for ${subAgentIds.length} sub agents`);

  await Promise.all(
    subAgentIds.map(async (user) => {
      const existingJackpot = await Jackpot.findOne({
        agentId: user._id,
        gameType: updateJackpot.gameType,
        jackpotName: updateJackpot.jackpotName,
      });

      if (existingJackpot) {
        await Jackpot.findOneAndUpdate({ _id: existingJackpot._id }, body);
      } else {
        await Jackpot.create({
          agentId: user._id,
          gameType: updateJackpot.gameType,
          jackpotName: updateJackpot.jackpotName,
          ...body,
        });
      }
    })
  );

  return updateJackpot;
};

const getJackpotHistory = async (filter, startDate, endDate) => {
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
  const tickets = await JackpotWinners.find(filter);
  return tickets;
};

const getUpdatedJackpotHistory = async (filter, cashierId, startDate, endDate) => {
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
  const jackpotWinners = await JackpotWinners.find(filter)
    .populate({
      path: 'deviceId',
      match: { cashierId: mongoose.Types.ObjectId(cashierId) },
      select: '_id cashierId',
    })
    .then((docs) => docs.filter((doc) => doc.deviceId !== null));
  return jackpotWinners;
};

const getAgentJackpots = async (agentId, gameType) => {
  let bronze;
  let silver;
  let gold;

  const jackpots = await Jackpot.find({ agentId, gameType });
  if (jackpots.length) return jackpots;

  const user = await User.findOne({ _id: agentId }).select('_id agentId superAgentId role');
  if (!user) return;

  // Only support specific game types
  if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

  if (user.role === 'super') {
    // Create default jackpots for super agent
    bronze = await Jackpot.create({ agentId, gameType, jackpotName: 'Bronze' });
    silver = await Jackpot.create({ agentId, gameType, jackpotName: 'Silver' });
    gold = await Jackpot.create({ agentId, gameType, jackpotName: 'Gold' });
    return [bronze, silver, gold];
  }

  let sourceJackpots = [];

  // If no agent or super agent, use default super user's jackpots
  if (!user.agentId || !user.superAgentId) {
    const suser = await User.findOne({ role: 'super' }).select('_id');
    sourceJackpots = await Jackpot.find({ agentId: suser._id, gameType });
  } else {
    const parentId = user.superAgentId || user.agentId;
    sourceJackpots = await Jackpot.find({ agentId: parentId, gameType });
  }

  for (const jackpot of sourceJackpots) {
    // eslint-disable-next-line no-await-in-loop
    const data = await Jackpot.create({
      agentId,
      percentageContributions: jackpot.percentageContributions,
      lowLimitAmount: jackpot.lowLimitAmount,
      highLimitAmount: jackpot.highLimitAmount,
      minDisplayAmount: jackpot.minDisplayAmount,
      minStakeToWin: jackpot.minStakeToWin,
      gameType: jackpot.gameType,
      jackpotName: jackpot.jackpotName,
    });

    const name = jackpot.jackpotName.toLowerCase();
    if (name === 'bronze') bronze = data;
    else if (name === 'silver') silver = data;
    else if (name === 'gold') gold = data;
  }

  return [bronze, silver, gold];
};

const updateJackpotContributions = async (
  bronzeJackpotId,
  bronzeContributions,
  silverJackpotId,
  silverContributions,
  goldJackpotId,
  goldContributions,
  deviceId,
  gameType
) => {
  const bronzeJackpot = await Jackpot.findOne({ _id: bronzeJackpotId });
  const silverJackpot = await Jackpot.findOne({ _id: silverJackpotId });
  const goldJackpot = await Jackpot.findOne({ _id: goldJackpotId });

  let activeBronzeContribution;
  let activeSilverContribution;
  let activeGoldContribution;

  if (bronzeJackpot) {
    activeBronzeContribution = await JackpotWinners.findOne({ jackpotType: 'Bronze', active: true, gameType, deviceId });

    if (activeBronzeContribution) {
      activeBronzeContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeBronzeContribution._id },
        { jackpotContributions: activeBronzeContribution.jackpotContributions + Number(bronzeContributions), active: true },
        { new: true }
      );
    } else {
      activeBronzeContribution = await JackpotWinners.create({
        jackpotType: 'Bronze',
        active: true,
        jackpotContributions: bronzeContributions,
        deviceId,
        gameType,
      });
    }
  }

  if (silverJackpot) {
    activeSilverContribution = await JackpotWinners.findOne({ jackpotType: 'Silver', active: true, gameType, deviceId });
    if (activeSilverContribution) {
      activeSilverContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeSilverContribution._id },
        { jackpotContributions: activeSilverContribution.jackpotContributions + Number(silverContributions) },
        { new: true }
      );
    } else {
      activeSilverContribution = await JackpotWinners.create({
        jackpotType: 'Silver',
        active: true,
        jackpotContributions: silverContributions,
        deviceId,
        gameType,
      });
    }
  }

  if (goldJackpot) {
    activeGoldContribution = await JackpotWinners.findOne({ jackpotType: 'Gold', active: true, gameType, deviceId });
    if (activeGoldContribution) {
      activeGoldContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeGoldContribution._id },
        { jackpotContributions: activeGoldContribution.jackpotContributions + Number(goldContributions) },
        { new: true }
      );
    } else {
      activeGoldContribution = await JackpotWinners.create({
        jackpotType: 'Gold',
        active: true,
        jackpotContributions: goldContributions,
        deviceId,
        gameType,
      });
    }
  }

  return { activeBronzeContribution, activeSilverContribution, activeGoldContribution };
};

const updateJackpotContributionsForCashier = async (
  bronzeJackpotId,
  bronzeContributions,
  silverJackpotId,
  silverContributions,
  goldJackpotId,
  goldContributions,
  cashierId,
  gameType
) => {
  const bronzeJackpot = await Jackpot.findOne({ _id: bronzeJackpotId });
  const silverJackpot = await Jackpot.findOne({ _id: silverJackpotId });
  const goldJackpot = await Jackpot.findOne({ _id: goldJackpotId });

  let activeBronzeContribution;
  let activeSilverContribution;
  let activeGoldContribution;

  if (bronzeJackpot) {
    activeBronzeContribution = await JackpotWinners.findOne({ jackpotType: 'Bronze', active: true, gameType, cashierId });

    if (activeBronzeContribution) {
      activeBronzeContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeBronzeContribution._id },
        { jackpotContributions: activeBronzeContribution.jackpotContributions + Number(bronzeContributions), active: true },
        { new: true }
      );
    } else {
      activeBronzeContribution = await JackpotWinners.create({
        jackpotType: 'Bronze',
        active: true,
        jackpotContributions: bronzeContributions,
        cashierId,
        gameType,
      });
    }
  }

  if (silverJackpot) {
    activeSilverContribution = await JackpotWinners.findOne({ jackpotType: 'Silver', active: true, gameType, cashierId });
    if (activeSilverContribution) {
      activeSilverContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeSilverContribution._id },
        { jackpotContributions: activeSilverContribution.jackpotContributions + Number(silverContributions) },
        { new: true }
      );
    } else {
      activeSilverContribution = await JackpotWinners.create({
        jackpotType: 'Silver',
        active: true,
        jackpotContributions: silverContributions,
        cashierId,
        gameType,
      });
    }
  }

  if (goldJackpot) {
    activeGoldContribution = await JackpotWinners.findOne({ jackpotType: 'Gold', active: true, gameType, cashierId });
    if (activeGoldContribution) {
      activeGoldContribution = await JackpotWinners.findOneAndUpdate(
        { _id: activeGoldContribution._id },
        { jackpotContributions: activeGoldContribution.jackpotContributions + Number(goldContributions) },
        { new: true }
      );
    } else {
      activeGoldContribution = await JackpotWinners.create({
        jackpotType: 'Gold',
        active: true,
        jackpotContributions: goldContributions,
        cashierId,
        gameType,
      });
    }
  }

  return { activeBronzeContribution, activeSilverContribution, activeGoldContribution };
};

const getAgentJackpotContributions = async (deviceId, gameType) => {
  let bronzeJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Bronze', deviceId, gameType });

  if (!bronzeJackpot) {
    bronzeJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Bronze', deviceId, gameType });
    bronzeJackpot = bronzeJackpot._doc;
  }
  let silverJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Silver', deviceId, gameType });
  if (!silverJackpot) {
    silverJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Silver', deviceId, gameType });
    silverJackpot = silverJackpot._doc;
  }

  let goldJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Gold', deviceId, gameType });
  if (!goldJackpot) {
    goldJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Gold', deviceId, gameType });
    goldJackpot = goldJackpot._doc;
  }

  return [bronzeJackpot, silverJackpot, goldJackpot];
};

const getCashierJackpotContributions = async (cashierId, gameType) => {
  let bronzeJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Bronze', cashierId, gameType });

  if (!bronzeJackpot) {
    bronzeJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Bronze', cashierId, gameType });
    bronzeJackpot = bronzeJackpot._doc;
  }
  let silverJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Silver', cashierId, gameType });
  if (!silverJackpot) {
    silverJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Silver', cashierId, gameType });
    silverJackpot = silverJackpot._doc;
  }

  let goldJackpot = await JackpotWinners.findOne({ active: true, jackpotType: 'Gold', cashierId, gameType });
  if (!goldJackpot) {
    goldJackpot = await JackpotWinners.create({ active: true, jackpotType: 'Gold', cashierId, gameType });
    goldJackpot = goldJackpot._doc;
  }

  return [bronzeJackpot, silverJackpot, goldJackpot];
};

module.exports = {
  createJackpot,
  findJackpot,
  updateAgentJackpot,
  dropJackpot,
  getJackpotHistory,
  getAgentJackpots,
  updateJackpotContributions,
  getAgentJackpotContributions,
  getUpdatedJackpotHistory,
  getCashierJackpotContributions,
  updateJackpotContributionsForCashier,
};
