const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const moment = require('moment');

jest.mock('../../src/services/vfengine.service', () => ({
  getSchedule: jest.fn(),
  getTeams: jest.fn(),
  getResults: jest.fn(),
  getPublicLeagues: jest.fn(),
  getLeagueMatches: jest.fn(),
  getMatchOddsById: jest.fn(),
  getPrematchSchedule: jest.fn(),
  getPrematchOdds: jest.fn(),
  getMatchOdds: jest.fn(),
  getMatchState: jest.fn(),
  placeBet: jest.fn(),
  placeLiveBet: jest.fn(),
  validateLiveBet: jest.fn(),
  voidBet: jest.fn(),
  getBetHistory: jest.fn(),
  issueEngineToken: jest.fn(),
  getMargins: jest.fn(),
  previewMargin: jest.fn(),
  updateMatchMargin: jest.fn(),
  getMatchMargins: jest.fn(),
  getMatchMarketMargin: jest.fn(),
  setMatchMarketMargin: jest.fn(),
  resetMatchMarketMargin: jest.fn(),
  getLeagues: jest.fn(),
  getLeagueProgression: jest.fn(),
  persistLeagueProgression: jest.fn(),
  createLeague: jest.fn(),
  getLeague: jest.fn(),
  deleteLeague: jest.fn(),
  getLeagueSchedule: jest.fn(),
  generateLeagueSchedule: jest.fn(),
  getLeagueMargin: jest.fn(),
  setLeagueMargin: jest.fn(),
  getLeagueMarketMargin: jest.fn(),
  setLeagueMarketMargin: jest.fn(),
  resetLeagueMarketMargin: jest.fn(),
  getAccumulatorConfig: jest.fn(),
  updateAccumulatorConfig: jest.fn(),
  validateAccumulator: jest.fn(),
  getThrottlerStatus: jest.fn(),
  getAdminAudit: jest.fn(),
  settleLedgerTicket: jest.fn(),
  initMatch: jest.fn(),
  startMatch: jest.fn(),
  quickStartMatch: jest.fn(),
}));

const vfengineService = require('../../src/services/vfengine.service');
const walletService = require('../../src/services/wallet.service');
const settlementWebhookService = require('../../src/services/settlementWebhook.service');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { User, Wallets, SettlementWebhook } = require('../../src/models');
const Tickets = require('../../src/models/tickets.model');
const config = require('../../src/config/config');
const { tokenTypes } = require('../../src/config/tokens');
const tokenService = require('../../src/services/token.service');

setupTestDB();

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE = '/cashier/v1/turbo-soccer';
const WEBHOOK_SECRET = config.vfengine.webhookSecret;

let cashierUser;
let cashierWallet;
let cashierToken;
let adminUser;
let adminToken;

const buildAccessToken = (userId) => {
  const expires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  return tokenService.generateToken(userId, expires, tokenTypes.ACCESS);
};

