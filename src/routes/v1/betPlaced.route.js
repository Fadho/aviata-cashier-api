const express = require('express');
const validate = require('../../middlewares/validate');
const { betPlacedValidation } = require('../../validations');
const { betPlacedController } = require('../../controllers');

const router = express.Router();

router
  .route('/')
  .post(validate(betPlacedValidation.createBetPlaced), betPlacedController.createBetPlaced)
  .get(validate(betPlacedValidation.fetchBetPlaced), betPlacedController.fetchBetPlaced);
router.route('/:betPlacedId').get(validate(betPlacedValidation.getBetPlacedById), betPlacedController.getBetPlacedById);

module.exports = router;
