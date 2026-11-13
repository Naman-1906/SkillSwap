import { apiBaseUrl } from './backend';
import { readToken } from './mongoApi';
import { getMediaFileError } from '../utils/mediaFiles';

const POSTS_CHANGED_EVENT = 'clustr:posts-changed';

const buildUrl = (path = '') => `${apiBaseUrl}${path}`;

async function request(path, options = {}) {
  const token = readToken();
  const response = await fetch(buildUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function fetchPosts() {
  const remotePosts = await request('/api/posts');
  return remotePosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function createPost(payload) {
  try {
    return await request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const ids = [payload.mediaId, payload.attachment?.mediaId].filter(Boolean);
    await Promise.all(ids.map((id) => deleteUploadedMedia(id).catch(() => {})));
    throw error;
  }
}

export async function uploadPostMedia(file) {
  const validationMessage = getMediaFileError(file, { allowAttachments: true, allowArchives: true });
  if (validationMessage) throw new Error(validationMessage);

  const formData = new FormData();
  formData.append('media', file);
  const token = readToken();

  const response = await fetch(buildUrl('/api/uploads/post-media'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = 'Media upload failed';
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function deleteUploadedMedia(fileId) {
  return request(`/api/media/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export async function updatePost(postId, updates) {
  return request(`/api/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deletePost(postId) {
  return request(`/api/posts/${postId}`, { method: 'DELETE' });
}

export function notifyPostsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(POSTS_CHANGED_EVENT));
  }
}

export function subscribeToPostsChanged(callback) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(POSTS_CHANGED_EVENT, callback);
  return () => window.removeEventListener(POSTS_CHANGED_EVENT, callback);
}
