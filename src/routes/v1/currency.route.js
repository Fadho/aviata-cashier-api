const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { currencyValidation } = require('../../validations');
const currencyController = require('../../controllers/currency.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('createCurrency'), validate(currencyValidation.createCurrency), currencyController.createCurrency)
  .get(auth('getCurrencies'), currencyController.getCurrencies);

router
  .route('/:id')
  .delete(auth('manageCurrency'), validate(currencyValidation.deleteCurrency), currencyController.deleteCurrency)
  .patch(auth('manageCurrency'), validate(currencyValidation.updateCurrency), currencyController.updateCurrency);

module.exports = router;
