import { Test } from '@nestjs/testing';
import OpenAIApi from 'openai';
import { ServerOpenAiConfig } from './server-open-ai-config.class';
import { ServerOpenAiModule } from './server-open-ai.module';
import { OpenAiService } from './services/open-ai.service';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function (this: any, options: unknown) {
    this.options = options;
  }),
}));

describe('ServerOpenAiModule', () => {
  const configOf = (apiKey: string, organization?: string) =>
    Object.assign(
      new ServerOpenAiConfig(),
      { apiKey },
      organization === undefined ? {} : { organization },
    );

  async function compile(config: ServerOpenAiConfig) {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerOpenAiModule.configure(config)],
    }).compile();
    return moduleRef.get(OpenAiService);
  }

  beforeEach(() => jest.mocked(OpenAIApi).mockClear());

  it('defaults to an empty organization', () => {
    expect(new ServerOpenAiConfig().organization).toBe('');
  });

  it('wires OpenAiService with the config and a client built from the api key alone', async () => {
    const config = configOf('sk-1');

    const service = await compile(config);

    expect(service.config).toBe(config);
    expect(OpenAIApi).toHaveBeenCalledWith({ apiKey: 'sk-1' });
    expect((service.openai as any).options).toEqual({ apiKey: 'sk-1' });
  });

  it('passes the organization when one is configured', async () => {
    await compile(configOf('sk-2', 'org-9'));

    expect(OpenAIApi).toHaveBeenCalledWith({
      apiKey: 'sk-2',
      organization: 'org-9',
    });
  });
});
