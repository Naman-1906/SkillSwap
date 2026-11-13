import { describe, expect, it } from 'vitest';
import {
  validateApiKey,
  validateMessage,
  validateQueryParams,
  validateRegister,
  validateStudent,
  validateStudentId,
} from '../../../backend/middleware/schemas.js';

describe('validateStudent', () => {
  it('trims and returns valid student data', () => {
    expect(validateStudent({ name: '  Asha  ', course: '  Math  ' })).toEqual({
      valid: true,
      errors: [],
      data: { name: 'Asha', course: 'Math' },
    });
  });

  it('returns all field errors for an invalid student', () => {
    const result = validateStudent({ name: '   ', course: 42 });

    expect(result.valid).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors).toEqual([
      'Name cannot be empty',
      'Course is required and must be a string',
    ]);
  });
});

describe('validateStudentId', () => {
  it('accepts positive integer strings', () => {
    expect(validateStudentId('7')).toEqual({ valid: true, id: 7 });
  });

  it('rejects non-integer and non-positive ids', () => {
    expect(validateStudentId('2.5')).toEqual({
      valid: false,
      error: 'Student ID must be an integer',
    });
    expect(validateStudentId('0')).toEqual({
      valid: false,
      error: 'Student ID must be a positive number',
    });
  });
});

describe('validateApiKey', () => {
  it('accepts the configured key', () => {
    expect(validateApiKey('unit-test-key', 'unit-test-key')).toEqual({ valid: true });
  });

  it('rejects missing and invalid keys', () => {
    expect(validateApiKey()).toEqual({
      valid: false,
      error: 'API key is required in x-api-key header',
    });
    expect(validateApiKey('wrong', 'unit-test-key')).toEqual({
      valid: false,
      error: 'Invalid API key',
    });
  });
});

describe('validateRegister', () => {
  it('normalizes user registration payloads', () => {
    expect(validateRegister({ userId: '  user-1  ' })).toEqual({
      valid: true,
      errors: [],
      userId: 'user-1',
      following: [],
      followers: [],
    });
  });

  it('rejects invalid relationship lists', () => {
    const result = validateRegister({
      userId: 'user-1',
      following: 'user-2',
      followers: {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'following must be an array',
      'followers must be an array',
    ]);
  });
});

describe('validateMessage', () => {
  it('trims message fields and adds a timestamp', () => {
    const result = validateMessage({
      from: '  sender  ',
      to: '  recipient  ',
      text: '  hello  ',
      threadId: ' thread-1 ',
    });

    expect(result.valid).toBe(true);
    expect(result.message).toMatchObject({
      from: 'sender',
      to: 'recipient',
      text: 'hello',
      threadId: 'thread-1',
    });
    expect(result.message.timestamp).toBeInstanceOf(Date);
  });

  it('rejects blank message text', () => {
    const result = validateMessage({
      from: 'sender',
      to: 'recipient',
      text: '   ',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBeNull();
    expect(result.errors).toContain('text (message) cannot be empty');
  });
});

describe('validateQueryParams', () => {
  it('defaults skip to zero', () => {
    expect(validateQueryParams({})).toEqual({
      valid: true,
      errors: [],
      skip: 0,
    });
  });

  it('parses valid skip values and rejects negative values', () => {
    expect(validateQueryParams({ skip: '10' })).toEqual({
      valid: true,
      errors: [],
      skip: 10,
    });
    expect(validateQueryParams({ skip: '-1' })).toEqual({
      valid: false,
      errors: ['skip parameter must be a non-negative number'],
      skip: -1,
    });
  });
});
