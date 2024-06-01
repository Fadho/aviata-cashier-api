const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { walletService, currencyService, userService } = require('../services');

const fundWallet = catchAsync(async (req, res) => {
  // destructuring parameters
  // eslint-disable-next-line prefer-const
  let { amount, currencyId, userId } = req.body;
  amount = parseFloat(amount);

  if (!Number(amount)) throw new ApiError(httpStatus.NOT_FOUND, 'Provide valid amount e.g 500 or -500');

  if (!currencyId) {
    const isUser = await userService.getUserById(userId);
    if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

    const iswallet = await walletService.findWallet('', isUser.id, true);

    if (!iswallet.length) throw new ApiError(httpStatus.NOT_FOUND, 'Primary wallet does not exist');

    let newBalance = parseFloat(iswallet[0].balance);
    newBalance += amount;
    // if all tests pass, create wallet
    const wallet = await walletService.updateWallet(iswallet[0].id, newBalance);
    return res.status(httpStatus.CREATED).send(wallet);
  }
  // Checking to make sure agent_id and currency_id is linked to a row in agent and a currency tables respectively
  const [isCurrency, isUser] = await Promise.all([
    currencyService.getCurrencyById(currencyId),
    userService.getUserById(userId),
  ]);

  if (!isCurrency) throw new ApiError(httpStatus.NOT_FOUND, 'Currency does not exist');

  if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

  const iswallet = await walletService.findWallet(currencyId, isUser.id);

  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(currencyId, isUser.id, Number(amount));

    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }

  let newBalance = parseFloat(iswallet[0].balance);
  newBalance += amount;

  // if all tests pass, create wallet
  const wallet = await walletService.updateWallet(iswallet[0].id, newBalance);

  return res.status(httpStatus.CREATED).send(wallet);
});

const convertWallet = catchAsync(async (req, res) => {
  const { fromCurrencyId, toCurrencyId, amount, userId } = req.body;

  const [isFromCurrency, isToCurrency, isUser] = await Promise.all([
    currencyService.getCurrencyById(fromCurrencyId),
    currencyService.getCurrencyById(toCurrencyId),
    userService.getUserById(userId),
  ]);
  if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

  if (!isFromCurrency) throw new ApiError(httpStatus.NOT_FOUND, 'from_currency_id does not exist');

  if (!isToCurrency) throw new ApiError(httpStatus.NOT_FOUND, 'to_currency_id does not exist');

  const newAmount = (parseFloat(amount) / parseFloat(isFromCurrency.exchangeRate)) * parseFloat(isToCurrency.exchangeRate);
  console.log(newAmount, amount);
  const iswallet = await walletService.findWallet(toCurrencyId, isUser.id);
  let { balance } = iswallet[0];

  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(toCurrencyId, userId, amount);
    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }
  balance += newAmount;

  const fundUserWallet = await walletService.updateWallet(iswallet[0].id, Number(balance));
  return res.status(httpStatus.CREATED).send(fundUserWallet);
});

const createWallet = catchAsync(async (req, res) => {
  const wallet = walletService.createWallet(req.body.currencyId, req.body.userId, req.body.balance);
  return res.status(httpStatus.CREATED).send(wallet);
});

module.exports = { convertWallet, fundWallet, createWallet };
