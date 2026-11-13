


function validateStudent(data) {
  const errors = [];

  if (!data) {
    errors.push('Request body is required');
    return { valid: false, errors };
  }


  if (!data.name || typeof data.name !== 'string') {
    errors.push('Name is required and must be a string');
  } else if (data.name.trim().length === 0) {
    errors.push('Name cannot be empty');
  } else if (data.name.length > 100) {
    errors.push('Name must not exceed 100 characters');
  }


  if (!data.course || typeof data.course !== 'string') {
    errors.push('Course is required and must be a string');
  } else if (data.course.trim().length === 0) {
    errors.push('Course cannot be empty');
  } else if (data.course.length > 100) {
    errors.push('Course must not exceed 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? { name: data.name.trim(), course: data.course.trim() } : null
  };
}


function validateStudentId(id) {
  const numId = Number(id);

  if (isNaN(numId) || numId <= 0) {
    return { valid: false, error: 'Student ID must be a positive number' };
  }

  if (!Number.isInteger(numId)) {
    return { valid: false, error: 'Student ID must be an integer' };
  }

  return { valid: true, id: numId };
}


function validateApiKey(apiKey, configuredKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required in x-api-key header' };
  }

  if (!configuredKey || apiKey !== configuredKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}


function validateRegister(data) {
  const errors = [];

  if (!data) {
    errors.push('Registration data is required');
    return { valid: false, errors };
  }

  if (!data.userId || typeof data.userId !== 'string') {
    errors.push('userId is required and must be a string');
  } else if (data.userId.trim().length === 0) {
    errors.push('userId cannot be empty');
  } else if (data.userId.length > 100) {
    errors.push('userId must not exceed 100 characters');
  }


  const following = Array.isArray(data.following) ? data.following : [];
  if (!Array.isArray(data.following) && data.following !== undefined && data.following !== null) {
    errors.push('following must be an array');
  }


  const followers = Array.isArray(data.followers) ? data.followers : [];
  if (!Array.isArray(data.followers) && data.followers !== undefined && data.followers !== null) {
    errors.push('followers must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    userId: errors.length === 0 ? data.userId.trim() : null,
    following: errors.length === 0 ? following : [],
    followers: errors.length === 0 ? followers : []
  };
}


function validateMessage(data) {
  const errors = [];
  const maxMessageLength = 5000;

  if (!data) {
    errors.push('Message data is required');
    return { valid: false, errors };
  }


  if (!data.from || typeof data.from !== 'string') {
    errors.push('from (sender) is required and must be a string');
  } else if (data.from.trim().length === 0) {
    errors.push('from (sender) cannot be empty');
  } else if (data.from.length > 100) {
    errors.push('from (sender) must not exceed 100 characters');
  }


  if (!data.to || typeof data.to !== 'string') {
    errors.push('to (recipient) is required and must be a string');
  } else if (data.to.trim().length === 0) {
    errors.push('to (recipient) cannot be empty');
  } else if (data.to.length > 100) {
    errors.push('to (recipient) must not exceed 100 characters');
  }


  const text = typeof data.text === 'string' ? data.text : '';
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];

  if (text.trim().length === 0 && attachments.length === 0) {
    errors.push('text (message) cannot be empty');
  } else if (text.length > maxMessageLength) {
    errors.push(`text (message) must not exceed ${maxMessageLength} characters`);
  }

  if (attachments.length > 0) {
    const sanitizedAttachments = attachments.filter((attachment) => attachment && typeof attachment === 'object');
    if (sanitizedAttachments.length !== attachments.length) {
      errors.push('attachments must be an array of valid objects');
    }

    if (sanitizedAttachments.length > 6) {
      errors.push('attachments cannot exceed 6 files per message');
    }
  }

  if (data.threadId !== undefined && data.threadId !== null) {
    if (typeof data.threadId !== 'string') {
      errors.push('threadId must be a string');
    } else if (data.threadId.length > 100) {
      errors.push('threadId must not exceed 100 characters');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    message: errors.length === 0 ? {
      from: data.from.trim(),
      to: data.to.trim(),
      text: text.trim(),
      threadId: data.threadId ? String(data.threadId).trim() : null,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      timestamp: new Date(),
    } : null
  };
}


function validateQueryParams(query) {
  const errors = [];

  if (query.skip) {
    const skip = Number(query.skip);
    if (isNaN(skip) || skip < 0) {
      errors.push('skip parameter must be a non-negative number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    skip: query.skip ? Number(query.skip) : 0
  };
}

module.exports = {
  validateStudent,
  validateStudentId,
  validateApiKey,
  validateRegister,
  validateMessage,
  validateQueryParams
};
