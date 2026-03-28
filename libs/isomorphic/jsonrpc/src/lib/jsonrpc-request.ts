export const JSONRPC_VERSION = '2.0' as const;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  method: string;
  params?: TParams;
  id: JsonRpcId;
}
