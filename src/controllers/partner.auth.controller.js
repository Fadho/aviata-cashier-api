const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { partnerService} = require('../services');

const loginUserWithToken = catchAsync(async (req, res) => {
  const { username, currency } = req.body;
  const user = await authService.loginUserWithToken(username, currency);
  res.send(user);
});

module.exports = {
  login,
};