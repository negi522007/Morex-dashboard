// The page behind the link in the confirmation email. Server-rendered on purpose: it must work
// without the frontend being involved, and it only *asks* (the two buttons call
// POST /auth/confirm and POST /auth/confirm/reject). A React page can replace it: set CONFIRM_PAGE_URL.
// Styled as the same "little note" as the confirmation email (mail.service.ts): a cream notebook page with a
// pink tape strip, a handwritten title and a violet button, so the email and this page read as one story.

export type PageLang = 'en' | 'fr' | 'es';

// Written with "tu" like the rest of the app. French uses non-breaking spaces before ? ! : (\u00a0).
const T: Record<PageLang, Record<string, string>> = {
  en: {
    hello: 'Hi', askTitle: 'Is this you?', askHello: 'Someone used', askFor: 'to create a Morex account',
    yes: 'Yes, it’s me 💜', no: 'No, it wasn’t me', askNote: 'Nothing happens until you choose · the link is valid for 24 hours',
    okTitle: 'Welcome aboard! 🎉', okText: 'Your account is confirmed, you can sign in now.', signIn: 'Sign in',
    okTips: 'To get started:', tip1: 'Add your first widgets: weather, news, your GitHub.', tip2: 'Add your birth date to your profile: it fills in your sign on the horoscope widget.', tip3: 'Connect GitHub or Microsoft to get more widgets.',
    sign: 'The Morex team ♡',
    noTitle: 'Got it 🛡️', noText: 'No account was created, and the request has been deleted.',
    no1: 'Nobody can use your address without clicking this confirmation link.', no2: 'We won’t send any sign-up email to this address for 24 hours.', no3: 'If you did want an account: sign up again tomorrow, or use GitHub or your school Microsoft account.',
    close: 'You can close this page ♡',
    badTitle: 'Oops, this link has faded 🥀', badText: 'It was already used, or it is older than 24 hours.', badHand: 'No worries, shall we start again?', badTip: 'Sign up again with the same address and a new email will be sent.', signUp: 'Sign up again',
    err: 'Something went wrong. Please try again.',
  },
  fr: {
    hello: 'Coucou', askTitle: 'C’est bien toi ?', askHello: 'Quelqu’un a utilisé', askFor: 'pour créer un compte Morex',
    yes: 'Oui, c’est moi 💜', no: 'Non, ce n’était pas moi', askNote: 'Rien ne se passe tant que tu n’as pas choisi · le lien est valable 24 heures',
    okTitle: 'Bienvenue à bord ! 🎉', okText: 'Ton compte est confirmé, tu peux te connecter.', signIn: 'Me connecter',
    okTips: 'Pour bien commencer :', tip1: 'Ajoute tes premiers widgets : météo, actus, ton GitHub.', tip2: 'Mets ta date de naissance dans ton profil : elle remplit ton signe sur le widget horoscope.', tip3: 'Connecte GitHub ou Microsoft pour avoir plus de widgets.',
    sign: 'L’équipe Morex ♡',
    noTitle: 'C’est noté 🛡️', noText: 'Aucun compte n’a été créé, et la demande a été supprimée.',
    no1: 'Personne ne peut utiliser ton adresse sans cliquer sur ce lien de confirmation.', no2: 'On ne t’enverra plus d’email d’inscription à cette adresse pendant 24 heures.', no3: 'Si tu voulais bien un compte : réinscris-toi demain, ou passe par GitHub ou ton compte Microsoft d’école.',
    close: 'Tu peux fermer cette page ♡',
    badTitle: 'Oups, ce lien a fané 🥀', badText: 'Il a déjà été utilisé, ou il a plus de 24 heures.', badHand: 'Pas grave, on recommence ?', badTip: 'Réinscris-toi avec la même adresse : un nouvel email partira.', signUp: 'M’inscrire à nouveau',
    err: 'Une erreur est survenue. Réessaie.',
  },
  es: {
    hello: 'Hola', askTitle: '¿Eres tú?', askHello: 'Alguien ha usado', askFor: 'para crear una cuenta de Morex',
    yes: 'Sí, soy yo 💜', no: 'No, no fui yo', askNote: 'No pasa nada hasta que elijas · el enlace vale 24 horas',
    okTitle: '¡Bienvenido a bordo! 🎉', okText: 'Tu cuenta está confirmada, ya puedes iniciar sesión.', signIn: 'Iniciar sesión',
    okTips: 'Para empezar:', tip1: 'Añade tus primeros widgets: el tiempo, noticias, tu GitHub.', tip2: 'Pon tu fecha de nacimiento en tu perfil: rellena tu signo en el widget de horóscopo.', tip3: 'Conecta GitHub o Microsoft para tener más widgets.',
    sign: 'El equipo de Morex ♡',
    noTitle: 'Anotado 🛡️', noText: 'No se creó ninguna cuenta, y la solicitud se eliminó.',
    no1: 'Nadie puede usar tu dirección sin pulsar este enlace de confirmación.', no2: 'No enviaremos ningún email de registro a esta dirección durante 24 horas.', no3: 'Si sí querías una cuenta: regístrate de nuevo mañana, o usa GitHub o tu cuenta Microsoft de la escuela.',
    close: 'Puedes cerrar esta página ♡',
    badTitle: 'Uy, este enlace se ha marchitado 🥀', badText: 'Ya se usó, o tiene más de 24 horas.', badHand: 'No pasa nada, ¿empezamos de nuevo?', badTip: 'Regístrate otra vez con la misma dirección y se enviará un email nuevo.', signUp: 'Registrarme de nuevo',
    err: 'Algo salió mal. Inténtalo de nuevo.',
  },
};

