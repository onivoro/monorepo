# @onivoro/server-puppeteer

A NestJS module providing Puppeteer integration with stealth plugin support for browser automation.

## Installation

```bash
npm install @onivoro/server-puppeteer
```

## Overview

This library provides:
- NestJS module for Puppeteer integration
- Stealth plugin enabled by default to avoid detection
- Singleton browser instance management
- Convenient page usage patterns
- Mock module for testing

## Module Setup

```typescript
import { ServerPuppeteerModule, ServerPuppeteerConfig } from '@onivoro/server-puppeteer';

const config = new ServerPuppeteerConfig();
config.headless = true;
config.executablePath = '/path/to/chrome'; // optional

@Module({
  imports: [
    ServerPuppeteerModule.configure(config)
  ]
})
export class AppModule {}
```

## Configuration

The `ServerPuppeteerConfig` class accepts standard Puppeteer launch options:

```typescript
export class ServerPuppeteerConfig {
  executablePath?: string;    // Path to Chrome/Chromium executable
  headless?: boolean;         // Run in headless mode
  devtools?: boolean;         // Open DevTools automatically
  defaultViewport?: {         // Default viewport size
    width: number;
    height: number;
  };
}
```

## Usage

### PuppeteerService

The main service provides methods for browser automation:

```typescript
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@onivoro/server-puppeteer';

@Injectable()
export class WebScraperService {
  constructor(private puppeteerService: PuppeteerService) {}

  async scrapeData(url: string) {
    return this.puppeteerService.usePage(async (page) => {
      // Your automation logic here
      await page.waitForSelector('.data-element');
      const data = await page.$eval('.data-element', el => el.textContent);
      return data;
    }, url);
  }
}
```

## API Reference

### PuppeteerService

#### `usePage(fn, url?)`

Execute a function with a new page, automatically closing it afterwards:

```typescript
const result = await puppeteerService.usePage(async (page) => {
  await page.click('#submit-button');
  await page.waitForNavigation();
  return await page.title();
}, 'https://example.com');
```

Parameters:
- `fn: (page: Page) => Promise<string>` - Function to execute with the page
- `url?: string` - Optional URL to navigate to before executing the function

Returns: `Promise<string>` - The result from the function

#### Protected Methods

These methods are available when extending PuppeteerService:

##### `extractPageBody(url)`

Extract the text content of a page's body:

```typescript
const bodyText = await this.extractPageBody('https://example.com');
```

##### `extractPageBodyAsObject<T>(url)`

Extract and parse JSON from a page's body:

```typescript
interface ApiResponse {
  data: string[];
}

const response = await this.extractPageBodyAsObject<ApiResponse>('https://api.example.com/data');
```

### Browser Instance

The module provides a singleton Browser instance that can be injected:

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

### launchBrowser Function

Low-level function to launch a browser with stealth plugin:

```typescript
import { launchBrowser } from '@onivoro/server-puppeteer';

const browser = await launchBrowser({
  headless: true,
  executablePath: '/usr/bin/google-chrome'
});
```

## Testing

Use the mock module for testing:

```typescript
import { ServerPuppeteerMockModule } from '@onivoro/server-puppeteer';

const module = await Test.createTestingModule({
  imports: [ServerPuppeteerMockModule]
}).compile();
```

## Complete Example

```typescript
import { Injectable } from '@nestjs/common';
import { PuppeteerService } from '@onivoro/server-puppeteer';

@Injectable()
export class FormAutomationService {
  constructor(private puppeteerService: PuppeteerService) {}

  async submitForm(formData: any) {
    return this.puppeteerService.usePage(async (page) => {
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Fill form
      await page.type('#name', formData.name);
      await page.type('#email', formData.email);
      await page.select('#country', formData.country);
      
      // Submit
      await page.click('#submit');
      
      // Wait for confirmation
      await page.waitForSelector('.success-message');
      const message = await page.$eval('.success-message', el => el.textContent);
      
      // Take screenshot
      await page.screenshot({ path: 'confirmation.png' });
      
      return message;
    }, 'https://example.com/form');
  }

  async scrapeProductData(productUrl: string) {
    return this.puppeteerService.usePage(async (page) => {
      // Wait for content to load
      await page.waitForSelector('.product-info');
      
      // Extract data
      const productData = await page.evaluate(() => {
        return {
          title: document.querySelector('.product-title')?.textContent?.trim(),
          price: document.querySelector('.product-price')?.textContent?.trim(),
          description: document.querySelector('.product-description')?.textContent?.trim(),
          images: Array.from(document.querySelectorAll('.product-image img'))
            .map(img => img.getAttribute('src'))
        };
      });
      
      return JSON.stringify(productData);
    }, productUrl);
  }
}
```

## Important Notes

1. The browser instance is singleton - only one browser is launched per application
2. Pages are automatically closed after use with `usePage()` method
3. Stealth plugin is automatically applied to avoid detection
4. The `extractPageBody` method includes a random delay (2-12 seconds) before extraction
5. Always handle errors appropriately as page operations can fail

## License

MIT