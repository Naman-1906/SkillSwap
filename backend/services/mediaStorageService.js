const { randomUUID } = require('crypto');
const mediaValidationService = require('./mediaValidationService');
const cloudinaryStorageService = require('./cloudinaryStorageService');
const MediaAsset = require('../models/MediaAsset');

const cloudinaryUrlCache = new Map();

const isCloudinaryConfigured = () => cloudinaryStorageService.isConfigured();

const inferResourceTypeFromPublicId = (value = '') => {
  const normalized = String(value || '').toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(normalized)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif|svg|bmp|pdf)$/i.test(normalized)) {
    return /\.(pdf)$/i.test(normalized) ? 'raw' : 'image';
  }
  if (normalized.startsWith('video/') || normalized.includes('/video/')) return 'video';
  if (normalized.startsWith('raw/') || normalized.includes('/raw/')) return 'raw';
  if (normalized.startsWith('image/') || normalized.includes('/image/')) return 'image';
  return 'image';
};

const getCloudinaryPublicIdFromUrl = (url = '') => {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'res.cloudinary.com') return null;
    const match = decodeURIComponent(parsed.pathname).match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;
    const publicId = /\/raw\/upload\//i.test(parsed.pathname)
      ? match[1]
      : match[1].replace(/\.[a-z0-9]+$/i, '');
    return publicId || null;
  } catch {
    return null;
  }
};

const getServerUrl = () => {
  const configuredUrl = (process.env.SERVER_URL || '').trim().replace(/\/$/, '');
  if (configuredUrl) return configuredUrl;
  if (process.env.NODE_ENV === 'production') return '';
  return `http://localhost:${process.env.PORT || 5000}`;
};

const isLegacyFileId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const inferMediaType = (mimeType = '') => {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
};

