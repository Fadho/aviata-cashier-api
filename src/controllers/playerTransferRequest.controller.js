const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { playerTransferRequestService } = require('../services');

const createTransferRequest = catchAsync(async (req, res) => {
  const transferRequest = await playerTransferRequestService.createTransferRequest(req.body);
  res.status(httpStatus.CREATED).send(transferRequest);
});

const getTransferRequests = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['playerId', 'requestType', 'status', 'deviceId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const result = await playerTransferRequestService.queryTransferRequests(filter, options);
  res.send(result);
});

const getTransferRequest = catchAsync(async (req, res) => {
  const transferRequest = await playerTransferRequestService.getTransferRequestById(req.params.requestId);
  if (!transferRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer request not found');
  }
  res.send(transferRequest);
});

const getTransferRequestByCode = catchAsync(async (req, res) => {
  const transferRequest = await playerTransferRequestService.getTransferRequestByCode(req.params.code);
  if (!transferRequest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Transfer request not found');
  }
  res.send(transferRequest);
});

const approveTransferRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const { notes } = req.body;
  const approvedBy = req.user.id; // Assuming auth middleware attaches user

  const transferRequest = await playerTransferRequestService.approveTransferRequest(requestId, approvedBy, notes);
  res.send(transferRequest);
});

const rejectTransferRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body;
  const rejectedBy = req.user.id; // Assuming auth middleware attaches user

  if (!reason) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Rejection reason is required');
  }

  const transferRequest = await playerTransferRequestService.rejectTransferRequest(requestId, rejectedBy, reason);
  res.send(transferRequest);
});

const cancelTransferRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const playerId = req.user.playerId || req.body.playerId; // Assuming auth middleware attaches player

  const transferRequest = await playerTransferRequestService.cancelTransferRequest(requestId, playerId);
  res.send(transferRequest);
});

const getPlayerTransferRequests = catchAsync(async (req, res) => {
  const { playerId } = req.params;
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);

  const result = await playerTransferRequestService.getPlayerTransferRequests(playerId, options);
  res.send(result);
});

const quickFundAndWithdrawalByCode = catchAsync(async (req, res) => {
  const { code } = req.params;
  const cashierId = req.user._id; // Assuming auth middleware attaches user

  const transferRequest = await playerTransferRequestService.quickFundAndWithdrawalByCode(code, cashierId);
  res.send(transferRequest);
});

module.exports = {
  createTransferRequest,
  getTransferRequests,
  getTransferRequest,
  getTransferRequestByCode,
  approveTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,
  getPlayerTransferRequests,
  quickFundAndWithdrawalByCode,
};
