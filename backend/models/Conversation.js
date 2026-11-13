const mongoose = require('./mongoose');

const attachmentSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  },
  filename: {
    type: String,
    default: '',
  },
  storedName: {
    type: String,
    default: '',
  },
  mimeType: {
    type: String,
    default: '',
  },
  size: {
    type: Number,
    default: 0,
  },
  type: {
    type: String,
    default: 'file',
  },
  url: {
    type: String,
    default: '',
  },
  mediaId: {
    type: String,
    default: '',
  },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  },
  authorId: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Number,
    default: Date.now,
  },
  timestamp: {
    type: Number,
    default: Date.now,
  },
  attachments: [attachmentSchema],
  hiddenFor: [{
    type: String,
  }],
  deletedForEveryone: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Number,
    default: 0,
  },
  deletedBy: {
    type: String,
    default: '',
  },
  forwardedFrom: {
    userId: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Number,
      default: 0,
    },
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  participants: [{
    type: String,
    required: true,
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct',
  },
  group: {
    name: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    creatorId: {
      type: String,
      default: '',
    },
    adminId: {
      type: String,
      default: '',
    },
    invitationTokenHash: {
      type: String,
      default: '',
    },
    invitationCreatedAt: {
      type: Number,
      default: 0,
    },
  },
  messages: [messageSchema],
  clearedAt: [{
    userId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    requestId: {
      type: String,
      default: '',
    },
  }],
  deletedFor: [{
    type: String,
  }],
  updatedAt: {
    type: Number,
    default: 0,
  },
  lastMessage: {
    type: String,
    default: '',
  },
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
