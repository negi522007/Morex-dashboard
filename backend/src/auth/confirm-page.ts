// The page behind the link in the confirmation email. Server-rendered on purpose: it must work
// without the frontend being involved, and it only *asks* — the two buttons call
// POST /auth/confirm and POST /auth/confirm/reject. A React page can replace it: set CONFIRM_PAGE_URL.

export type PageLang = 'en' | 'fr' | 'es';

const T: Record<PageLang, Record<string, string>> = {
  en: {
    askTitle: 'Is this you?', askHello: 'Someone used', askFor: 'to create a Morex Dashboard account', askName: 'Name given',
    yes: 'Yes, it’s me — confirm my account', no: 'No, it wasn’t me', askNote: 'Nothing happens until you choose. The link is valid for 24 hours.',
    okTitle: 'Your account is confirmed', okText: 'Welcome aboard! You can sign in now.', signIn: 'Sign in',
    okTips: 'Good first steps', tip1: 'Add your first widgets: weather, news, your GitHub…', tip2: 'Open your profile and add your birth date to unlock the well-being page.', tip3: 'Connect GitHub or Microsoft to get more widgets.',
    noTitle: 'Done — no account was created', noText: 'Nothing was activated and the pending account has been deleted.',
    noWhat: 'What you can do', no1: 'Nothing else is needed: nobody can use your address without clicking that confirmation link.', no2: 'For 24 hours we will not send any sign-up email to this address, so you are not bothered again.', no3: 'If you did want an account, you can sign up again tomorrow, or use GitHub or your school Microsoft account to sign in.',
    close: 'You can close this page.',
    badTitle: 'This link doesn’t work', badText: 'It is invalid, already used, or older than 24 hours.', badTip: 'If you signed up and have not confirmed yet, just sign up again with the same address: a new email will be sent.', signUp: 'Sign up again',
    err: 'Something went wrong. Please try again.',
  },
  fr: {
    askTitle: 'C’est bien vous ?', askHello: 'Quelqu’un a utilisé', askFor: 'pour créer un compte Morex Dashboard', askName: 'Nom indiqué',
    yes: 'Oui, c’est moi — confirmer mon compte', no: 'Non, ce n’était pas moi', askNote: 'Rien ne se passe tant que vous n’avez pas choisi. Le lien est valable 24 heures.',
    okTitle: 'Votre compte est confirmé', okText: 'Bienvenue ! Vous pouvez vous connecter.', signIn: 'Se connecter',
    okTips: 'Pour bien commencer', tip1: 'Ajoutez vos premiers widgets : météo, actualités, votre GitHub…', tip2: 'Ouvrez votre profil et ajoutez votre date de naissance pour débloquer la page bien-être.', tip3: 'Connectez GitHub ou Microsoft pour avoir plus de widgets.',
    noTitle: 'C’est fait — aucun compte n’a été créé', noText: 'Rien n’a été activé et le compte en attente a été supprimé.',
    noWhat: 'Ce que vous pouvez faire', no1: 'Rien de plus n’est nécessaire : personne ne peut utiliser votre adresse sans cliquer sur ce lien de confirmation.', no2: 'Pendant 24 heures nous n’enverrons plus d’email d’inscription à cette adresse, pour ne pas vous déranger.', no3: 'Si vous vouliez bien un compte, vous pourrez vous réinscrire demain, ou utiliser GitHub ou votre compte Microsoft d’école pour vous connecter.',
    close: 'Vous pouvez fermer cette page.',
    badTitle: 'Ce lien ne fonctionne pas', badText: 'Il est invalide, déjà utilisé, ou vieux de plus de 24 heures.', badTip: 'Si vous vous êtes inscrit sans confirmer, inscrivez-vous simplement à nouveau avec la même adresse : un nouvel email sera envoyé.', signUp: 'S’inscrire à nouveau',
    err: 'Une erreur est survenue. Veuillez réessayer.',
  },
  es: {
    askTitle: '¿Eres tú?', askHello: 'Alguien ha usado', askFor: 'para crear una cuenta de Morex Dashboard', askName: 'Nombre indicado',
    yes: 'Sí, soy yo — confirmar mi cuenta', no: 'No, no fui yo', askNote: 'No pasa nada hasta que elijas. El enlace vale 24 horas.',
    okTitle: 'Tu cuenta está confirmada', okText: '¡Bienvenido! Ya puedes iniciar sesión.', signIn: 'Iniciar sesión',
    okTips: 'Primeros pasos', tip1: 'Añade tus primeros widgets: el tiempo, noticias, tu GitHub…', tip2: 'Abre tu perfil y añade tu fecha de nacimiento para desbloquear la página de bienestar.', tip3: 'Conecta GitHub o Microsoft para tener más widgets.',
    noTitle: 'Hecho — no se creó ninguna cuenta', noText: 'No se activó nada y la cuenta pendiente se eliminó.',
    noWhat: 'Qué puedes hacer', no1: 'No hace falta nada más: nadie puede usar tu dirección sin pulsar ese enlace de confirmación.', no2: 'Durante 24 horas no enviaremos ningún email de registro a esta dirección, para no molestarte.', no3: 'Si sí querías una cuenta, puedes registrarte de nuevo mañana, o usar GitHub o tu cuenta Microsoft de la escuela para entrar.',
    close: 'Puedes cerrar esta página.',
    badTitle: 'Este enlace no funciona', badText: 'Es inválido, ya se usó, o tiene más de 24 horas.', badTip: 'Si te registraste y no confirmaste, simplemente regístrate otra vez con la misma dirección: se enviará un email nuevo.', signUp: 'Registrarse de nuevo',
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

  const ask = pending
    ? section('ask', false, `
      <div class="icon">✉️</div><h1>${t.askTitle}</h1>
      <p>${t.askHello} <strong>${esc(pending.email)}</strong> ${t.askFor}.</p>
      ${pending.firstName ? `<p class="muted">${t.askName} : ${esc(pending.firstName)}</p>` : ''}
      <div class="actions">
        <button class="primary" id="yes">${t.yes}</button>
        <button class="ghost" id="no">${t.no}</button>
      </div>
      <p class="muted small">${t.askNote}</p><p class="error" id="err" hidden>${t.err}</p>`)
    : section('bad', false, `
      <div class="icon">⏳</div><h1>${t.badTitle}</h1><p>${t.badText}</p><p class="muted">${t.badTip}</p>
      <div class="actions"><a class="primary" href="${esc(register)}">${t.signUp}</a></div>`);

  const ok = section('ok', true, `
    <div class="icon">🎉</div><h1>${t.okTitle}</h1><p>${t.okText}</p>
    <div class="actions"><a class="primary" href="${esc(login)}">${t.signIn}</a></div>
    <h2>${t.okTips}</h2><ul><li>${t.tip1}</li><li>${t.tip2}</li><li>${t.tip3}</li></ul>`);

  const removed = section('removed', true, `
    <div class="icon">🛡️</div><h1>${t.noTitle}</h1><p>${t.noText}</p>
    <h2>${t.noWhat}</h2><ul><li>${t.no1}</li><li>${t.no2}</li><li>${t.no3}</li></ul><p class="muted">${t.close}</p>`);

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
<meta name="robots" content="noindex"><title>Morex Dashboard</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef0ff;
background:radial-gradient(1200px 600px at 20% -10%,#3b2f8f55,transparent),radial-gradient(900px 500px at 100% 100%,#0e7c9a44,transparent),#0b1030}
main{width:100%;max-width:520px;padding:34px 30px;border-radius:24px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);
backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center}
.brand{font-weight:700;letter-spacing:.14em;font-size:12px;text-transform:uppercase;color:#9db4ff;margin-bottom:18px}
.icon{font-size:44px;line-height:1;margin-bottom:8px}
h1{margin:6px 0 10px;font-size:26px;line-height:1.2}
h2{margin:26px 0 8px;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#9db4ff}
p{margin:8px 0}strong{color:#fff;word-break:break-all}
.muted{color:#b8bfe0}.small{font-size:13px}
ul{text-align:left;margin:6px 0 0;padding-left:20px;color:#dfe3ff}li{margin:6px 0}
.actions{display:grid;gap:10px;margin:24px 0 8px}
button,a.primary{font:inherit;font-weight:600;border-radius:14px;padding:13px 18px;cursor:pointer;text-decoration:none;display:block;border:0}
.primary{background:linear-gradient(135deg,#5b8cff,#8a5bff);color:#fff}
.ghost{background:transparent;color:#eef0ff;border:1px solid rgba(255,255,255,.3)}
button:hover:not(:disabled),a.primary:hover{filter:brightness(1.1)}button:disabled{opacity:.55;cursor:wait}
button:focus-visible,a:focus-visible{outline:3px solid #fff;outline-offset:2px}
.error{color:#ffb4b4;background:#5c1d1d66;border-radius:10px;padding:8px 12px}
</style></head>
<body><main><div class="brand">Morex Dashboard</div>${ask}${ok}${removed}</main>${script}</body></html>`;
}
