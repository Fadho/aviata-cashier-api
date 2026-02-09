const express = require('express');
const { auth } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { playerTransferRequestValidation } = require('../../validations');
const playerTransferRequestController = require('../../controllers/playerTransferRequest.controller');

const router = express.Router();

router
  .route('/')
  .post(
    validate(playerTransferRequestValidation.createTransferRequest),
    playerTransferRequestController.createTransferRequest
  )
  .get(
    // auth('manageTransferRequests'),
    validate(playerTransferRequestValidation.getTransferRequests),
    playerTransferRequestController.getTransferRequests
  );

router.route('/:requestId').get(
  // auth('manageTransferRequests'),
  validate(playerTransferRequestValidation.getTransferRequest),
  playerTransferRequestController.getTransferRequest
);

router.route('/:requestId/approve').post(
  // auth('manageTransferRequests'),
  validate(playerTransferRequestValidation.approveTransferRequest),
  playerTransferRequestController.approveTransferRequest
);

router.route('/:requestId/reject').post(
  // auth('manageTransferRequests'),
  validate(playerTransferRequestValidation.rejectTransferRequest),
  playerTransferRequestController.rejectTransferRequest
);

router.route('/:requestId/cancel').post(
  // auth(),
  validate(playerTransferRequestValidation.cancelTransferRequest),
  playerTransferRequestController.cancelTransferRequest
);

router.route('/player/:playerId').get(
  // auth(),
  validate(playerTransferRequestValidation.getPlayerTransferRequests),
  playerTransferRequestController.getPlayerTransferRequests
);

router
  .route('/code/:code/quick-fund-withdrawal')
  .post(
    auth(),
    validate(playerTransferRequestValidation.quickFundAndWithdrawalByCode),
    playerTransferRequestController.quickFundAndWithdrawalByCode
  );

module.exports = router;
