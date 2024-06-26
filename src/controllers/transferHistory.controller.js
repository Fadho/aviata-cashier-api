// const httpStatus = require('http-status');
const pick = require('../utils/pick');
// const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { transferHistoryService } = require('../services');

const gettransferHistory = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['target', 'currency', 'agent', 'transactionType']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await transferHistoryService.queryTransferHistorys(filter, options);
  res.send(result);
});

module.exports = {
  gettransferHistory,
};
