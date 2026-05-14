const request = require('supertest');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const moment = require('moment');

const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { User, Wallets, Tickets } = require('../../src/models');
const config = require('../../src/config/config');
const { tokenTypes } = require('../../src/config/tokens');
const tokenService = require('../../src/services/token.service');

setupTestDB();

const BASE = '/cashier/v1/bet';

let cashierWallet;
let cashierUser;
let cashierToken;
let adminUser;
let adminToken;

const buildAccessToken = (userId) => {
  const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  return tokenService.generateToken(userId, expires, tokenTypes.ACCESS);
};

beforeEach(async () => {
  cashierWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    balance: 1000,
    primaryWallet: true,
  });

  cashierUser = await User.create({
    name: 'cashier-bets-test',
    username: 'cashier-bets-test',
    email: 'cashier-bets@test.com',
    password: 'Password1',
    role: 'cashier',
    currency: 'USD',
    apiKey: `cashier-bets-${Date.now()}`,
    wallets: [cashierWallet._id],
  });

  cashierWallet.userId = cashierUser._id;
  await cashierWallet.save();

  cashierToken = buildAccessToken(cashierUser._id);

  adminUser = await User.create({
    name: 'admin-bets-test',
    username: 'admin-bets-test',
    email: 'admin-bets@test.com',
    password: 'Password1',
    role: 'admin',
    currency: 'USD',
    apiKey: `admin-bets-${Date.now() + 1}`,
    wallets: [],
  });

  adminToken = buildAccessToken(adminUser._id);
});

// ─── Auth enforcement ─────────────────────────────────────────────────────────

