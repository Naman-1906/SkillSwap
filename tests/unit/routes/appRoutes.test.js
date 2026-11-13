import { describe, expect, it } from 'vitest';
import { buildPath, parseLocation } from '../../../frontend/src/routes/appRoutes.js';

describe('group invitation routes', () => {
  const token = 'a'.repeat(64);

  it('builds a URL that retains the invitation token', () => {
    expect(buildPath('invite', { inviteToken: token })).toBe(`/invite/${token}`);
  });

  it('parses an invitation URL for the invite view', () => {
    expect(parseLocation({ pathname: `/invite/${token}`, search: '' })).toMatchObject({
      view: 'invite',
      inviteToken: token,
      chatUserId: null,
    });
  });

  it('does not treat an auth return destination as an invitation route', () => {
    const route = parseLocation({ pathname: '/auth', search: `?returnTo=%2Finvite%2F${token}` });
    expect(route.view).toBe('auth');
    expect(route).not.toHaveProperty('inviteToken');
  });
});
