const express = require('express');
const {auth, apiKeyAuth} = require('../../middlewares/auth');

const validate = require('../../middlewares/validate');
const partnerValidation = require('../../validations/partner.validation');
const partnerController = require('../../controllers/partner.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), partnerController.createApiKey);

router.route('/deletePartnerKey').post(auth(), validate(partnerValidation.removeApiKey), partnerController.removeApiKey);

router.route('/deletePartnerKey').post(auth(), validate(partnerValidation.removeApiKey), partnerController.removeApiKey);

module.exports = router;
