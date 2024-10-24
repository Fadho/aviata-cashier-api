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
    'getJackpot',
    'updateJackpot',
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
    'getJackpot',
    'updateJackpot',
  ],
  cashier: ['placeBet', 'fetchBets'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
