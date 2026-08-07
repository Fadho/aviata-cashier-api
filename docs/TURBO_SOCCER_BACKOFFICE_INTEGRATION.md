# Turbo Soccer Back-Office/Admin Integration Guide

> **Contract version:** VF Engine 1.7.0  
> **Cashier API base path:** `/cashier/v1/turbo-soccer`  
> **Audience:** back-office frontend developers, administrators, and operators
> **Latest:** league-market and active-match-market margin overrides with inherited-margin reset

This guide documents the Turbo Soccer administration endpoints exposed through `aviata-cashier-api`. The cashier API authenticates the administrator locally, validates the request, creates an admin-scoped service JWT, and proxies the operation to VF Engine.

For cashier betting, display, WebSocket, and settlement-webhook integration, see [turbo-soccer-integration.md](./turbo-soccer-integration.md).

## 1. Authentication and authorization

Every route in this guide requires a cashier API access token:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

The authenticated local user must have the `manageGameConfig` right. The built-in `admin` and `super` roles have this right; a `cashier` does not.

Expected authorization failures:

| Status | Meaning |
|---|---|
| `401` | Access token is missing, invalid, or expired |
| `403` | User is authenticated but lacks `manageGameConfig` |

The frontend must never generate or send the VF Engine JWT. The cashier API generates that token internally with `operatorId` and `role: "admin"` claims. The VF Engine accepts either `admin` or `super` for direct privileged service tokens.

## 2. Deployment configuration

The cashier API requires these environment variables:

```dotenv
VFENGINE_BASE_URL=https://engine.example.com
VFENGINE_JWT_SECRET=<shared-engine-jwt-secret>
VFENGINE_OPERATOR_ID=<operator-id>
VFENGINE_WEBHOOK_SECRET=<minimum-32-character-webhook-secret>
```

`VFENGINE_JWT_SECRET` falls back to the cashier API's `JWT_SECRET` when omitted. The value must match VF Engine's `JWT_SECRET`. Restart the cashier API after changing any of these variables.

VF Engine also requires MongoDB for durable back-office mutations. If its database is unavailable, mutation endpoints return `503`; configuration is not silently retained only in memory.

Margin configuration is persisted by scope: league-wide, individual league market, match-wide, and individual match market. Stored league-market overrides apply to active runners and future odds controllers. Stored match-market overrides are restored if that match is initialized again.

## 3. Response and error handling

Successful VF Engine status codes and response bodies are passed through unchanged. For example, league creation returns `201`, while most reads and updates return `200`.

VF Engine errors are exposed using the cashier API error shape:

```json
{
  "code": 400,
  "message": "margin must be less than or equal to 1.3",
  "error_code": "BAD_REQUEST"
}
```

| Status | Typical cause |
|---|---|
| `400` | Invalid path, query, or body value |
| `404` | League, match, or ticket was not found |
| `409` | Duplicate/conflicting state or an already-settled ticket |
| `502` | Cashier API cannot reach VF Engine |
| `503` | VF Engine persistence or an active runtime dependency is unavailable |

## 4. League administration

### List and inspect leagues

```http
GET /cashier/v1/turbo-soccer/admin/leagues
GET /cashier/v1/turbo-soccer/admin/leagues/:id
```

### Create a league

```http
POST /cashier/v1/turbo-soccer/admin/leagues
```

```json
{
  "leagueId": "NIGHT_LEAGUE",
  "leagueName": "Night League",
  "teams": ["Arsenal", "Chelsea", "Liverpool FC", "Manchester City"],
  "matchDurationMin": 9,
  "preMatchDurationMin": 2,
  "margin": 1.08,
  "startDate": "2026-07-13T20:00:00.000Z"
}
```

Validation rules:

- `leagueId` and `leagueName` are required.
- `teams` must contain at least two unique names and have an even number of entries.
- `matchDurationMin` must be positive.
- `preMatchDurationMin` must be zero or positive.
- `margin`, when provided, must be from `1.00` through `1.30`.
- `startDate` must be an ISO-8601 date.

A successful response returns `201`. Creation is durable immediately, but the response reports `runtimeApplied: false` and `restartRequired: true`; restart VF Engine to create the league runner.

### Generate and inspect a schedule

```http
POST /cashier/v1/turbo-soccer/admin/leagues/:id/schedule
GET  /cashier/v1/turbo-soccer/admin/leagues/:id/schedule
```

The generated schedule is a double round-robin: every team appears once per matchday, and the second half reverses the home and away fixtures.

### Delete a league

```http
DELETE /cashier/v1/turbo-soccer/admin/leagues/:id
```

Deletion is durable, but runner removal takes effect after VF Engine restarts. Check `restartRequired` in the response.

### Inspect and persist progression

```http
GET  /cashier/v1/turbo-soccer/admin/leagues/progression
GET  /cashier/v1/turbo-soccer/admin/leagues/progression?league=PREMIER
POST /cashier/v1/turbo-soccer/admin/leagues/progression/persist
```

