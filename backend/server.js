const path = require('path');
const express = require('express');
const http = require('http');
const net = require('net');
const multer = require('multer');
const crypto = require('crypto');
const { Readable } = require('stream');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { handleRegisterValidation, handleMessageValidation } = require('./middleware/socketValidation');

require('./config/env').loadRootEnv();

const mongoose = require('mongoose');
const Post = require('./models/Post');
const User = require('./models/User');
const AuthSession = require('./models/AuthSession');
const Conversation = require('./models/Conversation');
const { canDeleteMessageForEveryone } = require('./services/chatPermissions');
const Newsletter = require('./models/Newsletter');
const nodemailer = require('nodemailer');
const MediaAsset = require('./models/MediaAsset');
const mediaStorageService = require('./services/mediaStorageService');

const mediaValidationService = require('./services/mediaValidationService');
const cloudinaryStorageService = require('./services/cloudinaryStorageService');
const classifyMediaDeleteAccess = require('./services/mediaDeleteAuthorization');
const { getJwtSecret } = require('./services/authConfig');

let JWT_SECRET;
try {
  JWT_SECRET = getJwtSecret();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (cloudinaryStorageService.isConfigured()) {
  cloudinaryStorageService.getCloudinaryConfig();
  console.log('Cloudinary media storage is configured for production uploads.');
  console.log('Cloudinary config source:', process.env.CLOUDINARY_ENV_SOURCE || 'runtime');
  console.log('Cloudinary cloud name:', process.env.CLOUDINARY_CLOUD_NAME ? 'PRESENT' : 'MISSING');
  console.log('Cloudinary API key:', process.env.CLOUDINARY_API_KEY ? 'PRESENT' : 'MISSING');
  console.log('Cloudinary API secret:', process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'MISSING');
} else if (process.env.NODE_ENV === 'production') {
  console.error('Cloudinary credentials must be configured in production.');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MongoDB connection is not configured. Set MONGODB_URI in the backend environment.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.SERVER_URL) {
  console.error('SERVER_URL must be set in production so media links point to the deployed backend.');
  process.exit(1);
}
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
if (process.env.NODE_ENV === 'production' &&
    (!isHttpsUrl(process.env.SERVER_URL) ||
      [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || '').split(',')]
        .filter(Boolean)
        .some((origin) => !isHttpsUrl(origin.trim())))) {
  console.error('SERVER_URL and configured client origins must use HTTPS in production.');
  process.exit(1);
}
const MASKED_URI = MONGO_URI.replace(/:([^@]+)@/, ':****@');
console.log(`Attempting to connect to MongoDB: ${MASKED_URI}`);
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Waiting for auto-reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully.');
});

// Database connection established inside startServer()

const app = express();
const server = http.createServer(app);
const mediaUploadLimitBytes = mediaValidationService.getMaxMediaSizeBytes();
const isSupportedUpload = (file, { allowAttachments = false, allowArchives = false } = {}) => {
  const extension = mediaValidationService.normalizeExtension(file?.originalname);
  if (mediaValidationService.isAllowedUploadExtension(file?.originalname)) return true;
  if (!allowAttachments) return false;
  const attachmentMimeTypes = mediaValidationService.ATTACHMENT_FORMATS[extension];
  if (!attachmentMimeTypes || (!allowArchives && ['.zip', '.rar'].includes(extension))) return false;
  return attachmentMimeTypes.includes(mediaValidationService.normalizeMimeType(file?.mimetype));
};
const configuredOrigins = [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || '').split(',')]
  .filter(Boolean)
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  console.error('CLIENT_URL must be set in production so the hosted frontend can access the backend.');
  process.exit(1);
}
const localDevOrigins = (process.env.CLUSTR_DEV_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin));
const allowedOrigins = new Set([
  ...(process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:3000',
  ...localDevOrigins,
  ]),
  ...configuredOrigins,
]);
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.AUTH_COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')).toLowerCase(),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};
const sessionLifetimeMs = cookieOptions.maxAge;

if (!['strict', 'lax', 'none'].includes(cookieOptions.sameSite)) {
  throw new Error('AUTH_COOKIE_SAME_SITE must be strict, lax, or none.');
}
if (cookieOptions.sameSite === 'none' && !cookieOptions.secure) {
  throw new Error('AUTH_COOKIE_SAME_SITE=none requires NODE_ENV=production so the cookie is Secure.');
}

const postMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: mediaUploadLimitBytes,
  },
  fileFilter: (_req, file, callback) => {
    if (isSupportedUpload(file, { allowAttachments: true, allowArchives: true })) {
      callback(null, true);
      return;
    }

    callback(new Error('Unsupported image or video format. Upload JPG, PNG, WEBP, GIF, MP4 or WebM.'));
  },
});

const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, callback) => {
    if (isSupportedUpload(file, { allowAttachments: true })) {
      callback(null, true);
      return;
    }

    callback(new Error('Unsupported attachment format.'));
  },
});

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Friendly handler for malformed JSON requests (body-parser SyntaxError)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('Malformed JSON in request:', err.message);
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  return next(err);
});
app.use(cookieParser());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/api/debug/cloudinary-status', protect, async (_req, res) => {
  try {
    const result = await cloudinaryStorageService.verifyConnection();
    res.json({ success: true, ...result });
  } catch {
    res.status(500).json({ success: false, message: 'Cloudinary diagnostic failed.' });
  }
});

app.post('/api/chat/upload', protect, (req, res) => {
  chatAttachmentUpload.array('files', 6)(req, res, (error) => {
    if (error) {
      const isSizeError = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      const maxSizeMB = 10;
      return res.status(400).json({
        success: false,
        message: isSizeError ? `File is too large. Maximum allowed size is ${maxSizeMB} MB.` : error.message,
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    (async () => {
      const uploadedIds = [];
      try {
        const attachments = [];
        for (const file of req.files) {
          const uploaded = await mediaStorageService.uploadFromRequestFile({ file, category: 'pending', ownerId: req.user.uid, allowAttachments: true });
          uploadedIds.push(uploaded.fileIdString);
          attachments.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filename: file.originalname,
            storedName: uploaded.filename,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            type: uploaded.mediaType,
            url: mediaStorageService.buildMediaProxyUrl(uploaded.fileId),
            mediaId: uploaded.fileIdString,
          });
        }
        res.status(201).json({ success: true, attachments });
      } catch (uploadError) {
        await cleanupUnreferencedMedia(uploadedIds);
        const message = uploadError?.isMediaValidationError || uploadError?.statusCode
          ? uploadError.message
          : 'Could not complete the Cloudinary upload.';
        res.status(uploadError?.statusCode || 500).json({
          success: false,
          message,
        });
      }
    })();
  });
});

let newsletterTransporter;
const getNewsletterTransporter = () => {
  if (newsletterTransporter) return newsletterTransporter;

  const SMTP_HOST = process.env.SMTP_HOST?.trim();
  const SMTP_USER = process.env.SMTP_USER?.trim();
  const SMTP_PASS = process.env.SMTP_PASS?.trim();
  const SMTP_FROM = process.env.SMTP_FROM?.trim();
  const SMTP_PORT = Number(process.env.SMTP_PORT?.trim());
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM ||
      !Number.isInteger(SMTP_PORT) || SMTP_PORT !== 587) {
    throw new Error('Newsletter SMTP is not configured correctly.');
  }

  newsletterTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return newsletterTransporter;
};

const sendNewsletterConfirmation = async (email) => {
  const transporter = getNewsletterTransporter();
  await transporter.verify();
  console.info('Newsletter SMTP connection verified.');

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM.trim(),
    to: email,
    subject: 'Welcome to the SkillSwap newsletter',
    text: 'Thanks for subscribing to the SkillSwap newsletter. We look forward to sharing learning tips and updates with you.',
  });

  const acceptedRecipients = Array.isArray(info.accepted)
    ? info.accepted.map((recipient) => typeof recipient === 'string' ? recipient : recipient?.address).filter(Boolean)
    : [];
  const rejectedRecipients = Array.isArray(info.rejected) ? info.rejected : [];
  const recipientAccepted = acceptedRecipients.some(
    (recipient) => recipient.toLowerCase() === email.toLowerCase(),
  );

  console.info('Newsletter SMTP delivery result:', {
    messageId: info.messageId || null,
    response: info.response || null,
    recipientAccepted,
    acceptedRecipientCount: acceptedRecipients.length,
    rejectedRecipientCount: rejectedRecipients.length,
  });

  if (!recipientAccepted) {
    const error = new Error('SMTP did not accept the newsletter recipient.');
    error.code = 'EENVELOPE';
    error.response = info.response;
    throw error;
  }
};

const getNewsletterEmailErrorMessage = (error) => {
  if (error?.code === 'EAUTH' || error?.responseCode === 535) {
    return 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS; Gmail requires a valid App Password.';
  }
  if (['EDNS', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error?.code)) {
    return 'Could not connect to Gmail SMTP. Check SMTP_HOST, SMTP_PORT, and the server network connection.';
  }
  return 'Your subscription was saved, but we could not send the confirmation email. Please try again later.';
};

const getNewsletterSmtpDiagnostics = () => {
  const username = process.env.SMTP_USER?.trim() || '';
  const atIndex = username.lastIndexOf('@');
  const maskedUsername = atIndex > 0
    ? `${username[0]}***${username.slice(atIndex)}`
    : username ? `${username[0]}***` : '(missing)';

  return {
    host: process.env.SMTP_HOST?.trim() || '(missing)',
    port: process.env.SMTP_PORT?.trim() || '(missing)',
    username: maskedUsername,
    passwordPresent: Boolean(process.env.SMTP_PASS?.trim()),
  };
};

