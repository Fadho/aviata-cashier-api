const express = require('express');
const authRoute = require('./auth.route');
const betsRoute = require('./bets.route');
const selectionRoute = require('./selection.route');
const gameRoute = require('./game.route');
const userRoute = require('./user.route');
const currencyRoute = require('./currency.route');
const walletRoute = require('./wallet.route');
const roundsRoute = require('./rounds.route');
const feedbackRoute = require('./feedback.route');
const partnerRoute = require('./partner.route');
const partnerBetsRoute = require('./partner.bets.route');
const playerRoute = require('./player.route');
const playerTransferRequestRoute = require('./playerTransferRequest.route');

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
  {
    path: '/rounds',
    route: roundsRoute,
  },
  {
    path: '/feedback',
    route: feedbackRoute,
  },
  {
    path: '/partner',
    route: partnerRoute,
  },
  {
    path: '/partner-bets',
    route: partnerBetsRoute,
  },
  {
    path: '/player',
    route: playerRoute,
  },
  {
    path: '/playerTransferRequests',
    route: playerTransferRequestRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
