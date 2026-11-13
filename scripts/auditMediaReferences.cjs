require('dotenv').config();

const mongoose = require('../backend/models/mongoose');
const Post = require('../backend/models/Post');
const User = require('../backend/models/User');
const Conversation = require('../backend/models/Conversation');

const URL_FIELDS = new Set(['url', 'mediaUrl', 'imageUrl', 'photoURL', 'profilePic', 'currentStory']);
const ID_FIELDS = new Set(['mediaId', 'imageId', 'photoMediaId', 'profileMediaId', 'currentStoryMediaId']);

const isLocalReference = (value) => {
  const normalized = value.toLowerCase();
  return normalized.includes('localhost') || normalized.includes('127.0.0.1') ||
    normalized.includes('file://') || normalized.includes('/uploads/') || /^[a-z]:[/\\]/i.test(value);
};

const audit = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('Set MONGODB_URI or MONGO_URI before running this read-only audit.');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000, family: 4 });

  const documents = [
    ...(await Post.find({}).lean()),
    ...(await User.find({}).lean()),
    ...(await Conversation.find({}).lean()),
  ];
  const counts = {
    documents: documents.length,
    localOrFilesystemReferences: 0,
    apiMediaUrlReferences: 0,
    embeddedImageOrVideoReferences: 0,
    embeddedSvgReferences: 0,
    embeddedDataFields: {},
    explicitMediaIdReferences: 0,
  };

  const visit = (value, key = '') => {
    if (typeof value === 'string') {
      if (URL_FIELDS.has(key)) {
        if (isLocalReference(value)) counts.localOrFilesystemReferences += 1;
        if (value.includes('/api/media/')) counts.apiMediaUrlReferences += 1;
        if (/^data:(?:image|video)\//i.test(value)) {
          counts.embeddedImageOrVideoReferences += 1;
          counts.embeddedDataFields[key] = (counts.embeddedDataFields[key] || 0) + 1;
          if (/^data:image\/svg\+xml/i.test(value)) counts.embeddedSvgReferences += 1;
        }
      }
      if (ID_FIELDS.has(key) && value) counts.explicitMediaIdReferences += 1;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    }
  };

  documents.forEach((document) => visit(document));
  console.log(JSON.stringify(counts, null, 2));
};

audit()
  .catch((error) => {
    console.error('Read-only media audit failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
