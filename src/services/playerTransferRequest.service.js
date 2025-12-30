const httpStatus = require('http-status');
const { PlayerTransferRequest, Player, TransferHistory } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a transfer request
 * @param {Object} requestBody
 * @returns {Promise<PlayerTransferRequest>}
 */
const createTransferRequest = async (requestBody) => {
  const { playerId, deviceId, requestType, amount, gameType } = requestBody;

  // Generate unique 6 digit code for the transaction, only numbers
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Validate player exists
  const player = await Player.findOne({ _id: playerId, deviceId });
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }

  // For withdrawals, check if player has sufficient balance
  if (requestType === 'withdrawal') {
    const totalBalance = Number(player.wallet);
    // update player balance
    await Player.findByIdAndUpdate(playerId, { wallet: totalBalance - amount, bonus: player.bonus });
    if (totalBalance < amount) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient balance');
    }
  }

  // Generate unique transaction code
  // const code = `TR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  const transferRequest = await PlayerTransferRequest.create({
    playerId,
    deviceId,
    requestType,
    amount,
    code,
    gameType,
    status: 'pending',
  });

  return transferRequest;
};

/**
 * Query transfer requests
 * @param {Object} filter
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const queryTransferRequests = async (filter, options) => {
  const transferRequests = await PlayerTransferRequest.paginate(filter, options);
  return transferRequests;
};

/**
 * Get transfer request by id
 * @param {ObjectId} id
 * @returns {Promise<PlayerTransferRequest>}
 */
const getTransferRequestById = async (id) => {
  const transferRequest = await PlayerTransferRequest.findById(id)
    .populate('playerId', 'playerId username deviceId wallet bonus')
    .populate('currencyId', 'country')
    .populate('approvedBy', 'username email');
  return transferRequest;
};

/**
 * Get transfer request by code
 * @param {string} code
 * @returns {Promise<PlayerTransferRequest>}
 */
const getTransferRequestByCode = async (code) => {
  const transferRequest = await PlayerTransferRequest.findOne({ code })
    .populate('playerId', 'playerId username deviceId wallet bonus')
    .populate('currencyId', 'country')
    .populate('approvedBy', 'username email');
  return transferRequest;
};

/**
 * Approve transfer request
 * @param {ObjectId} requestId
 * @param {ObjectId} approvedBy
 * @param {string} notes
 * @returns {Promise<PlayerTransferRequest>}
 */
const approveTransferRequest = async (requestId, approvedBy, notes = '') => {
  const transferRequest = await getTransferRequestById(requestId);

  if (!transferRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer request not found');
  }

  if (transferRequest.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Transfer request is not pending');
  }

  const player = await Player.findById(transferRequest.playerId);
  if (!player) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Player not found');
  }

  // if withdrawal, check player balance again
  if (transferRequest.requestType === 'withdrawal') {
    const totalBalance = Number(player.wallet);
    if (totalBalance < transferRequest.amount) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Insufficient balance');
    }
  }

  // if deposit, update player balance
  if (transferRequest.requestType === 'deposit') {
    const newBalance = Number(player.wallet) + Number(transferRequest.amount);
    await Player.findByIdAndUpdate(transferRequest.playerId, { wallet: newBalance });
  }

  // record transferHistory
  const transferHistory = await TransferHistory.create({
    agent: approvedBy,
    transactionType: transferRequest.requestType,
    superAgentId: player.superAgentId,
    playerId: transferRequest.playerId,
    deviceId: transferRequest.deviceId,
    amount: transferRequest.amount,
    currencyId: transferRequest.currencyId,
    gameType: transferRequest.gameType || '-',
  });

  transferRequest.transactionId = transferHistory._id;

  transferRequest.status = 'approved';
  transferRequest.approvedBy = approvedBy;
  transferRequest.approvedAt = new Date();
  if (notes) {
    transferRequest.notes = notes;
  }

  await transferRequest.save();
  return transferRequest;
};

/**
 * Reject transfer request
 * @param {ObjectId} requestId
 * @param {ObjectId} rejectedBy
 * @param {string} reason
 * @returns {Promise<PlayerTransferRequest>}
 */
const rejectTransferRequest = async (requestId, rejectedBy, reason) => {
  const transferRequest = await getTransferRequestById(requestId);

  if (!transferRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer request not found');
  }

  if (transferRequest.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Transfer request is not pending');
  }

  transferRequest.status = 'rejected';
  transferRequest.approvedBy = rejectedBy;
  transferRequest.approvedAt = new Date();
  transferRequest.rejectionReason = reason;

  await transferRequest.save();
  return transferRequest;
};

/**
 * Cancel transfer request
 * @param {ObjectId} requestId
 * @param {ObjectId} playerId
 * @returns {Promise<PlayerTransferRequest>}
 */
const cancelTransferRequest = async (requestId, playerId) => {
  const transferRequest = await getTransferRequestById(requestId);

  if (!transferRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer request not found');
  }

  if (transferRequest.playerId.toString() !== playerId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to cancel this request');
  }

  if (transferRequest.status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Can only cancel pending requests');
  }

  transferRequest.status = 'cancelled';
  await transferRequest.save();
  return transferRequest;
};

/**
 * Get player transfer requests
 * @param {ObjectId} playerId
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
const getPlayerTransferRequests = async (playerId, options = {}) => {
  const filter = { playerId };
  const transferRequests = await PlayerTransferRequest.paginate(filter, options);
  return transferRequests;
};

module.exports = {
  createTransferRequest,
  queryTransferRequests,
  getTransferRequestById,
  getTransferRequestByCode,
  approveTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,
  getPlayerTransferRequests,
};