const buildMediaUrl = (fileId) => {
  if (!fileId) return '';
  const value = String(fileId).trim();
  if (/^https?:\/\//i.test(value)) return value;

  const cloudinaryPublicId = getCloudinaryPublicIdFromUrl(value) || value;
  const legacyFileId = isLegacyFileId(cloudinaryPublicId);
  if (legacyFileId) {
    const mediaPath = `/api/media/${cloudinaryPublicId}`;
    const serverUrl = getServerUrl();
    return serverUrl ? `${serverUrl}${mediaPath}` : mediaPath;
  }
  const cachedUrl = cloudinaryUrlCache.get(cloudinaryPublicId);
  if (cachedUrl) return cachedUrl;
  if (cloudinaryPublicId && isCloudinaryConfigured()) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (cloudName) {
      const resourceType = inferResourceTypeFromPublicId(cloudinaryPublicId);
      return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${cloudinaryPublicId}`;
    }
  }

  const mediaPath = `/api/media/${value}`;
  const serverUrl = getServerUrl();
  return serverUrl ? `${serverUrl}${mediaPath}` : mediaPath;
};

const buildMediaProxyUrl = (fileId) => {
  if (!fileId) return '';
  const mediaPath = `/api/media/${encodeURIComponent(String(fileId).trim())}`;
  const serverUrl = getServerUrl();
  return serverUrl ? `${serverUrl}${mediaPath}` : mediaPath;
};

const extractFileIdFromUrl = (url = '') => {
  if (!url) return null;
  if (typeof url !== 'string') return null;

  const apiMatch = url.match(/\/api\/media\/([^/?]+)/);
  if (apiMatch) return apiMatch[1];

  const cloudinaryPublicId = getCloudinaryPublicIdFromUrl(url);
  if (cloudinaryPublicId) return cloudinaryPublicId;

  return null;
};

const getFileIdFromValue = (value = '') => {
  if (typeof value !== 'string' || !value) return null;
  const trimmed = value.trim();
  const extracted = extractFileIdFromUrl(trimmed);
  if (extracted) return extracted;
  if (isLegacyFileId(trimmed)) return trimmed;
  if (isCloudinaryConfigured() && trimmed.includes('/') && !trimmed.startsWith('data:')) return trimmed;
  return null;
};

const uploadFromBuffer = async ({
  buffer,
  originalName,
  mimeType,
  category = 'general',
  ownerId = '',
  relatedEntityId = '',
  metadata = {},
  allowAttachments = false,
  allowOtherFiles = false,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('A valid file buffer is required');
  }

  const validation = await mediaValidationService.validateUpload({
    buffer,
    originalName,
    mimeType,
    allowAttachments,
    allowOtherFiles,
  });
  if (!validation.valid) {
    const validationError = new Error(validation.message);
    validationError.statusCode = 400;
    validationError.code = validation.code;
    validationError.isMediaValidationError = true;
    throw validationError;
  }

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is required for new media uploads. Configure the backend Cloudinary credentials before uploading.');
  }

  const absoluteMimeType = validation.mimeType || mimeType || 'application/octet-stream';
  const resourceType = validation.mediaType === 'video'
    ? 'video'
    : validation.mediaType === 'image' ? 'image' : 'raw';
  const rawExtension = resourceType === 'raw'
    ? (validation.extension || mediaValidationService.normalizeExtension(originalName))
    : '';
  const folder = process.env.CLOUDINARY_DEFAULT_FOLDER || 'skillswap';
  const publicId = `${folder}/${resourceType}/${category}/${randomUUID()}${rawExtension}`;
  const registeredAsset = await MediaAsset.create({
    fileId: publicId,
    originalName: String(originalName || publicId.split('/').pop()).split(/[\\/]/).pop().slice(0, 255),
    ownerId,
    source: 'cloudinary-upload',
    status: 'active',
    resourceType,
    mimeType: absoluteMimeType,
    size: buffer.length,
    category,
    relatedEntityId,
    migrationSource: metadata.migratedFrom || '',
  });
  let result;
  try {
    result = await cloudinaryStorageService.uploadBuffer({
      buffer,
      originalName: originalName || `media-${Date.now()}`,
      mimeType: absoluteMimeType,
      publicId,
      resourceType,
    });
    const resolvedPublicId = result.publicId || publicId;
    registeredAsset.fileId = resolvedPublicId;
    registeredAsset.secureUrl = result.secureUrl || result.url;
    registeredAsset.resourceType = result.resourceType || resourceType;
    registeredAsset.size = buffer.length;
    await registeredAsset.save();
  } catch (error) {
    console.error('Cloudinary media upload failed.', {
      httpCode: Number(error?.http_code) || undefined,
      code: error?.code || undefined,
    });

    // A provider 4xx response means the upload was rejected before an asset
    // was created. Avoid requiring Cloudinary delete permission to roll back
    // the metadata row that was reserved before the upload.
    let cleanupSucceeded = !result?.publicId && [400, 401, 403, 404].includes(Number(error?.http_code));
    if (!cleanupSucceeded) {
      try {
        await cloudinaryStorageService.deleteAsset({
          publicId: result?.publicId || publicId,
          resourceType: result?.resourceType || resourceType,
        });
        cleanupSucceeded = true;
      } catch {
        console.error('Cloudinary upload metadata save failed and uploaded media cleanup also failed.');
      }
    }
    if (cleanupSucceeded) {
      try {
        await MediaAsset.deleteOne({
          fileId: { $in: [publicId, result?.publicId].filter(Boolean) },
          source: 'cloudinary-upload',
        });
      } catch {
        console.error('Cloudinary upload cleanup succeeded but its MongoDB metadata record could not be removed.');
      }
    }
    throw error;
  }

  const secureUrl = registeredAsset.secureUrl;
  const resolvedPublicId = registeredAsset.fileId;
  cloudinaryUrlCache.set(resolvedPublicId, secureUrl);
  return {
    fileId: resolvedPublicId,
    fileIdString: resolvedPublicId,
    filename: resolvedPublicId.split('/').pop(),
    originalName: originalName || resolvedPublicId.split('/').pop(),
    mimeType: absoluteMimeType,
    size: buffer.length,
    mediaType: validation.mediaType,
    url: secureUrl,
    secureUrl,
    resourceType: result.resourceType || resourceType,
    publicId: resolvedPublicId,
  };
};

const uploadFromRequestFile = async ({
  file,
  category = 'general',
  ownerId = '',
  relatedEntityId = '',
  metadata = {},
  allowAttachments = false,
  allowOtherFiles = false,
}) => {
  if (!file) {
    throw new Error('No file supplied for upload');
  }

  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : null;
  if (!buffer) {
    throw new Error('Uploaded file buffer is unavailable');
  }

  return uploadFromBuffer({
    buffer,
    originalName: file.originalname || file.filename,
    mimeType: file.mimetype || 'application/octet-stream',
    category,
    ownerId,
    relatedEntityId,
    metadata,
    allowAttachments,
    allowOtherFiles,
  });
};

const getFileMetadata = async (fileId) => {
  const resolvedId = getFileIdFromValue(fileId);
  if (!resolvedId) return null;

  const cloudinaryAsset = await MediaAsset.findOne({ fileId: resolvedId }).lean();
  if (cloudinaryAsset?.source === 'cloudinary-upload') {
    cloudinaryUrlCache.set(cloudinaryAsset.fileId, cloudinaryAsset.secureUrl);
    return {
      _id: cloudinaryAsset.fileId,
      filename: cloudinaryAsset.originalName,
      contentType: cloudinaryAsset.mimeType || 'application/octet-stream',
      length: cloudinaryAsset.size || 0,
      secureUrl: cloudinaryAsset.secureUrl,
      resourceType: cloudinaryAsset.resourceType,
      metadata: {
        mimeType: cloudinaryAsset.mimeType || 'application/octet-stream',
        publicId: cloudinaryAsset.fileId,
        resourceType: cloudinaryAsset.resourceType || inferResourceTypeFromPublicId(cloudinaryAsset.fileId),
        ownerId: cloudinaryAsset.ownerId || '',
        category: cloudinaryAsset.category || '',
        source: cloudinaryAsset.source,
      },
    };
  }

  if (isLegacyFileId(resolvedId) || !isCloudinaryConfigured()) return null;
  const cloudinaryUrl = buildMediaUrl(resolvedId);
  if (!cloudinaryUrl || !/^https?:\/\//i.test(cloudinaryUrl)) return null;
  return {
    _id: resolvedId,
    filename: String(resolvedId).split('/').pop(),
    contentType: 'application/octet-stream',
    length: 0,
    secureUrl: cloudinaryUrl,
    resourceType: inferResourceTypeFromPublicId(resolvedId),
    metadata: {
      mimeType: 'application/octet-stream',
      publicId: resolvedId,
      resourceType: inferResourceTypeFromPublicId(resolvedId),
      ownerId: '',
    },
  };
};

const deleteFile = async (fileId) => {
  const resolvedId = getFileIdFromValue(fileId);
  if (!resolvedId || isLegacyFileId(resolvedId)) return false;
  const asset = await MediaAsset.findOne({ fileId: resolvedId, source: 'cloudinary-upload' }).lean();
  const publicId = asset?.fileId || getCloudinaryPublicIdFromUrl(buildMediaUrl(resolvedId)) || resolvedId;
  const resourceType = asset?.resourceType || inferResourceTypeFromPublicId(publicId);
  const deleted = await cloudinaryStorageService.deleteAsset({ publicId, resourceType });
  if (deleted || asset) await MediaAsset.deleteOne({ fileId: resolvedId, source: 'cloudinary-upload' });
  cloudinaryUrlCache.delete(resolvedId);
  return deleted;
};

const replaceMedia = async ({ previousFileId, file, category, ownerId, relatedEntityId, metadata, allowAttachments, allowOtherFiles }) => {
  const uploadedMedia = await uploadFromRequestFile({
    file,
    category,
    ownerId,
    relatedEntityId,
    metadata,
    allowAttachments,
    allowOtherFiles,
  });

  return { ...uploadedMedia, previousFileId: previousFileId || null };
};

const deleteMultipleMedia = async (fileIds = []) => {
  const uniqueIds = [...new Set(fileIds.map(getFileIdFromValue).filter(Boolean))];
  return deleteIfUnreferenced(uniqueIds);
};

const getReferencedIds = (value) => {
  const ids = new Set();
  const visit = (item) => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (['mediaId', 'imageId', 'photoMediaId', 'profileMediaId', 'currentStoryMediaId', 'fileId'].includes(key) && typeof child === 'string' && child) ids.add(child);
      if (['url', 'mediaUrl', 'imageUrl', 'photoURL', 'profilePic', 'currentStory'].includes(key) && typeof child === 'string') {
        const id = extractFileIdFromUrl(child);
        if (id) ids.add(id);
      }
      if (child && typeof child === 'object') visit(child);
    }
  };
  visit(value);
  return ids;
};

const getConversationReferencedIds = (conversation) => {
  const thread = typeof conversation?.toObject === 'function' ? conversation.toObject() : conversation;
  if (!thread || typeof thread !== 'object') return new Set();

  const ids = getReferencedIds({ ...thread, messages: [] });
  const participants = Array.isArray(thread.participants) ? thread.participants : [];
  const deletedFor = Array.isArray(thread.deletedFor) ? thread.deletedFor : [];
  for (const message of thread.messages || []) {
    const timestampValue = message.createdAt ?? message.timestamp;
    const numericTimestamp = Number(timestampValue);
    const timestamp = Number.isFinite(numericTimestamp)
      ? numericTimestamp
      : (Date.parse(timestampValue) || 0);
    const hasKnownTimestamp = timestamp > 0;
    const hiddenFor = Array.isArray(message.hiddenFor) ? message.hiddenFor : [];
    const visibleToSomeone = participants.length === 0 || participants.some((participantId) => {
      const clearedAt = thread.clearedAt?.find((marker) => marker.userId === participantId);
      return !deletedFor.includes(participantId) &&
        !hiddenFor.includes(participantId) &&
        (!hasKnownTimestamp || timestamp > (Number(clearedAt?.timestamp) || 0));
    });
    if (!visibleToSomeone) continue;
    for (const id of getReferencedIds(message)) ids.add(id);
  }
  return ids;
};

const isFileReferenced = async (fileId) => {
  const id = String(fileId);
  const [Post, User, Conversation, MediaAsset] = await Promise.all([
    Promise.resolve().then(() => require('../models/Post')),
    Promise.resolve().then(() => require('../models/User')),
    Promise.resolve().then(() => require('../models/Conversation')),
    Promise.resolve().then(() => require('../models/MediaAsset')),
  ]);
  const [posts, users, conversations, archivedAssets] = await Promise.all([
    Post.find({}).select('mediaId imageId mediaUrl imageUrl attachment comments'),
    User.find({}).select('photoURL profilePic photoMediaId profileMediaId currentStory currentStoryMediaId'),
    Conversation.find({}).select('messages participants clearedAt deletedFor'),
    MediaAsset.find({ fileId: id, status: 'archived-unreferenced' }).select('fileId'),
  ]);
  return archivedAssets.length > 0 ||
    [...posts, ...users].some((document) => getReferencedIds(document.toObject()).has(id)) ||
    conversations.some((conversation) => getConversationReferencedIds(conversation).has(id));
};

const deleteIfUnreferenced = async (fileIds = []) => {
  let deletedCount = 0;
  for (const fileId of new Set(fileIds.map(getFileIdFromValue).filter(Boolean))) {
    if (!await isFileReferenced(fileId)) deletedCount += Number(await deleteFile(fileId));
  }
  return deletedCount;
};

module.exports = {
  inferMediaType,
  buildMediaUrl,
  buildMediaProxyUrl,
  extractFileIdFromUrl,
  getFileIdFromValue,
  uploadFromBuffer,
  uploadFromRequestFile,
  getFileMetadata,
  deleteFile,
  deleteMultipleMedia,
  isFileReferenced,
  getReferencedIds,
  getConversationReferencedIds,
  deleteIfUnreferenced,
  replaceMedia,
  isCloudinaryConfigured,
};
