import { MailService } from '@sendgrid/mail';
import { ServerSendgridConfig } from '../classes/server-sendgrid-config.class';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const config = new ServerSendgridConfig('SG.key', 'noreply@example.com');

  function createService() {
    const sgMail = {
      send: jest.fn().mockResolvedValue([{ statusCode: 202 }, {}]),
    };
    const service = new EmailService(config, sgMail as unknown as MailService);
    return { service, sgMail };
  }

  it('sends from the configured address and returns the client result', async () => {
    const { service, sgMail } = createService();

    const result = await service.sendEmail(
      'to@example.com',
      'Hi',
      '<p>Hi</p>',
      'Hi',
    );

    expect(result).toEqual([{ statusCode: 202 }, {}]);
    expect(sgMail.send).toHaveBeenCalledWith({
      to: 'to@example.com',
      from: 'noreply@example.com',
      subject: 'Hi',
      text: 'Hi',
      html: '<p>Hi</p>',
      attachments: undefined,
    });
  });

  it('passes attachments through', async () => {
    const { service, sgMail } = createService();
    const attachments = [
      { content: 'YQ==', filename: 'a.txt', type: 'text/plain' },
    ];

    await service.sendEmail('to@example.com', 's', 'h', 't', attachments);

    expect(sgMail.send.mock.calls[0][0].attachments).toBe(attachments);
  });

  it('propagates client failures', async () => {
    const { service, sgMail } = createService();
    sgMail.send.mockRejectedValue(new Error('Unauthorized'));

    await expect(
      service.sendEmail('to@example.com', 's', 'h', 't'),
    ).rejects.toThrow('Unauthorized');
  });
});
