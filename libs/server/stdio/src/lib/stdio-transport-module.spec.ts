import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { StdioTransportModule } from './stdio-transport-module';
import { StdioTransportService } from './stdio-transport-service';

@Injectable()
class SomeHandlers {}

describe('StdioTransportModule.forRoot', () => {
  it('provides the transport service globally with no handlers by default', () => {
    expect(StdioTransportModule.forRoot()).toEqual({
      module: StdioTransportModule,
      providers: [DiscoveryService, MetadataScanner, StdioTransportService],
      exports: [StdioTransportService],
      global: true,
    });
  });

  it('adds the handler classes as providers', () => {
    const mod = StdioTransportModule.forRoot({ handlers: [SomeHandlers] });

    expect(mod.providers).toEqual([
      DiscoveryService,
      MetadataScanner,
      StdioTransportService,
      SomeHandlers,
    ]);
  });
});
