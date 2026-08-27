const httpStatus = require('http-status');
const mongoose = require('mongoose');
const passport = require('passport');

jest.mock('axios');

jest.mock('../../../src/config/logger', () => ({
  warn: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  Currency: {
    findOne: jest.fn(),
  },
  Game: {
    find: jest.fn(),
  },
  GameConfig: {
    find: jest.fn(),
  },
  User: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
  Wallets: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../../../src/models/apiKey.model', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const axios = require('axios');
const { Currency, Game, GameConfig, User, Wallets } = require('../../../src/models');
const ApiKey = require('../../../src/models/apiKey.model');
const partnerService = require('../../../src/services/partner.service');
const { apiKeyVerify } = require('../../../src/config/passport');
const { apiKeyAuth } = require('../../../src/middlewares/auth');

const makeQuery = (value) => {
  const query = Promise.resolve(value);
  query.session = jest.fn(() => query);
  query.populate = jest.fn(() => query);
  query.select = jest.fn(() => query);
  return query;
};

const partner = {
  _id: '64a1f2c3b4d5e6f7a8b9c001',
  id: '64a1f2c3b4d5e6f7a8b9c001',
  role: 'admin',
  thirdParty: true,
  isActive: true,
  currency: 'NGN',
  superAgentId: '64a1f2c3b4d5e6f7a8b9c099',
};

const currency = { _id: '64a1f2c3b4d5e6f7a8b9c010' };
const cashier = {
  _id: '64a1f2c3b4d5e6f7a8b9c020',
  id: '64a1f2c3b4d5e6f7a8b9c020',
  partnerCashierUsername: 'alice',
};

let session;

beforeEach(() => {
  jest.clearAllMocks();
  session = {
    withTransaction: jest.fn(async (work) => work()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
});

describe('partner API key management', () => {
  test('rejects key creation for a non-partner user', async () => {
    await expect(
      partnerService.generateApiKey({ ...partner, role: 'cashier' }, 'production', ['game:launch'], 30)
    ).rejects.toMatchObject({ statusCode: httpStatus.FORBIDDEN });
    expect(ApiKey.create).not.toHaveBeenCalled();
  });

  test('hashes a generated key and stores only validated scopes', async () => {
    ApiKey.create.mockResolvedValue({});

    const rawKey = await partnerService.generateApiKey(partner, ' production ', ['game:launch'], 30);

    expect(rawKey).toMatch(/^tw_api_[a-f0-9]{64}$/);
    expect(ApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: partner._id,
        keyName: 'production',
        scopes: ['game:launch'],
        keyHash: expect.not.stringContaining('tw_api_'),
      })
    );
  });

  test('soft-revokes API keys scoped to the authenticated partner', async () => {
    ApiKey.findOneAndUpdate.mockResolvedValue({ _id: 'key-id' });

    await partnerService.deleteApiKey(partner, 'key-id');

    expect(ApiKey.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'key-id', partnerId: partner._id, status: 'active' },
      { $set: { status: 'revoked', revokedAt: expect.any(Date) } },
      { new: true }
    );
  });

  test('returns 404 instead of claiming an unknown key was deleted', async () => {
    ApiKey.findOneAndUpdate.mockResolvedValue(null);

    await expect(partnerService.deleteApiKey(partner, 'unknown')).rejects.toMatchObject({
      statusCode: httpStatus.NOT_FOUND,
    });
  });
});

describe('partner API key authentication and scopes', () => {
  test('rejects malformed API keys before hashing and lookup', async () => {
    const done = jest.fn();

    await apiKeyVerify('not-a-real-key', done);

    expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid API key' });
    expect(ApiKey.findOne).not.toHaveBeenCalled();
  });

  test('rejects an API key whose partner is inactive', async () => {
    ApiKey.findOne.mockResolvedValue({
      _id: 'key-id',
      partnerId: partner._id,
      scopes: ['game:launch'],
      status: 'active',
    });
    User.findById.mockReturnValue(makeQuery({ ...partner, isActive: false }));
    const done = jest.fn();

    await apiKeyVerify('tw_api_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', done);

    expect(done).toHaveBeenCalledWith(null, false, { message: 'Active partner not found' });
    expect(ApiKey.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('returns the authenticated key scopes and records last use', async () => {
    const key = {
      _id: 'key-id',
      partnerId: partner._id,
      scopes: ['game:launch'],
      status: 'active',
    };
    ApiKey.findOne.mockResolvedValue(key);
    ApiKey.findByIdAndUpdate.mockResolvedValue({});
    User.findById.mockReturnValue(makeQuery(partner));
    const done = jest.fn();

    await apiKeyVerify('tw_api_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', done);

    expect(done).toHaveBeenCalledWith(null, partner, { apiKeyId: key._id, scopes: ['game:launch'] });
    expect(ApiKey.findByIdAndUpdate).toHaveBeenCalledWith(key._id, { lastUsedAt: expect.any(Date) });
  });

  test('still authenticates when recording key usage fails', async () => {
    const key = {
      _id: 'key-id',
      partnerId: partner._id,
      scopes: ['games:read'],
      status: 'active',
    };
    ApiKey.findOne.mockResolvedValue(key);
    ApiKey.findByIdAndUpdate.mockRejectedValue(new Error('write concern timeout'));
    User.findById.mockReturnValue(makeQuery(partner));
    const done = jest.fn();

    await apiKeyVerify('tw_api_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', done);

    expect(done).toHaveBeenCalledWith(null, partner, { apiKeyId: key._id, scopes: ['games:read'] });
  });

  test('rejects a valid key that lacks the route scope', async () => {
    jest.spyOn(passport, 'authenticate').mockImplementation((strategy, options, callback) => () => {
      callback(null, partner, { scopes: ['bets:read'] });
    });
    const next = jest.fn();

    await apiKeyAuth('game:launch')({}, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: httpStatus.FORBIDDEN,
        message: 'API key does not have the required scope',
      })
    );
  });

  test('accepts a key with the required route scope', async () => {
    jest.spyOn(passport, 'authenticate').mockImplementation((strategy, options, callback) => () => {
      callback(null, partner, { scopes: ['game:launch'] });
    });
    const req = {};
    const next = jest.fn();

    await apiKeyAuth('game:launch')(req, {}, next);

    expect(req.user).toBe(partner);
    expect(req.authInfo).toEqual({ scopes: ['game:launch'] });
    expect(next).toHaveBeenCalledWith();
  });
});

describe('partner cashier provisioning and wallet sync', () => {
  test('creates a globally unique internal username and an atomic primary wallet', async () => {
    Currency.findOne.mockReturnValue(makeQuery(currency));
    User.findOne.mockReturnValue(makeQuery(null));
    User.create.mockImplementation(async ([body]) => [{ ...cashier, ...body }]);
    Wallets.create.mockResolvedValue([{ _id: '64a1f2c3b4d5e6f7a8b9c030', balance: 500, partnerSyncVersion: 7 }]);
    User.findByIdAndUpdate.mockResolvedValue({});
    User.findById.mockReturnValue(makeQuery(cashier));

    await partnerService.launchGame(partner, ' Alice ', 500, 7);

    const createdUser = User.create.mock.calls[0][0][0];
    expect(createdUser.username).not.toBe('alice');
    expect(createdUser.username).toContain(partner._id);
    expect(createdUser.partnerCashierUsername).toBe('alice');
    expect(User.create.mock.calls[0][1]).toEqual({ session });
    expect(Wallets.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: cashier._id,
          currencyId: currency._id,
          balance: 500,
          primaryWallet: true,
          partnerSyncVersion: 7,
        }),
      ],
      { session }
    );
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('updates only the matching primary currency wallet with a newer version', async () => {
    const wallet = {
      _id: '64a1f2c3b4d5e6f7a8b9c030',
      balance: 100,
      partnerSyncVersion: 4,
    };
    Currency.findOne.mockReturnValue(makeQuery(currency));
    User.findOne.mockReturnValue(makeQuery(cashier));
    Wallets.findOne.mockReturnValue(makeQuery(wallet));
    Wallets.findOneAndUpdate.mockResolvedValue({ ...wallet, balance: 250, partnerSyncVersion: 5 });
    User.findById.mockReturnValue(makeQuery(cashier));

    await partnerService.launchGame(partner, 'alice', 250, 5);

    expect(Wallets.findOne).toHaveBeenCalledWith({
      userId: cashier._id,
      currencyId: currency._id,
      primaryWallet: true,
    });
    expect(Wallets.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: wallet._id, partnerSyncVersion: 4 },
      { $set: { balance: 250, partnerSyncVersion: 5 } },
      { new: true, runValidators: true, session }
    );
  });

  test('rejects stale wallet versions without changing the balance', async () => {
    Currency.findOne.mockReturnValue(makeQuery(currency));
    User.findOne.mockReturnValue(makeQuery(cashier));
    Wallets.findOne.mockReturnValue(makeQuery({ _id: 'wallet', balance: 500, partnerSyncVersion: 10 }));

    await expect(partnerService.launchGame(partner, 'alice', 900, 9)).rejects.toMatchObject({
      statusCode: httpStatus.CONFLICT,
    });
    expect(Wallets.findOneAndUpdate).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('rejects negative balances before opening a transaction', async () => {
    await expect(partnerService.launchGame(partner, 'alice', -1, 1)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
    });
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('closes the transaction session when wallet creation fails', async () => {
    Currency.findOne.mockReturnValue(makeQuery(currency));
    User.findOne.mockReturnValue(makeQuery(null));
    User.create.mockResolvedValue([cashier]);
    Wallets.create.mockRejectedValue(new Error('wallet write failed'));

    await expect(partnerService.launchGame(partner, 'alice', 500, 1)).rejects.toThrow('wallet write failed');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('repairs a missing wallet for an existing cashier during token login', async () => {
    User.findById.mockReturnValueOnce(makeQuery(partner)).mockReturnValueOnce(makeQuery(cashier));
    Currency.findOne.mockReturnValue(makeQuery(currency));
    User.findOne.mockReturnValue(makeQuery(cashier));
    Wallets.findOne.mockReturnValue(makeQuery(null));
    Wallets.create.mockResolvedValue([{ _id: '64a1f2c3b4d5e6f7a8b9c030', balance: 0, partnerSyncVersion: -1 }]);
    User.findByIdAndUpdate.mockResolvedValue({});

    await partnerService.loginUserWithToken('alice', 'NGN', partner._id);

    expect(Wallets.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: cashier._id,
          currencyId: currency._id,
          balance: 0,
          primaryWallet: true,
          partnerSyncVersion: -1,
        }),
      ],
      { session }
    );
  });
});

describe('partner callback hardening', () => {
  test.each([
    '127.0.0.1',
    '10.0.0.4',
    '169.254.169.254',
    '192.168.1.2',
    '192.0.2.10',
    '198.51.100.10',
    '203.0.113.10',
    '::1',
    'fd00::1',
    '2001:db8::1',
  ])('rejects non-public address %s', (address) => {
    expect(partnerService.isPublicIpAddress(address)).toBe(false);
  });

  test('uses bounded HTTPS requests with redirects and proxies disabled', async () => {
    User.findById.mockReturnValue(makeQuery({ ...partner, endpoint: 'https://partner.example.com/api' }));
    axios.post.mockResolvedValue({ data: { balance: 100 } });

    const result = await partnerService.getThirdPartyCashierDetails(partner._id, ' Alice ');

    expect(result).toEqual({ balance: 100 });
    expect(axios.post).toHaveBeenCalledWith(
      'https://partner.example.com/api/userDetails',
      { username: 'alice' },
      expect.objectContaining({
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        proxy: false,
        httpsAgent: expect.any(Object),
      })
    );
  });

  test.each(['https://169.254.169.254', 'https://[::1]'])(
    'rejects private IP endpoint %s before making a request',
    async (endpoint) => {
      User.findById.mockReturnValue(makeQuery({ ...partner, endpoint }));

      await expect(partnerService.getThirdPartyCashierDetails(partner._id, 'alice')).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
      expect(axios.post).not.toHaveBeenCalled();
    }
  );

  test('returns a bad gateway error when the partner request fails', async () => {
    User.findById.mockReturnValue(makeQuery({ ...partner, endpoint: 'https://partner.example.com/api' }));
    axios.post.mockRejectedValue(new Error('connect ETIMEDOUT'));

    await expect(partnerService.getThirdPartyCashierDetails(partner._id, 'alice')).rejects.toMatchObject({
      statusCode: httpStatus.BAD_GATEWAY,
      message: 'Partner endpoint request failed',
    });
  });

  test('returns a validation error for malformed partner endpoint URLs', async () => {
    User.findById.mockReturnValue(makeQuery({ ...partner, endpoint: 'not a url' }));

    await expect(partnerService.getThirdPartyCashierDetails(partner._id, 'alice')).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
      message: 'Partner endpoint must be a valid HTTPS URL',
    });
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('partner games catalog', () => {
  test('returns supported games with partner-specific settings when configured', async () => {
    Game.find.mockReturnValue(
      makeQuery([
        { gameType: 'aviata', roundWaitTimeValue: 10, toObject: () => ({ gameType: 'aviata', roundWaitTimeValue: 10 }) },
      ])
    );
    GameConfig.find.mockReturnValue(
      makeQuery([{ gameType: 'aviata', defaultStake: 100, toObject: () => ({ gameType: 'aviata', defaultStake: 100 }) }])
    );

    const games = await partnerService.getAvailableGames(partner);

    expect(Game.find).toHaveBeenCalledWith({
      agentId: partner._id,
      gameType: { $in: ['aviata', 'shootout', 'aviatax', 'turbo-soccer'] },
    });
    expect(games).toHaveLength(4);
    expect(games[0]).toEqual({
      gameType: 'aviata',
      name: 'Aviata',
      settings: { gameType: 'aviata', roundWaitTimeValue: 10 },
      config: { gameType: 'aviata', defaultStake: 100 },
    });
    expect(games.find((game) => game.gameType === 'turbo-soccer')).toMatchObject({
      name: 'Turbo Soccer',
      settings: null,
      config: null,
    });
  });

  test('rejects games catalog access for a non-partner user', async () => {
    await expect(partnerService.getAvailableGames({ ...partner, thirdParty: false })).rejects.toMatchObject({
      statusCode: httpStatus.FORBIDDEN,
    });
    expect(Game.find).not.toHaveBeenCalled();
  });
});
