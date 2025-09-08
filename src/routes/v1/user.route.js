const express = require('express');
const {auth, apiKeyAuth} = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user.validation');
const userController = require('../../controllers/user.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), validate(userValidation.getUser), userController.getUser)
  .post(validate(userValidation.createUser), userController.createUser);

router.route('/searchForUser').get(auth(), validate(userValidation.searchForUser), userController.searchForUser);

module.exports = router;