app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    let subscription = await Newsletter.findOne({ email });
    let isNewSubscription = false;
    if (!subscription) {
      try {
        subscription = await Newsletter.create({
          email,
          confirmationEmailStatus: 'sending',
        });
        isNewSubscription = true;
      } catch (error) {
        if (error?.code !== 11000) throw error;
        subscription = await Newsletter.findOne({ email });
      }
    }

    if (!subscription) {
      throw new Error('Newsletter subscription could not be loaded.');
    }

    if (subscription.confirmationEmailStatus === 'sent') {
      return res.status(200).json({
        success: true,
        message: 'Already subscribed. No additional confirmation email was sent.',
      });
    }

    if (subscription.confirmationEmailStatus === 'sending' && !isNewSubscription) {
      return res.status(409).json({
        success: false,
        message: 'Your subscription is already being processed. Please try again shortly.',
      });
    }

    if (subscription.confirmationEmailStatus === 'failed') {
      subscription = await Newsletter.findOneAndUpdate(
        { _id: subscription._id, confirmationEmailStatus: 'failed' },
        { $set: { confirmationEmailStatus: 'sending' } },
        { new: true },
      );

      if (!subscription) {
        return res.status(409).json({
          success: false,
          message: 'Your subscription is already being processed. Please try again shortly.',
        });
      }
    } else if (!isNewSubscription) {
      return res.status(409).json({
        success: false,
        message: 'Your subscription is already being processed. Please try again shortly.',
      });
    }

    try {
      await sendNewsletterConfirmation(email);
    } catch (error) {
      console.error('Newsletter confirmation email failed.', {
        smtp: getNewsletterSmtpDiagnostics(),
        code: error?.code || 'SMTP_ERROR',
        responseCode: error?.responseCode,
        response: typeof error?.response === 'string' ? error.response.slice(0, 500) : undefined,
      });
      try {
        await Newsletter.updateOne(
          { _id: subscription._id, confirmationEmailStatus: 'sending' },
          { $set: { confirmationEmailStatus: 'failed' } },
        );
      } catch (statusError) {
        console.error('Could not update newsletter email status:', statusError?.message || 'Unknown error');
      }
      return res.status(503).json({
        success: false,
        message: getNewsletterEmailErrorMessage(error),
      });
    }

    try {
      await Newsletter.updateOne(
        { _id: subscription._id, confirmationEmailStatus: 'sending' },
        { $set: { confirmationEmailStatus: 'sent' } },
      );
    } catch (error) {
      console.error('Could not update newsletter email status:', error?.message || 'Unknown error');
      return res.status(503).json({
        success: false,
        message: 'Your subscription was saved, but we could not confirm the email status. Please check your inbox before trying again.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Successfully subscribed. A confirmation email has been sent.',
    });
  } catch (error) {
    console.error('Newsletter subscribe failed:', error?.message || 'Unknown error');
    return res.status(500).json({ success: false, message: 'Could not subscribe right now.' });
  }
});

const buildPublicMediaUrl = (value) => {
  const mediaId = resolveMediaId(value);
  return mediaId ? mediaStorageService.buildMediaUrl(mediaId) : '';
};

const buildInitialAvatar = (displayName) => {
  const initials = displayName.trim().split(/\s+/).slice(0, 2)
    .map((part) => part[0] || '').join('').replace(/[^a-z\d]/gi, '').toUpperCase() || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#dbeafe"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#1d4ed8">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const toPublicUser = (user) => {
  const obj = user.toObject ? user.toObject() : user;
  const displayName = obj.displayName || obj.name || obj.email?.split('@')[0] || 'Member';
  const profileMediaId = resolveMediaId(obj.photoMediaId || obj.profileMediaId || obj.photoURL || obj.profilePic) || '';
  const currentStoryMediaId = resolveMediaId(obj.currentStoryMediaId || obj.currentStory) || '';
  const storedProfileUrl = obj.photoURL || obj.profilePic || '';
  const hasSafeExternalProfileUrl = /^https?:\/\//i.test(storedProfileUrl) &&
    !/(?:localhost|127\.0\.0\.1|\/uploads\/)/i.test(storedProfileUrl);
  const profileMediaUrl = (hasSafeExternalProfileUrl ? storedProfileUrl : '') ||
    buildPublicMediaUrl(profileMediaId) || buildInitialAvatar(displayName);
  const storedStoryUrl = obj.currentStory || '';
  const storyUrl = /^https?:\/\//i.test(storedStoryUrl) &&
    !/(?:localhost|127\.0\.0\.1|\/uploads\/)/i.test(storedStoryUrl)
    ? storedStoryUrl
    : buildPublicMediaUrl(currentStoryMediaId);
  return {
    id: obj.uid,
    uid: obj.uid,
    name: obj.name || displayName,
    displayName,
    email: obj.email || '',
    username: obj.username || `@${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || obj.uid.slice(0, 4)}`,
    photoURL: profileMediaUrl,
    profilePic: profileMediaUrl,
    photoMediaId: profileMediaId,
    profileMediaId,
    skills: obj.skills || obj.skillsToTeach || [],
    savedPosts: obj.savedPosts || [],
    followers: obj.followers || [],
    following: obj.following || [],
    role: obj.role || '',
    bio: obj.bio || '',
    currentStory: storyUrl,
    currentStoryMediaId,
    currentStoryType: obj.currentStoryType || '',
    storyTimestamp: obj.storyTimestamp || 0,
    joinedAt: obj.joinedAt || (obj.createdAt ? new Date(obj.createdAt).getTime() : Date.now()),
  };
};

const toPublicPost = (post, assetsById = new Map()) => {
  const obj = post.toObject ? post.toObject() : post;
  const mediaId = resolveMediaId(obj.mediaId || obj.imageId || obj.mediaUrl || obj.imageUrl) || '';
  const storedMediaUrl = obj.mediaUrl || obj.imageUrl || '';
  const mediaAsset = assetsById.get(mediaId);
  const mediaUrl = /^https?:\/\//i.test(storedMediaUrl) && storedMediaUrl.includes('res.cloudinary.com')
    ? storedMediaUrl
    : mediaAsset?.secureUrl || buildPublicMediaUrl(mediaId);
  const attachmentId = resolveMediaId(obj.attachment?.mediaId || obj.attachment?.url) || '';
  const storedAttachmentUrl = obj.attachment?.url || '';
  const attachmentAsset = assetsById.get(attachmentId);
  return {
    ...obj,
    skills: obj.skills || obj.skillTags || [],
    id: obj.id || obj._id?.toString(),
    mediaId,
    imageId: mediaId,
    mediaUrl,
    imageUrl: mediaUrl,
    mediaType: mediaAsset?.resourceType === 'video'
      ? 'video'
      : mediaAsset?.resourceType === 'image' ? 'image' : obj.mediaType || '',
    mediaResourceType: mediaAsset?.resourceType || '',
    attachment: obj.attachment ? {
      ...obj.attachment,
      mediaId: attachmentId,
      url: /^https?:\/\//i.test(storedAttachmentUrl) && storedAttachmentUrl.includes('res.cloudinary.com')
        ? storedAttachmentUrl
        : attachmentAsset?.secureUrl || buildPublicMediaUrl(attachmentId),
    } : obj.attachment,
    comments: (obj.comments || []).map((comment) => {
      const commentMediaId = resolveMediaId(comment.mediaId || comment.imageUrl) || '';
      const storedCommentUrl = comment.imageUrl || '';
      const commentAsset = assetsById.get(commentMediaId);
      return {
        ...comment,
        mediaId: commentMediaId,
        imageUrl: /^https?:\/\//i.test(storedCommentUrl) && storedCommentUrl.includes('res.cloudinary.com')
          ? storedCommentUrl
          : commentAsset?.secureUrl || buildPublicMediaUrl(commentMediaId),
      };
    }),
  };
};

const buildUsernameFromName = (name = '', uid = '') => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
  return `@${base || uid.slice(0, 4) || 'user'}`;
};

const generateToken = async (user) => {
  const sid = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await AuthSession.create({ sid, uid: user.uid, expiresAt });

  return jwt.sign(
    { uid: user.uid, sid, email: user.email, name: user.name || user.displayName },
    JWT_SECRET,
    { expiresIn: Math.floor(sessionLifetimeMs / 1000) }
  );
};

const setAuthCookie = (res, token) => {
  res.cookie('token', token, cookieOptions);
};

const clearAuthCookie = (res) => {
  res.clearCookie('token', cookieOptions);
};

const getRequestToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.slice(7);
  }
  return req.cookies?.token || '';
};

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const cookieHeader = socket.handshake.headers.cookie || '';
  const tokenCookie = cookieHeader.split(';').map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) return '';

  try {
    return decodeURIComponent(tokenCookie.slice('token='.length));
  } catch {
    return '';
  }
};

const authenticateToken = async (token) => {
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }

  if (typeof decoded.uid !== 'string' || !decoded.uid || typeof decoded.sid !== 'string' || !decoded.sid) {
    return null;
  }

  const session = await AuthSession.findOne({
    sid: decoded.sid,
    uid: decoded.uid,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('sid').lean();

  return session ? decoded : null;
};

async function protect(req, res, next) {
  try {
    const decoded = await authenticateToken(getRequestToken(req));
    if (!decoded) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    req.user = decoded;
  } catch (error) {
    return next(error);
  }

  return next();
}

const protectSelf = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.user && req.user.uid === req.params.uid) {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: you can only modify your own account' });
  });
};

