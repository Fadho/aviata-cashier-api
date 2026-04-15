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
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  secure: envVars.SECURE,
  websocket_url: envVars.WEBSOCKET_URL,
  aviata_websocket_url: envVars.AVIATA_WEBSOCKET_URL,
  allowedOrigins: envVars.ALLOWED_ORIGINS,
  mongoose: {
    url: envVars.MONGODB_URL + (envVars.NODE_ENV === 'test' ? '-test' : ''),
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
};
