import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import authConfig from '../../../backend/services/authConfig.js';

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe('authConfig', () => {
  it('requires an explicitly configured JWT secret', () => {
    delete process.env.JWT_SECRET;
    expect(() => authConfig.getJwtSecret()).toThrow('JWT_SECRET must be configured');
  });

  it('uses the configured JWT secret for signing and verification', () => {
    process.env.JWT_SECRET = 'test-secret-for-auth-config';
    const token = jwt.sign({ uid: 'test-user', sid: 'test-session' }, authConfig.getJwtSecret());

    expect(jwt.verify(token, authConfig.getJwtSecret())).toMatchObject({
      uid: 'test-user',
      sid: 'test-session',
    });
    expect(() => jwt.verify(token, 'different-test-secret')).toThrow();
  });

  it('rejects expired JWTs', () => {
    process.env.JWT_SECRET = 'test-secret-for-auth-config';
    const token = jwt.sign({ uid: 'test-user', sid: 'test-session' }, authConfig.getJwtSecret(), { expiresIn: -1 });

    expect(() => jwt.verify(token, authConfig.getJwtSecret())).toThrow('jwt expired');
  });
});
