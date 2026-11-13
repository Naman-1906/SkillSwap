const path = require('path');

const MEDIA_FORMATS = Object.freeze({
  '.jpg': { mimeType: 'image/jpeg', mediaType: 'image' },
  '.jpeg': { mimeType: 'image/jpeg', mediaType: 'image' },
  '.png': { mimeType: 'image/png', mediaType: 'image' },
  '.webp': { mimeType: 'image/webp', mediaType: 'image' },
  '.gif': { mimeType: 'image/gif', mediaType: 'image' },
  '.mp4': { mimeType: 'video/mp4', mediaType: 'video' },
  '.webm': { mimeType: 'video/webm', mediaType: 'video' },
});

const ATTACHMENT_FORMATS = Object.freeze({
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed'],
});

const DEFAULT_IMAGE_SIZE_MB = 25;
const DEFAULT_VIDEO_SIZE_MB = 25;
const MAX_CONFIGURED_SIZE_MB = 100;
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

const configuredSize = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 1 && value <= MAX_CONFIGURED_SIZE_MB
    ? Math.floor(value * 1024 * 1024)
    : fallback * 1024 * 1024;
};

const getMaxImageSizeBytes = () => configuredSize('MAX_IMAGE_SIZE_MB', DEFAULT_IMAGE_SIZE_MB);
const getMaxVideoSizeBytes = () => configuredSize('MAX_VIDEO_SIZE_MB', DEFAULT_VIDEO_SIZE_MB);

const normalizeMimeType = (mimeType) => {
  if (typeof mimeType !== 'string') return '';
  const normalized = mimeType.toLowerCase().split(';', 1)[0].trim();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
};

const normalizeExtension = (originalName) => {
  if (typeof originalName !== 'string' || !originalName) return '';
  return path.extname(path.basename(originalName)).toLowerCase();
};

const makeResult = (valid, details) => ({ valid, ...details });

const validationError = (message, code, mediaType = '') => makeResult(false, { message, code, mediaType });

const validateMedia = async (buffer, originalName, declaredMimeType) => {
  const extension = normalizeExtension(originalName);
  const expectedFormat = MEDIA_FORMATS[extension];
  if (!expectedFormat) {
    return validationError(
      'Unsupported image or video format. Upload JPG, PNG, WEBP, GIF, MP4 or WebM.',
      'UNSUPPORTED_MEDIA_EXTENSION',
    );
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return validationError('The selected file is empty or invalid.', 'INVALID_MEDIA');
  }

  const maxSizeBytes = expectedFormat.mediaType === 'image' ? getMaxImageSizeBytes() : getMaxVideoSizeBytes();
  if (buffer.length > maxSizeBytes) {
    return validationError(
      `File is too large. Maximum allowed size is ${Math.floor(maxSizeBytes / (1024 * 1024))} MB.`,
      'MEDIA_TOO_LARGE',
      expectedFormat.mediaType,
    );
  }

  let detected;
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    detected = await fileTypeFromBuffer(buffer);
  } catch {
    return validationError('The selected file could not be verified.', 'MEDIA_DETECTION_FAILED');
  }

  if (!detected || detected.mime !== expectedFormat.mimeType) {
    return validationError(
      expectedFormat.mediaType === 'image'
        ? 'Unsupported image format. Please upload JPG, PNG, WEBP or GIF.'
        : 'Unsupported video format. Please upload MP4 or WebM.',
      'INVALID_MEDIA_SIGNATURE',
      expectedFormat.mediaType,
    );
  }

  const normalizedMime = normalizeMimeType(declaredMimeType);
  if (!GENERIC_MIME_TYPES.has(normalizedMime) && normalizedMime !== detected.mime) {
    return validationError('The selected file type does not match its contents.', 'MEDIA_MIME_MISMATCH', expectedFormat.mediaType);
  }

  return makeResult(true, {
    mediaType: expectedFormat.mediaType,
    mimeType: detected.mime,
    extension,
    size: buffer.length,
    maxSizeBytes,
  });
};

const validateAttachment = async (buffer, originalName, declaredMimeType) => {
  const extension = normalizeExtension(originalName);
  const normalizedMime = normalizeMimeType(declaredMimeType);
  const expectedMimeTypes = ATTACHMENT_FORMATS[extension];
  if (!expectedMimeTypes || !expectedMimeTypes.includes(normalizedMime)) {
    return validationError('Unsupported attachment format.', 'UNSUPPORTED_ATTACHMENT');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return validationError('The selected file is empty or invalid.', 'INVALID_ATTACHMENT');
  }

  if (extension === '.pdf' || extension === '.zip' || extension === '.rar') {
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const detected = await fileTypeFromBuffer(buffer);
      const acceptedDetectedTypes = extension === '.zip'
        ? new Set(['application/zip'])
        : extension === '.rar'
          ? new Set(['application/vnd.rar'])
          : new Set(['application/pdf']);
      if (!detected || !acceptedDetectedTypes.has(detected.mime)) {
        return validationError('The selected attachment does not match its contents.', 'ATTACHMENT_SIGNATURE_MISMATCH');
      }
    } catch {
      return validationError('The selected attachment could not be verified.', 'ATTACHMENT_DETECTION_FAILED');
    }
  }

  return makeResult(true, { mediaType: 'file', mimeType: normalizedMime, extension, size: buffer.length });
};

const validateUpload = async ({ buffer, originalName, mimeType, allowAttachments = false, allowOtherFiles = false }) => {
  const extension = normalizeExtension(originalName);
  const normalizedMime = normalizeMimeType(mimeType);
  const claimsMedia = Boolean(MEDIA_FORMATS[extension]) || /^(image|video)\//.test(normalizedMime);
  if (claimsMedia) return validateMedia(buffer, originalName, mimeType);
  if (allowAttachments && ATTACHMENT_FORMATS[extension]) {
    return validateAttachment(buffer, originalName, mimeType);
  }
  if (!allowOtherFiles) {
    return validationError('Unsupported image, video or attachment format.', 'UNSUPPORTED_FILE_FORMAT');
  }
  return makeResult(true, {
    mediaType: 'file',
    mimeType: normalizedMime || 'application/octet-stream',
    extension,
    size: Buffer.isBuffer(buffer) ? buffer.length : 0,
  });
};

const isAllowedUploadExtension = (originalName, { allowAttachments = false } = {}) => {
  const extension = normalizeExtension(originalName);
  return Boolean(MEDIA_FORMATS[extension] || (allowAttachments && ATTACHMENT_FORMATS[extension]));
};

const getMaxMediaSizeBytes = () => Math.max(getMaxImageSizeBytes(), getMaxVideoSizeBytes());

module.exports = {
  MEDIA_FORMATS,
  ATTACHMENT_FORMATS,
  getMaxImageSizeBytes,
  getMaxVideoSizeBytes,
  normalizeMimeType,
  normalizeExtension,
  validateMedia,
  validateUpload,
  isAllowedUploadExtension,
  getMaxMediaSizeBytes,
};
