import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { StdioTransportService } from './stdio-transport-service';
import { StdioTransportModuleConfig } from './stdio-transport-module-config';

/**
 * NestJS module that provides stdio-based JSON-RPC transport.
 *
 * This module:
 * - Creates and manages a StdioTransport instance
 * - Automatically discovers @StdioHandler decorated methods
 * - Registers handlers with the transport on module init
 * - Cleans up on module destroy
 *
 * @example
 * ```typescript
 * // In your handler service
 * @Injectable()
 * export class MyHandlers {
 *   @StdioHandler('health')
 *   async health() {
 *     return { status: 'ok' };
 *   }
 *
 *   @StdioHandler('user.get')
 *   async getUser(params: { id: string }) {
 *     return { id: params.id, name: 'John' };
 *   }
 * }
 *
 * // In your app module
 * @Module({
 *   imports: [
 *     StdioTransportModule.forRoot({
 *       handlers: [MyHandlers],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class StdioTransportModule {
  /**
   * Configure the module with handler providers.
   */
  static forRoot(config: StdioTransportModuleConfig = {}): DynamicModule {
    const { handlers = [] } = config;

    return {
      module: StdioTransportModule,
      providers: [
        DiscoveryService,
        MetadataScanner,
        StdioTransportService,
        ...handlers,
      ],
      exports: [StdioTransportService],
      global: true,
    };
  }
}
