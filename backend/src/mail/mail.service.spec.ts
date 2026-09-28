import { MailService } from './mail.service';

jest.mock('nodemailer');
import * as nodemailer from 'nodemailer';

function make() {
  const sendMail = jest.fn().mockResolvedValue({ rejected: [], response: '250 OK' });
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  const config: any = { get: (k: string) => ({ SMTP_HOST: 'mailhog', SMTP_FROM: 'a@b.c' } as Record<string, string>)[k] };
  return { sendMail, svc: new MailService(config) };
}

describe('MailService.sendConfirmationEmail', () => {
  it('never uses an em dash in the copy, in any language', async () => {
    const { svc, sendMail } = make();
    for (const lang of ['en', 'fr', 'es'] as const) {
      await svc.sendConfirmationEmail('to@test.dev', 'https://x/y', lang);
      const { text, html } = sendMail.mock.calls[sendMail.mock.calls.length - 1][0];
      expect(text).not.toContain('—');
      expect(html).not.toContain('—');
    }
  });

  it('matches the app’s own branding: the inlined logo, the Morex wordmark, and a violet pill button', async () => {
    const { svc, sendMail } = make();
    await svc.sendConfirmationEmail('to@test.dev', 'https://x/y?token=abc', 'en');
    const { html, subject } = sendMail.mock.calls[0][0];
    expect(subject).toContain('Morex');
    expect(html).toContain('aria-label="Morex"');
    expect(html).toContain('background-color:#7c3aed');
    expect(html).toContain('https://x/y?token=abc');
  });

  it('greets by first name when known, escaped, and stays friendly without one', async () => {
    const { svc, sendMail } = make();
    await svc.sendConfirmationEmail('to@test.dev', 'https://x/y', 'fr', 'Asake');
    expect(sendMail.mock.calls[0][0].html).toContain('Coucou Asake');
    expect(sendMail.mock.calls[0][0].text).toContain('Coucou Asake');
    await svc.sendConfirmationEmail('to@test.dev', 'https://x/y', 'en', '<b>x</b>');
    expect(sendMail.mock.calls[1][0].html).toContain('Hi &lt;b&gt;x&lt;/b&gt;!');
    await svc.sendConfirmationEmail('to@test.dev', 'https://x/y', 'es');
    expect(sendMail.mock.calls[2][0].html).toContain('¡Hola!');
  });

  it('avoids CSS that commonly breaks in mail clients (no backdrop-filter, no background-clip text), and disables auto-hyphenation', async () => {
    const { svc, sendMail } = make();
    await svc.sendConfirmationEmail('to@test.dev', 'https://x/y', 'en');
    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain('backdrop-filter');
    expect(html).not.toContain('background-clip');
    expect(html).toContain('hyphens:none');
  });

  it('reports a failure when the SMTP server refuses the recipient, instead of resolving silently', async () => {
    const { svc, sendMail } = make();
    sendMail.mockResolvedValue({ rejected: ['to@test.dev'], response: '550 no such user' });
    await expect(svc.sendConfirmationEmail('to@test.dev', 'https://x/y')).rejects.toThrow(/refused/);
  });
});
