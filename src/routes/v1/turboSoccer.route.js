const express = require('express');
const validate = require('../../middlewares/validate');
const { auth } = require('../../middlewares/auth');
const v = require('../../validations/turboSoccer.validation');
const ctrl = require('../../controllers/turboSoccer.controller');

const router = express.Router();

// ─── Fixtures & Odds (authenticated) ─────────────────────────────────────────

router.get('/schedule', auth(), validate(v.schedule), ctrl.getSchedule);
router.get('/teams', auth(), validate(v.teams), ctrl.getTeams);
router.get('/results', auth(), validate(v.getResults), ctrl.getResults);
router.get('/matches', auth(), validate(v.leagueMatches), ctrl.getLeagueMatches);
router.get('/matches/:matchId/odds', auth(), validate(v.matchOddsById), ctrl.getMatchOddsById);
router.get('/league/prematch/schedule', auth(), validate(v.prematchSchedule), ctrl.getPrematchSchedule);
router.get('/prematch/odds', auth(), ctrl.getPrematchOdds);
router.get('/match/odds', auth(), ctrl.getMatchOdds);
router.get('/match/state', auth(), ctrl.getMatchState);
router.get('/leagues', auth(), ctrl.getAvailableLeagues);

// Alias paths for direct parity with VF Engine naming
router.get('/league/matches', auth(), validate(v.leagueMatches), ctrl.getLeagueMatches);
router.get('/league/matches/:matchId/odds', auth(), validate(v.matchOddsById), ctrl.getMatchOddsById);
router.post('/live/bet', auth(), validate(v.placeLiveBet), ctrl.placeLiveBet);
router.post('/live/bet/validate', auth(), validate(v.validateLiveBet), ctrl.validateLiveBet);

// ─── WebSocket connection info ────────────────────────────────────────────────

router.get('/ws-connect', auth(), ctrl.getWsConnectionInfo);

// ─── VFootball launcher (cashier) ────────────────────────────────────────────

router.get('/game-launcher', auth('placeBet'), ctrl.getVFootballGameLauncher);

// ─── Settlement Webhook (HMAC verified internally, no JWT auth) ───────────────
// MUST be registered before express.json() body-parser applies to this route.
// express.raw() captures the raw Buffer needed for HMAC verification.

router.post('/webhooks/settlement', express.raw({ type: 'application/json' }), ctrl.handleSettlementWebhook);

// ─── Bets (authenticated) ─────────────────────────────────────────────────────

router.post('/bets/place', auth(), validate(v.placeBet), ctrl.placeBet);
router.post('/bets/live', auth(), validate(v.placeLiveBet), ctrl.placeLiveBet);
router.post('/bets/validate', auth(), validate(v.validateLiveBet), ctrl.validateLiveBet);
router.get('/bets/history', auth(), validate(v.betHistory), ctrl.getBetHistory);
router.post('/bets/:betId/void', auth('manageGameConfig'), validate(v.voidBet), ctrl.voidBet);

// ─── Admin — Margins ──────────────────────────────────────────────────────────

router.get('/admin/margins', auth('manageGameConfig'), ctrl.getMargins);
router.get('/admin/margins/preview', auth('manageGameConfig'), validate(v.previewMargin), ctrl.previewMargin);
router.put('/admin/match/:matchId/margin', auth('manageGameConfig'), validate(v.updateMatchMargin), ctrl.updateMatchMargin);

// ─── Admin — Leagues ──────────────────────────────────────────────────────────

router.get('/admin/leagues', auth('manageGameConfig'), ctrl.getLeagues);
router.get('/admin/leagues/progression', auth('manageGameConfig'), validate(v.leagueProgression), ctrl.getLeagueProgression);
router.post('/admin/leagues/progression/persist', auth('manageGameConfig'), ctrl.persistLeagueProgression);
router.post('/admin/leagues', auth('manageGameConfig'), validate(v.createLeague), ctrl.createLeague);
router.get('/admin/leagues/:id', auth('manageGameConfig'), ctrl.getLeague);
router.delete('/admin/leagues/:id', auth('manageGameConfig'), ctrl.deleteLeague);
router.get('/admin/leagues/:id/margin', auth('manageGameConfig'), ctrl.getLeagueMargin);
router.put('/admin/leagues/:id/margin', auth('manageGameConfig'), validate(v.setLeagueMargin), ctrl.setLeagueMargin);
router.post('/admin/leagues/:id/schedule', auth('manageGameConfig'), ctrl.generateLeagueSchedule);
router.get('/admin/leagues/:id/schedule', auth('manageGameConfig'), ctrl.getLeagueSchedule);

// ─── Admin — Accumulator ──────────────────────────────────────────────────────

router.get('/admin/accumulator/config', auth('manageGameConfig'), ctrl.getAccumulatorConfig);
router.put('/admin/accumulator/config', auth('manageGameConfig'), ctrl.updateAccumulatorConfig);
router.post(
  '/admin/accumulator/validate',
  auth('manageGameConfig'),
  validate(v.validateAccumulator),
  ctrl.validateAccumulator
);

// ─── Admin — Throttler ────────────────────────────────────────────────────────

router.get('/admin/throttler/status', auth('manageGameConfig'), ctrl.getThrottlerStatus);

// ─── Admin — Webhook Management ───────────────────────────────────────────────

router.get('/admin/webhooks/settlement', auth('manageGameConfig'), ctrl.getWebhooks);
router.post('/admin/webhooks/settlement', auth('manageGameConfig'), validate(v.registerWebhook), ctrl.registerWebhook);
router.delete('/admin/webhooks/settlement/:webhookId', auth('manageGameConfig'), ctrl.deleteWebhook);

// ─── Admin — Match Control ────────────────────────────────────────────────────

router.post('/admin/match/init', auth('manageGameConfig'), validate(v.initMatch), ctrl.initMatch);
router.post('/admin/match/start', auth('manageGameConfig'), ctrl.startMatch);
router.post('/admin/match/quick-start', auth('manageGameConfig'), validate(v.quickStartMatch), ctrl.quickStartMatch);

// ─── Tickets & Printing (Chapter 10) ─────────────────────────────────────────

router.post('/tickets/print', auth(), validate(v.printTicket), ctrl.printTicket);

// ─── Thermal Printing (Chapter 10B) ──────────────────────────────────────────

router.post('/print/thermal', auth(), validate(v.printThermal), ctrl.printThermal);
router.post('/print/thermal/reprint', auth(), validate(v.reprintThermal), ctrl.reprintThermal);

module.exports = router;
