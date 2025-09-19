const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { partnerService} = require('../services');

const loginUserWithToken = catchAsync(async (req, res) => {
  const { username, currency, balance } = req.body;
  const { thirdPartyId } = req.user.id;
  const user = await partnerService.loginUserWithToken(username, currency, thirdPartyId);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
}); 

const thirdPartyCashierDetails = catchAsync(async (req, res) => {
  const { cashier } = req.user;
  const { username} = req.body;
  const cashierDetails = await partnerService.getThirdPartyCashierDetails(cashier.superAgentId, username);
  res.send(cashierDetails);
});

module.exports = {
  loginUserWithToken,
  thirdPartyCashierDetails
};