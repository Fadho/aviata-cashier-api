const express = require('express');
const playerController = require('../../controllers/player.controller');

const router = express.Router();

router.route('/').get(playerController.getAllPlayers).post(playerController.createPlayer);

// router
//   .route('/:playerId')
//   .get(playerController.getPlayer)
//   .put(playerController.updatePlayer)
//   .delete(playerController.deletePlayer);

router.route('/login').post(playerController.playerLogin);

// router.route('/verify-otp').post(playerController.verifyOTP);

// router.route('/generate-otp').post(playerController.generateOTP);

// router.route('/deposit').post(playerController.deposit);

// router.route('/withdraw').post(playerController.withdraw);

// router.route('/:playerId/profile').get(playerController.getProfile);

router.route('/:playerId/transactions').get(playerController.getBetHistory);

module.exports = router;
