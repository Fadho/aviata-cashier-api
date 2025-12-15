const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createTransferRequest = {
  body: Joi.object().keys({
    playerId: Joi.string().required().custom(objectId),
    deviceId: Joi.string().required(),
    requestType: Joi.string().required().valid('deposit', 'withdrawal'),
    amount: Joi.number().required().positive(),
    code: Joi.string().required(),
    // currency: Joi.string().required().custom(objectId),
    paymentMethod: Joi.string(),
    metadata: Joi.object(),
  }),
};

const getTransferRequests = {
  query: Joi.object().keys({
    playerId: Joi.string().custom(objectId),
    requestType: Joi.string().valid('deposit', 'withdrawal'),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'completed', 'cancelled'),
    deviceId: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string(),
  }),
};

const getTransferRequest = {
  params: Joi.object().keys({
    requestId: Joi.string().required().custom(objectId),
  }),
};

const getTransferRequestByCode = {
  params: Joi.object().keys({
    code: Joi.string().required(),
  }),
};

const approveTransferRequest = {
  params: Joi.object().keys({
    requestId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    notes: Joi.string(),
  }),
};

const completeTransferRequest = {
  params: Joi.object().keys({
    requestId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    transactionId: Joi.string(),
  }),
};

const rejectTransferRequest = {
  params: Joi.object().keys({
    requestId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    reason: Joi.string().required(),
  }),
};

const cancelTransferRequest = {
  params: Joi.object().keys({
    requestId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    playerId: Joi.string().custom(objectId),
  }),
};

const getPlayerTransferRequests = {
  params: Joi.object().keys({
    playerId: Joi.string().required().custom(objectId),
  }),
  query: Joi.object().keys({
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string(),
  }),
};

module.exports = {
  createTransferRequest,
  getTransferRequests,
  getTransferRequest,
  getTransferRequestByCode,
  approveTransferRequest,
  completeTransferRequest,
  rejectTransferRequest,
  cancelTransferRequest,
  getPlayerTransferRequests,
};
