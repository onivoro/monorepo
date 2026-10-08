import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MESSAGE_BUS } from '@onivoro/isomorphic-jsonrpc';
import { WebviewHandler } from '../decorators/webview-handler.decorator';
import { ServerNotificationHandler } from '../decorators/server-notification-handler.decorator';
import { ExtensionMessageBus } from '../extension-message-bus';
import { ServerNotificationHandlerRegistry } from '../server-notification-handler-registry';
import { WebviewHandlerRegistry } from '../webview-handler-registry';
import { ServerProcessService } from './server-process.service';
import { VscodeCommandsService } from './vscode-commands.service';
import {
  STDIO_SERVER_PROCESS,
  VSCODE_API,
  VSCODE_EXTENSION_CONTEXT,
  WEBVIEW_PROVIDER,
} from './vscode-injection-tokens';
import { VscodeModule } from './vscode.module';
import { VscodeWorkspaceService } from './vscode-workspace.service';

@Injectable()
class AppHandlers {
  @WebviewHandler('extension.hello')
  async hello(params: { name: string }) {
    return `hello ${params.name}`;
  }

  @ServerNotificationHandler('server.ping')
  ping() {}
}

@Injectable()
class Extra {}

function deps() {
  return {
    context: { subscriptions: [] },
    vscodeApi: { commands: {}, workspace: {} },
    serverProcess: {
      sendRequest: jest.fn(),
      onNotification: jest.fn(() => jest.fn()),
    },
    webviewProvider: { postMessage: jest.fn(), onMessage: jest.fn() },
  };
}

describe(VscodeModule.name, () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('builds a global dynamic module without webview providers when none is given', () => {
    const d = deps();
    const dynamic = VscodeModule.forRoot({
      context: d.context as never,
      vscodeApi: d.vscodeApi as never,
      serverProcess: d.serverProcess as never,
    });

    expect(dynamic.module).toBe(VscodeModule);
    expect(dynamic.global).toBe(true);
    const provided = dynamic.providers!.map((p) =>
      typeof p === 'function' ? p : (p as { provide: unknown }).provide,
    );
    expect(provided).toEqual([
      VSCODE_EXTENSION_CONTEXT,
      VSCODE_API,
      STDIO_SERVER_PROCESS,
      VscodeCommandsService,
      VscodeWorkspaceService,
      ServerProcessService,
      ServerNotificationHandlerRegistry,
    ]);
    expect(dynamic.exports).toEqual(provided);
  });

  it('wires the full container with a webview provider and additional providers', async () => {
    const d = deps();

    @Module({ providers: [AppHandlers] })
    class AppModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        VscodeModule.forRoot(
          {
            context: d.context as never,
            vscodeApi: d.vscodeApi as never,
            serverProcess: d.serverProcess as never,
            webviewProvider: d.webviewProvider as never,
          },
          [Extra],
        ),
        AppModule,
      ],
    }).compile();
    await moduleRef.init();

    expect(moduleRef.get(VSCODE_EXTENSION_CONTEXT)).toBe(d.context);
    expect(moduleRef.get(VSCODE_API)).toBe(d.vscodeApi);
    expect(moduleRef.get(STDIO_SERVER_PROCESS)).toBe(d.serverProcess);
    expect(moduleRef.get(WEBVIEW_PROVIDER)).toBe(d.webviewProvider);
    expect(moduleRef.get(VscodeCommandsService)).toBeInstanceOf(
      VscodeCommandsService,
    );
    expect(moduleRef.get(VscodeWorkspaceService)).toBeInstanceOf(
      VscodeWorkspaceService,
    );
    expect(moduleRef.get(ServerProcessService)).toBeInstanceOf(
      ServerProcessService,
    );
    expect(moduleRef.get(Extra)).toBeInstanceOf(Extra);

    const bus = moduleRef.get(ExtensionMessageBus);
    expect(moduleRef.get(MESSAGE_BUS)).toBe(bus);
    expect(d.webviewProvider.onMessage).toHaveBeenCalled();

    expect(
      moduleRef.get(WebviewHandlerRegistry).hasHandler('extension.hello'),
    ).toBe(true);
    await expect(
      bus.sendRequest('extension.extension.hello', { name: 'bob' }),
    ).resolves.toBe('hello bob');

    expect(
      moduleRef
        .get(ServerNotificationHandlerRegistry)
        .hasHandler('server.ping'),
    ).toBe(true);
    expect(d.serverProcess.onNotification).toHaveBeenCalledWith(
      'server.ping',
      expect.any(Function),
    );

    await moduleRef.close();
  });

  it('bootstraps without a webview provider', async () => {
    const d = deps();
    const moduleRef = await Test.createTestingModule({
      imports: [
        VscodeModule.forRoot({
          context: d.context as never,
          vscodeApi: d.vscodeApi as never,
          serverProcess: d.serverProcess as never,
        }),
      ],
    }).compile();
    await moduleRef.init();
    expect(moduleRef.get(ServerProcessService)).toBeDefined();
    expect(() => moduleRef.get(WEBVIEW_PROVIDER)).toThrow();
    expect(() => moduleRef.get(ExtensionMessageBus)).toThrow();
    expect(() => moduleRef.get(MESSAGE_BUS)).toThrow();
    await moduleRef.close();
  });
});
