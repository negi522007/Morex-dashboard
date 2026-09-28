import { langFromHeader, renderConfirmPage } from './confirm-page';

const TOKEN = 'a'.repeat(64);
const base = { token: TOKEN, frontendUrl: 'http://localhost:5173' };

describe('renderConfirmPage', () => {
  it('asks "is this you?" with both choices, showing only the masked address', () => {
    const html = renderConfirmPage({ ...base, lang: 'en', pending: { email: 'a***@gmail.com', firstName: 'Ada' } });
    expect(html).toContain('Is this you?');
    expect(html).toContain('a***@gmail.com');
    expect(html).toContain("send('/auth/confirm','ok')");
    expect(html).toContain("send('/auth/confirm/reject','removed')");
    expect(html).toContain('Nothing happens until you choose');
  });

  it('offers useful next steps after both answers, in the requested language', () => {
    const fr = renderConfirmPage({ ...base, lang: 'fr', pending: { email: 'a***@b.c', firstName: null } });
    expect(fr).toContain('Ton compte est confirmé');
    expect(fr).toContain('http://localhost:5173/login');
    expect(fr).toContain('Aucun compte n’a été créé');
    expect(fr).toContain('24 heures');
    const es = renderConfirmPage({ ...base, lang: 'es', pending: { email: 'a***@b.c', firstName: null } });
    expect(es).toContain('¿Eres tú?');
  });

  it('shows a helpful page (with a way forward) for an invalid or expired link, without any buttons that act', () => {
    const html = renderConfirmPage({ ...base, lang: 'en', pending: null });
    expect(html).toContain('this link has faded');
    expect(html).toContain('http://localhost:5173/register');
    expect(html).not.toContain('/auth/confirm/reject');
  });

  it('escapes user-controlled text and never injects a malformed token into the script', () => {
    const html = renderConfirmPage({ ...base, lang: 'en', token: '"></script><script>alert(1)</script>', pending: { email: 'x', firstName: '<img src=x onerror=alert(1)>' } });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('alert(1)</script>');
  });

  it('never uses an em dash in the copy, and matches the confirmation email (logo, Morex wordmark, the note with its violet button)', () => {
    for (const lang of ['en', 'fr', 'es'] as const) {
      const html = renderConfirmPage({ ...base, lang, pending: { email: 'a***@b.c', firstName: 'Ada' } });
      expect(html).not.toContain('—');
    }
    const html = renderConfirmPage({ ...base, lang: 'en', pending: { email: 'a***@b.c', firstName: null } });
    expect(html).toContain('aria-label="Morex"');
    expect(html).toContain('>Morex</div>');
    expect(html).toContain('.primary{background:#7c3aed');
    expect(html).toContain('Caveat');
  });

  it('no longer calls well-being a page (it is a widget group)', () => {
    const html = renderConfirmPage({ ...base, lang: 'en', pending: { email: 'a***@b.c', firstName: null } });
    expect(html).not.toMatch(/well-being page/i);
    expect(html).toContain('horoscope widget');
  });

  it('greets the person by first name, like the email', () => {
    expect(renderConfirmPage({ ...base, lang: 'fr', pending: { email: 'a***@b.c', firstName: 'Ada' } })).toContain('Coucou Ada\u00a0!');
    expect(renderConfirmPage({ ...base, lang: 'es', pending: { email: 'a***@b.c', firstName: 'Ada' } })).toContain('¡Hola Ada!');
    expect(renderConfirmPage({ ...base, lang: 'en', pending: { email: 'a***@b.c', firstName: null } })).toContain('<h1>Hi!</h1>');
  });

  it('picks the language from Accept-Language, defaulting to English', () => {
    expect(langFromHeader('fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(langFromHeader('es')).toBe('es');
    expect(langFromHeader('de-DE')).toBe('en');
    expect(langFromHeader(undefined)).toBe('en');
  });
});
