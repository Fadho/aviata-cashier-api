const express = require('express');
const { auth, apiKeyAuth } = require('../../middlewares/auth');

const validate = require('../../middlewares/validate');
const partnerValidation = require('../../validations/partner.validation');
const partnerController = require('../../controllers/partner.controller');
const partnerBetsController = require('../../controllers/partner.bets.controller');
const partnerAuthController = require('../../controllers/partner.auth.controller');

const router = express.Router();

router.route('/').post(auth(), partnerController.createApiKey);

router.route('/listPartnerKeys').get(auth(), partnerController.listApiKeys);

router.route('/deletePartnerKey').post(auth(), validate(partnerValidation.removeApiKey), partnerController.removeApiKey);

router
  .route('/thirdPartyCashierDetails')
  .post(auth(), validate(partnerValidation.getThirdPartyCashierDetails), partnerAuthController.thirdPartyCashierDetails);

module.exports = router;
