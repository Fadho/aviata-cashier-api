const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const { encryptMiddleware, decryptMiddleware } = require('./middlewares/encryption');

const app = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

if (!config.secure) {
  // parse json request body
  app.use(express.json());
}

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

if (config.secure) {
  // bodyparser for encryption: handles plaintext content-type
  app.use(bodyParser.text({ type: 'text/plain', limit: '10mb' }));

  // Decryption middleware
  app.use(decryptMiddleware);

  // Encryption middleware
  app.use(encryptMiddleware);
}

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
const allowedOrigins = [
  'https://bo.sbegames.com',
  'https://cashier.sbegames.com',
  'https://websocket.aviata.sportsbookengine.com',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (config.env === 'development') {
      // Allow access from anywhere in development
      callback(null, true);
    } else if (
      !origin ||
      allowedOrigins.some((pattern) => {
        if (typeof pattern === 'string') {
          return origin === pattern;
        }
        return pattern.test(origin);
      })
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/cashier/v1/auth', authLimiter);
}

if (config.env === 'production') {
  // v1 api routes
  app.use('/cashier/v1', routes);
} else {
  // v1 api routes
  app.use('/v1', routes);
}

app.get('/', (req, res) => {
  res.status(httpStatus.OK).json({
    message: 'Welcome to Aviata API',
  });
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
