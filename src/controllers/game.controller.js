const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { gameService, tokenService } = require('../services');
const { Jackpot } = require('../models');

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
  const data = await gameService.getGameSettings();
  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Game not found');
  }
  res.status(httpStatus.OK).send(data);
});

const updateGameConfig = catchAsync(async (req, res) => {
  const user = await gameService.updateGameConfig(req.params.agentId, req.params.gameType, req.body);
  res.send(user);
});

const updateGameData = catchAsync(async (req, res) => {
  const user = await gameService.updateGameData(req.params.agentId, req.params.gameType, req.body);
  res.send(user);
});

const getAgentJackpots = catchAsync(async (req, res) => {
  const { agentId, gameType } = req.body;
  const jackpot = await Jackpot.find({ agentId, gameType });
  res.send(jackpot);
});

const updateAgentJackpot = catchAsync(async (req, res) => {
  const jackpot = await Jackpot.findByIdAndUpdate(req.body.jackpotId, { ...req.body });
  res.send(jackpot);
});

module.exports = {
  createGameConfig,
  getGame,
  updateGameConfig,
  updateGameData,
  authenticateGame,
  createGameData,
  getGameData,
  getGameSettings,
  getAgentJackpots,
  updateAgentJackpot,
};
