const allRoles = {
  user: [],
  super: [
    'getUsers',
    'manageUsers',
    'updateCashier',
    'addCashier',
    'updateGame',
    'createGameConfig',
    'getGameConfig',
    'manageGameConfig',
  ],
  admin: [
    'getUsers',
    'manageUsers',
    'updateCashier',
    'addCashier',
    'updateGame',
    'createGameConfig',
    'getGameConfig',
    'manageGameConfig',
  ],
  cashier: ['placeBet', 'fetchBets', 'getUser'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