The progression response includes current season, matchday, slot, fixture, kickoff, and phase data. The persist operation writes the current runtime snapshot to VF Engine's JSON fallback file. It does not replace Mongo-backed administrator configuration.

## 5. Margin and RTP controls

Margin is an over-round multiplier. `1.00` has no bookmaker margin; `1.08` is an 8% over-round and approximately 92.59% theoretical RTP.

### List margins

```http
GET /cashier/v1/turbo-soccer/admin/margins
```

### Preview a margin

```http
GET /cashier/v1/turbo-soccer/admin/margins/preview?margin=1.12
```

This operation previews representative odds without changing runtime state. The accepted range is `1.00` through `1.30`.

### Get or update a league margin

```http
GET /cashier/v1/turbo-soccer/admin/leagues/:id/margin
PUT /cashier/v1/turbo-soccer/admin/leagues/:id/margin
```

```json
{ "margin": 1.1 }
```

The update is persisted. `runtimeApplied: true` means an active runner also received the new value immediately.

### Update an active match margin

```http
PUT /cashier/v1/turbo-soccer/admin/match/:matchId/margin
```

```json
{ "margin": 1.1 }
```

The path must contain the exact active match ID. The update applies immediately, is persisted, and creates an audit entry.

### Individual market margins

```http
GET /cashier/v1/turbo-soccer/admin/leagues/:id/markets/:marketId/margin
PUT /cashier/v1/turbo-soccer/admin/leagues/:id/markets/:marketId/margin
DELETE /cashier/v1/turbo-soccer/admin/leagues/:id/markets/:marketId/margin
GET /cashier/v1/turbo-soccer/admin/match/:matchId/margins
GET /cashier/v1/turbo-soccer/admin/match/:matchId/markets/:marketId/margin
PUT /cashier/v1/turbo-soccer/admin/match/:matchId/markets/:marketId/margin
DELETE /cashier/v1/turbo-soccer/admin/match/:matchId/markets/:marketId/margin
```

The PUT body remains `{ "margin": 1.14 }`. Market overrides take precedence over the league-wide or match-wide margin. Read `supportedMarketIds` from `GET /admin/margins` or the league-margin response before presenting market choices.

Effective margin precedence is:

1. Exact market override, such as `milestones.35`.
2. Parent group override, such as `milestones`.
3. Match-wide or league-wide margin.
4. VF Engine default margin.

#### Supported market IDs

| Market family | Accepted `marketId` values |
|---|---|
| Main result | `match_winner`, `one_up`, `two_up`, `double_chance`, `draw_no_bet`, `btts` |
| Match goals | `goals.over_under_15`, `goals.over_under_25`, `goals.over_under_35`, `goals.over_under_45`, `goals.over_under_55`, `goals.over_under_65`, `goals.over_under_75`, `goals.over_under_85`, `goals.over_under_95` |
| Combination markets | `combos.match_result_and_btts`, `combos.match_result_and_gg`, `combos.double_chance_and_gg` |
| Match milestones | `milestones`, or `milestones.<minute>` for a minute from `1` through `90` such as `milestones.35` |
| Rest of match | `rest_of_match.win`, `rest_of_match.btts`, `rest_of_match.over_under_05` |
| Team specials | `team_specials.clean_sheets` |
| Handicap, corner, and card markets | `handicaps`, `corners`, `cards`, `corners_lines`, `yellow_card_lines`, `red_card_lines`, `next_corner`, `most_corners`, `next_card` |
| Other match markets | `correct_score`, `first_half`, `second_half`, `next_goal` |
| Generated market groups | `expanded`, `half_time`, `prematch` |

The group IDs `expanded`, `half_time`, and `prematch` apply one margin to every generated market inside that group. `milestones` applies to every milestone unless a more specific `milestones.<minute>` override exists.

Use `DELETE` on either individual-market margin endpoint to remove the exact override and return that market to its parent league, match, or milestone-group margin.

## 6. Accumulator risk controls

### Read the active policy

```http
GET /cashier/v1/turbo-soccer/admin/accumulator/config
```

Example response:

```json
{
  "success": true,
  "config": {
    "minOddsForBonus": 1.2,
    "shopMaxPayout": 1000000,
    "bonusTiers": { "5": 1.05, "10": 1.3, "15": 1.5, "20": 2 }
  }
}
```

### Update the policy

```http
PUT /cashier/v1/turbo-soccer/admin/accumulator/config
```

Only provided fields are changed:

```json
{
  "minOddsForBonus": 1.25,
  "shopMaxPayout": 750000,
  "bonusTiers": { "5": 1.05, "10": 1.25, "15": 1.45 }
}
```

Rules:

- At least one configuration field must be provided.
- `minOddsForBonus` must be at least `1.00`.
- `shopMaxPayout` must be positive.
- Bonus-tier keys must be positive integer leg counts.
- Bonus-tier multipliers must be at least `1.00`.

