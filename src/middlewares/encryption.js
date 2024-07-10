const httpStatus = require('http-status');
const { decrypt, encrypt } = require('../utils/encryption');
const logger = require('../config/logger');

// Decrypt middleware
const decryptMiddleware = async (req, res, next) => {
  if (req.method === 'POST' && typeof req.body === 'string') {
    try {
      const decryptedData = decrypt(req.body);
      req.body = JSON.parse(decryptedData);
    } catch (error) {
      logger.error(error);
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid encrypted data' });
    }
  }
  next();
};

// Encrypt middleware
const encryptMiddleware = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    if (typeof body === 'string') {
      const encryptedData = encrypt(JSON.stringify(body));
      // eslint-disable-next-line no-param-reassign
      body = encryptedData;
      // eslint-disable-next-line no-console
    }
    res.setHeader('Content-Type', 'text/plain');
    return originalSend.call(this, body);
  };

  next();
};

module.exports = {
  decryptMiddleware,
  encryptMiddleware,
};
