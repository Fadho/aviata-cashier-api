# Turbo Soccer Pro — API Integration Guide

> **Version:** 1.6.4 | **Date:** 2026-06-16
> **Latest:** Settlement integration refreshed — instant `MARKET_SETTLED` and full-time `MATCH_SETTLED` payloads, HMAC raw-body verification, idempotent local ticket updates, and results polling reconciliation
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
7. [WebSocket Bet Placement](#7-websocket-bet-placement)
8. [Bet History](#8-bet-history)
9. [Void a Bet](#9-void-a-bet)
10. [Settlement Webhook](#10-settlement-webhook)
11. [Suspension Tracking (Chapter 8D)](#11-suspension-tracking-chapter-8d)
12. [Market Identifiers Reference](#12-market-identifiers-reference)
13. [Accumulator, Combinator & System Models](#13-accumulator-combinator--system-models)
14. [Tickets & Printing (Chapter 10)](#14-tickets--printing-chapter-10)
15. [Thermal Printing (Chapter 10B)](#15-thermal-printing-chapter-10b)
16. [Admin — Margins](#16-admin--margins)
17. [Admin — Leagues](#17-admin--leagues)
18. [Admin — Accumulator](#18-admin--accumulator)
19. [Admin — Throttler](#19-admin--throttler)
20. [Admin — Match Control](#20-admin--match-control)
21. [Admin — Webhook Management](#21-admin--webhook-management)
22. [Role Summary](#22-role-summary)
23. [Error Codes & Validation](#23-error-codes--validation)
24. [Market Identifiers Reference (Detailed)](#24-market-identifiers-reference-detailed)

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

### Fixture Identity Rule (Settlement-Grade)

When placing prematch bets, **prefer the scheduled fixture ID** (`fixtureId`, alias `gameId`, e.g. `"VFL-L01-S01-R012-M01"`) as the canonical `matchId` in all bet requests:

```http
POST /cashier/v1/turbo-soccer/bets/place
{
  "matchId": "VFL-L01-S01-R012-M01",  ← canonical fixture ID (preferred)
  "market": "match_winner",
  "selection": "home",
  ...
}
```

**Why?** Fixture IDs are unique across seasons and remain consistent even after server restarts, making them ideal for settlement-grade bet identity. Slot IDs (`LEAGUE-*`) are display/routing identifiers that can rotate per round.

**Backward compatibility:** Slot IDs (`LEAGUE-001` … `LEAGUE-010`) remain fully accepted by the engine and are stable within a season for display routing. Both forms reference the same match outcome.

---

### Get Available Leagues

```http
GET /cashier/v1/turbo-soccer/leagues
```

**Response `200`:**
```json
{
  "success": true,
  "leagues": ["FRANCE", "GERMANY", "ITALY", "LALIGA", "PREMIER"]
}
```

Call this once at app bootstrap to discover valid league values dynamically.

---

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
GET /cashier/v1/turbo-soccer/results?date=2026-05-13&startTime=10:00
```

| Query | Description |
|---|---|
| `date` | Optional `YYYY-MM-DD`. When omitted, returns the latest completed results regardless of date. |
| `startTime` | Optional `HH:MM`. Only applied when `date` is present; ignored by the cashier proxy if sent by itself. |

---

## 3. WebSocket Integration

The VF Engine uses **Socket.io v4**. Obtain an 8-hour engine JWT from the cashier API then connect directly from the terminal:

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
  matchId:           'LEAGUE-003',
  gameId:            'VFL-L03-S01-R012',  // unique game instance — changes every round
  fixtureId:         'VFL-L03-S01-R012',  // alias of gameId — settlement identity
  homeTeam:          'Arsenal',
  awayTeam:          'Chelsea',
  phase:             'SECOND_HALF',   // PRE_MATCH | FIRST_HALF | HALF_TIME | SECOND_HALF | FULL_TIME
  status:            '2H',            // PRE | 1H | HT | 2H | FT
  score:             { home: 1, away: 0 },
  htScore:           { home: 1, away: 0 },  // null until half-time
  time:              { minute: 67, displayTime: '67:00' },
  events:            [{ type: 'GOAL_HOME', minute: 23 }],
  statistics:        { home: { corners: 4, yellowCards: 1, redCards: 0 },
                       away: { corners: 2, yellowCards: 2, redCards: 0 } },
  odds:              { /* full MarketPacket — null when suspended */ },
  risk:              { /* risk indicators */ },
  
  // Chapter 8D: Active suspension tracking
  isSuspended:       false,           // true = market locked
  suspensionReason:  null,            // 'TRANSITION'|'GOAL'|'RED_CARD'|'PENALTY'|null
  pendingPenalty:    false,           // true = indefinite lock waiting for outcome
  
  seasonId:          'S01',           // season label
  roundNumber:       12,              // 1-based round within the season
  updateType:        'TICK',          // 'TICK' on normal tick; event type string on major events
  leagueName:        'PREMIER',       // league identifier — use to route updates on multi-league boards
  leagueRoom:        'league:PREMIER' // Socket.io room the update was sent to
}
```

> **Room isolation (v1.6.0+):** Updates are emitted to `league:<LEAGUENAME>` (e.g. `league:PREMIER`). All 10 slots within a league share one room. Use `leagueName` to route updates to the correct display panel.

> **Goal animation deduplication:** `events` can repeat the latest goal event on consecutive ticks. Trigger animations once per unique goal signature (e.g., `type + minute + score.home + score.away`) rather than on every tick.

**`LEAGUE_FINAL` shape:**
```javascript
{
  matchId:       'LEAGUE-003',
  gameId:        'VFL-L03-S01-R012',
  fixtureId:     'VFL-L03-S01-R012',  // settlement identity
  seasonId:      'S01',
  homeTeam:      'Arsenal',
  awayTeam:      'Chelsea',
  score:         { home: 2, away: 1 },
  roundNumber:   12,                   // NOTE: use roundNumber (not roundNum)
  message:       'FT: Arsenal 2–1 Chelsea'
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

**Single-selection request (backward-compatible):**
```http
POST /cashier/v1/turbo-soccer/bets/place
Content-Type: application/json

{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "matchId": "VFL-L01-S01-R012-M01",     ← canonical fixture ID (preferred) or LEAGUE-001 (backward compat)
  "market": "match_winner",
  "selection": "home",
  "stake": 100,
  "requested_odds": 1.85,
  "client_timestamp": 1746614400000,     ← recommended: Date.now() at slip construction
  "prematch": true                        ← optional but recommended for explicit pre-match intent
}
```

**Multi-selection accumulator:**
```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "stake": 500,
  "client_timestamp": 1746614400000,
  "selections": [
    {
      "matchId": "VFL-L01-S01-R012-M01",  ← canonical fixture ID
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 1.95
    },
    {
      "matchId": "VFL-L04-S01-R012-M04",  ← another fixture
      "market": "btts",
      "selection": "GG",
      "requested_odds": 1.82
    }
  ]
}
```

**Multi-selection combinator (split-stake, see [§13](#13-accumulator--combinator-models)):**
```json
{
  "cashierId": "665f1a2b3c4d5e6f7a8b9c0d",
  "type": "combinator",                   ← explicit combinator type
  "stake": 500,
  "client_timestamp": 1746614400000,
  "selections": [
    {
      "matchId": "VFL-L01-S01-R012-M01",
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 1.95
    },
    {
      "matchId": "VFL-L04-S01-R012-M04",
      "market": "btts",
      "selection": "GG",
      "requested_odds": 1.82
    }
  ]
}
```

**Combo-market leg (single or accumulator):**
```json
{
  "matchId": "VFL-L01-S01-R012-M01",
  "market": "combo_result_ou25",          ← match result + O/U 2.5 combined
  "selection": "1 & Over",                ← exact string from odds packet
  "requested_odds": 4.20
}
```

| Field | Required | Description |
|---|---|---|
| `cashierId` | ✓ | MongoDB ObjectId of the logged-in cashier. Stake debited from this cashier's wallet. |
| `market` | ✓ | Market key — see [§12 Market Identifiers](#12-market-identifiers-reference) |
| `selection` | ✓ | Selection value — must match exact key in odds packet (including spaces/case for combo markets) |
| `stake` | ✓ | Positive number in operator currency units |
| `matchId` | ✓ (cond.) | Required in single-selection mode. In multi-selection mode use `selections[].matchId`. **Prefer canonical fixture ID** (`VFL-L01-S01-R012-M01`); `LEAGUE-*` slot IDs accepted for backward compatibility. |
| `requested_odds` | | Client-side odds snapshot for drift detection |
| `type` | | Bet type: omit for auto-detection (1 leg → `single`, 2+ legs → `accumulator`), or explicit `single`, `accumulator`, `combinator` |
| `prematch` | | `true` for pre-match window (default). Set `false` only for early in-play bets via this endpoint. |
| `auto_accept_changes` | | Accept minor odds drift automatically (default: `false`) |
| `client_timestamp` | | **Recommended:** Unix ms at slip-construction time (e.g., `Date.now()`). Enables consistent Grace Period drift detection on engine side. |

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

Place bets during an active match. The **Grace Period Middleware** automatically handles minor odds drift (within ±0.05) to account for network latency.

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
  "odds": 1.80,                          ← odds displayed on terminal at click time
  "client_timestamp": 1746614405000,     ← required: Date.now() at click time
  "auto_accept_changes": true            ← accept minor drift automatically
}
```

Both routes are supported and equivalent. Frontend may use either path.

| Field | Required | Description |
|---|---|---|
| `cashierId` | ✓ | MongoDB ObjectId of the cashier |
| `market` | ✓ | Market key — see [§24 Market Identifiers](#24-market-identifiers-reference-detailed) |
| `selection` | ✓ | Selection value |
| `stake` | ✓ | Positive number |
| `odds` | ✓ | **Decimal odds displayed at click time** — used by Grace Period for drift detection |
| `client_timestamp` | ✓ | **Required:** Unix ms at click time (e.g., `Date.now()`). Engine uses this + server clock offset to determine request age. |
| `matchId` | ✓ | Live match slot ID (`LEAGUE-*`). Prefer fixture ID (`VFL-L03-S01-R012-M03`) for settlement-grade identity. |
| `auto_accept_changes` | | Accept minor odds drift (±0.05) automatically (default: `false`) |

**Success `200` (odds unchanged or improved):**
```json
{
  "approved": true,
  "bet_id": "BET-1746624051240-CD34E",
  "market": "next_goal",
  "selection": "home",
  "stake": 50,
  "requested_odds": 1.80,
  "final_odds": 1.80,
  "timestamp": "2026-05-13T14:23:14.000Z",
  "message": null
}
```

**Success `200` (drift within tolerance + auto-accept):**
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

**Failure `409` (drift outside tolerance or manual rejection):**
```json
{
  "approved": false,
  "error": "Odds have changed",
  "error_code": "ODDS_CHANGED",
  "current_odds": 1.74,
  "message": "Requested 1.80, now 1.74 — resubmit with new odds?"
}
```

### Grace Period Drift Handling Rules

The middleware applies these rules based on time elapsed and odds change:

| Scenario | Drift | Engine Decision | HTTP Response |
|----------|-------|-----------------|---|
| No time elapsed | ≤0.05 | Accept at requested odds | `200 OK` |
| Odds improved | Any | Always accept at new odds | `200 OK` |
| Drift within tolerance | ±0.05 | Accept if `auto_accept_changes: true`; reject if `false` | `200 OK` or `409 ODDS_CHANGED` |
| Drift outside tolerance | >0.05 | Always reject | `409 ODDS_CHANGED` with `current_odds` |
| Request stale | >3 seconds old | Always reject | `422 UNPROCESSABLE_ENTITY` |
| Market suspended/locked | Any | Always reject | `403 FORBIDDEN` |
| Market closed | Any | Always reject | `400 BAD_REQUEST` |

### Client-Side Drift UX Pattern

**Recommended user flow:**

```javascript
async function placeLiveBet(matchId, market, selection, requestedOdds) {
  // Step 1: Show confirmation dialog with requested odds
  const confirmed = await showConfirmDialog({
    title: 'Place Live Bet?',
    message: `${selection} @ ${requestedOdds}`,
    stake: 50
  });
  if (!confirmed) return;

  // Step 2: Submit with client timestamp (guarantees consistent grace window)
  const response = await api.post('/cashier/v1/turbo-soccer/bets/live', {
    matchId,
    market,
    selection,
    stake: 50,
    odds: requestedOdds,
    client_timestamp: Date.now(),
    auto_accept_changes: false  ← force explicit user approval on drift
  });

  // Step 3a: Accepted at requested odds
  if (response.approved && response.final_odds === requestedOdds) {
    showSuccess(`Bet placed @ ${requestedOdds}`);
    return;
  }

  // Step 3b: Accepted with drift
  if (response.approved && response.final_odds !== requestedOdds) {
    showWarning(`Odds moved to ${response.final_odds} — accepted`);
    return;
  }

  // Step 3c: Rejected due to drift
  if (!response.approved) {
    const newOdds = response.current_odds;
    const resubmit = await showConfirmDialog({
      title: 'Odds Have Changed',
      message: `Now ${newOdds} (was ${requestedOdds}) — resubmit?`
    });
    if (resubmit) {
      // Retry with fresh client_timestamp and new odds
      return placeLiveBet(matchId, market, selection, newOdds);
    }
  }
}
```

---

## 6. Validate Live Odds (Pre-flight)

Call before showing the confirmation screen to check if odds are still valid. Does **not** place a bet or debit the wallet.

**Use cases:**
- Pre-flight validation before displaying confirmation dialog
- Deduplication check (prevent duplicate bets if terminal UI is slow)
- Odds drift detection without commitment

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

## 7. WebSocket Bet Placement

Place single or multi-leg bets in real-time via Socket.io `place_bet` event. Bet is persisted to MongoDB and confirmed with `bet_placed` or `bet_error` response before returning to client (no fire-and-forget).

**Use case:** Premium terminals requiring real-time confirmation feedback, kiosks with instant database verification.

**Single-selection via WebSocket:**
```javascript
const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

socket.emit('place_bet', {
  selections: [{
    matchId: "VFL-L01-S01-R012-M01",
    market: "match_winner",
    selection: "home",
    requested_odds: 1.95
  }],
  stake: 500,
  cashierId: "665f1a2b3c4d5e6f7a8b9c0d",
  client_timestamp: Date.now()
});

socket.once('bet_placed', (response) => {
  clearTimeout(timeout);
  console.log('✓ Bet placed:', response.bet_id);
  console.log('  MongoDB ID:', response._meta.dbId);  // ObjectId for audit
  console.log('  Timestamp:', response._meta.placedAt);
});

socket.once('bet_error', (error) => {
  clearTimeout(timeout);
  reject(new Error(error.message || 'Bet placement failed'));
});
```

**Accumulator (multi-leg):**
```javascript
socket.emit('place_bet', {
  selections: [
    {
      matchId: "VFL-L01-S01-R012-M01",
      market: "match_winner",
      selection: "home",
      requested_odds: 1.95
    },
    {
      matchId: "VFL-L04-S01-R012-M04",
      market: "btts",
      selection: "GG",
      requested_odds: 1.82
    }
  ],
  stake: 500,
  cashierId: "665f1a2b3c4d5e6f7a8b9c0d",
  userId: "PLAYER-123",                    ← optional player ID for bet attribution
  client_timestamp: Date.now()
});
```

**`bet_placed` response (success):**
```json
{
  "success": true,
  "bet_id": "BET-1746624051234-AB12C",
  "type": "accumulator",
  "stake": 500,
  "totalOdds": 3.549,
  "potentialReturn": 1774.5,
  "status": "PENDING",
  "timestamp": "2026-05-07T14:23:11.000Z",
  "selections": [
    {
      "matchId": "VFL-L01-S01-R012-M01",
      "homeTeam": "Manchester City",
      "awayTeam": "Liverpool FC",
      "market": "match_winner",
      "selection": "home",
      "accepted_odds": 1.95
    },
    {
      "matchId": "VFL-L04-S01-R012-M04",
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea",
      "market": "btts",
      "selection": "GG",
      "accepted_odds": 1.82
    }
  ],
  "_meta": {
    "placedAt": "2026-05-07T14:23:11.456Z",
    "dbPersisted": true,
    "dbId": "507f1f77bcf86cd799439011",
    "ticketId": "BET-1746624051234-AB12C"
  }
}
```

| Field | Description |
|---|---|
| `_meta.placedAt` | Server timestamp when bet was placed |
| `_meta.dbPersisted` | Whether bet was successfully saved to MongoDB |
| `_meta.dbId` | MongoDB ObjectId — use for audit/reconciliation |
| `_meta.ticketId` | Ticket ID for internal tracking |

**`bet_error` response (failure):**
```json
{
  "success": false,
  "error": "Market currently suspended (Goal)",
  "code": "MARKET_SUSPENDED",
  "message": "Cannot place bets during suspension",
  "_meta": {
    "dbPersisted": false,
    "dbError": null
  }
}
```

**Error codes (same as REST `/api/bets/place`):**
- `MARKET_SUSPENDED` — market locked (goal, red card, penalty, transition)
- `ODDS_STALE` — odds drifted beyond tolerance
- `NETWORK_TIMEOUT` — request > 3s old
- `INVALID_MARKET` — unknown market or selection
- `MATCH_NOT_FOUND` — fixture does not exist
- `INSUFFICIENT_BALANCE` — wallet insufficient (if ledger-based)

---

## 8. Bet History

```http
GET /cashier/v1/turbo-soccer/bets/history?page=1&limit=20
```

| Query | Default | Max |
|---|---|---|
| `page` | 1 | — |
| `limit` | 20 | 100 |

---

## 9. Void a Bet

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

## 10. Settlement Webhook

Turbo Soccer settlement is automatic. The cashier API does not call an endpoint to trigger settlement; it receives signed VF Engine callbacks and updates local tickets/wallets from the payload.

| Channel | Delivery | Use |
|---|---|---|
| Settlement webhook | Push from VF Engine | Instant micro-market and full-time ticket grading |
| Results polling | Pull through cashier API | Results screens, daily audit, missed-webhook reconciliation |

### 10.1 Register the Engine Webhook

Register the cashier API settlement URL with the VF Engine once per deployment:

```http
POST /cashier/v1/turbo-soccer/admin/webhooks/settlement
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "targetUrl": "https://cashier-api.example.com/cashier/v1/turbo-soccer/webhooks/settlement",
  "secret": "your-hmac-secret-minimum-32-characters-long",
  "description": "Cashier API production settlement callback"
}
```

The cashier API proxies this to VF Engine `POST /api/admin/webhooks/settlement`. The same secret must be configured locally as `VFENGINE_WEBHOOK_SECRET`.

```bash
VFENGINE_WEBHOOK_SECRET=your-hmac-secret-minimum-32-characters-long
```

**Secret rules:**
- Minimum 32 characters
- Keep it in environment configuration; do not hardcode it
- Rotate by registering a new webhook with the new secret, then deleting the old registration

### 10.2 Receive and Verify Settlement

VF Engine posts canonical settlement events to:

```http
POST /cashier/v1/turbo-soccer/webhooks/settlement
X-Signature: sha256=<hmac_hex_digest>
Content-Type: application/json
```

This route requires **no JWT**. It is protected by HMAC-SHA256 over the raw request body bytes. The Express route is mounted with `express.raw({ type: 'application/json' })`; do not place JSON parsing middleware before this route.

**Response behavior:**
- `401` for missing or invalid `X-Signature`
- `400` for invalid JSON after signature verification
- `200 { "received": true }` immediately for a valid signed JSON payload
- Settlement processing continues asynchronously after the `200` response

### 10.3 Payloads

The handler accepts canonical VF payloads and legacy migration aliases.

**Supported events:**
- `MARKET_SETTLED` - instant settlement for a micro-market during play
- `MATCH_SETTLED` - full-time settlement sweep for unresolved tickets
- `market.settlement.complete` - legacy alias of `MARKET_SETTLED`
- `settlement.complete` - legacy alias of `MATCH_SETTLED`

**MARKET_SETTLED (instant):**
```json
{
  "event": "MARKET_SETTLED",
  "fixture_id": "VFL-L01-S01-R012-M01",
  "market_id": "NEXT_GOAL",
  "resolution_time": "2026-05-08T14:12:05.000Z",
  "winning_selection": "HOME",
  "tickets_graded": [
    {
      "ticket_hash": "BET-1746624051234-AB12C",
      "status": "WON",
      "payout_amount": 3225.00
    },
    {
      "ticket_hash": "BET-1746624051999-CD34E",
      "status": "LOST",
      "payout_amount": 0
    }
  ],
  "event_aliases": ["market.settlement.complete"]
}
```

**MATCH_SETTLED (full time):**
```json
{
  "event": "MATCH_SETTLED",
  "fixture_id": "VFL-L01-S01-R012-M01",
  "final_score": "2-1",
  "resolution_time": "2026-05-08T14:32:05.000Z",
  "tickets_graded": [
    {
      "ticket_hash": "BET-1746624052999-EF56G",
      "status": "WON",
      "payout_amount": 975.00
    }
  ],
  "event_aliases": ["settlement.complete"]
}
```

**Migration-compatible payloads:** `bets[]`, `ticketHash`, `betId`, `ticketId`, `vfBetId`, `result`, `payout`, `payoutAmount`, `fixtureId`, `matchId`, `finalScore`, `settledAt`, and `resolutionTime` remain accepted during migration.

### 10.4 Field Reference

| Field | Type | Notes |
|---|---|---|
| `event` | string | `MARKET_SETTLED` or `MATCH_SETTLED` |
| `fixture_id` | string | Stable settlement fixture ID; preferred match foreign key |
| `market_id` | string | Present on `MARKET_SETTLED`, normalized uppercase market key |
| `winning_selection` | string | Present on `MARKET_SETTLED` |
| `final_score` | string | Present on `MATCH_SETTLED` |
| `resolution_time` | ISO string | UTC settlement timestamp |
| `tickets_graded[].ticket_hash` | string | Ticket/bet reference returned at placement |
| `tickets_graded[].status` | string | `WON`, `LOST`, `VOID`, or `PENDING` |
| `tickets_graded[].payout_amount` | number | Amount to credit for winning tickets |

### 10.5 Local Processing Rules

**Ticket lookup:** each settled entry is matched by `vfBetId` or `ticketId`. Identifier resolution order is `ticket_hash`, `ticketHash`, `betId`, `ticketId`, then `vfBetId`.

**Idempotency:** only open Turbo Soccer tickets are updated:

```javascript
{
  gameType: 'turbo-soccer',
  roundHasEnded: false,
  cancelled: false
}
```

Replayed webhooks or dual canonical/legacy deliveries do not double-credit wallets because already-settled tickets no longer match the open-ticket filter.

**Outcome handling:**
- `WON`: mark result as `win`, set `winnings`, mark payout complete, credit the cashier wallet by `payout_amount`
- `LOST`: mark result as `loss`, no wallet credit
- `VOID`: mark the ticket cancelled and payout complete; this implementation does not credit a refund from the settlement webhook
- `PENDING` or unsupported statuses are skipped
- Negative or invalid payout values are treated as `0`

Processing is sequential inside one webhook to avoid wallet balance races when multiple graded tickets belong to the same cashier.

### 10.6 Signature Verification Example

```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature));

  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
```

### 10.7 Reconciliation via Results Polling

Use results polling as an audit/fallback channel for completed matches:

```http
GET /cashier/v1/turbo-soccer/results?date=2026-06-12
Authorization: Bearer <access_token>
```

This proxies VF Engine `GET /api/results`. It returns completed match panels with final scores and metadata, but not per-ticket payouts. If a webhook was permanently missed, re-derive open ticket outcomes from your local tickets and the result score.

```json
{
  "success": true,
  "total": 24,
  "panels": [
    {
      "panelIndex": 0,
      "season": 18111,
      "roundNumber": 12,
      "week": 4,
      "completedAt": "2026-06-12T13:55:00.000Z",
      "matches": [
        {
          "matchId": "PREMIER-R12-S01",
          "leagueName": "PREMIER",
          "homeTeam": "Manchester City",
          "awayTeam": "Liverpool FC",
          "htScore": { "home": 1, "away": 0 },
          "finalScore": { "home": 2, "away": 1 },
          "completedAt": "2026-06-12T13:55:00.000Z"
        }
      ]
    }
  ]
}
```

### 10.8 Logging and Audit Trail

The cashier API logs settlement start and completion with event, match/fixture IDs, league name, ticket counts, skipped entries, wallet credits, and credit failures. Signature mismatches, malformed JSON, missing ticket references, and wallet-credit errors are logged with context for investigation.

---

## 11. Suspension Tracking (Chapter 8D)

### Active Suspension State

Each `LEAGUE_UPDATE` event includes real-time suspension tracking fields:

```javascript
{
  matchId:          'LEAGUE-001',
  isSuspended:      false,           // true = market locked
  suspensionReason: null,            // 'TRANSITION'|'GOAL'|'RED_CARD'|'PENALTY'|null
  pendingPenalty:   false,           // true = indefinite lock waiting for outcome
  odds:             { /* MarketPacket */ },
  // ... other fields
}
```

### Suspension Triggers & Durations

| Trigger | `suspensionReason` | Duration | `odds` | Notes |
|---------|-------------------|----------|--------|-------|
| Kickoff (min 0) | `TRANSITION` | 3 seconds | `null` | Market lock during kickoff countdown |
| Goal scored | `GOAL` | 5 seconds | `null` | Lock after each goal to prevent ghost bets |
| Red card shown | `RED_CARD` | 5 seconds | `null` | Safety buffer for player dismissal |
| Penalty awarded | `PENALTY` | Indefinite | `null` | Lock until penalty resolved (scored/missed) |
| No suspension | `null` | — | Valid odds object | Market is LIVE and accepting bets |

### Client-Side Suspension Handling

**Checklist:**
- [ ] Block bet submission when `isSuspended: true` OR `odds === null`
- [ ] Show suspension reason to operator: `"Markets suspended: ${suspensionReason}"` or `"Markets locked"`
- [ ] If `pendingPenalty: true`, show indefinite lock indicator: `"Awaiting penalty outcome — markets remain locked"`
- [ ] Disable bet slip input for the duration shown above
- [ ] Auto-resume when suspension clears: `isSuspended: false` AND `odds !== null`

**Implementation:**
```javascript
socket.on('LEAGUE_UPDATE', (slot) => {
  if (slot.isSuspended || slot.odds === null) {
    // Market locked — disable bets
    disableBetInput(slot.matchId);
    const msg = slot.suspensionReason 
      ? `Markets suspended: ${slot.suspensionReason}` 
      : 'Markets locked';
    showMarketLock(msg);
    if (slot.pendingPenalty) {
      showWarning('Awaiting penalty outcome — indefinite lock');
    }
  } else {
    // Market LIVE — resume normal operations
    enableBetInput(slot.matchId);
    clearMarketLock();
    updateOdds(slot.odds);
  }
  updateScoreboard(slot);
});
```

### Dead Markets (Individual Market Closure)

A dead market is one whose outcome is already determined. The engine sets `status: "CLOSED"` on the market and returns `null` for its odds fields in the `MarketPacket`.

| Market | Closes When |
|--------|-------------|
| `btts` | Both teams scored OR impossible (e.g., 0-0 at 90 min) |
| `ou_1.5`–`ou_4.5` | Sufficient goals scored to guarantee the over |
| `first_half` | Minute ≥ 45 |
| `fh_ou_*` | First-half over |
| `second_half` | Minute ≥ 90 |
| `sh_ou_*` | Second-half over |
| `next_goal` | Minute ≥ 88 |
| `fh_goal_ng` | Any goal in first half OR first-half ends |
| `sh_goal_ng` | Any goal in second half OR match ends |
| `win_both_halves` | Match ends (full time) |

**Client action:** Do not display or accept bets on dead markets. Check `market.status === "CLOSED"` before rendering market card on bet slip.

---

## 12. Market Identifiers Reference

Use these exact strings for the `market` and `selection` fields in all bet requests. See [§24 Detailed Reference](#24-market-identifiers-reference-detailed) for complete market tables.

### Quick Reference: Common Markets

| `market` | `selection` | Description |
|----------|-------------|-------------|
| `match_winner` | `home`, `draw`, `away` | Full-time 1X2 |
| `double_chance` | `home_draw`, `home_away`, `draw_away` | Double chance |
| `btts` | `GG`, `NG` | Both teams to score |
| `ou_1.5` to `ou_4.5` | `over`, `under` | Goals O/U (lines 1.5–4.5) |
| `first_half` | `home`, `draw`, `away` | First-half result |
| `second_half` | `home`, `draw`, `away` | Second-half result |
| `next_goal` | `home`, `away` | Next goal scorer |
| `next_corner` | `home`, `away` | Next corner |
| `corners` | `over`, `under` | Total corners |
| `combo_result_ou25` | `1 & Over`, `1 & Under`, `X & Over`, etc. | 1X2 + O/U 2.5 combined |
| `combo_result_btts` | `1 & GG`, `1 & NG`, `X & GG`, etc. | 1X2 + BTTS combined |
| `correct_score` | `0-0`, `1-0`, `1-1`, … | Exact final score |
| `total_goals` | `0`, `1`, `2`, `3`, `4`, `5`, `6+` | Total goals exact count |

> **Full list:** See [§24 Detailed Reference](#24-market-identifiers-reference-detailed) for all 50+ markets, dynamic line markets, card markets, half-time markets, and expanded markets.

---

## 13. Accumulator, Combinator & System Models

### Accumulator (All-Win Model)

**Definition:** All legs must resolve WON for the entire ticket to win. Any LOST or VOID leg results in a LOST ticket.

**Payload:**
```json
{
  "type": "accumulator",        ← explicit type (or omit for auto-detect with 2+ legs)
  "stake": 500,                 ← entire stake on the combined odds
  "selections": [               ← min 2 items
    { "matchId": "...", "market": "...", "selection": "...", "requested_odds": 1.95 },
    { "matchId": "...", "market": "...", "selection": "...", "requested_odds": 1.82 }
  ],
  "client_timestamp": Date.now()
}
```

**Response:**
```json
{
  "success": true,
  "type": "accumulator",
  "bet_id": "BET-1746624051234-AB12C",
  "stake": 500,
  "totalOdds": 3.549,             ← product of all leg odds
  "potentialReturn": 1774.5,      ← stake × totalOdds
  "selections": [ ... ],
  "_meta": { ... }
}
```

**Settlement:** Ticket wins if ALL legs win. Any single losing/void leg loses the entire ticket.

---

### Combinator (Split-Stake Model)

**Definition:** Stake is split equally across legs. Ticket wins if AT LEAST ONE leg wins. Winnings = sum of winning leg returns only. Losing legs do not cancel winning legs.

**Payload:**
```json
{
  "type": "combinator",         ← required for combinator
  "stake": 500,                 ← total stake (split equally across legs)
  "selections": [               ← min 2 items
    { "matchId": "...", "market": "...", "selection": "...", "requested_odds": 1.95 },
    { "matchId": "...", "market": "...", "selection": "...", "requested_odds": 1.82 }
  ],
  "client_timestamp": Date.now()
}
```

**Response:**
```json
{
  "success": true,
  "type": "combinator",
  "bet_id": "BET-1746624051999-CD34E",
  "stake": 500,                         ← total stake
  "totalOdds": 1.885,                   ← simplified metric (not multiplied)
  "potentialReturn": 942.5,             ← estimated return (context-dependent)
  "selections": [
    {
      "matchId": "...",
      "market": "...",
      "selection": "...",
      "requested_odds": 1.95,
      "accepted_odds": 1.95,
      "stake": 250                      ← leg stake (total ÷ leg count)
    },
    {
      "matchId": "...",
      "market": "...",
      "selection": "...",
      "requested_odds": 1.82,
      "accepted_odds": 1.82,
      "stake": 250
    }
  ],
  "_meta": { ... }
}
```

**Settlement:** Ticket wins if at least one leg wins. Winnings = sum of ALL winning leg payouts (stake per leg × odds per leg).

**Example:**
- Leg 1: stake 250, odds 1.95 → win: 250 × 1.95 = 487.50
- Leg 2: stake 250, odds 1.82 → loss: 0
- Ticket result: WON, Winnings: 487.50 (not 942.5)

---

### System + Banker (Line-Generation Model)

**Definition:** The engine generates combination lines from non-banker selections only, then multiplies banker legs into every generated line.

**Payload:**
```json
{
  "type": "system",
  "systemSize": 2,
  "stake": 1000,
  "client_timestamp": 1746614400000,
  "selections": [
    {
      "matchId": "VFL-L01-S01-R012-M01",
      "market": "match_winner",
      "selection": "home",
      "requested_odds": 2.00,
      "is_banker": true
    },
    {
      "matchId": "VFL-L01-S01-R012-M02",
      "market": "btts",
      "selection": "GG",
      "requested_odds": 2.00
    },
    {
      "matchId": "VFL-L01-S01-R012-M03",
      "market": "double_chance",
      "selection": "1X",
      "requested_odds": 2.00
    },
    {
      "matchId": "VFL-L01-S01-R012-M04",
      "market": "draw_no_bet",
      "selection": "away",
      "requested_odds": 2.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "type": "system",
  "bet_id": "BET-1746624052999-EF56G",
  "stake": 3000,
  "systemSize": 2,
  "unitStake": 1000,
  "linesGenerated": 3,
  "bankerCount": 1,
  "regularCount": 3,
  "totalOdds": 8.0,
  "potentialReturn": 24000,
  "status": "PENDING",
  "bet_lines": [
    { "line_id": "LINE_1", "line_odds": 8.0, "line_payout": 8000, "status": "PENDING" },
    { "line_id": "LINE_2", "line_odds": 8.0, "line_payout": 8000, "status": "PENDING" },
    { "line_id": "LINE_3", "line_odds": 8.0, "line_payout": 8000, "status": "PENDING" }
  ]
}
```

**Rules:**
- `systemSize` applies only to non-banker selections.
- Banker legs are marked with `is_banker: true`.
- Requested `stake` is unit stake per generated line.
- Total stake debited = unit stake × lines generated.
- If any banker settles `LOST`, the full ticket settles `LOST` immediately.
- Banker `VOID` is treated as odds `1.00`.

---

## 14. Tickets & Printing (Chapter 10)

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
> **`matchId` identity:** use the scheduled fixture ID (`fixtureId` / `gameId`, e.g. `"VFL-L01-S01-R012"`) as `matchId` for settlement-grade identity — this is the canonical form recommended throughout this guide. The `LEAGUE-*` slot ID (from `fixtures[].matchId` in `PREMATCH_SCHEDULE` or `GET /league/prematch/schedule`) is also accepted by the VF Engine and remains stable within a season, but is a display/routing identifier rather than a settlement-grade one.

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

## 15. Thermal Printing (Chapter 10B)

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

## 16. Admin — Margins

> Requires `manageGameConfig` role.

```http
GET  /cashier/v1/turbo-soccer/admin/margins
GET  /cashier/v1/turbo-soccer/admin/margins/preview?margin=1.10
PUT  /cashier/v1/turbo-soccer/admin/match/:matchId/margin
     Body: { "margin": 1.10 }    // range: 1.00–1.30
```

`preview` returns a probability → odds table at the given margin without modifying any match.

---

## 17. Admin — Leagues

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

## 18. Admin — Accumulator

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

## 19. Admin — Throttler

> Requires `manageGameConfig` role.

```http
GET /cashier/v1/turbo-soccer/admin/throttler/status
```

Returns `lastDecayBroadcast`, `lastMajorEventTimestamp`, and `timeDecayIntervalMs`.

---

## 20. Admin — Match Control

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

## 21. Admin — Webhook Management

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

## 22. Role Summary

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

## 23. Error Codes & Validation

### HTTP Status Codes & Error Responses

```json
{
  "code": 409,
  "message": "Odds have changed",
  "error_code": "ODDS_CHANGED",
  "current_odds": 1.78
}
```

| HTTP | `error_code` | Meaning | Extra Fields |
|---|---|---|---|
| 400 | `MARKET_CLOSED` | Market outcome already determined (e.g., BTTS after both teams score) | — |
| 400 | — | Insufficient funds / invalid stake / malformed request | — |
| 403 | `MARKET_SUSPENDED` | Market locked (goal/red card/penalty/kickoff TRANSITION) | — |
| 403 | — | Authenticated but not authorized for this action | — |
| 404 | — | Cashier, wallet, or fixture not found | — |
| 409 | `ODDS_CHANGED` | Odds drifted beyond Grace Period tolerance; show user the new odds | `current_odds` |
| 422 | `ODDS_STALE` | Odds drifted heavily or network latency > 3s; request is stale | — |
| 422 | `NETWORK_TIMEOUT` | Request timed out during validation | — |
| 422 | `GHOST_BET` | Major event occurred after ticket placement; bet rejected for safety | — |
| 500 | — | Engine accepted the bet but local ticket persistence failed; wallet rollback applied | — |
| 502 | — | VF Engine unreachable from cashier API | — |
| 503 | `NO_ACTIVE_MATCH` | No active match for this slot | — |

### Grace Period Validation Rules

The Grace Period Middleware (in-play betting) applies these rules:

| Condition | Outcome | HTTP |
|---|---|---|
| Odds unchanged | Accepted immediately | `200 OK` |
| Drift within ±0.05 tolerance + `auto_accept_changes: true` | Accepted with adjusted final_odds | `200 OK` |
| Drift within ±0.05 tolerance + `auto_accept_changes: false` | Rejected; show current_odds | `409 CONFLICT` |
| Drift outside tolerance (drop > 0.05) | Rejected regardless of flag | `409 CONFLICT` |
| Odds improved (in punter's favour) | Always accepted | `200 OK` |
| Match `SUSPENDED` or `TRANSITION` | Rejected; market locked | `403 FORBIDDEN` |
| Market `CLOSED` | Rejected; outcome determined | `400 BAD_REQUEST` |
| Network latency > 3 seconds | Rejected; stale request | `422 UNPROCESSABLE` |
| Major event after placement | Rejected; ghost-bet protection | `422 UNPROCESSABLE` |

---

## 24. Market Identifiers Reference (Detailed)

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

