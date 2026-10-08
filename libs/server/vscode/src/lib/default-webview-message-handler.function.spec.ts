import { defaultWebviewMessageHandler } from './default-webview-message-handler.function';

describe(defaultWebviewMessageHandler.name, () => {
  const make = () => {
    const serverProcess = { sendRequest: jest.fn() };
    const webviewProvider = { postMessage: jest.fn() };
    return {
      serverProcess,
      webviewProvider,
      context: { serverProcess, webviewProvider } as never,
    };
  };

  it('forwards the request to the server and posts the result', async () => {
    const { serverProcess, webviewProvider, context } = make();
    serverProcess.sendRequest.mockResolvedValue({ ok: true });

    await defaultWebviewMessageHandler(
      { jsonrpc: '2.0', id: 7, method: 'do', params: { a: 1 } },
      context,
    );

    expect(serverProcess.sendRequest).toHaveBeenCalledWith('do', { a: 1 });
    expect(webviewProvider.postMessage).toHaveBeenCalledWith({
      id: 7,
      result: { ok: true },
    });
  });

  it('posts the error message when the server rejects with an Error', async () => {
    const { serverProcess, webviewProvider, context } = make();
    serverProcess.sendRequest.mockRejectedValue(new Error('boom'));

    await defaultWebviewMessageHandler(
      { jsonrpc: '2.0', id: 1, method: 'do' },
      context,
    );

    expect(webviewProvider.postMessage).toHaveBeenCalledWith({
      id: 1,
      error: 'boom',
    });
  });

  it('posts "Unknown error" for non-Error rejections', async () => {
    const { serverProcess, webviewProvider, context } = make();
    serverProcess.sendRequest.mockRejectedValue('nope');

    await defaultWebviewMessageHandler(
      { jsonrpc: '2.0', id: 2, method: 'do' },
      context,
    );

    expect(webviewProvider.postMessage).toHaveBeenCalledWith({
      id: 2,
      error: 'Unknown error',
    });
  });

  it('does nothing when the message has no method', async () => {
    const { serverProcess, webviewProvider, context } = make();

    await defaultWebviewMessageHandler(
      { jsonrpc: '2.0', id: 3 } as never,
      context,
    );

    expect(serverProcess.sendRequest).not.toHaveBeenCalled();
    expect(webviewProvider.postMessage).not.toHaveBeenCalled();
  });
});
