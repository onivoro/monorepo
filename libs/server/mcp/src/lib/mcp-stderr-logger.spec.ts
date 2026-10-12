import { Logger } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { McpStderrLogger } from './mcp-stderr-logger';
import { McpStdioModule } from './mcp-stdio.module';

describe('McpStderrLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  it('writes every level to stderr and nothing to stdout', () => {
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderr = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const logger = new McpStderrLogger();

    logger.log('log');
    logger.warn('warn');
    logger.error('error');
    logger.debug('debug');
    logger.verbose('verbose');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(5);
  });
});

describe('McpStdioModule log redirection', () => {
  const metadata = { name: 'stdio', version: '1.0.0' };
  let override: jest.SpyInstance;

  beforeEach(() => {
    override = jest
      .spyOn(Logger, 'overrideLogger')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends logs to stderr when serving on process.stdout', () => {
    McpStdioModule.registerAndServeStdio({ metadata });

    expect(override).toHaveBeenCalledWith(expect.any(McpStderrLogger));
  });

  it('sends logs to stderr when process.stdout is passed explicitly', () => {
    McpStdioModule.registerAndServeStdio({ metadata, stdout: process.stdout });

    expect(override).toHaveBeenCalledWith(expect.any(McpStderrLogger));
  });

  it('leaves logging alone when serving on a custom stdout', () => {
    McpStdioModule.registerAndServeStdio({
      metadata,
      stdout: new PassThrough(),
    });

    expect(override).not.toHaveBeenCalled();
  });

  it('honors an explicit redirectLogsToStderr', () => {
    McpStdioModule.registerAndServeStdio({
      metadata,
      redirectLogsToStderr: false,
    });
    McpStdioModule.registerAndServeStdioAsync({
      useFactory: () => ({ metadata }),
      redirectLogsToStderr: false,
    });

    expect(override).not.toHaveBeenCalled();
  });

  it('sends logs to stderr by default for the async variant', () => {
    McpStdioModule.registerAndServeStdioAsync({
      useFactory: () => ({ metadata }),
    });

    expect(override).toHaveBeenCalledWith(expect.any(McpStderrLogger));
  });
});
