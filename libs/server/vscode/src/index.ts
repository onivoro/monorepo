// VSCode command handling
export {
  CommandHandler,
  CommandHandlerMetadata,
  COMMAND_HANDLER_METADATA,
} from './lib/command-handler';

export { CommandRegistry } from './lib/command-registry';
export { DiscoveredCommandHandler } from './lib/discovered-command-handler';
export { discoverCommandHandlers } from './lib/functions/discover-command-handlers';

// Webview provider
export { BaseWebviewProvider } from './lib/classes/base-webview-provider';
export { WebviewProviderConfig } from './lib/vscode-module/services/webview-provider-config';
export { WebviewMessageHandler } from './lib/vscode-module/services/webview-message-handler';

// Webview utilities
export { generateNonce } from './lib/functions/generate-nonce';
export { generateCspMetaTag } from './lib/functions/generate-csp-meta-tag';
export { generateVscodeApiBridgeScript } from './lib/functions/generate-vscode-api-bridge-script';
export { addNonceToScripts } from './lib/functions/add-nonce-to-scripts';
export { generateVscodeThemeBridgeInjection } from './lib/generate-vscode-theme-bridge-injection';
export { CspOptions } from './lib/types/csp-options';
export { defaultWebviewMessageHandler } from './lib/default-webview-message-handler.function';

// Extension types
export { VscodeExtensionInstance } from './lib/types/vscode-extension-instance';

// VscodeModule - NestJS module for extension-side DI
export {
  VscodeModule,
  VscodeModuleOptions,
  VscodeCommandsService,
  VscodeWorkspaceService,
  ServerProcessService,
  NotificationHandler,
  VSCODE_EXTENSION_CONTEXT,
  VSCODE_API,
  STDIO_SERVER_PROCESS,
  WEBVIEW_PROVIDER,
} from './lib/vscode-module';

// Type alias for VSCode API (use with @Inject(VSCODE_API))
export type { VscodeApi } from './lib/vscode-module/vscode-api-type';

// Extension module decorator and factory (simplest approach)
export {
  VscodeExtensionModule,
  VscodeExtensionModuleConfig,
  getExtensionModuleConfig,
  VSCODE_EXTENSION_MODULE_METADATA,
} from './lib/decorators/vscode-extension-module.decorator';
export { createExtensionFromModule } from './lib/create-extension-from-module';

// MessageBus for VSCode extension environment
export {
  ExtensionMessageBus,
  ExtensionMessageBusConfig,
  createExtensionMessageBus,
} from './lib/extension-message-bus';

// Webview handler decorator and registry
export {
  WebviewHandler,
  WebviewHandlerMetadata,
  WEBVIEW_HANDLER_METADATA,
} from './lib/decorators/webview-handler.decorator';
export { WebviewHandlerRegistry } from './lib/webview-handler-registry';

// Server notification handler decorator and registry
export {
  ServerNotificationHandler,
  ServerNotificationHandlerMetadata,
  SERVER_NOTIFICATION_HANDLER_METADATA,
} from './lib/decorators/server-notification-handler.decorator';
export {
  ServerNotificationHandlerRegistry,
  NotificationHandlerFn,
} from './lib/server-notification-handler-registry';
