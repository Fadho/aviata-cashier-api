const httpStatus = require('http-status');
// const tokenService = require('./token.service');
// const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const { Player, GameDevice } = require('../models');

/**
 * Register a new player
 * @param {Object} playerBody
 * @returns {Promise<Player>}
 */

const register = async (playerBody) => {
  const player = new Player({ ...playerBody, type: 'mobile' });
  await player.save();
  return player;
};

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const player = await Player.findOne({ email });
  if (!player || !(await player.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return player;
};

/**
 * Query for players
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */

const queryPlayers = async (filter, options) => {
  const players = await Player.paginate(filter, options);
  return players;
};

/**
 * Get player by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getPlayerById = async (id) => {
  return Player.findById(id).populate('deviceId');
};

const updatePlayerById = async (playerId, updateBody) => {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }
  Object.assign(player, updateBody);
  await player.save();
  return player;
};

const deletePlayerById = async (playerId) => {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }
  await player.remove();
  return player;
};

const joinShop = async (playerId, shopCode) => {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }

  const gameDevice = await GameDevice.findOne({ shopAccessCode: shopCode });
  if (!gameDevice) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Shop not found');
  }
  player.deviceId = gameDevice._id;
  await player.save();
  return Player.findById(playerId).populate('deviceId');
};

const leaveShop = async (playerId) => {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }

  player.deviceId = null;
  await player.save();
  return player;
};

module.exports = {
  register,
  loginUserWithEmailAndPassword,
  queryPlayers,
  getPlayerById,
  updatePlayerById,
  deletePlayerById,
  joinShop,
  leaveShop,
};
