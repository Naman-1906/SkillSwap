import { describe, expect, it, vi } from 'vitest';
import {
  requireApiKey,
  requestSizeLimit,
  validateQueryString,
  validateStudentBody,
  validateStudentIdParam,
} from '../../../backend/middleware/expressMiddleware.js';

function createResponse() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };

  return res;
}

describe('validation middleware', () => {
  it('stores validated student data and calls next', () => {
    const req = { body: { name: '  Asha  ', course: '  Math  ' } };
    const res = createResponse();
    const next = vi.fn();

    validateStudentBody()(req, res, next);

    expect(req.validatedData).toEqual({ name: 'Asha', course: 'Math' });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds with 400 for invalid student body', () => {
    const req = { body: { name: '', course: 'Math' } };
    const res = createResponse();
    const next = vi.fn();

    validateStudentBody('POST')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid student data for POST',
      details: ['Name is required and must be a string'],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('stores validated student id', () => {
    const req = { params: { id: '12' } };
    const res = createResponse();
    const next = vi.fn();

    validateStudentIdParam()(req, res, next);

    expect(req.validatedId).toBe(12);
    expect(next).toHaveBeenCalledOnce();
  });

  it('requires the demo api key', () => {
    const req = { headers: { 'x-api-key': 'wrong' } };
    const res = createResponse();
    const next = vi.fn();

    requireApiKey()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication failed',
      details: ['Invalid API key'],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('stores validated query params', () => {
    const req = { query: { skip: '5' } };
    const res = createResponse();
    const next = vi.fn();

    validateQueryString()(req, res, next);

    expect(req.validatedQuery).toEqual({ skip: 5 });
    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks payloads larger than the configured limit', () => {
    const req = { get: vi.fn(() => String(11 * 1024)) };
    const res = createResponse();
    const next = vi.fn();

    requestSizeLimit('10kb')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Payload too large',
      details: ['Request size exceeds 10kb limit'],
    });
    expect(next).not.toHaveBeenCalled();
  });
});
