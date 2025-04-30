const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { walletService, currencyService, userService, transferHistoryService } = require('../services');

const fundWallet = catchAsync(async (req, res) => {
  // destructuring parameters
  // eslint-disable-next-line prefer-const
  let { amount, currencyId, userId, gameType } = req.body;
  amount = Number(amount);

  if (!Number(amount)) throw new ApiError(httpStatus.NOT_FOUND, 'Provide valid amount e.g 500 or -500');

  // in case of credit, we are debitting the agent
  if (!(req.user.role === 'super') && amount > 0) {
    const agent = await userService.getUserById(req.user.id);
    if (!agent) throw new ApiError(httpStatus.NOT_FOUND, 'Agent does not exist');

    let wallet = await walletService.findWallet(currencyId, agent.id);

    if (!wallet.length) {
      wallet = await walletService.findWallet(currencyId, agent.id, false);
    }

    if (!wallet.length) throw new ApiError(httpStatus.NOT_FOUND, 'Agent wallet does not exist');

    const currency = await currencyService.getCurrencyById(currencyId);

    let newBalance = Number(wallet[0].balance);
    newBalance -= amount;
    if (newBalance < 0) throw new ApiError(httpStatus.NOT_FOUND, 'Insufficient funds!');
    // if all tests pass, update wallet
    await walletService.updateWallet(wallet[0].id, Number(newBalance.toFixed(currency.decimals)));
  }

  //  if no currencyId is provided, get user's primary wallet.
  if (!currencyId) {
    const isUser = await userService.getUserById(userId);
    if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

    const iswallet = await walletService.findWallet('', isUser.id, true);

    if (!iswallet.length) throw new ApiError(httpStatus.NOT_FOUND, 'Primary wallet does not exist');

    let newBalance = Number(iswallet[0].balance);
    newBalance += amount;
    // if all tests pass, create wallet
    const wallet = await walletService.updateWallet(iswallet[0].id, newBalance);

    transferHistoryService.createTransferHistory({
      agent: req.user.id,
      target: userId,
      transactionType: `${amount < 0 ? 'from' : 'to'} ${isUser.role}`,
      currency: currencyId,
      gameType,
      deposit: amount < 0 ? 0 : amount,
      withdrawal: amount < 0 ? amount * 1 : 0,
    });

    return res.status(httpStatus.CREATED).send(wallet);
  }

  const [isCurrency, isUser] = await Promise.all([
    currencyService.getCurrencyById(currencyId),
    userService.getUserById(userId),
  ]);

  if (!isCurrency) throw new ApiError(httpStatus.NOT_FOUND, 'Currency does not exist');

  if (!isUser) throw new ApiError(httpStatus.NOT_FOUND, 'User does not exist');

  const iswallet = await walletService.findWallet(currencyId, isUser.id);

  // If user wallet doesnot exist create new wallet.
  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(currencyId, isUser.id, Number(amount));
    transferHistoryService.createTransferHistory({
      agent: req.user.id,
      target: userId,
      transactionType: `${amount < 0 ? 'from' : 'to'} ${isUser.role}`,
      currency: currencyId,
      gameType,
      deposit: amount < 0 ? 0 : amount,
      withdrawal: amount < 0 ? amount * 1 : 0,
    });

    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }

  let newBalance = Number(iswallet[0].balance);
  newBalance += amount;

  if (newBalance < 0) throw new ApiError(httpStatus.NOT_FOUND, 'Insufficient funds!');

  // in case of of debit we fund super agent
  // update: we find and credit logged in user
  if (Number(amount) < 0) {
    let wallet = await walletService.findWallet(iswallet[0].currencyId, req.user.id, false);

    if (!wallet) wallet = await walletService.findWallet(iswallet[0].currencyId, req.user.id, true);

    if (!wallet) throw new ApiError(httpStatus.NOT_FOUND, 'Agent wallet not found!');

    if (wallet.length === 0) {
      await walletService.createWallet(iswallet[0].currencyId, req.user.id, Number(amount) * -1);
    }

    const agentBalance = Number(wallet[0].balance) + Number(amount) * -1;

    walletService.updateWallet(wallet[0].id, agentBalance);
  }

  // if all tests pass, create wallet
  const wallet = await walletService.updateWallet(iswallet[0].id, newBalance);

  transferHistoryService.createTransferHistory({
    agent: req.user.id,
    target: userId,
    transactionType: `${amount < 0 ? 'from' : 'to'} ${isUser.role}`,
    currency: currencyId,
    gameType,
    deposit: amount < 0 ? 0 : amount,
    withdrawal: amount < 0 ? amount * 1 : 0,
  });

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

  const isFromwallet = await walletService.findWallet(fromCurrencyId, userId);

  if (!isFromwallet) throw new ApiError(httpStatus.NOT_FOUND, 'from_currency_wallet does not exist');

  let fromWalletBalance = isFromwallet[0].balance;

  fromWalletBalance -= Number(amount);

  if (fromWalletBalance < 0) throw new ApiError(httpStatus.NOT_FOUND, 'insufficient funds');

  await walletService.updateWallet(isFromwallet[0].id, Number(fromWalletBalance).toFixed(isFromCurrency.decimals));

  const newAmount = (Number(amount) * (Number(isToCurrency.exchangeRate) / Number(isFromCurrency.exchangeRate))).toFixed(
    isToCurrency.decimals
  );

  const iswallet = await walletService.findWallet(toCurrencyId, isUser.id);

  if (!iswallet.length) {
    const fundUserWallet = await walletService.createWallet(toCurrencyId, userId, newAmount);
    return res.status(httpStatus.CREATED).send(fundUserWallet);
  }

  let { balance } = iswallet[0];
  balance += newAmount;

  const fundUserWallet = await walletService.updateWallet(iswallet[0].id, Number(balance));
  return res.status(httpStatus.CREATED).send(fundUserWallet);
});

const createWallet = catchAsync(async (req, res) => {
  const wallet = walletService.createWallet(req.body.currencyId, req.body.userId, req.body.balance);
  return res.status(httpStatus.CREATED).send(wallet);
});

module.exports = { convertWallet, fundWallet, createWallet };
