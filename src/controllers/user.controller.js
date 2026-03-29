const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { userService, walletService } = require('../services');

const searchForUser = catchAsync(async (req, res) => {
  try {
    const { username } = req.query;

    if (req.user.role === 'super') {
      const users1 = await userService.queryUsers({ username: { $regex: username.toLowerCase(), $options: 'i' } }, {});
      const users2 = await userService.queryUsers({ name: { $regex: username.toLowerCase(), $options: 'i' } }, {});
      return res.status(httpStatus.OK).send({ ...users1, ...users2 });
    }
    let users = await userService.queryUsers({ agentId: req.user._id, username: { $regex: username } }, {});
    if (!users) {
      users = await userService.queryUsers({ superAgentId: req.user._id, username: { $regex: username } }, {});
    }
    res.status(httpStatus.OK).send(users);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

const createUser = catchAsync(async (req, res) => {
  try {
    let user = await userService.createUser(req.body);
    const wallet = await walletService.createWallet(req.body.currencyId, user.id, req.body.wallet, true);
    user = await userService.getAndUpdateWallet(user.id, wallet.id);
    res.status(httpStatus.CREATED).send(user);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserByUsername(req.user.username);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send(user);
});
const getUsersWhere = catchAsync(async (req, res) => {
  const users = await userService.getUsersWhereClientType(req.query.role);
  const mapperUsers = users.map((userItem) => {
    return {
      name: userItem.name,
      email: userItem.email,
      role: userItem.role,
    };
  });
  res.send(mapperUsers);
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const deleteAgent = catchAsync(async (req, res) => {
  await userService.deleteAgentById(req.params.agentId, req.user);
  res.status(httpStatus.NO_CONTENT).send();
});

const transferAgentTenantship = catchAsync(async (req, res) => {
  const agent = await userService.transferAgentTenantship(req.params.agentId, req.body.newSuperAgentId, req.user);
  res.status(httpStatus.OK).send(agent);
});

module.exports = {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  deleteAgent,
  transferAgentTenantship,
  getUsersWhere,
  searchForUser,
};
