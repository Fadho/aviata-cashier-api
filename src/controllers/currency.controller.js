const httpStatus = require('http-status');
const pick = require('../utils/pick');
// const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { currencyService } = require('../services');

const createCurrency = catchAsync(async (req, res) => {
  const currency = await currencyService.createCurrency(req.body);
  res.status(httpStatus.CREATED).send(currency);
});

const getCurrencies = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['countryId']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await currencyService.queryCurrencies(filter, options);
  res.send(result);
});

const updateCurrency = catchAsync(async (req, res) => {
  const currency = await currencyService.updateCurrencyById(req.params.id, req.body);
  res.send(currency);
});

const deleteCurrency = catchAsync(async (req, res) => {
  await currencyService.deleteCurrencyById(req.params.currencyId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createCurrency,
  getCurrencies,
  //   getCurrency,
  updateCurrency,
  deleteCurrency,
};
