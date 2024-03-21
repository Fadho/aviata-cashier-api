const express = require('express');
const validate = require('../../middlewares/validate');
const { selectionValidation } = require('../../validations');
const { selectionController } = require('../../controllers');

const router = express.Router();

router.route('/').post(validate(selectionValidation.createSelection), selectionController.createSelection);

module.exports = router;
