// const httpStatus = require('http-status');
const pick = require('../utils/pick');
// const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { transferHistoryService, jackpotService } = require('../services');

const gettransferHistory = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['target', 'currency', 'agent', 'transactionType', 'gameType']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate', 'startDate', 'endDate']);
  const result = await transferHistoryService.queryTransferHistorys(filter, options);
  const { agent, gameType } = filter;
  const { startDate, endDate } = options;
  const jackpotWinners = await jackpotService.getUpdatedJackpotHistory({ cashierId: agent, gameType }, startDate, endDate);
  res.send({ result, jackpotWinners });
});

module.exports = {
  gettransferHistory,
};
