const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) {
    const error = new Error('JWT_SECRET must be configured in the backend environment.');
    error.code = 'AUTH_CONFIG_MISSING';
    throw error;
  }
  return secret;
};

module.exports = { getJwtSecret };
