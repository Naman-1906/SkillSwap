import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('../backend/config/env').loadRootEnv();
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const { Readable } = require('stream');
const connectDB = require('../backend/config/db');
const Post = require('../backend/models/Post');
const User = require('../backend/models/User');
const Conversation = require('../backend/models/Conversation');
const MediaAsset = require('../backend/models/MediaAsset');
const mediaStorageService = require('../backend/services/mediaStorageService');

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(scriptDirectory, '../uploads');
const getOwnerId = (document, kind, filename) => {
  if (kind === 'user') return document.uid || '';
  if (kind === 'post') return document.authorId || '';
  const message = (document.messages || []).find((entry) =>
    JSON.stringify(entry).includes(`/uploads/${filename}`));
  return message?.authorId || '';
};
const replaceLocalUrl = (value, filename, url) => typeof value === 'string'
  ? value.replaceAll(`/uploads/${filename}`, url)
  : value;
const transform = (value, filename, url) => {
  if (Array.isArray(value)) return value.map((item) => transform(item, filename, url));
  if (!value || typeof value !== 'object') return replaceLocalUrl(value, filename, url);
  if (value instanceof Date || Buffer.isBuffer(value) || value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, transform(child, filename, url)]));
};
const hash = (stream) => new Promise((resolve, reject) => {
  const digest = crypto.createHash('sha256');
  stream.on('data', (chunk) => digest.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(digest.digest('hex')));
});
const hashCloudinaryUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error('Cloudinary media verification failed; the local file was retained.');
  }
  return hash(Readable.fromWeb(response.body));
};
const containsLocalReference = (value, filename) => {
  if (typeof value === 'string') return value.includes(`/uploads/${filename}`);
  if (Array.isArray(value)) return value.some((item) => containsLocalReference(item, filename));
  if (value && typeof value === 'object') return Object.values(value).some((item) => containsLocalReference(item, filename));
  return false;
};

const embeddedMedia = new Map();
const embeddedMimeExtensions = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogg', 'video/quicktime': 'mov',
};
async function replaceEmbeddedMedia(value, ownerId) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => replaceEmbeddedMedia(item, ownerId)));
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string') return value;
    const match = value.match(/^data:(image\/(?:jpeg|png|gif|webp)|video\/(?:mp4|webm|ogg|quicktime));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return value;
    if (embeddedMedia.has(value)) return embeddedMedia.get(value);
    const mimeType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `embedded-media.${embeddedMimeExtensions[mimeType]}`;
    const uploaded = await mediaStorageService.uploadFromBuffer({
      buffer,
      originalName: filename,
      mimeType,
      category: 'migration',
      ownerId,
      metadata: { migratedEmbeddedMedia: true },
    });
    const cloudHash = await hashCloudinaryUrl(uploaded.secureUrl);
    if (cloudHash !== crypto.createHash('sha256').update(buffer).digest('hex')) {
      await mediaStorageService.deleteIfUnreferenced([uploaded.fileIdString]);
      throw new Error('Cloudinary verification failed for embedded media');
    }
    const url = uploaded.secureUrl;
    embeddedMedia.set(value, url);
    return url;
  }
  if (value instanceof Date || Buffer.isBuffer(value) || value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return value;
  const entries = await Promise.all(Object.entries(value).map(async ([key, child]) => [key, await replaceEmbeddedMedia(child, ownerId)]));
  return Object.fromEntries(entries);
}

async function migrateEmbeddedMedia() {
  const [posts, users, conversations] = await Promise.all([Post.find(), User.find(), Conversation.find()]);
  const documents = [
    ...posts.map((doc) => ({ doc, kind: 'post' })),
    ...users.map((doc) => ({ doc, kind: 'user' })),
    ...conversations.map((doc) => ({ doc, kind: 'conversation' })),
  ];
  for (const { doc, kind } of documents) {
    const before = doc.toObject();
    if (!JSON.stringify(before).includes('data:image/') && !JSON.stringify(before).includes('data:video/')) continue;
    const ownerId = getOwnerId(before, kind, '');
    const after = await replaceEmbeddedMedia(before, ownerId);
    try {
      doc.set(after);
      await doc.save();
      console.log(`Migrated embedded media in ${kind} ${doc._id}`);
    } catch (error) {
      for (const url of embeddedMedia.values()) {
        const id = mediaStorageService.getFileIdFromValue(url);
        if (id) await mediaStorageService.deleteIfUnreferenced([id]).catch(() => {});
      }
      throw error;
    }
  }
}

