const classifyMediaDeleteAccess = (metadata, userId) => {
  const ownerId = metadata?.metadata?.ownerId;
  if (typeof ownerId !== 'string' || !ownerId.trim()) {
    return {
      status: 404,
      message: 'Media not found',
    };
  }

  if (ownerId !== String(userId || '')) {
    return {
      status: 403,
      message: 'You cannot delete another user’s media',
    };
  }

  return null;
};

module.exports = classifyMediaDeleteAccess;
