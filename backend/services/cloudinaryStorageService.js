const cloudinary = require('cloudinary').v2;

const isConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const getCloudinaryConfig = () => {
  if (!isConfigured()) {
    throw new Error('Cloudinary credentials are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
};

const getSafeConfigSummary = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'PRESENT' : 'MISSING',
  apiKey: process.env.CLOUDINARY_API_KEY ? 'PRESENT' : 'MISSING',
  apiSecret: process.env.CLOUDINARY_API_SECRET ? 'PRESENT' : 'MISSING',
  secure: true,
  defaultFolder: process.env.CLOUDINARY_DEFAULT_FOLDER || 'skillswap',
  sourceEnv: process.env.CLOUDINARY_ENV_SOURCE || 'runtime environment',
});

const verifyConnection = async () => {
  if (!isConfigured()) {
    return {
      ok: false,
      status: 'missing-env',
      message: 'Cloudinary environment variables are missing or incomplete.',
      config: getSafeConfigSummary(),
    };
  }

  try {
    const client = getCloudinaryConfig();
    const ping = await client.api.ping();
    return {
      ok: ping?.status === 'ok' || ping?.status === 'ready',
      status: ping?.status === 'ok' || ping?.status === 'ready' ? 'connected' : 'unknown',
      message: ping?.status === 'ok' || ping?.status === 'ready'
        ? 'Cloudinary authentication succeeded.'
        : 'Cloudinary returned an unexpected status.',
      config: getSafeConfigSummary(),
    };
  } catch {
    return {
      ok: false,
      status: 'auth-failed',
      message: 'Cloudinary authentication failed. Check the backend Cloudinary configuration.',
      config: getSafeConfigSummary(),
    };
  }
};

const resolveResourceType = (mimeType = '', originalName = '') => {
  const normalizedMime = String(mimeType || '').toLowerCase();
  const normalizedName = String(originalName || '').toLowerCase();

  if (normalizedMime.startsWith('video/')) return 'video';
  if (normalizedMime.startsWith('image/')) return 'image';

  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(normalizedName)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(normalizedName)) return 'image';
  return 'raw';
};

const uploadBuffer = async ({
  buffer,
  originalName = 'upload',
  mimeType = 'application/octet-stream',
  folder = process.env.CLOUDINARY_DEFAULT_FOLDER || 'skillswap',
  publicId,
  resourceType,
}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('A valid file buffer is required for Cloudinary upload');
  }

  const client = getCloudinaryConfig();
  const activeResourceType = resourceType || resolveResourceType(mimeType, originalName);

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        ...(publicId ? {} : { folder }),
        public_id: publicId || undefined,
        resource_type: activeResourceType,
        use_filename: !publicId,
        unique_filename: !publicId,
        overwrite: false,
        filename_override: originalName,
      },
      (error, result) => {
        if (error) {
          const uploadError = new Error('Cloudinary upload failed');
          uploadError.cause = error;
          uploadError.http_code = error.http_code;
          uploadError.code = error.code;
          reject(uploadError);
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary upload returned no result'));
          return;
        }
        if (!result.secure_url || !result.secure_url.startsWith('https://')) {
          reject(new Error('Cloudinary upload did not return a secure URL'));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type || activeResourceType,
          assetId: result.asset_id,
          secureUrl: result.secure_url,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    stream.end(buffer);
  });
};

const deleteAsset = async ({ publicId, resourceType = 'image' }) => {
  if (!publicId) return false;

  const client = getCloudinaryConfig();
  let result;
  try {
    result = await client.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch {
    throw new Error('Cloudinary asset deletion failed');
  }
  if (result?.result !== 'ok' && result?.result !== 'not found') {
    throw new Error('Cloudinary asset deletion was not confirmed');
  }
  return result?.result === 'ok';
};

module.exports = {
  isConfigured,
  getCloudinaryConfig,
  getSafeConfigSummary,
  verifyConnection,
  resolveResourceType,
  uploadBuffer,
  deleteAsset,
};
