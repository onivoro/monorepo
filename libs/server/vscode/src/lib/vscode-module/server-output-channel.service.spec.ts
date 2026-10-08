import { ServerOutputChannelService } from './server-output-channel.service';

describe(ServerOutputChannelService.name, () => {
  const channel = {
    appendLine: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
  };
  const createOutputChannel = jest.fn(() => channel);
  const api = { window: { createOutputChannel } } as never;
  const timestamp = '2026-01-02T03:04:05.678Z';
  const formatted = new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  beforeEach(() => jest.clearAllMocks());

  const create = (
    config?: ConstructorParameters<typeof ServerOutputChannelService>[1],
  ) => {
    const service = new ServerOutputChannelService(api, config);
    service.onModuleInit();
    return service;
  };

  it('is a no-op before init', () => {
    const service = new ServerOutputChannelService(api);
    service.appendLog({ level: 'info', message: 'x', timestamp });
    service.appendLine('x');
    service.clear();
    service.show();
    service.hide();
    service.onModuleDestroy();
    expect(service.getChannel()).toBeNull();
    expect(channel.appendLine).not.toHaveBeenCalled();
  });

  it('creates a channel with the default name', () => {
    const service = create();
    expect(createOutputChannel).toHaveBeenCalledWith('Server');
    expect(service.getChannel()).toBe(channel);
  });

  it('uses a custom channel name', () => {
    create({ channelName: 'My Server' });
    expect(createOutputChannel).toHaveBeenCalledWith('My Server');
  });

  it.each([
    ['debug', '[DEBUG]'],
    ['info', '[INFO] '],
    ['warn', '[WARN] '],
    ['error', '[ERROR]'],
    ['trace', '[LOG]  '],
  ])('formats %s logs', (level, label) => {
    const service = create();
    service.appendLog({ level: level as never, message: 'hello', timestamp });
    expect(channel.appendLine).toHaveBeenCalledWith(
      `${formatted} ${label} hello`,
    );
  });

  it('auto-shows on error by default, preserving focus', () => {
    const service = create();
    service.appendLog({ level: 'error', message: 'bad', timestamp });
    expect(channel.show).toHaveBeenCalledWith(true);
  });

  it('does not auto-show when showOnError is false', () => {
    const service = create({ channelName: 'c', showOnError: false });
    service.appendLog({ level: 'error', message: 'bad', timestamp });
    expect(channel.show).not.toHaveBeenCalled();
  });

  it('filters logs below minLevel', () => {
    const service = create({ channelName: 'c', minLevel: 'warn' });
    service.appendLog({ level: 'info', message: 'skip', timestamp });
    service.appendLog({ level: 'debug', message: 'skip', timestamp });
    service.appendLog({ level: 'warn', message: 'keep', timestamp });
    expect(channel.appendLine).toHaveBeenCalledTimes(1);
    expect(channel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('keep'),
    );
  });

  it('falls back to the raw timestamp when formatting throws', () => {
    const service = create();
    const spy = jest
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockImplementation(() => {
        throw new RangeError('bad');
      });
    try {
      service.appendLog({ level: 'info', message: 'm', timestamp: 'raw-ts' });
    } finally {
      spy.mockRestore();
    }
    expect(channel.appendLine).toHaveBeenCalledWith('raw-ts [INFO]  m');
  });

  it('delegates appendLine, clear, show and hide', () => {
    const service = create();
    service.appendLine('raw');
    service.clear();
    service.show();
    service.show(false);
    service.hide();
    expect(channel.appendLine).toHaveBeenCalledWith('raw');
    expect(channel.clear).toHaveBeenCalled();
    expect(channel.show.mock.calls).toEqual([[true], [false]]);
    expect(channel.hide).toHaveBeenCalled();
  });

  it('disposes the channel on destroy', () => {
    const service = create();
    service.onModuleDestroy();
    expect(channel.dispose).toHaveBeenCalledTimes(1);
    expect(service.getChannel()).toBeNull();
  });
});
