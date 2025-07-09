import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ServerPuppeteerConfig } from "../..";

export async function launchBrowser(options: ServerPuppeteerConfig) {
    puppeteer.use(StealthPlugin())
    return await puppeteer.launch(options);
}