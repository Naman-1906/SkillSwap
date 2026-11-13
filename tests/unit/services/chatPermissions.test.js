import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canDeleteMessageForEveryone } = require('../../../backend/services/chatPermissions.js');

describe('canDeleteMessageForEveryone', () => {
  const directConversation = { type: 'direct', participants: ['sender', 'recipient'] };
  const message = { id: 'message-1', authorId: 'sender' };

  it('allows the sender to delete their own direct message', () => {
    expect(canDeleteMessageForEveryone(directConversation, message, 'sender')).toBe(true);
  });

  it('does not allow a direct-message recipient to delete another person\'s message', () => {
    expect(canDeleteMessageForEveryone(directConversation, message, 'recipient')).toBe(false);
  });

  it('allows the sender or current admin to delete a group message', () => {
    const group = {
      type: 'group',
      participants: ['sender', 'admin', 'member'],
      group: { adminId: 'admin' },
    };
    expect(canDeleteMessageForEveryone(group, message, 'sender')).toBe(true);
    expect(canDeleteMessageForEveryone(group, message, 'admin')).toBe(true);
  });

  it('does not allow a non-admin group participant to delete another member’s message', () => {
    const group = {
      type: 'group',
      participants: ['sender', 'admin', 'member'],
      group: { adminId: 'admin' },
    };
    expect(canDeleteMessageForEveryone(group, message, 'member')).toBe(false);
  });

  it('does not grant deletion to nonparticipants or an admin no longer in the group', () => {
    const group = {
      type: 'group',
      participants: ['sender', 'member'],
      group: { adminId: 'admin' },
    };
    expect(canDeleteMessageForEveryone(group, message, 'admin')).toBe(false);
    expect(canDeleteMessageForEveryone(group, message, 'outsider')).toBe(false);
    expect(canDeleteMessageForEveryone(group, null, 'sender')).toBe(false);
  });
});
