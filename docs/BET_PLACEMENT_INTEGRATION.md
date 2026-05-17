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
2. Multi-selection mode (accumulator)

### 2.1 Single-selection payload

Required fields:

- cashierId
- stake
- matchId
- market
- selection

Optional fields:

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

Per-leg required fields:

- matchId
- market
- selection

Per-leg optional fields:

- requested_odds
- homeTeam
- awayTeam
- client_timestamp

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

## 5. Ticket Metadata Stored Locally

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

## 6. Failure and Recovery Behavior

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

## 7. Practical Integration Notes

1. For /bets/place single mode, always send matchId.
2. For /bets/place multi mode, always send matchId per leg in selections[].
3. Prefer fixture identity from schedule data when available; LEAGUE-* IDs are accepted for compatibility.
4. Disable bet submission while markets are suspended or odds payload is null.
5. Treat HTTP 409 ODDS_CHANGED as a recoverable UI flow: refresh shown odds, then resubmit.
