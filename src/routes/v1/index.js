const express = require('express');
const authRoute = require('./auth.route');
const betsRoute = require('./bets.route');
const shopRoute = require('./shop.route');
const selectionRoute = require('./selection.route');
const cashierRoute = require('./cashier.route');
const userRoute = require('./user.route');
// const config = require('../../config/config');

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
    path: '/shop',
    route: shopRoute,
  },
  {
    path: '/selection',
    route: selectionRoute,
  },
  {
    path: '/cashier',
    route: cashierRoute,
  },
  {
    path: '/user',
    route: userRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
