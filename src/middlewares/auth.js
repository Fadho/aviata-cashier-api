const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { roleRights } = require('../config/roles');

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;

  if (requiredRights.length) {
    const userRights = roleRights.get(user.role);
    const hasRequiredRights = requiredRights.every((requiredRight) => userRights.includes(requiredRight));
    if (!hasRequiredRights && req.params.userId !== user.id) {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
    }
  }

  resolve();
};

const auth =
  (...requiredRights) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };
const apiKeyAuth =
  (...requiredScopes) =>
  async (req, res, next) => {
    return new Promise((resolve, reject) => {
      passport.authenticate('api-key', { session: false }, (err, user, info) => {
        if (err || !user) {
          return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid API key'));
        }
        const scopes = (info && info.scopes) || [];
        const hasRequiredScopes =
          !requiredScopes.length || scopes.includes('*') || requiredScopes.every((scope) => scopes.includes(scope));
        if (!hasRequiredScopes) {
          return reject(new ApiError(httpStatus.FORBIDDEN, 'API key does not have the required scope'));
        }
        req.user = user;
        req.authInfo = info;
        resolve();
      })(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };

module.exports = { auth, apiKeyAuth };
