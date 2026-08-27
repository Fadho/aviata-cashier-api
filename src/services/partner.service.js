const crypto = require('crypto');
const dns = require('dns');
const https = require('https');
const net = require('net');
const axios = require('axios');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const {
  allowedPartnerApiScopes,
  defaultPartnerApiScopes,
  partnerGameCatalog,
  supportedPartnerGames,
} = require('../config/partner');
const { Currency, Game, GameConfig, User, Wallets } = require('../models');
const ApiKey = require('../models/apiKey.model');
const ApiError = require('../utils/ApiError');

const MAX_WALLET_BALANCE = Number.MAX_SAFE_INTEGER;
const PARTNER_REQUEST_TIMEOUT_MS = 5000;
const PARTNER_RESPONSE_LIMIT_BYTES = 1024 * 1024;

const assertActivePartner = (partner) => {
  if (!partner || partner.role !== 'admin' || partner.thirdParty !== true || partner.isActive === false) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Partner access is required');
  }
};

const normalizeScopes = (scopes = defaultPartnerApiScopes) => {
  if (!Array.isArray(scopes)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid partner API key scopes');
  }
  const uniqueScopes = [...new Set(scopes)];
  if (!uniqueScopes.length || uniqueScopes.some((scope) => !allowedPartnerApiScopes.includes(scope))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid partner API key scopes');
  }
  return uniqueScopes.includes('*') ? ['*'] : uniqueScopes;
};

/**
 * Generate a partner API key. The raw value is returned only once.
 */
const generateApiKey = async (partner, keyName, scopes = defaultPartnerApiScopes, expiryDays = 90) => {
  assertActivePartner(partner);

  if (typeof keyName !== 'string' || !keyName.trim() || keyName.trim().length > 100) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A valid key name is required');
  }
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'API key expiry must be between 1 and 365 days');
  }

  const rawKey = `tw_api_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  await ApiKey.create({
    partnerId: partner._id,
    keyHash,
    keyName: keyName.trim(),
    scopes: normalizeScopes(scopes),
    status: 'active',
    expiresAt,
  });

  return rawKey;
};

const deleteApiKey = async (partner, apiKeyId) => {
  assertActivePartner(partner);
  const result = await ApiKey.findOneAndUpdate(
    { _id: apiKeyId, partnerId: partner._id, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date() } },
    { new: true }
  );
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'API key not found');
  }
  return true;
};

const getApiKeys = async (partner) => {
  assertActivePartner(partner);
  return ApiKey.find({ partnerId: partner._id }).select('-keyHash');
};

const normalizePartnerUsername = (username) => {
  if (typeof username !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A valid partner cashier username is required');
  }
  const normalized = username.trim().toLowerCase();
  if (!normalized || normalized.length > 128) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A valid partner cashier username is required');
  }
  return normalized;
};

const validateWalletSync = (wallet, walletVersion) => {
  if (!Number.isFinite(wallet) || wallet < 0 || wallet > MAX_WALLET_BALANCE) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Wallet balance must be a non-negative finite number');
  }
  if (!Number.isSafeInteger(walletVersion) || walletVersion < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'wallet_version must be a non-negative safe integer');
  }
};

const createInternalCashierIdentity = (agentId, partnerUsername) => {
  const digest = crypto.createHash('sha256').update(`${agentId}:${partnerUsername}`).digest('hex').slice(0, 24);
  return {
    username: `partner_${agentId}_${digest}`,
    name: `partner-${agentId}-${digest}`,
    email: `cashier-${digest}@${agentId}.noreply.com`,
  };
};

const applyQuerySession = (query, session) => (session ? query.session(session) : query);

const findPartnerCashier = (agentId, partnerUsername, session) =>
  applyQuerySession(
    User.findOne({
      agentId,
      $or: [
        { partnerCashierUsername: partnerUsername },
        // Compatibility with cashiers created before partnerCashierUsername existed.
        { partnerCashierUsername: null, username: partnerUsername },
      ],
    }),
    session
  );

const getPartnerCurrency = async (currencyCode, session) => {
  const currency = await applyQuerySession(Currency.findOne({ 'country.currencyCode': currencyCode }), session);
  if (!currency) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Currency '${currencyCode}' not found`);
  }
  return currency;
};

