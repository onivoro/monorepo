import { DynamicModule, Module } from '@nestjs/common';
import { BedrockToolAdapter } from './bedrock-tool-adapter';

@Module({})
export class BedrockMcpModule {
  static forRegistry(): DynamicModule {
    return {
      module: BedrockMcpModule,
      providers: [BedrockToolAdapter],
      exports: [BedrockToolAdapter],
    };
  }
}
