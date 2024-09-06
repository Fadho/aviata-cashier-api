const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const gameDeviceSchema = mongoose.Schema(
  {
    device: {
      type: mongoose.SchemaTypes.String,
      required: true,
    },

    name: {
      type: mongoose.SchemaTypes.String,
      required: true,
    },

    currency: {
      type: mongoose.SchemaTypes.String,
    },

    registered: {
      type: mongoose.SchemaTypes.Boolean,
      default: false,
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

    token: {
      type: mongoose.SchemaTypes.Number,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
gameDeviceSchema.plugin(toJSON);
gameDeviceSchema.plugin(paginate);

/**
 * @typedef GameDevice
 */
const GameDevice = mongoose.model('GameDevice', gameDeviceSchema);

module.exports = GameDevice;
