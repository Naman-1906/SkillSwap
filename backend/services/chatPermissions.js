const canDeleteMessageForEveryone = (conversation, message, userId) => {
  if (!conversation || !message || !userId ||
      !Array.isArray(conversation.participants) ||
      !conversation.participants.includes(userId)) {
    return false;
  }

  if (message.authorId === userId) return true;

  return conversation.type === 'group' &&
    conversation.group?.adminId === userId &&
    conversation.participants.includes(conversation.group.adminId);
};

module.exports = { canDeleteMessageForEveryone };
