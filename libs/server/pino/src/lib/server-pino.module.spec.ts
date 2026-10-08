import { Test } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { ServerPinoConfig } from './classes/server-pino-config.class';
import { patchConsole } from './functions/patch-console.function';
import { ServerPinoModule } from './server-pino.module';

jest.mock('./functions/patch-console.function', () => ({
  patchConsole: jest.fn(),
}));

describe('ServerPinoModule', () => {
  beforeEach(() => jest.mocked(patchConsole).mockClear());

  it('provides and exports the config', async () => {
    const config = new ServerPinoConfig();
    const dynamicModule = ServerPinoModule.configure(config);

    expect(dynamicModule.module).toBe(ServerPinoModule);
    expect(dynamicModule.providers).toContainEqual({
      provide: ServerPinoConfig,
      useValue: config,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [dynamicModule],
    }).compile();

    expect(moduleRef.get(ServerPinoConfig)).toBe(config);
    await moduleRef.close();
  });

  it('does not patch the console by default', () => {
    ServerPinoModule.configure(new ServerPinoConfig());

    expect(patchConsole).not.toHaveBeenCalled();
  });

  it('patches the console with a PinoLogger when asked', () => {
    ServerPinoModule.configure(new ServerPinoConfig(), true);

    expect(patchConsole).toHaveBeenCalledTimes(1);
    expect(jest.mocked(patchConsole).mock.calls[0][0]).toBeInstanceOf(
      PinoLogger,
    );
  });
});
