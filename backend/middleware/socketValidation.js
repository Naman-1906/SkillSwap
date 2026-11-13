

const { validateRegister, validateMessage } = require('./schemas');


function sendValidationError(socket, eventName, errors) {
  socket.emit('error:validation', {
    event: eventName,
    success: false,
    errors
  });
  console.log(`[Socket Validation Error] ${eventName}:`, errors);
}


function handleRegisterValidation(socket, data) {
  const validation = validateRegister(data);

  if (!validation.valid) {
    sendValidationError(socket, 'register', validation.errors);
    return null;
  }

  return {
    userId: validation.userId,
    following: validation.following || [],
    followers: validation.followers || []
  };
}


function handleMessageValidation(socket, data) {
  const validation = validateMessage(data);

  if (!validation.valid) {
    sendValidationError(socket, 'message:send', validation.errors);
    return null;
  }

  return validation.message;
}

module.exports = {
  sendValidationError,
  handleRegisterValidation,
  handleMessageValidation
};
