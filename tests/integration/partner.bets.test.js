const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const httpStatus = require('http-status');

jest.mock('../../src/services/vfengine.service', () => ({
  placeBet: jest.fn(),
}));

const vfengineService = require('../../src/services/vfengine.service');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { User, Wallets, Tickets } = require('../../src/models');
const ApiKey = require('../../src/models/apiKey.model');

setupTestDB();

const BASE = '/cashier/v1/partner-bets';

let partner;
let cashier;
let partnerApiKey;

beforeEach(async () => {
  jest.clearAllMocks();

  const unique = `${Date.now()}-${Math.random()}`;
  partnerApiKey = `tw_api_${'a'.repeat(64)}`;
  const keyHash = crypto.createHash('sha256').update(partnerApiKey).digest('hex');

  partner = await User.create({
    name: 'partner-bets-admin',
    username: 'partner-bets-admin',
    email: 'partner-bets-admin@test.com',
    password: 'Password1',
    role: 'admin',
    thirdParty: true,
    currency: 'USD',
    endpoint: 'https://partner.example.com',
    apiKey: `partner-bets-admin-${unique}`,
  });

  const cashierWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    balance: 1000,
    primaryWallet: true,
  });

  cashier = await User.create({
    name: 'partner-bets-cashier',
    username: 'partner-bets-cashier',
    email: 'partner-bets-cashier@test.com',
    password: 'Password1',
    role: 'cashier',
    thirdParty: true,
    agentId: partner._id,
    currency: 'USD',
    wallets: [cashierWallet._id],
    apiKey: `partner-bets-cashier-${unique}`,
  });

  cashierWallet.userId = cashier._id;
  await cashierWallet.save();

  await ApiKey.create({
    partnerId: partner._id,
    keyName: 'test-key',
    keyHash,
    scopes: ['bets:write'],
    status: 'active',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  vfengineService.placeBet.mockResolvedValue({
    data: {
      bet_id: 'vf-partner-bet-001',
      matchId: 'match-99',
      market: '1X2',
      selection: '1',
      accepted_odds: 2.5,
      status: 'ACCEPTED',
    },
  });
});

describe('POST /partner-bets', () => {
  test('routes Turbo Soccer bets through the VF Engine cashier place-bet flow', async () => {
    const res = await request(app)
      .post(BASE)
      .set('x-api-key', partnerApiKey)
      .send({
        stake: 100,
        cashierId: cashier._id.toString(),
        gameType: 'turbo-soccer',
        matchId: 'match-99',
        market: '1X2',
        selection: '1',
        requested_odds: 2.5,
      })
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-partner-bet-001');
    expect(vfengineService.placeBet).toHaveBeenCalledWith({
      stake: 100,
      cashierId: cashier._id.toString(),
      gameType: 'turbo-soccer',
      matchId: 'match-99',
      market: '1X2',
      selection: '1',
      requested_odds: 2.5,
    });

    const wallet = await Wallets.findById(cashier.wallets[0]);
    expect(Number(wallet.balance)).toBe(900);
    expect(await Tickets.countDocuments()).toBe(0);
  });
});
