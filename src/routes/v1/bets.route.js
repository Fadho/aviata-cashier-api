const express = require('express');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const { betsValidation } = require('../../validations');
const { betsController } = require('../../controllers');

const router = express.Router();

router
  .route('/')
  .post(validate(auth(), betsValidation.createBetPlaced), betsController.createBetPlaced)
  .get(validate(auth(), betsValidation.fetchBetPlaced), betsController.fetchBetPlaced);

router.route('/fetch/:id').get(auth(), validate(betsValidation.getBetPlacedById), betsController.getBetPlacedById);
router.route('/cancel/:id').get(auth(), validate(betsValidation.cancelTicket), betsController.cancelTicket);
router.route('/history').get(auth(), validate(betsValidation.getBetHistory), betsController.getBetHistory);
router
  .route('/ticket-reports')
  .get(auth('ticketReports'), validate(betsValidation.getAccountingReports), betsController.getAccountingReports);
router
  .route('/cashier-reports')
  .get(auth('cashierReport'), validate(betsValidation.getAccountingReports), betsController.cashierReport);
router
  .route('/gaming-activity')
  .get(auth('gamingActivity'), validate(betsValidation.getBetHistory), betsController.getGamingActivity);

router.route('/cashout').post(validate(betsValidation.cashoutTicket), betsController.cashoutTicket);
router.route('/payout/:id').post(auth(), validate(betsValidation.getBetPlacedById), betsController.payoutTicket);

module.exports = router;
