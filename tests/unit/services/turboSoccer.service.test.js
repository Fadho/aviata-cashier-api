const mongoose = require('mongoose');
const httpStatus = require('http-status');

jest.mock('../../../src/services/vfengine.service', () => ({
  placeBet: jest.fn(),
  placeLiveBet: jest.fn(),
  voidBet: jest.fn(),
  validateLiveBet: jest.fn(),
  getBetHistory: jest.fn(),
  issueEngineToken: jest.fn(),
}));

jest.mock('../../../src/services/wallet.service', () => ({
  updateWallet: jest.fn(),
}));

jest.mock('../../../src/models/tickets.model', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../../../src/models/user.model', () => ({
  findById: jest.fn(),
}));

const vfengineService = require('../../../src/services/vfengine.service');
const walletService = require('../../../src/services/wallet.service');
const Tickets = require('../../../src/models/tickets.model');
const User = require('../../../src/models/user.model');
const turboSoccerService = require('../../../src/services/turboSoccer.service');
const ApiError = require('../../../src/utils/ApiError');

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const walletId = new mongoose.Types.ObjectId().toHexString();
const cashierId = new mongoose.Types.ObjectId().toHexString();

beforeEach(() => {
  jest.clearAllMocks();
});

const makeWallet = (balance = 500) => ({ id: walletId, balance });

const vfBetResponse = {
  bet_id: 'vf-bet-001',
  matchId: 'match-99',
  market: '1X2',
  selection: '1',
  accepted_odds: 2.5,
  status: 'ACCEPTED',
};

const vfLiveBetResponse = {
  bet_id: 'vf-live-bet-001',
  matchId: 'match-99',
  final_odds: 2.0,
  status: 'ACCEPTED',
};

const placeBetBody = {
  cashierId,
  matchId: 'match-99',
  market: '1X2',
  selection: '1',
  stake: 100,
  requested_odds: 2.5,
};

const placeLiveBetBody = {
  cashierId,
  matchId: 'match-99',
  market: '1X2',
  selection: '1',
  stake: 100,
  odds: 2.0,
  client_timestamp: Date.now(),
};

// ─── placeBet ─────────────────────────────────────────────────────────────────

