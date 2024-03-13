const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { shopService } = require('../services');

const createShop = catchAsync(async (req, res) => {
  const { name, email, phone } = req.body;
  const shop = await shopService.createShop(name, email, phone);
  res.status(httpStatus.CREATED).send({ shop });
});

module.exports = { createShop };
