import { Test } from '@nestjs/testing';
import { ServerPuppeteerMockModule } from './server-puppeteer-mock.module';
import { PuppeteerService } from './services/puppeteer.service';

describe('ServerPuppeteerMockModule', () => {
  it('provides a PuppeteerService stub that never touches a browser', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerPuppeteerMockModule.configure()],
    }).compile();
    const service = moduleRef.get(PuppeteerService);
    const fn = jest.fn();

    await expect(service.usePage(fn, 'https://example.test')).resolves.toBe(
      'This is not implemented yet',
    );
    expect(fn).not.toHaveBeenCalled();
    expect(service.browser).toEqual({});
  });
});
