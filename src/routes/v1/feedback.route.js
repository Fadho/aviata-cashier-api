const express = require('express');
const { auth, apiKeyAuth } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { feedbackValidation } = require('../../validations');
const { feedbackController } = require('../../controllers');

const router = express.Router();

router.route('/create').post(auth(), validate(feedbackValidation.createFeedback), feedbackController.createFeedback);
router.route('/').get(feedbackController.getFeedback);

module.exports = router;
