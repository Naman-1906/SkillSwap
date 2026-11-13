import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginUser, signupUser, updateUser } from '../../../frontend/src/services/mongoApi.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated API requests', () => {
  it('sends login requests with cookies and returns the backend user', async () => {
    const user = { uid: 'user-123', email: 'member@example.com' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, user }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginUser('member@example.com', 'password'))
      .resolves.toEqual(user);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users\/login$/), expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'member@example.com', password: 'password' }),
    }));
  });

  it('uses the authenticated uid for profile updates and includes cookies', async () => {
    const user = { uid: 'user/123', displayName: 'Member' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => user,
    });
    vi.stubGlobal('fetch', fetchMock);

    await updateUser(user.uid, { displayName: 'Member' });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users\/user%2F123$/), expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ displayName: 'Member' }),
    }));
  });

  it('preserves the backend duplicate-email error for signup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'That email is already in use.' }),
    }));

    await expect(signupUser('Member', 'member@example.com', 'password'))
      .rejects.toThrow('That email is already in use.');
  });
});
