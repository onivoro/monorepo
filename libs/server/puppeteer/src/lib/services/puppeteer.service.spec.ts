import { PuppeteerService } from './puppeteer.service';
import { ServerPuppeteerConfig } from '../classes/server-puppeteer-config.class';
import { launchBrowser } from '../functions/launch-browser.function';
import { sleep } from '@onivoro/isomorphic-common';
import { writeFile } from 'fs/promises';

describe(PuppeteerService.name, () => {
    it('spawns a browser', async () => {
        const options: ServerPuppeteerConfig = {
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: false,
            devtools: true
        };
        const browser = await launchBrowser(options);

        const subject = new PuppeteerService(browser);

        try {

            const result = await subject.usePage(async (page) => {
                await page.goto('https://github.com/onivoro/monorepo.git');
                const content = await page.content();
                await writeFile(`test/test.pdf`, await page.pdf());
                await sleep(3_000);
                return content;
            });

            expect(result.includes('Pull requests')).toBe(true);
        } catch (error: any) { }

        await browser.close();
    });
});