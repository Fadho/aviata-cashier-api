const Joi = require('joi');

const createSelection = {
  body: Joi.object().keys({
    odd: Joi.number().required(),
    stake: Joi.number().required(),
    potentialWinnings: Joi.number().required(),
  }),
};

module.exports = {
  createSelection,
};
