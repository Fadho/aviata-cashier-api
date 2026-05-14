const request = require('supertest');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const moment = require('moment');

const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { User, Wallets, Currency, Tickets } = require('../../src/models');
const config = require('../../src/config/config');
const { tokenTypes } = require('../../src/config/tokens');
const tokenService = require('../../src/services/token.service');

setupTestDB();

const BASE = '/cashier/v1/bet';

let currency;
let superWallet;
let superUser;
let superToken;
let adminWallet;
let adminUser;
let adminToken;
let cashierWallet;
let cashierUser;
let cashierToken;

const buildAccessToken = (userId) => {
  const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  return tokenService.generateToken(userId, expires, tokenTypes.ACCESS);
};

beforeEach(async () => {
  const ts = Date.now();

  // Currency required by reporting routes for primary-currency lookup
  currency = await Currency.create({
    decimals: 2,
    exchangeRate: 1,
    updateType: 'manual',
    status: 'active',
    countryId: 'US',
    country: [{ name: 'United States', currencyCode: 'USD', currencySymbol: '$' }],
  });

  // Super user + primary wallet
  superWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    currencyId: currency._id,
    balance: 0,
    primaryWallet: true,
  });

  superUser = await User.create({
    name: `super-bo-${ts}`,
    username: `super-bo-${ts}`,
    email: `super-bo-${ts}@test.com`,
    password: 'Password1',
    role: 'super',
    currency: 'USD',
    apiKey: `super-bo-${ts}`,
    wallets: [superWallet._id],
  });

  superWallet.userId = superUser._id;
  await superWallet.save();
  superToken = buildAccessToken(superUser._id);

  // Admin user + wallet (needed for cashierReport's availableBalance lookup)
  adminWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    currencyId: currency._id,
    balance: 500,
    primaryWallet: true,
  });

  adminUser = await User.create({
    name: `admin-bo-${ts}`,
    username: `admin-bo-${ts}`,
    email: `admin-bo-${ts}@test.com`,
    password: 'Password1',
    role: 'admin',
    currency: 'USD',
    apiKey: `admin-bo-${ts + 1}`,
    wallets: [adminWallet._id],
  });

  adminWallet.userId = adminUser._id;
  await adminWallet.save();
  adminToken = buildAccessToken(adminUser._id);

  // Cashier under admin user
  cashierWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    currencyId: currency._id,
    balance: 1000,
    primaryWallet: true,
  });

  cashierUser = await User.create({
    name: `cashier-bo-${ts}`,
    username: `cashier-bo-${ts}`,
    email: `cashier-bo-${ts}@test.com`,
    password: 'Password1',
    role: 'cashier',
    currency: 'USD',
    apiKey: `cashier-bo-${ts + 2}`,
    agentId: adminUser._id,
    wallets: [cashierWallet._id],
  });

  cashierWallet.userId = cashierUser._id;
  await cashierWallet.save();
  cashierToken = buildAccessToken(cashierUser._id);
});

// ─── Auth enforcement ─────────────────────────────────────────────────────────

