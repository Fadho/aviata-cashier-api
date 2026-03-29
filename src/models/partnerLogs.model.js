const mongoose = require('mongoose');
const User = require('./user.model');

const { Schema } = mongoose;

// Reference to Partner and User models


const partnerLogSchema = new Schema(
  {
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
    },
    superAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activityType: {
      type: String,
      required: true,
      enum: ['LOGIN', 'LOGOUT', 'TRANSACTION', 'UPDATE_SETTINGS', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'OTHER'],
    },
    description: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PartnerLog', partnerLogSchema);
