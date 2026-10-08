import { Module } from '@nestjs/common';
import { COMMAND_HANDLER_METADATA, CommandHandler } from '../command-handler';
import {
  SERVER_NOTIFICATION_HANDLER_METADATA,
  ServerNotificationHandler,
} from './server-notification-handler.decorator';
import {
  WEBVIEW_HANDLER_METADATA,
  WebviewHandler,
} from './webview-handler.decorator';
import {
  getExtensionModuleConfig,
  VSCODE_EXTENSION_MODULE_METADATA,
  VscodeExtensionModule,
  VscodeExtensionModuleConfig,
} from './vscode-extension-module.decorator';

class Target {
  @CommandHandler('ext.cmd')
  cmd() {}

  @WebviewHandler('ext.webview')
  web() {}

  @ServerNotificationHandler('server.note')
  note() {}
}

describe('method decorators', () => {
  it('CommandHandler stores the command id', () => {
    expect(
      Reflect.getMetadata(COMMAND_HANDLER_METADATA, Target.prototype.cmd),
    ).toEqual({ command: 'ext.cmd' });
  });

  it('WebviewHandler stores the method name', () => {
    expect(
      Reflect.getMetadata(WEBVIEW_HANDLER_METADATA, Target.prototype.web),
    ).toEqual({ method: 'ext.webview' });
  });

  it('ServerNotificationHandler stores the method name', () => {
    expect(
      Reflect.getMetadata(
        SERVER_NOTIFICATION_HANDLER_METADATA,
        Target.prototype.note,
      ),
    ).toEqual({ method: 'server.note' });
  });
});

describe(VscodeExtensionModule.name, () => {
  it('stores the config on the class and getExtensionModuleConfig reads it', () => {
    const config: VscodeExtensionModuleConfig = {
      name: 'Ext',
      serverScript: 'dist/main.js',
      webviewViewType: 'ext.view',
      createWebviewProvider: jest.fn(),
      commandHandlerTokens: [],
    };

    @VscodeExtensionModule(config)
    @Module({})
    class ExtModule {}

    expect(
      Reflect.getMetadata(VSCODE_EXTENSION_MODULE_METADATA, ExtModule),
    ).toBe(config);
    expect(getExtensionModuleConfig(ExtModule)).toBe(config);
  });

  it('returns undefined for undecorated classes', () => {
    class Plain {}
    expect(getExtensionModuleConfig(Plain)).toBeUndefined();
  });
});