const createPartnerWallet = async (cashierId, currencyId, balance, walletVersion, session) => {
  const [wallet] = await Wallets.create(
    [
      {
        currencyId,
        userId: cashierId,
        balance,
        primaryWallet: true,
        partnerSyncVersion: walletVersion,
      },
    ],
    { session }
  );
  await User.findByIdAndUpdate(cashierId, { $addToSet: { wallets: wallet._id } }, { session });
  return wallet;
};

const syncPartnerWallet = async (cashierId, currencyId, balance, walletVersion, session) => {
  let wallet = await applyQuerySession(Wallets.findOne({ userId: cashierId, currencyId, primaryWallet: true }), session);

  if (!wallet) {
    return createPartnerWallet(cashierId, currencyId, balance, walletVersion, session);
  }

  const currentVersion = Number.isSafeInteger(wallet.partnerSyncVersion) ? wallet.partnerSyncVersion : -1;
  if (currentVersion === walletVersion && Number(wallet.balance) === balance) {
    return wallet;
  }
  if (currentVersion >= walletVersion) {
    throw new ApiError(httpStatus.CONFLICT, 'Stale or conflicting wallet_version');
  }

  const versionFilter =
    currentVersion === -1
      ? { $or: [{ partnerSyncVersion: -1 }, { partnerSyncVersion: { $exists: false } }] }
      : { partnerSyncVersion: currentVersion };
  wallet = await Wallets.findOneAndUpdate(
    { _id: wallet._id, ...versionFilter },
    { $set: { balance, partnerSyncVersion: walletVersion } },
    { new: true, runValidators: true, session }
  );

  if (!wallet) {
    throw new ApiError(httpStatus.CONFLICT, 'Wallet was updated by another request; retry with a newer wallet_version');
  }
  return wallet;
};

const ensurePartnerWallet = async (cashierId, currencyId, session) => {
  const wallet = await applyQuerySession(Wallets.findOne({ userId: cashierId, currencyId, primaryWallet: true }), session);
  return wallet || createPartnerWallet(cashierId, currencyId, 0, -1, session);
};

const provisionPartnerCashier = async ({ agent, partnerUsername, currencyCode, balance, walletVersion, syncBalance }) => {
  const execute = async (allowDuplicateRetry = true) => {
    const session = await mongoose.startSession();
    let cashierId;
    try {
      await session.withTransaction(async () => {
        const currency = await getPartnerCurrency(currencyCode, session);
        let cashier = await findPartnerCashier(agent._id, partnerUsername, session);

        if (!cashier) {
          const identity = createInternalCashierIdentity(agent._id, partnerUsername);
          [cashier] = await User.create(
            [
              {
                ...identity,
                partnerCashierUsername: partnerUsername,
                password: `${crypto.randomBytes(12).toString('hex')}A1`,
                role: 'cashier',
                agentId: agent._id,
                superAgentId: agent.superAgentId || agent._id,
                thirdParty: true,
                currency: currencyCode,
              },
            ],
            { session }
          );
          await createPartnerWallet(
            cashier._id,
            currency._id,
            syncBalance ? balance : 0,
            syncBalance ? walletVersion : -1,
            session
          );
        } else {
          if (!cashier.partnerCashierUsername) {
            await User.updateOne(
              { _id: cashier._id, partnerCashierUsername: null },
              { $set: { partnerCashierUsername: partnerUsername } },
              { session }
            );
          }
          if (syncBalance) {
            await syncPartnerWallet(cashier._id, currency._id, balance, walletVersion, session);
          } else {
            await ensurePartnerWallet(cashier._id, currency._id, session);
          }
        }
        cashierId = cashier._id;
      });
    } catch (error) {
      if (allowDuplicateRetry && error && error.code === 11000) {
        return execute(false);
      }
      throw error;
    } finally {
      await session.endSession();
    }
    const cashier = await User.findById(cashierId).populate('wallets');
    if (!cashier) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Partner cashier provisioning failed');
    }
    return cashier;
  };

  return execute();
};

