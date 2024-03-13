const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { cashierService } = require('../services');

const createCashier = catchAsync(async (req, res) => {
  const { name, email, password, shopId } = req.body;
  const cashier = await cashierService.createCashier(name, email, password, shopId);
  res.status(httpStatus.CREATED).send({ cashier });
});

module.exports = { createCashier };
