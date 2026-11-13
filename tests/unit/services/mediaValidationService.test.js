import { afterEach, describe, expect, it, vi } from 'vitest';
import validationService from '../../../backend/services/mediaValidationService.js';
import mediaStorageService from '../../../backend/services/mediaStorageService.js';
import cloudinaryStorageService from '../../../backend/services/cloudinaryStorageService.js';

const uint32 = (value) => Buffer.from([
  value >>> 24,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
]);

const fixtures = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  png: Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    uint32(13), Buffer.from('IHDR'), uint32(1), uint32(1),
    Buffer.from([8, 2, 0, 0, 0, 0, 0, 0, 0]),
    uint32(0), Buffer.from('IEND'),
  ]),
  gif: Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(16)]),
  webp: Buffer.concat([Buffer.from('RIFF'), uint32(22), Buffer.from('WEBPVP8 '), uint32(10), Buffer.alloc(10)]),
  mp4: Buffer.concat([uint32(24), Buffer.from('ftypisom'), uint32(0), Buffer.from('isom')]),
  webm: Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d4287810242858102', 'hex'),
  pdf: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64)]),
};

const formatCases = [
  ['photo.JPG', 'image/jpeg', 'image'],
  ['photo.jpeg', 'image/jpeg; charset=binary', 'image'],
  ['photo.png', 'image/png', 'image'],
  ['photo.gif', 'image/gif', 'image'],
  ['photo.webp', 'image/webp', 'image'],
  ['clip.mp4', 'video/mp4', 'video'],
  ['clip.webm', 'video/webm', 'video'],
];

const savedImageLimit = process.env.MAX_IMAGE_SIZE_MB;
const savedVideoLimit = process.env.MAX_VIDEO_SIZE_MB;
const savedServerUrl = process.env.SERVER_URL;
const savedCloudinaryEnvironment = Object.fromEntries(
  ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_DEFAULT_FOLDER']
    .map((key) => [key, process.env[key]]),
);

