# SBEGAMES API Integration Guide

Version: 1.8.0

Base path for SBEGAMES endpoints: `/cashier/v1`

This guide defines the standards for third-party partners integrating with SBEGAMES. It covers two directions of traffic:

- Partner-hosted wallet callbacks that SBEGAMES calls during game and wallet operations.
- SBEGAMES-hosted partner endpoints that partners call to manage API keys, list games, and launch sessions.

All financial requests must use HTTPS, JSON request bodies, JSON responses, and deterministic transaction handling.

## Authentication Header Summary

SBEGAMES uses different authentication headers for different parts of the integration:

| Traffic | Header | Purpose |
|---|---|---|
| Partner admin to SBEGAMES management endpoints | `Authorization: Bearer <partner_admin_access_token>` | Create, list, or revoke partner API keys. |
| Partner backend to SBEGAMES runtime endpoints | `x-api-key: tw_api_<partner_api_key>` | List games, launch sessions, place partner bets, and read reports. |
| SBEGAMES to partner-hosted callbacks | Agreed during onboarding | Partners should validate the configured source IPs and any callback secret or signature agreed with SBEGAMES. |

## 1. Integration Overview

1. Provide SBEGAMES with your production API base URL and server IP addresses for whitelisting.
2. Implement the required partner-hosted wallet callback endpoints.
3. Receive or create a partner admin account with `thirdParty: true`.
4. Generate a partner API key from the Partner Dashboard or API key management endpoint.
5. Call `GET /cashier/v1/partner/games` to list available games.
6. For each player session, call `POST /cashier/v1/partner/game-launcher` with the player's username, current wallet balance, and current wallet version.
7. Redirect the player to the returned game launcher URL.
8. Process debit, credit, and rollback callback requests idempotently.

## 2. Partner-Hosted Callback Endpoints

Partners must expose these endpoints under the API base URL provided to SBEGAMES:

```text
POST {{thirdPartyAPI}}/debit
POST {{thirdPartyAPI}}/credit
POST {{thirdPartyAPI}}/cashierDetails
POST {{thirdPartyAPI}}/rollback
```

All endpoints must accept `Content-Type: application/json` and return `application/json`.

### 2.1 Debit

Deducts funds from a player's wallet when a bet is placed.

```http
POST {{thirdPartyAPI}}/debit
Content-Type: application/json
```

Request:

```json
{
  "username": "cashier1",
  "transactionId": "TXN123456789",
  "playerId": 1,
  "amount": 100.5,
  "currency": "USD",
  "gameId": "AVIATORX",
  "timestamp": "2025-09-16T18:20:00Z"
}
```

Field notes:

| Field | Type | Required | Notes |
|---|---:|:---:|---|
| `username` | string | Yes | Cashier or player username in the partner system. |
| `transactionId` | string | Yes | Unique transaction reference. Must be idempotent. |
| `playerId` | string/number | No | Optional external player identifier, depending on the game. |
| `amount` | number | Yes | Amount to deduct. Must be greater than `0`. |
| `currency` | string | Yes | ISO currency code, for example `USD` or `NGN`. |
| `gameId` | string | Yes | Game identifier supplied by SBEGAMES. |
| `timestamp` | string | Yes | ISO 8601 UTC timestamp. |

Success response:

```json
{
  "status": "success",
  "transactionId": "TXN123456789",
  "balance": 450
}
```

If the same `transactionId` is received again with the same payload, return the original successful response without debiting the wallet again.

### 2.2 Credit

Credits funds back to a player's wallet, for example after a win, cashout, or settlement.

```http
POST {{thirdPartyAPI}}/credit
Content-Type: application/json
```

Request:

```json
{
  "username": "cashier1",
  "transactionId": "TXN789012",
  "playerId": 1,
  "amount": 120,
  "currency": "USD",
  "gameId": "AVIATORX",
  "timestamp": "2025-09-16T18:25:00Z"
}
```

Success response:

