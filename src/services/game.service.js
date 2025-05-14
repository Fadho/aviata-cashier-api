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

  if (!game || !gameConfig) {
    return { data: { game, gameConfig }, message: 'Not Found' };
  }

  const data = { game: game[0], gameConfig: gameConfig[0] };

  return { data, message: 'Fetched Game Data successfully.' };
};

const updateGameConfig = async (id, gameType, body, isSuperAgent, isSuperUser) => {
  const gameConfig = await GameConfig.findOneAndUpdate({ agentId: id, gameType }, body, { new: true });
  let subAgentIds;

  if (isSuperUser) {
    subAgentIds = await User.find({ role: 'admin' }).select('_id');
  } else {
    subAgentIds = isSuperAgent
      ? await User.find({ superAgentId: id, role: 'admin' }).select('_id')
      : await User.find({ agentId: id, role: 'admin' }).select('_id');
  }
  if (subAgentIds)
    await Promise.all(
      subAgentIds.map(async (user) => {
        const existingGameConfig = await GameConfig.findOne({ agentId: user._id, gameType });

        if (existingGameConfig) {
          // Update existing jackpot
          await GameConfig.findOneAndUpdate({ _id: existingGameConfig._id }, body);
        } else {
          // Create new jackpot with inherited data
          await GameConfig.create({
            agentId: user._id,
            gameType,
            ...body,
          });
        }
      })
    );
  return { data: gameConfig, message: 'Game Config updated successfully.' };
};

const updateGameData = async (id, gameType, body, isSuperAgent, isSuperUser) => {
  const game = await Game.findOneAndUpdate({ agentId: id, gameType }, body, { new: true });
  let subAgentIds;
  if (isSuperUser) {
    subAgentIds = await User.find({ role: 'admin' }).select('_id');
  } else {
    subAgentIds = isSuperAgent
      ? await User.find({ superAgentId: id, role: 'admin' }).select('_id')
      : await User.find({ agentId: id, role: 'admin' }).select('_id');
  }
  // console.log(subAgentIds)

  if (subAgentIds)
    await Promise.all(
      subAgentIds.map(async (user) => {
        const existingGame = await Game.findOne({ agentId: user._id, gameType });

        if (existingGame) {
          // Update existing jackpot
          await Game.findOneAndUpdate({ _id: existingGame._id }, body);
        } else {
          // Create new jackpot with inherited data
          await Game.create({
            agentId: user._id,
            gameType,
            ...body,
          });
        }
      })
    );

  return { data: game, message: 'Game Data updated successfully.' };
};

const getGameData = async (agentId, gameType) => {
  const user = await User.find({ _id: agentId, role: 'admin' }).select('_id');
  if (!user) {
    return;
  }
  if (gameType !== 'aviata' && gameType !== 'shootout' && gameType !== 'aviatax') {
    return;
  }
  let game = await Game.findOne({ agentId, gameType }).select('-id');
  if (!game) {
    game = await Game.create({ agentId, gameType });
  }
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
