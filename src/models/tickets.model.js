const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const ticketSchema = mongoose.Schema(
  {
    roundId: {
      type: String,
      required: true,
    },
    cashierId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'User',
      required: true,
    },
    ticketId: {
      type: mongoose.SchemaTypes.String,
      unique: true,
    },
    playerId: {
      type: mongoose.SchemaTypes.String,
      ref: 'Player',
      // required: true,
    },
    betType: {
      type: String,
      lowercase: true,
      enum: ['single', 'multiple'],
      required: true,
    },
    selections: [
      {
        homeTeam: {
          type: String,
        },
        awayTeam: {
          type: String,
        },
        market: {
          type: String,
        },
        selection: {
          type: String,
        },
        odd: {
          type: Number,
          required: true,
        },
        oddsTaken: {
          type: Number,
        },
        betCategory: {
          type: String,
          enum: ['PREMATCH', 'LIVE'],
        },
        stake: {
          type: Number,
          required: true,
        },
        winnings: {
          type: Number,
        },
      },
    ],
    stake: {
      type: Number,
      required: true,
    },
    freebet: {
      type: Boolean,
      default: false,
    },
    winnings: {
      type: Number,
      default: 0,
      required: true,
    },
    jackpotWinnerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'JackpotWinners',
    },
    potentialWinnings: {
      type: Number,
      default: 0,
      required: true,
    },
    deviceId: {
      type: mongoose.SchemaTypes.ObjectId,
      // required: true,
    },
    gameType: {
      type: String,
      // required: true,
    },
    result: {
      type: String,
      enum: ['win', 'loss'],
    },
    roundHasEnded: {
      type: Boolean,
      default: false,
      required: true,
    },
    gameOutcome: {
      type: String,
    },
    payout: {
      type: Boolean,
      default: false,
      required: true,
    },
    payoutDate: {
      type: Date,
    },
    cancelled: {
      type: Boolean,
      default: false,
      required: true,
    },
    // Turbo Soccer Pro (VF Engine) fields
    vfBetId: {
      type: String,
      index: true,
    },
    matchId: {
      type: String,
    },
    leagueName: {
      type: String,
      uppercase: true,
      enum: ['FRANCE', 'GERMANY', 'ITALY', 'LALIGA', 'PREMIER'],
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
ticketSchema.plugin(toJSON);
ticketSchema.plugin(paginate);

/**
 * @typedef Tickets
 */
const Tickets = mongoose.model('Tickets', ticketSchema);

module.exports = Tickets;
