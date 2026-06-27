const axios = require('axios');

jest.mock('axios', () => ({
  create: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'engine-token'),
}));

const config = require('../../../src/config/config');
const vfengineService = require('../../../src/services/vfengine.service');

describe('vfengineService timestamp forwarding', () => {
  let postMock;
  let mockInstance;
  let originalClockOffset;

  beforeEach(() => {
    postMock = jest.fn().mockResolvedValue({ status: 200, data: {} });
    mockInstance = {
      post: postMock,
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    axios.create.mockReturnValue(mockInstance);
    originalClockOffset = config.vfengine.clockOffsetMs;
    config.vfengine.clockOffsetMs = 0;
  });

  afterEach(() => {
    config.vfengine.clockOffsetMs = originalClockOffset;
    jest.clearAllMocks();
  });

  test('placeBet does not inject client_timestamp when omitted', async () => {
    await vfengineService.placeBet({ matchId: 'LEAGUE-001', market: 'match_winner', selection: 'home', stake: 500 });

    expect(postMock).toHaveBeenCalledWith('/api/bets/place', {
      matchId: 'LEAGUE-001',
      market: 'match_winner',
      selection: 'home',
      stake: 500,
    });
  });

  test('placeBet forwards client_timestamp with configured offset', async () => {
    config.vfengine.clockOffsetMs = 125;

    await vfengineService.placeBet({
      matchId: 'LEAGUE-001',
      market: 'match_winner',
      selection: 'home',
      stake: 500,
      client_timestamp: 1000,
    });

    expect(postMock).toHaveBeenCalledWith('/api/bets/place', {
      matchId: 'LEAGUE-001',
      market: 'match_winner',
      selection: 'home',
      stake: 500,
      client_timestamp: 1125,
    });
  });

  test('validateLiveBet does not inject client_timestamp when omitted', async () => {
    await vfengineService.validateLiveBet({ odds: 2.1, auto_accept_changes: false });

    expect(postMock).toHaveBeenCalledWith('/api/live/bet/validate', {
      odds: 2.1,
      auto_accept_changes: false,
    });
  });
});
