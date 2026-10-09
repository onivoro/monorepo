import { Logger } from '@nestjs/common';
import { McpAuthInfo, markMcpAuthInfoResolved } from '@onivoro/server-mcp';
import type { McpAuthUnwrappingOptions } from './mcp-auth-unwrapping-tool-provider';

export const AGENTIC_MCP_AUTH_KIND = 'agentic-mcp-auth';

const logger = new Logger('resolveAgenticMcpAuth');

/**
 * The auth an agentic run carries for its MCP tool calls: either verified MCP
 * auth info, or the reason there is none. Pass it as the run context's
 * `authInfo` and unwrap it with `agenticMcpAuthUnwrappingOptions`.
 */
export interface AgenticMcpAuthContext {
  kind: typeof AGENTIC_MCP_AUTH_KIND;
  mcpAuthInfo?: McpAuthInfo;
  error?: string;
}

export interface ResolveAgenticMcpAuthInput {
  /** The signed-in user's access token. */
  token: string | undefined;
  /**
   * Verifies the token and returns its auth info, throwing when it is invalid,
   * e.g. `(token) => cognitoStrategy.verifyInProcessAccessToken(token)`.
   */
  verify: (token: string) => Promise<McpAuthInfo>;
  /** Adds what tools need beyond the token's claims, e.g. the user's email. */
  enrich?: (authInfo: McpAuthInfo) => McpAuthInfo | Promise<McpAuthInfo>;
  /**
   * Returns a reason to refuse the enriched auth info, or `undefined` to allow
   * it, e.g. when the token belongs to someone other than the signed-in user.
   *
   * This is the only link between the token and the signed-in user. When
   * `token` comes from anywhere other than the credential that authenticated
   * the request (a separate header, the request body, stored state), pass a
   * `check` that compares the token's identity (e.g. `sub` or the enriched
   * email) with the session user's.
   */
  check?: (
    authInfo: McpAuthInfo,
  ) => string | undefined | Promise<string | undefined>;
  /** Default: `Missing MCP access token`. */
  missingTokenMessage?: string;
  /** Used when verification fails without a message. Default: `Invalid MCP access token`. */
  invalidTokenMessage?: string;
  /**
   * Used when `enrich` or `check` throws; the error itself is logged, not
   * returned. Default: `MCP authorization is unavailable.`
   */
  unavailableMessage?: string;
}

/**
 * Verifies, enriches and checks a signed-in user's token for an agentic run's
 * in-process MCP tool calls, and marks the result with
 * `markMcpAuthInfoResolved` so `McpToolRegistry` passes it to guards without
 * running its auth strategy again. Guards still run.
 *
 * Never throws: failures come back as `{ error }`, which
 * `executeMcpAuthWrappedTool` turns into a tool error the model can see:
 * - a missing token or a refusal from `check`: that message;
 * - a failed `verify`: its error message (e.g. `jwt expired`), or
 *   `invalidTokenMessage` when there is none;
 * - a thrown `enrich` or `check`: logged, and `unavailableMessage` is returned,
 *   so internal errors never reach the model.
 */
export async function resolveAgenticMcpAuth(
  input: ResolveAgenticMcpAuthInput,
): Promise<AgenticMcpAuthContext> {
  if (!input.token) {
    return agenticMcpAuthError(
      input.missingTokenMessage ?? 'Missing MCP access token',
    );
  }

  let verified: McpAuthInfo;
  try {
    verified = await input.verify(input.token);
  } catch (error) {
    return agenticMcpAuthError(
      error instanceof Error && error.message
        ? error.message
        : (input.invalidTokenMessage ?? 'Invalid MCP access token'),
    );
  }

  let enriched: McpAuthInfo;
  let refusal: string | undefined;
  try {
    enriched = input.enrich ? await input.enrich(verified) : verified;
    refusal = await input.check?.(enriched);
  } catch (error) {
    logger.error(
      'Failed to enrich or check MCP auth info',
      error instanceof Error ? error.stack : String(error),
    );
    return agenticMcpAuthError(
      input.unavailableMessage ?? 'MCP authorization is unavailable.',
    );
  }

  if (refusal) {
    return agenticMcpAuthError(refusal);
  }

  return {
    kind: AGENTIC_MCP_AUTH_KIND,
    mcpAuthInfo: markMcpAuthInfoResolved(enriched),
  };
}

export function isAgenticMcpAuthContext(
  value: unknown,
): value is AgenticMcpAuthContext {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as AgenticMcpAuthContext).kind === AGENTIC_MCP_AUTH_KIND
  );
}

/** Options for `executeMcpAuthWrappedTool` and `listMcpAuthWrappedTools`. */
export const agenticMcpAuthUnwrappingOptions: McpAuthUnwrappingOptions<AgenticMcpAuthContext> =
  {
    authUnavailableCode: 'mcp_auth_unavailable',
    authUnavailableMessage: 'MCP authorization is unavailable.',
    getError: (context) => context?.error,
    getMcpAuthInfo: (context) => context.mcpAuthInfo,
    isAuthContext: isAgenticMcpAuthContext,
  };

function agenticMcpAuthError(error: string): AgenticMcpAuthContext {
  return { kind: AGENTIC_MCP_AUTH_KIND, error };
}