const makeSignature = (body) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(payload)).digest('hex')}`;
};

const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForTicket = async (vfBetId, predicate, attempts = 20, intervalMs = 50) => {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ticket = await Tickets.findOne({ vfBetId });
    if (ticket && predicate(ticket)) return ticket;
    // eslint-disable-next-line no-await-in-loop
    await waitFor(intervalMs);
  }
  return Tickets.findOne({ vfBetId });
};

const waitForWalletBalance = async (walletId, expectedBalance, attempts = 30, intervalMs = 50) => {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const wallet = await Wallets.findById(walletId);
    if (wallet && Number(wallet.balance) === expectedBalance) return wallet;
    // eslint-disable-next-line no-await-in-loop
    await waitFor(intervalMs);
  }
  return Wallets.findById(walletId);
};

const waitForDeliveryStatus = async (status, attempts = 30, intervalMs = 50) => {
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const delivery = await SettlementWebhook.findOne({ status });
    if (delivery) return delivery;
    // eslint-disable-next-line no-await-in-loop
    await waitFor(intervalMs);
  }
  return null;
};

beforeEach(async () => {
  jest.clearAllMocks();

  // Create a wallet
  cashierWallet = await Wallets.create({
    userId: new mongoose.Types.ObjectId(),
    balance: 1000,
    primaryWallet: true,
  });

  // Create cashier user
  cashierUser = await User.create({
    name: 'testcashier',
    username: 'testcashier',
    email: 'cashier@test.com',
    password: 'Password1',
    role: 'cashier',
    currency: 'USD',
    apiKey: `test-cashier-${Date.now()}`,
    wallets: [cashierWallet._id],
  });

  // Update wallet userId to match user
  cashierWallet.userId = cashierUser._id;
  await cashierWallet.save();

  cashierToken = buildAccessToken(cashierUser._id);

  // Create admin user (no wallet needed for admin-only routes)
  adminUser = await User.create({
    name: 'testadmin',
    username: 'testadmin',
    email: 'admin@test.com',
    password: 'Password1',
    role: 'admin',
    currency: 'USD',
    apiKey: `test-admin-${Date.now() + 1}`,
    wallets: [],
  });

  adminToken = buildAccessToken(adminUser._id);

  // Default VF Engine mocks
  vfengineService.getSchedule.mockResolvedValue({ status: 200, data: { matches: [] } });
  vfengineService.getTeams.mockResolvedValue({ status: 200, data: { teams: [] } });
  vfengineService.getResults.mockResolvedValue({ status: 200, data: { success: true, total: 0, panels: [] } });
  vfengineService.getPublicLeagues.mockResolvedValue({ status: 200, data: { leagues: ['PREMIER', 'LALIGA'] } });
  vfengineService.getMargins.mockResolvedValue({ status: 200, data: { margin: 1.05 } });
  vfengineService.issueEngineToken.mockReturnValue('vf-engine-jwt-token');
  vfengineService.placeBet.mockResolvedValue({
    data: {
      bet_id: 'vf-bet-001',
      matchId: 'match-99',
      market: '1X2',
      selection: '1',
      accepted_odds: 2.5,
      status: 'ACCEPTED',
    },
  });
  vfengineService.placeLiveBet.mockResolvedValue({
    data: {
      bet_id: 'vf-live-001',
      matchId: 'match-99',
      final_odds: 2.0,
      status: 'ACCEPTED',
    },
  });
  vfengineService.voidBet.mockResolvedValue({ data: { success: true } });
  vfengineService.getBetHistory.mockResolvedValue({ status: 200, data: { bets: [] } });
});

// ─── Auth enforcement ──────────────────────────────────────────────────────────

describe('Auth enforcement', () => {
  test('GET /schedule should return 401 without token', async () => {
    await request(app).get(`${BASE}/schedule`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /teams should return 401 without token', async () => {
    await request(app).get(`${BASE}/teams`).expect(httpStatus.UNAUTHORIZED);
  });

  test('POST /bets/place should return 401 without token', async () => {
    await request(app).post(`${BASE}/bets/place`).send({}).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /admin/margins should return 401 without token', async () => {
    await request(app).get(`${BASE}/admin/margins`).expect(httpStatus.UNAUTHORIZED);
  });

  test('GET /admin/margins should return 403 for cashier role (lacks manageGameConfig)', async () => {
    await request(app)
      .get(`${BASE}/admin/margins`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

// ─── Fixtures & Odds routes ────────────────────────────────────────────────────

describe('GET /schedule', () => {
  test('should proxy VF Engine response to client', async () => {
    const res = await request(app)
      .get(`${BASE}/schedule`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body).toEqual({ matches: [] });
    expect(vfengineService.getSchedule).toHaveBeenCalledTimes(1);
  });

  test('should return 502 when VF Engine is unreachable', async () => {
    vfengineService.getSchedule.mockRejectedValue(new Error('Network error'));
    await request(app).get(`${BASE}/schedule`).set('Authorization', `Bearer ${cashierToken}`).expect(httpStatus.BAD_GATEWAY);
  });
});

describe('GET /teams', () => {
  test('should return teams list from VF Engine', async () => {
    vfengineService.getTeams.mockResolvedValue({ status: 200, data: { teams: ['TeamA', 'TeamB'] } });

    const res = await request(app).get(`${BASE}/teams`).set('Authorization', `Bearer ${cashierToken}`).expect(httpStatus.OK);

    expect(res.body.teams).toEqual(['TeamA', 'TeamB']);
  });
});

describe('GET /leagues', () => {
  test('should return available leagues from VF Engine public endpoint', async () => {
    const res = await request(app)
      .get(`${BASE}/leagues`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body.leagues).toEqual(['PREMIER', 'LALIGA']);
    expect(vfengineService.getPublicLeagues).toHaveBeenCalledTimes(1);
  });
});

// ─── WebSocket connection info ─────────────────────────────────────────────────

describe('GET /results', () => {
  test('should proxy latest results when no query is provided', async () => {
    const res = await request(app)
      .get(`${BASE}/results`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body).toEqual({ success: true, total: 0, panels: [] });
    expect(vfengineService.getResults).toHaveBeenCalledWith(undefined, undefined);
  });

  test('should pass date and HH:MM startTime to VF Engine', async () => {
    await request(app)
      .get(`${BASE}/results?date=2026-06-12&startTime=14:30`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(vfengineService.getResults).toHaveBeenCalledWith('2026-06-12', '14:30');
  });

  test('should reject ISO datetime startTime because VF Engine expects HH:MM', async () => {
    await request(app)
      .get(`${BASE}/results?date=2026-06-12&startTime=2026-06-12T14:30:00Z`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.BAD_REQUEST);

    expect(vfengineService.getResults).not.toHaveBeenCalled();
  });

  test('should ignore startTime without date because VF Engine only applies it with date', async () => {
    await request(app)
      .get(`${BASE}/results?startTime=14:30`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(vfengineService.getResults).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe('GET /ws-connect', () => {
  test('should return wsUrl and VF Engine JWT token', async () => {
    const res = await request(app)
      .get(`${BASE}/ws-connect`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.wsUrl).toBeDefined();
    expect(res.body.token).toBe('vf-engine-jwt-token');
    expect(vfengineService.issueEngineToken).toHaveBeenCalledTimes(1);
  });
});

// ─── VFootball launcher URL ───────────────────────────────────────────────────

describe('GET /game-launcher', () => {
  test('should return player launcher URL with VF Engine token for authorized cashier', async () => {
    const res = await request(app)
      .get(`${BASE}/game-launcher`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe('vf-engine-jwt-token');
    expect(res.body.url).toContain('player.html?token=');
    expect(res.body.url).toContain(encodeURIComponent('vf-engine-jwt-token'));
    expect(vfengineService.issueEngineToken).toHaveBeenCalled();
  });

  test('should return 403 for admin role (not an authorized cashier)', async () => {
    await request(app)
      .get(`${BASE}/game-launcher`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

// ─── Place bet ─────────────────────────────────────────────────────────────────

describe('POST /bets/place', () => {
  const betBody = {
    cashierId: null, // filled in beforeEach
    matchId: 'match-99',
    market: '1X2',
    selection: '1',
    stake: 100,
  };

  let body;
  beforeEach(() => {
    body = { ...betBody, cashierId: cashierUser._id.toHexString() };
  });

  test('should debit wallet, place bet and return VF response', async () => {
    const res = await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(body)
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-bet-001');

    // Verify wallet was debited
    const updatedWallet = await Wallets.findById(cashierWallet._id);
    expect(Number(updatedWallet.balance)).toBe(900); // 1000 - 100

    // Ticket ownership remains with the VF Engine.
    const ticket = await Tickets.findOne({ vfBetId: 'vf-bet-001' });
    expect(ticket).toBeNull();
  });

  test('should return 400 when stake exceeds wallet balance', async () => {
    body.stake = 9999;
    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(body)
      .expect(httpStatus.BAD_REQUEST);

    // Wallet must be unchanged
    const wallet = await Wallets.findById(cashierWallet._id);
    expect(Number(wallet.balance)).toBe(1000);
  });

  test('should return 400 when market is missing', async () => {
    const { market: _m, ...noMarket } = body;
    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(noMarket)
      .expect(httpStatus.BAD_REQUEST);
  });

  test('should return 400 when stake is missing', async () => {
    const { stake: _s, ...noStake } = body;
    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(noStake)
      .expect(httpStatus.BAD_REQUEST);
  });

  test('should return 404 when cashierId does not exist', async () => {
    body.cashierId = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(body)
      .expect(httpStatus.NOT_FOUND);
  });

  test('should refund wallet and return VF Engine error code when VF rejects bet', async () => {
    const vfError = { response: { status: 409, data: { code: 'ODDS_CHANGED', error: 'Odds changed' } } };
    vfengineService.placeBet.mockRejectedValue(vfError);

    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(body)
      .expect(httpStatus.CONFLICT);

    // Wallet must be unchanged (debit then refund)
    const wallet = await Wallets.findById(cashierWallet._id);
    expect(Number(wallet.balance)).toBe(1000);

    // No ticket should have been created
    const ticket = await Tickets.findOne({ vfBetId: 'vf-bet-001' });
    expect(ticket).toBeNull();
  });

  test('should accept multi-selection payload without creating a local ticket', async () => {
    vfengineService.placeBet.mockResolvedValue({
      data: {
        success: true,
        type: 'ACCUMULATOR',
        bet_id: 'vf-acca-001',
        totalOdds: 3.6,
        potentialReturn: 360,
        selections: [
          {
            matchId: 'LEAGUE-001',
            market: 'match_winner',
            selection: 'home',
            accepted_odds: 2.0,
          },
          {
            matchId: 'LEAGUE-002',
            market: 'btts',
            selection: 'GG',
            accepted_odds: 1.8,
          },
        ],
      },
    });

    const payload = {
      cashierId: cashierUser._id.toHexString(),
      stake: 100,
      auto_accept_changes: true,
      selections: [
        {
          matchId: 'LEAGUE-001',
          market: 'match_winner',
          selection: 'home',
          requested_odds: 2.0,
        },
        {
          matchId: 'LEAGUE-002',
          market: 'btts',
          selection: 'GG',
          requested_odds: 1.8,
        },
      ],
    };

    const res = await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-acca-001');

    const updatedWallet = await Wallets.findById(cashierWallet._id);
    expect(Number(updatedWallet.balance)).toBe(900);

    const ticket = await Tickets.findOne({ vfBetId: 'vf-acca-001' });
    expect(ticket).toBeNull();
  });

  test('should accept and forward additional leg metadata for /bets/place multi payloads', async () => {
    vfengineService.placeBet.mockResolvedValue({
      data: {
        success: true,
        type: 'accumulator',
        bet_id: 'vf-acca-meta-001',
        totalOdds: 7.56,
        potentialReturn: 3780,
        selections: [
          {
            matchId: 'VFL-L01-S01-R012-M01',
            market: 'combo_result_ou25',
            selection: '1 & Over',
            accepted_odds: 4.2,
          },
          {
            matchId: 'LEAGUE-004',
            market: 'btts',
            selection: 'GG',
            accepted_odds: 1.8,
          },
        ],
      },
    });

    const payload = {
      cashierId: cashierUser._id.toHexString(),
      stake: 500,
      auto_accept_changes: true,
      userId: 'PLAYER-123',
      selections: [
        {
          matchId: 'VFL-L01-S01-R012-M01',
          fixtureId: 'VFL-L01-S01-R012-M01',
          gameId: 'VFL-L01-S01-R012-M01',
          market: 'combo_result_ou25',
          selection: '1 & Over',
          requested_odds: 4.2,
          leagueName: 'PREMIER',
          leagueRoom: 'league:PREMIER',
        },
        {
          matchId: 'LEAGUE-004',
          market: 'btts',
          selection: 'GG',
          requested_odds: 1.8,
          extraMeta: {
            source: 'cashier-ui',
          },
        },
      ],
    };

    const res = await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-acca-meta-001');
    expect(vfengineService.placeBet).toHaveBeenCalledWith(payload);
  });

  test('should return 400 when type=accumulator is used with a single leg', async () => {
    const payload = {
      cashierId: cashierUser._id.toHexString(),
      type: 'accumulator',
      stake: 100,
      selections: [{ matchId: 'LEAGUE-001', market: 'match_winner', selection: 'home', requested_odds: 2.0 }],
    };

    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(payload)
      .expect(httpStatus.BAD_REQUEST);
  });

  test('should accept system payloads with systemSize and banker legs', async () => {
    vfengineService.placeBet.mockResolvedValue({
      data: {
        success: true,
        type: 'system',
        bet_id: 'vf-system-001',
        systemSize: 2,
        unitStake: 100,
        linesGenerated: 3,
        bankerCount: 1,
        regularCount: 3,
        totalOdds: 8,
        potentialReturn: 2400,
        selections: [
          {
            matchId: 'VFL-L01-S01-R012-M01',
            market: 'match_winner',
            selection: 'home',
            accepted_odds: 2.0,
          },
          {
            matchId: 'VFL-L01-S01-R012-M02',
            market: 'btts',
            selection: 'GG',
            accepted_odds: 2.0,
          },
          {
            matchId: 'VFL-L01-S01-R012-M03',
            market: 'double_chance',
            selection: '1X',
            accepted_odds: 2.0,
          },
          {
            matchId: 'VFL-L01-S01-R012-M04',
            market: 'draw_no_bet',
            selection: 'away',
            accepted_odds: 2.0,
          },
        ],
      },
    });

    const payload = {
      cashierId: cashierUser._id.toHexString(),
      type: 'system',
      systemSize: 2,
      stake: 100,
      selections: [
        { matchId: 'VFL-L01-S01-R012-M01', market: 'match_winner', selection: 'home', requested_odds: 2.0, is_banker: true },
        { matchId: 'VFL-L01-S01-R012-M02', market: 'btts', selection: 'GG', requested_odds: 2.0 },
        { matchId: 'VFL-L01-S01-R012-M03', market: 'double_chance', selection: '1X', requested_odds: 2.0 },
        { matchId: 'VFL-L01-S01-R012-M04', market: 'draw_no_bet', selection: 'away', requested_odds: 2.0 },
      ],
    };

    const res = await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-system-001');
    expect(vfengineService.placeBet).toHaveBeenCalledWith(payload);

    const ticket = await Tickets.findOne({ vfBetId: 'vf-system-001' });
    expect(ticket).toBeNull();
  });

  test('should accept a combinator without persisting it locally', async () => {
    vfengineService.placeBet.mockResolvedValue({
      data: {
        success: true,
        type: 'combinator',
        bet_id: 'vf-combi-001',
        totalOdds: 1.9,
        potentialReturn: 95,
        selections: [
          {
            matchId: 'LEAGUE-001',
            market: 'match_winner',
            selection: 'home',
            accepted_odds: 2.0,
            stake: 50,
          },
          {
            matchId: 'LEAGUE-002',
            market: 'btts',
            selection: 'GG',
            accepted_odds: 1.8,
            stake: 50,
          },
        ],
      },
    });

    const payload = {
      cashierId: cashierUser._id.toHexString(),
      type: 'combinator',
      stake: 100,
      selections: [
        {
          matchId: 'LEAGUE-001',
          market: 'match_winner',
          selection: 'home',
          requested_odds: 2.0,
        },
        {
          matchId: 'LEAGUE-002',
          market: 'btts',
          selection: 'GG',
          requested_odds: 1.8,
        },
      ],
    };

    await request(app)
      .post(`${BASE}/bets/place`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(payload)
      .expect(httpStatus.OK);

    const ticket = await Tickets.findOne({ vfBetId: 'vf-combi-001' });
    expect(ticket).toBeNull();
  });
});

// ─── Place live bet ────────────────────────────────────────────────────────────

describe('POST /bets/live', () => {
  let liveBetBody;

  beforeEach(() => {
    liveBetBody = {
      cashierId: cashierUser._id.toHexString(),
      matchId: 'match-99',
      market: '1X2',
      selection: '1',
      stake: 100,
      odds: 2.0,
      client_timestamp: Date.now(),
    };
  });

  test('should debit wallet and return live bet response', async () => {
    const res = await request(app)
      .post(`${BASE}/bets/live`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(liveBetBody)
      .expect(httpStatus.OK);

    expect(res.body.bet_id).toBe('vf-live-001');

    const wallet = await Wallets.findById(cashierWallet._id);
    expect(Number(wallet.balance)).toBe(900);

    const ticket = await Tickets.findOne({ vfBetId: 'vf-live-001' });
    expect(ticket).toBeNull();
  });

  test('should return 400 when odds or client_timestamp is missing', async () => {
    const { odds: _o, ...noOdds } = liveBetBody;
    await request(app)
      .post(`${BASE}/bets/live`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(noOdds)
      .expect(httpStatus.BAD_REQUEST);
  });
});

// ─── Bet history ───────────────────────────────────────────────────────────────

describe('GET /bets/history', () => {
  test('should proxy VF Engine bet history', async () => {
    vfengineService.getBetHistory.mockResolvedValue({ status: 200, data: { bets: [{ bet_id: 'x' }] } });

    const res = await request(app)
      .get(`${BASE}/bets/history`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(res.body.bets).toHaveLength(1);
  });

  test('should pass page and limit query params to VF Engine', async () => {
    await request(app)
      .get(`${BASE}/bets/history?page=2&limit=20`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.OK);

    expect(vfengineService.getBetHistory).toHaveBeenCalledWith('2', '20');
  });
});

describe('Admin league progression routes', () => {
  test('GET /admin/leagues/progression should proxy VF Engine progression snapshot', async () => {
    vfengineService.getLeagueProgression.mockResolvedValue({
      status: 200,
      data: { success: true, leagues: [{ league: 'PREMIER', slotCount: 10 }] },
    });

    const res = await request(app)
      .get(`${BASE}/admin/leagues/progression?league=PREMIER`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);

    expect(res.body.success).toBe(true);
    expect(vfengineService.getLeagueProgression).toHaveBeenCalledWith('PREMIER');
  });

  test('POST /admin/leagues/progression/persist should force persistence via VF Engine', async () => {
    vfengineService.persistLeagueProgression.mockResolvedValue({
      status: 200,
      data: { success: true, persisted: true },
    });

    const res = await request(app)
      .post(`${BASE}/admin/leagues/progression/persist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(httpStatus.OK);

    expect(res.body.persisted).toBe(true);
    expect(vfengineService.persistLeagueProgression).toHaveBeenCalledTimes(1);
  });
});

