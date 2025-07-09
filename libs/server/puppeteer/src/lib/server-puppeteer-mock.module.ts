import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { PuppeteerService } from './services/puppeteer.service';
import { Page } from 'puppeteer';

@Module({})
export class ServerPuppeteerMockModule {
    static configure() {
        return moduleFactory({
            module: ServerPuppeteerMockModule,
            providers: [
                {
                    provide: PuppeteerService, useFactory: () => {
                        const mockSvc: PuppeteerService = {
                            browser: {} as any,
                            usePage: async (fn: (page: Page) => Promise<string>, url?: string) => 'This is not implemented yet'
                        } as PuppeteerService;

                        return mockSvc;
                    }
                }
            ]
        });
    }
}