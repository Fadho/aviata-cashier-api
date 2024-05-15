const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { walletValidation } = require('../../validations');
const walletController = require('../../controllers/wallet.controller');

const router = express.Router();

router.route('/').post(auth('fundWallet'), validate(walletValidation.convertWallet), walletController.convertWallet);
router.route('/fund').post(auth('convertWallet'), validate(walletValidation.fundWallet), walletController.fundWallet);
router.route('/create').post(auth(), walletController.createWallet);

module.exports = router;
