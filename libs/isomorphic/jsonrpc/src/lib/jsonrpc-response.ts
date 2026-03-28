import { JsonRpcError } from './jsonrpc-error';
import { JsonRpcId, JSONRPC_VERSION } from './jsonrpc-request';

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: JsonRpcId;
  result?: T;
  error?: JsonRpcError;
}