afterEach(() => {
  vi.restoreAllMocks();
  if (savedImageLimit === undefined) delete process.env.MAX_IMAGE_SIZE_MB;
  else process.env.MAX_IMAGE_SIZE_MB = savedImageLimit;
  if (savedVideoLimit === undefined) delete process.env.MAX_VIDEO_SIZE_MB;
  else process.env.MAX_VIDEO_SIZE_MB = savedVideoLimit;
  if (savedServerUrl === undefined) delete process.env.SERVER_URL;
  else process.env.SERVER_URL = savedServerUrl;
  for (const [key, value] of Object.entries(savedCloudinaryEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('mediaValidationService', () => {
  it('keeps shared conversation media while any participant can still see the message', () => {
    const ids = mediaStorageService.getConversationReferencedIds({
      participants: ['sender', 'recipient'],
      deletedFor: ['sender'],
      messages: [{ attachments: [{ mediaId: 'shared-media' }], hiddenFor: [] }],
    });
    expect(ids.has('shared-media')).toBe(true);
  });

  it('releases conversation media references only after every participant hides the chat', () => {
    const ids = mediaStorageService.getConversationReferencedIds({
      participants: ['sender', 'recipient'],
      deletedFor: ['sender', 'recipient'],
      messages: [{ attachments: [{ mediaId: 'shared-media' }], hiddenFor: [] }],
    });
    expect(ids.has('shared-media')).toBe(false);
  });

  it('builds media URLs from the current backend deployment origin', () => {
    process.env.SERVER_URL = 'https://backend.example/';
    expect(mediaStorageService.buildMediaUrl('507f1f77bcf86cd799439011'))
      .toBe('https://backend.example/api/media/507f1f77bcf86cd799439011');
  });

  it('keeps legacy media IDs on the backend media route when Cloudinary is configured', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    process.env.SERVER_URL = 'https://backend.example/';
    expect(mediaStorageService.buildMediaUrl('507f1f77bcf86cd799439011'))
      .toBe('https://backend.example/api/media/507f1f77bcf86cd799439011');
  });

  it('preserves the extension on Cloudinary raw asset IDs', () => {
    expect(mediaStorageService.getFileIdFromValue(
      'https://res.cloudinary.com/demo/raw/upload/v123/skillswap/raw/chat/notes.pdf',
    )).toBe('skillswap/raw/chat/notes.pdf');
  });

  it('uses the proper Cloudinary resource type for images, video, and documents', () => {
    expect(cloudinaryStorageService.resolveResourceType('image/jpeg', 'photo.jpg')).toBe('image');
    expect(cloudinaryStorageService.resolveResourceType('video/mp4', 'clip.mp4')).toBe('video');
    expect(cloudinaryStorageService.resolveResourceType('application/pdf', 'notes.pdf')).toBe('raw');
  });

  it('uploads video buffers as Cloudinary video resources and returns secure references', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    const client = cloudinaryStorageService.getCloudinaryConfig();
    const publicId = 'skillswap/video/test/video-fixture';
    const uploadStream = vi.spyOn(client.uploader, 'upload_stream').mockImplementation((options, callback) => ({
      end: (buffer) => {
        expect(buffer).toEqual(fixtures.mp4);
        callback(null, {
          secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/v1/video-fixture.mp4',
          public_id: publicId,
          resource_type: 'video',
          format: 'mp4',
          bytes: buffer.length,
        });
      },
    }));

    await expect(cloudinaryStorageService.uploadBuffer({
      buffer: fixtures.mp4,
      originalName: 'video-fixture.mp4',
      mimeType: 'video/mp4',
      publicId,
      resourceType: 'video',
    })).resolves.toMatchObject({
      secureUrl: 'https://res.cloudinary.com/test-cloud/video/upload/v1/video-fixture.mp4',
      publicId,
      resourceType: 'video',
      format: 'mp4',
    });
    expect(uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ public_id: publicId, resource_type: 'video' }),
      expect.any(Function),
    );
  });

  it('rejects uploads when Cloudinary is unavailable', async () => {
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      delete process.env[key];
    }
    await expect(mediaStorageService.uploadFromBuffer({
      buffer: fixtures.jpg,
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
    })).rejects.toThrow('Cloudinary is required for new media uploads');
  });

  it.each(formatCases)('accepts signature-matched %s media', async (name, mimeType, mediaType) => {
    const extension = name.toLowerCase().endsWith('.jpeg') ? 'jpg' : name.toLowerCase().split('.').pop();
    const buffer = fixtures[extension];
    const result = await validationService.validateUpload({ buffer, originalName: name, mimeType });
    expect(result).toMatchObject({ valid: true, mediaType });
  });

  it('normalizes an uppercase extension and MIME parameters, and permits a missing MIME header', async () => {
    await expect(validationService.validateMedia(fixtures.jpg, 'PHOTO.JPEG', 'image/jpeg; charset=binary'))
      .resolves.toMatchObject({ valid: true, mimeType: 'image/jpeg', extension: '.jpeg' });
    await expect(validationService.validateMedia(fixtures.jpg, 'photo.jpg', undefined))
      .resolves.toMatchObject({ valid: true, mimeType: 'image/jpeg' });
  });

  it('preserves authenticated chat/post document attachments with their existing allowlist', async () => {
    await expect(validationService.validateUpload({
      buffer: fixtures.pdf,
      originalName: 'notes.pdf',
      mimeType: 'application/pdf',
      allowAttachments: true,
    })).resolves.toMatchObject({ valid: true, mediaType: 'file', mimeType: 'application/pdf' });
    await expect(validationService.validateUpload({
      buffer: fixtures.pdf,
      originalName: 'notes.pdf',
      mimeType: 'application/pdf',
    })).resolves.toMatchObject({ valid: false, code: 'UNSUPPORTED_FILE_FORMAT' });
  });

  it('rejects executable signatures, mismatched extensions, and unsupported SVG', async () => {
    const executable = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128)]);
    await expect(validationService.validateMedia(executable, 'photo.jpg', 'image/jpeg'))
      .resolves.toMatchObject({ valid: false, code: 'INVALID_MEDIA_SIGNATURE' });
    await expect(validationService.validateMedia(fixtures.png, 'photo.jpg', 'image/jpeg'))
      .resolves.toMatchObject({ valid: false, code: 'INVALID_MEDIA_SIGNATURE' });
    await expect(validationService.validateMedia(Buffer.from('<svg/>'), 'image.svg', 'image/svg+xml'))
      .resolves.toMatchObject({ valid: false, code: 'UNSUPPORTED_MEDIA_EXTENSION' });
    for (const extension of ['exe', 'js', 'html', 'zip', 'pdf', 'heic', 'mov']) {
      await expect(validationService.validateMedia(Buffer.from('invalid'), `file.${extension}`, 'application/octet-stream'))
        .resolves.toMatchObject({ valid: false, code: 'UNSUPPORTED_MEDIA_EXTENSION' });
    }
  });

  it('rejects mismatched declared MIME and applies configurable image/video limits', async () => {
    await expect(validationService.validateMedia(fixtures.jpg, 'photo.jpg', 'image/png'))
      .resolves.toMatchObject({ valid: false, code: 'MEDIA_MIME_MISMATCH' });

    process.env.MAX_IMAGE_SIZE_MB = '1';
    process.env.MAX_VIDEO_SIZE_MB = '2';
    const oversizedImage = Buffer.concat([fixtures.jpg, Buffer.alloc(1024 * 1024)]);
    const oversizedVideo = Buffer.concat([fixtures.mp4, Buffer.alloc(2 * 1024 * 1024)]);
    await expect(validationService.validateMedia(oversizedImage, 'photo.jpg', 'image/jpeg'))
      .resolves.toMatchObject({ valid: false, code: 'MEDIA_TOO_LARGE', mediaType: 'image' });
    await expect(validationService.validateMedia(oversizedVideo, 'clip.mp4', 'video/mp4'))
      .resolves.toMatchObject({ valid: false, code: 'MEDIA_TOO_LARGE', mediaType: 'video' });
  });

  it('keeps chat media referenced while any participant can still see its message', () => {
    const conversation = {
      participants: ['alice', 'bob'],
      clearedAt: [],
      messages: [{
        createdAt: 100,
        attachments: [{ mediaId: 'media-1', url: '/api/media/media-1' }],
        hiddenFor: ['alice'],
      }],
    };
    expect(mediaStorageService.getConversationReferencedIds(conversation).has('media-1')).toBe(true);

    conversation.messages[0].hiddenFor.push('bob');
    expect(mediaStorageService.getConversationReferencedIds(conversation).has('media-1')).toBe(false);

    conversation.messages[0].hiddenFor = [];
    conversation.clearedAt = [{ userId: 'alice', timestamp: 101 }, { userId: 'bob', timestamp: 101 }];
    expect(mediaStorageService.getConversationReferencedIds(conversation).has('media-1')).toBe(false);

    conversation.messages = [{ attachments: [{ mediaId: 'legacy-media' }] }];
    expect(mediaStorageService.getConversationReferencedIds(conversation).has('legacy-media')).toBe(true);
  });
});