// ─── Settlement webhook ────────────────────────────────────────────────────────

describe('POST /webhooks/settlement', () => {
  const buildPayload = (ticketsGraded, event = 'MATCH_SETTLED') => ({ event, tickets_graded: ticketsGraded });
  const createLegacyTicket = () =>
    Tickets.create({
      roundId: 'match-99',
      cashierId: cashierUser._id,
      ticketId: 'vf-bet-001',
      vfBetId: 'vf-bet-001',
      betType: 'single',
      selections: [{ odd: 2.5, stake: 100 }],
      stake: 100,
      winnings: 0,
      potentialWinnings: 250,
      gameType: 'turbo-soccer',
      roundHasEnded: false,
      payout: false,
      cancelled: false,
    });

  test('should return 401 when x-signature header is missing', async () => {
    const res = await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(buildPayload([])));

    expect(res.status).toBe(httpStatus.UNAUTHORIZED);
  });

  test('should return 401 when signature is invalid', async () => {
    const payload = JSON.stringify(buildPayload([]));
    await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .set('x-signature', 'sha256=invalidsig')
      .send(payload)
      .expect(httpStatus.UNAUTHORIZED);
  });

  test('should return 200 and process won bet with valid signature', async () => {
    // Settlement support remains for tickets created before local persistence was removed.
    await createLegacyTicket();

    const payload = JSON.stringify(buildPayload([{ ticket_hash: 'vf-bet-001', status: 'Won', payout_amount: 250 }]));
    const sig = makeSignature(payload);

    const res = await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .set('x-signature', sig)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body.received).toBe(true);

    // Ticket should now be settled as 'win'
    const ticket = await waitForTicket('vf-bet-001', (t) => t.roundHasEnded === true);
    expect(ticket.result).toBe('win');
    expect(ticket.roundHasEnded).toBe(true);
    expect(Number(ticket.winnings)).toBe(250);

    const wallet = await waitForWalletBalance(cashierWallet._id, 1250);
    expect(Number(wallet.balance)).toBe(1250);
  });

  test('should return 200 and mark ticket cancelled for void result', async () => {
    await createLegacyTicket();

    const payload = JSON.stringify(buildPayload([{ ticket_hash: 'vf-bet-001', status: 'void', payout_amount: 0 }]));
    const sig = makeSignature(payload);

    await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .set('x-signature', sig)
      .send(payload)
      .expect(httpStatus.OK);

    const ticket = await waitForTicket('vf-bet-001', (t) => t.roundHasEnded === true);
    expect(ticket.cancelled).toBe(true);
    expect(ticket.roundHasEnded).toBe(true);
  });

  test('should acknowledge an idempotent settlement for an unknown or already-terminal ticket', async () => {
    // Unknown references are safe to acknowledge because retrying cannot make them match.
    const payload = JSON.stringify(buildPayload([{ ticket_hash: 'unknown-bet', status: 'Won', payout_amount: 100 }]));
    const sig = makeSignature(payload);

    const res = await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .set('x-signature', sig)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body.received).toBe(true);
    expect(await waitForDeliveryStatus('completed')).not.toBeNull();
  });

  test('should acknowledge after journaling and retry a transient wallet credit failure locally', async () => {
    await Tickets.create({
      roundId: 'match-99',
      cashierId: cashierUser._id,
      ticketId: 'vf-bet-001',
      vfBetId: 'vf-bet-001',
      betType: 'single',
      selections: [{ odd: 2.5, stake: 100 }],
      stake: 100,
      winnings: 0,
      potentialWinnings: 250,
      gameType: 'turbo-soccer',
      roundHasEnded: false,
      payout: false,
      cancelled: false,
    });

    const creditSpy = jest.spyOn(walletService, 'creditSettlement').mockRejectedValueOnce(new Error('wallet unavailable'));
    const payload = JSON.stringify(buildPayload([{ ticket_hash: 'vf-bet-001', status: 'WON', payout_amount: 250 }]));
    const sig = makeSignature(payload);

    const res = await request(app)
      .post(`${BASE}/webhooks/settlement`)
      .set('Content-Type', 'application/json')
      .set('x-signature', sig)
      .send(payload)
      .expect(httpStatus.OK);

    expect(res.body).toEqual({ received: true });
    const failedDelivery = await waitForDeliveryStatus('failed');
    expect(failedDelivery).not.toBeNull();
    creditSpy.mockRestore();

    failedDelivery.nextAttemptAt = new Date(0);
    await failedDelivery.save();
    await settlementWebhookService.processDueDeliveries();

    const ticket = await waitForTicket('vf-bet-001', (item) => item.roundHasEnded === true);
    expect(ticket.roundHasEnded).toBe(true);
    expect(ticket.result).toBe('win');
  });
});

