const mongoose = require('mongoose');
const validator = require('validator');
const { toJSON, paginate } = require('./plugins');

const shopSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },

    phone: {
      type: String,
      required: true,
      private: true, // used by the toJSON plugin
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
shopSchema.plugin(toJSON);
shopSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the shop to be excluded
 * @returns {Promise<boolean>}
 */
shopSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * @typedef Shop
 */
const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;
