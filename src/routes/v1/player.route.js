const express = require('express');
const playerController = require('../../controllers/player.controller');

const router = express.Router();

router.route('/').get(playerController.getAllPlayers).post(playerController.createPlayer);

router.route('/:playerId').get(playerController.getPlayer).put(playerController.updatePlayer);

router.route('/login').post(playerController.playerLogin);

router.route('/joinShop').post(playerController.joinShop);
router.route('/leaveShop').post(playerController.leaveShop);

router.route('/:playerId/transactions').get(playerController.getBetHistory);

module.exports = router;