// ─── Admin — Margins ──────────────────────────────────────────────────────────

describe('GET /admin/margins', () => {
  test('should return margins for admin user', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/margins`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);

    expect(res.body).toEqual({ margin: 1.05 });
  });

  test('should return 403 for cashier role', async () => {
    await request(app)
      .get(`${BASE}/admin/margins`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

describe('GET /admin/leagues', () => {
  test('should return 403 for cashier role (lacks manageGameConfig)', async () => {
    await request(app)
      .get(`${BASE}/admin/leagues`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

describe('Back-office v1.7 routes', () => {
  test('league market margin routes read, set, and reset an override', async () => {
    vfengineService.getLeagueMarketMargin.mockResolvedValue({
      status: 200,
      data: { success: true, marketId: 'goals.over_under_25', effectiveMargin: 1.08 },
    });
    vfengineService.setLeagueMarketMargin.mockResolvedValue({
      status: 200,
      data: { success: true, marketId: 'goals.over_under_25', margin: 1.14 },
    });
    vfengineService.resetLeagueMarketMargin.mockResolvedValue({
      status: 200,
      data: { success: true, inheritedMargin: 1.08 },
    });

    await request(app)
      .get(`${BASE}/admin/leagues/PREMIER/markets/goals.over_under_25/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);
    await request(app)
      .put(`${BASE}/admin/leagues/PREMIER/markets/goals.over_under_25/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ margin: 1.14 })
      .expect(httpStatus.OK);
    await request(app)
      .delete(`${BASE}/admin/leagues/PREMIER/markets/goals.over_under_25/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);

    expect(vfengineService.getLeagueMarketMargin).toHaveBeenCalledWith('PREMIER', 'goals.over_under_25');
    expect(vfengineService.setLeagueMarketMargin).toHaveBeenCalledWith('PREMIER', 'goals.over_under_25', 1.14);
    expect(vfengineService.resetLeagueMarketMargin).toHaveBeenCalledWith('PREMIER', 'goals.over_under_25');
  });

  test('match market margin routes expose all overrides and exact-market controls', async () => {
    vfengineService.getMatchMargins.mockResolvedValue({ status: 200, data: { success: true, overrides: {} } });
    vfengineService.getMatchMarketMargin.mockResolvedValue({ status: 200, data: { success: true, margin: 1.1 } });
    vfengineService.setMatchMarketMargin.mockResolvedValue({ status: 200, data: { success: true, margin: 1.12 } });
    vfengineService.resetMatchMarketMargin.mockResolvedValue({ status: 200, data: { success: true } });

    await request(app)
      .get(`${BASE}/admin/match/MATCH-100/margins`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);
    await request(app)
      .get(`${BASE}/admin/match/MATCH-100/markets/milestones.35/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);
    await request(app)
      .put(`${BASE}/admin/match/MATCH-100/markets/milestones.35/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ margin: 1.12 })
      .expect(httpStatus.OK);
    await request(app)
      .delete(`${BASE}/admin/match/MATCH-100/markets/milestones.35/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);

    expect(vfengineService.getMatchMargins).toHaveBeenCalledWith('MATCH-100');
    expect(vfengineService.getMatchMarketMargin).toHaveBeenCalledWith('MATCH-100', 'milestones.35');
    expect(vfengineService.setMatchMarketMargin).toHaveBeenCalledWith('MATCH-100', 'milestones.35', 1.12);
    expect(vfengineService.resetMatchMarketMargin).toHaveBeenCalledWith('MATCH-100', 'milestones.35');
  });

  test('market margin updates validate range and require admin permission', async () => {
    await request(app)
      .put(`${BASE}/admin/leagues/PREMIER/markets/btts/margin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ margin: 1.31 })
      .expect(httpStatus.BAD_REQUEST);
    await request(app)
      .put(`${BASE}/admin/leagues/PREMIER/markets/btts/margin`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ margin: 1.1 })
      .expect(httpStatus.FORBIDDEN);

    expect(vfengineService.setLeagueMarketMargin).not.toHaveBeenCalled();
  });

  test('GET /admin/audit forwards supported filters', async () => {
    vfengineService.getAdminAudit.mockResolvedValue({
      status: 200,
      data: { success: true, entries: [{ action: 'MARGIN_UPDATE' }] },
    });

    const res = await request(app)
      .get(`${BASE}/admin/audit?limit=25&action=MARGIN_UPDATE`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.OK);

    expect(res.body.entries).toHaveLength(1);
    expect(vfengineService.getAdminAudit).toHaveBeenCalledWith('25', 'MARGIN_UPDATE');
  });

  test('GET /admin/audit rejects invalid limits before proxying', async () => {
    await request(app)
      .get(`${BASE}/admin/audit?limit=101`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.BAD_REQUEST);

    expect(vfengineService.getAdminAudit).not.toHaveBeenCalled();
  });

  test('POST /ledger/ticket/:ticketId/settle proxies an admin correction', async () => {
    vfengineService.settleLedgerTicket.mockResolvedValue({
      status: 200,
      data: { success: true, ticketId: 'TKT-100', graded: 1 },
    });
    const body = {
      reason: 'Verified provider correction',
      finalScore: { home: 2, away: 1 },
      htScore: { home: 1, away: 0 },
    };

    const res = await request(app)
      .post(`${BASE}/ledger/ticket/TKT-100/settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(httpStatus.OK);

    expect(res.body.graded).toBe(1);
    expect(vfengineService.settleLedgerTicket).toHaveBeenCalledWith('TKT-100', body);
  });

  test('manual settlement requires admin permission and a meaningful reason', async () => {
    await request(app)
      .post(`${BASE}/ledger/ticket/TKT-100/settle`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'Verified correction', finalScore: { home: 1, away: 0 } })
      .expect(httpStatus.FORBIDDEN);

    await request(app)
      .post(`${BASE}/ledger/ticket/TKT-100/settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'bad', finalScore: { home: 1, away: 0 } })
      .expect(httpStatus.BAD_REQUEST);
  });

  test('league creation enforces the v1.7 schema', async () => {
    vfengineService.createLeague.mockResolvedValue({ status: 201, data: { success: true, restartRequired: true } });
    const body = {
      leagueId: 'NIGHT_LEAGUE',
      leagueName: 'Night League',
      teams: ['Arsenal', 'Chelsea', 'Liverpool FC', 'Manchester City'],
      matchDurationMin: 9,
      preMatchDurationMin: 2,
      margin: 1.08,
      startDate: '2026-07-13T20:00:00.000Z',
    };

    await request(app)
      .post(`${BASE}/admin/leagues`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(httpStatus.CREATED);

    expect(vfengineService.createLeague).toHaveBeenCalledWith(body);
  });
});

