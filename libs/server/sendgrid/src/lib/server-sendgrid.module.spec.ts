import { Test } from '@nestjs/testing';
import sgMail, { MailService } from '@sendgrid/mail';
import { ServerSendgridConfig } from './classes/server-sendgrid-config.class';
import { ServerSendgridModule } from './server-sendgrid.module';
import { EmailService } from './services/email.service';

jest.mock('@sendgrid/mail', () => {
  class MailService {}
  return {
    __esModule: true,
    MailService,
    default: { setApiKey: jest.fn(), send: jest.fn() },
  };
});

describe('ServerSendgridModule', () => {
  const compile = (config: ServerSendgridConfig) =>
    Test.createTestingModule({
      imports: [ServerSendgridModule.configure(config)],
    }).compile();

  it('wires EmailService to the configured sendgrid client', async () => {
    const config = new ServerSendgridConfig('SG.first', 'from@example.com');
    const moduleRef = await compile(config);

    const service = moduleRef.get(EmailService);

    expect(moduleRef.get(ServerSendgridConfig)).toBe(config);
    expect(moduleRef.get(MailService)).toBe(sgMail);
    expect(service.config).toBe(config);
    expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.first');

    await service.sendEmail('to@example.com', 's', 'h', 't');
    expect(sgMail.send).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'from@example.com' }),
    );
  });

  it('reuses the process-wide client and does not reset the api key', async () => {
    jest.mocked(sgMail.setApiKey).mockClear();

    const moduleRef = await compile(
      new ServerSendgridConfig('SG.second', 'other@example.com'),
    );

    expect(moduleRef.get(MailService)).toBe(sgMail);
    expect(sgMail.setApiKey).not.toHaveBeenCalled();
  });
});
