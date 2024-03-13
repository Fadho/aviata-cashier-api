const Joi = require('joi');

const createShop = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    phone: Joi.string().required(),
    name: Joi.string().required(),
  }),
};

module.exports = {
  createShop,
};
