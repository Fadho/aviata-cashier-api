const util = require('util');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const passport = require('passport');
const crypto = require('crypto');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const { User } = require('../models');
const ApiKey = require('../models/apiKey.model');
const { defaultPartnerApiScopes } = require('./partner');
const logger = require('./logger');

// ─── JWT Strategy ────────────────────────────────────────────────────────────

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }
    const user = await User.findById(payload.sub);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

// ─── API Key Strategy ────────────────────────────────────────────────────────
// Reads the raw key from the x-api-key header, hashes it, looks up the ApiKey
// document, validates status + expiry, then resolves the partner User record
// so that req.user is the agent/partner throughout the request.

function ApiKeyStrategy(verify) {
  passport.Strategy.call(this);
  this.name = 'api-key';
  this._verify = verify;
}

util.inherits(ApiKeyStrategy, passport.Strategy);

ApiKeyStrategy.prototype.authenticate = function (req) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    return this.fail({ message: 'Missing x-api-key header' });
  }
  const self = this;
  this._verify(rawKey, (err, user, info) => {
    if (err) return self.error(err);
    if (!user) return self.fail(info);
    return self.success(user, info);
  });
};

const apiKeyVerify = async (rawKey, done) => {
  try {
    if (typeof rawKey !== 'string' || !/^tw_api_[a-f0-9]{64}$/.test(rawKey)) {
      return done(null, false, { message: 'Invalid API key' });
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKeyDoc = await ApiKey.findOne({ keyHash, status: 'active' });

    if (!apiKeyDoc) {
      return done(null, false, { message: 'Invalid API key' });
    }

    if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
      return done(null, false, { message: 'API key expired' });
    }

    // Reject disabled/non-partner accounts before recording key usage.
    const user = await User.findById(apiKeyDoc.partnerId).populate('wallets');
    if (!user || user.role !== 'admin' || user.thirdParty !== true || user.isActive === false) {
      return done(null, false, { message: 'Active partner not found' });
    }

    await ApiKey.findByIdAndUpdate(apiKeyDoc._id, { lastUsedAt: new Date() }).catch((error) => {
      logger.warn(`Failed to record partner API key usage: ${error.message}`);
    });

    const scopes = apiKeyDoc.scopes && apiKeyDoc.scopes.length ? apiKeyDoc.scopes : defaultPartnerApiScopes;
    return done(null, user, { apiKeyId: apiKeyDoc._id, scopes });
  } catch (err) {
    return done(err);
  }
};

const apiKeyStrategy = new ApiKeyStrategy(apiKeyVerify);

module.exports = {
  jwtStrategy,
  apiKeyStrategy,
  apiKeyVerify,
};
