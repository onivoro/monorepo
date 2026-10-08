import { Test } from '@nestjs/testing';
import { Browser } from 'puppeteer';
import { ServerPuppeteerConfig } from './classes/server-puppeteer-config.class';
import { launchBrowser } from './functions/launch-browser.function';
import { ServerPuppeteerModule } from './server-puppeteer.module';
import { PuppeteerService } from './services/puppeteer.service';

jest.mock('puppeteer-extra', () => ({
  __esModule: true,
  default: { use: jest.fn(), launch: jest.fn() },
}));
jest.mock('puppeteer-extra-plugin-stealth', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('./functions/launch-browser.function', () => ({
  launchBrowser: jest.fn(),
}));

describe('ServerPuppeteerModule', () => {
  const config: ServerPuppeteerConfig = {
    executablePath: '/usr/bin/chromium',
    headless: true,
  };
  const browser = { newPage: jest.fn() };

  const compile = (c: ServerPuppeteerConfig) =>
    Test.createTestingModule({
      imports: [ServerPuppeteerModule.configure(c)],
    }).compile();

  beforeAll(() => jest.mocked(launchBrowser).mockResolvedValue(browser as any));

  it('launches a browser from the config and injects it into PuppeteerService', async () => {
    const moduleRef = await compile(config);

    expect(launchBrowser).toHaveBeenCalledWith(config);
    expect(moduleRef.get(ServerPuppeteerConfig)).toBe(config);
    expect(moduleRef.get(Browser)).toBe(browser);
    expect(moduleRef.get(PuppeteerService).browser).toBe(browser);
  });

  it('reuses the process-wide browser on subsequent configurations', async () => {
    jest.mocked(launchBrowser).mockClear();

    const moduleRef = await compile({ executablePath: '/other' });

    expect(launchBrowser).not.toHaveBeenCalled();
    expect(moduleRef.get(PuppeteerService).browser).toBe(browser);
  });
});
