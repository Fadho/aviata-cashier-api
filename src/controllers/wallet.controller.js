const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { walletService, currencyService, userService } = require('../services');

const fundWallet = catchAsync(async (req, res) => {
  // destructuring parameters
  const { amount, currencyId, userId } = req.body;
  if (!currencyId) {
    const isUser = await userService.getUserById(userId);
    if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

    const iswallet = await walletService.findWallet('', isUser.id, true);

    if (!iswallet.length) throw new ApiError(httpStatus.NOT_FOUND, 'Primary wallet does not exist');

    // if all tests pass, create wallet
    const wallet = await walletService.updateWallet(iswallet[0].id, Number(iswallet[0].balance) + Number(amount));
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
  // let
  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(currencyId, isUser.id, Number(amount));

    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }
  // if all tests pass, create wallet
  const wallet = await walletService.updateWallet(iswallet[0].id, Number(amount));

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
  const newAmount = (Number(amount) / Number(isFromCurrency.exchangeRate)) * Number(isToCurrency.exchangeRate);
  const iswallet = await walletService.findWallet(toCurrencyId, isUser.id);

  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(toCurrencyId, userId, amount);
    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }
  const fundUserWallet = await walletService.updateWallet(iswallet[0].id, Number(iswallet[0].balance) + Number(newAmount));
  return res.status(httpStatus.CREATED).send(fundUserWallet);
});

module.exports = { convertWallet, fundWallet };
