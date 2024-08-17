const httpStatus = require('http-status');
// const pick = require('../utils/pick');
// const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { roundsService } = require('../services');

const startGame = catchAsync(async (req, res) => {
  try {
    const { superAgentId, gameType } = req.body;
    const round = await roundsService.startGame(superAgentId, gameType);
    res.status(httpStatus.CREATED).send(round);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

const closeGameRound = catchAsync(async (req, res) => {
  try {
    const { superAgentId, roundId, odd } = req.body;
    const round = await roundsService.closeGame(superAgentId, roundId, odd);
    res.status(httpStatus.CREATED).send(round);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

module.exports = {
  startGame,
  closeGameRound,
};
