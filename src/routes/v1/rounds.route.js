const express = require('express');
const roundsController = require('../../controllers/rounds.controller');

const router = express.Router();

router.post('/', roundsController.startGame);

router.post('/close', roundsController.closeGameRound);

module.exports = router;
