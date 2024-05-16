// const httpStatus = require('http-status');
const userService = require('./user.service');
// const ApiError = require('../utils/ApiError');
const { GameConfig, Game } = require('../models');

/**
 * Authenticate Game
 * @returns {Promise<User>}
 */
const authenticateGame = async (id) => {
  const user = await userService.getLastAdminLogin(id);

  return user;
};

const createGameConfig = async (body) => {
  let gameConfig = await GameConfig.find({ agentId: body.agentId });

  if (gameConfig.length) {
    return { data: gameConfig[0], message: 'Game Config Exists.' };
  }

  gameConfig = await GameConfig.create(body, { new: true });

  return { data: gameConfig[0], message: 'Game Config created successfully.' };
};

const createGameData = async (body) => {
  let game = await Game.find({ agentId: body.agentId });

  if (game.length) {
    return { data: game[0], message: 'Game Data Exists.' };
  }

  game = await Game.create(body, { new: true });

  return { data: game[0], message: 'Game Data created successfully.' };
};

const getGameConfig = async (body) => {
  const gameConfig = await GameConfig.find({ agentId: body }).select('-id');
  const game = await Game.find({ agentId: body }).select('-id');

  const data = { game: game[0], gameConfig: gameConfig[0] };

  if (!game.length || !gameConfig.length) {
    return { data, message: 'Not Found' };
  }
  return { data, message: 'Fetched Game Data successfully.' };
};

const updateGameConfig = async (id, body) => {
  const gameConfig = await GameConfig.findOneAndUpdate({ agentId: id }, body, { new: true });
  return { data: gameConfig, message: 'Game Config updated successfully.' };
};

const updateGameData = async (id, body) => {
  const game = await Game.findOneAndUpdate({ agentId: id }, body, { new: true });
  return { data: game, message: 'Game Data updated successfully.' };
};

const getGameData = async () => {
  const game = await Game.findOne();
  return game;
};

const getGameSettings = async () => {
  const game = await GameConfig.find();
  // console.log('game: ', game)
  return game;
};

module.exports = {
  authenticateGame,
  getGameConfig,
  createGameConfig,
  updateGameConfig,
  getGameData,
  updateGameData,
  createGameData,
  getGameSettings,
};
