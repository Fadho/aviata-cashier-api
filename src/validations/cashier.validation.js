const Joi = require('joi');
const { password, objectId } = require('./custom.validation');

const createCashier = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
    shopId: Joi.string().required().custom(objectId),
  }),
};

module.exports = {
  createCashier,
};
