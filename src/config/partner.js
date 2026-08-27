const partnerApiScopes = Object.freeze({
  ALL: '*',
  GAME_LAUNCH: 'game:launch',
  GAMES_READ: 'games:read',
  BETS_WRITE: 'bets:write',
  BETS_READ: 'bets:read',
});

const allowedPartnerApiScopes = Object.freeze(Object.values(partnerApiScopes));
const defaultPartnerApiScopes = Object.freeze([partnerApiScopes.ALL]);
const supportedPartnerGames = Object.freeze(['aviata', 'shootout', 'aviatax', 'turbo-soccer']);
const partnerGameCatalog = Object.freeze({
  aviata: 'Aviata',
  shootout: 'Shootout',
  aviatax: 'Aviata X',
  'turbo-soccer': 'Turbo Soccer',
});

module.exports = {
  partnerApiScopes,
  allowedPartnerApiScopes,
  defaultPartnerApiScopes,
  supportedPartnerGames,
  partnerGameCatalog,
};
