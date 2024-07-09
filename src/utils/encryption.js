const { createDecipheriv, createCipheriv } = require('crypto');
// const { configs } = require('../utils/config');

// let key = configs.ENCRYPTIONKEY;
// let iv = configs.ENCRYPTIONIV;

let key = '29a9eae9f28c5cbd457059b2ff2860375c3330b39e781b4927a8cce460fb1781';
let iv = '10012e923a88e9a8bc6247468e694452';

key = Buffer.from(key, 'hex');
iv = Buffer.from(iv, 'hex');

const decrypt = (message) => {
  try {
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decryptedMessage = decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');
    return decryptedMessage;
  } catch (error) {
    console.log(error);
  }
};

const encrypt = (message) => {
  try {
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encryptedMessage = cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
    return encryptedMessage;
  } catch (error) {
    console.log(error);
  }
};

module.exports = { decrypt, encrypt };
