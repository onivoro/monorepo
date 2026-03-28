import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for stdio handler methods.
 */
export const STDIO_HANDLER_METADATA = 'STDIO_HANDLER_METADATA';

/**
 * Metadata stored for each stdio handler.
 */
export interface StdioHandlerMetadata {
  method: string;
}

/**
 * Decorator to mark a method as a stdio RPC handler.
 *
 * Use this decorator on methods within an @Injectable() service
 * to register them as handlers for specific stdio method calls.
 *
 * @param method - The RPC method name to handle (e.g., 'health', 'user.get')
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class HealthService {
 *   @StdioHandler('health')
 *   async getHealth(): Promise<{ status: string }> {
 *     return { status: 'ok' };
 *   }
 *
 *   @StdioHandler('health.detailed')
 *   async getDetailedHealth(): Promise<HealthDetails> {
 *     return { status: 'ok', uptime: process.uptime() };
 *   }
 * }
 * ```
 */
export function StdioHandler(method: string): MethodDecorator {
  return SetMetadata(STDIO_HANDLER_METADATA, {
    method,
  } as StdioHandlerMetadata);
}
