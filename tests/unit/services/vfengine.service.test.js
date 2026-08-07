const axios = require('axios');
const jwt = require('jsonwebtoken');

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

  test('admin requests use an engine JWT with the required admin role', async () => {
    await vfengineService.getAdminAudit(25, 'MARGIN_UPDATE');

    const interceptor = mockInstance.interceptors.request.use.mock.calls[0][0];
    const requestConfig = interceptor({ headers: {} });

    expect(jwt.sign).toHaveBeenCalledWith(
      { operatorId: config.vfengine.operatorId, role: 'admin' },
      config.vfengine.jwtSecret,
      { expiresIn: '8h' }
    );
    expect(requestConfig.headers.Authorization).toBe('Bearer engine-token');
    expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/audit', {
      params: { limit: 25, action: 'MARGIN_UPDATE' },
    });
  });

  test('proxies league market margin read, update, and reset operations', async () => {
    await vfengineService.getLeagueMarketMargin('NIGHT LEAGUE', 'goals.over_under_25');
    await vfengineService.setLeagueMarketMargin('NIGHT LEAGUE', 'goals.over_under_25', 1.14);
    await vfengineService.resetLeagueMarketMargin('NIGHT LEAGUE', 'goals.over_under_25');

    const path = '/api/admin/leagues/NIGHT%20LEAGUE/markets/goals.over_under_25/margin';
    expect(mockInstance.get).toHaveBeenCalledWith(path);
    expect(mockInstance.put).toHaveBeenCalledWith(path, { margin: 1.14 });
    expect(mockInstance.delete).toHaveBeenCalledWith(path);
  });

  test('proxies active-match market margin operations', async () => {
    await vfengineService.getMatchMargins('MATCH 100');
    await vfengineService.getMatchMarketMargin('MATCH 100', 'milestones.35');
    await vfengineService.setMatchMarketMargin('MATCH 100', 'milestones.35', 1.12);
    await vfengineService.resetMatchMarketMargin('MATCH 100', 'milestones.35');

    expect(mockInstance.get).toHaveBeenCalledWith('/api/admin/match/MATCH%20100/margins');
    const path = '/api/admin/match/MATCH%20100/markets/milestones.35/margin';
    expect(mockInstance.get).toHaveBeenCalledWith(path);
    expect(mockInstance.put).toHaveBeenCalledWith(path, { margin: 1.12 });
    expect(mockInstance.delete).toHaveBeenCalledWith(path);
  });
});
