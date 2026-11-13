import { describe, expect, it } from 'vitest';
import { resolveServiceUrl } from '../../../frontend/src/services/backend.js';

describe('backend service URL configuration', () => {
  it('uses the current hosted origin instead of a localhost build-time URL in production', () => {
    expect(resolveServiceUrl('http://localhost:5000', true, 'https://skillswap.example'))
      .toBe('https://skillswap.example');
  });

  it('preserves a configured hosted backend URL in production', () => {
    expect(resolveServiceUrl('https://api.skillswap.example', true, 'https://skillswap.example'))
      .toBe('https://api.skillswap.example');
  });

  it('preserves localhost API URLs during development', () => {
    expect(resolveServiceUrl('http://localhost:5000', false, 'http://localhost:5000'))
      .toBe('http://localhost:5000');
  });
});
