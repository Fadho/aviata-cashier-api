# Bet Placement Integration Guide

This guide documents cashier-side integration for Turbo Soccer bet placement endpoints under:

- /cashier/v1/turbo-soccer

All requests require Authorization: Bearer <access_token>.

## 1. Endpoint Summary

- POST /bets/place
- POST /bets/live
- POST /bets/validate
- GET /bets/history
- POST /bets/:betId/void

## 2. Pre-match or General Placement: POST /bets/place

The endpoint supports two request modes.

1. Single-selection mode
2. Multi-selection mode (`accumulator`, `combinator`, or `system`)

`type` is optional:

- If omitted and 1 leg is provided, type defaults to `single`.
- If omitted and 2+ legs are provided, type defaults to `accumulator`.

Type rules:

- `single` requires exactly 1 selection.
- `accumulator` requires at least 2 selections.
- `combinator` requires at least 2 selections.
- `system` requires at least 2 selections plus `systemSize`.

### 2.1 Single-selection payload

Required fields:

- cashierId
- stake
- matchId
- market
- selection

Optional fields:

- type (`single`, `accumulator`, `combinator`, `system`)
- requested_odds
- userId
- client_timestamp
- auto_accept_changes
- prematch

Example:

```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "matchId": "LEAGUE-001",
  "market": "match_winner",
  "selection": "home",
  "stake": 500,
  "requested_odds": 1.95,
  "client_timestamp": 1746624000000,
  "auto_accept_changes": true
}
```

### 2.2 Multi-selection payload

Required fields:

- cashierId
- stake
- selections[]

Optional fields:

- type (`single`, `accumulator`, `combinator`, `system`)
- systemSize

Per-leg required fields:

- matchId
- market
- selection

Per-leg optional fields:

- requested_odds
- is_banker
- homeTeam
- awayTeam
- client_timestamp
- any additional partner metadata fields (forwarded to VF Engine as-is)

Example:

```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "stake": 500,
  "auto_accept_changes": true,
  "selections": [
    {
      "matchId": "LEAGUE-001",
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 1.95,
      "homeTeam": "Manchester City",
      "awayTeam": "Liverpool FC"
    },
    {
      "matchId": "LEAGUE-004",
      "market": "btts",
      "selection": "GG",
      "requested_odds": 1.82,
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea"
    }
  ]
}
```

Combinator example:

```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "type": "combinator",
  "stake": 500,
  "selections": [
    {
      "matchId": "LEAGUE-001",
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 1.95
    },
    {
      "matchId": "LEAGUE-004",
      "market": "btts",
      "selection": "GG",
      "requested_odds": 1.82
    }
  ]
}
```

System + banker example:

```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "type": "system",
  "systemSize": 2,
  "stake": 1000,
  "selections": [
    {
      "matchId": "VFL-L01-S01-R012-M01",
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 2.0,
      "is_banker": true
    },
    {
      "matchId": "VFL-L01-S01-R012-M02",
      "market": "btts",
      "selection": "GG",
      "requested_odds": 2.0
    },
    {
      "matchId": "VFL-L01-S01-R012-M03",
      "market": "double_chance",
      "selection": "1X",
      "requested_odds": 2.0
    },
    {
      "matchId": "VFL-L01-S01-R012-M04",
      "market": "draw_no_bet",
      "selection": "away",
      "requested_odds": 2.0
    }
  ]
}
```

System rules:

- `systemSize` applies to non-banker selections only.
- Banker legs are marked with `is_banker: true`.
- Requested `stake` is interpreted as unit stake per generated line.
- Total stake = unit stake x lines generated.
- If any banker settles lost, the system ticket settles lost.
- Banker void is treated as odds `1.00`.

### 2.3 Combo-market selections

`/bets/place` supports combination-style single-leg combo markets. Use:

- `combo_result_ou25` with selections such as `1 & Over`, `X & Under`, `2 & Over`
- `combo_result_btts` with selections such as `1 & GG`, `X & NG`, `2 & GG`

Selection keys are case-sensitive and must match the odds packet labels exactly.

## 3. Live Placement: POST /bets/live

