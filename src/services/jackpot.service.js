/* eslint-disable no-restricted-syntax */

const { JackpotWinners, Jackpot, Player } = require('../models');
const { userService } = require('.');

/**
 * drop jackpot
 * @param {string} id
 * @returns {Promise<JackpotWinners>}
 */
const dropJackpot = async (id, deviceId, playerId, jackpotAmount) => {
  const player = await Player.findById(playerId);
  const jackpot = await Jackpot.findById(id);

  if (!jackpot || !player) {
    return;
  }
  await Player.findByIdAndUpdate(playerId, { wallet: player.wallet + Number(jackpotAmount) });
  return JackpotWinners.create({ jackpotAmount, jackpotType: jackpot.jackpotName, playerId, deviceId });
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

module.exports = {
  createJackpot,
  findJackpot,
  updateAgentJackpot,
  dropJackpot,
};
