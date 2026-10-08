import { sleep } from '@onivoro/isomorphic-common';
import { Browser, Page } from 'puppeteer';
import { PuppeteerService } from './puppeteer.service';

jest.mock('@onivoro/isomorphic-common', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

/** Exposes the protected extract helpers. */
class TestablePuppeteerService extends PuppeteerService {
  body(url: string) {
    return this.extractPageBody(url);
  }

  bodyAsObject<T>(url: string) {
    return this.extractPageBodyAsObject<T>(url);
  }
}

function fakeBrowser(bodyText = '') {
  const page = {
    goto: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    $eval: jest.fn(
      async (_selector: string, fn: (e: { textContent: string }) => string) =>
        fn({ textContent: bodyText }),
    ),
  };
  const browser = { newPage: jest.fn().mockResolvedValue(page) };
  return { browser: browser as unknown as Browser, page };
}

describe('PuppeteerService (mocked browser)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('usePage', () => {
    it('opens a page, runs the callback, closes the page and returns the result', async () => {
      const { browser, page } = fakeBrowser();
      const service = new PuppeteerService(browser);
      const fn = jest.fn(async (p: Page) => {
        expect(p).toBe(page);
        expect(page.close).not.toHaveBeenCalled();
        return 'done';
      });

      await expect(service.usePage(fn)).resolves.toBe('done');

      expect(page.goto).not.toHaveBeenCalled();
      expect(page.close).toHaveBeenCalledTimes(1);
    });

    it('navigates to the url before running the callback', async () => {
      const { browser, page } = fakeBrowser();
      const order: string[] = [];
      page.goto.mockImplementation(async () => order.push('goto'));

      await new PuppeteerService(browser).usePage(async () => {
        order.push('fn');
        return '';
      }, 'https://example.test');

      expect(page.goto).toHaveBeenCalledWith('https://example.test');
      expect(order).toEqual(['goto', 'fn']);
    });

    it('propagates callback errors', async () => {
      const { browser } = fakeBrowser();

      await expect(
        new PuppeteerService(browser).usePage(async () => {
          throw new Error('selector not found');
        }),
      ).rejects.toThrow('selector not found');
    });

    it('closes the page when the callback throws', async () => {
      const { browser, page } = fakeBrowser();

      await new PuppeteerService(browser)
        .usePage(() => Promise.reject(new Error('x')))
        .catch(() => undefined);

      expect(page.close).toHaveBeenCalled();
    });
  });

  describe('extractPageBody', () => {
    it('waits a random 2-11s, then returns the text of <body>', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.55);
      const { browser, page } = fakeBrowser('hello world');

      const result = await new TestablePuppeteerService(browser).body(
        'https://example.test/api',
      );

      expect(result).toBe('hello world');
      expect(page.goto).toHaveBeenCalledWith('https://example.test/api');
      expect(page.$eval).toHaveBeenCalledWith('body', expect.any(Function));
      expect(sleep).toHaveBeenLastCalledWith(7_000);
      expect(page.close).toHaveBeenCalled();
    });

    it.each([
      [0, 2_000],
      [0.9999, 11_000],
    ])('bounds the delay (random=%p -> %pms)', async (random, delay) => {
      jest.spyOn(Math, 'random').mockReturnValue(random);
      const { browser } = fakeBrowser('x');

      await new TestablePuppeteerService(browser).body('u');

      expect(sleep).toHaveBeenLastCalledWith(delay);
    });
  });

  describe('extractPageBodyAsObject', () => {
    it('parses the body text as JSON', async () => {
      const { browser } = fakeBrowser('{"items":[1,2]}');

      await expect(
        new TestablePuppeteerService(browser).bodyAsObject('u'),
      ).resolves.toEqual({
        items: [1, 2],
      });
    });

    it('rejects when the body is not JSON', async () => {
      const { browser } = fakeBrowser('<html>');

      await expect(
        new TestablePuppeteerService(browser).bodyAsObject('u'),
      ).rejects.toThrow(SyntaxError);
    });
  });
});
