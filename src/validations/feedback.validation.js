const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createFeedback = {
  body: Joi.object().keys({
    cashierId: Joi.string().custom(objectId).required(),
    agentId: Joi.string().custom(objectId).required(),
    issue: Joi.string().required(),
    related: Joi.string(),
    gameType: Joi.string().required(),
  }),
};

module.exports = {
  createFeedback,
};
