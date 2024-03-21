const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { selectionService } = require('../services');

const createSelection = catchAsync(async (req, res) => {
  const { odd, stake, potentialWinnings } = req.body;
  const selection = await selectionService.createSelection(odd, stake, potentialWinnings);
  res.status(httpStatus.CREATED).send({ selection });
});

module.exports = { createSelection };
