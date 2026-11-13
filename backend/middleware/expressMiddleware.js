const process = require('node:process');
const {
  validateStudent,
  validateStudentId,
  validateApiKey,
  validateQueryParams
} = require('./schemas');

function validateStudentBody(method = 'POST') {
  return (req, res, next) => {
    const validation = validateStudent(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid student data for ${method}`,
        details: validation.errors
      });
    }

    req.validatedData = validation.data;
    next();
  };
}

function validateStudentIdParam() {
  return (req, res, next) => {
    const validation = validateStudentId(req.params.id);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid student ID parameter',
        details: [validation.error]
      });
    }

    req.validatedId = validation.id;
    next();
  };
}

function requireApiKey() {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validation = validateApiKey(apiKey, process.env.EXPRESS_DEMO_API_KEY);

    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        details: [validation.error]
      });
    }

    next();
  };
}

function validateQueryString() {
  return (req, res, next) => {
    const validation = validateQueryParams(req.query);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.errors
      });
    }

    req.validatedQuery = { skip: validation.skip };
    next();
  };
}

function requestSizeLimit(sizeLimit = '10kb') {
  return (req, res, next) => {
    const contentLength = req.get('content-length');
    
    if (!contentLength) {
      return next();
    }

    const limits = {
      '1kb': 1024,
      '10kb': 10 * 1024,
      '100kb': 100 * 1024,
      '1mb': 1024 * 1024
    };

    const limitBytes = limits[sizeLimit] || limits['10kb'];
    const contentBytes = Number(contentLength);

    if (contentBytes > limitBytes) {
      return res.status(413).json({
        success: false,
        error: 'Payload too large',
        details: [`Request size exceeds ${sizeLimit} limit`]
      });
    }

    next();
  };
}

function errorHandler() {
  return (err, req, res, _next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
      details: err.details || []
    });
  };
}

module.exports = {
  validateStudentBody,
  validateStudentIdParam,
  requireApiKey,
  validateQueryString,
  requestSizeLimit,
  errorHandler
};
