// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const { Player, Transaction, OTP } = require('../models');
// const { sendSMS, sendEmail } = require('./notification.service');
// const { validateEmail, validatePhone } = require('../utils/validation');

// /**
//  * Create new player account
//  * @param {Object} playerData
//  * @returns {Promise<Object>}
//  */
// const createAccount = async (playerData) => {
//   const { email, phone, password, firstName, lastName, dateOfBirth } = playerData;

//   // Validate input
//   if (!validateEmail(email) || !validatePhone(phone)) {
//     throw new Error('Invalid email or phone number');
//   }

//   // Check if player already exists
//   const existingPlayer = await Player.findOne({
//     $or: [{ email }, { phone }],
//   });

//   if (existingPlayer) {
//     throw new Error('Player already exists with this email or phone');
//   }

//   // Hash password
//   const hashedPassword = await bcrypt.hash(password, 10);

//   // Create player
//   const player = new Player({
//     email,
//     phone,
//     password: hashedPassword,
//     firstName,
//     lastName,
//     dateOfBirth,
//     isActive: true,
//     balance: 0,
//     createdAt: new Date(),
//   });

//   await player.save();

//   // Generate verification OTP
//   await generateOTP(player._id, 'account_verification');

//   return { playerId: player._id, message: 'Account created successfully' };
// };

// /**
//  * Player login
//  * @param {Object} credentials
//  * @returns {Promise<Object>}
//  */
// const login = async (credentials) => {
//   const { identifier, password, deviceInfo } = credentials; // identifier can be email or phone

//   const player = await Player.findOne({
//     $or: [{ email: identifier }, { phone: identifier }],
//     isActive: true,
//   });

//   if (!player) {
//     throw new Error('Invalid credentials');
//   }

//   const isValidPassword = await bcrypt.compare(password, player.password);
//   if (!isValidPassword) {
//     throw new Error('Invalid credentials');
//   }

//   // Check if login from new device
//   const isNewDevice = !player.trustedDevices.some((device) => device.deviceId === deviceInfo.deviceId);

//   if (isNewDevice) {
//     // Generate OTP for new device verification
//     await generateOTP(player._id, 'device_verification');
//     return {
//       requiresOTP: true,
//       message: 'OTP sent for device verification',
//     };
//   }

//   // Generate JWT token
//   const token = generateJWT(player._id);

//   // Update last login
//   player.lastLogin = new Date();
//   await player.save();

//   return {
//     token,
//     player: {
//       id: player._id,
//       email: player.email,
//       firstName: player.firstName,
//       lastName: player.lastName,
//       balance: player.balance,
//     },
//   };
// };

// /**
//  * Generate OTP for various purposes
//  * @param {string} playerId
//  * @param {string} purpose
//  * @returns {Promise<Object>}
//  */
// const generateOTP = async (playerId, purpose) => {
//   const player = await Player.findById(playerId);
//   if (!player) {
//     throw new Error('Player not found');
//   }

//   // Generate 6-digit OTP
//   const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
//   const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

//   // Save OTP
//   const otp = new OTP({
//     playerId,
//     code: otpCode,
//     purpose,
//     expiresAt,
//     isUsed: false,
//   });

//   await otp.save();

//   // Send OTP via SMS
//   const message = `Your OTP for ${purpose.replace('_', ' ')}: ${otpCode}. Valid for 10 minutes.`;
//   await sendSMS(player.phone, message);

//   return { message: 'OTP sent successfully' };
// };

// /**
//  * Verify OTP
//  * @param {string} playerId
//  * @param {string} otpCode
//  * @param {string} purpose
//  * @param {Object} deviceInfo
//  * @returns {Promise<Object>}
//  */
// const verifyOTP = async (playerId, otpCode, purpose, deviceInfo = null) => {
//   const otp = await OTP.findOne({
//     playerId,
//     code: otpCode,
//     purpose,
//     isUsed: false,
//     expiresAt: { $gt: new Date() },
//   });

//   if (!otp) {
//     throw new Error('Invalid or expired OTP');
//   }

//   // Mark OTP as used
//   otp.isUsed = true;
//   await otp.save();