### Dry-run an accumulator

```http
POST /cashier/v1/turbo-soccer/admin/accumulator/validate
```

```json
{
  "stake": 1000,
  "selections": [
    { "odds": 2.0 },
    { "odds": 1.5 },
    { "odds": 1.8 },
    { "odds": 1.4 },
    { "odds": 2.1 }
  ]
}
```

This is a policy calculation only. It does not place, debit, or settle a ticket.

## 7. Runtime monitoring

```http
GET /cashier/v1/turbo-soccer/admin/throttler/status
```

Example response:

```json
{
  "success": true,
  "active": true,
  "lastMajorEventTimestamp": 1783972800000,
  "timeDecayIntervalMs": 60000
}
```

`active: false` means the live time-decay throttler has not been initialized.

## 8. Audit history

```http
GET /cashier/v1/turbo-soccer/admin/audit
GET /cashier/v1/turbo-soccer/admin/audit?limit=25&action=MARGIN_UPDATE
```

Query parameters:

| Parameter | Rules |
|---|---|
| `limit` | Optional integer from `1` through `100`; VF Engine defaults to `50` |
| `action` | Optional non-empty exact action name |

Common actions include `LEAGUE_CREATE`, `LEAGUE_DELETE`, `LEAGUE_SCHEDULE_GENERATE`, `MARGIN_UPDATE`, `MATCH_MARGIN_UPDATE`, `ACCUMULATOR_CONFIG_UPDATE`, and `MANUAL_TICKET_SETTLEMENT`.

Audit records are append-only through this API. No audit update or delete endpoint is exposed.

## 9. Manual settlement correction

Normal settlement must come from authoritative match-finish events and the signed settlement webhook. Use this route only to correct a verified provider result:

```http
POST /cashier/v1/turbo-soccer/ledger/ticket/:ticketId/settle
```

A reason of at least five characters is required. For a ticket whose pending selections all belong to one match:

```json
{
  "reason": "Correcting verified provider result",
  "finalScore": { "home": 2, "away": 1 },
  "htScore": { "home": 1, "away": 0 },
  "statistics": {
    "home": { "corners": 5, "yellowCards": 2 },
    "away": { "corners": 3, "yellowCards": 1 }
  }
}
```

For a multi-match ticket, send one final score per pending match:

```json
{
  "reason": "Correcting verified provider results",
  "results": {
    "MATCH-1001": { "home": 2, "away": 1 },
    "MATCH-1002": { "home": 0, "away": 0 }
  }
}
```

`finalScore` and `results` are mutually exclusive. Score values must be non-negative integers. An already-settled ticket returns `409`.

This is the only VF Engine ledger endpoint proxied by the cashier API. VF Engine wallet creation, top-up, balance, ticket-printing, and ticket-query ledger routes remain intentionally unavailable because this service owns its local wallet and ticket records. After a manual correction, confirm the signed settlement workflow has reconciled the corresponding local ticket and wallet before closing the operational incident.

## 10. Match control

These routes are protected as local back-office operations, although they call VF Engine's match-control API rather than `/api/admin/*`.

### Initialize a scheduled match

```http
POST /cashier/v1/turbo-soccer/admin/match/init
```

```json
{
  "matchId": "VPL-MAN-LIV-13052026-01",
  "homeTeam": "Manchester City",
  "awayTeam": "Liverpool FC"
}
```

The match ID must come from VF Engine's scheduler.

### Start the initialized match

```http
POST /cashier/v1/turbo-soccer/admin/match/start
```

### Quick-start a match

```http
POST /cashier/v1/turbo-soccer/admin/match/quick-start
```

```json
{
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea FC"
}
```

## 11. Frontend client example

```javascript
const BASE_URL = '/cashier/v1/turbo-soccer';

async function adminRequest(path, accessToken, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || 'Turbo Soccer admin request failed');
    error.status = response.status;
    error.code = payload.error_code;
    throw error;
  }

  return payload;
}

export const getTurboSoccerAudit = (token, action) =>
  adminRequest(`/admin/audit?limit=50&action=${encodeURIComponent(action)}`, token);

export const updateTurboSoccerMargin = (token, leagueId, margin) =>
  adminRequest(`/admin/leagues/${encodeURIComponent(leagueId)}/margin`, token, {
    method: 'PUT',
    body: JSON.stringify({ margin }),
  });
```

## 12. Operational checklist

1. Confirm `VFENGINE_BASE_URL`, the shared JWT secret, and operator ID are configured.
2. Confirm the administrator can authenticate and has the `admin` or `super` role.
3. Confirm VF Engine MongoDB is reachable before mutations.
4. Preview margin changes before applying them.
5. Check `runtimeApplied` and `restartRequired` after configuration changes.
6. Verify the expected action appears in `/admin/audit`.
7. Require an external evidence reference in every manual settlement reason.
8. Reconcile the local ticket and wallet after any manual correction.
