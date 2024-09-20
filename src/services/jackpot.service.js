/* eslint-disable no-restricted-syntax */

const axios = require('axios');
const { JackpotWinners, Jackpot, Player } = require('../models');
const config = require('../config/config');

/**
 * drop jackpot
 * @param {string} id
 * @returns {Promise<JackpotWinners>}
 */
const dropJackpot = async (id, deviceId, playerId, jackpotAmount) => {
  const player = await Player.findOne({ playerId, deviceId });
  const jackpot = await Jackpot.findById(id);
  const jackpotWinners = await JackpotWinners.findOne({
    jackpotType: jackpot.jackpotName,
    active: true,
    gameType: jackpot.gameType,
  });

  const today = new Date();

  const extractTime = (date) => ({
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  });

  // Check if jackpot.startTime and jackpot.endTime exist and are valid
  if (jackpot.startTime instanceof Date && jackpot.endTime instanceof Date) {
    const startTime = extractTime(jackpot.startTime);
    const endTime = extractTime(jackpot.endTime);

    const isTimeLater = (time1, time2) => {
      if (time1.hours > time2.hours) return true;
      if (time1.hours < time2.hours) return false;

      if (time1.minutes > time2.minutes) return true;
      if (time1.minutes < time2.minutes) return false;

      return time1.seconds > time2.seconds;
    };

    // Ensure that today's time is between startTime and endTime
    if (!isTimeLater(startTime, today) || !isTimeLater(today, endTime)) {
      return; // Exit if current time is not in the range
    }
  }

  if (!jackpotWinners || !jackpot || !player) {
    return;
  }
  await Player.findByIdAndUpdate(player._id, { wallet: player.wallet + Number(jackpotAmount) });
  const winner = await JackpotWinners.findOneAndUpdate(
    {
      _id: jackpotWinners._id,
    },
    {
      jackpotAmount,
      playerId,
      cashierId: player.cashierId,
      active: false,
    },
    { new: true }
  );
  await axios.post(`${config.websocket_url}/drop-jackpot`, {
    playerId,
    deviceId,
    jackpotAmount,
    jackpotType: jackpot.jackpotName,
  });

  return winner;
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
const updateAgentJackpot = async (id, body) => {
  return Jackpot.findOneAndUpdate(id, body, { new: true });
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

const getAgentJackpots = async (agentId, gameType) => {
  return Jackpot.find({ agentId, gameType });
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

module.exports = {
  createJackpot,
  findJackpot,
  updateAgentJackpot,
  dropJackpot,
  getJackpotHistory,
  getAgentJackpots,
  updateJackpotContributions,
  getAgentJackpotContributions,
};