Required fields:

- cashierId
- stake
- market
- selection
- odds
- client_timestamp

Optional fields:

- matchId
- auto_accept_changes
- userId

Example:

```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "matchId": "LEAGUE-003",
  "market": "next_goal",
  "selection": "home",
  "stake": 200,
  "odds": 2.1,
  "client_timestamp": 1746624005000,
  "auto_accept_changes": true
}
```

## 4. Live Pre-flight Validation: POST /bets/validate

This endpoint validates live odds drift and does not place a bet.

Example:

```json
{
  "odds": 2.1,
  "client_timestamp": 1746624005000,
  "auto_accept_changes": false
}
```

## 5. Bet History: GET /bets/history

Returns the bet history from the VF Engine. Any authenticated user may call this.

**Query parameters:**

| Parameter | Type | Constraints | Default |
|---|---|---|---|
| `page` | integer | ≥ 1 | engine default |
| `limit` | integer | 1 – 100 | engine default |

Example:

```http
GET /cashier/v1/turbo-soccer/bets/history?page=1&limit=20
Authorization: Bearer <access_token>
```

Response shape is passed through directly from the VF Engine.

---

## 6. Void Bet: POST /bets/:betId/void

> Requires `admin` or `super` role (`manageGameConfig`).

**Path parameter:** `betId` — the VF Engine bet ID returned in the `placeBet` / `placeLiveBet` response.

**Body:**

| Field | Required | Description |
|---|---|---|
| `reason` | No | Human-readable void reason forwarded to the VF Engine |

Example:

```json
{
  "reason": "Operator error — incorrect odds displayed"
}
```

**What happens locally on void:**
1. The matching `Tickets` record is found by `betId`.
2. VF Engine is called to void the bet.
3. The local ticket is marked `cancelled: true`, `payout: true`.
4. The original stake is refunded to the cashier's wallet.

**Response `200`:** passes through the VF Engine void result.

---

## 7. Ticket Metadata Stored Locally

When a bet is accepted and persisted, selection-level metadata is stored in Tickets.selections[]:

- homeTeam
- awayTeam
- market
- selection
- odd
- oddsTaken
- betCategory
- stake

For single bets, betType is single.
For accumulator requests, betType is multiple.

## 8. Failure and Recovery Behavior

### Engine-level rejects

- MARKET_SUSPENDED -> HTTP 403
- MARKET_CLOSED -> HTTP 400
- ODDS_CHANGED -> HTTP 409 with current_odds
- NO_ACTIVE_MATCH -> HTTP 503

### Local consistency protection

If the engine accepts a bet but local ticket persistence fails, the cashier wallet debit is rolled back and the API returns HTTP 500.

Error message:

- Bet accepted by engine but could not be recorded locally; wallet has been restored
- Live bet accepted by engine but could not be recorded locally; wallet has been restored

## 9. Practical Integration Notes

1. For /bets/place single mode, always send matchId.
2. For /bets/place multi mode, always send matchId per leg in selections[].
3. Prefer fixture identity from schedule data when available; LEAGUE-* IDs are accepted for compatibility.
4. Disable bet submission while markets are suspended or odds payload is null.
5. Treat HTTP 409 ODDS_CHANGED as a recoverable UI flow: refresh shown odds, then resubmit.

## 10. Settlement Webhook Contract (Runtime)

Settlement is applied asynchronously via:

- POST /cashier/v1/turbo-soccer/webhooks/settlement

Current runtime behavior supports both payload forms:

1. Canonical: tickets_graded[] (preferred)
2. Legacy migration: bets[]

Supported events:

- MATCH_SETTLED
- MARKET_SETTLED
- settlement.complete (alias)
- market.settlement.complete (alias)

Ticket identifier resolution order per settled entry:

- ticket_hash -> ticketHash -> betId -> ticketId -> vfBetId

Status and payout rules:

- Accepted status values: WON, LOST, VOID (case-insensitive)
- Unknown status values are skipped safely
- Negative payout values are clamped to 0

For full payload examples and logging details, see docs/turbo-soccer-integration.md section 9.
