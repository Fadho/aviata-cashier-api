const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');

const playerSchema = mongoose.Schema(
  {
    playerId: {
      type: mongoose.SchemaTypes.Number,
      // required: true,
    },

    email: {
      type: mongoose.SchemaTypes.String,
      unique: true,
      trim: true,
      lowercase: true,
    },

    username: {
      type: mongoose.SchemaTypes.String,
      // required: true,
      // unique: true,
      trim: true,
    },

    password: {
      type: String,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
    },

    wallet: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
    },

    type: {
      type: mongoose.SchemaTypes.String,
      enum: ['regular', 'mobile'],
      default: 'regular',
    },

    status: {
      type: mongoose.SchemaTypes.String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },

    playLevel: {
      type: mongoose.SchemaTypes.Number,
      default: 20,
    },

    deviceId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'GameDevice',
    },

    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },

    agentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },

    superAgentId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
    },
    bonus: {
      type: mongoose.SchemaTypes.Number,
      default: 0,
    },
    freebet: {
      type: mongoose.SchemaTypes.Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
playerSchema.plugin(toJSON);
playerSchema.plugin(paginate);

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
playerSchema.methods.isPasswordMatch = async function (password) {
  const player = this;
  return bcrypt.compare(password, player.password);
};

playerSchema.pre('save', async function (next) {
  const player = this;
  if (player.isModified('password')) {
    player.password = await bcrypt.hash(player.password, 8);
  }
  next();
});

// isEmailTaken
playerSchema.statics.isEmailTaken = async function (email, excludePlayerId) {
  const player = await this.findOne({ email, _id: { $ne: excludePlayerId } });
  return !!player;
};

// isUsernameTaken
playerSchema.statics.isUsernameTaken = async function (username, excludePlayerId) {
  const player = await this.findOne({ username, _id: { $ne: excludePlayerId } });
  return !!player;
};

/**
 * @typedef Player
 */
const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
