const mongoose = require('./mongoose');

const postSchema = new mongoose.Schema({
  authorId: {
    type: String,
    required: true,
  },
  content: {
    type: String,
  },
  title: {
    type: String,
    default: '',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
    default: '',
  },
  mediaId: {
    type: String,
    default: '',
  },
  imageId: {
    type: String,
    default: '',
  },
  mediaType: {
    type: String,
    default: '',
  },
  postType: {
    type: String,
    default: 'standard',
  },
  skillTags: [{
    type: String,
  }],
  likes: [{
    type: String,
  }],
  comments: [{
    id: String,
    authorId: String,
    userId: { type: String },
    text: String,
    imageUrl: String,
    mediaId: String,
    createdAt: { type: Number, default: Date.now },
  }],
  reactions: [{
    userId: String,
    type: { type: String },
  }],
  reposts: [{
    type: { type: String },
  }],
  reports: [{
    type: String,
  }],
  attachment: {
    name: String,
    type: { type: String },
    url: String,
    mediaId: String,
  },
  createdAt: {
    type: Number,
    default: Date.now,
  }
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
