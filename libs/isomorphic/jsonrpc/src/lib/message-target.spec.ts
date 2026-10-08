import {
  isMessageTarget,
  MESSAGE_TARGETS,
  MessageTarget,
} from './message-target';

describe('MessageTarget', () => {
  it('lists every target in MESSAGE_TARGETS', () => {
    expect([...MESSAGE_TARGETS].sort()).toEqual(
      Object.values(MessageTarget).sort(),
    );
    expect(MESSAGE_TARGETS).toEqual([
      'server',
      'webview',
      'extension',
      'broadcast',
    ]);
  });
});

describe('isMessageTarget', () => {
  it.each(['server', 'webview', 'extension', 'broadcast'])(
    'accepts %s',
    (value) => {
      expect(isMessageTarget(value)).toBe(true);
    },
  );

  it.each(['', 'Server', 'SERVER', 'client', 'server.health', ' server'])(
    'rejects %p',
    (value) => {
      expect(isMessageTarget(value)).toBe(false);
    },
  );
});
