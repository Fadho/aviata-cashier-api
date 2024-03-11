const allRoles = {
  user: [],
  admin: ['getUsers', 'manageUsers', 'updateCashier', 'addCashier', 'updateGame'],
  cashier: ['placeBet', 'fetchBets'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
