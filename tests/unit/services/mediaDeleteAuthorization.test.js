import { describe, expect, it } from 'vitest';
import classifyMediaDeleteAccess from '../../../backend/services/mediaDeleteAuthorization.js';

describe('media delete authorization', () => {
  it('returns 404 for missing metadata', () => {
    expect(classifyMediaDeleteAccess(null, 'owner-1')).toEqual({
      status: 404,
      message: 'Media not found',
    });
  });

  it('returns 404 for an untracked Cloudinary asset without an owner', () => {
    expect(classifyMediaDeleteAccess({
      metadata: { publicId: 'folder/image/asset', ownerId: '' },
    }, 'owner-1')).toEqual({
      status: 404,
      message: 'Media not found',
    });
  });

  it('continues to reject deletion by a different owner', () => {
    expect(classifyMediaDeleteAccess({
      metadata: { ownerId: 'owner-2' },
    }, 'owner-1')).toEqual({
      status: 403,
      message: 'You cannot delete another user’s media',
    });
  });

  it('allows the recorded owner to continue to the reference check', () => {
    expect(classifyMediaDeleteAccess({
      metadata: { ownerId: 'owner-1' },
    }, 'owner-1')).toBeNull();
  });
});
