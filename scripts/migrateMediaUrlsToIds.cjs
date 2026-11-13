require('dotenv').config();

const mongoose = require('../backend/models/mongoose');
const Post = require('../backend/models/Post');
const User = require('../backend/models/User');
const Conversation = require('../backend/models/Conversation');
const mediaStorageService = require('../backend/services/mediaStorageService');

const applyChanges = process.argv.includes('--apply');
const mediaIdFrom = (...values) => {
  for (const value of values) {
    const id = mediaStorageService.getFileIdFromValue(value || '');
    if (id) return id;
  }
  return '';
};
const hasUnresolvableLocalUrl = (value) => {
  if (typeof value !== 'string' || !value) return false;
  const normalized = value.toLowerCase();
  const isLocal = normalized.includes('localhost') || normalized.includes('127.0.0.1') ||
    normalized.includes('file://') || normalized.includes('/uploads/') || /^[a-z]:[/\\]/i.test(value);
  return isLocal && !mediaStorageService.getFileIdFromValue(value);
};

const migrate = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('Set MONGODB_URI or MONGO_URI before running this migration.');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000, family: 4 });

  const [posts, users, conversations] = await Promise.all([
    Post.find(), User.find(), Conversation.find(),
  ]);
  const changes = [];
  const referencedIds = new Set();
  let unresolvableLocalReferences = 0;
  let unsupportedEmbeddedMediaReferences = 0;
  let convertedUrls = 0;

  const noteReference = (value, id) => {
    if (typeof value === 'string' && value.includes('/api/media/') && id) {
      referencedIds.add(id);
      convertedUrls += 1;
    } else if (hasUnresolvableLocalUrl(value)) {
      unresolvableLocalReferences += 1;
    }
  };

  for (const post of posts) {
    const mediaId = mediaIdFrom(post.mediaId, post.imageId, post.mediaUrl, post.imageUrl);
    noteReference(post.mediaUrl, mediaId);
    noteReference(post.imageUrl, mediaId);
    let changed = false;
    if (mediaId && (post.mediaId !== mediaId || post.imageId !== mediaId || post.mediaUrl || post.imageUrl)) {
      post.mediaId = mediaId;
      post.imageId = mediaId;
      post.mediaUrl = '';
      post.imageUrl = '';
      changed = true;
    }
    if (post.attachment) {
      const attachmentId = mediaIdFrom(post.attachment.mediaId, post.attachment.url);
      noteReference(post.attachment.url, attachmentId);
      if (attachmentId && (post.attachment.mediaId !== attachmentId || post.attachment.url)) {
        post.attachment.mediaId = attachmentId;
        post.attachment.url = '';
        changed = true;
      }
    }
    for (const comment of post.comments || []) {
      const commentId = mediaIdFrom(comment.mediaId, comment.imageUrl);
      noteReference(comment.imageUrl, commentId);
      if (commentId && (comment.mediaId !== commentId || comment.imageUrl)) {
        comment.mediaId = commentId;
        comment.imageUrl = '';
        changed = true;
      }
    }
    if (changed) changes.push({ kind: 'post', document: post });
  }

  for (const user of users) {
    let changed = false;
    const profileId = mediaIdFrom(user.photoMediaId, user.profileMediaId, user.photoURL, user.profilePic);
    noteReference(user.photoURL, profileId);
    noteReference(user.profilePic, profileId);
    if (profileId && (user.photoMediaId !== profileId || user.profileMediaId !== profileId || user.photoURL || user.profilePic)) {
      user.photoMediaId = profileId;
      user.profileMediaId = profileId;
      user.photoURL = '';
      user.profilePic = '';
      changed = true;
    } else if (!profileId && [user.photoURL, user.profilePic].some((value) => typeof value === 'string' && value.startsWith('data:'))) {
      const svgInitialsOnly = [user.photoURL, user.profilePic].filter(Boolean)
        .every((value) => /^data:image\/svg\+xml/i.test(value));
      if (!svgInitialsOnly) {
        unsupportedEmbeddedMediaReferences += [user.photoURL, user.profilePic]
          .filter((value) => typeof value === 'string' && value.startsWith('data:')).length;
      } else {
        user.photoURL = '';
        user.profilePic = '';
        changed = true;
      }
    }
    const storyId = mediaIdFrom(user.currentStoryMediaId, user.currentStory);
    noteReference(user.currentStory, storyId);
    if (storyId && (user.currentStoryMediaId !== storyId || user.currentStory)) {
      user.currentStoryMediaId = storyId;
      user.currentStory = '';
      changed = true;
    }
    if (changed) changes.push({ kind: 'user', document: user });
  }

  for (const conversation of conversations) {
    let changed = false;
    for (const message of conversation.messages || []) {
      for (const attachment of message.attachments || []) {
        const attachmentId = mediaIdFrom(attachment.mediaId, attachment.url);
        noteReference(attachment.url, attachmentId);
        if (attachmentId && (attachment.mediaId !== attachmentId || attachment.url)) {
          attachment.mediaId = attachmentId;
          attachment.url = '';
          changed = true;
        }
      }
    }
    if (changed) changes.push({ kind: 'conversation', document: conversation });
  }

  let missingGridFsFiles = 0;
  for (const id of referencedIds) {
    if (!await mediaStorageService.getFileMetadata(id)) missingGridFsFiles += 1;
  }

  const report = {
    mode: applyChanges ? 'apply' : 'dry-run',
    documentsScanned: posts.length + users.length + conversations.length,
    documentsToUpdate: changes.length,
    gridFsUrlReferencesToConvert: convertedUrls,
    uniqueGridFsFilesChecked: referencedIds.size,
    missingGridFsFiles,
    unresolvableLocalReferences,
    unsupportedEmbeddedMediaReferences,
  };

  if (missingGridFsFiles || unresolvableLocalReferences || unsupportedEmbeddedMediaReferences) {
    console.log(JSON.stringify(report, null, 2));
    throw new Error('Migration stopped before writes because some references need manual repair.');
  }

  if (applyChanges) {
    for (const { document } of changes) await document.save();
  }
  console.log(JSON.stringify(report, null, 2));
};

migrate()
  .catch((error) => {
    console.error('Media URL migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