const getReferencedMediaIds = (value) => {
  const ids = new Set();
  const visit = (item) => {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (['mediaId', 'imageId', 'photoMediaId', 'profileMediaId', 'currentStoryMediaId'].includes(key) && typeof child === 'string' && child) ids.add(child);
      if (['url', 'mediaUrl', 'imageUrl', 'photoURL', 'profilePic', 'currentStory'].includes(key) && typeof child === 'string') {
        const id = mediaStorageService.extractFileIdFromUrl(child);
        if (id) ids.add(id);
      }
      if (child && typeof child === 'object') visit(child);
    }
  };
  visit(value);
  return ids;
};

const isMediaReferenced = (fileId) => mediaStorageService.isFileReferenced(fileId);

const deleteIfUnreferenced = async (fileIds) => {
  return mediaStorageService.deleteIfUnreferenced(fileIds || []);
};

const cleanupUnreferencedMedia = async (fileIds) => {
  try {
    return await deleteIfUnreferenced(fileIds);
  } catch {
    console.error('Unreferenced media cleanup failed.');
    return 0;
  }
};

const cleanStalePendingMedia = async () => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const cloudinaryAssets = await MediaAsset.find({
    source: 'cloudinary-upload',
    category: 'pending',
    status: 'active',
    createdAt: { $lt: new Date(cutoff) },
  }).select('fileId createdAt');
  for (const asset of cloudinaryAssets) {
    if (!await isMediaReferenced(asset.fileId)) {
      await mediaStorageService.deleteFile(asset.fileId);
    }
  }
};
const pendingMediaCleanupTimer = setInterval(() => {
  cleanStalePendingMedia().catch((error) => console.error('Pending media cleanup failed:', error.message));
}, 30 * 60 * 1000);
pendingMediaCleanupTimer.unref();
cleanStalePendingMedia().catch((error) => console.error('Initial pending media cleanup failed:', error.message));

const resolveMediaId = (value) => mediaStorageService.getFileIdFromValue(value);

const handleSignup = async (req, res) => {
  try {
    const { name = '', email = '', password = '' } = req.body || {};
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim() || trimmedEmail.split('@')[0];

    if (!trimmedEmail || !password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Enter an email and a password with at least 6 characters.' });
    }

    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: 'That email is already in use.' });
    }

    const uid = crypto.randomUUID();
    const user = await User.create({
      uid,
      name: trimmedName,
      displayName: trimmedName,
      email: trimmedEmail,
      password,
      username: buildUsernameFromName(trimmedName, uid),
      photoURL: '',
      savedPosts: [],
      followers: [],
      following: [],
      skills: [],
      joinedAt: Date.now(),
    });

    const token = await generateToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    console.error('Signup failed:', error && error.stack ? error.stack : error);
    if (error?.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) {
      return res.status(400).json({ success: false, message: 'That email is already in use.' });
    }
    res.status(500).json({ success: false, message: error?.message || 'Failed to create account' });
  }
};

const handleLogin = async (req, res) => {
  try {
    const { email = '', password = '' } = req.body || {};
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
    }

    const token = await generateToken(user);
    setAuthCookie(res, token);
    res.json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    console.error('Login failed:', error && error.stack ? error.stack : error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to log in' });
  }
};

app.post('/api/users/register', handleSignup);
app.post('/api/users/login', handleLogin);

app.post('/api/auth/signup', handleSignup);
app.post('/api/auth/login', handleLogin);
app.get('/api/auth/session', protect, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, message: 'Authentication session is no longer valid.' });
    }
    return res.json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});
