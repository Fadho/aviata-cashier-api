const userService = require('./user.service');
const { GameConfig, Game, User } = require('../models');

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
  let gameConfig = await GameConfig.find({ agentId: body.agentId, gameType: body.gameType }).select('-id');
  if (!gameConfig.length) {
    gameConfig = await GameConfig.create({ agentId: body.agentId, gameType: body.gameType });
  }

  let game = await Game.find({ agentId: body.agentId, gameType: body.gameType }).select('-id');
  if (!game.length) {
    game = await Game.create({ agentId: body.agentId, gameType: body.gameType });
  }

  // let jackpot = await Jackpot.find({ agentId: body.agentId, gameType: body.gameType }).select('-id');
  // if (!jackpot.length) {
  //   jackpot = await Jackpot.create({ agentId: body.agentId, gameType: body.gameType, jackpotName: 'Bronze' });
  // }

  if (!game || !gameConfig) {
    return { data: { game, gameConfig }, message: 'Not Found' };
  }

  const data = { game: game[0], gameConfig: gameConfig[0] };

  return { data, message: 'Fetched Game Data successfully.' };
};

const updateGameConfig = async (id, gameType, body, isSuper) => {
  const gameConfig = await GameConfig.findOneAndUpdate({ agentId: id, gameType }, body, { new: true });

  const subAgentIds = isSuper
    ? await User.find({ superAgentId: id, role: 'admin' }).select('_id')
    : await User.find({ agentId: id, role: 'admin' }).select('_id');

  if (subAgentIds)
    subAgentIds.forEach(async (el) => {
      await GameConfig.findOneAndUpdate({ agentId: el._id, gameType }, body, { new: true });
    });
  return { data: gameConfig, message: 'Game Config updated successfully.' };
};

const updateGameData = async (id, gameType, body, isSuper) => {
  const game = await Game.findOneAndUpdate({ agentId: id, gameType }, body, { new: true });
  const subAgentIds = isSuper
    ? await User.find({ superAgentId: id, role: 'admin' }).select('_id')
    : await User.find({ agentId: id, role: 'admin' }).select('_id');
  if (subAgentIds)
    subAgentIds.forEach(async (el) => {
      await Game.findOneAndUpdate({ agentId: el._id, gameType }, body, { new: true });
    });
  return { data: game, message: 'Game Data updated successfully.' };
};

const getGameData = async (agentId, gameType) => {
  const game = await Game.findOne({ agentId, gameType }).select('-id');
  return game;
};

const getGameSettings = async (agentId) => {
  const game = await GameConfig.find({ agentId });
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
