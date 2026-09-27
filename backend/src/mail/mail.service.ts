import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const CONFIRM_MAIL = {
  en: { subject: 'Confirm your Morex Dashboard account', hello: 'Welcome to Morex Dashboard!', body: 'Someone used this address to create an account. Open the link below and tell us whether it was you — nothing is activated until you do. The link is valid for 24 hours.', button: 'Review and confirm', ignore: 'Wasn’t you? Open the link and choose “No, it wasn’t me”, or simply ignore this email: without your confirmation the account is never activated and is deleted after 24 hours.' },
  fr: { subject: 'Confirmez votre compte Morex Dashboard', hello: 'Bienvenue sur Morex Dashboard !', body: 'Quelqu’un a utilisé cette adresse pour créer un compte. Ouvrez le lien ci-dessous et dites-nous si c’était bien vous — rien n’est activé avant. Le lien est valable 24 heures.', button: 'Vérifier et confirmer', ignore: 'Ce n’était pas vous ? Ouvrez le lien et choisissez « Non, ce n’était pas moi », ou ignorez simplement cet email : sans votre confirmation le compte n’est jamais activé et il est supprimé après 24 heures.' },
  es: { subject: 'Confirma tu cuenta de Morex Dashboard', hello: '¡Bienvenido a Morex Dashboard!', body: 'Alguien ha usado esta dirección para crear una cuenta. Abre el enlace y dinos si fuiste tú — no se activa nada antes. El enlace vale 24 horas.', button: 'Revisar y confirmar', ignore: '¿No fuiste tú? Abre el enlace y elige «No, no fui yo», o simplemente ignora este email: sin tu confirmación la cuenta nunca se activa y se elimina tras 24 horas.' },
} as const;

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
      // Fail fast instead of hanging a sign-up request for minutes when the mail server is slow or
      // unreachable: the register call then answers 503 and can simply be retried.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
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

  async sendConfirmationEmail(to: string, confirmUrl: string, lang: 'en' | 'fr' | 'es' = 'en'): Promise<void> {
    const t = CONFIRM_MAIL[lang];
    // Both a text and an HTML part: HTML-only mail from a personal Gmail account is far more likely
    // to be filed as spam. The link only opens a page that asks "is this you?" — it confirms nothing by itself.
    await this.deliver({
      to,
      subject: t.subject,
      text: `${t.hello}\n\n${t.body}\n${confirmUrl}\n\n${t.ignore}`,
      html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;background:#0b1030;padding:32px 16px">
<div style="max-width:480px;margin:0 auto;background:#161b45;border-radius:20px;padding:32px;color:#eef0ff">
<div style="letter-spacing:.14em;font-size:12px;text-transform:uppercase;color:#9db4ff;font-weight:700">Morex Dashboard</div>
<h1 style="font-size:24px;margin:14px 0 8px">${t.hello}</h1>
<p style="line-height:1.55;color:#dfe3ff">${t.body}</p>
<p style="margin:26px 0"><a href="${confirmUrl}" style="background:#5b8cff;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;display:inline-block">${t.button}</a></p>
<p style="font-size:13px;color:#b8bfe0;line-height:1.5">${t.ignore}</p>
<p style="font-size:12px;color:#8a92c4;word-break:break-all">${confirmUrl}</p>
</div></div>`,
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