const logout = async (req, res, next) => {
  try {
    await AuthSession.updateOne(
      { sid: req.user.sid, uid: req.user.uid, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    clearAuthCookie(res);
    const sessionRoom = `session:${req.user.sid}`;
    io.to(sessionRoom).emit('auth:logout');
    io.in(sessionRoom).disconnectSockets(true);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};
app.post('/api/auth/logout', protect, logout);
app.post('/api/users/logout', protect, logout);

app.get('/api/media/:fileId', async (req, res) => {
  try {
    const mediaUrl = mediaStorageService.buildMediaUrl(req.params.fileId);
    const metadata = await mediaStorageService.getFileMetadata(req.params.fileId);
    if (!metadata) return res.status(404).json({ success: false, message: 'Media not found' });
    if (!await isMediaReferenced(req.params.fileId)) return res.status(404).json({ success: false, message: 'Media is no longer available' });
    const isChatMedia = await Conversation.exists({ 'messages.attachments.mediaId': req.params.fileId });
    const cloudinaryUrl = metadata.secureUrl || mediaUrl;
    if (!cloudinaryUrl || !/^https?:\/\//i.test(cloudinaryUrl) || !cloudinaryUrl.includes('res.cloudinary.com')) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }
    if (!isChatMedia) {
      return res.redirect(cloudinaryUrl);
    }
    if (isChatMedia) {
      const viewer = await authenticateToken(getRequestToken(req));
      if (!viewer) {
        clearAuthCookie(res);
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const conversations = await Conversation.find({
        participants: viewer.uid,
        deletedFor: { $ne: viewer.uid },
        'messages.attachments.mediaId': req.params.fileId,
      }).select('messages clearedAt');
      const belongsToChat = conversations.some((conversation) => {
        const clearTime = Number(conversation.clearedAt?.find((marker) => marker.userId === viewer.uid)?.timestamp) || 0;
        return conversation.messages.some((message) => {
          const timestamp = Number(message.createdAt || message.timestamp) || 0;
          return timestamp > clearTime && !(message.hiddenFor || []).includes(viewer.uid) &&
            (message.attachments || []).some((attachment) => attachment.mediaId === req.params.fileId);
        });
      });
      if (!belongsToChat) return res.status(403).json({ success: false, message: 'You cannot access this attachment' });
    }

    if (isChatMedia && metadata.secureUrl) {
      const headers = req.headers.range ? { Range: req.headers.range } : {};
      const cloudResponse = await fetch(metadata.secureUrl, { headers });
      if (!cloudResponse.ok && cloudResponse.status !== 206) {
        return res.status(502).json({ success: false, message: 'Media provider could not serve this attachment' });
      }
      for (const headerName of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const headerValue = cloudResponse.headers.get(headerName);
        if (headerValue) res.setHeader(headerName, headerValue);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(cloudResponse.status);
      if (!cloudResponse.body) return res.end();
      return Readable.fromWeb(cloudResponse.body).pipe(res);
    }
    return res.status(404).json({ success: false, message: 'Media not found' });
  } catch (error) {
    const status = error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? 401 : 400;
    res.status(status).json({ success: false, message: 'Invalid media request' });
  }
});

app.delete('/api/media/:fileId', protect, async (req, res) => {
  try {
    const metadata = await mediaStorageService.getFileMetadata(req.params.fileId);
    const accessError = classifyMediaDeleteAccess(metadata, req.user.uid);
    if (accessError) return res.status(accessError.status).json({ success: false, message: accessError.message });
    if (await isMediaReferenced(req.params.fileId)) return res.status(409).json({ success: false, message: 'Media is still attached to content' });
    await mediaStorageService.deleteFile(req.params.fileId);
    res.json({ success: true });
  } catch {
    console.error('Cloudinary media deletion failed.');
    res.status(500).json({ success: false, message: 'Could not delete media' });
  }
});

app.get('/api/users', protect, async (_req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const expiredBefore = Date.now() - 24 * 60 * 60 * 1000;
    const expiredStories = users.filter((user) => (user.currentStoryMediaId || user.currentStory) && Number(user.storyTimestamp) <= expiredBefore);
    for (const user of expiredStories) {
      const oldStoryId = resolveMediaId(user.currentStoryMediaId || user.currentStory);
      await User.updateOne({ _id: user._id, currentStory: user.currentStory }, { $set: { currentStory: '', currentStoryType: '', currentStoryMediaId: '', storyTimestamp: 0 } });
      if (oldStoryId) await cleanupUnreferencedMedia([oldStoryId]);
      user.currentStory = '';
      user.currentStoryMediaId = '';
      user.currentStoryType = '';
      user.storyTimestamp = 0;
    }
    res.json(users.map(toPublicUser));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

app.patch('/api/users/:uid', protectSelf, async (req, res) => {
  const mediaIdsToRollback = new Set();
  const mediaMetadataById = new Map();
  try {
    const allowed = ['displayName', 'name', 'username', 'photoURL', 'profilePic', 'photoMediaId', 'profileMediaId', 'skills', 'savedPosts', 'followers', 'following', 'role', 'bio', 'currentStory', 'currentStoryType', 'storyTimestamp', 'joinedAt'];
    const updates = {};
    allowed.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        updates[key] = req.body[key];
      }
    });

    for (const key of ['photoURL', 'profilePic', 'currentStory']) {
      if (typeof updates[key] === 'string' && updates[key].startsWith('data:')) {
        return res.status(400).json({ success: false, message: 'Upload media through the MongoDB media endpoint first.' });
      }
      if (typeof updates[key] === 'string' && updates[key] && !resolveMediaId(updates[key])) {
        return res.status(400).json({ success: false, message: 'Uploaded photos and stories must reference a valid supported media URL or Cloudinary asset.' });
      }
      const mediaId = resolveMediaId(updates[key]);
      if (mediaId) {
        const metadata = await mediaStorageService.getFileMetadata(mediaId);
        if (!metadata || String(metadata.metadata?.ownerId) !== req.user.uid) {
          await cleanupUnreferencedMedia([...mediaIdsToRollback]);
          return res.status(403).json({ success: false, message: 'You can only attach media uploaded by your account.' });
        }
        if (key !== 'currentStory' &&
            !(metadata.contentType || metadata.metadata?.mimeType || '').startsWith('image/')) {
          await cleanupUnreferencedMedia([...mediaIdsToRollback]);
          return res.status(400).json({ success: false, message: 'Profile pictures must be image files.' });
        }
        mediaIdsToRollback.add(mediaId);
        mediaMetadataById.set(mediaId, metadata);
      }
      if (typeof updates[key] === 'string' && updates[key].startsWith('/uploads/')) {
        await cleanupUnreferencedMedia([...mediaIdsToRollback]);
        return res.status(400).json({ success: false, message: 'Local media paths are no longer supported.' });
      }
    }
    const existing = await User.findOne({ uid: req.params.uid });
    if (!existing) {
      await cleanupUnreferencedMedia([...mediaIdsToRollback]);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const oldMediaIds = getReferencedMediaIds(existing.toObject());
    if (Object.prototype.hasOwnProperty.call(updates, 'photoURL') || Object.prototype.hasOwnProperty.call(updates, 'profilePic')) {
      const profileValue = updates.photoURL ?? updates.profilePic ?? '';
      const profileId = resolveMediaId(profileValue) || '';
      const profileUrl = mediaMetadataById.get(profileId)?.secureUrl || '';
      updates.photoURL = profileUrl;
      updates.profilePic = profileUrl;
      updates.photoMediaId = profileId;
      updates.profileMediaId = profileId;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'currentStory')) {
      const storyId = resolveMediaId(updates.currentStory) || '';
      updates.currentStoryMediaId = storyId;
      updates.currentStory = mediaMetadataById.get(storyId)?.secureUrl || '';
    }
    const relatedAssets = new Map([
      [updates.photoMediaId, 'profile'],
      [updates.currentStoryMediaId, 'story'],
    ].filter(([mediaId]) => mediaId));
    for (const [mediaId, category] of relatedAssets) {
      await MediaAsset.updateOne(
        { fileId: mediaId, ownerId: req.user.uid },
        { $set: { category, relatedEntityId: req.params.uid } },
      );
    }
    const user = await User.findOneAndUpdate({ uid: req.params.uid }, updates, { returnDocument: 'after' });
    if (!user) {
      await cleanupUnreferencedMedia([...mediaIdsToRollback]);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const newMediaIds = getReferencedMediaIds(user.toObject());
    await cleanupUnreferencedMedia([...oldMediaIds].filter((id) => !newMediaIds.has(id)));
    res.json(toPublicUser(user));
  } catch (error) {
    await cleanupUnreferencedMedia([...mediaIdsToRollback]);
    console.error('Failed to update user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

app.post('/api/users/:uid/follow/:targetUid', protectSelf, async (req, res) => {
  try {
    const { uid, targetUid } = req.params;
    if (uid === targetUid) return res.status(400).json({ success: false, message: 'Cannot follow yourself' });

    const currentUser = await User.findOne({ uid });
    const targetUser = await User.findOne({ uid: targetUid });
    if (!currentUser || !targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    const isFollowing = (currentUser.following || []).includes(targetUid);
    await User.updateOne({ uid }, isFollowing ? { $pull: { following: targetUid } } : { $addToSet: { following: targetUid } });
    await User.updateOne({ uid: targetUid }, isFollowing ? { $pull: { followers: uid } } : { $addToSet: { followers: uid } });

    const users = await User.find({ uid: { $in: [uid, targetUid] } });
    res.json({ success: true, users: users.map(toPublicUser) });
  } catch (error) {
    console.error('Follow update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update follow state' });
  }
});

app.post('/api/users/:uid/saved-posts/:postId', protectSelf, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isSaved = (user.savedPosts || []).includes(req.params.postId);
    const updated = await User.findOneAndUpdate(
      { uid: req.params.uid },
      isSaved ? { $pull: { savedPosts: req.params.postId } } : { $addToSet: { savedPosts: req.params.postId } },
      { returnDocument: 'after' }
    );

    res.json(toPublicUser(updated));
  } catch (error) {
    console.error('Saved post update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update saved post' });
  }
});

app.post('/api/uploads/post-media', protect, (req, res) => {
    postMediaUpload.single('media')(req, res, (error) => {
    if (error) {
      const isSizeError = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      const uploadLimitMB = Math.floor(mediaUploadLimitBytes / (1024 * 1024));
      res.status(isSizeError ? 413 : 400).json({
        success: false,
        message: isSizeError ? `File is too large. Maximum allowed size is ${uploadLimitMB} MB.` : error.message,
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No media file uploaded' });
      return;
    }

    mediaStorageService.uploadFromRequestFile({
      file: req.file,
      category: 'pending',
      ownerId: req.user.uid,
      allowAttachments: true,
    }).then((uploaded) => res.status(201).json({
      success: true,
      url: uploaded.secureUrl,
      secureUrl: uploaded.secureUrl,
      mediaId: uploaded.fileIdString,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      mediaType: uploaded.mediaType,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    })).catch((uploadError) => {
      const message = uploadError?.isMediaValidationError || uploadError?.statusCode
        ? uploadError.message
        : 'Could not complete the Cloudinary upload.';
      res.status(uploadError?.statusCode || 500).json({
        success: false,
        message,
      });
    });
  });
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

io.use((socket, next) => {
  authenticateToken(getSocketToken(socket))
    .then((decoded) => {
      if (!decoded) {
        next(new Error('Authentication required'));
        return;
      }
      socket.data.userId = decoded.uid;
      socket.data.sessionId = decoded.sid;
      next();
    })
    .catch((error) => {
      console.error('Socket authentication failed:', error.message);
      next(new Error('Authentication service unavailable'));
    });
});

const userConnections = new Map();

app.get('/api/posts', protect, async (_req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    const referencedIds = new Set(posts.flatMap((post) => [...getReferencedMediaIds(post.toObject())]));
    const assets = referencedIds.size
      ? await MediaAsset.find({ fileId: { $in: [...referencedIds] }, source: 'cloudinary-upload' })
        .select('fileId secureUrl resourceType')
        .lean()
      : [];
    const assetsById = new Map(assets.map((asset) => [asset.fileId, asset]));
    const formatted = posts.map((post) => toPublicPost(post, assetsById));
    res.json(formatted);
  } catch (error) {
    console.error('Failed to fetch posts from MongoDB:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

app.post('/api/posts', protect, async (req, res) => {
  const mediaIdsToRollback = new Set();
  const mediaMetadataById = new Map();
  try {
    const payload = req.body || {};
    
    if (!payload.authorId) {
      return res.status(400).json({ success: false, message: 'authorId is required' });
    }
    if (payload.authorId !== req.user.uid) return res.status(403).json({ success: false, message: 'You can only create posts for your own account.' });
    const mediaId = resolveMediaId(payload.mediaId || payload.mediaUrl || payload.imageUrl);
    if ((payload.mediaUrl || payload.imageUrl) && !mediaId) {
      return res.status(400).json({ success: false, message: 'Post images and videos must be stored in the configured media provider, such as Cloudinary or a valid media URL.' });
    }
    if ((payload.mediaId || payload.mediaUrl || payload.imageUrl || '').toString().startsWith('data:') ||
        (payload.mediaUrl || payload.imageUrl || '').toString().startsWith('/uploads/')) {
      return res.status(400).json({ success: false, message: 'Post media must be uploaded through the backend media upload flow first.' });
    }
    const attachmentId = resolveMediaId(payload.attachment?.mediaId || payload.attachment?.url);
    if (payload.attachment?.url && !attachmentId) {
      return res.status(400).json({ success: false, message: 'Post attachments must be stored in the configured media provider.' });
    }
    for (const id of new Set([mediaId, attachmentId].filter(Boolean))) {
      const metadata = await mediaStorageService.getFileMetadata(id);
      if (!metadata || String(metadata.metadata?.ownerId) !== req.user.uid) {
        await cleanupUnreferencedMedia([...mediaIdsToRollback]);
        return res.status(403).json({ success: false, message: 'Post media upload is invalid or belongs to another user.' });
      }
      mediaIdsToRollback.add(id);
      mediaMetadataById.set(id, metadata);
    }

    const mediaUrl = mediaMetadataById.get(mediaId)?.secureUrl || '';
    const attachmentUrl = mediaMetadataById.get(attachmentId)?.secureUrl || '';
    const resourceType = mediaMetadataById.get(mediaId)?.resourceType;
    const newPost = new Post({
      authorId: payload.authorId,
      title: payload.title || '',
      content: payload.content || '',
      mediaUrl,
      imageUrl: mediaUrl,
      mediaId: mediaId || '',
      imageId: mediaId || '',
      attachment: payload.attachment ? { ...payload.attachment, url: attachmentUrl, mediaId: attachmentId || '' } : undefined,
      mediaType: resourceType === 'video'
        ? 'video'
        : resourceType === 'image' ? 'image' : payload.mediaType || '',
      postType: payload.postType || 'standard',
      skillTags: Array.isArray(payload.skills) ? payload.skills : [],
      createdAt: payload.createdAt ? new Date(payload.createdAt) : Date.now()
    });

    const postMediaIds = [...getReferencedMediaIds(newPost.toObject())];
    if (postMediaIds.length) {
      await MediaAsset.updateMany(
        { fileId: { $in: postMediaIds }, ownerId: req.user.uid },
        { $set: { category: 'post', relatedEntityId: String(newPost._id) } },
      );
    }
    await newPost.save();
    
    const savedPost = toPublicPost(newPost);
    res.status(201).json(savedPost);
  } catch (error) {
    await cleanupUnreferencedMedia([...mediaIdsToRollback]);
    console.error('MongoDB error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
});

app.patch('/api/posts/:id', protect, async (req, res) => {
  const mediaIdsToRollback = new Set();
  const mediaMetadataById = new Map();
  try {
    const existingPost = await Post.findById(req.params.id);
    if (!existingPost) return res.status(404).json({ success: false, message: 'Post not found' });
    const updates = { ...(req.body || {}) };
    delete updates._id;
    delete updates.id;
    delete updates.authorId;
    const contentFields = ['title', 'content', 'postType', 'skills', 'skillTags', 'mediaUrl', 'imageUrl', 'mediaId', 'imageId', 'attachment'];
    if (contentFields.some((key) => Object.prototype.hasOwnProperty.call(updates, key)) && existingPost.authorId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'You can only edit your own post content.' });
    }
    if (['mediaUrl', 'imageUrl'].some((key) => typeof updates[key] === 'string' && (updates[key].startsWith('data:') || updates[key].startsWith('/uploads/')))) {
      return res.status(400).json({ success: false, message: 'Post media must be stored in the configured media provider.' });
    }
    for (const key of ['mediaUrl', 'imageUrl']) {
      if (typeof updates[key] === 'string' && updates[key] && !resolveMediaId(updates[key])) {
        return res.status(400).json({ success: false, message: 'Post images and videos must be stored in the configured media provider, such as Cloudinary or a valid media URL.' });
      }
    }
    if (updates.attachment?.url && !resolveMediaId(updates.attachment.mediaId || updates.attachment.url)) {
      return res.status(400).json({ success: false, message: 'Post attachments must be stored in the configured media provider.' });
    }
    if (Array.isArray(updates.comments) && updates.comments.some((comment) => comment?.imageUrl && !resolveMediaId(comment.imageUrl))) {
      return res.status(400).json({ success: false, message: 'Comment images must be stored in the configured media provider.' });
    }
    if (Array.isArray(updates.comments)) {
      updates.comments = updates.comments.map((comment) => {
        const commentMediaId = resolveMediaId(comment.mediaId || comment.imageUrl) || '';
        return { ...comment, mediaId: commentMediaId, imageUrl: comment.imageUrl || '' };
      });
    }
    const oldMediaIds = getReferencedMediaIds(existingPost.toObject());
    const requestedMediaIds = getReferencedMediaIds(updates);
    for (const id of requestedMediaIds) {
      if (oldMediaIds.has(id)) continue;
      const metadata = await mediaStorageService.getFileMetadata(id);
      if (!metadata || String(metadata.metadata?.ownerId) !== req.user.uid) {
        await cleanupUnreferencedMedia([...mediaIdsToRollback]);
        return res.status(403).json({ success: false, message: 'Post media upload is invalid or belongs to another user.' });
      }
      mediaIdsToRollback.add(id);
      mediaMetadataById.set(id, metadata);
    }
    if (Array.isArray(updates.comments)) {
      updates.comments = updates.comments.map((comment) => ({
        ...comment,
        imageUrl: mediaMetadataById.get(comment.mediaId)?.secureUrl || comment.imageUrl || '',
      }));
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'mediaUrl') || Object.prototype.hasOwnProperty.call(updates, 'imageUrl') || Object.prototype.hasOwnProperty.call(updates, 'mediaId')) {
      const mediaId = resolveMediaId(updates.mediaId || updates.mediaUrl || updates.imageUrl);
      if (mediaId) {
        const metadata = await mediaStorageService.getFileMetadata(mediaId);
        if (!metadata || String(metadata.metadata?.ownerId) !== req.user.uid) {
          await cleanupUnreferencedMedia([...mediaIdsToRollback]);
          return res.status(403).json({ success: false, message: 'Post media upload is invalid or belongs to another user.' });
        }
        mediaIdsToRollback.add(mediaId);
        mediaMetadataById.set(mediaId, metadata);
      }
      updates.mediaId = mediaId || '';
      updates.imageId = mediaId || '';
      updates.mediaUrl = mediaMetadataById.get(mediaId)?.secureUrl || '';
      updates.imageUrl = updates.mediaUrl;
    }
    if (updates.attachment) {
      const attachmentId = resolveMediaId(updates.attachment.mediaId || updates.attachment.url) || '';
      updates.attachment = {
        ...updates.attachment,
        mediaId: attachmentId,
        url: mediaMetadataById.get(attachmentId)?.secureUrl || updates.attachment.url || '',
      };
    }
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after', runValidators: true });
    
    if (!updatedPost) {
      await cleanupUnreferencedMedia([...mediaIdsToRollback]);
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    await cleanupUnreferencedMedia([...oldMediaIds].filter((id) => !getReferencedMediaIds(updatedPost.toObject()).has(id)));
    
    res.json(toPublicPost(updatedPost));
  } catch (error) {
    await cleanupUnreferencedMedia([...mediaIdsToRollback]);
    console.error('MongoDB error:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
});

const getMessageTimestamp = (message) => {
  const timestamp = message?.createdAt ?? message?.timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return Number.isFinite(timestamp) ? timestamp : 0;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createConversationView = (conversation, userId) => {
  const thread = typeof conversation.toObject === 'function' ? conversation.toObject() : conversation;
  const viewThread = { ...thread };
  delete viewThread.deletedFor;
  const clearMarker = (thread.clearedAt || []).find((marker) => marker.userId === userId);
  const clearedTimestamp = Number(clearMarker?.timestamp) || 0;
  const messages = (thread.messages || []).filter((message) =>
    !(message.hiddenFor || []).includes(userId) && getMessageTimestamp(message) > clearedTimestamp
  ).map((message) => {
    if (message.deletedForEveryone) {
      const safeMessage = { ...message };
      delete safeMessage.deletedBy;
      delete safeMessage.deletedAt;
      return {
        ...safeMessage,
        text: 'This message was deleted',
        attachments: [],
        forwardedFrom: null,
      };
    }
    return {
      ...message,
      attachments: (message.attachments || []).map((attachment) => {
        const mediaId = resolveMediaId(attachment.mediaId || attachment.url) || '';
        const storedUrl = attachment.url || '';
        return {
          ...attachment,
          mediaId,
          url: storedUrl.startsWith('/api/media/') || storedUrl.includes('/api/media/')
            ? storedUrl
            : mediaStorageService.buildMediaProxyUrl(mediaId),
        };
      }),
    };
  });
  const latestMessage = messages[messages.length - 1];

  return {
    ...viewThread,
    ...(thread.group ? {
      group: {
        name: thread.group.name,
        image: thread.group.image,
        creatorId: thread.group.creatorId,
        adminId: thread.group.adminId,
      },
    } : {}),
    messages,
    lastMessage: latestMessage
      ? (latestMessage.text || (latestMessage.attachments?.length ? 'Attachment' : ''))
      : '',
  };
};

const isValidInvitationToken = (token) => typeof token === 'string' && /^[a-f\d]{64}$/i.test(token);
const hashInvitationToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const publishConversationUpdate = (conversation) => {
  conversation.participants.forEach((participantId) => {
    if ((conversation.deletedFor || []).includes(participantId)) return;
    io.to(participantId).emit('conversation:update', createConversationView(conversation, participantId));
  });
};

const createStoredMessage = ({ authorId, text = '', attachments = [], forwardedFrom = null }, timestamp) => ({
  id: `${timestamp}-${crypto.randomBytes(5).toString('hex')}`,
  authorId,
  text,
  createdAt: timestamp,
  timestamp,
  deletedForEveryone: false,
  attachments: attachments.map((attachment) => ({
    id: attachment.id || `${timestamp}-${crypto.randomBytes(4).toString('hex')}`,
    filename: attachment.filename || '',
    storedName: attachment.storedName || '',
    mimeType: attachment.mimeType || '',
    size: Number(attachment.size) || 0,
    type: attachment.type || 'file',
    url: '',
    mediaId: attachment.mediaId || resolveMediaId(attachment.url) || '',
  })),
  ...(forwardedFrom ? { forwardedFrom } : {}),
});

app.post('/api/groups', protect, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const requestedParticipants = req.body?.participantIds;
    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: 'Group name must be between 1 and 80 characters' });
    }
    if (!Array.isArray(requestedParticipants) || requestedParticipants.length === 0 || requestedParticipants.length > 99 ||
        requestedParticipants.some((participantId) => typeof participantId !== 'string' || !participantId.trim() || participantId.length > 100)) {
      return res.status(400).json({ success: false, message: 'Select between 1 and 99 valid participants' });
    }

    const userId = req.user.uid;
    const participantIds = [...new Set([userId, ...requestedParticipants.map((participantId) => participantId.trim())])];
    if (participantIds.length < 2) {
      return res.status(400).json({ success: false, message: 'A group must include at least one other participant' });
    }
    const validUsers = await User.find({ uid: { $in: participantIds } }).select('uid');
    if (validUsers.length !== participantIds.length) {
      return res.status(400).json({ success: false, message: 'One or more selected participants do not exist' });
    }

    const timestamp = Date.now();
    const group = await Conversation.create({
      id: `group_${crypto.randomBytes(12).toString('hex')}`,
      type: 'group',
      group: { name, creatorId: userId, adminId: userId },
      participants: participantIds,
      messages: [],
      updatedAt: timestamp,
      lastMessage: '',
    });

    publishConversationUpdate(group);
    res.status(201).json({ success: true, conversation: createConversationView(group, userId) });
  } catch (error) {
    console.error('Failed to create group conversation:', error);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
});

app.patch('/api/groups/:id', protect, async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) {
      return res.status(400).json({ success: false, message: 'Group name must be between 1 and 80 characters' });
    }

    const group = await Conversation.findOne({ id: req.params.id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.participants.includes(req.user.uid)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this group' });
    }
    if (group.group?.adminId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Only the group administrator can change group settings' });
    }

    group.group.name = name;
    await group.save();
    publishConversationUpdate(group);
    res.json({ success: true, conversation: createConversationView(group, req.user.uid) });
  } catch (error) {
    console.error(`Failed to update group ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to update group' });
  }
});

app.post('/api/groups/:id/members', protect, async (req, res) => {
  try {
    const participantId = typeof req.body?.participantId === 'string' ? req.body.participantId.trim() : '';
    if (!participantId || participantId.length > 100) {
      return res.status(400).json({ success: false, message: 'A valid participant ID is required' });
    }

    const group = await Conversation.findOne({ id: req.params.id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.participants.includes(req.user.uid)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this group' });
    }
    if (group.group?.adminId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Only the group administrator can add participants' });
    }
    if (group.participants.includes(participantId)) {
      return res.status(409).json({ success: false, message: 'User is already a group participant' });
    }
    if (group.participants.length >= 100) {
      return res.status(400).json({ success: false, message: 'Group participant limit reached' });
    }
    if (!await User.exists({ uid: participantId })) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    group.participants.push(participantId);
    await group.save();
    publishConversationUpdate(group);
    res.json({ success: true, conversation: createConversationView(group, req.user.uid) });
  } catch (error) {
    console.error(`Failed to add a participant to group ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to add group participant' });
  }
});

app.delete('/api/groups/:id/members/:participantId', protect, async (req, res) => {
  try {
    const { id, participantId } = req.params;
    if (!participantId || participantId.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid participant ID' });
    }

    const group = await Conversation.findOne({ id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.participants.includes(req.user.uid)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this group' });
    }
    if (group.group?.adminId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Only the group administrator can remove participants' });
    }
    if (participantId === group.group.adminId) {
      return res.status(400).json({ success: false, message: 'The administrator cannot be removed from the group' });
    }
    if (!group.participants.includes(participantId)) {
      return res.status(404).json({ success: false, message: 'User is not a group participant' });
    }

    const latestMessageTimestamp = Math.max(0, ...group.messages.map(getMessageTimestamp));
    group.participants = group.participants.filter((memberId) => memberId !== participantId);
    const clearMarker = (group.clearedAt || []).find((marker) => marker.userId === participantId);
    const priorClearTimestamp = Number(clearMarker?.timestamp) || 0;
    const removalTimestamp = Math.max(Date.now(), latestMessageTimestamp + 1, priorClearTimestamp + 1);
    if (clearMarker) {
      clearMarker.timestamp = removalTimestamp;
      clearMarker.requestId = `removed-${crypto.randomBytes(5).toString('hex')}`;
    } else {
      group.clearedAt.push({
        userId: participantId,
        timestamp: removalTimestamp,
        requestId: `removed-${crypto.randomBytes(5).toString('hex')}`,
      });
    }
    await group.save();

    io.to(participantId).emit('conversation:removed', { id });
    publishConversationUpdate(group);
    res.json({ success: true, conversation: createConversationView(group, req.user.uid) });
  } catch (error) {
    console.error(`Failed to remove a participant from group ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to remove group participant' });
  }
});

app.post('/api/groups/:id/invitation', protect, async (req, res) => {
  try {
    const group = await Conversation.findOne({ id: req.params.id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.participants.includes(req.user.uid)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this group' });
    }
    if (group.group?.adminId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Only the group administrator can create an invite link' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    group.group.invitationTokenHash = hashInvitationToken(token);
    group.group.invitationCreatedAt = Date.now();
    await group.save();
    res.status(201).json({ success: true, token });
  } catch (error) {
    console.error(`Failed to create group invitation for ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to create group invitation' });
  }
});

app.delete('/api/groups/:id/invitation', protect, async (req, res) => {
  try {
    const group = await Conversation.findOne({ id: req.params.id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.participants.includes(req.user.uid)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this group' });
    }
    if (group.group?.adminId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Only the group administrator can revoke an invite link' });
    }

    group.group.invitationTokenHash = '';
    group.group.invitationCreatedAt = 0;
    await group.save();
    res.json({ success: true });
  } catch (error) {
    console.error(`Failed to revoke group invitation for ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to revoke group invitation' });
  }
});

app.get('/api/group-invitations/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidInvitationToken(token)) {
      return res.status(400).json({ success: false, message: 'Invalid invitation token' });
    }
    const group = await Conversation.findOne({
      type: 'group',
      'group.invitationTokenHash': hashInvitationToken(token),
    }).select('group.name group.image participants');
    if (!group) return res.status(404).json({ success: false, message: 'This invitation is invalid or has been revoked' });
    res.json({
      success: true,
      group: {
        name: group.group?.name || 'Group chat',
        image: group.group?.image || '',
        participantCount: group.participants.length,
      },
    });
  } catch (error) {
    console.error('Failed to validate group invitation:', error);
    res.status(500).json({ success: false, message: 'Failed to validate group invitation' });
  }
});

app.post('/api/group-invitations/:token/join', protect, async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidInvitationToken(token)) {
      return res.status(400).json({ success: false, message: 'Invalid invitation token' });
    }

    const tokenHash = hashInvitationToken(token);
    const userId = req.user.uid;
    const group = await Conversation.findOne({ type: 'group', 'group.invitationTokenHash': tokenHash });
    if (!group) return res.status(404).json({ success: false, message: 'This invitation is invalid or has been revoked' });

    if (group.participants.includes(userId)) {
      return res.json({ success: true, alreadyMember: true, conversation: createConversationView(group, userId) });
    }
    if (!await User.exists({ uid: userId })) {
      return res.status(404).json({ success: false, message: 'Authenticated user not found' });
    }
    if (group.participants.length >= 100) {
      return res.status(409).json({ success: false, message: 'This group has reached its participant limit' });
    }

    const updateResult = await Conversation.updateOne(
      {
        id: group.id,
        type: 'group',
        'group.invitationTokenHash': tokenHash,
        participants: { $ne: userId },
        $expr: { $lt: [{ $size: { $ifNull: ['$participants', []] } }, 100] },
      },
      { $addToSet: { participants: userId } }
    );

    const updatedGroup = await Conversation.findOne({ id: group.id, type: 'group', 'group.invitationTokenHash': tokenHash });
    if (!updatedGroup) {
      return res.status(404).json({ success: false, message: 'This invitation is invalid or has been revoked' });
    }
    if (updateResult.matchedCount === 0 && !updatedGroup.participants.includes(userId)) {
      return res.status(409).json({ success: false, message: 'This group has reached its participant limit' });
    }

    publishConversationUpdate(updatedGroup);
    res.json({
      success: true,
      alreadyMember: updateResult.matchedCount === 0,
      conversation: createConversationView(updatedGroup, userId),
    });
  } catch (error) {
    console.error('Failed to join group using invitation:', error);
    res.status(500).json({ success: false, message: 'Failed to join group' });
  }
});

app.post('/api/conversations/:id/messages/:messageId/forward', protect, async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const recipientIds = req.body?.recipientIds;
    if (!id || id.length > 300 || !messageId || messageId.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid conversation or message ID' });
    }
    if (!Array.isArray(recipientIds) || recipientIds.length === 0 || recipientIds.length > 20 ||
        recipientIds.some((recipientId) => typeof recipientId !== 'string' || !recipientId.trim() || recipientId.length > 300)) {
      return res.status(400).json({ success: false, message: 'Select between 1 and 20 valid recipients' });
    }

    const senderId = req.user.uid;
    const source = await Conversation.findOne({ id, participants: senderId });
    if (!source) return res.status(404).json({ success: false, message: 'Source conversation not found' });
    const sourceMessage = source.messages.find((message) => message.id === messageId);
    const sourceClearMarker = (source.clearedAt || []).find((marker) => marker.userId === senderId);
    if (!sourceMessage || sourceMessage.deletedForEveryone || (sourceMessage.hiddenFor || []).includes(senderId) ||
        getMessageTimestamp(sourceMessage) <= (Number(sourceClearMarker?.timestamp) || 0)) {
      return res.status(404).json({ success: false, message: 'Message is unavailable to forward' });
    }

    const forwardedFrom = {
      userId: sourceMessage.authorId,
      createdAt: getMessageTimestamp(sourceMessage),
    };
    const uniqueRecipientIds = [...new Set(recipientIds.map((recipientId) => recipientId.trim()))];
    const targets = [];
    for (const recipientId of uniqueRecipientIds) {
      if (recipientId.startsWith('group_')) {
        const target = await Conversation.findOne({ id: recipientId, type: 'group', participants: senderId });
        if (!target) {
          return res.status(403).json({ success: false, message: 'You cannot forward to a group you do not belong to' });
        }
        targets.push(target);
        continue;
      }

      if (recipientId === senderId || !await User.exists({ uid: recipientId })) {
        return res.status(400).json({ success: false, message: 'Invalid direct-message recipient' });
      }
      const threadId = getThreadId(senderId, recipientId);
      let target = await Conversation.findOne({ id: threadId });
      if (!target) {
        target = new Conversation({
          id: threadId,
          type: 'direct',
          participants: [senderId, recipientId],
          messages: [],
          updatedAt: 0,
          lastMessage: '',
        });
      } else if (target.type === 'group' || !target.participants.includes(senderId) || !target.participants.includes(recipientId)) {
        return res.status(403).json({ success: false, message: 'Invalid direct conversation recipient' });
      }
      targets.push(target);
    }

    const results = [];

    for (const target of targets) {
      const latestClearTimestamp = Math.max(0, ...(target.clearedAt || []).map((marker) => Number(marker.timestamp) || 0));
      const timestamp = Math.max(Date.now(), (Number(target.updatedAt) || 0) + 1, latestClearTimestamp + 1);
      const forwardedMessage = createStoredMessage({
        authorId: senderId,
        text: sourceMessage.text || '',
        attachments: sourceMessage.attachments || [],
        forwardedFrom,
      }, timestamp);
      target.messages.push(forwardedMessage);
      target.deletedFor = [];
      target.updatedAt = timestamp;
      target.lastMessage = forwardedMessage.text || (forwardedMessage.attachments.length ? 'Attachment' : '');
      await target.save();
      publishConversationUpdate(target);
      results.push(createConversationView(target, senderId));
    }

    res.json({ success: true, conversations: results });
  } catch (error) {
    console.error(`Failed to forward message ${req.params.messageId}:`, error);
    res.status(500).json({ success: false, message: 'Failed to forward message' });
  }
});

app.get('/api/conversations/:uid', protect, async (req, res) => {
  try {
    if (req.user.uid !== req.params.uid) {
      return res.status(403).json({ success: false, message: 'You can only access your own conversations' });
    }

    const threads = await Conversation.find({
      participants: req.params.uid,
      deletedFor: { $ne: req.user.uid },
    }).sort({ updatedAt: -1 });
    res.json(threads.map((thread) => createConversationView(thread, req.user.uid)));
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations/:id/messages/delete-for-me', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const messageIds = req.body?.messageIds;
    const userId = req.user.uid;

    if (typeof id !== 'string' || id.length === 0 || id.length > 300) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
    }
    if (!Array.isArray(messageIds) || messageIds.length === 0 || messageIds.length > 100 ||
        messageIds.some((messageId) => typeof messageId !== 'string' || !messageId.trim() || messageId.length > 100)) {
      return res.status(400).json({ success: false, message: 'Provide between 1 and 100 valid message IDs' });
    }

    const thread = await Conversation.findOne({ id, participants: userId });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const requestedIds = new Set(messageIds.map((messageId) => messageId.trim()));
    const matchedIds = new Set(thread.messages.filter((message) => requestedIds.has(message.id)).map((message) => message.id));
    if (matchedIds.size !== requestedIds.size) {
      return res.status(400).json({ success: false, message: 'One or more messages do not belong to this conversation' });
    }
    const mediaIdsToCheck = thread.messages
      .filter((message) => requestedIds.has(message.id))
      .flatMap((message) => [...getReferencedMediaIds(typeof message.toObject === 'function' ? message.toObject() : message)]);

    await Conversation.updateOne(
      { id, participants: userId },
      { $addToSet: { 'messages.$[message].hiddenFor': userId } },
      { arrayFilters: [{ 'message.id': { $in: [...requestedIds] } }] }
    );
    await cleanupUnreferencedMedia(mediaIdsToCheck);

    const updatedThread = await Conversation.findOne({ id, participants: userId });
    const conversationView = createConversationView(updatedThread, userId);
    io.to(userId).emit('conversation:update', conversationView);
    res.json({ success: true, conversation: conversationView });
  } catch (error) {
    console.error(`[Conversation Error] Failed to delete selected messages for ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to delete selected messages' });
  }
});

app.post('/api/conversations/:id/messages/:messageId/delete-for-everyone', protect, async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const userId = req.user.uid;
    if (!id || id.length > 300 || !messageId || messageId.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid conversation or message ID' });
    }

    const thread = await Conversation.findOne({ id, participants: userId });
    if (!thread) return res.status(404).json({ success: false, message: 'Conversation not found' });
    const message = thread.messages.find((item) => item.id === messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!canDeleteMessageForEveryone(thread.toObject(), message.toObject(), userId)) {
      return res.status(403).json({ success: false, message: 'Only the sender or group admin can delete this message for everyone' });
    }
    if (message.deletedForEveryone) {
      return res.status(409).json({ success: false, message: 'Message has already been deleted for everyone' });
    }

    const mediaIds = getReferencedMediaIds(message.toObject());
    const targetMessageFilter = {
      id: messageId,
      deletedForEveryone: { $ne: true },
    };
    if (message.authorId === userId) targetMessageFilter.authorId = userId;
    const updateFilter = {
      id,
      participants: userId,
      messages: { $elemMatch: targetMessageFilter },
    };
    if (message.authorId !== userId) {
      updateFilter.type = 'group';
      updateFilter['group.adminId'] = userId;
    }
    const result = await Conversation.updateOne(
      updateFilter,
      {
        $set: {
          'messages.$[message].text': '',
          'messages.$[message].attachments': [],
          'messages.$[message].forwardedFrom': null,
          'messages.$[message].deletedForEveryone': true,
          'messages.$[message].deletedAt': Date.now(),
          'messages.$[message].deletedBy': userId,
        },
      },
      { arrayFilters: [{ 'message.id': messageId, 'message.deletedForEveryone': { $ne: true } }] }
    );
    if (!result.matchedCount) {
      return res.status(409).json({ success: false, message: 'Message is no longer available to delete' });
    }

    let updatedThread = await Conversation.findOne({ id, participants: userId });
    if (updatedThread.messages[updatedThread.messages.length - 1]?.id === messageId) {
      const lastMessageUpdate = await Conversation.updateOne(
        { id, updatedAt: updatedThread.updatedAt },
        { $set: { lastMessage: 'This message was deleted' } }
      );
      if (lastMessageUpdate.matchedCount) {
        updatedThread = await Conversation.findOne({ id, participants: userId });
      }
    }
    publishConversationUpdate(updatedThread);
    await cleanupUnreferencedMedia(mediaIds);
    res.json({ success: true, conversation: createConversationView(updatedThread, userId) });
  } catch (error) {
    console.error(`[Conversation Error] Failed to delete message ${req.params.messageId} for everyone:`, error);
    res.status(500).json({ success: false, message: 'Failed to delete message for everyone' });
  }
});

app.post('/api/conversations/:id/clear-for-me', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : '';

    if (typeof id !== 'string' || id.length === 0 || id.length > 300) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
    }
    if (!requestId || requestId.length > 100) {
      return res.status(400).json({ success: false, message: 'Invalid clear request ID' });
    }

    const thread = await Conversation.findOne({ id, participants: userId });
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const marker = (thread.clearedAt || []).find((item) => item.userId === userId);
    const mediaIdsToCheck = thread.messages.flatMap((message) => [
      ...getReferencedMediaIds(typeof message.toObject === 'function' ? message.toObject() : message),
    ]);
    if (!marker || marker.requestId !== requestId) {
      const latestMessageTimestamp = Math.max(0, ...thread.messages.map(getMessageTimestamp));
      const timestamp = Math.max(Date.now(), latestMessageTimestamp + 1);
      if (marker) {
        await Conversation.updateOne(
          { id, participants: userId, 'clearedAt.userId': userId, 'clearedAt.requestId': { $ne: requestId } },
          {
            $set: {
              'clearedAt.$[marker].timestamp': timestamp,
              'clearedAt.$[marker].requestId': requestId,
            },
          },
          { arrayFilters: [{ 'marker.userId': userId }] }
        );
      } else {
        await Conversation.updateOne(
          { id, participants: userId, clearedAt: { $not: { $elemMatch: { userId } } } },
          { $push: { clearedAt: { userId, timestamp, requestId } } }
        );
      }
    }

    await cleanupUnreferencedMedia(mediaIdsToCheck);
    const updatedThread = await Conversation.findOne({ id, participants: userId });
    const conversationView = createConversationView(updatedThread, userId);
    io.to(userId).emit('conversation:update', conversationView);
    res.json({ success: true, conversation: conversationView });
  } catch (error) {
    console.error(`[Conversation Error] Failed to clear conversation ${req.params.id} for user:`, error);
    res.status(500).json({ success: false, message: 'Failed to clear conversation' });
  }
});

app.put('/api/conversations/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};

    const existing = await Conversation.findOne({ id, participants: req.user.uid });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    if (existing.type === 'group') {
      return res.status(403).json({ success: false, message: 'Group conversations must be changed through group actions' });
    }

    const thread = await Conversation.findOneAndUpdate(
      { id, participants: req.user.uid },
      {
        $set: {
          updatedAt: Number(payload.updatedAt) || existing.updatedAt,
          lastMessage: typeof payload.lastMessage === 'string' ? payload.lastMessage : existing.lastMessage,
        },
      },
      { returnDocument: 'after' }
    );

    if (!thread) {
      return res.status(404).json({ success: false, message: 'Conversation not found and could not be created' });
    }
    
    res.json(thread.toObject());
  } catch (error) {
    console.error(`[Conversation Error] Failed to save thread ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to save conversation', error: error.message });
  }
});

app.delete('/api/conversations/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const thread = await Conversation.findOne({ id, participants: userId });
    if (!thread) return res.status(404).json({ success: false, message: 'Conversation not found' });
    const removal = await Conversation.updateOne(
      { id, participants: userId },
      { $addToSet: { deletedFor: userId } }
    );
    if (!removal.matchedCount) return res.status(404).json({ success: false, message: 'Conversation not found' });
    io.to(userId).emit('conversation:removed', { id });
    res.status(200).json({ success: true, id });
  } catch (error) {
    console.error(`[Conversation Error] Failed to delete thread ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: 'Failed to delete conversation', error: error.message });
  }
});

app.delete('/api/posts/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    if (post.authorId !== req.user.uid) return res.status(403).json({ success: false, message: 'You can only delete your own posts.' });
    const mediaIds = getReferencedMediaIds(post.toObject());
    await Post.deleteOne({ _id: post._id, authorId: req.user.uid });
    await cleanupUnreferencedMedia([...mediaIds]);
    res.status(204).end();
  } catch (error) {
    console.error('MongoDB error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

const getThreadId = (userA, userB) => [userA, userB].sort().join('__');

const broadcastPresenceState = (userId, online) => {
  io.emit('presence:update', { userId, online });
};

io.on('connection', (socket) => {
  console.log(`[Socket Connection] ${socket.id} connected`);
  socket.join(`session:${socket.data.sessionId}`);

  socket.use((_packet, next) => {
    AuthSession.exists({
      sid: socket.data.sessionId,
      uid: socket.data.userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).then((active) => {
      if (active) {
        next();
        return;
      }
      socket.emit('auth:logout');
      socket.disconnect(true);
    }).catch((error) => {
      console.error('Socket session validation failed:', error.message);
      next(error);
    });
  });

  socket.on('register', (data) => {
    const registrationData = handleRegisterValidation(socket, data);

    if (!registrationData) {
      return;
    }

    const userId = socket.data.userId;
    if (registrationData.userId !== userId) {
      socket.emit('error:validation', {
        event: 'register',
        errors: ['Authenticated user does not match registration user'],
      });
      return;
    }
    socket.data.following = registrationData.following;
    socket.data.followers = registrationData.followers;

    const existingSockets = userConnections.get(userId) || new Set();
    existingSockets.add(socket.id);
    userConnections.set(userId, existingSockets);

    socket.join(userId);
    const presenceState = Object.fromEntries(Array.from(userConnections.entries()).map(([connectedUserId, socketSet]) => [connectedUserId, socketSet.size > 0]));
    socket.emit('presence:state', presenceState);
    broadcastPresenceState(userId, true);

    Conversation.find({ participants: userId, deletedFor: { $ne: userId } }).sort({ updatedAt: -1 })
      .then((threads) => {
        socket.emit('conversations:init', {
          success: true,
          message: 'Conversations initialized',
          threads: threads.map((thread) => createConversationView(thread, userId)),
          count: threads.length,
        });
      })
      .catch((error) => console.error(`Conversation init failed: ${error.message}`));
  });

  socket.on('message:send', async (data) => {
    const submittedMediaIds = [];
    try {
      const message = handleMessageValidation(socket, data);

      if (!message) {
        return;
      }

      const senderId = socket.data.userId;
      if (!senderId || senderId !== message.from || !message.to || message.to === senderId) {
        socket.emit('error:validation', { event: 'message:send', errors: ['Invalid authenticated sender or recipient'] });
        return;
      }

      const validatedAttachments = [];
      for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
        const mediaId = resolveMediaId(attachment?.mediaId || attachment?.url);
        const metadata = mediaId ? await mediaStorageService.getFileMetadata(mediaId) : null;
        if (!metadata || metadata.metadata?.category !== 'pending' || String(metadata.metadata?.ownerId) !== senderId) {
          await cleanupUnreferencedMedia(submittedMediaIds);
          socket.emit('error:validation', { event: 'message:send', errors: ['One or more attachments are invalid'] });
          return;
        }
        submittedMediaIds.push(mediaId);
        validatedAttachments.push({
          id: attachment.id,
          filename: metadata.metadata?.originalName || metadata.filename,
          storedName: metadata.filename,
          mimeType: metadata.contentType || 'application/octet-stream',
          size: metadata.length || 0,
          type: mediaStorageService.inferMediaType(metadata.contentType || ''),
          url: mediaStorageService.buildMediaProxyUrl(mediaId),
          mediaId,
        });
      }

      const targetThreadId = message.threadId || getThreadId(senderId, message.to);
      let existingDoc = await Conversation.findOne({ id: targetThreadId });
      let existing = existingDoc?.toObject();
      if (existing?.type === 'group') {
        if (message.to !== targetThreadId || !existing.participants.includes(senderId)) {
          socket.emit('error:validation', { event: 'message:send', errors: ['You are not a participant in this group'] });
          return;
        }
      } else {
        if (message.to.startsWith('group_') || !await User.exists({ uid: message.to })) {
          socket.emit('error:validation', { event: 'message:send', errors: ['Invalid message recipient'] });
          return;
        }
        if (existing && (existing.type === 'group' || !existing.participants.includes(senderId) || !existing.participants.includes(message.to))) {
          socket.emit('error:validation', { event: 'message:send', errors: ['Invalid direct conversation'] });
          return;
        }
        if (!existing) {
          existing = {
            id: targetThreadId,
            type: 'direct',
            participants: [senderId, message.to],
            messages: [],
            clearedAt: [],
            updatedAt: 0,
            lastMessage: '',
          };
        }
      }

      const latestClearTimestamp = Math.max(0, ...(existing.clearedAt || []).map((marker) => Number(marker.timestamp) || 0));
      const timestamp = Math.max(Date.now(), (Number(existing.updatedAt) || 0) + 1, latestClearTimestamp + 1);
      const newMessage = createStoredMessage({
        authorId: senderId,
        text: message.text || '',
        attachments: validatedAttachments,
      }, timestamp);

      const nextLastMessage = newMessage.text || (newMessage.attachments.length > 0 ? 'Attachment' : '');
      const updatedThread = {
        ...existing,
        messages: [...existing.messages, newMessage],
        deletedFor: [],
        updatedAt: timestamp,
        lastMessage: nextLastMessage,
      };

      if (existingDoc) {
        await Conversation.findOneAndUpdate(
          { id: targetThreadId, participants: senderId },
          updatedThread,
          { returnDocument: 'after' }
        );
      } else {
        await Conversation.create(updatedThread);
      }

      socket.emit('message:confirmation', {
        success: true,
        message: 'Message sent successfully',
        messageId: newMessage.id,
      });

      updatedThread.participants.forEach((participantId) => {
        io.to(participantId).emit('conversation:update', createConversationView(updatedThread, participantId));
      });
    } catch (error) {
      await cleanupUnreferencedMedia(submittedMediaIds);
      console.error(`[Message Error] ${socket.id}: ${error.message}`);
      socket.emit('error:validation', {
        event: 'message:send',
        errors: ['Failed to save message'],
      });
    }
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    console.log(`[Socket Disconnected] ${socket.id}${userId ? ` (user: ${userId})` : ''}`);

    if (!userId) {
      return;
    }

    const activeSockets = userConnections.get(userId);
    if (activeSockets) {
      activeSockets.delete(socket.id);
      if (activeSockets.size === 0) {
        userConnections.delete(userId);
        broadcastPresenceState(userId, false);
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`[Socket Error] ${socket.id}:`, error);
  });
});

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    ok: true,
    server: 'Socket.IO Chat Server',
    status: 'running',
    postStorage: 'mongodb',
  });
});

const PORT = process.env.NODE_ENV === 'production'
  ? Number.parseInt(process.env.PORT || '5000', 10)
  : 5000;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Required backend port ${PORT} is already in use. Run "npm run ports" to identify the listener, then stop it only after confirming it belongs to SkillSwap.`);
  } else {
    console.error('Backend server failed to listen:', error.message);
  }

  mongoose.disconnect()
    .catch(() => {})
    .finally(() => process.exit(1));
});

async function startServer() {
  const portIsOccupied = await new Promise((resolve, reject) => {
    const probe = net.createConnection({ host: '127.0.0.1', port: PORT });
    probe.setTimeout(750);
    probe.once('connect', () => {
      probe.destroy();
      resolve(true);
    });
    probe.once('timeout', () => {
      probe.destroy();
      resolve(false);
    });
    probe.once('error', (error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.code === 'EHOSTUNREACH') {
        resolve(false);
        return;
      }
      reject(error);
    });
  });

  if (portIsOccupied) {
    console.error(`Required backend port ${PORT} is already in use. Run "npm run ports" to identify the listener, then stop it only after confirming it belongs to SkillSwap.`);
    process.exit(1);
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });
    console.log(`MongoDB connected successfully. State: ${mongoose.connection.readyState}, DB: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('MongoDB connection failed. Exiting process.', error.message);
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Socket server running on http://127.0.0.1:${PORT}`);
  });
}

startServer();