async function migrateFile(filename) {
  const localPath = path.join(uploadDirectory, filename);
  const [posts, users, conversations] = await Promise.all([Post.find(), User.find(), Conversation.find()]);
  const documents = [
    ...posts.map((doc) => ({ doc, kind: 'post' })),
    ...users.map((doc) => ({ doc, kind: 'user' })),
    ...conversations.map((doc) => ({ doc, kind: 'conversation' })),
  ].filter(({ doc }) => containsLocalReference(doc.toObject(), filename));
  let asset = await MediaAsset.findOne({
    source: 'cloudinary-upload',
    migrationSource: filename,
  });
  if (!asset) {
    const bytes = fs.readFileSync(localPath);
    const ownerId = documents.length
      ? getOwnerId(documents[0].doc.toObject(), documents[0].kind, filename)
      : '';
    const result = await mediaStorageService.uploadFromBuffer({
      buffer: bytes,
      originalName: filename,
      mimeType: require('mime-types').lookup(filename) || 'application/octet-stream',
      category: 'migration',
      ownerId,
      metadata: { migratedFrom: filename },
    });
    asset = await MediaAsset.findOne({ fileId: result.fileIdString });
  }

  const localHash = await hash(fs.createReadStream(localPath));
  const cloudHash = await hashCloudinaryUrl(asset.secureUrl);
  if (localHash !== cloudHash || Number(asset.size) !== fs.statSync(localPath).size) {
    throw new Error(`Cloudinary verification failed for ${filename}; local file was retained.`);
  }

  const replacementUrl = asset.secureUrl;
  for (const { doc, kind } of documents) {
    const migrated = transform(doc.toObject(), filename, replacementUrl);
    const fileId = asset.fileId;
    if (kind === 'post') {
      if (migrated.mediaUrl === replacementUrl) migrated.mediaId = fileId;
      if (migrated.imageUrl === replacementUrl) migrated.imageId = fileId;
      if (migrated.attachment?.url === replacementUrl) migrated.attachment.mediaId = fileId;
      for (const comment of migrated.comments || []) if (comment.imageUrl === replacementUrl) comment.mediaId = fileId;
    } else if (kind === 'user') {
      if (migrated.photoURL === replacementUrl) migrated.photoMediaId = fileId;
      if (migrated.profilePic === replacementUrl) migrated.profileMediaId = fileId;
      if (migrated.currentStory === replacementUrl) migrated.currentStoryMediaId = fileId;
    } else {
      for (const message of migrated.messages || []) {
        for (const attachment of message.attachments || []) {
          if (attachment.url === replacementUrl) attachment.mediaId = fileId;
        }
      }
    }
    doc.set(migrated);
    await doc.save();
  }
  if (documents.length === 0) {
    await MediaAsset.updateOne(
      { fileId: asset.fileId },
      { $set: {
        originalName: filename,
        source: 'cloudinary-upload',
        status: 'archived-unreferenced',
        secureUrl: asset.secureUrl,
        resourceType: asset.resourceType,
        mimeType: asset.mimeType,
        size: asset.size,
        migrationSource: filename,
        migratedAt: new Date(),
      } },
      { upsert: true },
    );
  }
  if (documents.length) {
    await MediaAsset.updateOne({ fileId: asset.fileId }, { $set: { status: 'references-migrated' } });
  }

  const [remainingPosts, remainingUsers, remainingConversations] = await Promise.all([
    Post.find(), User.find(), Conversation.find(),
  ]);
  const remainsReferenced = [...remainingPosts, ...remainingUsers, ...remainingConversations]
    .some((doc) => containsLocalReference(doc.toObject(), filename));
  const verifiedFile = await mediaStorageService.getFileMetadata(asset.fileId);
  const archiveRecord = documents.length === 0
    ? await MediaAsset.exists({ fileId: asset.fileId, status: 'archived-unreferenced' })
    : true;
  if (remainsReferenced || !archiveRecord || !verifiedFile || Number(verifiedFile.length) !== fs.statSync(localPath).size) {
    throw new Error(`Reference verification failed for ${filename}; local file was retained.`);
  }

  fs.unlinkSync(localPath);
  console.log(`${documents.length ? 'Migrated and verified' : 'Archived and verified'} ${filename} -> Cloudinary ${asset.fileId}`);
}

async function backfillMediaIds() {
  const backfill = async (document, type) => {
    let changed = false;
    const resolveExistingId = async (value) => {
      const id = mediaStorageService.getFileIdFromValue(value);
      return id && await mediaStorageService.getFileMetadata(id) ? id : '';
    };
    if (type === 'post') {
      for (const [urlKey, idKey] of [['mediaUrl', 'mediaId'], ['imageUrl', 'imageId']]) {
        const id = await resolveExistingId(document[urlKey]);
        if (id && document[idKey] !== id) { document[idKey] = id; changed = true; }
      }
      if (document.attachment?.url) {
        const id = await resolveExistingId(document.attachment.url);
        if (id && document.attachment.mediaId !== id) { document.attachment.mediaId = id; changed = true; }
      }
      for (const comment of document.comments || []) {
        const id = await resolveExistingId(comment.imageUrl);
        if (id && comment.mediaId !== id) { comment.mediaId = id; changed = true; }
      }
    } else if (type === 'user') {
      for (const [urlKey, idKey] of [['photoURL', 'photoMediaId'], ['profilePic', 'profileMediaId'], ['currentStory', 'currentStoryMediaId']]) {
        const id = await resolveExistingId(document[urlKey]);
        if (id && document[idKey] !== id) { document[idKey] = id; changed = true; }
      }
    } else {
      for (const message of document.messages || []) {
        for (const attachment of message.attachments || []) {
          const id = await resolveExistingId(attachment.url);
          if (id && attachment.mediaId !== id) { attachment.mediaId = id; changed = true; }
        }
      }
    }
    if (changed) { await document.save(); console.log(`Backfilled media IDs in ${type} ${document._id}`); }
  };
  const [posts, users, conversations] = await Promise.all([Post.find(), User.find(), Conversation.find()]);
  for (const post of posts) await backfill(post, 'post');
  for (const user of users) await backfill(user, 'user');
  for (const conversation of conversations) await backfill(conversation, 'conversation');
}

(async () => {
  await connectDB();
  const entries = fs.existsSync(uploadDirectory) ? fs.readdirSync(uploadDirectory, { withFileTypes: true }) : [];
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  for (const filename of files) {
    try { await migrateFile(filename); }
    catch {
      const existing = await MediaAsset.findOne({ source: 'cloudinary-upload', migrationSource: filename });
      if (existing) {
        try {
          await mediaStorageService.deleteIfUnreferenced([existing.fileId]);
        } catch {
          console.error(`Cloudinary cleanup failed for ${filename}; keep the local file and investigate the asset.`);
        }
      }
      console.error(`Migration failed for ${filename}; local file was retained.`);
    }
  }
  await migrateEmbeddedMedia();
  await backfillMediaIds();
  await require('../backend/models/mongoose').disconnect();
})();
