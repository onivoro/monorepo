# @onivoro/server-puppeteer

A NestJS module providing Puppeteer integration with the `puppeteer-extra` stealth plugin for browser automation.

## Installation

```bash
npm install @onivoro/server-puppeteer puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

Peer dependencies: `@nestjs/common`, `puppeteer`, `puppeteer-extra` and `puppeteer-extra-plugin-stealth`. The compiled module and service `require('puppeteer')` at runtime because the `Browser` class is the injection token.

## Overview

This library provides:

- A NestJS module that launches one browser per process and provides `PuppeteerService` and the `Browser`
- The `puppeteer-extra` stealth plugin, registered once per process on the first launch
- `usePage`, which opens a page, optionally navigates, runs your callback, and always closes the page
- A mock module for testing

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { ServerPuppeteerModule, ServerPuppeteerConfig } from '@onivoro/server-puppeteer';

const config = new ServerPuppeteerConfig();
config.headless = true;
config.executablePath = '/path/to/chrome'; // optional

@Module({
  imports: [ServerPuppeteerModule.configure(config)],
})
export class AppModule {}
```

`ServerPuppeteerModule.configure(config)` provides:

- `ServerPuppeteerConfig` - the config you passed
- `Browser` (the class from `puppeteer`) - created with `launchBrowser(config)`. The instance is cached in a module-level variable, so every `configure` call in the process shares the first browser launched.
- `PuppeteerService`

## Configuration

`ServerPuppeteerConfig` is passed to `puppeteer.launch` as-is. Its fields use the types of Puppeteer's `LaunchOptions`:

```typescript
class ServerPuppeteerConfig {
  executablePath: LaunchOptions['executablePath']; // string | undefined; path to Chrome/Chromium
  headless?: LaunchOptions['headless']; // boolean | 'shell'
  devtools?: LaunchOptions['devtools']; // boolean
  defaultViewport?: LaunchOptions['defaultViewport']; // Viewport | null
}
```

## Usage

### PuppeteerService

```typescript
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@onivoro/server-puppeteer';

@Injectable()
export class WebScraperService {
  constructor(private puppeteerService: PuppeteerService) {}

  async scrapeData(url: string) {
    return this.puppeteerService.usePage(async (page) => {
      await page.waitForSelector('.data-element');
      const data = await page.$eval('.data-element', (el) => el.textContent);
      return data ?? '';
    }, url);
  }
}
```

## API Reference

### PuppeteerService

`constructor(public browser: Browser)` - the browser is available as `puppeteerService.browser`.

#### `usePage(fn, url?)`

Opens a new page, navigates to `url` when given, awaits `fn(page)`, closes the page and returns the result. The page is closed in a `finally`, so it is also closed when navigation or `fn` throws; the error then propagates.

```typescript
const title = await puppeteerService.usePage(async (page) => {
  await page.click('#submit-button');
  await page.waitForNavigation();
  return await page.title();
}, 'https://example.com');
```

Parameters:

- `fn: (page: Page) => Promise<string>` - function to execute with the page; it must resolve to a string
- `url?: string` - URL to navigate to before calling `fn`

Returns: `Promise<string>`

#### Protected Methods

These are available when extending `PuppeteerService`:

- `extractPageBody(url): Promise<string>` - opens `url`, waits a random 2 to 11 seconds, and returns `document.body.textContent` (`''` if it is `null`)
- `extractPageBodyAsObject<TBody>(url): Promise<TBody>` - `JSON.parse` of `extractPageBody(url)`

```typescript
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@onivoro/server-puppeteer';

interface ApiResponse {
  data: string[];
}

@Injectable()
export class ApiPageService extends PuppeteerService {
  fetchData() {
    return this.extractPageBodyAsObject<ApiResponse>('https://api.example.com/data');
  }
}
```

### Browser Instance

The module provides the shared `Browser`, injectable by the `Browser` class from `puppeteer`:

```typescript
import { Injectable } from '@nestjs/common';
import { Browser } from 'puppeteer';

@Injectable()
export class CustomService {
  constructor(private browser: Browser) {}

  async createNewPage() {
    return await this.browser.newPage();
  }
}
```

### launchBrowser

`launchBrowser(options: ServerPuppeteerConfig)` registers the stealth plugin on `puppeteer-extra` and returns `puppeteer.launch(options)`. The plugin is registered only on the first call in the process; later calls just launch.

```typescript
import { launchBrowser } from '@onivoro/server-puppeteer';

const browser = await launchBrowser({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
});
```

## Testing

`ServerPuppeteerMockModule.configure()` provides a `PuppeteerService` stand-in whose `browser` is `{}` and whose `usePage` resolves to `'This is not implemented yet'` without calling your callback or launching a browser:

```typescript
import { Test } from '@nestjs/testing';
import { PuppeteerService, ServerPuppeteerMockModule } from '@onivoro/server-puppeteer';

const moduleRef = await Test.createTestingModule({
  imports: [ServerPuppeteerMockModule.configure()],
}).compile();

const service = moduleRef.get(PuppeteerService);
await service.usePage(async () => 'unused'); // 'This is not implemented yet'
```

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@onivoro/server-puppeteer';

type FormData = { name: string; email: string; country: string };

@Injectable()
export class FormAutomationService {
  constructor(private puppeteerService: PuppeteerService) {}

  async submitForm(formData: FormData) {
    return this.puppeteerService.usePage(async (page) => {
      await page.setViewport({ width: 1920, height: 1080 });

      await page.type('#name', formData.name);
      await page.type('#email', formData.email);
      await page.select('#country', formData.country);

      await page.click('#submit');

      await page.waitForSelector('.success-message');
      const message = await page.$eval('.success-message', (el) => el.textContent);

      await page.screenshot({ path: 'confirmation.png' });

      return message ?? '';
    }, 'https://example.com/form');
  }

  async scrapeProductData(productUrl: string) {
    const json = await this.puppeteerService.usePage(async (page) => {
      await page.waitForSelector('.product-info');

      const productData = await page.evaluate(() => ({
        title: document.querySelector('.product-title')?.textContent?.trim(),
        price: document.querySelector('.product-price')?.textContent?.trim(),
        images: Array.from(document.querySelectorAll('.product-image img')).map((img) => img.getAttribute('src')),
      }));

      return JSON.stringify(productData); // usePage callbacks must return a string
    }, productUrl);

    return JSON.parse(json);
  }
}
```

## Important Notes

1. One browser is launched per process and shared by every `ServerPuppeteerModule` import
2. `usePage` closes the page whether the callback succeeds or throws
3. The stealth plugin is registered once per process, on the first `launchBrowser` call
4. `extractPageBody` waits a random 2 to 11 seconds before reading the body

## License

MIT
