import { LaunchOptions as PuppeteerLaunchOptions } from "puppeteer";

export class ServerPuppeteerConfig {
    executablePath: PuppeteerLaunchOptions['executablePath'];
    headless?: PuppeteerLaunchOptions['headless'];
    devtools?: PuppeteerLaunchOptions['devtools'];
    defaultViewport?: PuppeteerLaunchOptions['defaultViewport'];
}