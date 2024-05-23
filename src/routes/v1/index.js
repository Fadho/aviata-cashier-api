const express = require('express');
const authRoute = require('./auth.route');
const betsRoute = require('./bets.route');
const selectionRoute = require('./selection.route');
const gameRoute = require('./game.route');
const userRoute = require('./user.route');
const currencyRoute = require('./currency.route');
const walletRoute = require('./wallet.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/bet',
    route: betsRoute,
  },
  {
    path: '/selection',
    route: selectionRoute,
  },
  {
    path: '/game',
    route: gameRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/currency',
    route: currencyRoute,
  },
  {
    path: '/wallet',
    route: walletRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
