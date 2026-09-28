import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// "A little note from Morex": a warm, handwritten-notebook email (same look as the app's bio notebook).
// `hello` gets the first name when we have it.
const CONFIRM_MAIL = {
  en: { subject: 'A little note from Morex \u{1F48C}', hello: (n: string) => (n ? `Hi ${n}!` : 'Hi there!'), body: 'Your Morex universe is waiting for you. Just click below to tell us it\u2019s really you, and we\u2019ll open the doors.', button: 'Yes, it\u2019s me', ignore: 'Not you? No worries, simply ignore this message: nothing is activated, and the pending account is deleted after 24 hours. You can also open the link and choose \u201cNo, it wasn\u2019t me\u201d.', valid: 'The link is valid for 24 hours.' },
  fr: { subject: 'Un petit mot de Morex \u{1F48C}', hello: (n: string) => (n ? `Coucou ${n}\u00a0!` : 'Coucou\u00a0!'), body: 'Ton univers Morex t\u2019attend. Clique juste ici pour nous dire que c\u2019est bien toi, et on ouvre les portes.', button: 'Oui, c\u2019est moi', ignore: 'Pas toi\u00a0? Aucun souci, ignore simplement ce message\u00a0: rien n\u2019est activ\u00e9, et le compte en attente est supprim\u00e9 apr\u00e8s 24\u00a0heures. Tu peux aussi ouvrir le lien et choisir \u00ab\u00a0Non, ce n\u2019\u00e9tait pas moi\u00a0\u00bb.', valid: 'Le lien est valable 24\u00a0heures.' },
  es: { subject: 'Una notita de Morex \u{1F48C}', hello: (n: string) => (n ? `\u00a1Hola ${n}!` : '\u00a1Hola!'), body: 'Tu universo Morex te espera. Haz clic aqu\u00ed para decirnos que eres t\u00fa, y abrimos las puertas.', button: 'S\u00ed, soy yo', ignore: '\u00bfNo fuiste t\u00fa? Tranquilo, simplemente ignora este mensaje: no se activa nada, y la cuenta pendiente se elimina tras 24 horas. Tambi\u00e9n puedes abrir el enlace y elegir \u00abNo, no fui yo\u00bb.', valid: 'El enlace vale 24 horas.' },
} as const;
const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

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

  async sendConfirmationEmail(to: string, confirmUrl: string, lang: 'en' | 'fr' | 'es' = 'en', firstName?: string | null): Promise<void> {
    const t = CONFIRM_MAIL[lang];
    const hello = t.hello((firstName ?? '').trim());
    // Both a text and an HTML part: HTML-only mail from a personal Gmail account is far more likely
    // to be filed as spam. The link only opens a page that asks "is this you?", it confirms nothing by itself.
    await this.deliver({
      to,
      subject: t.subject,
      text: `${hello}\n\n${t.body}\n${confirmUrl}\n\n${t.valid}\n${t.ignore}`,
      // "A little note": a cream notebook page with a pink tape strip, handwriting-style title and a violet
      // pill button (the app's bio notebook). Kept mail-client safe: tables, solid colours (the ruled lines are
      // a bonus background-image that simply disappears where unsupported), no backdrop-filter, no gradient
      // text, and a handwriting font list that falls back to a normal cursive/sans font.
      html: `<body style="margin:0;padding:32px 16px;background-color:#f3eefc;font-family:'Poppins',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;border-collapse:collapse">
<tr><td style="text-align:center;padding-bottom:14px"><span style="display:inline-block">${LOGO_SVG}</span><div style="letter-spacing:.16em;font-size:12px;text-transform:uppercase;color:#7c3aed;font-weight:700;margin-top:4px">Morex</div></td></tr>
<tr><td style="text-align:center;height:22px"><span style="display:inline-block;width:92px;height:22px;background-color:#f9a8d4;opacity:.8;border-radius:3px"></span></td></tr>
<tr><td style="background-color:#fffdf8;background-image:repeating-linear-gradient(transparent 0 27px,#efe8fb 27px 28px);border-radius:18px;padding:30px 28px;color:#3b2a63;text-align:center;border:1px solid #e9e2f7;hyphens:none;word-break:normal">
<h1 style="font-family:'Caveat','Segoe Script','Bradley Hand','Comic Sans MS',cursive;font-size:34px;line-height:1.2;margin:4px 0 12px;color:#7c3aed;font-weight:700">${escHtml(hello)}</h1>
<p style="line-height:1.7;font-size:15px;margin:0">${t.body}</p>
<table role="presentation" style="margin:26px auto 18px"><tr><td style="border-radius:999px;background-color:#7c3aed">
<a href="${confirmUrl}" style="display:inline-block;padding:14px 30px;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none;border-radius:999px">${t.button}</a>
</td></tr></table>
<p style="font-size:13px;color:#6d5a99;line-height:1.55;margin:0 0 8px">${t.valid}</p>
<p style="font-size:13px;color:#6d5a99;line-height:1.55;margin:0">${t.ignore}</p>
</td></tr>
<tr><td style="padding:14px 8px 0;text-align:center;font-size:11.5px;color:#8a80a6;word-break:break-all">${confirmUrl}</td></tr>
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
