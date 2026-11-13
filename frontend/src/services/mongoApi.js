import { apiBaseUrl } from './backend';

const CURRENT_USER_KEY = 'clustr:current-user';
const TOKEN_KEY = 'clustr:token';
const PENDING_LOGOUT_KEY = 'clustr:logout-pending';
const USERS_CHANGED_EVENT = 'clustr:users-changed';
const CONVERSATIONS_CHANGED_EVENT = 'clustr:conversations-changed';
const AUTH_CHANGED_EVENT = 'clustr:auth-changed';

const buildUrl = (path = '') => `${apiBaseUrl}${path}`;

export function readCurrentUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(CURRENT_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeCurrentUser(user) {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }
  window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function readToken() {
  if (typeof window === 'undefined') return '';
  window.localStorage.removeItem(TOKEN_KEY);
  return '';
}

export function writeToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthState() {
  writeCurrentUser(null);
  writeToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { loggedOut: true } }));
  }
}

async function postLogout() {
  const response = await fetch(buildUrl('/api/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok && response.status !== 401) {
    throw new Error(`Logout request failed (${response.status}).`);
  }
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_LOGOUT_KEY);
  }
}

export async function logoutUser() {
  clearAuthState();
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(PENDING_LOGOUT_KEY, 'true');
  try {
    await postLogout();
  } catch (error) {
    throw new Error('You have been logged out on this page, but the server could not confirm session revocation. Reconnect to finish logging out.', { cause: error });
  }
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      message = response.statusText || message;
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function getAuthSession() {
  writeToken();
  if (typeof window !== 'undefined' && window.localStorage.getItem(PENDING_LOGOUT_KEY)) {
    await postLogout();
  }

  try {
    const data = await request('/api/auth/session');
    return data.user;
  } catch (error) {
    if (error.status === 401) clearAuthState();
    throw error;
  }
}

export async function loginUser(email, password) {
  const data = await request('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_LOGOUT_KEY);
  }
  writeCurrentUser(data.user);
  writeToken();
  notifyUsersChanged();
  return data.user;
}

export async function signupUser(name, email, password) {
  const data = await request('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PENDING_LOGOUT_KEY);
  }
  writeCurrentUser(data.user);
  writeToken();
  notifyUsersChanged();
  return data.user;
}

export async function fetchUsers() {
  return request('/api/users');
}

export async function updateUser(uid, updates) {
  const updated = await request(`/api/users/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  const current = readCurrentUser();
  if (current?.uid === updated.uid) {
    writeCurrentUser({ ...current, ...updated });
  }
  notifyUsersChanged();
  return updated;
}

export async function toggleFollow(uid, targetUid) {
  const data = await request(`/api/users/${uid}/follow/${targetUid}`, { method: 'POST' });
  const current = readCurrentUser();
  const updatedCurrent = data.users?.find((item) => item.uid === current?.uid);
  if (updatedCurrent) writeCurrentUser({ ...current, ...updatedCurrent });
  notifyUsersChanged();
  return data.users || [];
}

export async function toggleSavedPost(uid, postId) {
  const updated = await request(`/api/users/${uid}/saved-posts/${postId}`, { method: 'POST' });
  const current = readCurrentUser();
  if (current?.uid === updated.uid) writeCurrentUser({ ...current, ...updated });
  notifyUsersChanged();
  return updated;
}

export async function fetchConversations(uid) {
  return request(`/api/conversations/${uid}`);
}

export async function saveConversation(thread) {
  return request(`/api/conversations/${thread.id}`, {
    method: 'PUT',
    body: JSON.stringify(thread),
  });
}

export async function deleteConversation(id) {
  return request(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function deleteMessagesForMe(conversationId, messageIds) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages/delete-for-me`, {
    method: 'POST',
    body: JSON.stringify({ messageIds }),
  });
}

export async function deleteMessageForEveryone(conversationId, messageId) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/delete-for-everyone`, {
    method: 'POST',
  });
}

export async function clearConversationForMe(conversationId, requestId) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/clear-for-me`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
}

export async function createGroupConversation(name, participantIds) {
  return request('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, participantIds }),
  });
}

export async function updateGroupConversation(groupId, name) {
  return request(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function addGroupParticipant(groupId, participantId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ participantId }),
  });
}

export async function removeGroupParticipant(groupId, participantId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(participantId)}`, {
    method: 'DELETE',
  });
}

export async function createGroupInvitation(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/invitation`, {
    method: 'POST',
  });
}

export async function revokeGroupInvitation(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/invitation`, {
    method: 'DELETE',
  });
}

export async function getGroupInvitation(token) {
  return request(`/api/group-invitations/${encodeURIComponent(token)}`);
}

export async function joinGroupInvitation(token) {
  return request(`/api/group-invitations/${encodeURIComponent(token)}/join`, {
    method: 'POST',
  });
}

export async function forwardMessage(conversationId, messageId, recipientIds) {
  return request(`/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/forward`, {
    method: 'POST',
    body: JSON.stringify({ recipientIds }),
  });
}

export function notifyUsersChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USERS_CHANGED_EVENT));
  }
}

export function subscribeToUsersChanged(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(USERS_CHANGED_EVENT, callback);
  return () => window.removeEventListener(USERS_CHANGED_EVENT, callback);
}

export function notifyConversationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONVERSATIONS_CHANGED_EVENT));
  }
}

export function subscribeToConversationsChanged(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONVERSATIONS_CHANGED_EVENT, callback);
  return () => window.removeEventListener(CONVERSATIONS_CHANGED_EVENT, callback);
}
