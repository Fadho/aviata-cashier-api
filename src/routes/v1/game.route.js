const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const gameValidation = require('../../validations/game.validation');
const gameController = require('../../controllers/game.controller');

const router = express.Router();

router
  .route('/gameConfig')
  .post(auth('createGameConfig'), validate(gameValidation.createGameConfig), gameController.createGameConfig);

router
  .route('/gameData')
  .get(gameController.getGameData)
  .post(auth('createGameConfig'), validate(gameValidation.createGameData), gameController.createGameData);

router.get('/getGameSettings', gameController.getGameSettings);

router
  .route('/gameData/:agentId')
  .patch(auth('manageGameConfig'), validate(gameValidation.updateGameData), gameController.updateGameData);

router.route('/authenticateGame/:id').get(gameController.authenticateGame);

router
  .route('/gameConfig/:agentId')
  .get(auth('getGameConfig'), validate(gameValidation.getgame), gameController.getGame)
  .patch(auth('manageGameConfig'), validate(gameValidation.updateGameConfig), gameController.updateGameConfig);

module.exports = router;
