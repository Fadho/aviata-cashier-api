const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { partnerService, tokenService } = require('../services');
const config = require('../config/config');

const loginUserWithToken = catchAsync(async (req, res) => {
  const { username, currency } = req.body;
  const thirdPartyId = req.user.id;
  const user = await partnerService.loginUserWithToken(username, currency, thirdPartyId);
  const access = tokenService.generateAccessToken(user);
  res.send({ user, tokens: { access } });
});

const thirdPartyCashierDetails = catchAsync(async (req, res) => {
  const { username } = req.body;
  // req.user is the authenticated user; use their _id as the thirdParty agent reference
  const cashierDetails = await partnerService.getThirdPartyCashierDetails(req.user._id, username);
  res.send(cashierDetails);
});

const launchGame = catchAsync(async (req, res) => {
  const { partner_cashier_username: partnerCashierUsername, wallet, wallet_version: walletVersion } = req.body;
  const cashier = await partnerService.launchGame(req.user, partnerCashierUsername, wallet, walletVersion);
  const access = tokenService.generateAccessToken(cashier);
  const url = `${config.gameLauncherUrl}?token=${access.token}`;
  res.status(httpStatus.OK).send({ token: access.token, url });
});

module.exports = {
  loginUserWithToken,
  thirdPartyCashierDetails,
  launchGame,
};
