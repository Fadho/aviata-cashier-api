const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { gameService } = require('../services');

const authenticateGame = catchAsync(async (req, res) => {
  const result = await gameService.authenticateGame(req.params.id);
  res.send(result);
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
  const data = await gameService.getGameConfig(req.params.agentId);
  // data = data.data;
  // console.log(req.params.agentId);
  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Game not found');
  }
  res.send(data);
});

const updateGameConfig = catchAsync(async (req, res) => {
  const user = await gameService.updateGameConfig(req.params.agentId, req.body);
  res.send(user);
});

const updateGameData = catchAsync(async (req, res) => {
  const user = await gameService.updateGameData(req.params.agentId, req.body);
  res.send(user);
});

module.exports = {
  createGameConfig,
  getGame,
  updateGameConfig,
  updateGameData,
  authenticateGame,
  createGameData,
};