```json
{
  "status": "success",
  "transactionId": "TXN789012",
  "balance": 570
}
```

If the same `transactionId` is received again with the same payload, return the original successful response without crediting the wallet again.

### 2.3 Cashier Details

Returns wallet details for a cashier or player before a session starts or when SBEGAMES needs to resync balance data.

```http
POST {{thirdPartyAPI}}/cashierDetails
Content-Type: application/json
```

Request:

```json
{
  "username": "cashier1"
}
```

Success response:

```json
{
  "status": "success",
  "playerId": 1,
  "balance": 570,
  "currency": "USD"
}
```

Implementation notes:

- `username` should be treated case-insensitively where possible.
- Return the available playable balance, not total account value if bonus, locked, or reserved funds are tracked separately.
- If your integration was configured before this endpoint name was standardized, confirm with SBEGAMES whether `/userDetails` is still enabled as a legacy alias.

### 2.4 Rollback

Reverts a previous debit or credit transaction, for example after a failed bet, canceled round, or settlement correction.

```http
POST {{thirdPartyAPI}}/rollback
Content-Type: application/json
```

Request:

```json
{
  "transactionId": "TXN123456789",
  "rollbackTransactionId": "RBK987654",
  "reason": "Bet placement failed",
  "timestamp": "2025-09-16T18:21:00Z"
}
```

Success response:

```json
{
  "status": "success",
  "transactionId": "TXN123456789",
  "rollbackTransactionId": "RBK987654",
  "balance": 500
}
```

Rollback rules:

- Roll back only the referenced original transaction.
- A rollback must be idempotent by `rollbackTransactionId`.
- If the original transaction was already rolled back, return the original rollback response.
- If the original transaction does not exist, return a clear error response and do not mutate balance.

## 3. Callback Error Responses

Use meaningful HTTP status codes and a stable JSON body.

```json
{
  "status": "error",
  "code": "INSUFFICIENT_FUNDS",
  "message": "Insufficient wallet balance"
}
```

Recommended status codes:

| HTTP | Use case |
|---:|---|
| `400` | Malformed request, missing required field, invalid amount, or unsupported currency. |
| `401` | Missing or invalid callback authentication, if configured. |
| `403` | Request source is not allowed or wallet is not permitted to transact. |
| `404` | Username, player, or original transaction was not found. |
| `409` | Duplicate transaction ID with conflicting payload. |
| `422` | Valid JSON but business rule failed, for example insufficient funds. |
| `500` | Unexpected partner-side processing error. |

## 4. Domain and IP Whitelisting

Partners must provide their API base domain and server IP addresses to SBEGAMES before launch.

Example:

```text
Domain URL: https://partnerdomain.com/api
Server IP: 203.0.113.25
```

Requirements:

- Use HTTPS with a valid public SSL certificate.
- Do not use embedded credentials in URLs.
- Keep callback endpoints reachable from SBEGAMES production infrastructure.
- Notify SBEGAMES before changing domains, IP addresses, TLS certificates, firewalls, or CDN routing.
- Keep callback response times low. SBEGAMES treats slow or unreachable partner endpoints as failed financial operations.

## 5. Partner API Key Management

Partners call SBEGAMES runtime endpoints with an API key in the `x-api-key` header.

```http
x-api-key: tw_api_<64_hex_characters>
```

API keys are scoped. Supported scopes:

| Scope | Access |
|---|---|
| `*` | Full partner API access. |
| `game:launch` | Launch player game sessions. |
| `games:read` | List available games. |
| `bets:write` | Place and cancel partner bets. |
| `bets:read` | Read partner cashier reports. |

Invalid, expired, revoked, malformed, or inactive-partner keys return `401 Unauthorized`. A valid key without the route's required scope returns `403 Forbidden`.

### 5.1 Create API Key

This management endpoint requires a Bearer JWT for the authenticated partner admin, not the partner API key.

```http
POST /cashier/v1/partner
Authorization: Bearer <partner_admin_access_token>
Content-Type: application/json
```