const loginUserWithToken = async (username, currency, thirdPartyId) => {
  const thirdParty = await User.findById(thirdPartyId);
  assertActivePartner(thirdParty);
  return provisionPartnerCashier({
    agent: thirdParty,
    partnerUsername: normalizePartnerUsername(username),
    currencyCode: currency,
    syncBalance: false,
  });
};

const isRestrictedIPv4Address = (address) => {
  const [a, b, c] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
};

const isPublicIpAddress = (address) => {
  if (net.isIPv4(address)) {
    return !isRestrictedIPv4Address(address);
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    const firstSegment = parseInt(normalized.split(':')[0] || '0', 16);
    return !(
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('::ffff:') ||
      normalized.startsWith('2001:db8:') ||
      normalized === '2001:db8::' ||
      (firstSegment >= 0xfc00 && firstSegment <= 0xfdff) ||
      (firstSegment >= 0xfe80 && firstSegment <= 0xfebf) ||
      (firstSegment >= 0xff00 && firstSegment <= 0xffff)
    );
  }

  return false;
};

const createValidatedHttpsAgent = () =>
  new https.Agent({
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        const publicAddress = addresses.find(({ address }) => isPublicIpAddress(address));
        if (!publicAddress || addresses.some(({ address }) => !isPublicIpAddress(address))) {
          return callback(new Error('Partner endpoint resolved to a non-public address'));
        }
        return callback(null, publicAddress.address, publicAddress.family);
      });
    },
  });

const getThirdPartyCashierDetails = async (thirdPartyId, username) => {
  const thirdParty = await User.findById(thirdPartyId);
  assertActivePartner(thirdParty);
  if (!thirdParty.endpoint) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Partner endpoint is not configured');
  }

  let endpoint;
  try {
    endpoint = new URL(thirdParty.endpoint);
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Partner endpoint must be a valid HTTPS URL');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Partner endpoint must be an HTTPS URL without credentials');
  }
  const endpointHostname = endpoint.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(endpointHostname) && !isPublicIpAddress(endpointHostname)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Partner endpoint must resolve to a public address');
  }

  const baseUrl = thirdParty.endpoint.endsWith('/') ? thirdParty.endpoint : `${thirdParty.endpoint}/`;
  const requestUrl = new URL('userDetails', baseUrl);
  const httpsAgent = createValidatedHttpsAgent();
  try {
    const response = await axios.post(
      requestUrl.toString(),
      { username: normalizePartnerUsername(username) },
      {
        timeout: PARTNER_REQUEST_TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: PARTNER_RESPONSE_LIMIT_BYTES,
        maxBodyLength: PARTNER_RESPONSE_LIMIT_BYTES,
        httpsAgent,
        proxy: false,
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Partner endpoint request failed');
  } finally {
    httpsAgent.destroy();
  }
};

const launchGame = async (agent, partnerCashierUsername, wallet, walletVersion) => {
  assertActivePartner(agent);
  validateWalletSync(wallet, walletVersion);
  return provisionPartnerCashier({
    agent,
    partnerUsername: normalizePartnerUsername(partnerCashierUsername),
    currencyCode: agent.currency,
    balance: wallet,
    walletVersion,
    syncBalance: true,
  });
};

const toPlainObject = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

const getAvailableGames = async (agent) => {
  assertActivePartner(agent);

  const [gameDocs, configDocs] = await Promise.all([
    Game.find({ agentId: agent._id, gameType: { $in: supportedPartnerGames } }).select('-id -agentId'),
    GameConfig.find({ agentId: agent._id, gameType: { $in: supportedPartnerGames } }).select('-id -agentId'),
  ]);

  const gamesByType = new Map(gameDocs.map((game) => [game.gameType, toPlainObject(game)]));
  const configsByType = new Map(configDocs.map((config) => [config.gameType, toPlainObject(config)]));

  return supportedPartnerGames.map((gameType) => ({
    gameType,
    name: partnerGameCatalog[gameType] || gameType,
    settings: gamesByType.get(gameType) || null,
    config: configsByType.get(gameType) || null,
  }));
};

module.exports = {
  generateApiKey,
  deleteApiKey,
  loginUserWithToken,
  getApiKeys,
  getThirdPartyCashierDetails,
  launchGame,
  getAvailableGames,
  // Exported for focused security tests.
  isPublicIpAddress,
};
