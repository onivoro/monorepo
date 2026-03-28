// Core JSONRPC types
export type { JsonRpcError } from './lib/jsonrpc-error';
export {
  JsonRpcErrorCodes,
  isServerErrorCode,
} from './lib/jsonrpc-error-codes';
export type { JsonRpcErrorCode } from './lib/jsonrpc-error-codes';
export { JSONRPC_VERSION } from './lib/jsonrpc-request';
export type { JsonRpcId, JsonRpcRequest } from './lib/jsonrpc-request';
export type { JsonRpcResponse } from './lib/jsonrpc-response';
export type { JsonRpcNotification } from './lib/jsonrpc-notification';
export { isJsonRpcNotification } from './lib/jsonrpc-notification';
export type { JsonRpcHandlerFn } from './lib/jsonrpc-handler-fn';

// MessageBus abstraction for cross-process communication
export type {
  MessageBus,
  MessageBusFactory,
  SendRequestOptions,
  RequestResult,
  HandlerRegistrationOptions,
  HandlerInfo,
  NotificationEvent,
} from './lib/message-bus.interface';
export { MESSAGE_BUS } from './lib/message-bus.interface';

// Message routing
export {
  MessageTarget,
  MESSAGE_TARGETS,
  isMessageTarget,
} from './lib/message-target';

export {
  parseMethodTarget,
  createTargetedMethod,
  hasTarget,
  shouldRouteToTarget,
  METHOD_TARGET_DELIMITER,
} from './lib/parse-method-target';
export type { ParsedMethod } from './lib/parse-method-target';

// Disposable utilities
export type { Disposable, DisposableObject } from './lib/disposable';
export {
  toDisposableObject,
  toDisposable,
  combineDisposables,
} from './lib/disposable';