describe('Auth enforcement', () => {
  test('POST / returns 401 without token', async () => {
    await request(app).post(`${BASE}/`).send({}).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET / returns 401 without token', async () => {
    await request(app).get(`${BASE}/`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /fetch/:id returns 401 without token', async () => {
    await request(app).get(`${BASE}/fetch/abc`).expect(httpStatus.UNAUTHORIZED);
  });

  test('POST /cancel/:id returns 401 without token', async () => {
    await request(app).post(`${BASE}/cancel/${new mongoose.Types.ObjectId()}`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /history returns 401 without token', async () => {
    await request(app).get(`${BASE}/history`).expect(httpStatus.UNAUTHORIZED);
  });

  test('POST /payout/:id returns 401 without token', async () => {
    await request(app).post(`${BASE}/payout/1234567890`).expect(httpStatus.UNAUTHORIZED);
  });
});

// ─── GET /game-state (no auth) ────────────────────────────────────────────────

describe('GET /game-state', () => {
  test('returns 404 when no cashiers exist for the given agentId', async () => {
    await request(app)
      .get(`${BASE}/game-state`)
      .query({ agentId: new mongoose.Types.ObjectId().toString() })
      .expect(httpStatus.NOT_FOUND);
  });
});

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST / — createBetPlaced', () => {
  test('returns 400 when required fields are missing', async () => {
    await request(app)
      .post(`${BASE}/`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ stake: 50 })
      .expect(httpStatus.BAD_REQUEST);
  });

  test('returns 404 when cashier does not exist', async () => {
    await request(app)
      .post(`${BASE}/`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        selections: [{ odd: 2.0, stake: 50 }],
        potentialWinnings: 100,
        stake: 50,
        cashierId: new mongoose.Types.ObjectId().toString(),
        roundId: 'round-001',
        gameType: 'aviata',
      })
      .expect(httpStatus.NOT_FOUND);
  });

  test('returns 400 when stake exceeds cashier wallet balance', async () => {
    await request(app)
      .post(`${BASE}/`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        selections: [{ odd: 2.0, stake: 9999 }],
        potentialWinnings: 19998,
        stake: 9999,
        cashierId: cashierUser._id.toString(),
        roundId: 'round-001',
        gameType: 'aviata',
      })
      .expect(httpStatus.BAD_REQUEST);
  });

  test('returns 201 and creates a ticket on a valid single bet', async () => {
    const res = await request(app)
      .post(`${BASE}/`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        selections: [{ odd: 2.0, stake: 50 }],
        potentialWinnings: 100,
        stake: 50,
        cashierId: cashierUser._id.toString(),
        roundId: 'round-001',
        gameType: 'aviata',
      })
      .expect(httpStatus.CREATED);

    expect(res.body).toMatchObject({
      stake: 50,
      potentialWinnings: 100,
      roundId: 'round-001',
      gameType: 'aviata',
      betType: 'single',
    });

    // Wallet balance should be decremented
    const updatedWallet = await Wallets.findById(cashierWallet._id);
    expect(updatedWallet.balance).toBe(950);
  });

  test('returns 201 and creates a multiple-bet ticket when multiple selections provided', async () => {
    const res = await request(app)
      .post(`${BASE}/`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        selections: [
          { odd: 2.0, stake: 30 },
          { odd: 1.5, stake: 30 },
        ],
        potentialWinnings: 180,
        stake: 60,
        cashierId: cashierUser._id.toString(),
        roundId: 'round-multi',
        gameType: 'aviata',
      })
      .expect(httpStatus.CREATED);

    expect(res.body.betType).toBe('multiple');
  });
});

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET / — fetchBetPlaced', () => {
  test('returns all tickets', async () => {
    const res = await request(app).get(`${BASE}/`).set('Authorization', `Bearer ${cashierToken}`).expect(httpStatus.CREATED);

    expect(Array.isArray(res.body)).toBe(true);
  });

  test('returns created tickets', async () => {
    await Tickets.create({
      roundId: 'round-fetch',
      cashierId: cashierUser._id,
      ticketId: '1111111111',
      betType: 'single',
      stake: 10,
      potentialWinnings: 20,
    });

    const res = await request(app).get(`${BASE}/`).set('Authorization', `Bearer ${cashierToken}`).expect(httpStatus.CREATED);

    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ─── GET /history ─────────────────────────────────────────────────────────────

describe('GET /history — getBetHistory', () => {
  test('returns paginated results', async () => {
    const res = await request(app)
      .get(`${BASE}/history`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test('filters by cashierId', async () => {
    await Tickets.create({
      roundId: 'round-hist',
      cashierId: cashierUser._id,
      ticketId: '2222222222',
      betType: 'single',
      stake: 15,
      potentialWinnings: 30,
    });

    const res = await request(app)
      .get(`${BASE}/history`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .query({ cashierId: cashierUser._id.toString(), page: 1, limit: 10 })
      .expect(httpStatus.OK);

    expect(res.body.results.length).toBe(1);
    expect(res.body.results[0].stake).toBe(15);
  });
});

// ─── GET /fetch/:id ───────────────────────────────────────────────────────────

describe('GET /fetch/:id — getBetPlacedById', () => {
  test('returns 404 when ticket does not exist', async () => {
    await request(app)
      .get(`${BASE}/fetch/nonexistentid`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.NOT_FOUND);
  });

  test('returns the ticket when found by ticketId', async () => {
    await Tickets.create({
      roundId: 'round-byid',
      cashierId: cashierUser._id,
      ticketId: '3333333333',
      betType: 'single',
      stake: 25,
      potentialWinnings: 50,
    });

    const res = await request(app)
      .get(`${BASE}/fetch/3333333333`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.CREATED);

    expect(res.body.ticketId).toBe('3333333333');
    expect(res.body.stake).toBe(25);
  });
});

// ─── POST /cancel/:id ─────────────────────────────────────────────────────────

describe('POST /cancel/:id — cancelTicket', () => {
  test('returns 404 when ticket _id does not exist', async () => {
    await request(app)
      .post(`${BASE}/cancel/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.NOT_FOUND);
  });

  test('marks a ticket as cancelled', async () => {
    const ticket = await Tickets.create({
      roundId: 'round-cancel',
      cashierId: cashierUser._id,
      ticketId: '4444444444',
      betType: 'single',
      stake: 10,
      potentialWinnings: 20,
    });

    const res = await request(app)
      .post(`${BASE}/cancel/${ticket._id}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.CREATED);

    expect(res.body.cancelled).toBe(true);
  });
});

// ─── POST /cashout (no auth) ──────────────────────────────────────────────────

describe('POST /cashout — cashoutTicket', () => {
  test('returns 400 when body is missing required fields', async () => {
    await request(app).post(`${BASE}/cashout`).send({}).expect(httpStatus.BAD_REQUEST);
  });

  test('returns 201 when roundId has no open bets', async () => {
    const res = await request(app)
      .post(`${BASE}/cashout`)
      .send({ roundId: 'round-none', odd: 1.5 })
      .expect(httpStatus.CREATED);

    expect(res.body.message).toBe('Bets updated successfully');
  });

  test('calculates winnings for open bets in the round', async () => {
    await Tickets.create({
      roundId: 'round-co',
      cashierId: cashierUser._id,
      ticketId: '5555555551',
      betType: 'single',
      stake: 100,
      potentialWinnings: 200,
      selections: [{ odd: 2.0, stake: 100 }],
      roundHasEnded: false,
    });

    const res = await request(app)
      .post(`${BASE}/cashout`)
      .send({ roundId: 'round-co', odd: 2.0 })
      .expect(httpStatus.CREATED);

    expect(res.body.message).toBe('Bets updated successfully');

    const updated = await Tickets.findOne({ ticketId: '5555555551' });
    expect(updated.roundHasEnded).toBe(true);
  });
});

// ─── POST /payout/:id ─────────────────────────────────────────────────────────

describe('POST /payout/:id — payoutTicket', () => {
  test('returns 404 with message when ticket does not exist', async () => {
    const res = await request(app)
      .post(`${BASE}/payout/nonexistent`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.NOT_FOUND);

    expect(res.body.message).toBe('Invalid ticket');
  });

  test('returns message when ticket has no winnings', async () => {
    await Tickets.create({
      roundId: 'round-pay',
      cashierId: cashierUser._id,
      ticketId: '6666666666',
      betType: 'single',
      stake: 10,
      winnings: 0,
      potentialWinnings: 20,
    });

    const res = await request(app)
      .post(`${BASE}/payout/6666666666`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.CREATED);

    expect(res.body.message).toBe('No winnings to payout');
  });

  test('returns message when round has not ended yet', async () => {
    await Tickets.create({
      roundId: 'round-pay2',
      cashierId: cashierUser._id,
      ticketId: '7777777777',
      betType: 'single',
      stake: 10,
      winnings: 50,
      potentialWinnings: 50,
      roundHasEnded: false,
    });

    const res = await request(app)
      .post(`${BASE}/payout/7777777777`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.CREATED);

    expect(res.body.message).toBe('Round has not ended yet.');
  });
});

// ─── POST /player (no auth) ───────────────────────────────────────────────────

describe('POST /player — createBetPlacedForPlayer', () => {
  test('returns 400 when required fields are missing', async () => {
    await request(app).post(`${BASE}/player`).send({}).expect(httpStatus.BAD_REQUEST);
  });

  test('returns 400 when stake is missing', async () => {
    await request(app)
      .post(`${BASE}/player`)
      .send({
        cashierId: cashierUser._id.toString(),
        playerId: '42',
        roundId: 'round-p1',
      })
      .expect(httpStatus.BAD_REQUEST);
  });
});

// ─── POST /player/cashout (no auth) ──────────────────────────────────────────

describe('POST /player/cashout — cashoutPlayerBet', () => {
  test('returns 400 when required fields are missing', async () => {
    await request(app).post(`${BASE}/player/cashout`).send({}).expect(httpStatus.BAD_REQUEST);
  });

  test('returns 404 when ticket does not exist', async () => {
    await request(app)
      .post(`${BASE}/player/cashout`)
      .send({ ticketId: new mongoose.Types.ObjectId().toString(), odd: 1.5 })
      .expect(httpStatus.NOT_FOUND);
  });
});
