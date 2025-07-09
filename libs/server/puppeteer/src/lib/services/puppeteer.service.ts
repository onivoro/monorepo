import { Injectable } from "@nestjs/common";
import { Browser, Page } from 'puppeteer';
import { sleep } from '@onivoro/isomorphic-common';

@Injectable()
export class PuppeteerService {
    constructor(public browser: Browser) { }

    async usePage(fn: (page: Page) => Promise<string>, url?: string) {
        const page = await this.browser.newPage();
        if (url) {
            await page.goto(url);
        }
        const result = await fn(page);
        await page.close();
        return result;
    }

    protected async extractPageBodyAsObject<TBody>(url: string): Promise<TBody> {
        return JSON.parse(await this.extractPageBody(url)) as TBody;
    }

    protected async extractPageBody(url: string): Promise<string> {
        return await this.usePage(async page => {
            await sleep((Math.floor(Math.random() * 10) + 2) * 1000)
            return await page.$eval('body', e => e.textContent);
        }, url);
    }
}