Request:

```json
{
  "keyName": "production-launcher",
  "scopes": ["game:launch", "games:read"],
  "expiryDays": 90
}
```

Rules:

- `keyName` is required and must be unique enough for your operations team to identify the key.
- `scopes` is optional and defaults to `["*"]`.
- `expiryDays` must be between `1` and `365`.

Response `201 Created`:

```json
{
  "apiKey": "tw_api_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

The raw API key is returned only once. Store it securely.

### 5.2 List API Keys

```http
GET /cashier/v1/partner/listPartnerKeys
Authorization: Bearer <partner_admin_access_token>
```

Response `200 OK`:

```json
{
  "apiKeys": [
    {
      "id": "64a1f2c3b4d5e6f7a8b9c0d1",
      "partnerId": "64a1f2c3b4d5e6f7a8b9c0aa",
      "keyName": "production-launcher",
      "status": "active",
      "scopes": ["game:launch", "games:read"],
      "expiresAt": "2026-11-18T12:00:00.000Z",
      "lastUsedAt": "2026-08-20T12:00:00.000Z"
    }
  ]
}
```

### 5.3 Revoke API Key

```http
POST /cashier/v1/partner/deletePartnerKey
Authorization: Bearer <partner_admin_access_token>
Content-Type: application/json
```

Request:

```json
{
  "apiKeyId": "64a1f2c3b4d5e6f7a8b9c0d1"
}
```

Response `204 No Content`.

Requests using the revoked key immediately fail with `401 Unauthorized`.

## 6. List Available Games

Use this endpoint to discover the games a partner can launch and any partner-specific settings already configured on the cashier service.

```http
GET /cashier/v1/partner/games
x-api-key: tw_api_<partner_api_key>
```

Required scope: `games:read`

Response `200 OK`:

```json
{
  "games": [
    {
      "gameType": "aviata",
      "name": "Aviata",
      "settings": {
        "gameType": "aviata",
        "roundWaitTimeValue": 10,
        "timerCountdownValue": 30,
        "roundBetsLimit": 10,
        "rtp": 95
      },
      "config": {
        "gameType": "aviata",
        "ticketStakeMin": 100,
        "ticketStakeMax": 10000,
        "ticketSizeMin": 1,
        "ticketSizeMax": 50,
        "quickPick": [50, 100, 200, 500],
        "payoutMode": "Manual",
        "defaultStake": 100,
        "depositBonus": 0.1
      }
    },
    {
      "gameType": "turbo-soccer",
      "name": "Turbo Soccer",
      "settings": null,
      "config": null
    }
  ]
}
```

Supported game types:

- `aviata`
- `shootout`
- `aviatax`
- `turbo-soccer`

`settings` or `config` can be `null` when no partner-specific record exists yet.

## 7. Launch a Game Session

Once the player is authenticated on the partner platform, call the SBEGAMES game-launch endpoint to obtain a short-lived cashier access token and a ready-to-use launcher URL.

```http
POST /cashier/v1/partner/game-launcher
x-api-key: tw_api_<partner_api_key>
Content-Type: application/json
```

Required scope: `game:launch`

Request:

```json
{
  "partner_cashier_username": "player_9821",
  "wallet": 250,
  "wallet_version": 42
}
```

Fields:

| Field | Type | Required | Notes |
|---|---:|:---:|---|
| `partner_cashier_username` | string | Yes | Stable player or cashier identifier from your system. Case-insensitive and normalized to lowercase internally. |
| `wallet` | number | Yes | Player's current available balance. This is an absolute balance, not a delta. |
| `wallet_version` | integer | Yes | Monotonically increasing balance version from your wallet ledger. Used to reject stale balance updates. |

Response `200 OK`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "url": "https://games.sbegames.com/launch?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Open or redirect the player to `url`. The returned token is short-lived and scoped to the cashier session. Generate a new token for each session.

### Wallet Version Rules

SBEGAMES uses `wallet_version` to prevent stale balance overwrites.

| Condition | Result |
|---|---|
| Newer `wallet_version` with any valid balance | Accepted and wallet is updated. |
| Same `wallet_version` with the same balance | Accepted as idempotent. |
| Same `wallet_version` with a different balance | Rejected with `409 Conflict`. |
| Lower `wallet_version` | Rejected with `409 Conflict`. |

Example conflict response:

```json
{
  "code": 409,
  "message": "Stale or conflicting wallet_version"
}
```

## 8. Partner Bet Endpoints

These SBEGAMES endpoints are under `/cashier/v1/partner-bets` and use `x-api-key`.

### 8.1 Place Partner Bet

```http
POST /cashier/v1/partner-bets
x-api-key: tw_api_<partner_api_key>
Content-Type: application/json
```

Required scope: `bets:write`

Request:

```json
{
  "cashierId": "64a1f2c3b4d5e6f7a8b9c0d1",
  "roundId": "round_001",
  "stake": 50,
  "potentialWinnings": 150,
  "gameType": "aviata",
  "currency": "NGN",
  "selections": [
    {
      "odd": 3,
      "stake": 50
    }
  ]
}
```

The cashier must belong to the authenticated partner. For non-Turbo Soccer games, SBEGAMES may call the partner-hosted `/debit` endpoint before creating the local ticket.

Turbo Soccer uses the launched cashier session. After calling `POST /cashier/v1/partner/game-launcher`, place Turbo Soccer bets with the returned cashier JWT:

```http
POST /cashier/v1/turbo-soccer/bets/place
Authorization: Bearer <cashier_session_token>
Content-Type: application/json
```

Request:

```json
{
  "cashierId": "64a1f2c3b4d5e6f7a8b9c0d1",
  "matchId": "match-99",
  "market": "1X2",
  "selection": "1",
  "stake": 50,
  "requested_odds": 2.5
}
```

### 8.2 Cancel Ticket

```http
GET /cashier/v1/partner-bets/cancel/64a1f2c3b4d5e6f7a8b9c0d2
x-api-key: tw_api_<partner_api_key>
```

Required scope: `bets:write`

The ticket must belong to a cashier under the authenticated partner.

### 8.3 Cashier Report

```http
GET /cashier/v1/partner-bets/cashier-reports?cashierId=64a1f2c3b4d5e6f7a8b9c0d1&gameType=aviata&startDate=2026-08-01&endDate=2026-08-20
x-api-key: tw_api_<partner_api_key>
```

Required scope: `bets:read`

## 9. SBEGAMES Error Reference

SBEGAMES error body format:

```json
{
  "code": 400,
  "message": "Validation message"
}
```

Common errors:

| HTTP | Meaning |
|---:|---|
| `400` | Validation error, invalid partner endpoint, missing currency, or invalid wallet payload. |
| `401` | Missing, malformed, invalid, expired, or revoked API key. |
| `403` | Valid API key without the required scope, or non-partner account access. |
| `404` | API key, cashier, ticket, or other referenced resource was not found. |
| `409` | Stale or conflicting `wallet_version`. |
| `502` | Partner callback endpoint request failed. |

## 10. Production Readiness Checklist

- Use HTTPS for every endpoint.
- Implement idempotency for `debit`, `credit`, and `rollback`.
- Store every request and response with transaction IDs for audit and reconciliation.
- Keep API keys out of frontend applications, mobile apps, and browser storage.
- Use separate API keys per environment and integration component.
- Prefer least-privilege scopes, for example `["games:read", "game:launch"]` for launcher-only integrations.
- Rotate keys before expiry and revoke old keys after the new key is active.
- Treat `wallet_version` as an immutable balance sequence number from your wallet ledger.
- Retry `409 Conflict` only after reading the latest wallet balance and incrementing `wallet_version`.
- Alert on callback failures, duplicate conflicts, rollback failures, and settlement mismatches.
