const httpStatus = require('http-status');
const pick = require('../utils/pick');
const catchAsync = require('../utils/catchAsync');
const { feedbackService } = require('../services');

const getFeedback = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['related', 'agentId', 'cashierId', 'gameType']);
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate', 'startDate', 'endDate']);
  const { startDate, endDate } = options;
  const result = await feedbackService.queryFeedbacks(filter, options, startDate, endDate);
  res.send({ result });
});

const createFeedback = catchAsync(async (req, res) => {
  const currency = await feedbackService.createFeedback(req.body);
  res.status(httpStatus.CREATED).send(currency);
});

module.exports = {
  getFeedback,
  createFeedback,
};
