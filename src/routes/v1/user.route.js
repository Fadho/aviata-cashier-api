const express = require('express');
const { auth, apiKeyAuth } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const userValidation = require('../../validations/user.validation');
const userController = require('../../controllers/user.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), validate(userValidation.getUser), userController.getUser)
  .post(validate(userValidation.createUser), userController.createUser);

router.route('/searchForUser').get(auth(), validate(userValidation.searchForUser), userController.searchForUser);

router
  .route('/agent/:agentId')
  .delete(auth('manageUsers'), validate(userValidation.deleteAgent), userController.deleteAgent);

router
  .route('/agent/:agentId/tenantship')
  .patch(auth('manageUsers'), validate(userValidation.transferAgentTenantship), userController.transferAgentTenantship);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       description: A user with role 'agent'
 *       properties:
 *         id:
 *           type: string
 *           example: 64a1f2c3b4d5e6f7a8b9c0d1
 *         name:
 *           type: string
 *           example: Addis Branch Agent
 *         username:
 *           type: string
 *           example: addis_agent_01
 *         email:
 *           type: string
 *           format: email
 *           example: agent@sbegames.com
 *         role:
 *           type: string
 *           enum: [agent]
 *           example: agent
 *         currency:
 *           type: string
 *           example: ETB
 *         agentId:
 *           type: string
 *           nullable: true
 *           example: null
 *         superAgentId:
 *           type: string
 *           example: 64a1f2c3b4d5e6f7a8b9c0d9
 *         isActive:
 *           type: boolean
 *           example: true
 *         wallets:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: 64a1f2c3b4d5e6f7a8b9c0e1
 *               balance:
 *                 type: number
 *                 example: 15000
 *               primaryWallet:
 *                 type: boolean
 *                 example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /users/agent/{agentId}:
 *   delete:
 *     summary: Delete an agent and all related data
 *     description: |
 *       Permanently deletes an agent user and **cascades deletion** to all owned data in a
 *       single pass. The following collections are affected:
 *
 *       | Collection | Deleted records |
 *       |---|---|
 *       | `User` | The agent + all cashiers where `agentId` = this agent |
 *       | `Player` | All players where `agentId` = this agent |
 *       | `Wallets` | All wallets for the agent and its cashiers |
 *       | `Token` | All auth tokens for the agent and its cashiers |
 *       | `GameConfig` | All game configs for this agent |
 *       | `FinancialReport` | All financial reports for this agent |
 *       | `GameReport` | All game reports for this agent |
 *       | `ApiKey` | All API keys issued to this agent |
 *       | `PartnerLog` | All logs where agent is partner or super agent |
 *       | `TransferHistory` | All entries where agent appears as actor, target, or super agent |
 *
 *       > **This action is irreversible. There is no soft-delete or recovery.**
 *
 *       **Authorization:**
 *       - `super` role may delete any agent.
 *       - `admin` role may only delete agents whose `superAgentId` matches their own ID.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the agent to delete
 *         example: 64a1f2c3b4d5e6f7a8b9c0d1
 *     responses:
 *       "204":
 *         description: Agent and all cascaded data permanently deleted
 *       "400":
 *         description: Target user is not an agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 400
 *               message: User is not an agent
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         description: Requesting user does not own this agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 403
 *               message: You do not have permission to delete this agent
 *       "404":
 *         description: Agent not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 404
 *               message: Agent not found
 */

/**
 * @swagger
 * /users/agent/{agentId}/tenantship:
 *   patch:
 *     summary: Transfer an agent to a new super agent (tenant)
 *     description: |
 *       Reassigns an agent from its current super agent to a new one.
 *       All writes are wrapped in a **MongoDB transaction** — the operation is fully atomic.
 *       If any step fails, every change is automatically rolled back.
 *
 *       | Collection | Field updated | Filter |
 *       |---|---|---|
 *       | `User` (agent) | `superAgentId` | `_id = agentId` |
 *       | `User` (cashiers) | `superAgentId` | `agentId = agentId` |
 *       | `Player` | `superAgentId` | `agentId = agentId` |
 *       | `FinancialReport` | `superAgentId` | `agentId = agentId` |
 *       | `GameReport` | `superAgentId` | `agentId = agentId` |
 *       | `TransferHistory` | `superAgentId` | `agent = agentId` |
 *
 *       **Preconditions (400 if violated):**
 *       - Target must have role `agent`
 *       - `newSuperAgentId` must resolve to a user with role `super` or `admin`
 *       - `agentId` ≠ `newSuperAgentId` (no self-assignment)
 *       - Agent must already have a `superAgentId` (orphaned agents cannot be transferred)
 *       - Agent must not already belong to `newSuperAgentId`
 *
 *       **Authorization:**
 *       - `super` role may transfer any agent to any super agent.
 *       - `admin` role may only transfer agents whose current `superAgentId` matches their own ID.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the agent to transfer
 *         example: 64a1f2c3b4d5e6f7a8b9c0d1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newSuperAgentId
 *             properties:
 *               newSuperAgentId:
 *                 type: string
 *                 description: MongoDB ObjectId of the new super agent (must have role super or admin)
 *                 example: 64a1f2c3b4d5e6f7a8b9c0d2
 *     responses:
 *       "200":
 *         description: Transfer committed; returns the freshly-fetched, populated agent document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Agent'
 *       "400":
 *         description: |
 *           One of the following preconditions failed:
 *           - Target user is not an agent
 *           - `agentId` equals `newSuperAgentId` (self-assignment)
 *           - New super agent does not have role `super` or `admin`
 *           - Agent already belongs to the requested super agent (no-op)
 *           - Agent has no current `superAgentId` (orphaned agent)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 400
 *               message: Agent already belongs to this super agent
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         description: Requesting user does not own this agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 403
 *               message: You do not have permission to transfer this agent
 *       "404":
 *         description: Agent or new super agent not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               code: 404
 *               message: New super agent not found
 *       "500":
 *         description: Transaction aborted due to a database error — no data was modified
 */

module.exports = router;
