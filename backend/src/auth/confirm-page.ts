// The page behind the link in the confirmation email. Server-rendered on purpose: it must work
// without the frontend being involved, and it only *asks* (the two buttons call
// POST /auth/confirm and POST /auth/confirm/reject). A React page can replace it: set CONFIRM_PAGE_URL.
// Styled as the app's own sky (the login background, a glass card) with the same constellation as the
// sign-up screen: stars that draw an envelope. It lights up gold on "yes", fades out on "no" and
// flickers when the link is dead, so each answer has its own little moment.

export type PageLang = 'en' | 'fr' | 'es';

// Written with "tu" like the rest of the app. French uses non-breaking spaces before ? ! : ( ).
const T: Record<PageLang, Record<string, string>> = {
  en: {
    askTitle: 'Is this you?', askTitleName: 'Is this you, {name}?', askHello: 'Someone used', askFor: 'to create a Morex account',
    yes: 'Yes, it’s me', no: 'No, it wasn’t me', askNote: 'Nothing happens until you choose · the link is valid for 24 hours',
    okTitle: 'Your star is lit ✨', okText: 'Your account is confirmed, welcome to the Morex universe.', signIn: 'Sign in',
    tip1: 'Add your first widgets: weather, news, your GitHub.', tip2: 'Add your birth date to your profile: it fills in your sign on the horoscope widget.', tip3: 'Connect GitHub or Microsoft to get more widgets.',
    noTitle: 'Star switched off 🛡️', noText: 'No account was created, and the request has been deleted.',
    no1: 'Nobody can use your address without clicking this confirmation link.', no2: 'We won’t send any sign-up email to this address for 24 hours.', no3: 'If you did want an account: sign up again tomorrow, or use GitHub or your school Microsoft account.',
    close: 'You can close this page.',
    badTitle: 'This link got lost in space', badText: 'It was already used, or it is older than 24 hours.', badTip: 'Sign up again with the same address and a new email will be sent.', signUp: 'Sign up again',
    err: 'Something went wrong. Please try again.',
  },
  fr: {
    askTitle: 'C’est bien toi ?', askTitleName: 'C’est bien toi, {name} ?', askHello: 'Quelqu’un a utilisé', askFor: 'pour créer un compte Morex',
    yes: 'Oui, c’est moi', no: 'Non, ce n’était pas moi', askNote: 'Rien ne se passe tant que tu n’as pas choisi · le lien est valable 24 heures',
    okTitle: 'Ton étoile est allumée ✨', okText: 'Ton compte est confirmé, bienvenue dans l’univers Morex.', signIn: 'Me connecter',
    tip1: 'Ajoute tes premiers widgets : météo, actus, ton GitHub.', tip2: 'Mets ta date de naissance dans ton profil : elle remplit ton signe sur le widget horoscope.', tip3: 'Connecte GitHub ou Microsoft pour avoir plus de widgets.',
    noTitle: 'Étoile éteinte 🛡️', noText: 'Aucun compte n’a été créé, et la demande a été supprimée.',
    no1: 'Personne ne peut utiliser ton adresse sans cliquer sur ce lien de confirmation.', no2: 'On ne t’enverra plus d’email d’inscription à cette adresse pendant 24 heures.', no3: 'Si tu voulais bien un compte : réinscris-toi demain, ou passe par GitHub ou ton compte Microsoft d’école.',
    close: 'Tu peux fermer cette page.',
    badTitle: 'Ce lien s’est perdu dans l’espace', badText: 'Il a déjà été utilisé, ou il a plus de 24 heures.', badTip: 'Réinscris-toi avec la même adresse : un nouvel email partira.', signUp: 'M’inscrire à nouveau',
    err: 'Une erreur est survenue. Réessaie.',
  },
  es: {
    askTitle: '¿Eres tú?', askTitleName: '¿Eres tú, {name}?', askHello: 'Alguien ha usado', askFor: 'para crear una cuenta de Morex',
    yes: 'Sí, soy yo', no: 'No, no fui yo', askNote: 'No pasa nada hasta que elijas · el enlace vale 24 horas',
    okTitle: 'Tu estrella está encendida ✨', okText: 'Tu cuenta está confirmada, bienvenido al universo Morex.', signIn: 'Iniciar sesión',
    tip1: 'Añade tus primeros widgets: el tiempo, noticias, tu GitHub.', tip2: 'Pon tu fecha de nacimiento en tu perfil: rellena tu signo en el widget de horóscopo.', tip3: 'Conecta GitHub o Microsoft para tener más widgets.',
    noTitle: 'Estrella apagada 🛡️', noText: 'No se creó ninguna cuenta, y la solicitud se eliminó.',
    no1: 'Nadie puede usar tu dirección sin pulsar este enlace de confirmación.', no2: 'No enviaremos ningún email de registro a esta dirección durante 24 horas.', no3: 'Si sí querías una cuenta: regístrate de nuevo mañana, o usa GitHub o tu cuenta Microsoft de la escuela.',
    close: 'Puedes cerrar esta página.',
    badTitle: 'Este enlace se perdió en el espacio', badText: 'Ya se usó, o tiene más de 24 horas.', badTip: 'Regístrate otra vez con la misma dirección y se enviará un email nuevo.', signUp: 'Registrarme de nuevo',
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

// The envelope constellation (same drawing as the sign-up screen): 4 corners + the flap's tip, then the lines between them.
// `mood` picks its look: 'ask' draws itself in a loop, 'ok' is gold with a wave, 'no' is faded, 'bad' flickers.
const STARS = [[35, 30], [195, 30], [195, 125], [35, 125], [115, 82]];
const LINKS = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]];
function constellation(mood: 'ask' | 'ok' | 'no' | 'bad'): string {
  const dust = Array.from({ length: 14 }, (_, i) => `<circle class="dust" cx="${(i * 53) % 230}" cy="${(i * 37) % 150}" r="${i % 4 ? 0.8 : 1.3}" style="animation-delay:${(i % 6) * 0.5}s"/>`).join('');
  const lines = LINKS.map(([a, b], i) => `<line x1="${STARS[a][0]}" y1="${STARS[a][1]}" x2="${STARS[b][0]}" y2="${STARS[b][1]}" style="animation-delay:${i * 0.25}s"/>`).join('');
  const stars = STARS.map(([x, y], i) => `<circle class="st" cx="${x}" cy="${y}" r="3.2" style="animation-delay:${i * 0.4}s"/>`).join('');
  const wave = mood === 'ok' ? '<circle class="burst" cx="115" cy="82" r="20"/>' : '';
  return `<svg class="sky ${mood}" viewBox="0 0 230 150" aria-hidden="true">${dust}${lines}${stars}${wave}</svg>`;
}

