/**
 * Selection Builder Utility
 *
 * Provides helper functions for constructing ticket selection objects
 * with game-type-specific metadata. Used internally by service layers
 * and can be imported by retail clients for bet slip construction.
 */

/**
 * Build a Turbo Soccer selection item for a single-leg bet.
 *
 * @param {object} params
 * @param {string} params.homeTeam     - Home team name
 * @param {string} params.awayTeam     - Away team name
 * @param {string} params.market       - Market code (e.g. 'match_winner')
 * @param {string} params.selection    - Selection value (e.g. 'home', 'draw', 'away')
 * @param {number} params.odd          - Decimal odds
 * @param {number} params.stake        - Stake amount for this selection
 * @param {string} [params.betCategory='PREMATCH'] - 'PREMATCH' | 'LIVE'
 * @returns {object} Selection object
 *
 * @example
 * const selection = buildTurboSoccerSelection({
 *   homeTeam: 'Arsenal FC',
 *   awayTeam: 'Wolverhampton',
 *   market: 'match_winner',
 *   selection: 'draw',
 *   odd: 4.35,
 *   stake: 100,
 *   betCategory: 'PREMATCH'
 * });
 * // => {\n *   homeTeam: 'Arsenal FC',\n *   awayTeam: 'Wolverhampton',\n *   market: 'match_winner',\n *   selection: 'draw',\n *   odd: 4.35,\n *   oddsTaken: 4.35,\n *   betCategory: 'PREMATCH',\n *   stake: 100\n * }\n */\nconst buildTurboSoccerSelection = (params) => {\n  const {\n    homeTeam,\n    awayTeam,\n    market,\n    selection,\n    odd,\n    stake,\n    betCategory = 'PREMATCH',\n  } = params;\n\n  if (!homeTeam || !awayTeam || !market || !selection || odd === undefined || !stake) {\n    throw new Error(\n      'buildTurboSoccerSelection: missing required fields (homeTeam, awayTeam, market, selection, odd, stake)'\n    );\n  }\n\n  return {\n    homeTeam,\n    awayTeam,\n    market,\n    selection,\n    odd,\n    oddsTaken: odd, // Backward compatibility\n    betCategory,\n    stake,\n  };\n};\n\n/**\n * Build a generic selection item for other game types.\n * Only requires odd and stake.\n *\n * @param {object} params\n * @param {number} params.odd          - Decimal odds\n * @param {number} params.stake        - Stake amount\n * @param {object} [params.metadata={}] - Optional game-type-specific fields\n * @returns {object} Selection object\n *\n * @example\n * const selection = buildSelection({\n *   odd: 2.50,\n *   stake: 500,\n *   metadata: { eventId: 'match-99', eventName: 'Derby' }\n * });\n */\nconst buildSelection = (params) => {\n  const { odd, stake, metadata = {} } = params;\n\n  if (odd === undefined || !stake) {\n    throw new Error('buildSelection: odd and stake are required');\n  }\n\n  return {\n    odd,\n    stake,\n    ...metadata,\n  };\n};\n\n/**\n * Construct a multi-selection ticket payload from turbo soccer legs.\n * Each leg becomes a separate selection in the ticket.\n *\n * @param {object[]} legs - Array of { homeTeam, awayTeam, market, selection, odd, stake }\n * @param {object} params - Additional ticket parameters { cashierId, roundId, betCategory }\n * @returns {object} Ticket payload ready for Tickets.create()\n *\n * @example\n * const payload = buildTurboSoccerTicket(\n *   [\n *     { homeTeam: 'A', awayTeam: 'B', market: 'match_winner', selection: 'home', odd: 1.8, stake: 100 },\n *     { homeTeam: 'C', awayTeam: 'D', market: 'match_winner', selection: 'away', odd: 2.1, stake: 100 }\n *   ],\n *   { cashierId: '...', roundId: 'LEAGUE-001', betCategory: 'PREMATCH' }\n * );\n */\nconst buildTurboSoccerTicket = (legs, params) => {\n  const { cashierId, roundId, betCategory = 'PREMATCH' } = params;\n\n  if (!Array.isArray(legs) || legs.length === 0) {\n    throw new Error('buildTurboSoccerTicket: legs must be a non-empty array');\n  }\n  if (!cashierId || !roundId) {\n    throw new Error('buildTurboSoccerTicket: cashierId and roundId are required');\n  }\n\n  const selections = legs.map((leg) => buildTurboSoccerSelection({ ...leg, betCategory }));\n\n  const totalStake = selections.reduce((sum, sel) => sum + sel.stake, 0);\n  const totalOdds = selections.reduce((product, sel) => product * sel.odd, 1);\n  const potentialWinnings = totalStake * totalOdds;\n\n  return {\n    selections,\n    stake: totalStake,\n    potentialWinnings,\n    cashierId,\n    roundId,\n    gameType: 'turbo-soccer',\n    betType: legs.length > 1 ? 'multiple' : 'single',\n  };\n};\n\nmodule.exports = {\n  buildTurboSoccerSelection,\n  buildSelection,\n  buildTurboSoccerTicket,\n};\n