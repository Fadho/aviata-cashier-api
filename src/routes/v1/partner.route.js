const express = require('express');
const { auth, apiKeyAuth } = require('../../middlewares/auth');

const validate = require('../../middlewares/validate');
const partnerValidation = require('../../validations/partner.validation');
const partnerController = require('../../controllers/partner.controller');
// const partnerBetsController = require('../../controllers/partner.bets.controller');
const partnerAuthController = require('../../controllers/partner.auth.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Partner
 *   description: |
 *     Partner integration API — manage API keys and launch game sessions.
 *
 *     **Authentication:**
 *     - Most management endpoints require a standard **Bearer JWT** token (`auth()`).
 *     - The `/game-launcher` endpoint uses an **API key** passed in the
 *       `x-api-key` header (`apiKeyAuth()`).
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiKey:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 64a1f2c3b4d5e6f7a8b9c0d1
 *         partnerId:
 *           type: string
 *           example: 64a1f2c3b4d5e6f7a8b9c0aa
 *         keyName:
 *           type: string
 *           example: production-key
 *         status:
 *           type: string
 *           enum: [active, revoked]
 *           example: active
 *         scopes:
 *           type: array
 *           items:
 *             type: string
 *           example: []
 *         expiresAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     GameLaunchResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: Short-lived JWT access token for the cashier session.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         url:
 *           type: string
 *           description: Full game-launcher URL with the token embedded as a query parameter.
 *           example: https://aviata.cashier.sbegames.com?token=eyJhbGciOiJIUzI1N...
 */

/**
 * @swagger
 * /partner:
 *   post:
 *     summary: Generate a new API key
 *     description: |
 *       Creates a new API key for the authenticated partner. The raw key is returned
 *       **once** and is never stored in plain text — save it immediately.
 *
 *       Multiple keys can coexist to support key rotation without downtime.
 *     tags: [Partner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyName]
 *             properties:
 *               keyName:
 *                 type: string
 *                 description: A human-readable label for this key.
 *                 example: production-key
 *     responses:
 *       "201":
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                   description: The raw API key — shown only once.
 *                   example: tw_api_a1b2c3d4e5f6...
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /partner/listPartnerKeys:
 *   get:
 *     summary: List API keys for the authenticated partner
 *     description: |
 *       Returns all API keys associated with the authenticated partner.
 *       Key hashes are excluded from the response — only metadata is returned.
 *     tags: [Partner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKeys:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */

/**
 * @swagger
 * /partner/deletePartnerKey:
 *   post:
 *     summary: Revoke and delete an API key
 *     description: |
 *       Permanently deletes the specified API key. Any requests using this key
 *       will immediately receive `401 Unauthorized`.
 *     tags: [Partner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [apiKeyId]
 *             properties:
 *               apiKeyId:
 *                 type: string
 *                 description: MongoDB ObjectId of the API key to delete.
 *                 example: 64a1f2c3b4d5e6f7a8b9c0d1
 *     responses:
 *       "204":
 *         description: API key deleted
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 404
 *               message: API key not found
 */

/**
 * @swagger
 * /partner/thirdPartyCashierDetails:
 *   post:
 *     summary: Retrieve cashier details from the third-party system
 *     description: |
 *       Proxies a request to the partner's own `userDetails` endpoint and returns
 *       the cashier data. The partner's `url` field is used as the base URL.
 *
 *       Requires a valid **Bearer JWT** token issued to an authenticated admin/agent cashier.
 *     tags: [Partner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 description: The cashier username to look up in the partner system.
 *                 example: alice
 *     responses:
 *       "200":
 *         description: Cashier details returned from the partner system
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Shape is determined by the partner's own API response.
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         description: Partner or cashier not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /partner/game-launcher:
 *   post:
 *     summary: Launch a game session for a player cashier
 *     description: |
 *       The primary integration endpoint for third-party operators.
 *
 *       Given a `partner_cashier_username` and a wallet balance, this endpoint:
 *       1. **Finds** the cashier by username under the authenticated agent — or
 *          **creates** a new cashier account if none exists.
 *       2. **Syncs** the cashier's wallet to the provided `wallet` balance on every call.
 *       3. Generates a short-lived **JWT access token** for that cashier.
 *       4. Returns the token and a ready-to-use **game launcher URL** with the token
 *          embedded as a query parameter.
 *
 *       **Authentication:** Pass the partner API key in the `x-api-key` header.
 *
 *       **Typical integration flow:**
 *       ```
 *       1. Player initiates a game on your platform.
 *       2. Your backend calls POST /partner/game-launcher with the player's username
 *          and their current balance.
 *       3. Redirect or open the returned `url` in a WebView / iframe.
 *       4. The game authenticates automatically using the token in the URL.
 *       ```
 *
 *       > The `wallet` balance is **overwritten** (not incremented) on every call.
 *       > Send the player's current balance each time.
 *     tags: [Partner]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partner_cashier_username, wallet]
 *             properties:
 *               partner_cashier_username:
 *                 type: string
 *                 description: |
 *                   Username that identifies the player/cashier in the partner system.
 *                   Case-insensitive — normalised to lowercase internally.
 *                 example: alice
 *               wallet:
 *                 type: number
 *                 description: Current wallet balance to sync for this cashier session.
 *                 example: 500
 *     responses:
 *       "200":
 *         description: Game session created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameLaunchResponse'
 *             example:
 *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               url: https://aviata.cashier.sbegames.com?token=eyJhbGciOiJIUzI1N...
 *       "400":
 *         description: Validation error or currency not configured for this partner
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingFields:
 *                 summary: Required field missing
 *                 value:
 *                   code: 400
 *                   message: '"partner_cashier_username" is required'
 *               currencyNotFound:
 *                 summary: Partner currency not found
 *                 value:
 *                   code: 400
 *                   message: "Currency 'ETB' not found"
 *       "401":
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 401
 *               message: Invalid API key
 */

router.route('/').post(auth(), partnerController.createApiKey);

router.route('/listPartnerKeys').get(auth(), partnerController.listApiKeys);

router.route('/deletePartnerKey').post(auth(), validate(partnerValidation.removeApiKey), partnerController.removeApiKey);

router
  .route('/thirdPartyCashierDetails')
  .post(auth(), validate(partnerValidation.getThirdPartyCashierDetails), partnerAuthController.thirdPartyCashierDetails);

router.route('/game-launcher').post(apiKeyAuth(), validate(partnerValidation.launchGame), partnerAuthController.launchGame);

module.exports = router;