// Gold and violet stars falling over the page once the account is confirmed
const SHOWER = `<div class="shower" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="left:${(i * 41) % 100}%;font-size:${10 + (i % 3) * 5}px;color:${['#fde047', '#c4b5fd', '#f0abfc', '#7dd3fc'][i % 4]};animation-delay:${(i % 8) * 0.35}s">✦</i>`).join('')}</div>`;

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

  const title = pending?.firstName ? t.askTitleName.replace('{name}', esc(pending.firstName)) : t.askTitle;
  const ask = pending
    ? section('ask', false, `
      ${constellation('ask')}<h1>${title}</h1>
      <p>${t.askHello} <strong>${esc(pending.email)}</strong> ${t.askFor}.</p>
      <div class="actions">
        <button class="primary" id="yes">${t.yes}</button>
        <button class="ghost" id="no">${t.no}</button>
      </div>
      <p class="small">${t.askNote}</p><p class="error" id="err" hidden>${t.err}</p>`)
    : section('bad', false, `
      ${constellation('bad')}<h1>${t.badTitle}</h1><p>${t.badText}</p><p class="muted">${t.badTip}</p>
      <div class="actions"><a class="primary" href="${esc(register)}">${t.signUp}</a></div>`);

  const ok = section('ok', true, `
    ${SHOWER}${constellation('ok')}<h1>${t.okTitle}</h1><p>${t.okText}</p>
    <div class="actions"><a class="primary" href="${esc(login)}">${t.signIn}</a></div>
    <ul><li>${t.tip1}</li><li>${t.tip2}</li><li>${t.tip3}</li></ul>`);

  const removed = section('removed', true, `
    ${constellation('no')}<h1>${t.noTitle}</h1><p>${t.noText}</p>
    <ul><li>${t.no1}</li><li>${t.no2}</li><li>${t.no3}</li></ul><p class="small">${t.close}</p>`);

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

  // The app's login background (served by the frontend); the dark gradient underneath shows if it can't load
  const bg = esc(`${frontendUrl}/accueil_photo.jpg`);
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Morex</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark}
*{box-sizing:border-box;hyphens:none;-webkit-hyphens:none}
html{background:#020617}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px 18px;overflow-x:hidden;font:15px/1.6 Poppins,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef0ff;
background:linear-gradient(rgba(2,6,23,.35),rgba(15,12,50,.6)),url("${bg}") 50% 30%/cover fixed,radial-gradient(900px 500px at 15% -10%,rgba(129,140,248,.35),transparent),#020617}
main{width:100%;max-width:420px;padding:28px 28px 24px;border-radius:30px;text-align:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);
backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 24px 60px rgba(0,0,0,.45)}
.brand{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:16px}
h1{margin:4px 0 6px;font:700 34px/1.15 Caveat,'Segoe Script','Bradley Hand',cursive;color:#fff}
p{margin:6px 0;color:rgba(255,255,255,.85);font-size:14px}strong{color:#fff;word-break:break-all}
.muted{color:rgba(255,255,255,.7)}.small{font-size:12px;opacity:.65;margin-top:10px}
ul{text-align:left;margin:12px 0 0;padding-left:20px;font-size:13px;color:rgba(255,255,255,.82)}li{margin:5px 0}
.actions{display:grid;gap:10px;margin:18px 0 6px}
button,a.primary{font:inherit;font-weight:600;font-size:15px;border-radius:999px;padding:13px 20px;cursor:pointer;text-decoration:none;display:block;border:0}
.primary{background:#fff;color:#1e1b4b;box-shadow:0 10px 24px rgba(167,139,250,.3)}
.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.3)}
button:hover:not(:disabled),a.primary:hover{filter:brightness(.95)}button:disabled{opacity:.55;cursor:wait}
button:focus-visible,a:focus-visible{outline:3px solid #c4b5fd;outline-offset:2px}
.error{color:#ffb4b4;background:rgba(92,29,29,.45);border-radius:10px;padding:8px 12px}
/* the constellation */
.sky{display:block;width:230px;max-width:100%;height:150px;margin:6px auto 0;overflow:visible}
.sky .dust{fill:#fff;animation:tw 3s ease-in-out infinite}
.sky line{stroke:rgba(196,181,253,.85);stroke-width:1.5;stroke-dasharray:200;stroke-dashoffset:200;filter:drop-shadow(0 0 3px #a78bfa);animation:draw 6s ease-in-out infinite}
.sky .st{fill:#fff;filter:drop-shadow(0 0 5px #fff);animation:tw 2.4s ease-in-out infinite}
.sky.ok line{stroke:#fde047;filter:drop-shadow(0 0 5px #fde047);animation:none;stroke-dashoffset:0}
.sky.ok .st{fill:#fde047;filter:drop-shadow(0 0 8px #fde047)}
.sky .burst{fill:none;stroke:#fde047;stroke-width:1.5;transform-box:fill-box;transform-origin:center;animation:burst 1.8s ease-out infinite}
.sky.no line{stroke:rgba(255,255,255,.18);animation:none;stroke-dashoffset:0;filter:none}
.sky.no .st{fill:rgba(255,255,255,.3);filter:none;animation:tw 3s ease-in-out infinite}
.sky.bad line{stroke-dashoffset:0;animation:flick 2.2s steps(1) infinite}
.sky.bad .st{transform-box:fill-box;animation:drift 4s ease-in-out infinite}
@keyframes tw{50%{opacity:.2}}
@keyframes draw{0%{stroke-dashoffset:200;opacity:1}45%,85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes burst{from{transform:scale(.3);opacity:1}to{transform:scale(2.4);opacity:0}}
@keyframes flick{0%,100%{opacity:.8}30%{opacity:.1}36%{opacity:.8}60%{opacity:.2}}
@keyframes drift{50%{transform:translate(4px,6px);opacity:.5}}
.shower{position:fixed;inset:0;pointer-events:none;overflow:hidden}
.shower i{position:absolute;top:-14px;font-style:normal;animation:fall 3.2s linear infinite}
@keyframes fall{to{transform:translateY(105vh) rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sky *,.shower{animation:none!important}.sky line{stroke-dashoffset:0}.shower{display:none}}
</style></head>
<body><main><div class="brand">${LOGO_SVG}Morex</div>${ask}${ok}${removed}</main>${script}</body></html>`;
}
