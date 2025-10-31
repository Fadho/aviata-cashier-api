const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { playerService } = require('../services');

const getAllPlayers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'email', 'phone']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
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
  const player = await playerService.createAccount(req.body);
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
  const result = await playerService.login(req.body);
  res.send(result);
});

const verifyOTP = catchAsync(async (req, res) => {
  const { playerId, otpCode, purpose } = req.body;
  const result = await playerService.verifyOTP(playerId, otpCode, purpose, req.body.deviceInfo);
  res.send(result);
});

const generateOTP = catchAsync(async (req, res) => {
  const { playerId, purpose } = req.body;
  const result = await playerService.generateOTP(playerId, purpose);
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

const getTransactionHistory = catchAsync(async (req, res) => {
  const { playerId } = req.params;
  const { limit, offset } = req.query;
  const transactions = await playerService.getTransactionHistory(playerId, parseInt(limit), parseInt(offset));
  res.send(transactions);
});

module.exports = {
  getAllPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  playerLogin,
  verifyOTP,
  generateOTP,
  deposit,
  withdraw,
  getProfile,
  getTransactionHistory,
};
