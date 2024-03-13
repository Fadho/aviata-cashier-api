const express = require('express');
const authRoute = require('./auth.route');
const betPlacedRoute = require('./betPlaced.route');
const shopRoute = require('./shop.route');
const selectionRoute = require('./selection.route');
const cashierRoute = require('./cashier.route');
// const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/place-bet',
    route: betPlacedRoute,
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
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
