const express = require('express');
const { shopController } = require('../../controllers');
const { shopValidation } = require('../../validations');
const validate = require('../../middlewares/validate');

const router = express.Router();

router.route('/').post(validate(shopValidation.createShop), shopController.createShop);

module.exports = router;
