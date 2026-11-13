const mongoose = require('./mongoose');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  confirmationEmailStatus: {
    type: String,
    enum: ['sending', 'sent', 'failed'],
    default: 'sent',
  },
  createdAt: {
    type: Number,
    default: Date.now,
  },
}, { timestamps: true });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
module.exports = Newsletter;