describe('Auth enforcement', () => {
  test('GET /financial-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/financial-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /transaction-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/transaction-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /ticket-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/ticket-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /cashier-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/cashier-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /cashier-financial-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/cashier-financial-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /game-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/game-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /populate-reports returns 401 without token', async () => {
    await request(app).get(`${BASE}/populate-reports`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /gaming-activity returns 401 without token', async () => {
    await request(app).get(`${BASE}/gaming-activity`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /ticket-reports returns 403 for cashier (missing ticketReports right)', async () => {
    await request(app)
      .get(`${BASE}/ticket-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });

  test('GET /gaming-activity returns 403 for admin (gamingActivity right not in any role)', async () => {
    await request(app)
      .get(`${BASE}/gaming-activity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

// ─── GET /cashier-financial-reports ──────────────────────────────────────────

describe('GET /cashier-financial-reports — getCashierReport', () => {
  test('returns aggregated report object for authenticated cashier', async () => {
    const res = await request(app)
      .get(`${BASE}/cashier-financial-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date().toISOString(),
      })
      .expect(httpStatus.OK);

    expect(res.body).toMatchObject({
      totalDeposit: expect.any(Number),
      totalWithdrawal: expect.any(Number),
      totalStake: expect.any(Number),
      totalWinnings: expect.any(Number),
      numberOfBets: expect.any(Number),
      profit: expect.any(Number),
    });
  });

  test('aggregates values correctly from multiple financial report records', async () => {
    const { FinancialReport } = require('../../src/models');

    await FinancialReport.create([
      {
        cashierId: cashierUser._id,
        totalDeposit: 200,
        totalWithdrawal: -150,
        totalStake: 100,
        totalWinnings: 80,
        numberOfBets: 3,
        numberOfTransactions: 2,
        profit: 50,
      },
      {
        cashierId: cashierUser._id,
        totalDeposit: 300,
        totalWithdrawal: -100,
        totalStake: 50,
        totalWinnings: 40,
        numberOfBets: 2,
        numberOfTransactions: 1,
        profit: 200,
      },
    ]);

    const res = await request(app)
      .get(`${BASE}/cashier-financial-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(httpStatus.OK);

    expect(res.body.totalDeposit).toBe(500);
    expect(res.body.totalStake).toBe(150);
    expect(res.body.numberOfBets).toBe(5);
  });
});

// ─── GET /cashier-reports ─────────────────────────────────────────────────────

describe('GET /cashier-reports — cashierReport', () => {
  test('returns report data for the authenticated user', async () => {
    const res = await request(app)
      .get(`${BASE}/cashier-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body).toMatchObject({
      totalWinnings: expect.any(Number),
      totalStake: expect.any(Number),
      numberOfBets: expect.any(Number),
      name: cashierUser.name,
    });
  });

  test('reflects bets placed by the cashier', async () => {
    await Tickets.create({
      roundId: 'round-cr',
      cashierId: cashierUser._id,
      ticketId: '8888888881',
      betType: 'single',
      stake: 50,
      winnings: 0,
      potentialWinnings: 100,
    });

    const res = await request(app)
      .get(`${BASE}/cashier-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body.totalStake).toBe(50);
    expect(res.body.numberOfBets).toBe(1);
  });
});

// ─── GET /financial-reports ───────────────────────────────────────────────────

describe('GET /financial-reports — getFinancialReports', () => {
  test('returns hierarchy with pagination for admin', async () => {
    const res = await request(app)
      .get(`${BASE}/financial-reports`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('hierarchy');
    expect(res.body).toHaveProperty('pagination');
  });

  test('returns hierarchy for super user showing top-level admins', async () => {
    const res = await request(app)
      .get(`${BASE}/financial-reports`)
      .set('Authorization', `Bearer ${superToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('hierarchy');
  });
});

// ─── GET /transaction-reports ─────────────────────────────────────────────────

describe('GET /transaction-reports — getTransactionReports', () => {
  test('returns hierarchy for admin', async () => {
    const res = await request(app)
      .get(`${BASE}/transaction-reports`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('hierarchy');
    expect(res.body).toHaveProperty('pagination');
  });

  test('returns hierarchy for super user', async () => {
    const res = await request(app)
      .get(`${BASE}/transaction-reports`)
      .set('Authorization', `Bearer ${superToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('hierarchy');
  });
});

// ─── GET /ticket-reports ──────────────────────────────────────────────────────

describe('GET /ticket-reports — getAccountingReports (requires ticketReports)', () => {
  test('returns 403 for cashier (no ticketReports right)', async () => {
    await request(app)
      .get(`${BASE}/ticket-reports`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });

  test('returns report data for admin (has ticketReports right)', async () => {
    const res = await request(app)
      .get(`${BASE}/ticket-reports`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ clientType: 'cashier', page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── GET /gaming-activity ─────────────────────────────────────────────────────

describe('GET /gaming-activity — getGamingActivity (requires gamingActivity right)', () => {
  test('returns 403 for admin (gamingActivity right not defined in any role)', async () => {
    // NOTE: gamingActivity is referenced in the route but not defined in config/roles.js.
    // Until roles.js is updated to include it, this endpoint is inaccessible to all roles.
    await request(app)
      .get(`${BASE}/gaming-activity`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.FORBIDDEN);
  });

  test('returns 403 for super user (gamingActivity right not defined in any role)', async () => {
    await request(app)
      .get(`${BASE}/gaming-activity`)
      .set('Authorization', `Bearer ${superToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

// ─── GET /game-reports ────────────────────────────────────────────────────────

describe('GET /game-reports — getGameReports', () => {
  test('returns hierarchy for admin', async () => {
    const res = await request(app)
      .get(`${BASE}/game-reports`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('hierarchy');
    expect(res.body).toHaveProperty('pagination');
  });
});

// ─── GET /populate-reports ────────────────────────────────────────────────────

describe('GET /populate-reports — populateFinancialReports', () => {
  test('returns 200 with success message', async () => {
    const res = await request(app)
      .get(`${BASE}/populate-reports`)
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        startDate: '2025-01-01',
        endDate: '2025-01-02',
        gameType: 'aviata',
      })
      .expect(httpStatus.OK);

    expect(res.body.message).toBe('Financial reports populated successfully.');
  });
});
