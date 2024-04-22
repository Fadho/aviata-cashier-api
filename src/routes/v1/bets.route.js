const express = require('express');
const validate = require('../../middlewares/validate');
const { betsValidation } = require('../../validations');
const { betsController } = require('../../controllers');

const router = express.Router();

router
  .route('/')
  .post(validate(betsValidation.createBetPlaced), betsController.createBetPlaced)
  .get(validate(betsValidation.fetchBetPlaced), betsController.fetchBetPlaced);
router.route('/id/:betPlacedId').get(validate(betsValidation.getBetPlacedById), betsController.getBetPlacedById);
router.route('/history').get(validate(betsValidation.getBetHistory), betsController.getBetHistory);
router.route('/ticket-reports').get(validate(betsValidation.getAccountingReports), betsController.getAccountingReports);
router.route('/gaming-activity').get(validate(betsValidation.getBetHistory), betsController.getGamingActivity);

module.exports = router;
