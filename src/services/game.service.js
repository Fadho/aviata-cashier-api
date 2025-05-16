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
  const { gameType, agentId } = body;
  let gameConfig = await GameConfig.find({ agentId, gameType: body.gameType }).select('-id');
  if (!gameConfig.length) {
    const user = await User.find({ _id: agentId }).select('_id agentId superAgentId role');

    if (user[0].role === 'super') {
      gameConfig = await GameConfig.create({ agentId, gameType });
    }

    if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

    let parentGameConfig = await GameConfig.find({ agentId: user[0].agentId, gameType });
    if (!parentGameConfig) {
      const suser = await User.find({ role: 'super' }).select('_id');
      parentGameConfig = user[0].superAgentId
        ? await GameConfig.find({ agentId: user[0].superAgentId, gameType })
        : await GameConfig.find({ agentId: suser[0]._id, gameType });
    }

    delete parentGameConfig.agentId;
    gameConfig = await GameConfig.create({ agentId: user[0].agentId, ...parentGameConfig });
  }

  let game = await Game.find({ agentId, gameType }).select('-id');
  if (!game.length) {
    const user = await User.find({ _id: agentId }).select('_id agentId superAgentId role');

    if (user[0].role === 'super') {
      game = await Game.create({ agentId, gameType });
    }

    if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

    let parentGame = await Game.find({ agentId: user[0].agentId, gameType });
    if (!parentGame) {
      const suser = await User.find({ role: 'super' }).select('_id');
      parentGame = user[0].superAgentId
        ? await Game.find({ agentId: user[0].superAgentId, gameType })
        : await Game.find({ agentId: suser[0]._id, gameType });
    }

    delete parentGame.agentId;
    game = await Game.create({ agentId: user[0].agentId, ...parentGame });
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
