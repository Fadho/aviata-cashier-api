const mockSettlementWebhook = {
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
};

jest.mock('../../../src/models', () => ({ SettlementWebhook: mockSettlementWebhook }));
jest.mock('../../../src/services/turboSoccer.service', () => ({ processSettlement: jest.fn() }));

const turboSoccerService = require('../../../src/services/turboSoccer.service');
const settlementWebhookService = require('../../../src/services/settlementWebhook.service');

describe('settlementWebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('journals an exact delivery using a deterministic body hash', async () => {
    const rawBody = Buffer.from('{"event":"MATCH_SETTLED"}');
    const payload = { event: 'MATCH_SETTLED' };
    mockSettlementWebhook.findOneAndUpdate.mockResolvedValue({ _id: 'delivery-1' });

    await settlementWebhookService.enqueue(rawBody, payload);
    const [filter, update, options] = mockSettlementWebhook.findOneAndUpdate.mock.calls[0];

    expect(filter.deliveryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(update.$setOnInsert).toMatchObject({ event: 'MATCH_SETTLED', payload, status: 'pending', attempts: 0 });
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  test('marks a successfully applied delivery complete', async () => {
    mockSettlementWebhook.findOneAndUpdate.mockResolvedValue({
      _id: 'delivery-1',
      id: 'delivery-1',
      event: 'MATCH_SETTLED',
      payload: { event: 'MATCH_SETTLED' },
      attempts: 1,
    });
    turboSoccerService.processSettlement.mockResolvedValue({ success: true });
    mockSettlementWebhook.updateOne.mockResolvedValue({});

    await settlementWebhookService.processDelivery('delivery-1');

    expect(mockSettlementWebhook.updateOne).toHaveBeenCalledWith(
      { _id: 'delivery-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) })
    );
  });

  test('keeps an application failure in the durable retry queue', async () => {
    mockSettlementWebhook.findOneAndUpdate.mockResolvedValue({
      _id: 'delivery-1',
      id: 'delivery-1',
      event: 'MATCH_SETTLED',
      payload: { event: 'MATCH_SETTLED' },
      attempts: 1,
    });
    turboSoccerService.processSettlement.mockResolvedValue({ success: false, error: 'wallet unavailable' });
    mockSettlementWebhook.updateOne.mockResolvedValue({});

    await settlementWebhookService.processDelivery('delivery-1');

    expect(mockSettlementWebhook.updateOne).toHaveBeenCalledWith(
      { _id: 'delivery-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'failed', lastError: 'wallet unavailable' }),
      })
    );
  });
});
