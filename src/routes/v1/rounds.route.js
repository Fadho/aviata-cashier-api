const express = require('express');
// const auth = require('../../middlewares/auth');
// const validate = require('../../middlewares/validate');
// const roundsValidation = require('../../validations/rounds.validation');
const roundsController = require('../../controllers/rounds.controller');

const router = express.Router();

router.post('/', roundsController.startGame);

router.post('/close', roundsController.closeGameRound);

module.exports = router;
