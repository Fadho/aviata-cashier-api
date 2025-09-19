const Joi = require('joi');
const { objectId } = require('./custom.validation');

const removeApiKey = {
  body: Joi.object().keys({
    apiKey: Joi.string().required(),
    
  }),
};

const getThirdPartyCashierDetails = {
  body: Joi.object().keys({
    username: Joi.string().required(),
  }),
};

module.exports = {
  removeApiKey,
  getThirdPartyCashierDetails
};