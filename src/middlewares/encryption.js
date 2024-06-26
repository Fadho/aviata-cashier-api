const httpStatus = require('http-status');
const { decrypt, encrypt } = require('../utils/encryption');

// Decrypt middleware
const decryptMiddleware = (req, res, next) => {
  if (req.body.data) {
    try {
      //   console.log(req.body);
      const decryptedData = decrypt(req.body.data);
      req.body.data = JSON.parse(decryptedData);
    } catch (error) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: 'Invalid encrypted data' });
    }
  }
  next();
};

// Encrypt middleware
const encryptMiddleware = (req, res, next) => {
  const originalSend = res.send;
  res.send = function (data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    const encryptedData = encrypt(data);
    originalSend.call(this, encryptedData);
  };
  next();
};

module.exports = {
  decryptMiddleware,
  encryptMiddleware,
};
