import { ServerProcessService } from './server-process.service';

describe(ServerProcessService.name, () => {
  const server = {
    sendRequest: jest.fn(),
    onNotification: jest.fn(),
    getRegisteredNotifications: jest.fn(),
    isRunning: true,
  };
  const service = new ServerProcessService(server as never);

  it('delegates sendRequest with method, params and timeout', async () => {
    server.sendRequest.mockResolvedValue('r');
    await expect(service.sendRequest('m', { a: 1 }, 500)).resolves.toBe('r');
    expect(server.sendRequest).toHaveBeenCalledWith('m', { a: 1 }, 500);
  });

  it('propagates server errors', async () => {
    server.sendRequest.mockRejectedValue(new Error('down'));
    await expect(service.sendRequest('m')).rejects.toThrow('down');
  });

  it('exposes isRunning from the server process', () => {
    expect(service.isRunning).toBe(true);
    server.isRunning = false;
    expect(service.isRunning).toBe(false);
  });

  it('delegates onNotification and returns the unsubscribe function', () => {
    const unsub = jest.fn();
    server.onNotification.mockReturnValue(unsub);
    const handler = jest.fn();
    expect(service.onNotification('n', handler)).toBe(unsub);
    expect(server.onNotification).toHaveBeenCalledWith('n', handler);
  });

  it('delegates getRegisteredNotifications', () => {
    server.getRegisteredNotifications.mockReturnValue(['a', 'b']);
    expect(service.getRegisteredNotifications()).toEqual(['a', 'b']);
  });
});