// ─── Void bet (admin) ──────────────────────────────────────────────────────────

describe('POST /bets/:betId/void', () => {
  beforeEach(async () => {
    // Create a live ticket to void
    await Tickets.create({
      roundId: 'match-99',
      cashierId: cashierUser._id,
      ticketId: 'vf-bet-void-001',
      betType: 'single',
      selections: [{ odd: 2.5, stake: 100 }],
      stake: 100,
      winnings: 0,
      potentialWinnings: 250,
      gameType: 'turbo-soccer',
      roundHasEnded: false,
      payout: false,
      cancelled: false,
      vfBetId: 'vf-bet-void-001',
    });
  });

  test('should void the bet, mark ticket cancelled and refund original cashier', async () => {
    const res = await request(app)
      .post(`${BASE}/bets/vf-bet-void-001/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'match cancelled' })
      .expect(httpStatus.OK);

    expect(res.body.status).toBe('VOID');
    expect(res.body.voidReason).toBe('match cancelled');

    const ticket = await Tickets.findOne({ vfBetId: 'vf-bet-void-001' });
    expect(ticket.cancelled).toBe(true);
    expect(ticket.roundHasEnded).toBe(true);

    // Cashier gets stake back
    const wallet = await Wallets.findById(cashierWallet._id);
    expect(Number(wallet.balance)).toBe(1100); // 1000 + 100
  });

  test('should return 404 when betId is not found', async () => {
    await request(app)
      .post(`${BASE}/bets/nonexistent-bet/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(httpStatus.NOT_FOUND);
  });

  test('should return 403 for cashier role (lacks manageGameConfig)', async () => {
    await request(app)
      .post(`${BASE}/bets/vf-bet-void-001/void`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .expect(httpStatus.FORBIDDEN);
  });
});

// ─── Admin — Match control ─────────────────────────────────────────────────────

describe('POST /admin/match/init', () => {
  test('should proxy initMatch to VF Engine for admin', async () => {
    vfengineService.initMatch.mockResolvedValue({ status: 200, data: { status: 'INITIALIZED' } });

    const res = await request(app)
      .post(`${BASE}/admin/match/init`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ homeTeam: 'TeamA', awayTeam: 'TeamB', matchId: 'match-1' })
      .expect(httpStatus.OK);

    expect(res.body.status).toBe('INITIALIZED');
  });

  test('should return 400 when required fields are missing', async () => {
    await request(app)
      .post(`${BASE}/admin/match/init`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ homeTeam: 'TeamA' }) // missing awayTeam and matchId
      .expect(httpStatus.BAD_REQUEST);
  });
});

describe('POST /admin/match/quick-start', () => {
  test('should proxy quickStartMatch to VF Engine', async () => {
    vfengineService.quickStartMatch.mockResolvedValue({ status: 200, data: { matchId: 'auto-99' } });

    const res = await request(app)
      .post(`${BASE}/admin/match/quick-start`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ homeTeam: 'TeamA', awayTeam: 'TeamB' })
      .expect(httpStatus.OK);

    expect(res.body.matchId).toBe('auto-99');
  });
});
