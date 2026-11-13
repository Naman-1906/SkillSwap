const mongoose = require('./mongoose');

const authSessionSchema = new mongoose.Schema({
  sid: {
    type: String,
    required: true,
    unique: true,
  },
  uid: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('AuthSession', authSessionSchema);
