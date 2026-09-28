import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const CONFIRM_MAIL = {
  en: { subject: 'Confirm your Morex account', hello: 'Welcome to Morex!', body: 'Someone used this address to create an account. Open the link below and tell us whether it was you. Nothing is activated until you do. The link is valid for 24 hours.', button: 'Review and confirm', ignore: 'Wasn\u2019t you? Open the link and choose \u201cNo, it wasn\u2019t me\u201d, or simply ignore this email. Without your confirmation the account is never activated, and it is deleted after 24 hours.' },
  fr: { subject: 'Confirmez votre compte Morex', hello: 'Bienvenue sur Morex\u00a0!', body: 'Quelqu\u2019un a utilis\u00e9 cette adresse pour cr\u00e9er un compte. Ouvrez le lien ci-dessous et dites-nous si c\u2019\u00e9tait bien vous. Rien n\u2019est activ\u00e9 avant. Le lien est valable 24\u00a0heures.', button: 'V\u00e9rifier et confirmer', ignore: 'Ce n\u2019\u00e9tait pas vous\u00a0? Ouvrez le lien et choisissez \u00ab\u00a0Non, ce n\u2019\u00e9tait pas moi\u00a0\u00bb, ou ignorez simplement cet email. Sans votre confirmation, le compte n\u2019est jamais activ\u00e9 et il est supprim\u00e9 apr\u00e8s 24\u00a0heures.' },
  es: { subject: 'Confirma tu cuenta de Morex', hello: '\u00a1Bienvenido a Morex!', body: 'Alguien ha usado esta direcci\u00f3n para crear una cuenta. Abre el enlace de abajo y dinos si fuiste t\u00fa. No se activa nada antes. El enlace vale 24 horas.', button: 'Revisar y confirmar', ignore: '\u00bfNo fuiste t\u00fa? Abre el enlace y elige \u00abNo, no fui yo\u00bb, o simplemente ignora este email. Sin tu confirmaci\u00f3n, la cuenta nunca se activa y se elimina tras 24 horas.' },
} as const;

// The eye/orbit mark from the app's own logo (frontend/public/logo.svg), inlined so it renders with no
// external image request (many mail clients block remote images until the user allows them).
const LOGO_SVG =
  '<svg width="40" height="30" viewBox="0 12 100 76" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Morex">' +
  '<path d="M50 50C60 26 94 20 94 50C94 80 60 74 50 50C40 26 6 20 6 50C6 80 40 74 50 50Z" fill="none" stroke="#a5b4fc" stroke-width="7" stroke-linejoin="round"/>' +
  '<circle cx="50" cy="50" r="15" fill="#0b1026"/><circle cx="50" cy="50" r="12" fill="#38bdf8" stroke="#c7d2fe" stroke-width="2"/>' +
  '<circle cx="50" cy="50" r="5" fill="#020617"/><circle cx="54" cy="46" r="2.5" fill="#fff"/>' +
  '</svg>';

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
      // The app's own colours (Morex: slate-950 background, indigo/sky accent, a white pill button) and
      // its logo, inlined below. Kept deliberately simple (no backdrop-filter, no web font, no CSS gradient
      // text) because those either don't render or actively break in Outlook/older mail clients; a solid
      // dark card with a solid white button degrades safely everywhere.
      html: `<body style="margin:0;padding:32px 16px;background-color:#020617;font-family:'Poppins',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse">
<tr><td style="background-color:#11162e;border:1px solid #2a3158;border-radius:24px;padding:36px 32px;color:#eef0ff;hyphens:none;word-break:normal">
<div style="text-align:center;margin-bottom:18px">${LOGO_SVG}</div>
<div style="text-align:center;letter-spacing:.16em;font-size:12px;text-transform:uppercase;color:#a5b4fc;font-weight:700">Morex</div>
<h1 style="font-size:24px;margin:16px 0 10px;text-align:center;color:#fff">${t.hello}</h1>
<p style="line-height:1.6;color:#c9cdf2;font-size:15px">${t.body}</p>
<table role="presentation" style="margin:28px auto"><tr><td style="border-radius:999px;background-color:#ffffff">
<a href="${confirmUrl}" style="display:inline-block;padding:15px 28px;font-weight:600;font-size:15px;color:#1e1b4b;text-decoration:none;border-radius:999px">${t.button}</a>
</td></tr></table>
<p style="font-size:13px;color:#9aa1cf;line-height:1.5">${t.ignore}</p>
<p style="font-size:12px;color:#6b73a8;word-break:break-all">${confirmUrl}</p>
</td></tr>
</table>
</body>`,
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
