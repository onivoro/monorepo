import { Type } from '@nestjs/common';

/**
 * Configuration for the StdioTransportModule.
 */
export interface StdioTransportModuleConfig {
  /**
   * Array of handler provider classes that contain @StdioHandler decorated methods.
   * These will be instantiated and their handlers registered automatically.
   */
  handlers?: Type<unknown>[];
}
