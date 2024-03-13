const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { betPlacedService } = require('../services');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, stake, winnings, selections, cashierId } = req.body;
  const betPlaced = await betPlacedService.createBetPlaced(result, stake, winnings, selections, cashierId);
  res.status(httpStatus.CREATED).send({ betPlaced });
});
const fetchBetPlaced = catchAsync(async (req, res) => {
  const betPlaced = await betPlacedService.fetchBetPlaced();
  res.status(httpStatus.CREATED).send({ betPlaced });
});
const getBetPlacedById = catchAsync(async (req, res) => {
  const id = req.params.betPlacedId;
  const betPlaced = await betPlacedService.getBetPlacedById(id);
  if (!betPlaced) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
  }
  res.status(httpStatus.CREATED).send({ betPlaced });
});

module.exports = { createBetPlaced, fetchBetPlaced, getBetPlacedById };