//   const player = await Player.findById(playerId);

//   // Handle different OTP purposes
//   switch (purpose) {
//     case 'device_verification':
//       if (deviceInfo) {
//         player.trustedDevices.push({
//           deviceId: deviceInfo.deviceId,
//           addedAt: new Date(),
//         });
//         await player.save();
//       }
//       const token = generateJWT(playerId);
//       return { token, message: 'Device verified successfully' };

//     case 'withdrawal':
//       return { verified: true, message: 'OTP verified for withdrawal' };

//     case 'account_verification':
//       player.isVerified = true;
//       await player.save();
//       return { verified: true, message: 'Account verified successfully' };

//     default:
//       return { verified: true, message: 'OTP verified successfully' };
//   }
// };

// /**
//  * Deposit funds
//  * @param {string} playerId
//  * @param {number} amount
//  * @param {string} paymentMethod
//  * @returns {Promise<Object>}
//  */
// const deposit = async (playerId, amount, paymentMethod) => {
//   const player = await Player.findById(playerId);
//   if (!player) {
//     throw new Error('Player not found');
//   }

//   if (amount <= 0) {
//     throw new Error('Invalid deposit amount');
//   }

//   // Create transaction record
//   const transaction = new Transaction({
//     playerId,
//     type: 'deposit',
//     amount,
//     paymentMethod,
//     status: 'pending',
//     createdAt: new Date(),
//   });

//   await transaction.save();

//   // In a real implementation, you would integrate with payment gateway here
//   // For now, we'll simulate successful deposit
//   transaction.status = 'completed';
//   await transaction.save();

//   // Update player balance
//   player.balance += amount;
//   await player.save();

//   return {
//     transactionId: transaction._id,
//     newBalance: player.balance,
//     message: 'Deposit successful',
//   };
// };

// /**
//  * Withdraw funds
//  * @param {string} playerId
//  * @param {number} amount
//  * @param {string} otpCode
//  * @returns {Promise<Object>}
//  */
// const withdraw = async (playerId, amount, otpCode) => {
//   const player = await Player.findById(playerId);
//   if (!player) {
//     throw new Error('Player not found');
//   }

//   if (amount <= 0 || amount > player.balance) {
//     throw new Error('Invalid withdrawal amount');
//   }

//   // Verify OTP for withdrawal
//   await verifyOTP(playerId, otpCode, 'withdrawal');

//   // Create transaction record
//   const transaction = new Transaction({
//     playerId,
//     type: 'withdrawal',
//     amount,
//     status: 'pending',
//     createdAt: new Date(),
//   });

//   await transaction.save();

//   // Update player balance
//   player.balance -= amount;
//   await player.save();

//   // In a real implementation, process the withdrawal through payment gateway
//   transaction.status = 'completed';
//   await transaction.save();

//   return {
//     transactionId: transaction._id,
//     newBalance: player.balance,
//     message: 'Withdrawal successful',
//   };
// };

// /**
//  * Generate JWT token
//  * @param {string} playerId
//  * @returns {string}
//  */
// const generateJWT = (playerId) => {
//   return jwt.sign({ playerId }, process.env.JWT_SECRET, { expiresIn: '24h' });
// };

// /**
//  * Get player profile
//  * @param {string} playerId
//  * @returns {Promise<Object>}
//  */
// const getProfile = async (playerId) => {
//   const player = await Player.findById(playerId).select('-password');
//   if (!player) {
//     throw new Error('Player not found');
//   }
//   return player;
// };

// /**
//  * Get transaction history
//  * @param {string} playerId
//  * @param {number} limit
//  * @param {number} offset
//  * @returns {Promise<Array>}
//  */
// const getTransactionHistory = async (playerId, limit = 20, offset = 0) => {
//   const transactions = await Transaction.find({ playerId }).sort({ createdAt: -1 }).limit(limit).skip(offset);

//   return transactions;
// };

// module.exports = {
//   createAccount,
//   login,
//   generateOTP,
//   verifyOTP,
//   deposit,
//   withdraw,
//   generateJWT,
//   getProfile,
//   getTransactionHistory,
// };
