const mongoose = require('./mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    default: '',
  },
  username: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
  },
  password: {
    type: String,
    select: false,
  },
  profilePic: {
    type: String,
    default: '',
  },
  profileMediaId: {
    type: String,
    default: '',
  },
  photoURL: {
    type: String,
    default: '',
  },
  photoMediaId: {
    type: String,
    default: '',
  },
  savedPosts: [{
    type: String,
  }],
  followers: [{
    type: String,
  }],
  following: [{
    type: String,
  }],
  currentStory: {
    type: String,
    default: '',
  },
  currentStoryType: {
    type: String,
    default: '',
  },
  storyTimestamp: {
    type: Number,
    default: 0,
  },
  currentStoryMediaId: {
    type: String,
    default: '',
  },
  skillsToLearn: [{
    type: String,
  }],
  skillsToTeach: [{
    type: String,
  }],
  skills: [{
    type: String,
  }],
  role: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    default: '',
  },
  joinedAt: {
    type: Number,
    default: Date.now,
  },
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.password, salt);
    this.password = undefined;
  }
});

userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
