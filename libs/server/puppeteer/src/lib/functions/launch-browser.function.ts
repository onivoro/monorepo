import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { ServerPuppeteerConfig } from '../..';

let stealthRegistered = false;

export async function launchBrowser(options: ServerPuppeteerConfig) {
  if (!stealthRegistered) {
    puppeteer.use(StealthPlugin());
    stealthRegistered = true;
  }
  return await puppeteer.launch(options);
}
