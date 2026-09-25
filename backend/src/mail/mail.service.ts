import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

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

  async sendConfirmationEmail(to: string, confirmUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Confirm your Dashboard account',
      html: `<p>Click the link below to confirm your account and sign in:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
    });
  }

  async sendAlertEmail(to: string, subject: string, message: string): Promise<void> {
    const escaped = message.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text: message,
      html: `<p>${escaped}</p>`,
    });
  }
}
