const httpStatus = require('http-status');
const tokenService = require('./token.service');
const userService = require('./user.service');
const Token = require('../models/token.model');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Login with username and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<User>}
 */
const loginUserWithEmailAndPassword = async (email, password) => {
  const user = await userService.getUserByEmail(email);
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect email or password');
  }
  return user;
};

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({ token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false });
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
  }
  await refreshTokenDoc.remove();
};

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH);
    const user = await userService.getUserById(refreshTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await refreshTokenDoc.remove();
    return tokenService.generateAuthTokens(user);
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const user = await userService.getUserById(resetPasswordTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await userService.updateUserById(user.id, { password: newPassword });
    await Token.deleteMany({ user: user.id, type: tokenTypes.RESET_PASSWORD });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Verify email
 * @param {string} verifyEmailToken
 * @returns {Promise}
 */
const verifyEmail = async (verifyEmailToken) => {
  try {
    const verifyEmailTokenDoc = await tokenService.verifyToken(verifyEmailToken, tokenTypes.VERIFY_EMAIL);
    const user = await userService.getUserById(verifyEmailTokenDoc.user);
    if (!user) {
      throw new Error();
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.VERIFY_EMAIL });
    await userService.updateUserById(user.id, { isEmailVerified: true });
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed');
  }
};

/**
 * token Login with token and userdata
 * @param {string} username
 * @param {string} currency
 * @returns {Promise<User>}
 */
const loginUserWithToken = async (username, currency) => {
  //verify need for currency spontaneity, can they follow current agent structure.
  const user = await userService.getUserById(req.user.id);
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }
  let getCashier = await userService.getUsers({ username, agentId: req.user.id });
  if (!getCashier.length) {
    const userBody = {
      username,
      role: 'cashier',
      agentId: req.user.id,
      password: Math.random().toString(36).slice(-8), // generate a random 8 character password
      currency,
      thirdparty: true,
    };
    getCashier = await userService.createUser(userBody);
  } else {
    getCashier = getCashier[0];
  }
  return user;
};

/**
 * Redirect client
 * @param {Object} user - user object
 * @param {string} url - URL to redirect to
 * @returns {Promise}
 */
const redirectClient = async (user, url) => {
  // Validate user permissions and URL format
  if (user.role !== 'admin' && user.role !== 'cashier') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to perform this action');
  }
  const allowedDomains = ['https://aviatorx.cashier.sbegames.com', 'https://aviata.cashier.sbegames.com'];
  const urlObj = new URL(url);
  if (!allowedDomains.includes(urlObj.origin)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid URL');
  }
  // Log the redirection event
  console.log(`User ${user.id} is being redirected to ${url}`);
  // In a real application, you might return the URL or perform the redirection on the client side
  return;
};

module.exports = {
  loginUserWithEmailAndPassword,
  logout,
  refreshAuth,
  resetPassword,
  verifyEmail,
  loginUserWithToken,
  redirectClient,
};
