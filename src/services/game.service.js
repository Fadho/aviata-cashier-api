const httpStatus = require('http-status');
const userService = require('./user.service');
const ApiError = require('../utils/ApiError');

/**
 * Authenticate Game
 * @returns {Promise<User>}
 */
const authenticateGsme = async () => {
  const user = await userService.getLastAdminLogin();
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
  }
  return user;
};

module.exports = {
  authenticateGsme,
};
