import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ServerPuppeteerConfig } from '../classes/server-puppeteer-config.class';
import { launchBrowser } from './launch-browser.function';

jest.mock('puppeteer-extra', () => ({
  __esModule: true,
  default: { use: jest.fn(), launch: jest.fn() },
}));

jest.mock('puppeteer-extra-plugin-stealth', () => ({
  __esModule: true,
  default: jest.fn(() => ({ name: 'stealth' })),
}));

describe('launchBrowser', () => {
  it('registers the stealth plugin and launches with the given options', async () => {
    const browser = { close: jest.fn() };
    jest.mocked(puppeteer.launch).mockResolvedValue(browser as any);
    const options: ServerPuppeteerConfig = {
      executablePath: '/usr/bin/chromium',
      headless: true,
    };

    const result = await launchBrowser(options);

    expect(StealthPlugin).toHaveBeenCalled();
    expect(puppeteer.use).toHaveBeenCalledWith({ name: 'stealth' });
    expect(puppeteer.launch).toHaveBeenCalledWith(options);
    expect(result).toBe(browser);
  });

  it('registers the stealth plugin only once across launches', async () => {
    let fresh!: typeof import('./launch-browser.function');
    let freshPuppeteer!: typeof puppeteer;
    let freshStealth!: typeof StealthPlugin;
    jest.isolateModules(() => {
      fresh = require('./launch-browser.function');
      freshPuppeteer = require('puppeteer-extra').default;
      freshStealth = require('puppeteer-extra-plugin-stealth').default;
    });
    jest
      .mocked(freshPuppeteer.launch)
      .mockClear()
      .mockResolvedValue({} as any);
    jest.mocked(freshPuppeteer.use).mockClear();
    jest.mocked(freshStealth).mockClear();

    await fresh.launchBrowser({ executablePath: '/a' });
    await fresh.launchBrowser({ executablePath: '/b' });

    expect(freshStealth).toHaveBeenCalledTimes(1);
    expect(freshPuppeteer.use).toHaveBeenCalledTimes(1);
    expect(freshPuppeteer.launch).toHaveBeenCalledTimes(2);
  });

  it('propagates launch failures', async () => {
    jest.mocked(puppeteer.launch).mockRejectedValue(new Error('no chrome'));

    await expect(launchBrowser({ executablePath: '/nope' })).rejects.toThrow(
      'no chrome',
    );
  });
});
