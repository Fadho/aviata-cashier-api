const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { playerService, tokenService, betsService } = require('../services');
const { Tickets } = require('../models');

const getAllPlayers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['username', 'email', 'phone']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const result = await playerService.queryPlayers(filter, options);
  res.send(result);
});

const getPlayer = catchAsync(async (req, res) => {
  const player = await playerService.getPlayerById(req.params.playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }
  res.send(player);
});

const createPlayer = catchAsync(async (req, res) => {
  const player = await playerService.register(req.body);
  res.status(httpStatus.CREATED).send(player);
});

const updatePlayer = catchAsync(async (req, res) => {
  const player = await playerService.updatePlayerById(req.params.playerId, req.body);
  res.send(player);
});

const deletePlayer = catchAsync(async (req, res) => {
  await playerService.deletePlayerById(req.params.playerId);
  res.status(httpStatus.NO_CONTENT).send();
});

const playerLogin = catchAsync(async (req, res) => {
  const player = await playerService.loginUserWithEmailAndPassword(req.body.email, req.body.password);
  const tokens = await tokenService.generateAuthTokens(player);
  res.send({ player, tokens });
});

const playerRegister = catchAsync(async (req, res) => {
  const player = await playerService.register(req.body);
  res.status(httpStatus.CREATED).send(player);
});

const joinShop = catchAsync(async (req, res) => {
  const { playerId, shopCode } = req.body;
  const result = await playerService.joinShop(playerId, shopCode);
  res.send(result);
});

const deposit = catchAsync(async (req, res) => {
  const { playerId, amount, paymentMethod } = req.body;
  const result = await playerService.deposit(playerId, amount, paymentMethod);
  res.send(result);
});

const withdraw = catchAsync(async (req, res) => {
  const { playerId, amount, otpCode } = req.body;
  const result = await playerService.withdraw(playerId, amount, otpCode);
  res.send(result);
});

const getProfile = catchAsync(async (req, res) => {
  const profile = await playerService.getProfile(req.params.playerId);
  res.send(profile);
});

const updateProfile = catchAsync(async (req, res) => {
  const { playerId } = req.params;
  const updatedProfile = await playerService.updateProfile(playerId, req.body);
  res.send(updatedProfile);
});

const getBetHistory = catchAsync(async (req, res) => {
  const { playerId } = req.params;
  const filter = pick(req.query, ['type', 'status']);
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'populate']);
  // const { limit, offset } = req.query;
  const transactions = await betsService.getBetHistoryByPlayer(playerId, filter, options);
  res.send(transactions);
});

module.exports = {
  getAllPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  playerLogin,
  deposit,
  withdraw,
  getProfile,
  getBetHistory,
  updateProfile,
  playerRegister,
};
