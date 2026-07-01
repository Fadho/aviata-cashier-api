const crypto = require('crypto');
const { SettlementWebhook } = require('../models');
const logger = require('../config/logger');
const turboSoccerService = require('./turboSoccer.service');

const RETRY_BASE_MS = 2000;
const WORKER_INTERVAL_MS = 5000;
const PROCESSING_LEASE_MS = 60000;

const deliveryHash = (rawBody) => crypto.createHash('sha256').update(rawBody).digest('hex');

const enqueue = async (rawBody, payload) => {
  const hash = deliveryHash(rawBody);
  try {
    return await SettlementWebhook.findOneAndUpdate(
      { deliveryHash: hash },
      {
        $setOnInsert: {
          deliveryHash: hash,
          event: payload.event,
          payload,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Two identical deliveries can race the unique upsert. The winner already
    // persisted the body, so return that journal row and acknowledge safely.
    if (err && err.code === 11000) return SettlementWebhook.findOne({ deliveryHash: hash });
    throw err;
  }
};

const retryDelay = (attempts) => Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), 5 * 60 * 1000);

const processDelivery = async (deliveryId) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const delivery = await SettlementWebhook.findOneAndUpdate(
    {
      _id: deliveryId,
      $or: [
        { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: now } },
        { status: 'processing', updatedAt: { $lte: staleBefore } },
      ],
    },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true }
  );

  if (!delivery) return null;

  try {
    const outcome = await turboSoccerService.processSettlement(delivery.payload);
    if (!outcome.success && outcome.reason !== 'no_bets') {
      throw new Error(outcome.error || outcome.reason || 'Settlement processing failed');
    }

    await SettlementWebhook.updateOne(
      { _id: delivery._id },
      {
        $set: { status: 'completed', completedAt: new Date(), lastError: null },
        $unset: { nextAttemptAt: 1 },
      }
    );
    return outcome;
  } catch (err) {
    const delay = retryDelay(delivery.attempts);
    await SettlementWebhook.updateOne(
      { _id: delivery._id },
      {
        $set: {
          status: 'failed',
          lastError: err.message,
          nextAttemptAt: new Date(Date.now() + delay),
        },
      }
    );
    logger.error('[SettlementWebhook] Deferred settlement attempt failed', {
      deliveryId: delivery.id,
      event: delivery.event,
      attempts: delivery.attempts,
      retryInMs: delay,
      error: err.message,
    });
    return null;
  }
};

const processDueDeliveries = async (limit = 20) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const due = await SettlementWebhook.find({
    $or: [
      { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: now } },
      { status: 'processing', updatedAt: { $lte: staleBefore } },
    ],
  })
    .sort({ nextAttemptAt: 1 })
    .limit(limit)
    .select('_id');

  await Promise.all(due.map((item) => processDelivery(item._id)));
};

const schedule = (deliveryId) => {
  setImmediate(() => {
    processDelivery(deliveryId).catch((err) => {
      logger.error('[SettlementWebhook] Unable to start deferred settlement', {
        deliveryId: String(deliveryId),
        error: err.message,
      });
    });
  });
};

const startWorker = () => {
  processDueDeliveries().catch((err) => logger.error('[SettlementWebhook] Recovery scan failed', { error: err.message }));
  const timer = setInterval(() => {
    processDueDeliveries().catch((err) => logger.error('[SettlementWebhook] Retry scan failed', { error: err.message }));
  }, WORKER_INTERVAL_MS);
  timer.unref();
  return timer;
};

module.exports = {
  enqueue,
  processDelivery,
  processDueDeliveries,
  schedule,
  startWorker,
};
