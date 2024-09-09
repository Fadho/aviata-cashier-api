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

  if (!jackpot || !player) {
    return;
  }
  await Player.findByIdAndUpdate(player._id, { wallet: player.wallet + Number(jackpotAmount) });
  const winner = await JackpotWinners.create({
    jackpotAmount,
    jackpotType: jackpot.jackpotName,
    playerId,
    deviceId,
    cashierId: player.cashierId,
  });
  const response = await axios.post(`${config.websocket_url}/drop-jackpot`, { playerId, deviceId, jackpotAmount });
  console.log(response)
  return winner;
};

/**
 * create a new jackpot
 * @param {string} agentId
 * @param {string} gameType
 * @param {string} jackpotName
 * @returns {Promise<Jackpot>}
 */
const createJackpot = async (agentId, gameType, jackpotName) => {
  return Jackpot.create({ agentId, gameType, jackpotName });
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

module.exports = {
  createJackpot,
  findJackpot,
  updateAgentJackpot,
  dropJackpot,
  getJackpotHistory,
  getAgentJackpots,
};
