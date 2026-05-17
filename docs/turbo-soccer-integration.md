# Turbo Soccer Pro — API Integration Guide

> **Version:** 1.6.2 | **Date:** 2026-05-13  
> **Base path:** `/cashier/v1/turbo-soccer/`  
> All authenticated routes require a Bearer JWT obtained from `POST /cashier/v1/auth/login`.

```
Authorization: Bearer <access_token>
```

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Fixtures & Odds](#2-fixtures--odds)
3. [WebSocket Integration](#3-websocket-integration)
   - [3.1 Connection & Rooms](#31-connection--rooms)
   - [3.2 Multi-League Cashier Board](#32-multi-league-cashier-board)
   - [3.3 Retail Phase & Clock](#33-retail-phase--clock)
   - [3.4 Single-Match Tracking](#34-single-match-tracking)
   - [3.5 Reconnection Strategy](#35-reconnection-strategy)
4. [Bet Placement — Pre-match](#4-bet-placement--pre-match)
5. [Bet Placement — Live (In-Play)](#5-bet-placement--live-in-play)
6. [Validate Live Odds (Pre-flight)](#6-validate-live-odds-pre-flight)
7. [Bet History](#7-bet-history)
8. [Void a Bet](#8-void-a-bet)
9. [Settlement Webhook](#9-settlement-webhook)
10. [Error Responses](#10-error-responses)
11. [Tickets & Printing (Chapter 10)](#11-tickets--printing-chapter-10)
12. [Thermal Printing (Chapter 10B)](#12-thermal-printing-chapter-10b)
13. [Admin — Margins](#13-admin--margins)
14. [Admin — Leagues](#14-admin--leagues)
15. [Admin — Accumulator](#15-admin--accumulator)
16. [Admin — Throttler](#16-admin--throttler)
17. [Admin — Match Control](#17-admin--match-control)
18. [Admin — Webhook Management](#18-admin--webhook-management)
19. [Role Summary](#19-role-summary)
20. [Market Identifiers Quick Reference](#20-market-identifiers-quick-reference)

---

## 1. Authentication

```http
POST /cashier/v1/auth/login
Content-Type: application/json

{
  "email": "cashier@yourshop.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "tokens": {
    "access": { "token": "eyJhbGci...", "expires": "2026-05-13T22:00:00.000Z" }
  }
}
```

Use the `access.token` value as the Bearer token on every subsequent request.

The engine loads `.env` at startup using `dotenv`. If you change `JWT_SECRET`, restart the Node process for the new value to take effect.

**Quick auth checks (server side):**
- Ensure the variable name is exactly `JWT_SECRET` (engine side), not `VFENGINE_JWT_SECRET`.
- Ensure `.env` is in the engine root.
- If startup logs show development-bypass mode, `JWT_SECRET` was not loaded at boot time.

### Cashier Game Launcher (VFootball)

Use this endpoint when an authorized cashier terminal needs a ready-to-open launcher URL.

```http
GET /cashier/v1/turbo-soccer/game-launcher
Authorization: Bearer <cashier_access_token>
```

**Access control:**
- Allowed: users with cashier betting rights (`placeBet`) such as `cashier`
- Rejected: authenticated roles without cashier betting rights (returns `403 Forbidden`)

**Response `200`:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "url": "https://vfootball.example.com/player.html?token=eyJhbGci..."
}
```

The `url` value always follows this format:

`<vfootball_base_url>/player.html?token=<vfootballToken>`

The `token` field is also returned separately for clients that prefer to construct their own URL.

---

## 2. Fixtures & Odds

### Get All Teams
```http
GET /cashier/v1/turbo-soccer/teams?league=PREMIER
```

`league` is optional. Valid values: `FRANCE`, `GERMANY`, `ITALY`, `LALIGA`, `PREMIER`.

### Get Available Leagues
```http
GET /cashier/v1/turbo-soccer/leagues
```
Use this once on frontend bootstrap to discover valid `league` values dynamically.
This route proxies VF Engine `GET /api/leagues` and is safe for cashier users.

**Response `200`:**
```json
{
  "success": true,
  "leagues": ["FRANCE", "GERMANY", "ITALY", "LALIGA", "PREMIER"]
}
```

### Frontend Bootstrap Order (recommended)
1. Call `GET /cashier/v1/turbo-soccer/leagues` once at app start.
2. Pick active league (saved user preference or default `PREMIER`).
3. Open socket using token from `GET /cashier/v1/turbo-soccer/ws-connect`.
4. Subscribe to `join_league` and request REST fallbacks:
   - `GET /cashier/v1/turbo-soccer/matches?league=<LEAGUE>`
   - `GET /cashier/v1/turbo-soccer/league/prematch/schedule?league=<LEAGUE>`

> Do not use `GET /cashier/v1/turbo-soccer/admin/leagues` for cashier UI bootstrap. That endpoint is admin-only and returns `403 Forbidden` for cashier roles.

### Get Match Schedule (single-match engine)
```http
GET /cashier/v1/turbo-soccer/schedule?league=PREMIER
```
`league` is optional. If omitted, default engine behavior applies.

### Get All League Matches (cashier board)
```http
GET /cashier/v1/turbo-soccer/matches?league=PREMIER
```
Returns all 10 slots for the specified league with current status, score, and live odds. REST fallback — poll at 2 s intervals when not using WebSocket. `league` defaults to `PREMIER`; valid values: `FRANCE`, `GERMANY`, `ITALY`, `LALIGA`, `PREMIER`.

### Get Odds for a Specific League Slot
```http
GET /cashier/v1/turbo-soccer/matches/:matchId/odds
```
`matchId` is the canonical slot ID e.g. `LEAGUE-001`.

Alias endpoints are also available for direct VF naming parity:

```http
GET /cashier/v1/turbo-soccer/league/matches?league=PREMIER
GET /cashier/v1/turbo-soccer/league/matches/:matchId/odds?league=PREMIER
```

### Get Pre-match Schedule (REST alternative to `PREMATCH_SCHEDULE` WebSocket event)
```http
GET /cashier/v1/turbo-soccer/league/prematch/schedule
```
Returns upcoming matchdays with fixture pairs and pre-match odds at `timeDecay = 1.0`.

**Response `200`:**
```json
{
  "success": true,
  "matchdays": [
    {
      "matchday": 12,
      "kickoffAt": 1746650000000,
      "leagueName": "PREMIER",
      "leagueRoom": "league:PREMIER",
      "fixtures": [
        {
          "matchId": "LEAGUE-001",
          "gameId": "VFL-L01-S01-R012",
          "leagueName": "PREMIER",
          "leagueRoom": "league:PREMIER",
          "home": "Manchester City",
          "away": "Liverpool FC",
          "odds": { "match_winner": { "home": 1.85, "draw": 3.40, "away": 4.20 } }
        }
      ]
    }
  ]
}
```

**Response `503`:** `{ "success": false, "error": "League not started" }`

> **Identity rule:** for settlement-grade identity prefer the scheduled fixture ID (`fixtureId`, alias `gameId`) when present. `LEAGUE-*` slot IDs remain valid for backward compatibility and display routing.

### Get Pre-match Odds by Teams (arbitrary pairing)
```http
GET /cashier/v1/turbo-soccer/prematch/odds?homeTeam=Arsenal&awayTeam=Chelsea
```

### Get Current Live Match Odds (single-match engine)
```http
GET /cashier/v1/turbo-soccer/match/odds
```

### Get Live Match State (single-match engine)
```http
GET /cashier/v1/turbo-soccer/match/state
```

### Get Historical Results
```http
GET /cashier/v1/turbo-soccer/results?date=2026-05-13
GET /cashier/v1/turbo-soccer/results?startTime=2026-05-13T10:00:00Z
```

| Query | Description |
|---|---|
| `date` | `YYYY-MM-DD` — defaults to today |
| `startTime` | ISO 8601 datetime filter |

---

## 3. WebSocket Integration

The VF Engine uses **Socket.io v4**. Obtain a short-lived engine JWT from the cashier API then connect directly from the terminal:

```http
GET /cashier/v1/turbo-soccer/ws-connect
```

**Response:**
```json
{
  "success": true,
  "wsUrl": "https://vfengine.example.com",
  "token": "eyJhbGci..."
}
```

### 3.1 Connection & Rooms

```javascript
import { io } from 'socket.io-client';

// Connect with the token from /ws-connect
const socket = io(wsUrl, {
  auth: { token },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity
});
```

**Client → Server events:**

| Emit | Payload | Effect |
|---|---|---|
| `join_cashier` | _(none)_ | Joins the `league:PREMIER` room + the `retail` room. Immediately receives `LEAGUE_SNAPSHOT`, `PREMATCH_SCHEDULE`, and `RETAIL_SNAPSHOT` (empty-safe bootstrap if no active runner). Use for PREMIER-only cashier terminals. |
| `join_league` | `{ league?: string }` | Joins a specific league room (`league:PREMIER`, `league:LALIGA`, etc.). Defaults to `PREMIER` if `league` is omitted. Immediately receives `joined_league` confirmation, `LEAGUE_SNAPSHOT`, and `PREMATCH_SCHEDULE`. Can be called multiple times to subscribe to several leagues simultaneously. **Does NOT join the `retail` room** — no `RETAIL_CLOCK`, `RETAIL_PHASE_CHANGE`, or `RETAIL_SNAPSHOT`. |
| `join_match` | `matchId: string` | Joins a single match room. Immediately receives `MATCH_UPDATE`. |

Use `join_league` with an explicit `league` value for any league other than PREMIER, or for multi-league terminals. Use `join_cashier` only for PREMIER-only terminals that also need the retail countdown clock:

```javascript
// Single-league terminal (PREMIER)
socket.on('connect', () => socket.emit('join_cashier'));
socket.on('reconnect', () => socket.emit('join_cashier'));

// Multi-league terminal
socket.on('connect', () => {
  socket.emit('join_league', { league: 'PREMIER' });
  socket.emit('join_league', { league: 'LALIGA' });
  // add more leagues as needed
});

// Confirm subscription per league
socket.on('joined_league', ({ league, room }) => {
  console.log(`Subscribed to ${room}`);
});

// Validation failure (unknown league value)
socket.on('ERROR', ({ code, message }) => {
  if (code === 'INVALID_LEAGUE') console.error(message);
});
```

### 3.2 Multi-League Cashier Board

**Server → Client events emitted after `join_cashier`:**

| Event | Frequency | Description |
|---|---|---|
| `LEAGUE_SNAPSHOT` | On join + after each round | Full board — all 10 slots |
| `PREMATCH_SCHEDULE` | On join + after each round | Upcoming matchdays with pre-match odds |
| `RETAIL_SNAPSHOT` | On every `join_cashier` | Bootstrap payload with phase + `remainingSeconds` (empty-safe) |
| `LEAGUE_UPDATE` | 1×/second/slot during LIVE | Live score, minute, odds, events |
| `LEAGUE_FINAL` | Once per slot at FULL_TIME | Final result for one slot |

**`LEAGUE_UPDATE` shape:**
```javascript
{
  matchId:     'LEAGUE-003',
  gameId:      'VFL-L03-S01-R012',  // unique game instance — changes every round
  homeTeam:    'Arsenal',
  awayTeam:    'Chelsea',
  phase:       'SECOND_HALF',   // PRE_MATCH | FIRST_HALF | HALF_TIME | SECOND_HALF | FULL_TIME
  status:      '2H',            // PRE | 1H | HT | 2H | FT
  score:       { home: 1, away: 0 },
  htScore:     { home: 1, away: 0 },  // null until half-time
  time:        { minute: 67, displayTime: '67:00' },
  events:      [{ type: 'GOAL_HOME', minute: 23 }],
  statistics:  { home: { corners: 4, yellowCards: 1, redCards: 0 },
                 away: { corners: 2, yellowCards: 2, redCards: 0 } },
  odds:        { /* full MarketPacket — null when suspended */ },
  risk:        { /* risk indicators */ },
  seasonId:    'S01',           // season label
  roundNumber: 12,              // 1-based round within the season
  updateType:  'TICK',          // 'TICK' on normal tick; event type string on major events
  leagueName:  'PREMIER',       // league identifier — use to route updates on multi-league boards
  leagueRoom:  'league:PREMIER' // Socket.io room the update was sent to
}
```

> **Room isolation (v1.6.0+):** Updates are emitted to `league:<LEAGUENAME>` (e.g. `league:PREMIER`). All 10 slots within a league share one room. Use `leagueName` to route updates to the correct display panel.

**`LEAGUE_FINAL` shape:**
```javascript
{
  matchId:     'LEAGUE-003',
  gameId:      'VFL-L03-S01-R012',
  seasonId:    'S01',
  homeTeam:    'Arsenal',
  awayTeam:    'Chelsea',
  score:       { home: 2, away: 1 },
  roundNumber: 12,              // NOTE: was roundNum in v1.5 — use roundNumber
  message:     'FT: Arsenal 2–1 Chelsea'
}
```

**`PREMATCH_SCHEDULE` shape:**
```javascript
[
  {
    matchday: 12,
    kickoffAt: 1746650000000,   // epoch ms
    leagueName: 'PREMIER',
    leagueRoom: 'league:PREMIER',
    fixtures: [
      {
        matchId: 'LEAGUE-001',  // ← always use this as matchId in bet requests
        gameId: 'VFL-L01-S01-R012',
        leagueName: 'PREMIER',
        leagueRoom: 'league:PREMIER',
        home:    'Manchester City',
        away:    'Liverpool FC',
        odds:    { match_winner: { home: 1.85, draw: 3.40, away: 4.20 }, /* … */ }
      }
    ]
  }
]
```

**Complete board implementation — single league (PREMIER with retail clock):**

```javascript
const board = {};

// join_cashier for PREMIER + retail clock events
socket.on('connect',   () => socket.emit('join_cashier'));
socket.on('reconnect', () => socket.emit('join_cashier'));

// Full board on connect / reconnect
socket.on('LEAGUE_SNAPSHOT', (slots) => {
  slots.forEach(slot => { board[slot.matchId] = slot; });
  rerenderBoard();
});

// Pre-match fixture schedule with odds
socket.on('PREMATCH_SCHEDULE', (matchdays) => {
  renderScheduleBoard(matchdays);
  // matchdays[0].fixtures[i].matchId is the canonical ID to use for bets
});

// Per-tick live update for one slot
socket.on('LEAGUE_UPDATE', (slot) => {
  board[slot.matchId] = slot;
  rerenderSlot(slot);
  // Disable bet input when odds are null (market suspended)
  setBetInputEnabled(slot.matchId, slot.odds !== null);
});

// Full-time — freeze the score card
socket.on('LEAGUE_FINAL', ({ matchId, score, roundNumber }) => {
  const prev = board[matchId] || {};
  board[matchId] = { ...prev, phase: 'FULL_TIME', status: 'FT', score };
  rerenderSlot(board[matchId]);
  showRoundResult(matchId, score, roundNumber);
});

// Sync current phase immediately on join (if round is in progress)
socket.on('RETAIL_SNAPSHOT', ({ phase, remainingSeconds }) => {
  document.body.dataset.retailPhase = phase;
  if (phase === 'PRE_MATCH') setCountdownDisplay(remainingSeconds);
});
```

**Multi-league board implementation (all leagues simultaneously):**

```javascript
// boards keyed by leagueName → matchId → last payload
const boards = {};

const LEAGUES = ['PREMIER', 'LALIGA', 'ITALY', 'FRANCE', 'GERMANY'];

function joinAllLeagues() {
  for (const league of LEAGUES) {
    socket.emit('join_league', { league });
  }
}

socket.on('connect',   joinAllLeagues);
socket.on('reconnect', joinAllLeagues);

socket.on('joined_league', ({ league, room }) => {
  console.log(`Subscribed to ${room}`);
  if (!boards[league]) boards[league] = {};
});

// Full board snapshot — leagueName routes to the correct panel
socket.on('LEAGUE_SNAPSHOT', (slots) => {
  const league = slots[0]?.leagueName;
  if (!league) return;
  if (!boards[league]) boards[league] = {};
  slots.forEach(slot => { boards[league][slot.matchId] = slot; });
  rerenderLeaguePanel(league, Object.values(boards[league]));
});

// Pre-match schedules — emitted per league on join and after each round
socket.on('PREMATCH_SCHEDULE', (matchdays) => {
  // Call GET /api/league/prematch/schedule per league for REST equivalent
  renderScheduleBoard(matchdays);
});

// Per-tick live update — use leagueName to route to the correct display panel
socket.on('LEAGUE_UPDATE', (slot) => {
  const league = slot.leagueName;
  if (!boards[league]) boards[league] = {};
  boards[league][slot.matchId] = slot;
  rerenderSlot(league, slot);
  setBetInputEnabled(slot.matchId, slot.odds !== null);
});

// Full-time — use roundNumber (not roundNum)
socket.on('LEAGUE_FINAL', ({ matchId, score, roundNumber, leagueName: league }) => {
  const prev = boards[league]?.[matchId] || {};
  if (!boards[league]) boards[league] = {};
  boards[league][matchId] = { ...prev, phase: 'FULL_TIME', status: 'FT', score };
  rerenderSlot(league, boards[league][matchId]);
  showRoundResult(league, matchId, score, roundNumber);
});
```

**Null-safe odds rendering:**
```javascript
function renderSlotOdds(el, odds) {
  if (!odds) {
    el.classList.add('suspended');
    el.textContent = '—';
    return;
  }
  el.classList.remove('suspended');
  const mw = odds.match_winner;
  el.querySelector('.home').textContent = mw?.home?.toFixed(2) ?? '—';
  el.querySelector('.draw').textContent = mw?.draw?.toFixed(2) ?? '—';
  el.querySelector('.away').textContent = mw?.away?.toFixed(2) ?? '—';
}
```

### 3.3 Retail Phase & Clock

The retail countdown runs for 120 seconds between rounds. Events are emitted to the `retail` room (i.e. clients that called `join_cashier`).

| Event | When emitted | Payload |
|---|---|---|
| `RETAIL_PHASE_CHANGE { phase:'PRE_MATCH' }` | All slots finish; countdown starts | `{ phase: 'PRE_MATCH' }` |
| `RETAIL_CLOCK` | Every second during countdown | `{ phase: 'PRE_MATCH', remainingSeconds: 87 }` |
| `RETAIL_PHASE_CHANGE { phase:'LOCKED' }` | Countdown reaches 0 | `{ phase: 'LOCKED' }` |
| `RETAIL_PHASE_CHANGE { phase:'LIVE' }` | New round starts (~500 ms after LOCKED) | `{ phase: 'LIVE' }` |

```javascript
socket.on('RETAIL_PHASE_CHANGE', ({ phase }) => {
  document.body.dataset.retailPhase = phase;
  // CSS: body[data-retail-phase="LOCKED"] .bet-slip { pointer-events: none; opacity: 0.4; }
  if (phase === 'PRE_MATCH') showCountdownBanner();
  if (phase === 'LOCKED')    showLockedBanner('Kickoff imminent…');
  if (phase === 'LIVE')      hideCountdownBanner();
});

socket.on('RETAIL_CLOCK', ({ remainingSeconds }) => {
  const m = Math.floor(remainingSeconds / 60);
  const s = String(remainingSeconds % 60).padStart(2, '0');
  document.getElementById('countdown').textContent = `${m}:${s}`;
  if (remainingSeconds <= 30) warnBettingClosesSoon();
});
```

**Suspension checklist:**
- Block bets when `odds === null` or `slot.status` is `SUSPENDED` / `TRANSITION`
- Show "Markets suspended" overlay during suspension events
- Disable bet slip for 5 s after `GOAL_HOME/AWAY` or `RED_CARD` events
- Disable bet slip indefinitely after `PENALTY_AWARDED` until `PENALTY_SCORED/MISSED`
- Lock all league bets on `RETAIL_PHASE_CHANGE { phase:'LOCKED' }` — re-enable on `{ phase:'LIVE' }`

### 3.4 Single-Match Tracking

```javascript
socket.emit('join_match', 'LEAGUE-001');

socket.on('MATCH_UPDATE', (update) => {
  if (update.matchId !== 'LEAGUE-001') return;

  if (update.status === 'SUSPENDED' || update.status === 'TRANSITION') {
    showSuspendedOverlay();
    return;
  }

  updateScoreboard(update.score, update.time?.minute);
  updateOddsDisplay(update.odds);  // null when suspended

  if (update.status === 'FINISHED') {
    showFinalResult(update.score);
    socket.off('MATCH_UPDATE');
  }
});
```

### 3.5 Reconnection Strategy

```javascript
socket.on('connect_error', (err) => console.error('[VF Engine auth error]', err.message));
socket.on('ERROR', ({ code, message }) => {
  if (code === 'INVALID_LEAGUE') console.error('[VF Engine] Bad league:', message);
  else console.error('[VF Engine error]', message);
});

// Re-join after reconnect to restore room subscriptions
// Use the same join calls made on initial connect
const SUBSCRIBED_LEAGUES = ['PREMIER']; // configure per terminal

function rejoinRooms() {
  for (const league of SUBSCRIBED_LEAGUES) {
    socket.emit('join_league', { league });
  }
  // Alternatively, use join_cashier for PREMIER + retail clock:
  // socket.emit('join_cashier');
  if (activeMatchId) socket.emit('join_match', activeMatchId);
}

socket.on('connect',   rejoinRooms);
socket.on('reconnect', rejoinRooms);
```

---

## 4. Bet Placement — Pre-match

```http
POST /cashier/v1/turbo-soccer/bets/place
Content-Type: application/json

{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "matchId": "LEAGUE-001",
  "market": "match_winner",
  "selection": "home",
  "stake": 100,
  "requested_odds": 1.85,
  "auto_accept_changes": true,
  "client_timestamp": 1746614400000
}
```

`/bets/place` accepts both payload formats:
- Single-selection (shown above): top-level `matchId`, `market`, `selection`
- Multi-selection accumulator: `selections[]` where each leg has `matchId`, `market`, `selection`, and optional per-leg metadata

**Multi-selection example:**
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

| Field | Required | Description |
|---|---|---|
| `cashierId` | ✓ | MongoDB ObjectId of the logged-in cashier. Stake debited from this cashier's wallet. |
| `market` | ✓ | Market key — see [§20 Market Identifiers](#20-market-identifiers-quick-reference) |
| `selection` | ✓ | Selection value — see §20 |
| `stake` | ✓ | Positive number in operator currency units |
| `matchId` | Cond. | Required in single-selection mode. In multi-selection mode use `selections[].matchId`. Fixture IDs are canonical; `LEAGUE-*` slot IDs are accepted for backward compatibility. |
| `requested_odds` | | Client-side odds snapshot for drift detection |
| `prematch` | | Omit for `LEAGUE-*` slots (auto-detected). Set `false` only for early in-play bets via this endpoint. |
| `auto_accept_changes` | | Accept minor drift automatically |
| `client_timestamp` | | Unix ms — injected automatically if omitted |

**Success `200`:**
```json
{
  "success": true,
  "bet_id": "BET-1746624051234-AB12C",
  "matchId": "LEAGUE-001",
  "homeTeam": "Manchester City",
  "awayTeam": "Liverpool FC",
  "market": "match_winner",
  "selection": "home",
  "stake": 100,
  "accepted_odds": 1.85,
  "requested_odds": 1.85,
  "grace_message": null,
  "status": "PENDING",
  "timestamp": "2026-05-13T14:23:11.000Z"
}
```

---

## 5. Bet Placement — Live (In-Play)

```http
POST /cashier/v1/turbo-soccer/bets/live
POST /cashier/v1/turbo-soccer/live/bet
Content-Type: application/json

{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "matchId": "LEAGUE-003",
  "market": "next_goal",
  "selection": "home",
  "stake": 50,
  "odds": 1.80,
  "client_timestamp": 1746614405000,
  "auto_accept_changes": true
}
```

Both routes are supported and equivalent. Frontend may use either path.

| Field | Required | Description |
|---|---|---|
| `cashierId` | ✓ | MongoDB ObjectId of the cashier |
| `market` | ✓ | Market key — see §20 |
| `selection` | ✓ | Selection value |
| `stake` | ✓ | Positive number |
| `odds` | ✓ | Odds displayed on terminal at click time — used for drift detection |
| `client_timestamp` | ✓ | Unix ms — used by Grace Period Middleware |
| `matchId` | Cond. | Required unless live match context is singular. Canonical slot ID (`LEAGUE-*`). |
| `auto_accept_changes` | | Accept drift within tolerance automatically |

**Success `200`:**
```json
{
  "approved": true,
  "bet_id": "BET-1746624051240-CD34E",
  "market": "next_goal",
  "selection": "home",
  "stake": 50,
  "requested_odds": 1.80,
  "final_odds": 1.78,
  "timestamp": "2026-05-13T14:23:14.000Z",
  "message": "Odds adjusted from 1.80 to 1.78 within grace tolerance."
}
```

**Grace Period behaviour:**

| Condition | Outcome |
|---|---|
| Odds unchanged | Accepted immediately |
| Drift within tolerance + `auto_accept_changes: true` | Accepted with adjusted `final_odds` + `message` |
| Drift within tolerance + `auto_accept_changes: false` | `409 ODDS_CHANGED` with `current_odds` |
| Drift outside tolerance | `409 ODDS_CHANGED` regardless of flag |
| Match `SUSPENDED` or `TRANSITION` | `403 MARKET_SUSPENDED` |
| Market `CLOSED` | `400 MARKET_CLOSED` |

---

## 6. Validate Live Odds (Pre-flight)

Call before showing a confirmation screen. Does **not** place a bet or debit the wallet.

```http
POST /cashier/v1/turbo-soccer/bets/validate
POST /cashier/v1/turbo-soccer/live/bet/validate
Content-Type: application/json

{
  "odds": 1.80,
  "client_timestamp": 1746614405000,
  "auto_accept_changes": false
}
```

Both routes are supported and equivalent. Frontend may use either path.

**Response `200` — valid:** `{ "valid": true, "reason": null, "final_odds": 1.80 }`  
**Response `200` — stale:** `{ "valid": false, "reason": "Odds have moved beyond tolerance.", "final_odds": 1.74 }`

---

## 7. Bet History

```http
GET /cashier/v1/turbo-soccer/bets/history?page=1&limit=20
```

| Query | Default | Max |
|---|---|---|
| `page` | 1 | — |
| `limit` | 20 | 100 |

---

## 8. Void a Bet

> Requires `manageGameConfig` role.

```http
POST /cashier/v1/turbo-soccer/bets/:betId/void
Content-Type: application/json

{ "reason": "Operator correction" }
```

On success: ticket is marked `cancelled = true`, `payout = true`, original cashier wallet is refunded.

**Success `200`:**
```json
{
  "success": true,
  "betId": "BET-1746624051234-AB12C",
  "status": "VOID",
  "voidReason": "Operator correction",
  "voidedAt": "2026-05-13T12:00:00.000Z"
}
```

---

## 9. Settlement Webhook

The VF Engine posts to this endpoint after each match settles. **No JWT required** — HMAC-SHA256 verified only.

```
POST /cashier/v1/turbo-soccer/webhooks/settlement
X-Signature: sha256=<hmac_hex>
```

Responds `200 { "received": true }` immediately; processing is async.

**Payload shape:**
```json
{
  "event": "MATCH_SETTLED",
  "matchId": "LEAGUE-001",
  "homeTeam": "Manchester City",
  "awayTeam": "Liverpool FC",
  "finalScore": { "home": 2, "away": 1 },
  "settledAt": "2026-05-13T14:32:05.000Z",
  "summary": { "settled": 47, "won": 21, "lost": 24, "voided": 2 },
  "bets": [
    {
      "betId": "BET-1746624051234-AB12C",
      "market": "match_winner",
      "selection": "home",
      "oddsTaken": 1.85,
      "stake": 100,
      "result": "WON",
      "payout": 185.00
    }
  ]
}
```

> `result` is uppercase: `"WON"` | `"LOST"` | `"VOID"`. For `WON` the cashier wallet is credited `payout`. For `VOID`, the ticket is marked cancelled with no additional settlement credit.

---

## 10. Error Responses

```json
{
  "code": 409,
  "message": "Odds have changed",
  "error_code": "ODDS_CHANGED",
  "current_odds": 1.78
}
```

| HTTP | `error_code` | Meaning | Extra field |
|---|---|---|---|
| 400 | `MARKET_CLOSED` | Market outcome already determined | — |
| 400 | — | Insufficient funds / invalid stake | — |
| 403 | `MARKET_SUSPENDED` | Market locked (goal/red card/penalty/kickoff) | — |
| 403 | — | Authenticated but not authorized (for example cashier calling admin routes) | — |
| 404 | — | Cashier or wallet not found | — |
| 409 | `ODDS_CHANGED` | Odds drifted; update display then re-submit | `current_odds` |
| 500 | — | Engine accepted the bet but local ticket persistence failed; wallet rollback applied | — |
| 502 | — | VF Engine unreachable from cashier API | — |
| 503 | `NO_ACTIVE_MATCH` | No active match for this slot | — |

---

## 11. Tickets & Printing (Chapter 10)

Multi-leg ticket validation and issuance in a single call. All selections are checked against live odds with grace period tolerance.

```http
POST /cashier/v1/turbo-soccer/tickets/print
Content-Type: application/json

{
  "ticket_data": [
    {
      "matchId": "LEAGUE-001",
      "homeTeam": "Manchester City",
      "awayTeam": "Liverpool FC",
      "market": "match_winner",
      "selection": "home",
      "selection_label": "1",
      "requested_odds": 1.85,
      "current_odds": 1.85,
      "match_status": "PRE_MATCH"
    }
  ],
  "total_stake": 500,
  "client_timestamp": 1746614400000,
  "auto_accept_changes": true
}
```

| Field | Required | Description |
|---|---|---|
| `ticket_data` | ✓ | Array of selection objects (min 1) |
| `total_stake` | ✓ | Total stake in operator currency units |
| `client_timestamp` | | Unix ms — used for grace period on live legs |
| `auto_accept_changes` | | Accept up to 5% odds drift automatically |

> **Pre-match legs:** set `match_status: "PRE_MATCH"` (or `"PREMATCH"` / `"PRE"`) on a selection to bypass the grace period check. The `bet_type` in the response will be `"PREMATCH"`.  
> **`matchId` must always be the canonical `LEAGUE-*` slot ID** — read from `fixtures[].matchId` in `PREMATCH_SCHEDULE` or `GET /league/prematch/schedule`.

**All responses return HTTP 200.**

**Success:**
```json
{
  "valid": true,
  "ticket": {
    "ticketId": "TKT-1746624051234-AB12",
    "selections": [
      {
        "matchId": "LEAGUE-001",
        "homeTeam": "Manchester City",
        "awayTeam": "Liverpool FC",
        "market": "match_winner",
        "selection": "home",
        "selection_label": "1",
        "final_odds": 1.85,
        "bet_type": "PREMATCH",
        "status": "PENDING"
      }
    ],
    "totalOdds": 1.85,
    "stake": 500,
    "potentialReturn": 925.00,
    "timestamp": "2026-05-13T10:23:11.000Z"
  }
}
```

**Failure:** `{ "valid": false, "reason": "<human-readable message>" }`

**Full ticket + wallet + print flow (Chapter 10 end-to-end):**
```javascript
async function placePrintTicket({ shopId, cashierId, selections, totalStake }) {
  // Step 1 — validate odds + issue ticket
  const ticketRes = await api.post('/cashier/v1/turbo-soccer/tickets/print', {
    ticket_data: selections,
    total_stake: totalStake,
    client_timestamp: Date.now(),
    auto_accept_changes: true
  });
  if (!ticketRes.data.valid) throw new Error(ticketRes.data.reason);
  const ticket = ticketRes.data.ticket;

  // Step 2 — generate ESC/POS payload
  const printRes = await api.post('/cashier/v1/turbo-soccer/print/thermal', {
    ticket_id: ticket.ticketId,
    shopId,
    cashierId,
    selections: ticket.selections,
    totalOdds: ticket.totalOdds,
    stake: totalStake,
    potentialReturn: ticket.potentialReturn
  });

  // Step 3 — send to thermal printer
  sendToPrinter(printRes.data.payloadBase64);
  return ticket;
}
```

---

## 12. Thermal Printing (Chapter 10B)

Generates ESC/POS binary payloads for thermal printers. Send `payloadBase64` directly to the printer driver.

### Generate print payload
```http
POST /cashier/v1/turbo-soccer/print/thermal
Content-Type: application/json

{
  "ticket_id": "TKT-1746624051234-AB12",
  "shopId": "SHOP-001",
  "cashierId": "TERM-001",
  "selections": [ ... ],
  "totalOdds": 1.85,
  "stake": 500,
  "potentialReturn": 925.00
}
```

**Response `200`:**
```json
{
  "success": true,
  "payloadBase64": "G0p...",
  "payloadLength": 1024,
  "hasAutoCut": true,
  "hasBarcode": true
}
```

### Reprint
```http
POST /cashier/v1/turbo-soccer/print/thermal/reprint
```
Same body and response shape. Adds a `** REPRINT **` header to the print job.

---

## 13. Admin — Margins

> Requires `manageGameConfig` role.

```http
GET  /cashier/v1/turbo-soccer/admin/margins
GET  /cashier/v1/turbo-soccer/admin/margins/preview?margin=1.10
PUT  /cashier/v1/turbo-soccer/admin/match/:matchId/margin
     Body: { "margin": 1.10 }    // range: 1.00–1.30
```

`preview` returns a probability → odds table at the given margin without modifying any match.

---

## 14. Admin — Leagues

> Requires `manageGameConfig` role.

```http
GET    /cashier/v1/turbo-soccer/admin/leagues
GET    /cashier/v1/turbo-soccer/admin/leagues/progression?league=PREMIER
POST   /cashier/v1/turbo-soccer/admin/leagues/progression/persist
POST   /cashier/v1/turbo-soccer/admin/leagues
GET    /cashier/v1/turbo-soccer/admin/leagues/:id
DELETE /cashier/v1/turbo-soccer/admin/leagues/:id
GET    /cashier/v1/turbo-soccer/admin/leagues/:id/margin
PUT    /cashier/v1/turbo-soccer/admin/leagues/:id/margin   Body: { "margin": 1.08 }
GET    /cashier/v1/turbo-soccer/admin/leagues/:id/schedule
POST   /cashier/v1/turbo-soccer/admin/leagues/:id/schedule  (generate round-robin)
```

`GET /admin/leagues/progression` returns the current league progression snapshot (season, matchday, slot-level fixture mapping).  
`POST /admin/leagues/progression/persist` forces the in-memory progression snapshot to disk and returns the refreshed snapshot.

**Create league body:**
```json
{
  "id": "vpl-premier",
  "name": "Virtual Premier League",
  "teams": ["Manchester City", "Liverpool FC", "Arsenal", "Chelsea FC"],
  "matchIntervalMinutes": 5,
  "margin": 1.08
}
```

The engine assigns up to 10 `LEAGUE-*` slots round-robin across active leagues. Each slot has a stable ID (`LEAGUE-001` through `LEAGUE-010`) used as `matchId` in all bet requests.

---

## 15. Admin — Accumulator

> Requires `manageGameConfig` role.

```http
GET  /cashier/v1/turbo-soccer/admin/accumulator/config
PUT  /cashier/v1/turbo-soccer/admin/accumulator/config   Body: { ...config }
POST /cashier/v1/turbo-soccer/admin/accumulator/validate
```

**Validate (parlay) body:**
```json
{
  "ticketId": "acca-001",
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "stake": 50,
  "legs": [
    { "matchId": "LEAGUE-001", "market": "match_winner", "selection": "home", "odds": 1.85 },
    { "matchId": "LEAGUE-002", "market": "btts",          "selection": "GG",   "odds": 2.20 }
  ]
}
```

Minimum 2 legs. Response includes `totalOdds`, `bonusMultiplier`, and `potentialPayout`.

---

## 16. Admin — Throttler

> Requires `manageGameConfig` role.

```http
GET /cashier/v1/turbo-soccer/admin/throttler/status
```

Returns `lastDecayBroadcast`, `lastMajorEventTimestamp`, and `timeDecayIntervalMs`.

---

## 17. Admin — Match Control

> Requires `manageGameConfig` role.

```http
POST /cashier/v1/turbo-soccer/admin/match/init
Body: { "matchId": "VPL-MAN-LIV-13052026-01", "homeTeam": "Manchester City", "awayTeam": "Liverpool FC" }
```
`matchId` **must** come from the engine `MatchScheduler` (engine rule GC-4).

```http
POST /cashier/v1/turbo-soccer/admin/match/start
```
Transitions `PREMATCH → TRANSITION → LIVE`.

```http
POST /cashier/v1/turbo-soccer/admin/match/quick-start
Body: { "homeTeam": "Arsenal", "awayTeam": "Chelsea FC" }
```
Combines `init` + `start`. Engine generates the `matchId` automatically.

---

## 18. Admin — Webhook Management

> Requires `manageGameConfig` role.

```http
GET    /cashier/v1/turbo-soccer/admin/webhooks/settlement
POST   /cashier/v1/turbo-soccer/admin/webhooks/settlement
DELETE /cashier/v1/turbo-soccer/admin/webhooks/settlement/:webhookId
```

**Register body:**
```json
{
  "targetUrl": "https://retail.yourdomain.com/webhooks/vfootball/settlement",
  "secret": "minimum-32-character-hmac-secret-here",
  "description": "Production settlement callback"
}
```

`secret` must be at least 32 characters. The `secret` field is **redacted** from `GET` responses.

---

## 19. Role Summary

| Endpoint group | Required role |
|---|---|
| Fixtures, schedule, odds, match state | Any authenticated user |
| Pre-match bet, live bet, validate | Any authenticated user |
| Bet history | Any authenticated user |
| WebSocket token (`/ws-connect`) | Any authenticated user |
| Tickets print (`/tickets/print`) | Any authenticated user |
| Thermal print + reprint | Any authenticated user |
| Void bet | `admin` or `super` (`manageGameConfig`) |
| All `/admin/*` routes | `admin` or `super` (`manageGameConfig`) |
| Settlement webhook | No JWT — HMAC `X-Signature` only |

---

## 20. Market Identifiers Quick Reference

Use these exact strings for the `market` and `selection` fields in all bet requests.

### Core markets

| `market` | `selection` values | Description | Closes when |
|---|---|---|---|
| `match_winner` | `home` `draw` `away` | Full-time 1X2 | Minute 90 |
| `double_chance` | `home_draw` `home_away` `draw_away` | Double chance | Minute 90 |
| `draw_no_bet` | `home` `away` | Draw no bet | Minute 90 |
| `btts` | `GG` `NG` | Both teams to score | Both teams scored or impossible |
| `ou_1.5` | `over` `under` | Goals O/U 1.5 | ≥2 goals → over closed |
| `ou_2.5` | `over` `under` | Goals O/U 2.5 | ≥3 goals → over closed |
| `ou_3.5` | `over` `under` | Goals O/U 3.5 | ≥4 goals → over closed |
| `ou_4.5` | `over` `under` | Goals O/U 4.5 | ≥5 goals → over closed |
| `first_half` | `home` `draw` `away` | First-half result | Minute 45 |
| `second_half` | `home` `draw` `away` | Second-half result | Minute 90 |
| `next_goal` | `home` `away` | Next goal scorer | Minute 88 or next goal |
| `next_corner` | `home` `away` | Next corner | Per-corner |
| `most_corners` | `home` `draw` `away` | Most corners | Minute 90 |
| `corners` | `over` `under` | Corners total (single line) | Settlement |
| `fh_ou_1.5` | `over` `under` | First-half O/U 1.5 goals | Minute 45 |
| `sh_ou_1.5` | `over` `under` | Second-half O/U 1.5 goals | Minute 90 |

### Dynamic line markets

| `market` key pattern | `selection` | Description |
|---|---|---|
| `cn_<line>` e.g. `cn_9.5` | `over` `under` | Corner lines 7.5, 8.5, 9.5, 10.5, 11.5, 12.5 — read from `corners_lines[]` |
| `yc_<line>` e.g. `yc_3.5` | `over` `under` | Yellow card lines 2.5, 3.5, 4.5 — read from `yellow_card_lines[]` |

### Card markets

| `market` | `selection` | Description |
|---|---|---|
| `yellow_ou_2.5` | `over` `under` | Yellow cards O/U 2.5 |
| `yellow_ou_3.5` | `over` `under` | Yellow cards O/U 3.5 |
| `yellow_ou_4.5` | `over` `under` | Yellow cards O/U 4.5 |
| `red_ou_0.5` | `over` `under` | Red cards O/U 0.5 |
| `red_ou_1.5` | `over` `under` | Red cards O/U 1.5 |
| `red_ou_2.5` | `over` `under` | Red cards O/U 2.5 |
| `cards` | `over` `under` | Total cards — dynamic single line from `cards.line` |
| `next_card` | `home` `away` | Which team receives the next card |

### Handicap markets

| `market` | `selection` | Description |
|---|---|---|
| `hcap_home` | `"-0.5"` `"+0.5"` `"+1.5"` | Asian handicap — home team covers the line |
| `hcap_away` | `"+0.5"` `"-0.5"` `"-1.5"` | Asian handicap — away team covers the line |
| `handicap_eh` | `"1"` `"X"` `"2"` | European handicap home −1 (3-way) |

### Expanded markets (Chapter 8I)

| `market` | `selection` | Description |
|---|---|---|
| `total_goals` | `"0"` `"1"` `"2"` `"3"` `"4"` `"5"` `"6+"` | Exact total goals |
| `home_goals` | `"0"` `"1"` `"2"` `"3+"` | Exact home team goals |
| `away_goals` | `"0"` `"1"` `"2"` `"3+"` | Exact away team goals |
| `correct_score` | `"0-0"` `"1-0"` `"1-1"` … | Top correct scores |
| `home_ou_0.5` … `home_ou_8.5` | `over` `under` | Home goals O/U 0.5–8.5 |
| `away_ou_0.5` … `away_ou_8.5` | `over` `under` | Away goals O/U 0.5–8.5 |
| `combo_result_ou25` | `"1 & Over"` `"1 & Under"` `"X & Over"` `"X & Under"` `"2 & Over"` `"2 & Under"` | 1X2 + goals O/U 2.5 |
| `combo_result_btts` | `"1 & GG"` `"1 & NG"` `"X & GG"` `"X & NG"` `"2 & GG"` `"2 & NG"` | 1X2 + BTTS |

### Half-time markets

| `market` | `selection` | Description |
|---|---|---|
| `fh_dc` | `1X` `X2` `12` | First-half double chance |
| `sh_dc` | `1X` `X2` `12` | Second-half double chance |
| `fh_btts` | `GG` `NG` | First-half BTTS |
| `sh_btts` | `GG` `NG` | Second-half BTTS |
| `fh_goal_ng` | `goal` `no_goal` | First-half at-least-one-goal (closes on first-half goal or FH end) |
| `sh_goal_ng` | `goal` `no_goal` | Second-half at-least-one-goal (closes on second-half goal or FT) |
| `win_both_halves` | `home` `away` `neither` | Win both halves (closes at FT) |
| `fh_ou_0.5` … `fh_ou_8.5` | `over` `under` | First-half goals O/U 0.5–8.5 |
| `sh_ou_0.5` … `sh_ou_8.5` | `over` `under` | Second-half goals O/U 0.5–8.5 |

> **Closed markets:** when `odds` for a market is `null` in the `MarketPacket`, that market is closed — its outcome is already determined. Do not offer it on the bet slip.

