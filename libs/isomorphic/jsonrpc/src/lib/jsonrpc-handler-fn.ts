/**
 * Handler function type for processing incoming JSON-RPC messages.
 */
export type JsonRpcHandlerFn<TParams = unknown, TResult = unknown> = (
  params: TParams,
) => Promise<TResult>;
