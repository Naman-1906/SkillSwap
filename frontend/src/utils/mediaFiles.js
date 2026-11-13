const MEDIA_MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
});

const ATTACHMENT_MIMES_BY_EXTENSION = Object.freeze({
  pdf: ['application/pdf'],
  txt: ['text/plain'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  rar: ['application/vnd.rar', 'application/x-rar-compressed'],
});

const normalizeMime = (mimeType) => {
  if (typeof mimeType !== 'string') return '';
  const normalized = mimeType.toLowerCase().split(';', 1)[0].trim();
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
};

export function getMediaFileError(file, { allowAttachments = true, allowArchives = true } = {}) {
  if (!file || typeof file.name !== 'string') return 'Select a file to upload.';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const declaredMime = normalizeMime(file.type);
  const expectedMime = MEDIA_MIME_BY_EXTENSION[extension];

  if (expectedMime) {
    if (!declaredMime || declaredMime === 'application/octet-stream' || declaredMime === expectedMime) return '';
    return expectedMime.startsWith('image/')
      ? 'Unsupported image format. Please upload JPG, PNG, WEBP or GIF.'
      : 'Unsupported video format. Please upload MP4 or WebM.';
  }

  if (declaredMime.startsWith('image/')) return 'Unsupported image format. Please upload JPG, PNG, WEBP or GIF.';
  if (declaredMime.startsWith('video/')) return 'Unsupported video format. Please upload MP4 or WebM.';
  if (!allowAttachments) return 'Unsupported file format.';

  const attachmentMimeTypes = ATTACHMENT_MIMES_BY_EXTENSION[extension];
  if (!attachmentMimeTypes || (!allowArchives && ['zip', 'rar'].includes(extension))) {
    return 'Unsupported attachment format.';
  }
  if (declaredMime && declaredMime !== 'application/octet-stream' && !attachmentMimeTypes.includes(declaredMime)) {
    return 'Unsupported attachment format.';
  }
  return '';
}
