const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    SECURE: Joi.boolean().default(false),
    MONGODB_URL: Joi.string().required().description('ALLOWED_ORIGINS'),
    WEBSOCKET_URL: Joi.string().required().description('websocket base url'),
    ALLOWED_ORIGINS: Joi.string().required().description('allowed origins: production env'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    RESEND_API_KEY: Joi.string().required().description('Resend email service API key'),
    RESEND_FROM_EMAIL: Joi.string().description('Resend service from email address'),
    AVIATA_WEBSOCKET_URL: Joi.string().required().description('Aviata websocket base url'),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which reset password token expires'),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number()
      .default(10)
      .description('minutes after which verify email token expires'),
    GAME_LAUNCHER_URL: Joi.string().uri().required().description('Base URL of the game launcher frontend'),
    VFENGINE_BASE_URL: Joi.string().uri().required().description('Virtual Football Engine base URL'),
    VFENGINE_JWT_SECRET: Joi.string().required().description('Shared JWT secret for VF Engine auth'),
    VFENGINE_WEBHOOK_SECRET: Joi.string().required().description('HMAC-SHA256 secret for VF Engine settlement webhooks'),
    VFENGINE_OPERATOR_ID: Joi.string().required().description('Operator ID included in VF Engine JWT claims'),
    VFENGINE_CLOCK_OFFSET_MS: Joi.number()
      .integer()
      .default(0)
      .description(
        'Clock offset in ms to add to client_timestamp when forwarding to VF Engine (use to compensate for server clock skew)'
      ),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

/**
 * Validates webhook secret configuration.
 * Called at server startup to fail fast if misconfigured.
 *
 * @throws {Error} if secret is invalid
 */
const validateWebhookSecret = () => {
  const secret = envVars.VFENGINE_WEBHOOK_SECRET;

  if (!secret || secret.trim() === '') {
    throw new Error('VFENGINE_WEBHOOK_SECRET is not configured (empty or whitespace)');
  }

  if (secret.length < 32) {
    throw new Error(`VFENGINE_WEBHOOK_SECRET must be at least 32 characters (current: ${secret.length})`);
  }

  // Allow alphanumeric, dash, underscore, and common special characters used in secrets
  // eslint-disable-next-line no-useless-escape
  if (!/^[a-zA-Z0-9\-_!@#$%^&*+=.,:;/?\\|~`]+$/.test(secret)) {
    throw new Error('VFENGINE_WEBHOOK_SECRET contains invalid characters');
  }
};

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  secure: envVars.SECURE,
  websocket_url: envVars.WEBSOCKET_URL,
  aviata_websocket_url: envVars.AVIATA_WEBSOCKET_URL,
  allowedOrigins: envVars.ALLOWED_ORIGINS,
  mongoose: {
    url: (() => {
      if (envVars.NODE_ENV !== 'test') return envVars.MONGODB_URL;
      // Insert '-test' before the query string so only the DB name gets the suffix,
      // not the authSource parameter (e.g. authSource=admin must stay 'admin').
      const qIdx = envVars.MONGODB_URL.indexOf('?');
      return qIdx === -1
        ? `${envVars.MONGODB_URL}-test`
        : `${envVars.MONGODB_URL.slice(0, qIdx)}-test${envVars.MONGODB_URL.slice(qIdx)}`;
    })(),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    },
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  resend: {
    apiKey: envVars.RESEND_API_KEY,
    fromEmail: envVars.RESEND_FROM_EMAIL,
  },
  gameLauncherUrl: envVars.GAME_LAUNCHER_URL,
  vfengine: {
    baseUrl: envVars.VFENGINE_BASE_URL,
    jwtSecret: envVars.VFENGINE_JWT_SECRET,
    webhookSecret: envVars.VFENGINE_WEBHOOK_SECRET,
    operatorId: envVars.VFENGINE_OPERATOR_ID,
    clockOffsetMs: envVars.VFENGINE_CLOCK_OFFSET_MS,
  },
  validateWebhookSecret,
};
