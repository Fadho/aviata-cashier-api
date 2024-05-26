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
    'createCurrency',
    'manageCurrency',
    'getCurrencies',
    'fundWallet',
    'convertWallet',
    'ticketReports',
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
    'getCurrencies',
    'fundWallet',
    'convertWallet',
    'ticketReports',
  ],
  cashier: ['placeBet', 'fetchBets'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
