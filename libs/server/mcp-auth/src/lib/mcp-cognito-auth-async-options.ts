import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';

/**
 * Async factory options for `McpAuthModule.configureCognitoAsync()`.
 */
export interface McpCognitoAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpCognitoAuthConfig | Promise<McpCognitoAuthConfig>;
}
