const httpStatus = require('http-status');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const getAndUpdateWallet = async (id, walletId) => {
  const user = await User.findById(id);
  return User.findByIdAndUpdate(
    id,
    {
      wallets: [...user.wallets, walletId],
    },
    { new: true }
  ).populate('wallets');
};
/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  return User.create(userBody);
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Query for get users where
 * @param {string} role - Mongo filter
 * @returns {Promise<User>}
 */
const getUsersWhereClientType = async (role) => {
  const users = await User.find({ role });
  return users;
};
/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id).populate('wallets');
};
/**
 * Get user by username
 * @param {string} username
 * @returns {Promise<User>}
 */
const getUserByUsername = async (username) => {
  return User.findOne({ name: username }).populate('wallets');
};
/**
 * Get user by username
 * @param {string} username
 * @returns {Promise<User>}
 */
const getUserByRole = async (role) => {
  return User.find({ role });
};
/**
 * Get last admin login
 * @returns {Promise<User>}
 */
const getLastAdminLogin = async (userId) => {
  const today = new Date(); // Create a Date object for the current date and time
  today.setHours(0, 0, 0, 0); // Set the time to midnight

  const user = await User.findById(userId);
  if (user.lastlogin > today) {
    return user;
  }
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email }).populate('wallets');
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId).populate('wallets');
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getLastAdminLogin,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  getUsersWhereClientType,
  getUserByUsername,
  getUserByRole,
  getAndUpdateWallet,
};
