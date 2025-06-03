const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // your existing user schema fields
  googleId: String,
  displayName: String,
  firstName: String,
  lastName: String,
  email: String,
  photo: String,

  // Subscription fields
  isSubscribed: {
    type: Boolean,
    default: false,
  },
  subscribedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('User', userSchema);