describe('turboSoccerService.placeBet', () => {
  beforeEach(() => {
    walletService.updateWallet.mockResolvedValue({});
    vfengineService.placeBet.mockResolvedValue({ data: vfBetResponse });
    Tickets.create.mockResolvedValue({});
  });

  test('should debit wallet, call VF Engine, create ticket and return VF response', async () => {
    const wallet = makeWallet(500);
    const result = await turboSoccerService.placeBet(wallet, placeBetBody, cashierId);

    expect(walletService.updateWallet).toHaveBeenCalledWith(walletId, 400); // 500 - 100
    expect(vfengineService.placeBet).toHaveBeenCalledWith(placeBetBody);
    expect(Tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vfBetId: 'vf-bet-001',
        cashierId,
        stake: 100,
        gameType: 'turbo-soccer',
        roundHasEnded: false,
        cancelled: false,
        potentialWinnings: 250, // 100 * 2.5
        selections: expect.arrayContaining([
          expect.objectContaining({
            market: '1X2',
            selection: '1',
            oddsTaken: 2.5,
            betCategory: 'PREMATCH',
          }),
        ]),
      })
    );
    expect(result).toEqual(vfBetResponse);
  });

  test('should throw 400 when balance is insufficient', async () => {
    const wallet = makeWallet(50);
    await expect(turboSoccerService.placeBet(wallet, placeBetBody, cashierId)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
      message: expect.stringContaining('insufficient funds'),
    });
    expect(walletService.updateWallet).not.toHaveBeenCalled();
    expect(vfengineService.placeBet).not.toHaveBeenCalled();
  });

  test('should throw 400 for invalid stake/balance values', async () => {
    const wallet = { id: walletId, balance: 'not-a-number' };
    await expect(turboSoccerService.placeBet(wallet, placeBetBody, cashierId)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
    });
  });

  test('should refund wallet and rethrow mapped error when VF Engine rejects (MARKET_CLOSED)', async () => {
    const vfError = { response: { status: 400, data: { code: 'MARKET_CLOSED', error: 'Market is closed' } } };
    vfengineService.placeBet.mockRejectedValue(vfError);

    const wallet = makeWallet(500);
    await expect(turboSoccerService.placeBet(wallet, placeBetBody, cashierId)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
      message: 'Market is closed',
    });

    // First call debits, second call refunds
    expect(walletService.updateWallet).toHaveBeenNthCalledWith(1, walletId, 400);
    expect(walletService.updateWallet).toHaveBeenNthCalledWith(2, walletId, 500);
    expect(Tickets.create).not.toHaveBeenCalled();
  });

  test('should refund wallet and throw 403 when VF Engine returns MARKET_SUSPENDED', async () => {
    const vfError = { response: { status: 403, data: { code: 'MARKET_SUSPENDED', error: 'Suspended' } } };
    vfengineService.placeBet.mockRejectedValue(vfError);

    const wallet = makeWallet(500);
    await expect(turboSoccerService.placeBet(wallet, placeBetBody, cashierId)).rejects.toMatchObject({
      statusCode: httpStatus.FORBIDDEN,
    });
    expect(walletService.updateWallet).toHaveBeenCalledTimes(2);
  });

  test('should refund wallet and throw 409 with currentOdds when VF Engine returns ODDS_CHANGED', async () => {
    const vfError = {
      response: { status: 409, data: { code: 'ODDS_CHANGED', error: 'Odds changed', current_odds: 2.8 } },
    };
    vfengineService.placeBet.mockRejectedValue(vfError);

    const wallet = makeWallet(500);
    const err = await turboSoccerService.placeBet(wallet, placeBetBody, cashierId).catch((e) => e);

    expect(err.statusCode).toBe(httpStatus.CONFLICT);
    expect(err.currentOdds).toBe(2.8);
    expect(walletService.updateWallet).toHaveBeenCalledTimes(2);
  });

  test('should use fallback roundId when VF response lacks matchId', async () => {
    vfengineService.placeBet.mockResolvedValue({ data: { ...vfBetResponse, matchId: undefined } });
    const bodyNoMatchId = { ...placeBetBody, matchId: undefined };

    await turboSoccerService.placeBet(makeWallet(500), bodyNoMatchId, cashierId);

    expect(Tickets.create).toHaveBeenCalledWith(expect.objectContaining({ roundId: 'vf-turbo' }));
  });
});

// ─── placeLiveBet ─────────────────────────────────────────────────────────────

describe('turboSoccerService.placeLiveBet', () => {
  beforeEach(() => {
    walletService.updateWallet.mockResolvedValue({});
    vfengineService.placeLiveBet.mockResolvedValue({ data: vfLiveBetResponse });
    Tickets.create.mockResolvedValue({});
  });

  test('should debit wallet, call VF Engine live endpoint, create ticket and return response', async () => {
    const wallet = makeWallet(500);
    const result = await turboSoccerService.placeLiveBet(wallet, placeLiveBetBody, cashierId);

    expect(walletService.updateWallet).toHaveBeenCalledWith(walletId, 400);
    expect(vfengineService.placeLiveBet).toHaveBeenCalledWith(placeLiveBetBody);
    expect(Tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        vfBetId: 'vf-live-bet-001',
        gameType: 'turbo-soccer',
        potentialWinnings: 200,
        selections: expect.arrayContaining([
          expect.objectContaining({
            market: '1X2',
            selection: '1',
            oddsTaken: 2.0,
            betCategory: 'LIVE',
          }),
        ]),
      })
    );
    expect(result).toEqual(vfLiveBetResponse);
  });

  test('should throw 400 when balance is insufficient', async () => {
    await expect(turboSoccerService.placeLiveBet(makeWallet(10), placeLiveBetBody, cashierId)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
    });
    expect(vfengineService.placeLiveBet).not.toHaveBeenCalled();
  });

  test('should refund wallet on VF Engine error', async () => {
    const vfError = { response: { status: 400, data: { code: 'MARKET_CLOSED', error: 'Market is closed' } } };
    vfengineService.placeLiveBet.mockRejectedValue(vfError);

    await expect(turboSoccerService.placeLiveBet(makeWallet(500), placeLiveBetBody, cashierId)).rejects.toThrow(ApiError);
    expect(walletService.updateWallet).toHaveBeenCalledTimes(2);
    expect(Tickets.create).not.toHaveBeenCalled();
  });
});

