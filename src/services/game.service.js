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
  let gameConfig = await GameConfig.findOne({ agentId, gameType }).select('-id');
  // console.log('gameConfig', gameConfig, !gameConfig)
  if (!gameConfig) {
    const user = await User.find({ _id: agentId }).select('_id agentId superAgentId role');

    if (user[0].role === 'super') {
      gameConfig = await GameConfig.create({ agentId, gameType });
    }

    if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

    if (!user[0].agentId || !user[0].superAgentId) {
      const suser = await User.findOne({ role: 'super' }).select('_id');
      const suserGameConfig = await GameConfig.findOne({ agentId: suser._id, gameType });

      gameConfig = await GameConfig.create({
        agentId: user[0]._id,
        gameType,
        ticketStakeMin: suserGameConfig.ticketStakeMin,
        ticketStakeMax: suserGameConfig.ticketStakeMax,
        ticketSizeMin: suserGameConfig.ticketSizeMin,
        ticketSizeMax: suserGameConfig.ticketSizeMax,
        quickPick: suserGameConfig.quickPick,
        payoutMode: suserGameConfig.payoutMode,
        depositBonus: suserGameConfig.depositBonus,
      });
    } else {
      let parentGameConfig = await GameConfig.find({ agentId: user[0].agentId, gameType });
      if (!parentGameConfig) {
        const suser = await User.find({ role: 'super' }).select('_id');
        parentGameConfig = user[0].superAgentId
          ? await GameConfig.find({ agentId: user[0].superAgentId, gameType })
          : await GameConfig.find({ agentId: suser[0]._id, gameType });
      }
      // const parentGameConfig = user[0].superAgentId
      //   ? await GameConfig.find({ agentId: user[0].superAgentId, gameType })
      //   : await GameConfig.find({ agentId: user[0].agentId, gameType });

      gameConfig = await GameConfig.create({
        agentId: user[0].agentId,
        gameType,
        ticketStakeMin: parentGameConfig.ticketStakeMin,
        ticketStakeMax: parentGameConfig.ticketStakeMax,
        ticketSizeMin: parentGameConfig.ticketSizeMin,
        ticketSizeMax: parentGameConfig.ticketSizeMax,
        quickPick: parentGameConfig.quickPick,
        payoutMode: parentGameConfig.payoutMode,
        depositBonus: parentGameConfig.depositBonus,
      });
    }
  }

  let game = await Game.findOne({ agentId, gameType }).select('-id');
  if (!game) {
    const user = await User.find({ _id: agentId }).select('_id agentId superAgentId role');

    if (user[0].role === 'super') {
      game = await Game.create({ agentId, gameType });
    }

    if (!['aviata', 'shootout', 'aviatax'].includes(gameType)) return;

    if (!user[0].agentId || !user[0].superAgentId) {
      const suser = await User.findOne({ role: 'super' }).select('_id');
      const suserGame = await Game.findOne({ agentId: suser._id, gameType });

      game = await Game.create({
        agentId: user[0]._id,
        gameType,
        roundWaitTimeValue: suserGame.roundWaitTimeValue,
        timerCountdownValue: suserGame.timerCountdownValue,
        roundBetsLimit: suserGame.roundBetsLimit,
        rtp: suserGame.rtp,
      });
    } else {
      let parentGame = await Game.find({ agentId: user[0].agentId, gameType });
      if (!parentGame) {
        const suser = await User.find({ role: 'super' }).select('_id');
        parentGame = user[0].superAgentId
          ? await Game.find({ agentId: user[0].superAgentId, gameType })
          : await Game.find({ agentId: suser[0]._id, gameType });
      }
      game = await Game.create({
        agentId: user[0].agentId,
        gameType,
        roundWaitTimeValue: parentGame.roundWaitTimeValue,
        timerCountdownValue: parentGame.timerCountdownValue,
        roundBetsLimit: parentGame.roundBetsLimit,
        rtp: parentGame.rtp,
      });
    }
  }

  const data = { game, gameConfig };

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