export const asPageLang = (v: unknown): PageLang => (v === 'fr' || v === 'es' ? v : 'en');

// Accept-Language: "fr-FR,fr;q=0.9,en;q=0.8" → 'fr'
export function langFromHeader(header: unknown): PageLang {
  const first = String(header ?? '').split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return asPageLang(first);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// The app's own eye/orbit mark (frontend/public/logo.svg), inlined.
const LOGO_SVG = `<svg width="34" height="26" viewBox="0 12 100 76" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Morex">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a5b4fc"/><stop offset=".5" stop-color="#818cf8"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>
<path d="M50 50C60 26 94 20 94 50C94 80 60 74 50 50C40 26 6 20 6 50C6 80 40 74 50 50Z" fill="none" stroke="url(#g)" stroke-width="7" stroke-linejoin="round"/>
<circle cx="50" cy="50" r="15" fill="#0b1026"/><circle cx="50" cy="50" r="12" fill="#38bdf8" stroke="#c7d2fe" stroke-width="2"/>
<circle cx="50" cy="50" r="5" fill="#020617"/><circle cx="54" cy="46" r="2.5" fill="#fff"/>
</svg>`;

export interface PageInput {
  lang: PageLang;
  token: string;
  // null = the link is invalid or expired
  pending: { email: string; firstName: string | null } | null;
  frontendUrl: string;
}

export function renderConfirmPage({ lang, token, pending, frontendUrl }: PageInput): string {
  const t = T[lang];
  const safeToken = /^[a-f0-9]{64}$/.test(token) ? token : '';
  const login = `${frontendUrl}/login`;
  const register = `${frontendUrl}/register`;
  const section = (id: string, hidden: boolean, inner: string) => `<section id="${id}"${hidden ? ' hidden' : ''}>${inner}</section>`;

  const hello = pending?.firstName ? `${t.hello} ${esc(pending.firstName)}${lang === 'fr' ? '\u00a0!' : '!'}` : `${t.hello}${lang === 'fr' ? '\u00a0!' : '!'}`;
  const ask = pending
    ? section('ask', false, `
      <h1>${lang === 'es' ? '¡' : ''}${hello}</h1>
      <p>${t.askHello} <strong>${esc(pending.email)}</strong> ${t.askFor}.</p>
      <p class="hand">${t.askTitle} ✿</p>
      <div class="actions">
        <button class="primary" id="yes">${t.yes}</button>
        <button class="ghost" id="no">${t.no}</button>
      </div>
      <p class="small">${t.askNote}</p><p class="error" id="err" hidden>${t.err}</p>`)
    : section('bad', false, `
      <h1>${t.badTitle}</h1><p>${t.badText}</p><p class="hand">${t.badHand}</p><p class="small">${t.badTip}</p>
      <div class="actions"><a class="primary" href="${esc(register)}">${t.signUp}</a></div>`);

  const ok = section('ok', true, `
    <h1>${t.okTitle}</h1><p>${t.okText}</p>
    <div class="actions"><a class="primary" href="${esc(login)}">${t.signIn}</a></div>
    <p class="hand">${t.okTips}</p><ul><li>${t.tip1}</li><li>${t.tip2}</li><li>${t.tip3}</li></ul><p class="sig">${t.sign}</p>`);

  const removed = section('removed', true, `
    <h1>${t.noTitle}</h1><p>${t.noText}</p>
    <ul><li>${t.no1}</li><li>${t.no2}</li><li>${t.no3}</li></ul><p class="sig">${t.close}</p>`);

  const script = pending && safeToken
    ? `<script>
const token=${JSON.stringify(safeToken)};
const show=(id)=>{for(const s of document.querySelectorAll('section'))s.hidden=s.id!==id};
async function send(path,next){
  document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{
    const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
    if(!r.ok)throw new Error(String(r.status));
    show(next);
  }catch(e){document.getElementById('err').hidden=false;document.querySelectorAll('button').forEach(b=>b.disabled=false)}
}
document.getElementById('yes').onclick=()=>send('/auth/confirm','ok');
document.getElementById('no').onclick=()=>send('/auth/confirm/reject','removed');
</script>`
    : '';

  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Morex</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light}
*{box-sizing:border-box;hyphens:none;-webkit-hyphens:none}
html{background:#1e1b4b}
body{margin:0;min-height:100vh;overflow-x:hidden;display:grid;place-items:center;padding:34px 18px;font:15px/1.6 Poppins,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#3b2f5c;
background:radial-gradient(900px 500px at 15% -10%,rgba(167,139,250,.4),transparent),radial-gradient(800px 500px at 105% 105%,rgba(244,114,182,.25),transparent) fixed,#1e1b4b}
main{position:relative;width:100%;max-width:440px;padding:44px 34px 30px 44px;border-radius:6px;text-align:center;transform:rotate(-1deg);
background:repeating-linear-gradient(#fffaf0 0 29px,#e9dcf7 29px 30px);box-shadow:0 24px 60px rgba(0,0,0,.45)}
main::before{content:'';position:absolute;top:-13px;left:50%;width:120px;height:28px;margin-left:-60px;background:rgba(244,114,182,.75);transform:rotate(-3deg)}
main::after{content:'';position:absolute;left:28px;top:0;bottom:0;border-left:2px solid rgba(244,114,182,.35)}
.brand{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:16px;letter-spacing:.14em;text-transform:uppercase;color:#7c3aed;margin-bottom:10px}
h1{margin:4px 0 8px;font:700 38px/1.15 Caveat,'Segoe Script','Bradley Hand',cursive;color:#7c3aed}
p{margin:8px 0}strong{color:#1e1b4b;word-break:break-all}
.hand{font:500 23px/1.3 Caveat,'Segoe Script','Bradley Hand',cursive;color:#3b2f5c;margin-top:14px}
.small{font-size:12px;opacity:.7}
.sig{font:500 21px/1.3 Caveat,'Segoe Script','Bradley Hand',cursive;text-align:right;margin-top:14px}
ul{text-align:left;margin:6px 0 0;padding-left:20px;font-size:14px}li{margin:6px 0}
.actions{display:grid;gap:10px;margin:20px 0 10px}
button,a.primary{font:inherit;font-weight:600;font-size:15px;border-radius:999px;padding:13px 20px;cursor:pointer;text-decoration:none;display:block;border:0}
.primary{background:#7c3aed;color:#fff;box-shadow:0 10px 22px rgba(124,58,237,.35)}
.ghost{background:transparent;color:#7c3aed;border:1.5px dashed #c4b5fd}
button:hover:not(:disabled),a.primary:hover{filter:brightness(1.07)}button:disabled{opacity:.55;cursor:wait}
button:focus-visible,a:focus-visible{outline:3px solid #f472b6;outline-offset:2px}
.error{color:#b91c1c;background:#fee2e2;border-radius:10px;padding:8px 12px}
@media (max-width:480px){main{padding:40px 22px 26px 36px;transform:none}main::after{left:20px}h1{font-size:33px}}
</style></head>
<body><main><div class="brand">${LOGO_SVG}Morex</div>${ask}${ok}${removed}</main>${script}</body></html>`;
}
