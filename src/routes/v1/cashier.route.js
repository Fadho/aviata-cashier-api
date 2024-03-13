const express = require('express');
const validate = require('../../middlewares/validate');
const { cashierValidation } = require('../../validations');
const { cashierController } = require('../../controllers');

const router = express.Router();

router.route('/').post(validate(cashierValidation.createCashier), cashierController.createCashier);

module.exports = router;
