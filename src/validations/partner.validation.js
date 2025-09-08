const Joi = require('joi');
const { objectId } = require('./custom.validation');

const removeApiKey = {
  body: Joi.object().keys({
    // cashierId: Joi.string().custom(objectId).required(),
    // agentId: Joi.string().custom(objectId).required(),
    apiKey: Joi.string().required(),
    
  }),
};

module.exports = {
  removeApiKey,
};