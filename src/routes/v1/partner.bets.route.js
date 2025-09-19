const express = require('express');
const {auth, apiKeyAuth} = require('../../middlewares/auth');

const validate = require('../../middlewares/validate');
const partnerValidation = require('../../validations/partner.validation');
const partnerController = require('../../controllers/partner.controller');
const { betsValidation } = require('../../validations');
const { partnerBetsController } = require('../../controllers');

const router = express.Router();

// we only use apiKeyAuth middleware for partner routes
// all routes here require a valid api key to access
// this ensure that when apiKey is replaced all routes are protected
// however just passing apiKey is on every request is not very secure
// we can enhance this by adding HMAC or JWT token signed with apiKey secret
// to ensure that the request is indeed from the partner and not a replay attack
// for now we keep it simple
router
  .route('/')
  .post(apiKeyAuth(), validate(betsValidation.createBetPlaced), partnerBetsController.createBetPlacedForThirdParty)
  // .get(apiKeyAuth(), validate(betsValidation.fetchBetPlaced), partnerBetsController.fetchBetPlaced);

router.route('/player').post(validate(betsValidation.createBetPlacedPlayer), partnerBetsController.createBetPlacedForThirdPartyPlayer);

router.route('/player/cashout').post(validate(betsValidation.cashoutPlayerTicket), partnerBetsController.cashoutPlayerBet);

router.route('/cancel/:id').get(apiKeyAuth(), validate(betsValidation.cancelTicket), partnerBetsController.cancelTicket);

router.route('/cashier-reports').get(apiKeyAuth(), validate(betsValidation.getAccountingReports), partnerBetsController.cashierReport);

module.exports = router;
