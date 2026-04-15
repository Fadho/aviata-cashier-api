const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { User, Wallets, Player, GameConfig, FinancialReport, GameReport, Token } = require('../models');
const ApiKey = require('../models/apiKey.model');
const PartnerLog = require('../models/partnerLogs.model');
const TransferHistory = require('../models/transferHistory.model');
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

const queryUsersReturnIds = async (filter) => {
  const users = await User.find(filter, { _id: 1, name: 1, currencyId: 1 });
  return users;
};

const getUsers = async (filter, options) => {
  const users = await User.find(filter, options);
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
  return User.findOne({ username }).populate({
    path: 'wallets',
    populate: { path: 'currencyId' },
  });
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
  const user = await getUserById(userId);
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

/**
 * Delete agent and all related data by agent id.
 * Only users with role 'agent' can be deleted via this function.
 * The requesting user must be a super admin OR the direct superAgentId of the agent.
 * @param {ObjectId} agentId - ID of the agent to delete
 * @param {Object} requestingUser - The authenticated user performing the deletion
 * @returns {Promise<void>}
 */
const deleteAgentById = async (agentId, requestingUser) => {
  const agent = await User.findById(agentId);
  if (!agent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Agent not found');
  }
  if (agent.role !== 'admin' || !agent.agentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is not an agent');
  }

  // Authorization: super admins can delete any agent; other roles can only delete agents they own
  const isSuper = requestingUser.role === 'super';
  const isOwner =
    agent.superAgentId && agent.superAgentId.toString() === requestingUser._id.toString();
  if (!isSuper && !isOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to delete this agent');
  }

  // Find all cashiers under this agent
  const cashiers = await User.find({ agentId }, { _id: 1 });
  const cashierIds = cashiers.map((c) => c._id);

  // Delete cashier wallets and tokens
  if (cashierIds.length > 0) {
    await Wallets.deleteMany({ userId: { $in: cashierIds } });
    await Token.deleteMany({ user: { $in: cashierIds } });
    await User.deleteMany({ _id: { $in: cashierIds } });
  }

  // Delete players under this agent
  await Player.deleteMany({ agentId });

  // Delete agent wallets and auth tokens
  await Wallets.deleteMany({ userId: agentId });
  await Token.deleteMany({ user: agentId });

  // Delete agent settings and reports
  await GameConfig.deleteMany({ agentId });
  await FinancialReport.deleteMany({ agentId });
  await GameReport.deleteMany({ agentId });

  // Delete API keys (for third-party/partner agents)
  await ApiKey.deleteMany({ partnerId: agentId });

  // Delete partner logs where agent appears as a partner or as the acting super agent
  await PartnerLog.deleteMany({ $or: [{ partnerId: agentId }, { superAgentId: agentId }] });

  // Delete transfer history involving this agent
  await TransferHistory.deleteMany({ $or: [{ agent: agentId }, { target: agentId }, { superAgentId: agentId }] });

  // Finally delete the agent
  await agent.deleteOne();
};

/**
 * Transfer an agent to a new super agent (tenant).
 * All writes are wrapped in a MongoDB transaction so the operation is atomic.
 * On any failure every change is rolled back automatically.
 *
 * Collections updated:
 *   - User (agent itself)
 *   - User (cashiers belonging to this agent)
 *   - Player (players belonging to this agent)
 *   - FinancialReport
 *   - GameReport
 *   - TransferHistory
 *
 * @param {ObjectId|string} agentId        - The agent being reassigned
 * @param {ObjectId|string} newSuperAgentId - The new owning super agent
 * @param {Object}          requestingUser  - The authenticated user performing the action
 * @returns {Promise<User>} Freshly-fetched, populated agent document
 */
const transferAgentTenantship = async (agentId, newSuperAgentId, requestingUser) => {
  // --- pre-flight checks (outside transaction to avoid unnecessary session overhead) ---

  const agent = await User.findById(agentId);
  if (!agent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Agent not found');
  }
  if (agent.role !== 'admin' || !agent.agentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is not an agent');
  }

  // Prevent assigning an agent as its own super agent
  if (agentId.toString() === newSuperAgentId.toString()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'An agent cannot be its own super agent');
  }

  const newSuperAgent = await User.findById(newSuperAgentId);
  if (!newSuperAgent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'New super agent not found');
  }
  if (!['super', 'admin'].includes(newSuperAgent.role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Target super agent must have role super or admin');
  }

  // Authorization: 'super' role can move any agent; others can only move agents they own
  const isSuper = requestingUser.role === 'super';
  const isCurrentOwner =
    agent.superAgentId && agent.superAgentId.toString() === requestingUser._id.toString();
  if (!isSuper && !isCurrentOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to transfer this agent');
  }

  // Prevent no-op
  if (agent.superAgentId && agent.superAgentId.toString() === newSuperAgentId.toString()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Agent already belongs to this super agent');
  }

  // Require the agent to have an existing superAgentId so cascade filters are safe
  if (!agent.superAgentId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Agent has no current super agent; cannot transfer an orphaned agent');
  }

  const oldSuperAgentId = agent.superAgentId;
  const newSuperAgentObjectId = newSuperAgent._id;

  // --- atomic writes ---
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Update the agent itself
    await User.findByIdAndUpdate(agentId, { $set: { superAgentId: newSuperAgentObjectId } }, { session });

    // 2. Update cashiers that belong to this agent
    await User.updateMany(
      { agentId, superAgentId: oldSuperAgentId },
      { $set: { superAgentId: newSuperAgentObjectId } },
      { session }
    );

    // 3. Update players
    await Player.updateMany(
      { agentId, superAgentId: oldSuperAgentId },
      { $set: { superAgentId: newSuperAgentObjectId } },
      { session }
    );

    // 4. Update financial reports
    await FinancialReport.updateMany(
      { agentId, superAgentId: oldSuperAgentId },
      { $set: { superAgentId: newSuperAgentObjectId } },
      { session }
    );

    // 5. Update game reports
    await GameReport.updateMany(
      { agentId, superAgentId: oldSuperAgentId },
      { $set: { superAgentId: newSuperAgentObjectId } },
      { session }
    );

    // 6. Update transfer history entries originating from this agent
    await TransferHistory.updateMany(
      { agent: agentId, superAgentId: oldSuperAgentId },
      { $set: { superAgentId: newSuperAgentObjectId } },
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  // Return a fresh, populated document reflecting the committed state
  return getUserById(agentId);
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getLastAdminLogin,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  deleteAgentById,
  transferAgentTenantship,
  getUsersWhereClientType,
  getUserByUsername,
  getUserByRole,
  getAndUpdateWallet,
  getUsers,
  queryUsersReturnIds,
};
