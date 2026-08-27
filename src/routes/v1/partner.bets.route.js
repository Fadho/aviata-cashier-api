const express = require('express');
const { apiKeyAuth } = require('../../middlewares/auth');

const validate = require('../../middlewares/validate');
const { betsValidation } = require('../../validations');
const { partnerBetsController } = require('../../controllers');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: PartnerBets
 *   description: |
 *     Partner betting API — place bets and manage tickets on behalf of a partner integration.
 *
 *     **Authentication:**
 *     - Endpoints marked with 🔑 require the partner **API key** in the `x-api-key` header.
 *     - The `/player` endpoint is unauthenticated (intended for device-level calls from player terminals).
 */

/**
 * @swagger
 * /partner-bets:
 *   post:
 *     summary: Place a bet on behalf of a partner cashier 🔑
 *     description: |
 *       Creates a bet ticket for the specified cashier. The cashier must belong to the
 *       authenticated partner (verified via `x-api-key`).
 *
 *       After the bet is created, a jackpot contribution is calculated asynchronously.
 *
 *       **Authentication:** `x-api-key` header (partner API key).
 *     tags: [PartnerBets]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stake, cashierId, roundId, potentialWinnings]
 *             properties:
 *               stake:
 *                 type: number
 *                 description: Bet stake amount.
 *                 example: 50
 *               cashierId:
 *                 type: string
 *                 description: MongoDB ObjectId of the cashier placing the bet.
 *                 example: 64a1f2c3b4d5e6f7a8b9c0d1
 *               roundId:
 *                 type: string
 *                 description: Identifier of the game round being bet on.
 *                 example: round_001
 *               potentialWinnings:
 *                 type: number
 *                 description: Calculated potential winnings.
 *                 example: 150
 *               selections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     odd:
 *                       type: number
 *                       example: 3.0
 *                     stake:
 *                       type: number
 *                       example: 50
 *               gameType:
 *                 type: string
 *                 description: Game type identifier (e.g. "aviator", "lastman").
 *                 example: aviator
 *               currency:
 *                 type: string
 *                 example: ETB
 *     responses:
 *       "201":
 *         description: Bet placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The created bet ticket document.
 *       "400":
 *         description: Validation error or insufficient funds
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "401":
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 401
 *               message: Invalid API key
 *       "403":
 *         description: Cashier does not belong to this partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "404":
 *         description: Cashier not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /partner-bets/player:
 *   post:
 *     summary: Place a bet for a player terminal (no auth)
 *     description: |
 *       Creates a bet on behalf of a player identified by `playerId`. This endpoint
 *       is designed for device-level calls from player-facing terminals and does **not**
 *       require an API key.
 *
 *       Supports freebet redemption — if the player has an active freebet the stake
 *       will be deducted from the freebet balance instead of the main wallet.
 *     tags: [PartnerBets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stake, cashierId, playerId, roundId]
 *             properties:
 *               stake:
 *                 type: number
 *                 example: 20
 *               cashierId:
 *                 type: string
 *                 description: MongoDB ObjectId of the cashier session.
 *                 example: 64a1f2c3b4d5e6f7a8b9c0d1
 *               playerId:
 *                 type: string
 *                 description: External player identifier (string, not ObjectId).
 *                 example: player_abc123
 *               deviceId:
 *                 type: string
 *                 description: MongoDB ObjectId of the player device (optional).
 *                 example: 64a1f2c3b4d5e6f7a8b9c0aa
 *               roundId:
 *                 type: string
 *                 example: round_001
 *               gameType:
 *                 type: string
 *                 example: aviator
 *     responses:
 *       "201":
 *         description: Player bet placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The created bet ticket document.
 *       "400":
 *         description: Validation error or insufficient player balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "404":
 *         description: Player or cashier not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /partner-bets/player/cashout:
 *   post:
 *     summary: Cash out a player bet at a given odd
 *     description: |
 *       Settles a specific player bet ticket at the provided odd.
 *       Used when a player chooses to cash out before the round ends.
 *     tags: [PartnerBets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ticketId, odd]
 *             properties:
 *               ticketId:
 *                 type: string
 *                 description: MongoDB ObjectId of the player's bet ticket.
 *                 example: 64a1f2c3b4d5e6f7a8b9c0d2
 *               odd:
 *                 type: number
 *                 description: The cashout multiplier/odd at the time of cashout.
 *                 example: 2.5
 *     responses:
 *       "201":
 *         description: Bet cashed out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The updated bet ticket.
 *       "404":
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /partner-bets/cancel/{id}:
 *   get:
 *     summary: Cancel a bet ticket 🔑
 *     description: |
 *       Cancels the bet ticket with the given ID. The ticket must belong to a cashier
 *       that is managed by the authenticated partner.
 *
 *       **Authentication:** `x-api-key` header (partner API key).
 *     tags: [PartnerBets]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the bet ticket to cancel.
 *         example: 64a1f2c3b4d5e6f7a8b9c0d2
 *     responses:
 *       "200":
 *         description: Ticket cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The cancelled bet ticket document.
 *       "401":
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "403":
 *         description: Ticket does not belong to this partner's cashiers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "404":
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /partner-bets/cashier-reports:
 *   get:
 *     summary: Get financial report for a partner cashier 🔑
 *     description: |
 *       Returns a financial summary for the specified cashier — including total stake,
 *       winnings, number of bets, jackpot payouts, and profit.
 *
 *       The cashier must belong to the authenticated partner.
 *
 *       **Authentication:** `x-api-key` header (partner API key).
 *     tags: [PartnerBets]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: cashierId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the cashier to report on.
 *         example: 64a1f2c3b4d5e6f7a8b9c0d1
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bets from this date (ISO 8601).
 *         example: "2026-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter bets up to this date (ISO 8601).
 *         example: "2026-04-15"
 *       - in: query
 *         name: gameType
 *         schema:
 *           type: string
 *         description: Filter by game type (e.g. "aviator").
 *         example: aviator
 *       - in: query
 *         name: betType
 *         schema:
 *           type: string
 *         description: Filter by bet type.
 *     responses:
 *       "200":
 *         description: Cashier financial report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: alice-cashier
 *                 totalStake:
 *                   type: number
 *                   example: 5000
 *                 totalWinnings:
 *                   type: number
 *                   example: 3200
 *                 numberOfBets:
 *                   type: integer
 *                   example: 42
 *                 profit:
 *                   type: number
 *                   example: 1800
 *                 totalClosedPayout:
 *                   type: number
 *                   example: 2800
 *                 totalOpenPayout:
 *                   type: number
 *                   example: 400
 *                 jackpot1Payout:
 *                   type: number
 *                   example: 0
 *                 jackpot2Payout:
 *                   type: number
 *                   example: 0
 *                 jackpot3Payout:
 *                   type: number
 *                   example: 0
 *                 jackpot1Contributions:
 *                   type: number
 *                   example: 250
 *                 jackpot2Contributions:
 *                   type: number
 *                   example: 150
 *                 jackpot3Contributions:
 *                   type: number
 *                   example: 50
 *       "400":
 *         description: cashierId param is missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 400
 *               message: cashierId query param is required
 *       "401":
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "403":
 *         description: Cashier does not belong to this partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// we only use apiKeyAuth middleware for partner routes
// all routes here require a valid api key to access
// this ensure that when apiKey is replaced all routes are protected
// however just passing apiKey is on every request is not very secure
// we can enhance this by adding HMAC or JWT token signed with apiKey secret
// to ensure that the request is indeed from the partner and not a replay attack
// for now we keep it simple
router
  .route('/')
  .post(
    apiKeyAuth('bets:write'),
    validate(betsValidation.createBetPlaced),
    partnerBetsController.createBetPlacedForThirdParty
  );
// .get(apiKeyAuth(), validate(betsValidation.fetchBetPlaced), partnerBetsController.fetchBetPlaced);

router
  .route('/player')
  .post(validate(betsValidation.createBetPlacedPlayer), partnerBetsController.createBetPlacedForThirdPartyPlayer);

router.route('/player/cashout').post(validate(betsValidation.cashoutPlayerTicket), partnerBetsController.cashoutPlayerBet);

router
  .route('/cancel/:id')
  .get(apiKeyAuth('bets:write'), validate(betsValidation.cancelTicket), partnerBetsController.cancelTicket);

router
  .route('/cashier-reports')
  .get(apiKeyAuth('bets:read'), validate(betsValidation.getAccountingReports), partnerBetsController.cashierReport);

module.exports = router;
