const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { partnerService, tokenService } = require('../services');
const config = require('../config/config');

const loginUserWithToken = catchAsync(async (req, res) => {
  const { username, currency, balance } = req.body;
  const { thirdPartyId } = req.user.id;
  const user = await partnerService.loginUserWithToken(username, currency, thirdPartyId);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

const thirdPartyCashierDetails = catchAsync(async (req, res) => {
  const { cashier } = req.user;
  const { username } = req.body;
  const cashierDetails = await partnerService.getThirdPartyCashierDetails(cashier.superAgentId, username);
  res.send(cashierDetails);
});

const launchGame = catchAsync(async (req, res) => {
  const { partner_cashier_username, wallet } = req.body;
  const cashier = await partnerService.launchGame(req.user, partner_cashier_username, wallet);
  const tokens = await tokenService.generateAuthTokens(cashier);
  const url = `${config.gameLauncherUrl}?token=${tokens.access.token}`;
  res.status(httpStatus.OK).send({ token: tokens.access.token, url });
});

module.exports = {
  loginUserWithToken,
  thirdPartyCashierDetails,
  launchGame,
};