// ─── voidBet ──────────────────────────────────────────────────────────────────

describe('turboSoccerService.voidBet', () => {
  const originalCashierId = new mongoose.Types.ObjectId().toHexString();
  const cashierWalletId = new mongoose.Types.ObjectId().toHexString();

  const mockTicket = {
    vfBetId: 'vf-bet-001',
    gameType: 'turbo-soccer',
    cashierId: originalCashierId,
    stake: 100,
    cancelled: false,
    roundHasEnded: false,
    save: jest.fn().mockResolvedValue({}),
  };

  const mockCashier = {
    wallets: [{ id: cashierWalletId, balance: 200 }],
  };

  beforeEach(() => {
    Tickets.findOne.mockResolvedValue({ ...mockTicket, save: jest.fn().mockResolvedValue({}) });
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockCashier) });
    vfengineService.voidBet.mockResolvedValue({ data: { success: true } });
    walletService.updateWallet.mockResolvedValue({});
  });

  test('should void ticket, call VF Engine, and refund original cashier wallet', async () => {
    const result = await turboSoccerService.voidBet('vf-bet-001', 'admin override');

    expect(vfengineService.voidBet).toHaveBeenCalledWith('vf-bet-001', 'admin override');
    expect(walletService.updateWallet).toHaveBeenCalledWith(cashierWalletId, 300); // 200 + 100
    expect(result).toMatchObject({
      success: true,
      betId: 'vf-bet-001',
      status: 'VOID',
      voidReason: 'admin override',
    });
    expect(result.voidedAt).toBeDefined();
  });

  test('should set voidReason to null when reason is omitted', async () => {
    const result = await turboSoccerService.voidBet('vf-bet-001');
    expect(result.voidReason).toBeNull();
  });

  test('should throw 404 when bet is not found', async () => {
    Tickets.findOne.mockResolvedValue(null);
    await expect(turboSoccerService.voidBet('nonexistent')).rejects.toMatchObject({
      statusCode: httpStatus.NOT_FOUND,
      message: 'Bet not found',
    });
    expect(vfengineService.voidBet).not.toHaveBeenCalled();
  });

  test('should throw 400 when bet is already cancelled', async () => {
    Tickets.findOne.mockResolvedValue({ ...mockTicket, cancelled: true, save: jest.fn() });
    await expect(turboSoccerService.voidBet('vf-bet-001')).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
      message: expect.stringContaining('not eligible'),
    });
  });

  test('should throw 400 when bet round has already ended', async () => {
    Tickets.findOne.mockResolvedValue({ ...mockTicket, roundHasEnded: true, save: jest.fn() });
    await expect(turboSoccerService.voidBet('vf-bet-001')).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
    });
  });

  test('should throw mapped ApiError when VF Engine void fails', async () => {
    const vfError = { response: { status: 404, data: { error: 'Bet not found on engine' } } };
    vfengineService.voidBet.mockRejectedValue(vfError);

    await expect(turboSoccerService.voidBet('vf-bet-001')).rejects.toMatchObject({
      statusCode: httpStatus.NOT_FOUND,
    });
    expect(walletService.updateWallet).not.toHaveBeenCalled();
  });

  test('should complete without wallet update when cashier has no wallets', async () => {
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ wallets: [] }) });
    const result = await turboSoccerService.voidBet('vf-bet-001');
    expect(walletService.updateWallet).not.toHaveBeenCalled();
    expect(result.status).toBe('VOID');
  });

  test('should complete without wallet update when cashier user is not found', async () => {
    User.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const result = await turboSoccerService.voidBet('vf-bet-001');
    expect(walletService.updateWallet).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// ─── processSettlement ────────────────────────────────────────────────────────

describe('turboSoccerService.processSettlement', () => {
  const cashierWalletId2 = new mongoose.Types.ObjectId().toHexString();

  const wonTicket = {
    cashierId: new mongoose.Types.ObjectId().toHexString(),
    result: null,
    roundHasEnded: false,
    cancelled: false,
  };

  beforeEach(() => {
    Tickets.findOneAndUpdate.mockResolvedValue({ ...wonTicket });
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockResolvedValue({
        wallets: [{ id: cashierWalletId2, balance: 100 }],
      }),
    });
    walletService.updateWallet.mockResolvedValue({});
  });

  test('should return immediately when bets is not an array', async () => {
    await turboSoccerService.processSettlement({ bets: null });
    expect(Tickets.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('should return immediately for an empty bets array', async () => {
    await turboSoccerService.processSettlement({ bets: [] });
    expect(Tickets.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('should update ticket to win and credit cashier wallet for a won bet', async () => {
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'vf-bet-001', result: 'Won', payout: 250 }],
    });

    expect(Tickets.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ vfBetId: 'vf-bet-001', gameType: 'turbo-soccer' }),
      expect.objectContaining({ result: 'win', winnings: 250, roundHasEnded: true }),
      { new: true }
    );
    expect(walletService.updateWallet).toHaveBeenCalledWith(cashierWalletId2, 350); // 100 + 250
  });

  test('should update ticket to loss and NOT credit wallet for a lost bet', async () => {
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'vf-bet-002', result: 'Lost', payout: 0 }],
    });

    expect(Tickets.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ vfBetId: 'vf-bet-002', gameType: 'turbo-soccer' }),
      expect.objectContaining({ result: 'loss', winnings: 0, roundHasEnded: true }),
      { new: true }
    );
    expect(walletService.updateWallet).not.toHaveBeenCalled();
  });

  test('should mark ticket cancelled for a void result', async () => {
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'vf-bet-003', result: 'void', payout: 0 }],
    });

    expect(Tickets.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ vfBetId: 'vf-bet-003', gameType: 'turbo-soccer' }),
      expect.objectContaining({ cancelled: true, result: null, roundHasEnded: true }),
      { new: true }
    );
    expect(walletService.updateWallet).not.toHaveBeenCalled();
  });

  test('should skip wallet credit when ticket is not found', async () => {
    Tickets.findOneAndUpdate.mockResolvedValue(null);
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'unknown-bet', result: 'Won', payout: 100 }],
    });
    expect(walletService.updateWallet).not.toHaveBeenCalled();
  });

  test('should process multiple bets sequentially', async () => {
    const callOrder = [];
    Tickets.findOneAndUpdate.mockImplementation((filter) => {
      callOrder.push(filter.vfBetId);
      return Promise.resolve({ ...wonTicket });
    });

    await turboSoccerService.processSettlement({
      bets: [
        { betId: 'bet-A', result: 'Lost', payout: 0 },
        { betId: 'bet-B', result: 'Lost', payout: 0 },
        { betId: 'bet-C', result: 'Lost', payout: 0 },
      ],
    });

    expect(callOrder).toEqual(['bet-A', 'bet-B', 'bet-C']);
  });

  test('should handle case-insensitive result strings', async () => {
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'vf-bet-004', result: 'WON', payout: 50 }],
    });
    expect(Tickets.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: 'win' }),
      expect.anything()
    );
  });

  test('should handle null result in payload gracefully', async () => {
    await turboSoccerService.processSettlement({
      bets: [{ betId: 'vf-bet-005', result: null, payout: 0 }],
    });
    expect(Tickets.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ result: null, roundHasEnded: true }),
      expect.anything()
    );
  });
});
