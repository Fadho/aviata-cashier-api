const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { gameService, tokenService, jackpotService } = require('../services');
const { Jackpot, User } = require('../models');

const authenticateGame = catchAsync(async (req, res) => {
  const user = await gameService.authenticateGame(req.params.id);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

const createGameConfig = catchAsync(async (req, res) => {
  const data = await gameService.createGameConfig(req.body);
  res.status(httpStatus.CREATED).send(data);
});

const createGameData = catchAsync(async (req, res) => {
  const data = await gameService.createGameData(req.body);
  res.status(httpStatus.CREATED).send(data);
});

const getGame = catchAsync(async (req, res) => {
  const { agentId, gameType } = req.params;
  const data = await gameService.getGameConfig({ agentId, gameType });
  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Game not found');
  }
  res.status(httpStatus.OK).send(data);
});

const getGameData = catchAsync(async (req, res) => {
  const { agentId, gameType } = req.params;
  const data = await gameService.getGameData(agentId, gameType);
  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Game not found');
  }
  res.status(httpStatus.OK).send(data);
});

const getGameSettings = catchAsync(async (req, res) => {
  const data = await gameService.getGameSettings(req.user.agentId);
  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Game not found');
  }
  res.status(httpStatus.OK).send(data);
});

const updateGameConfig = catchAsync(async (req, res) => {
  let isSuper = false;
  const user = await User.findOne({ _id: req.params.agentId }).select('role');
  if (user.role === 'admin' && !user.agentId) isSuper = true;
  const game = await gameService.updateGameConfig(req.params.agentId, req.params.gameType, req.body, isSuper);
  res.send(game);
});

const updateGameData = catchAsync(async (req, res) => {
  let isSuper = false;
  const user = await User.findOne({ _id: req.params.agentId }).select('role');
  if (user.role === 'admin' && !user.agentId) isSuper = true;
  const game = await gameService.updateGameData(req.params.agentId, req.params.gameType, req.body, isSuper);
  res.send(game);
});

const getAgentJackpots = catchAsync(async (req, res) => {
  const { agentId, gameType } = req.body;
  const jackpot = await jackpotService.getAgentJackpots(agentId, gameType);
  // rearrange list to have bronze first, silver, then gold.

  const order = ['Bronze', 'Silver', 'Gold'];

  const sortedGames = jackpot.sort((a, b) => {
    return order.indexOf(a.jackpotName) - order.indexOf(b.jackpotName);
  });
  res.send(sortedGames);
});

const updateAgentJackpot = catchAsync(async (req, res) => {
  const { jackpotId } = req.body;
  delete req.body.jackpotId;
  let isSuper = false;
  const jackpot = await Jackpot.findOneAndUpdate({ _id: jackpotId }, req.body, { new: true });
  const userCheck = await User.findOne({ _id: jackpot.agentId }).select('role');
  if (userCheck.role === 'admin' && !userCheck.agentId) isSuper = true;
  const subAgentIds = isSuper
    ? await User.find({ superAgentId: jackpot.agentId, role: 'admin' }).select('_id')
    : await User.find({ agentId: jackpot.agentId, role: 'admin' }).select('_id');
  if (subAgentIds)
    subAgentIds.forEach(async (el) => {
      await Jackpot.findOneAndUpdate({ agentId: el._id, jackpotName: jackpot.jackpotName }, req.body, { new: true });
    });
  res.send(jackpot);
});

const dropJackpot = catchAsync(async (req, res) => {
  const { jackpotId, deviceId, playerId, jackpotAmount } = req.body;
  const jackpot = await jackpotService.dropJackpot(jackpotId, deviceId, playerId, jackpotAmount);
  res.send(jackpot);
});

const updateAgentJackpotContribution = catchAsync(async (req, res) => {
  const {
    bronzeJackpotId,
    bronzeContributions,
    silverJackpotId,
    silverContributions,
    goldJackpotId,
    goldContributions,
    deviceId,
    gameType,
  } = req.body;

  const jackpot = await jackpotService.updateJackpotContributions(
    bronzeJackpotId,
    bronzeContributions,
    silverJackpotId,
    silverContributions,
    goldJackpotId,
    goldContributions,
    deviceId,
    gameType
  );
  res.send(jackpot);
});

const getAgentJackpotContribution = catchAsync(async (req, res) => {
  const { deviceId, gameType } = req.body;

  const jackpot = await jackpotService.getAgentJackpotContributions(deviceId, gameType);
  res.send(jackpot);
});

module.exports = {
  createGameConfig,
  getGame,
  dropJackpot,
  updateGameConfig,
  updateGameData,
  authenticateGame,
  createGameData,
  getGameData,
  getGameSettings,
  getAgentJackpots,
  updateAgentJackpot,
  updateAgentJackpotContribution,
  getAgentJackpotContribution,
};
