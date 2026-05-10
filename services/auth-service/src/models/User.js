const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    hashedPassword: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'AGENT', 'ADMIN'],
      default: 'CUSTOMER',
    },
    // Stores the current valid refresh token — nulled on logout.
    // On each refresh, the old token is replaced (rotation).
    refreshToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('User', userSchema);
