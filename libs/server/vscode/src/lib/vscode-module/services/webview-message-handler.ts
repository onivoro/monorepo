import { JsonRpcRequest } from '@onivoro/isomorphic-jsonrpc';

/**
 * Message handler function type.
 */
export type WebviewMessageHandler = (
  message: JsonRpcRequest,
) => void | Promise<void>;
