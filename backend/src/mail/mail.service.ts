import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 1025);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'mailhog',
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.from = this.config.get<string>('SMTP_FROM') ?? 'dashboard@localhost';
  }

  // nodemailer resolves even when the SMTP server refused a recipient, so the
  // outcome is checked explicitly: a refused address is a failure, not a success.
  private async deliver(message: nodemailer.SendMailOptions): Promise<void> {
    const info = await this.transporter.sendMail({ from: this.from, ...message });
    const rejected = (info.rejected ?? []) as unknown[];
    if (rejected.length > 0) {
      this.logger.warn(`SMTP refused ${rejected.length} recipient(s) for "${message.subject}": ${info.response}`);
      throw new Error('The mail server refused the recipient address');
    }
    this.logger.log(`Mail "${message.subject}" accepted by the SMTP server (${info.response})`);
  }

  async sendConfirmationEmail(to: string, confirmUrl: string): Promise<void> {
    // Both a text and an HTML part: HTML-only mail from a personal Gmail account is
    // far more likely to be filed as spam.
    await this.deliver({
      to,
      subject: 'Confirm your Dashboard account',
      text: `Welcome to Dashboard!\n\nOpen this link to confirm your account and sign in:\n${confirmUrl}\n\nThe link is valid for 24 hours. If you did not create this account, ignore this message.`,
      html: `<p>Welcome to Dashboard!</p><p>Click the link below to confirm your account and sign in:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>The link is valid for 24 hours. If you did not create this account, ignore this message.</p>`,
    });
  }

  async sendAlertEmail(to: string, subject: string, message: string): Promise<void> {
    const escaped = message.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    await this.deliver({
      to,
      subject,
      text: message,
      html: `<p>${escaped}</p>`,
    });
  }
}
